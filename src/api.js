import { Platform } from 'react-native';

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(`Tidak dapat terhubung ke server (${API_URL}). Pastikan API berjalan dan alamat server benar.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Permintaan tidak dapat diproses.');
  }
  return payload;
}

export const api = {
  login: (email, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getSummary: () => request('/queue-summary'),
  getQueues: () => request('/queues'),
  getEvents: () => request('/events'),
  takeQueue: (userId, eventId) =>
    request('/take-queue', { method: 'POST', body: JSON.stringify({ userId, eventId }) }),
  updateQueue: (queueId, status) =>
    request(`/queues/${encodeURIComponent(queueId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
