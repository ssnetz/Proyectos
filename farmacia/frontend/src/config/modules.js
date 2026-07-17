// Módulos del sistema disponibles para restringir por usuario.
// 'dashboard' no se incluye: siempre es visible. 'ubicaciones' y 'usuarios'
// tampoco: ya eran exclusivos de admin antes de este esquema de permisos
// (no de operador), así que se mantienen con ese control aparte para no
// otorgarle acceso a operadores existentes por default.
export const MODULES = [
  { key: 'medicamentos', icon: '💊', label: 'Medicamentos' },
  { key: 'lotes',        icon: '📦', label: 'Lotes y Vencimientos' },
  { key: 'movimientos',  icon: '↕️', label: 'Movimientos' },
  { key: 'personas',     icon: '👥', label: 'Personas' },
  { key: 'dispensas',    icon: '🩺', label: 'Dispensas' },
  { key: 'reportes',     icon: '📈', label: 'Reportes' },
  { key: 'facturas',     icon: '🧾', label: 'Facturas de Compra' },
  { key: 'proveedores',  icon: '🏭', label: 'Proveedores' },
  { key: 'categorias',   icon: '🏷️', label: 'Categorías' },
];

// true si el usuario puede acceder al módulo: admins siempre, operadores
// según su lista de permisos (permissions === null/undefined = acceso total).
export function canAccess(user, moduleKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions == null) return true;
  return user.permissions.includes(moduleKey);
}
