import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MODULES, canAccess } from './config/modules';
import Dashboard  from './pages/Dashboard';
import Fueling    from './pages/Fueling';
import FuelingPhoto from './pages/FuelingPhoto';
import MobilePinLogin from './pages/MobilePinLogin';
import MobileCarga    from './pages/MobileCarga';
import Vehicles   from './pages/Vehicles';
import FuelPrices from './pages/FuelPrices';
import Users      from './pages/Users';
import FuelTypes      from './pages/FuelTypes';
import Lubricants     from './pages/Lubricants';
import LubricantTypes from './pages/LubricantTypes';
import FuelOrders     from './pages/FuelOrders';
import TankLevels     from './pages/TankLevels';
import Zones        from './pages/Zones';
import Drivers      from './pages/Drivers';
import CostConfig   from './pages/CostConfig';
import RoutesPage      from './pages/Routes';
import CostDashboard  from './pages/CostDashboard';
import GpsImport     from './pages/GpsImport';
import Suppliers    from './pages/Suppliers';
import OrdenesPago  from './pages/OrdenesPago';
import Reports      from './pages/Reports';
import Areas        from './pages/Areas';
import Login     from './pages/Login';

function ProtectedRoute({ children, adminOnly = false, moduleKey = null }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (moduleKey && !canAccess(user, moduleKey)) return <Navigate to="/" replace />;
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
  '/fueling-photo': 'Carga con Foto',
  '/vehicles':    'Vehículos y Maquinaria',
  '/fuel-prices': 'Precios de Combustible',
  '/users':       'Usuarios',
  '/lubricants':       'Lubricantes',
  '/fuel-types':       'Tipos de Combustible',
  '/lubricant-types':  'Tipos de Lubricante',
  '/fuel-orders':      'Órdenes de Carga',
  '/tank-levels':      'Tablero de Niveles',
  '/zones':            'Zonas de Recolección',
  '/drivers':          'Choferes',
  '/cost-config':      'Configuración de Costos',
  '/routes':           'Rutas de Recolección',
  '/cost-dashboard':   'Tablero de Costos',
  '/gps-import':       'Importar GPS (AmericaGIS)',
  '/suppliers':        'Proveedores',
  '/ordenes-pago':     'Órdenes de Pago',
  '/reports':          'Reportes',
  '/areas':            'Áreas Municipales',
};

function AppLayout() {
  const { pathname } = useLocation();
  const { user }     = useAuth();
  const title   = pageTitles[pathname] ?? 'Control de Combustible';
  const isAdmin = user?.role === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    ...MODULES
      .filter(m => canAccess(user, m.key))
      .map(m => ({ to: `/${m.key}`, icon: m.icon, label: m.label })),
    ...(isAdmin ? [{ to: '/users', icon: '👤', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
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
        <div className="sidebar-footer">
          v1.0 · Control de Combustible<br />
          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>© {new Date().getFullYear()} SSNetz</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Menú">
            ☰
          </button>
          <img
            src="/fuel-control/logo.png"
            alt="Municipalidad de Cosquín"
            style={{ height: 44, width: 'auto', marginRight: 12, flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/fueling"  element={<ProtectedRoute moduleKey="fueling"><Fueling /></ProtectedRoute>} />
            <Route path="/fueling-photo" element={<ProtectedRoute moduleKey="fueling-photo"><FuelingPhoto /></ProtectedRoute>} />
            <Route path="/vehicles"    element={<ProtectedRoute moduleKey="vehicles"><Vehicles /></ProtectedRoute>} />
            <Route path="/fuel-prices" element={<ProtectedRoute moduleKey="fuel-prices"><FuelPrices /></ProtectedRoute>} />
            <Route path="/users"       element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
            <Route path="/lubricants"      element={<ProtectedRoute moduleKey="lubricants"><Lubricants /></ProtectedRoute>} />
            <Route path="/lubricant-types" element={<ProtectedRoute moduleKey="lubricant-types"><LubricantTypes /></ProtectedRoute>} />
            <Route path="/fuel-types"      element={<ProtectedRoute moduleKey="fuel-types"><FuelTypes /></ProtectedRoute>} />
            <Route path="/fuel-orders"     element={<ProtectedRoute moduleKey="fuel-orders"><FuelOrders /></ProtectedRoute>} />
            <Route path="/tank-levels"     element={<ProtectedRoute moduleKey="tank-levels"><TankLevels /></ProtectedRoute>} />
            <Route path="/zones"           element={<ProtectedRoute moduleKey="zones"><Zones /></ProtectedRoute>} />
            <Route path="/drivers"         element={<ProtectedRoute moduleKey="drivers"><Drivers /></ProtectedRoute>} />
            <Route path="/cost-config"     element={<ProtectedRoute moduleKey="cost-config"><CostConfig /></ProtectedRoute>} />
            <Route path="/routes"          element={<ProtectedRoute moduleKey="routes"><RoutesPage /></ProtectedRoute>} />
            <Route path="/cost-dashboard"  element={<ProtectedRoute moduleKey="cost-dashboard"><CostDashboard /></ProtectedRoute>} />
            <Route path="/gps-import"      element={<ProtectedRoute moduleKey="gps-import"><GpsImport /></ProtectedRoute>} />
            <Route path="/suppliers"       element={<ProtectedRoute moduleKey="suppliers"><Suppliers /></ProtectedRoute>} />
            <Route path="/ordenes-pago"    element={<ProtectedRoute moduleKey="ordenes-pago"><OrdenesPago /></ProtectedRoute>} />
            <Route path="/reports"         element={<ProtectedRoute moduleKey="reports"><Reports /></ProtectedRoute>} />
            <Route path="/areas"           element={<ProtectedRoute moduleKey="areas"><Areas /></ProtectedRoute>} />
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
        <Route path="/login"       element={<LoginGuard />} />
        <Route path="/movil"       element={<MobilePinLogin />} />
        <Route path="/movil/carga" element={<MobileCarga />} />
        <Route path="/*"           element={<AppLayout />} />
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
