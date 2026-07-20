import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FuelingPhotoCapture from '../components/FuelingPhotoCapture';

// Pantalla standalone para el acceso restringido con PIN: sin sidebar ni
// menú, solo esta pantalla. Usa su propio token/cliente HTTP, separado de
// la sesión de administración normal.
export default function MobileCarga() {
  const navigate = useNavigate();
  const token = localStorage.getItem('fuel_mobile_token');
  const user  = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('fuel_mobile_user') || 'null'); } catch { return null; }
  }, []);

  const salir = () => {
    localStorage.removeItem('fuel_mobile_token');
    localStorage.removeItem('fuel_mobile_user');
    navigate('/movil');
  };

  useEffect(() => {
    if (!token) navigate('/movil');
  }, [token, navigate]);

  const api = useMemo(() => {
    const instance = axios.create({ headers: { Authorization: `Bearer ${token}` } });
    instance.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401) salir();
        return Promise.reject(err);
      }
    );
    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="topbar" style={{ position: 'sticky', top: 0 }}>
        <span style={{ fontSize: '1.2rem', marginRight: 8 }}>⛽📷</span>
        <h1 className="topbar-title">{user?.username ? `Carga con Foto — ${user.username}` : 'Carga con Foto'}</h1>
        <button className="btn btn-ghost btn-sm" onClick={salir}>Salir</button>
      </header>
      <main style={{ padding: 14 }}>
        <FuelingPhotoCapture api={api} />
      </main>
    </div>
  );
}
