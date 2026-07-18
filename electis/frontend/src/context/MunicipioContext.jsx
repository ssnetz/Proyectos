import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useMunicipios } from '../hooks/useApi';
import { setApiMunicipioId } from '../lib/municipioStore';

const MunicipioContext = createContext(null);

const STORAGE_KEY = 'el_municipio_id';

// Municipio/Comuna que se está viendo en este momento.
// - operador: fijo al que tiene asignado su usuario, no elige.
// - admin: puede ver y cambiar entre cualquiera; se recuerda en localStorage.
export function MunicipioProvider({ children }) {
  const { user } = useAuth();
  const { list } = useMunicipios();

  const [municipios, setMunicipios] = useState([]);
  const [selectedId, setSelectedIdState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSelectedId = useCallback((id) => {
    setSelectedIdState(id);
    setApiMunicipioId(id);
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  useEffect(() => {
    if (!user) {
      setMunicipios([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    if (user.role !== 'admin') {
      // Operador: no necesita la lista completa, solo el suyo.
      setSelectedId(user.municipio_id ?? null);
      setMunicipios(
        user.municipio_id ? [{ id: user.municipio_id, nombre: user.municipio_nombre }] : []
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    list()
      .then((r) => {
        const activos = r.data.filter((m) => m.activo);
        setMunicipios(activos);
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedValido = saved && activos.some((m) => String(m.id) === saved);
        setSelectedId(savedValido ? Number(saved) : (activos[0]?.id ?? null));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <MunicipioContext.Provider value={{ municipios, selectedId, setSelectedId, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </MunicipioContext.Provider>
  );
}

export function useMunicipio() {
  const ctx = useContext(MunicipioContext);
  if (!ctx) throw new Error('useMunicipio must be used inside MunicipioProvider');
  return ctx;
}
