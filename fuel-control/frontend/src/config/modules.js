// Módulos del sistema disponibles para restringir por usuario.
// 'dashboard' y 'users' no se incluyen acá: el Dashboard siempre es visible,
// y Usuarios ya está controlado por el rol admin.
export const MODULES = [
  { key: 'fueling',         icon: '⛽',  label: 'Cargas' },
  { key: 'fueling-photo',   icon: '📷',  label: 'Carga con Foto' },
  { key: 'vehicles',        icon: '🚛',  label: 'Vehículos' },
  { key: 'fuel-prices',     icon: '💲',  label: 'Precios' },
  { key: 'suppliers',       icon: '🏪',  label: 'Proveedores' },
  { key: 'areas',           icon: '🏛️', label: 'Áreas' },
  { key: 'fuel-orders',     icon: '📋',  label: 'Órdenes de Carga' },
  { key: 'ordenes-pago',    icon: '💳',  label: 'Órdenes de Pago' },
  { key: 'cost-dashboard',  icon: '📈',  label: 'Tablero Costos' },
  { key: 'reports',         icon: '📄',  label: 'Reportes' },
  { key: 'gps-import',      icon: '📡',  label: 'Importar GPS' },
  { key: 'routes',          icon: '🗺️', label: 'Rutas' },
  { key: 'lubricants',      icon: '🛢️', label: 'Lubricantes' },
  { key: 'lubricant-types', icon: '🔧',  label: 'Tipos Lubricante' },
  { key: 'fuel-types',      icon: '⚙️',  label: 'Tipos Combustible' },
  { key: 'zones',           icon: '📍',  label: 'Zonas' },
  { key: 'drivers',         icon: '🆔',  label: 'Choferes' },
  { key: 'cost-config',     icon: '💰',  label: 'Config. Costos' },
];

// true si el usuario puede acceder al módulo: admins siempre, operadores
// según su lista de permisos (permissions === null/undefined = acceso total).
export function canAccess(user, moduleKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions == null) return true;
  return user.permissions.includes(moduleKey);
}
