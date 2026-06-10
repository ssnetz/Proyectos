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

// ─── Cosquín municipal shield (simplified SVG) ───────────────────────────────
function CosquinShield({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Shield outline */}
      <path d="M4 4 H76 V58 Q40 90 40 90 Q40 90 4 58 Z" fill="#1a3a6b" stroke="#c8a93e" strokeWidth="3"/>
      {/* Sky — upper half */}
      <path d="M6 6 H74 V34 H6 Z" fill="#2563eb"/>
      {/* Sun */}
      <circle cx="40" cy="18" r="7" fill="#fbbf24"/>
      <line x1="40" y1="8"  x2="40" y2="5"  stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="40" y2="31" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="18" x2="27" y2="18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="18" x2="53" y2="18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="33" y1="11" x2="31" y2="9"  stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="47" y1="25" x2="49" y2="27" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="47" y1="11" x2="49" y2="9"  stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="33" y1="25" x2="31" y2="27" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      {/* Divider line */}
      <line x1="6" y1="34" x2="74" y2="34" stroke="#c8a93e" strokeWidth="1.5"/>
      {/* Mountains — middle */}
      <path d="M6 56 L20 36 L32 50 L44 34 L56 50 L68 36 L74 46 L74 56 Z" fill="#16a34a"/>
      <path d="M6 56 L20 42 L32 52 L44 40 L56 52 L68 42 L74 48 L74 56 Z" fill="#15803d"/>
      {/* Divider */}
      <line x1="6" y1="56" x2="74" y2="56" stroke="#c8a93e" strokeWidth="1.5"/>
      {/* Water waves — lower */}
      <path d="M6 56 Q40 56 74 56 L74 68 Q40 68 6 68 Z" fill="#1d4ed8"/>
      <path d="M6 60 Q16 57 26 60 Q36 63 46 60 Q56 57 66 60 Q72 62 74 60" stroke="#60a5fa" strokeWidth="1.5" fill="none"/>
      <path d="M6 64 Q16 61 26 64 Q36 67 46 64 Q56 61 66 64 Q72 66 74 64" stroke="#93c5fd" strokeWidth="1.2" fill="none"/>
      {/* Bottom point */}
      <path d="M6 68 Q40 90 74 68" fill="#c8262c"/>
      {/* Gold border bottom */}
      <path d="M4 4 H76 V58 Q40 90 40 90 Q40 90 4 58 Z" fill="none" stroke="#c8a93e" strokeWidth="3"/>
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
          <CosquinShield size={36} />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-muni">Municipalidad</span>
            <span className="sidebar-brand-city">de Cosquín</span>
            <span className="sidebar-brand-dep">Farmacia Municipal</span>
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
