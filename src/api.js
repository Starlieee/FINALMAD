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
  getMyQueues: (userId) => request(`/my-queues?userId=${encodeURIComponent(userId)}`),
  cancelQueue: (userId, queueId) =>
    request(`/queues/${encodeURIComponent(queueId)}/cancel`, { method: 'POST', body: JSON.stringify({ userId }) }),
  getStats: (adminId) => request(`/admin/stats?adminId=${encodeURIComponent(adminId)}`),
  createEvent: (adminId, data) =>
    request('/admin/events', { method: 'POST', body: JSON.stringify({ ...data, adminId }) }),
  updateEvent: (adminId, eventId, data) =>
    request(`/admin/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify({ ...data, adminId }) }),
  getStaff: (adminId) => request(`/admin/staff?adminId=${encodeURIComponent(adminId)}`),
  createStaff: (adminId, data) =>
    request('/admin/staff', { method: 'POST', body: JSON.stringify({ ...data, adminId }) }),
  assignStaff: (adminId, staffId, assignedCounter) =>
    request(`/admin/staff/${encodeURIComponent(staffId)}`, { method: 'PATCH', body: JSON.stringify({ adminId, assignedCounter }) }),
  getStaffPanel: (staffId, counterName) =>
    request(`/staff/panel?staffId=${encodeURIComponent(staffId)}${counterName ? `&counterName=${encodeURIComponent(counterName)}` : ''}`),
  callNext: (staffId, counterName) =>
    request('/staff/call-next', { method: 'POST', body: JSON.stringify({ staffId, counterName }) }),
  startStaffQueue: (staffId, queueId, counterName) =>
    request(`/staff/queues/${encodeURIComponent(queueId)}/start`, { method: 'POST', body: JSON.stringify({ staffId, counterName }) }),
  completeStaffQueue: (staffId, queueId, counterName) =>
    request(`/staff/queues/${encodeURIComponent(queueId)}/complete`, { method: 'POST', body: JSON.stringify({ staffId, counterName }) }),
  recallStaffQueue: (staffId, queueId, counterName) =>
    request(`/staff/queues/${encodeURIComponent(queueId)}/recall`, { method: 'POST', body: JSON.stringify({ staffId, counterName }) }),
  skipStaffQueue: (staffId, queueId, counterName) =>
    request(`/staff/queues/${encodeURIComponent(queueId)}/skip`, { method: 'POST', body: JSON.stringify({ staffId, counterName }) }),
  callSkippedQueue: (staffId, queueId, counterName) =>
    request(`/staff/queues/${encodeURIComponent(queueId)}/call-skipped`, { method: 'POST', body: JSON.stringify({ staffId, counterName }) }),
};
