import { useCallback, useEffect, useState } from 'react';
import { fetchAutopilot } from '../services/ops.service.js';

export function useAutopilot(intervalMs = 15000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setError('');
      setData(await fetchAutopilot());
    } catch (e) {
      setError(e?.message || 'Falha em /ai/autopilot');
    }
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, intervalMs);
    return () => clearInterval(id);
  }, [reload, intervalMs]);

  return { data, error, reload };
}
