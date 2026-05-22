import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/login');
    }

    return (
        <div className="dashboard-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">🕷️</div>
                    <span className="sidebar-logo-text">WebScraper Pro</span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        📊 Dashboard
                    </NavLink>
                    <NavLink
                        to="/sitemaps"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        🗺️ Sitemaps
                    </NavLink>
                    <NavLink
                        to="/jobs"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        ⚙️ Jobs
                    </NavLink>
                    <NavLink
                        to="/proxies"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        🔒 Proxies
                    </NavLink>
                    <NavLink
                        to="/data"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        📦 Data
                    </NavLink>

                    <div style={{ flex: 1 }}></div>

                    <NavLink
                        to="/profile"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        👤 Profile
                    </NavLink>
                    <button
                        onClick={handleLogout}
                        className="sidebar-link"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    >
                        🚪 Logout
                    </button>
                </nav>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
