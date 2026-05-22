import express from 'express';
import db from '../db/init.js';
import { authenticate } from '../middleware/auth.js';
import { addJobToQueue, getJobStatus } from '../services/jobQueue.js';

const router = express.Router();

// Get all jobs for user
router.get('/', authenticate, (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;

        let query = `
      SELECT j.*, s.name as sitemap_name 
      FROM jobs j
      LEFT JOIN sitemaps s ON j.sitemap_id = s.id
      WHERE j.user_id = ?
    `;
        const params = [req.user.id];

        if (status) {
            query += ' AND j.status = ?';
            params.push(status);
        }

        query += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const jobs = db.prepare(query).all(...params);

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM jobs WHERE user_id = ?`;
        const { total } = db.prepare(countQuery).get(req.user.id);

        res.json({ jobs, total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get single job with details
router.get('/:id', authenticate, (req, res) => {
    try {
        const job = db.prepare(`
      SELECT j.*, s.name as sitemap_name, s.config as sitemap_config
      FROM jobs j
      LEFT JOIN sitemaps s ON j.sitemap_id = s.id
      WHERE j.id = ? AND j.user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Get scraped data count
        const { count } = db.prepare(`
      SELECT COUNT(*) as count FROM scraped_data WHERE job_id = ?
    `).get(job.id);

        res.json({
            job: {
                ...job,
                sitemap_config: job.sitemap_config ? JSON.parse(job.sitemap_config) : null,
                scraped_items_count: count
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

// Create new job (start scraping)
router.post('/', authenticate, async (req, res) => {
    try {
        const { sitemap_id, options = {} } = req.body;

        if (!sitemap_id) {
            return res.status(400).json({ error: 'sitemap_id is required' });
        }

        // Verify sitemap exists and belongs to user
        const sitemap = db.prepare(`
      SELECT * FROM sitemaps WHERE id = ? AND user_id = ?
    `).get(sitemap_id, req.user.id);

        if (!sitemap) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }

        // Create job record
        const stmt = db.prepare(`
      INSERT INTO jobs (user_id, sitemap_id, status, progress, total_pages, scraped_pages)
      VALUES (?, ?, 'pending', 0, 0, 0)
    `);
        const result = stmt.run(req.user.id, sitemap_id);
        const jobId = result.lastInsertRowid;

        // Add to queue
        await addJobToQueue({
            jobId,
            userId: req.user.id,
            sitemapId: sitemap_id,
            config: JSON.parse(sitemap.config),
            options: {
                maxPages: options.maxPages || 1000,
                concurrency: options.concurrency || 3,
                delay: options.delay || 1000,
                timeout: options.timeout || 30000,
                proxyRotation: options.proxyRotation || false,
                ...options
            }
        });

        // Update job status to queued
        db.prepare(`UPDATE jobs SET status = 'queued' WHERE id = ?`).run(jobId);

        res.status(201).json({
            message: 'Job created and queued',
            job: {
                id: jobId,
                sitemap_id,
                status: 'queued'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

// Pause job
router.post('/:id/pause', authenticate, (req, res) => {
    try {
        const job = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'running') {
            return res.status(400).json({ error: 'Can only pause running jobs' });
        }

        db.prepare(`UPDATE jobs SET status = 'paused' WHERE id = ?`).run(job.id);
        res.json({ message: 'Job paused', status: 'paused' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to pause job' });
    }
});

// Resume job
router.post('/:id/resume', authenticate, async (req, res) => {
    try {
        const job = db.prepare(`
      SELECT j.*, s.config as sitemap_config
      FROM jobs j
      LEFT JOIN sitemaps s ON j.sitemap_id = s.id
      WHERE j.id = ? AND j.user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'paused') {
            return res.status(400).json({ error: 'Can only resume paused jobs' });
        }

        // Re-add to queue
        await addJobToQueue({
            jobId: job.id,
            userId: req.user.id,
            sitemapId: job.sitemap_id,
            config: JSON.parse(job.sitemap_config),
            resume: true
        });

        db.prepare(`UPDATE jobs SET status = 'queued' WHERE id = ?`).run(job.id);
        res.json({ message: 'Job resumed', status: 'queued' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to resume job' });
    }
});

// Stop job
router.post('/:id/stop', authenticate, (req, res) => {
    try {
        const job = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (!['running', 'paused', 'queued'].includes(job.status)) {
            return res.status(400).json({ error: 'Job is not active' });
        }

        db.prepare(`
      UPDATE jobs SET status = 'stopped', completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(job.id);

        res.json({ message: 'Job stopped', status: 'stopped' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to stop job' });
    }
});

// Get job data (scraped results)
router.get('/:id/data', authenticate, (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const job = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const data = db.prepare(`
      SELECT * FROM scraped_data 
      WHERE job_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(job.id, parseInt(limit), parseInt(offset));

        const { total } = db.prepare(`
      SELECT COUNT(*) as total FROM scraped_data WHERE job_id = ?
    `).get(job.id);

        const formattedData = data.map(d => ({
            ...d,
            data: JSON.parse(d.data)
        }));

        res.json({ data: formattedData, total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch job data' });
    }
});

// Export job data as JSON
router.get('/:id/export/json', authenticate, (req, res) => {
    try {
        const job = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const data = db.prepare(`
      SELECT data FROM scraped_data WHERE job_id = ?
    `).all(job.id);

        const exportData = data.map(d => JSON.parse(d.data));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="job-${job.id}-export.json"`);
        res.json(exportData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Export job data as CSV
router.get('/:id/export/csv', authenticate, (req, res) => {
    try {
        const job = db.prepare(`
      SELECT * FROM jobs WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const data = db.prepare(`
      SELECT data FROM scraped_data WHERE job_id = ?
    `).all(job.id);

        if (data.length === 0) {
            return res.status(400).json({ error: 'No data to export' });
        }

        const rows = data.map(d => JSON.parse(d.data));

        // Get all unique keys
        const allKeys = [...new Set(rows.flatMap(r => Object.keys(r)))];

        // Build CSV
        const csvRows = [
            allKeys.join(','),
            ...rows.map(row =>
                allKeys.map(key => {
                    const val = row[key] || '';
                    // Escape quotes and wrap in quotes if contains comma
                    const escaped = String(val).replace(/"/g, '""');
                    return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped;
                }).join(',')
            )
        ];

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="job-${job.id}-export.csv"`);
        res.send(csvRows.join('\n'));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

export default router;
