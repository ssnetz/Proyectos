// Fecha ISO (YYYY-MM-DD) a DD/MM/YYYY sin pasar por Date() — evita que un
// desfasaje de timezone corra el día mostrado.
export function formatFechaISO(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Fecha (o timestamp completo) formateada como día corto vía Date()/Intl.
// Nota: aunque reciba un datetime completo (ej. el "fecha" de una dispensa),
// solo muestra la parte de fecha — así se comporta hoy en producción.
export function formatFechaHora(value) {
  return value ? new Date(value).toLocaleDateString('es-AR') : '—';
}
