import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard         from './pages/Dashboard';
import Actas             from './pages/Actas';
import Electores          from './pages/Electores';
import Establecimientos  from './pages/Establecimientos';
import Mesas              from './pages/Mesas';
import Partidos           from './pages/Partidos';
import Cargos             from './pages/Cargos';
import Listas             from './pages/Listas';
import Candidatos         from './pages/Candidatos';
import Fiscales           from './pages/Fiscales';
import Usuarios           from './pages/Usuarios';
import Login              from './pages/Login';

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
  '/':                  'Dashboard',
  '/actas':             'Actas de escrutinio',
  '/electores':         'Padrón de electores',
  '/establecimientos':  'Establecimientos',
  '/mesas':             'Mesas',
  '/partidos':          'Partidos',
  '/cargos':            'Cargos',
  '/listas':            'Listas',
  '/candidatos':        'Candidatos',
  '/fiscales':          'Fiscales',
  '/usuarios':          'Usuarios',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title = pageTitles[pathname] ?? 'Electis';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Electis" className="sidebar-logo-img" /> Electis
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">📊</span> Dashboard
          </NavLink>

          <div className="nav-section">Escrutinio</div>
          <NavLink to="/actas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🗳️</span> Actas
          </NavLink>
          <NavLink to="/electores" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">👥</span> Electores
          </NavLink>

          <div className="nav-section">Catálogos</div>
          <NavLink to="/establecimientos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🏫</span> Establecimientos
          </NavLink>
          <NavLink to="/mesas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🪑</span> Mesas
          </NavLink>
          <NavLink to="/partidos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🚩</span> Partidos
          </NavLink>
          <NavLink to="/cargos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🏛️</span> Cargos
          </NavLink>
          <NavLink to="/listas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">📋</span> Listas
          </NavLink>
          <NavLink to="/candidatos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🎖️</span> Candidatos
          </NavLink>
          <NavLink to="/fiscales" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🕵️</span> Fiscales
          </NavLink>

          {isAdmin && (
            <>
              <div className="nav-section">Administración</div>
              <NavLink to="/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">👤</span> Usuarios
              </NavLink>
            </>
          )}
        </nav>
        <SidebarUser />
        <div className="sidebar-footer">v0.1 · Electis</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"                 element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/actas"            element={<ProtectedRoute><Actas /></ProtectedRoute>} />
            <Route path="/electores"        element={<ProtectedRoute><Electores /></ProtectedRoute>} />
            <Route path="/establecimientos" element={<ProtectedRoute><Establecimientos /></ProtectedRoute>} />
            <Route path="/mesas"            element={<ProtectedRoute><Mesas /></ProtectedRoute>} />
            <Route path="/partidos"         element={<ProtectedRoute><Partidos /></ProtectedRoute>} />
            <Route path="/cargos"           element={<ProtectedRoute><Cargos /></ProtectedRoute>} />
            <Route path="/listas"           element={<ProtectedRoute><Listas /></ProtectedRoute>} />
            <Route path="/candidatos"       element={<ProtectedRoute><Candidatos /></ProtectedRoute>} />
            <Route path="/fiscales"         element={<ProtectedRoute><Fiscales /></ProtectedRoute>} />
            <Route path="/usuarios"         element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
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
