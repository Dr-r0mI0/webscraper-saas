import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const { user } = useAuth();

    return (
        <div>
            <h2 className="mb-6">Welcome back, {user?.username}! 👋</h2>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="glass-card stat-card">
                    <div className="stat-label">Total Jobs</div>
                    <div className="stat-value">0</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Active Scrapers</div>
                    <div className="stat-value">0</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Pages Scraped</div>
                    <div className="stat-value">0</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Data Collected</div>
                    <div className="stat-value">0 KB</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <h3 className="mb-4">Quick Actions</h3>
                <div className="flex gap-4">
                    <button className="btn btn-primary">
                        ➕ New Scraper
                    </button>
                    <button className="btn btn-secondary">
                        📤 Import Sitemap
                    </button>
                </div>
            </div>

            {/* Terminal Preview */}
            <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                <h3 className="mb-4">Live Console</h3>
                <div className="terminal">
                    <div className="terminal-header">
                        <span className="terminal-dot red"></span>
                        <span className="terminal-dot yellow"></span>
                        <span className="terminal-dot green"></span>
                        <span className="terminal-title">webscraper-pro ~ console</span>
                    </div>
                    <div className="terminal-body">
                        <div className="terminal-line">
                            <span className="terminal-prefix">$</span>
                            <span className="terminal-text info">System ready. Waiting for jobs...</span>
                        </div>
                        <div className="terminal-line">
                            <span className="terminal-prefix">$</span>
                            <span className="terminal-text">No active scraping tasks. Upload a sitemap to begin.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
