// Job Queue Service
// For now, using a simple in-memory queue
// TODO: Replace with BullMQ + Redis for production

const jobQueue = [];
const jobCallbacks = new Map();

export async function addJobToQueue(jobData) {
    jobQueue.push(jobData);
    console.log(`[Queue] Job ${jobData.jobId} added to queue. Queue size: ${jobQueue.length}`);

    // Process queue
    processQueue();

    return jobData.jobId;
}

export function getJobStatus(jobId) {
    const inQueue = jobQueue.find(j => j.jobId === jobId);
    return inQueue ? 'queued' : 'unknown';
}

export function onJobUpdate(jobId, callback) {
    jobCallbacks.set(jobId, callback);
}

export function emitJobUpdate(jobId, data) {
    const callback = jobCallbacks.get(jobId);
    if (callback) {
        callback(data);
    }
}

// Simple queue processor
let isProcessing = false;

async function processQueue() {
    if (isProcessing || jobQueue.length === 0) return;

    isProcessing = true;

    while (jobQueue.length > 0) {
        const job = jobQueue.shift();
        console.log(`[Queue] Processing job ${job.jobId}`);

        try {
            // Dynamic import to avoid circular dependencies
            const { runScraper } = await import('./scraper.js');
            await runScraper(job);
        } catch (err) {
            console.error(`[Queue] Job ${job.jobId} failed:`, err);
        }
    }

    isProcessing = false;
}
