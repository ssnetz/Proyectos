import { Fragment } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MunicipioProvider, useMunicipio } from './context/MunicipioContext';
import { MODULES, canAccess } from './config/modules';
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
import Municipios         from './pages/Municipios';
import Login              from './pages/Login';

// ─── Protected route ────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false, moduleKey = null }) {
  const { user, loading } = useAuth();
  const { loading: municipioLoading } = useMunicipio();
  if (loading || municipioLoading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (moduleKey && !canAccess(user, moduleKey)) return <Navigate to="/" replace />;
  return children;
}

// ─── Municipio selector ─────────────────────────────────────────────────────
function MunicipioSelector() {
  const { municipios, selectedId, setSelectedId, isAdmin } = useMunicipio();

  if (!isAdmin) {
    return (
      <div className="sidebar-municipio" title="Municipio/Comuna">
        <span className="nav-icon">🏙️</span> {municipios[0]?.nombre ?? '—'}
      </div>
    );
  }

  return (
    <div className="sidebar-municipio">
      <select
        className="form-control"
        value={selectedId ?? ''}
        onChange={(e) => setSelectedId(Number(e.target.value))}
        title="Municipio/Comuna"
      >
        {municipios.map((m) => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>
    </div>
  );
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
  '/municipios':        'Municipios / Comunas',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title = pageTitles[pathname] ?? 'Electis';
  const isAdmin = user?.role === 'admin';

  const sections = [];
  MODULES.filter(m => canAccess(user, m.key)).forEach(m => {
    let sec = sections.find(s => s.name === m.section);
    if (!sec) { sec = { name: m.section, items: [] }; sections.push(sec); }
    sec.items.push(m);
  });

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

          {sections.map(sec => (
            <Fragment key={sec.name}>
              <div className="nav-section">{sec.name}</div>
              {sec.items.map(m => (
                <NavLink key={m.key} to={`/${m.key}`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{m.icon}</span> {m.label}
                </NavLink>
              ))}
            </Fragment>
          ))}

          {isAdmin && (
            <>
              <div className="nav-section">Administración</div>
              <NavLink to="/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">👤</span> Usuarios
              </NavLink>
              <NavLink to="/municipios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">🏙️</span> Municipios / Comunas
              </NavLink>
            </>
          )}
        </nav>
        <MunicipioSelector />
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
            <Route path="/actas"            element={<ProtectedRoute moduleKey="actas"><Actas /></ProtectedRoute>} />
            <Route path="/electores"        element={<ProtectedRoute moduleKey="electores"><Electores /></ProtectedRoute>} />
            <Route path="/establecimientos" element={<ProtectedRoute moduleKey="establecimientos"><Establecimientos /></ProtectedRoute>} />
            <Route path="/mesas"            element={<ProtectedRoute moduleKey="mesas"><Mesas /></ProtectedRoute>} />
            <Route path="/partidos"         element={<ProtectedRoute moduleKey="partidos"><Partidos /></ProtectedRoute>} />
            <Route path="/cargos"           element={<ProtectedRoute moduleKey="cargos"><Cargos /></ProtectedRoute>} />
            <Route path="/listas"           element={<ProtectedRoute moduleKey="listas"><Listas /></ProtectedRoute>} />
            <Route path="/candidatos"       element={<ProtectedRoute moduleKey="candidatos"><Candidatos /></ProtectedRoute>} />
            <Route path="/fiscales"         element={<ProtectedRoute moduleKey="fiscales"><Fiscales /></ProtectedRoute>} />
            <Route path="/usuarios"         element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
            <Route path="/municipios"       element={<ProtectedRoute adminOnly><Municipios /></ProtectedRoute>} />
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
      <MunicipioProvider>
        <Routes>
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/*"     element={<AppLayout />} />
        </Routes>
      </MunicipioProvider>
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
