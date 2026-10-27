// Centralized data access layer.
//
// Every component reads data through these functions. To switch to a real
// backend, replace the body of each function with a fetch() call. The
// signatures, return shapes, and async semantics will not change — React
// components won't need to be touched.
//
// ML / database / detection logic must live on the server side, not here.

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api`;

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error('Cyvera API is unavailable. Start the backend and try again.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.detail || `Request failed (${response.status})`);
  }
  return result;
}

// Fired after any call that changes alerts/logs so shared UI (sidebar badge,
// top-bar dot) can refresh without a page reload.
export const DATA_CHANGED_EVENT = 'cyvera:data-changed';
const notifyDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED_EVENT));

function queryString(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

// -------- Dashboard summary --------

export async function fetchDashboardSummary() {
  return request('/dashboard/summary');
}

export async function fetchTrend() {
  return request('/dashboard/trend');
}

export async function fetchSeverityDistribution() {
  return request('/dashboard/severity-distribution');
}

export async function fetchHourlyActivity() {
  return request('/dashboard/hourly-activity');
}

// -------- Logs --------

export async function fetchLogs(filters = {}) {
  return request(`/logs${queryString(filters)}`);
}

export async function fetchLogTypes() {
  return request('/logs/types');
}

export async function uploadLogFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }
  const form = new FormData();
  form.append('file', file);
  const job = await request('/logs/upload', { method: 'POST', body: form });
  notifyDataChanged();
  return job;
}

export async function fetchAnalysisStatus(jobId) {
  return request(`/logs/analysis/${encodeURIComponent(jobId)}`);
}

// -------- Alerts --------

export async function fetchAlerts(filters = {}) {
  return request(`/alerts${queryString(filters)}`);
}

export async function fetchAlertById(id) {
  return request(`/alerts/${encodeURIComponent(id)}`);
}

export async function updateAlertStatus(id, status) {
  const alert = await request(`/alerts/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  notifyDataChanged();
  return alert;
}

// -------- Signatures --------

export async function fetchSignatures(filters = {}) {
  return request(`/signatures${queryString(filters)}`);
}

export async function fetchSignatureCategories() {
  return request('/signatures/categories');
}

export async function createSignature(payload) {
  return request('/signatures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateSignature(id, payload) {
  return request(`/signatures/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSignature(id) {
  return request(`/signatures/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function toggleSignature(id) {
  return request(`/signatures/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
}

// -------- Settings (local-only) --------

const SETTINGS_KEY = 'cyvera:settings';

const defaultSettings = {
  organization: 'CYVERA SOC',
  analyst: 'soc.analyst',
  retentionDays: 30,
  defaultSeverity: 'medium',
  emailNotifications: true,
  slackNotifications: false,
  autoBlockCritical: true,
  refreshIntervalSec: 30,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
