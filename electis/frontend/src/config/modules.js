// Módulos del sistema disponibles para restringir por usuario, agrupados
// por sección (igual que el menú lateral). 'dashboard' y 'usuarios' no se
// incluyen: el Dashboard siempre es visible, y Usuarios ya está controlado
// por el rol admin.
export const MODULES = [
  { key: 'actas',             icon: '🗳️', label: 'Actas',             section: 'Escrutinio' },
  { key: 'electores',         icon: '👥', label: 'Electores',         section: 'Escrutinio' },
  { key: 'establecimientos',  icon: '🏫', label: 'Establecimientos',  section: 'Catálogos' },
  { key: 'mesas',              icon: '🪑', label: 'Mesas',              section: 'Catálogos' },
  { key: 'partidos',           icon: '🚩', label: 'Partidos',           section: 'Catálogos' },
  { key: 'cargos',             icon: '🏛️', label: 'Cargos',             section: 'Catálogos' },
  { key: 'listas',             icon: '📋', label: 'Listas',             section: 'Catálogos' },
  { key: 'candidatos',         icon: '🎖️', label: 'Candidatos',         section: 'Catálogos' },
  { key: 'fiscales',           icon: '🕵️', label: 'Fiscales',           section: 'Catálogos' },
];

// true si el usuario puede acceder al módulo: admins siempre, operadores
// según su lista de permisos (permissions === null/undefined = acceso total).
export function canAccess(user, moduleKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions == null) return true;
  return user.permissions.includes(moduleKey);
}
