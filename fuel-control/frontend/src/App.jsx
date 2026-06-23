import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard  from './pages/Dashboard';
import Fueling    from './pages/Fueling';
import Vehicles   from './pages/Vehicles';
import FuelPrices from './pages/FuelPrices';
import Users      from './pages/Users';
import Login     from './pages/Login';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
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
        style={{ color: 'var(--gray-400)', borderColor: 'var(--gray-700)', marginLeft: 'auto' }}
      >
        ⏻
      </button>
    </div>
  );
}

const pageTitles = {
  '/':            'Dashboard',
  '/fueling':     'Cargas de Combustible',
  '/vehicles':    'Vehículos y Maquinaria',
  '/fuel-prices': 'Precios de Combustible',
  '/users':       'Usuarios',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title   = pageTitles[pathname] ?? 'Control de Combustible';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/',         icon: '📊', label: 'Dashboard' },
    { to: '/fueling',  icon: '⛽', label: 'Cargas' },
    { to: '/vehicles',    icon: '🚛', label: 'Vehículos' },
    { to: '/fuel-prices', icon: '💲', label: 'Precios' },
    ...(isAdmin ? [{ to: '/users', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>⛽</span> Combustible
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
        <div className="sidebar-footer">v1.0 · Control de Combustible</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/fueling"  element={<ProtectedRoute><Fueling /></ProtectedRoute>} />
            <Route path="/vehicles"    element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
            <Route path="/fuel-prices" element={<ProtectedRoute><FuelPrices /></ProtectedRoute>} />
            <Route path="/users"       element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
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
