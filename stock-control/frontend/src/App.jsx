import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard      from './pages/Dashboard';
import Products       from './pages/Products';
import Movements      from './pages/Movements';
import Suppliers      from './pages/Suppliers';
import Categories     from './pages/Categories';
import Users          from './pages/Users';
import Personas   from './pages/Personas';
import Dispensas  from './pages/Dispensas';
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

  const initials = (user.username || user.email || '??').slice(0, 2).toUpperCase();

  return (
    <div className="sidebar-user">
      <div className="sidebar-user-avatar">{initials}</div>
      <div className="sidebar-user-info">
        <span className="sidebar-user-name">{user.username || user.email || '—'}</span>
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
  '/':                'Dashboard',
  '/products':        'Productos',
  '/movements':       'Historial de movimientos',
  '/suppliers':       'Proveedores',
  '/categories':      'Categorías',
  '/users':           'Usuarios',
  '/personas':        'Personas',
  '/dispensas':       'Dispensas',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title = pageTitles[pathname] ?? 'Control de Stock';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/',                icon: '📊', label: 'Dashboard' },
    { to: '/products',        icon: '📦', label: 'Productos' },
    { to: '/movements',       icon: '↕️',  label: 'Movimientos' },
    { to: '/personas',        icon: '👥', label: 'Personas' },
    { to: '/dispensas',       icon: '💊', label: 'Dispensas' },
    { to: '/suppliers',       icon: '🏭', label: 'Proveedores' },
    { to: '/categories',      icon: '🏷️', label: 'Categorías' },
    ...(isAdmin ? [{ to: '/users', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>📦</span> Stock Control
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
        <div className="sidebar-footer">v2.0 · Control de Stock</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/products"   element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/movements"  element={<ProtectedRoute><Movements /></ProtectedRoute>} />
            <Route path="/suppliers"  element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
            <Route path="/users"           element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
            <Route path="/personas"       element={<ProtectedRoute><Personas /></ProtectedRoute>} />
            <Route path="/dispensas"      element={<ProtectedRoute><Dispensas /></ProtectedRoute>} />
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
