import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard      from './pages/Dashboard';
import Turnos         from './pages/Turnos';
import Personas       from './pages/Personas';
import Profesionales  from './pages/Profesionales';
import Instituciones  from './pages/Instituciones';
import Usuarios       from './pages/Usuarios';
import Login          from './pages/Login';

// ─── Protected route ────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// ─── Sidebar user section ───────────────────────────────────────────────────
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
        style={{ color: 'var(--gray-400)', borderColor: 'var(--gray-700)', marginLeft: 'auto' }}
      >
        ⏻
      </button>
    </div>
  );
}

// ─── Main layout (with sidebar) ─────────────────────────────────────────────
const pageTitles = {
  '/':              'Dashboard',
  '/turnos':        'Agenda de turnos prioritarios',
  '/personas':      'Personas',
  '/profesionales': 'Profesionales',
  '/instituciones': 'Instituciones',
  '/usuarios':      'Usuarios',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title = pageTitles[pathname] ?? 'Turnos Prioritarios';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/',              icon: '📊', label: 'Dashboard' },
    { to: '/turnos',        icon: '📅', label: 'Turnos' },
    { to: '/personas',      icon: '🧑', label: 'Personas' },
    { to: '/profesionales', icon: '🩺', label: 'Profesionales' },
    { to: '/instituciones', icon: '🏥', label: 'Instituciones' },
    ...(isAdmin ? [{ to: '/usuarios', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🩺</span> Turnos Prioritarios
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
        <div className="sidebar-footer">v1.0 · Hospital Cima</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/turnos"        element={<ProtectedRoute><Turnos /></ProtectedRoute>} />
            <Route path="/personas"      element={<ProtectedRoute><Personas /></ProtectedRoute>} />
            <Route path="/profesionales" element={<ProtectedRoute><Profesionales /></ProtectedRoute>} />
            <Route path="/instituciones" element={<ProtectedRoute><Instituciones /></ProtectedRoute>} />
            <Route path="/usuarios"      element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Root component ──────────────────────────────────────────────────────────
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

// Redirect already-logged-in users away from /login
function LoginGuard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
