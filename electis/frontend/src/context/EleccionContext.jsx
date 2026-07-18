import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useMunicipio } from './MunicipioContext';
import { useElecciones } from '../hooks/useApi';
import { setApiEleccionId } from '../lib/eleccionStore';

const EleccionContext = createContext(null);

const STORAGE_KEY = 'el_eleccion_id';

// Elección que se está viendo dentro del municipio actual (2023, 2027...).
// Cargos, listas, candidatos, mesas, electores, actas y fiscales son
// exclusivos de cada elección; al cambiar de municipio se vuelve a cargar
// la lista de elecciones de ese municipio.
export function EleccionProvider({ children }) {
  const { user } = useAuth();
  const { selectedId: municipioId, loading: municipioLoading } = useMunicipio();
  const { list } = useElecciones();

  const [elecciones, setElecciones] = useState([]);
  const [selectedId, setSelectedIdState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSelectedId = useCallback((id) => {
    setSelectedIdState(id);
    setApiEleccionId(id);
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  useEffect(() => {
    if (!user || municipioLoading || !municipioId) {
      setElecciones([]);
      setSelectedId(null);
      setLoading(municipioLoading);
      return;
    }

    setLoading(true);
    list()
      .then((r) => {
        const activas = r.data.filter((e) => e.activo);
        setElecciones(activas);
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedValida = saved && activas.some((e) => String(e.id) === saved);
        setSelectedId(savedValida ? Number(saved) : (activas[0]?.id ?? null));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, municipioId, municipioLoading]);

  return (
    <EleccionContext.Provider value={{ elecciones, selectedId, setSelectedId, loading }}>
      {children}
    </EleccionContext.Provider>
  );
}

export function useEleccion() {
  const ctx = useContext(EleccionContext);
  if (!ctx) throw new Error('useEleccion must be used inside EleccionProvider');
  return ctx;
}
