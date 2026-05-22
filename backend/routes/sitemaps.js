import express from 'express';
import db from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all sitemaps for user
router.get('/', authenticate, (req, res) => {
    try {
        const sitemaps = db.prepare(`
      SELECT id, name, config, created_at 
      FROM sitemaps 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.user.id);

        // Parse config for each sitemap
        const formattedSitemaps = sitemaps.map(s => ({
            ...s,
            config: JSON.parse(s.config),
            selectorsCount: JSON.parse(s.config).selectors?.length || 0,
            startUrls: JSON.parse(s.config).startUrl || []
        }));

        res.json({ sitemaps: formattedSitemaps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch sitemaps' });
    }
});

// Get single sitemap
router.get('/:id', authenticate, (req, res) => {
    try {
        const sitemap = db.prepare(`
      SELECT * FROM sitemaps WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!sitemap) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }

        res.json({
            sitemap: {
                ...sitemap,
                config: JSON.parse(sitemap.config)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch sitemap' });
    }
});

// Create/Import sitemap
router.post('/', authenticate, (req, res) => {
    try {
        const { name, config } = req.body;

        if (!name || !config) {
            return res.status(400).json({ error: 'Name and config are required' });
        }

        // Validate config structure (Web Scraper format)
        let parsedConfig;
        if (typeof config === 'string') {
            try {
                parsedConfig = JSON.parse(config);
            } catch {
                return res.status(400).json({ error: 'Invalid JSON config' });
            }
        } else {
            parsedConfig = config;
        }

        // Validate required fields
        if (!parsedConfig._id && !parsedConfig.startUrl) {
            return res.status(400).json({
                error: 'Invalid sitemap format. Must have _id or startUrl field.'
            });
        }

        // Use the sitemap _id as name if not provided
        const sitemapName = name || parsedConfig._id || 'Untitled Sitemap';

        const stmt = db.prepare(`
      INSERT INTO sitemaps (user_id, name, config) VALUES (?, ?, ?)
    `);
        const result = stmt.run(req.user.id, sitemapName, JSON.stringify(parsedConfig));

        res.status(201).json({
            message: 'Sitemap imported successfully',
            sitemap: {
                id: result.lastInsertRowid,
                name: sitemapName,
                config: parsedConfig,
                selectorsCount: parsedConfig.selectors?.length || 0
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to import sitemap' });
    }
});

// Update sitemap
router.put('/:id', authenticate, (req, res) => {
    try {
        const { name, config } = req.body;
        const { id } = req.params;

        // Check ownership
        const existing = db.prepare(`
      SELECT id FROM sitemaps WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

        if (!existing) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }

        const updates = [];
        const values = [];

        if (name) {
            updates.push('name = ?');
            values.push(name);
        }

        if (config) {
            const configStr = typeof config === 'string' ? config : JSON.stringify(config);
            updates.push('config = ?');
            values.push(configStr);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(id);
        db.prepare(`UPDATE sitemaps SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const updated = db.prepare('SELECT * FROM sitemaps WHERE id = ?').get(id);
        res.json({
            message: 'Sitemap updated',
            sitemap: {
                ...updated,
                config: JSON.parse(updated.config)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update sitemap' });
    }
});

// Delete sitemap
router.delete('/:id', authenticate, (req, res) => {
    try {
        const { id } = req.params;

        const existing = db.prepare(`
      SELECT id FROM sitemaps WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

        if (!existing) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }

        db.prepare('DELETE FROM sitemaps WHERE id = ?').run(id);
        res.json({ message: 'Sitemap deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete sitemap' });
    }
});

// Analyze sitemap (preview what will be scraped)
router.post('/:id/analyze', authenticate, (req, res) => {
    try {
        const sitemap = db.prepare(`
      SELECT * FROM sitemaps WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

        if (!sitemap) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }

        const config = JSON.parse(sitemap.config);

        // Calculate estimated pages
        let startUrls = config.startUrl || [];
        if (typeof startUrls === 'string') startUrls = [startUrls];

        // Check for range patterns like [1-100]
        let estimatedUrls = 0;
        startUrls.forEach(url => {
            const rangeMatch = url.match(/\[(\d+)-(\d+)\]/);
            if (rangeMatch) {
                estimatedUrls += parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1;
            } else {
                estimatedUrls += 1;
            }
        });

        // Count selectors by type
        const selectorTypes = {};
        (config.selectors || []).forEach(sel => {
            selectorTypes[sel.type] = (selectorTypes[sel.type] || 0) + 1;
        });

        // Estimate total pages based on link selectors
        const linkSelectors = (config.selectors || []).filter(s => s.type === 'SelectorLink');
        const hasInfiniteScroll = (config.selectors || []).some(s => s.type === 'SelectorElementScroll');

        res.json({
            analysis: {
                name: sitemap.name,
                startUrlsCount: startUrls.length,
                estimatedStartPages: estimatedUrls,
                totalSelectors: (config.selectors || []).length,
                selectorTypes,
                linkDepth: linkSelectors.length,
                hasInfiniteScroll,
                estimatedTotalPages: hasInfiniteScroll ? 'Unknown (Infinite Scroll)' : estimatedUrls * Math.max(1, linkSelectors.length * 10),
                warnings: []
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to analyze sitemap' });
    }
});

export default router;
