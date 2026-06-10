// Oculta las alertas automáticamente después de 4 segundos
document.querySelectorAll(".alert").forEach((el) => {
  setTimeout(() => {
    el.style.transition = "opacity .4s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
  }, 4000);
});
