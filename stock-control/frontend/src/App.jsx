import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard  from './pages/Dashboard';
import Products   from './pages/Products';
import Movements  from './pages/Movements';
import Suppliers  from './pages/Suppliers';
import Categories from './pages/Categories';

const navItems = [
  { to: '/',           icon: '📊', label: 'Dashboard' },
  { to: '/products',   icon: '📦', label: 'Productos' },
  { to: '/movements',  icon: '↕️',  label: 'Movimientos' },
  { to: '/suppliers',  icon: '🏭', label: 'Proveedores' },
  { to: '/categories', icon: '🏷️', label: 'Categorías' },
];

const pageTitles = {
  '/':           'Dashboard',
  '/products':   'Productos',
  '/movements':  'Historial de movimientos',
  '/suppliers':  'Proveedores',
  '/categories': 'Categorías',
};

export default function App() {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] ?? 'Control de Stock';

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
        <div className="sidebar-footer">v1.0 · Control de Stock</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/products"   element={<Products />} />
            <Route path="/movements"  element={<Movements />} />
            <Route path="/suppliers"  element={<Suppliers />} />
            <Route path="/categories" element={<Categories />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
