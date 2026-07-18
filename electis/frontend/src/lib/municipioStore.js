// Guarda el municipio actualmente seleccionado fuera de React, para que el
// interceptor de axios (en hooks/useApi.js, un módulo plano) pueda leerlo
// en cada request sin depender del árbol de componentes.
let currentMunicipioId = null;

export function setApiMunicipioId(id) {
  currentMunicipioId = id || null;
}

export function getApiMunicipioId() {
  return currentMunicipioId;
}
