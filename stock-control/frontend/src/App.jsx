import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard  from './pages/Dashboard';
import Products   from './pages/Products';
import Movements  from './pages/Movements';
import Suppliers  from './pages/Suppliers';
import Categories from './pages/Categories';
import Locations  from './pages/Locations';
import Inventory  from './pages/Inventory';
import Users      from './pages/Users';
import Reports    from './pages/Reports';
import Login      from './pages/Login';

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
  '/':           'Dashboard',
  '/products':   'Medicamentos',
  '/movements':  'Historial de movimientos',
  '/inventory':  'Carga de inventario',
  '/locations':  'Ubicaciones',
  '/suppliers':  'Proveedores',
  '/categories': 'Categorías',
  '/users':      'Usuarios',
  '/reports':    'Reportes',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title   = pageTitles[pathname] ?? 'Farmacia Hospital Cima';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/',           icon: '📊', label: 'Dashboard' },
    { to: '/products',   icon: '💊', label: 'Medicamentos' },
    { to: '/movements',  icon: '↕️',  label: 'Movimientos' },
    { to: '/inventory',  icon: '📋', label: 'Inventario' },
    { to: '/locations',  icon: '🏥', label: 'Ubicaciones' },
    { to: '/suppliers',  icon: '🏭', label: 'Proveedores' },
    { to: '/categories', icon: '🏷️', label: 'Categorías' },
    { to: '/reports',    icon: '📄', label: 'Reportes' },
    ...(isAdmin ? [{ to: '/users', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img
            src="/stock-control/logo-municipalidad.png"
            alt="Municipalidad de Cosquín"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
          />
          <span className="sidebar-logo-fallback" style={{ display: 'none' }}>
            🏥 Farmacia Hospital Dr. Armando Cima
          </span>
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
        <div className="sidebar-footer">v3.0 · Hospital Dr. Armando Cima</div>
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
            <Route path="/inventory"  element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/locations"  element={<ProtectedRoute><Locations /></ProtectedRoute>} />
            <Route path="/suppliers"  element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
            <Route path="/users"      element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
            <Route path="/reports"    element={<ProtectedRoute><Reports /></ProtectedRoute>} />
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
