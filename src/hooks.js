import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// Memuat data saat layar dibuka, lalu polling selama layar sedang aktif.
export function useLiveData(loader, intervalMs = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await loader());
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [loader]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!intervalMs) return undefined;
      const timer = setInterval(load, intervalMs);
      return () => clearInterval(timer);
    }, [load, intervalMs]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, error, setError, load, refresh, refreshing };
}

export function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
