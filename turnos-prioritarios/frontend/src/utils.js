// Normaliza un celular argentino al formato que espera wa.me: 54 9 <área><número>.
// Asume que el celular se cargó sin el 0 troncal ni el "15" (ej. "261 500-0001",
// no "0261 15-500-0001") — no se puede detectar de forma confiable dónde termina
// el código de área para sacar el "15" solo, así que se pide esa convención al
// cargar el dato en vez de adivinar y arriesgar mandar el mensaje a otro número.
export function normalizarCelularAR(celular) {
  let digitos = (celular || '').replace(/\D/g, '');
  if (!digitos) return '';
  digitos = digitos.replace(/^0/, '');
  digitos = digitos.replace(/^54/, '');
  digitos = digitos.replace(/^9/, '');
  return `549${digitos}`;
}

export function buildWhatsAppLink(celular, mensaje) {
  const numero = normalizarCelularAR(celular);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  if (Number.isNaN(nacimiento.getTime())) return null;
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const sinCumplirAun = hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (sinCumplirAun) edad--;
  return edad;
}
