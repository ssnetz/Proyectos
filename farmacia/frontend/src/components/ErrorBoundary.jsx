import { Component } from 'react';

// Muestra un panel de error legible en vez de una pantalla en blanco cuando
// algo revienta en producción (mismo comportamiento que el bundle actual).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || '';
      return (
        <div style={{ fontFamily: 'monospace', padding: 32, background: '#1e1e1e', color: '#f8f8f2', minHeight: '100vh', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#ff5555', marginTop: 0 }}>Error en la aplicación</h2>
          <p style={{ color: '#8be9fd', marginBottom: 8 }}>Mensaje:</p>
          <pre style={{ background: '#282a36', padding: 12, borderRadius: 4, color: '#f1fa8c', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{message}</pre>
          <p style={{ color: '#8be9fd', marginBottom: 8, marginTop: 16 }}>Stack:</p>
          <pre style={{ background: '#282a36', padding: 12, borderRadius: 4, color: '#ffb86c', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{stack}</pre>
          <p style={{ color: '#6272a4', marginTop: 20, fontSize: 13 }}>Copiá este mensaje y enviáselo al desarrollador.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
