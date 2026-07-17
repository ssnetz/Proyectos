// Isologo institucional: cuadrado azul redondeado con una cruz blanca
// (usado en el sidebar y en el login). Redibujado con primitivas SVG, sin
// depender de ningún archivo de imagen.
export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="64" height="64" rx="12" fill="#1d4ed8" />
      <rect x="26" y="8" width="12" height="48" rx="4" fill="#fff" />
      <rect x="8" y="26" width="48" height="12" rx="4" fill="#fff" />
    </svg>
  );
}
