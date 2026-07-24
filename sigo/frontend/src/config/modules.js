// Módulos del sistema disponibles para restringir por usuario.
// 'dashboard' y 'users' no se incluyen acá: el Dashboard siempre es visible,
// y Usuarios ya está controlado por el rol admin.
export const MODULES = [
  { key: 'obras', icon: '🏗️', label: 'Obras' },
];

// true si el usuario puede acceder al módulo: admins siempre, operadores
// según su lista de permisos (permissions === null/undefined = acceso total).
export function canAccess(user, moduleKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions == null) return true;
  return user.permissions.includes(moduleKey);
}
