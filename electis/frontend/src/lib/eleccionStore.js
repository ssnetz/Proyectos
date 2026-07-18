// Guarda la elección actualmente seleccionada fuera de React, para que el
// interceptor de axios (en hooks/useApi.js, un módulo plano) pueda leerla
// en cada request sin depender del árbol de componentes.
let currentEleccionId = null;

export function setApiEleccionId(id) {
  currentEleccionId = id || null;
}

export function getApiEleccionId() {
  return currentEleccionId;
}
