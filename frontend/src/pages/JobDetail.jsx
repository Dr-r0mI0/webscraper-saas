import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';

const API_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

export default function JobDetail() {
    const { id } = useParams();
    const [job, setJob] = useState(null);
    const [logs, setLogs] = useState([]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('logs');
    const logsEndRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        fetchJob();
        fetchData();

        // Connect to Socket.IO for real-time logs
        socketRef.current = io('/', {
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to socket');
            socketRef.current.emit('subscribe', id);
        });

        socketRef.current.on('log', (logData) => {
            setLogs(prev => [...prev, logData]);
        });

        // Poll for job updates
        const interval = setInterval(fetchJob, 3000);

        return () => {
            socketRef.current?.emit('unsubscribe', id);
            socketRef.current?.disconnect();
            clearInterval(interval);
        };
    }, [id]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    async function fetchJob() {
        try {
            const res = await fetch(`${API_URL}/jobs/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error('Job not found');
            const result = await res.json();
            setJob(result.job);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchData() {
        try {
            const res = await fetch(`${API_URL}/jobs/${id}/data?limit=50`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            const result = await res.json();
            setData(result.data || []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    }

    async function handleAction(action) {
        try {
            await fetch(`${API_URL}/jobs/${id}/${action}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            fetchJob();
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

    if (error) {
        return (
            <div className="alert alert-error">
                {error}
                <Link to="/jobs" className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
                    Back to Jobs
                </Link>
            </div>
        );
    }

    const statusColors = {
        running: 'var(--warning-400)',
        completed: 'var(--success-400)',
        failed: 'var(--error-400)',
        paused: 'var(--warning-400)',
        stopped: 'var(--error-400)'
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Link to="/jobs" className="text-muted" style={{ fontSize: '0.875rem' }}>
                        ← Back to Jobs
                    </Link>
                    <h2 style={{ marginTop: 'var(--space-2)' }}>
                        {job?.sitemap_name || `Job #${id}`}
                    </h2>
                </div>
                <div className="flex gap-4">
                    {job?.status === 'running' && (
                        <button className="btn btn-secondary" onClick={() => handleAction('pause')}>
                            ⏸️ Pause
                        </button>
                    )}
                    {job?.status === 'paused' && (
                        <button className="btn btn-primary" onClick={() => handleAction('resume')}>
                            ▶ Resume
                        </button>
                    )}
                    {['running', 'paused', 'queued'].includes(job?.status) && (
                        <button className="btn btn-secondary" onClick={() => handleAction('stop')}>
                            ⏹️ Stop
                        </button>
                    )}
                    {job?.status === 'completed' && (
                        <>
                            <a
                                href={`${API_URL}/jobs/${id}/export/json`}
                                className="btn btn-secondary"
                                download
                            >
                                📥 JSON
                            </a>
                            <a
                                href={`${API_URL}/jobs/${id}/export/csv`}
                                className="btn btn-secondary"
                                download
                            >
                                📥 CSV
                            </a>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid mb-6">
                <div className="glass-card stat-card">
                    <div className="stat-label">Status</div>
                    <div className="stat-value" style={{ color: statusColors[job?.status] || 'inherit', fontSize: '1.5rem' }}>
                        {job?.status?.toUpperCase()}
                    </div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Progress</div>
                    <div className="stat-value">{job?.progress || 0}%</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Pages Scraped</div>
                    <div className="stat-value">{job?.scraped_pages || 0}</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Total Pages</div>
                    <div className="stat-value">{job?.total_pages || '—'}</div>
                </div>
            </div>

            {/* Progress Bar */}
            {['running', 'queued'].includes(job?.status) && (
                <div className="glass-card mb-6" style={{ padding: 'var(--space-4)' }}>
                    <div className="progress-bar" style={{ height: '12px' }}>
                        <div className="progress-fill" style={{ width: `${job?.progress || 0}%` }}></div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 mb-4">
                <button
                    className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('logs')}
                >
                    📝 Logs
                </button>
                <button
                    className={`btn ${activeTab === 'data' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => { setActiveTab('data'); fetchData(); }}
                >
                    📦 Data ({job?.scraped_items_count || data.length})
                </button>
            </div>

            {/* Logs Tab */}
            {activeTab === 'logs' && (
                <div className="terminal">
                    <div className="terminal-header">
                        <span className="terminal-dot red"></span>
                        <span className="terminal-dot yellow"></span>
                        <span className="terminal-dot green"></span>
                        <span className="terminal-title">Job #{id} - Live Logs</span>
                    </div>
                    <div className="terminal-body" style={{ maxHeight: '400px' }}>
                        {logs.length === 0 ? (
                            <div className="terminal-line">
                                <span className="terminal-prefix">$</span>
                                <span className="terminal-text">Waiting for logs...</span>
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="terminal-line">
                                    <span className="terminal-prefix">[{log.timestamp?.split('T')[1]?.split('.')[0] || ''}]</span>
                                    <span className={`terminal-text ${log.level}`}>
                                        [{log.level?.toUpperCase()}] {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
                <div className="glass-card" style={{ padding: 'var(--space-4)', overflow: 'auto' }}>
                    {data.length === 0 ? (
                        <p className="text-muted text-center">No data collected yet</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>URL</th>
                                    <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((item, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                                                {item.url?.substring(0, 50)}...
                                            </a>
                                        </td>
                                        <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                                                {JSON.stringify(item.data, null, 2).substring(0, 200)}...
                                            </pre>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
