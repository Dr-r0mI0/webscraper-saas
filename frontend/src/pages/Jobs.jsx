import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

const STATUS_BADGES = {
    pending: { class: 'badge-info', text: 'Pending' },
    queued: { class: 'badge-info', text: 'Queued' },
    running: { class: 'badge-warning', text: 'Running' },
    paused: { class: 'badge-warning', text: 'Paused' },
    completed: { class: 'badge-success', text: 'Completed' },
    failed: { class: 'badge-error', text: 'Failed' },
    stopped: { class: 'badge-error', text: 'Stopped' }
};

export default function Jobs() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchJobs();
        // Poll for updates
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, []);

    async function fetchJobs() {
        try {
            const res = await fetch(`${API_URL}/jobs`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setJobs(data.jobs || []);
        } catch (err) {
            setError('Failed to load jobs');
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(jobId, action) {
        try {
            await fetch(`${API_URL}/jobs/${jobId}/${action}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            fetchJobs();
        } catch (err) {
            setError(`Failed to ${action} job`);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center" style={{ justifyContent: 'center', height: '200px' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2>Jobs</h2>
                <Link to="/sitemaps" className="btn btn-primary">
                    ➕ New Job
                </Link>
            </div>

            {error && <div className="alert alert-error mb-4">{error}</div>}

            {jobs.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <p className="text-muted mb-4">No jobs yet. Create one from a sitemap!</p>
                    <Link to="/sitemaps" className="btn btn-primary">
                        View Sitemaps
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {jobs.map((job) => {
                        const statusBadge = STATUS_BADGES[job.status] || { class: 'badge-info', text: job.status };

                        return (
                            <div key={job.id} className="glass-card" style={{ padding: 'var(--space-5)' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <div className="flex items-center gap-4 mb-1">
                                            <h4 style={{ margin: 0 }}>{job.sitemap_name || `Job #${job.id}`}</h4>
                                            <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                                        </div>
                                        <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                                            Created: {new Date(job.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-4">
                                        {job.status === 'running' && (
                                            <button className="btn btn-secondary" onClick={() => handleAction(job.id, 'pause')}>
                                                ⏸️ Pause
                                            </button>
                                        )}
                                        {job.status === 'paused' && (
                                            <button className="btn btn-primary" onClick={() => handleAction(job.id, 'resume')}>
                                                ▶ Resume
                                            </button>
                                        )}
                                        {['running', 'paused', 'queued'].includes(job.status) && (
                                            <button className="btn btn-ghost text-error" onClick={() => handleAction(job.id, 'stop')}>
                                                ⏹️ Stop
                                            </button>
                                        )}
                                        <Link to={`/jobs/${job.id}`} className="btn btn-secondary">
                                            View
                                        </Link>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {['running', 'queued'].includes(job.status) && (
                                    <div>
                                        <div className="flex justify-between text-muted mb-2" style={{ fontSize: '0.8125rem' }}>
                                            <span>{job.scraped_pages} / {job.total_pages || '?'} pages</span>
                                            <span>{job.progress}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${job.progress}%` }}></div>
                                        </div>
                                    </div>
                                )}

                                {/* Completed Stats */}
                                {job.status === 'completed' && (
                                    <div className="flex gap-4 text-muted" style={{ fontSize: '0.8125rem' }}>
                                        <span>✅ {job.scraped_pages} pages scraped</span>
                                        <span>⏱️ {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
