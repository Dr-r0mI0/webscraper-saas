import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

export default function Sitemaps() {
    const [sitemaps, setSitemaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImport, setShowImport] = useState(false);
    const [importData, setImportData] = useState({ name: '', config: '' });
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchSitemaps();
    }, []);

    async function fetchSitemaps() {
        try {
            const res = await fetch(`${API_URL}/sitemaps`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setSitemaps(data.sitemaps || []);
        } catch (err) {
            setError('Failed to load sitemaps');
        } finally {
            setLoading(false);
        }
    }

    async function handleImport(e) {
        e.preventDefault();
        setError('');
        setSuccess('');
        setImporting(true);

        try {
            const res = await fetch(`${API_URL}/sitemaps`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    name: importData.name,
                    config: importData.config
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error);
            }

            setSuccess('Sitemap imported successfully!');
            setSitemaps([data.sitemap, ...sitemaps]);
            setImportData({ name: '', config: '' });
            setShowImport(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setImporting(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this sitemap?')) return;

        try {
            await fetch(`${API_URL}/sitemaps/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setSitemaps(sitemaps.filter(s => s.id !== id));
            setSuccess('Sitemap deleted');
        } catch (err) {
            setError('Failed to delete sitemap');
        }
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                setImportData({
                    name: json._id || file.name.replace('.json', ''),
                    config: event.target.result
                });
            } catch {
                setError('Invalid JSON file');
            }
        };
        reader.readAsText(file);
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
                <h2>Sitemaps</h2>
                <button className="btn btn-primary" onClick={() => setShowImport(true)}>
                    ➕ Import Sitemap
                </button>
            </div>

            {error && <div className="alert alert-error mb-4">{error}</div>}
            {success && <div className="alert alert-success mb-4">{success}</div>}

            {/* Import Modal */}
            {showImport && (
                <div className="glass-card mb-6" style={{ padding: 'var(--space-6)' }}>
                    <h3 className="mb-4">Import Sitemap (Web Scraper JSON)</h3>
                    <form onSubmit={handleImport}>
                        <div className="form-group mb-4">
                            <label className="form-label">Upload JSON File</label>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">Or Paste JSON Config</label>
                            <textarea
                                className="form-input"
                                rows={8}
                                placeholder='{"_id": "my-scraper", "startUrl": ["https://..."], "selectors": [...]}'
                                value={importData.config}
                                onChange={(e) => setImportData({ ...importData, config: e.target.value })}
                                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">Sitemap Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="My Scraper"
                                value={importData.name}
                                onChange={(e) => setImportData({ ...importData, name: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button type="submit" className="btn btn-primary" disabled={importing}>
                                {importing ? <span className="spinner"></span> : 'Import'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowImport(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Sitemaps List */}
            {sitemaps.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <p className="text-muted mb-4">No sitemaps yet. Import your first one!</p>
                    <button className="btn btn-primary" onClick={() => setShowImport(true)}>
                        ➕ Import Sitemap
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {sitemaps.map((sitemap) => (
                        <div key={sitemap.id} className="glass-card" style={{ padding: 'var(--space-5)' }}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 style={{ marginBottom: 'var(--space-1)' }}>{sitemap.name}</h4>
                                    <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                                        {sitemap.selectorsCount} selectors • {sitemap.startUrls?.length || 0} start URLs
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <Link to={`/sitemaps/${sitemap.id}`} className="btn btn-secondary">
                                        View
                                    </Link>
                                    <Link to={`/jobs/new?sitemap=${sitemap.id}`} className="btn btn-primary">
                                        ▶ Run
                                    </Link>
                                    <button
                                        className="btn btn-ghost text-error"
                                        onClick={() => handleDelete(sitemap.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
