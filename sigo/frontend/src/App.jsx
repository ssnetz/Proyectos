import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MODULES, canAccess } from './config/modules';
import Dashboard from './pages/Dashboard';
import Obras     from './pages/Obras';
import Users     from './pages/Users';
import Login     from './pages/Login';

function ProtectedRoute({ children, adminOnly = false, moduleKey = null }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (moduleKey && !canAccess(user, moduleKey)) return <Navigate to="/" replace />;
  return children;
}

function SidebarUser() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.username.slice(0, 2).toUpperCase();
  return (
    <div className="sidebar-user">
      <div className="sidebar-user-avatar">{initials}</div>
      <div className="sidebar-user-info">
        <span className="sidebar-user-name">{user.username}</span>
        <span className={`badge ${user.role === 'admin' ? 'badge-purple' : 'badge-gray'}`} style={{ fontSize: '.65rem' }}>
          {user.role}
        </span>
      </div>
      <button
        className="btn btn-ghost btn-sm btn-icon"
        title="Cerrar sesión"
        onClick={logout}
        style={{ color: 'var(--gray-400)', borderColor: 'var(--gray-300)', marginLeft: 'auto' }}
      >
        ⏻
      </button>
    </div>
  );
}

const pageTitles = {
  '/':       'Dashboard',
  '/obras':  'Obras',
  '/users':  'Usuarios',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title   = pageTitles[pathname] ?? 'SIGO';
  const isAdmin = user?.role === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    ...MODULES
      .filter(m => canAccess(user, m.key))
      .map(m => ({ to: `/${m.key}`, icon: m.icon, label: m.label })),
    ...(isAdmin ? [{ to: '/users', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span>🏗️</span> SIGO
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <SidebarUser />
        <div className="sidebar-footer">
          v1.0 · SIGO<br />
          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>© {new Date().getFullYear()} SSNetz</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Menú">
            ☰
          </button>
          <img
            src="/sigo/logo.png"
            alt="SIGO"
            style={{ height: 40, width: 'auto', marginRight: 12, flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/obras" element={<ProtectedRoute moduleKey="obras"><Obras /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginGuard />} />
        <Route path="/*"     element={<AppLayout />} />
      </Routes>
    </AuthProvider>
  );
}

function LoginGuard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
