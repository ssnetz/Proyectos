import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard    from './pages/Dashboard';
import Medicamentos from './pages/Medicamentos';
import Lotes        from './pages/Lotes';
import Movimientos  from './pages/Movimientos';
import Personas     from './pages/Personas';
import Dispensas    from './pages/Dispensas';
import Reportes     from './pages/Reportes';
import Proveedores  from './pages/Proveedores';
import Categorias   from './pages/Categorias';
import Ubicaciones  from './pages/Ubicaciones';
import Usuarios     from './pages/Usuarios';
import Facturas     from './pages/Facturas';
import Login        from './pages/Login';

// ─── Blue medical cross ───────────────────────────────────────────────────────
function MedCross({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="64" height="64" rx="12" fill="#1d4ed8"/>
      <rect x="26" y="8"  width="12" height="48" rx="4" fill="#fff"/>
      <rect x="8"  y="26" width="48" height="12" rx="4" fill="#fff"/>
    </svg>
  );
}

// ─── Protected route ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// ─── Sidebar user section ────────────────────────────────────────────────────
function SidebarUser() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = (user?.username || user?.email || '?').slice(0, 2).toUpperCase();
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

// ─── Page titles ─────────────────────────────────────────────────────────────
const pageTitles = {
  '/':               'Dashboard',
  '/medicamentos':   'Medicamentos',
  '/lotes':          'Lotes y Vencimientos',
  '/movimientos':    'Movimientos',
  '/personas':       'Personas',
  '/dispensas':      'Dispensas',
  '/reportes':       'Reportes',
  '/proveedores':    'Proveedores',
  '/categorias':     'Categorías',
  '/ubicaciones':    'Ubicaciones',
  '/usuarios':       'Usuarios',
  '/facturas':       'Facturas de Compra',
};

// ─── Main layout ─────────────────────────────────────────────────────────────
function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title        = pageTitles[pathname] ?? 'Control de Stock';
  const isAdmin      = user?.role === 'admin';

  const navItems = [
    { to: '/',             icon: '📊', label: 'Dashboard' },
    { to: '/medicamentos', icon: '💊', label: 'Medicamentos' },
    { to: '/lotes',        icon: '📦', label: 'Lotes y Vencimientos' },
    { to: '/movimientos',  icon: '↕️',  label: 'Movimientos' },
    { to: '/personas',     icon: '👥', label: 'Personas' },
    { to: '/dispensas',    icon: '🩺', label: 'Dispensas' },
    { to: '/reportes',     icon: '📈', label: 'Reportes' },
    { to: '/facturas',     icon: '🧾', label: 'Facturas de Compra' },
    { to: '/proveedores',  icon: '🏭', label: 'Proveedores' },
    { to: '/categorias',   icon: '🏷️', label: 'Categorías' },
    ...(isAdmin ? [
      { to: '/ubicaciones', icon: '📍', label: 'Ubicaciones' },
      { to: '/usuarios',    icon: '👤', label: 'Usuarios' },
    ] : []),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <MedCross size={36} />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-muni">Municipalidad</span>
            <span className="sidebar-brand-city">de Cosquín</span>
            <span className="sidebar-brand-dep">Farmacia Hospital Cima</span>
          </div>
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
        <div className="sidebar-footer">Sistema de Stock · Cosquín</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/medicamentos" element={<ProtectedRoute><Medicamentos /></ProtectedRoute>} />
            <Route path="/lotes"        element={<ProtectedRoute><Lotes /></ProtectedRoute>} />
            <Route path="/movimientos"  element={<ProtectedRoute><Movimientos /></ProtectedRoute>} />
            <Route path="/personas"     element={<ProtectedRoute><Personas /></ProtectedRoute>} />
            <Route path="/dispensas"    element={<ProtectedRoute><Dispensas /></ProtectedRoute>} />
            <Route path="/reportes"     element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
            <Route path="/facturas"     element={<ProtectedRoute><Facturas /></ProtectedRoute>} />
            <Route path="/proveedores"  element={<ProtectedRoute><Proveedores /></ProtectedRoute>} />
            <Route path="/categorias"   element={<ProtectedRoute><Categorias /></ProtectedRoute>} />
            <Route path="/ubicaciones"  element={<ProtectedRoute adminOnly><Ubicaciones /></ProtectedRoute>} />
            <Route path="/usuarios"     element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
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
