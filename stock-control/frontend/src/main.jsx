import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, fontFamily: 'sans-serif', background: '#f9fafb',
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ color: '#1f2937', margin: 0 }}>Algo salió mal</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {this.state.error?.message || 'Error inesperado de la aplicación'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename="/stock-control">
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
