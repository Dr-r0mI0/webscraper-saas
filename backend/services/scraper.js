import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import db from '../db/init.js';
import { emitJobUpdate } from './jobQueue.js';
import { EventEmitter } from 'events';

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Global event emitter for logs
export const scraperEvents = new EventEmitter();

// Ban detection patterns
const BAN_PATTERNS = [
    'access denied',
    'bot detected',
    'captcha',
    'please wait',
    'too many requests',
    'rate limit',
    'blocked',
    'forbidden',
    'unusual traffic',
    'verify you are human',
    'cloudflare',
    'just a moment',
    'checking your browser'
];

// User agents pool
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

// Viewport sizes pool
const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 }
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomViewport() {
    return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

function log(jobId, level, message, data = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...data
    };
    console.log(`[Job ${jobId}] [${level.toUpperCase()}] ${message}`);
    scraperEvents.emit('log', { jobId, ...logEntry });
    emitJobUpdate(jobId, { type: 'log', ...logEntry });
}

async function detectBan(page) {
    try {
        const content = await page.content();
        const lowerContent = content.toLowerCase();

        for (const pattern of BAN_PATTERNS) {
            if (lowerContent.includes(pattern)) {
                return { banned: true, reason: pattern };
            }
        }

        return { banned: false };
    } catch (err) {
        return { banned: false };
    }
}

async function handleInfiniteScroll(page, selector, maxScrolls = 50) {
    let previousHeight = 0;
    let scrollCount = 0;
    let noChangeCount = 0;

    while (scrollCount < maxScrolls && noChangeCount < 3) {
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);

        if (currentHeight === previousHeight) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
        }

        previousHeight = currentHeight;

        // Scroll down
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Wait for content to load
        await page.waitForTimeout(1500 + Math.random() * 1000);

        scrollCount++;
    }

    return scrollCount;
}

async function extractData(page, selectors) {
    const results = {};

    for (const selector of selectors) {
        try {
            switch (selector.type) {
                case 'SelectorText':
                    if (selector.multiple) {
                        results[selector.id] = await page.$$eval(selector.selector, els =>
                            els.map(el => el.textContent.trim())
                        );
                    } else {
                        results[selector.id] = await page.$eval(selector.selector, el =>
                            el.textContent.trim()
                        ).catch(() => null);
                    }
                    break;

                case 'SelectorLink':
                    if (selector.multiple) {
                        results[selector.id] = await page.$$eval(selector.selector, els =>
                            els.map(el => ({ text: el.textContent.trim(), href: el.href }))
                        );
                    } else {
                        results[selector.id] = await page.$eval(selector.selector, el =>
                            ({ text: el.textContent.trim(), href: el.href })
                        ).catch(() => null);
                    }
                    break;

                case 'SelectorImage':
                    if (selector.multiple) {
                        results[selector.id] = await page.$$eval(selector.selector, els =>
                            els.map(el => el.src)
                        );
                    } else {
                        results[selector.id] = await page.$eval(selector.selector, el =>
                            el.src
                        ).catch(() => null);
                    }
                    break;

                case 'SelectorHTML':
                    if (selector.multiple) {
                        results[selector.id] = await page.$$eval(selector.selector, els =>
                            els.map(el => el.innerHTML)
                        );
                    } else {
                        results[selector.id] = await page.$eval(selector.selector, el =>
                            el.innerHTML
                        ).catch(() => null);
                    }
                    break;

                case 'SelectorElement':
                case 'SelectorElementScroll':
                    // Container selector - used for grouping
                    results[selector.id] = await page.$$eval(selector.selector, els => els.length);
                    break;

                default:
                    // Try generic text extraction
                    results[selector.id] = await page.$eval(selector.selector, el =>
                        el.textContent.trim()
                    ).catch(() => null);
            }
        } catch (err) {
            results[selector.id] = null;
        }
    }

    return results;
}

