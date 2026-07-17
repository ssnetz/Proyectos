import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MODULES, canAccess } from './config/modules';
import Logo from './components/Logo';
import Dashboard from './pages/Dashboard';
import Medicamentos from './pages/Medicamentos';
import Lotes from './pages/Lotes';
import Movimientos from './pages/Movimientos';
import Personas from './pages/Personas';
import Dispensas from './pages/Dispensas';
import Reportes from './pages/Reportes';
import Facturas from './pages/Facturas';
import Proveedores from './pages/Proveedores';
import Categorias from './pages/Categorias';
import Ubicaciones from './pages/Ubicaciones';
import Usuarios from './pages/Usuarios';
import Login from './pages/Login';

// ─── Protected route ────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false, moduleKey = null }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (moduleKey && !canAccess(user, moduleKey)) return <Navigate to="/" replace />;
  return children;
}

// ─── Sidebar user section ───────────────────────────────────────────────────
function SidebarUser() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = (user.username || user.email || '?').slice(0, 2).toUpperCase();

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
  '/': 'Dashboard',
  '/medicamentos': 'Medicamentos',
  '/lotes': 'Lotes y Vencimientos',
  '/movimientos': 'Movimientos',
  '/personas': 'Personas',
  '/dispensas': 'Dispensas',
  '/reportes': 'Reportes',
  '/proveedores': 'Proveedores',
  '/categorias': 'Categorías',
  '/ubicaciones': 'Ubicaciones',
  '/usuarios': 'Usuarios',
  '/facturas': 'Facturas de Compra',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = pageTitles[pathname] ?? 'Control de Stock';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    ...MODULES
      .filter(m => canAccess(user, m.key))
      .map(m => ({ to: `/${m.key}`, icon: m.icon, label: m.label })),
    ...(isAdmin ? [{ to: '/ubicaciones', icon: '📍', label: 'Ubicaciones' }, { to: '/usuarios', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={36} />
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
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/medicamentos" element={<ProtectedRoute moduleKey="medicamentos"><Medicamentos /></ProtectedRoute>} />
            <Route path="/lotes" element={<ProtectedRoute moduleKey="lotes"><Lotes /></ProtectedRoute>} />
            <Route path="/movimientos" element={<ProtectedRoute moduleKey="movimientos"><Movimientos /></ProtectedRoute>} />
            <Route path="/personas" element={<ProtectedRoute moduleKey="personas"><Personas /></ProtectedRoute>} />
            <Route path="/dispensas" element={<ProtectedRoute moduleKey="dispensas"><Dispensas /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute moduleKey="reportes"><Reportes /></ProtectedRoute>} />
            <Route path="/facturas" element={<ProtectedRoute moduleKey="facturas"><Facturas /></ProtectedRoute>} />
            <Route path="/proveedores" element={<ProtectedRoute moduleKey="proveedores"><Proveedores /></ProtectedRoute>} />
            <Route path="/categorias" element={<ProtectedRoute moduleKey="categorias"><Categorias /></ProtectedRoute>} />
            <Route path="/ubicaciones" element={<ProtectedRoute adminOnly><Ubicaciones /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
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
        <Route path="/*" element={<AppLayout />} />
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
