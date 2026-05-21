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
import Login        from './pages/Login';

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
        <div className="sidebar-logo">
          <span>💊</span> Farmacia – Stock
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
        <div className="sidebar-footer">Control de Stock · Farmacia</div>
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