async function processPage(browser, url, selectors, jobId, options, retryCount = 0) {
    const maxRetries = options.maxRetries || 3;

    const page = await browser.newPage();

    try {
        // Set random identity
        const userAgent = getRandomUserAgent();
        const viewport = getRandomViewport();

        await page.setUserAgent(userAgent);
        await page.setViewport(viewport);

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        log(jobId, 'info', `Navigating to: ${url}`, { viewport, userAgent: userAgent.substring(0, 50) + '...' });

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: options.timeout || 30000
        });

        // Check for ban
        const banCheck = await detectBan(page);
        if (banCheck.banned) {
            log(jobId, 'warn', `Ban detected: ${banCheck.reason}`, { url });

            if (retryCount < maxRetries) {
                log(jobId, 'info', `Retrying with new identity (attempt ${retryCount + 1}/${maxRetries})`);
                await page.close();

                // Increase delay before retry
                await new Promise(r => setTimeout(r, (retryCount + 1) * 2000));

                return processPage(browser, url, selectors, jobId, options, retryCount + 1);
            } else {
                throw new Error(`Max retries reached. Ban reason: ${banCheck.reason}`);
            }
        }

        // Handle infinite scroll if needed
        const scrollSelectors = selectors.filter(s => s.type === 'SelectorElementScroll');
        if (scrollSelectors.length > 0) {
            log(jobId, 'info', 'Handling infinite scroll...');
            const scrolls = await handleInfiniteScroll(page, scrollSelectors[0].selector);
            log(jobId, 'info', `Completed ${scrolls} scroll iterations`);
        }

        // Wait for content
        await page.waitForTimeout(options.delay || 1000);

        // Extract data
        const data = await extractData(page, selectors);

        log(jobId, 'success', `Extracted data from: ${url}`, { fieldsCount: Object.keys(data).length });

        await page.close();
        return { success: true, url, data };

    } catch (err) {
        log(jobId, 'error', `Failed to process: ${url}`, { error: err.message });
        await page.close();

        if (retryCount < maxRetries) {
            await new Promise(r => setTimeout(r, (retryCount + 1) * 2000));
            return processPage(browser, url, selectors, jobId, options, retryCount + 1);
        }

        return { success: false, url, error: err.message };
    }
}

export async function runScraper(jobData) {
    const { jobId, config, options = {} } = jobData;

    log(jobId, 'info', 'Starting scraper...');

    // Update job status to running
    db.prepare(`UPDATE jobs SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);

    let browser;

    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        log(jobId, 'info', 'Browser launched');

        // Parse start URLs
        let startUrls = config.startUrl || [];
        if (typeof startUrls === 'string') startUrls = [startUrls];

        // Expand URL ranges [1-10]
        const expandedUrls = [];
        for (const url of startUrls) {
            const rangeMatch = url.match(/\[(\d+)-(\d+)\]/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                for (let i = start; i <= end && expandedUrls.length < (options.maxPages || 1000); i++) {
                    expandedUrls.push(url.replace(/\[\d+-\d+\]/, i));
                }
            } else {
                expandedUrls.push(url);
            }
        }

        // Apply max pages limit
        const urlsToProcess = expandedUrls.slice(0, options.maxPages || 1000);
        const totalPages = urlsToProcess.length;

        log(jobId, 'info', `Processing ${totalPages} URLs`);
        db.prepare(`UPDATE jobs SET total_pages = ? WHERE id = ?`).run(totalPages, jobId);

        // Get root selectors (direct children of _root)
        const rootSelectors = (config.selectors || []).filter(
            s => s.parentSelectors?.includes('_root')
        );

        // Process URLs with concurrency limit
        const concurrency = options.concurrency || 3;
        let processed = 0;

        for (let i = 0; i < urlsToProcess.length; i += concurrency) {
            // Check if job was stopped/paused
            const jobStatus = db.prepare(`SELECT status FROM jobs WHERE id = ?`).get(jobId);
            if (jobStatus?.status === 'stopped' || jobStatus?.status === 'paused') {
                log(jobId, 'warn', `Job ${jobStatus.status}. Stopping...`);
                break;
            }

            const batch = urlsToProcess.slice(i, i + concurrency);

            const results = await Promise.all(
                batch.map(url => processPage(browser, url, rootSelectors, jobId, options))
            );

            // Save results to database
            const insertStmt = db.prepare(`
        INSERT INTO scraped_data (job_id, url, data) VALUES (?, ?, ?)
      `);

            for (const result of results) {
                if (result.success) {
                    insertStmt.run(jobId, result.url, JSON.stringify(result.data));
                }
                processed++;
            }

            // Update progress
            const progress = Math.round((processed / totalPages) * 100);
            db.prepare(`UPDATE jobs SET scraped_pages = ?, progress = ? WHERE id = ?`).run(processed, progress, jobId);

            emitJobUpdate(jobId, { type: 'progress', processed, total: totalPages, progress });

            // Delay between batches
            if (i + concurrency < urlsToProcess.length) {
                await new Promise(r => setTimeout(r, options.delay || 1000));
            }
        }

        // Mark job as completed
        const finalStatus = db.prepare(`SELECT status FROM jobs WHERE id = ?`).get(jobId);
        if (finalStatus?.status === 'running') {
            db.prepare(`
        UPDATE jobs SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(jobId);
        }

        log(jobId, 'success', `Scraping completed. Processed ${processed}/${totalPages} pages.`);

        await browser.close();

    } catch (err) {
        log(jobId, 'error', `Scraper failed: ${err.message}`);

        db.prepare(`
      UPDATE jobs SET status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(jobId);

        if (browser) await browser.close();
        throw err;
    }
}
