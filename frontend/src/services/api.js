// Centralized data access layer.
//
// Every component reads data through these functions. To switch to a real
// backend, replace the body of each function with a fetch() call. The
// signatures, return shapes, and async semantics will not change — React
// components won't need to be touched.
//
// ML / database / detection logic must live on the server side, not here.

import {
  sampleLogs,
  sampleAlerts,
  sampleSignatures,
  sampleTrend,
  sampleSeverityDistribution,
  sampleActivity,
} from '../data/sampleData';

// In-memory store so the demo supports create / update / delete operations
// against signatures without a backend.
let signaturesStore = [...sampleSignatures];
let alertsStore = [...sampleAlerts];

// Simulated network latency so loading states are visible during the demo.
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const clone = (obj) => JSON.parse(JSON.stringify(obj));

// -------- Dashboard summary --------

export async function fetchDashboardSummary() {
  await delay();
  const logs = sampleLogs;
  const total = 214789;
  const threats = sampleAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'high'
  ).length;
  const anomalies = sampleAlerts.filter((a) => a.detectionMethod === 'anomaly')
    .length;
  const normal = sampleLogs.filter((l) => l.severity === 'info' || l.severity === 'low')
    .length;

  return {
    totalLogs: total,
    threatsDetected: threats * 137 + 2841, // scaled for realistic volume
    anomalies: anomalies * 89 + 612,
    normalLogs: total - (threats * 137 + 2841) - (anomalies * 89 + 612),
    deltaTotal: 4.2,
    deltaThreats: 12.7,
    deltaAnomalies: -3.4,
    deltaNormal: 4.9,
  };
}

export async function fetchTrend() {
  await delay(200);
  return clone(sampleTrend);
}

export async function fetchSeverityDistribution() {
  await delay(200);
  return clone(sampleSeverityDistribution);
}

export async function fetchHourlyActivity() {
  await delay(200);
  return clone(sampleActivity);
}

// -------- Logs --------

export async function fetchLogs(filters = {}) {
  await delay();
  let result = clone(sampleLogs);

  if (filters.severity && filters.severity !== 'all') {
    result = result.filter((l) => l.severity === filters.severity);
  }
  if (filters.type && filters.type !== 'all') {
    result = result.filter((l) => l.type === filters.type);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q) ||
        l.sourceIp.toLowerCase().includes(q) ||
        l.destinationIp.toLowerCase().includes(q) ||
        l.endpoint.toLowerCase().includes(q)
    );
  }

  return {
    items: result,
    total: result.length,
  };
}

export async function fetchLogTypes() {
  await delay(100);
  const set = new Set(sampleLogs.map((l) => l.type));
  return Array.from(set).sort();
}

// Simulated file upload — in a real backend this would POST to /api/logs/upload
// and the server would return a job id that the client polls.
export async function uploadLogFile(file) {
  await delay(800);
  if (!file) {
    throw new Error('No file provided');
  }
  const allowed = ['.log', '.txt', '.csv', '.json'];
  const name = file.name.toLowerCase();
  if (!allowed.some((ext) => name.endsWith(ext))) {
    throw new Error('Unsupported file type. Use .log, .txt, .csv, or .json');
  }
  return {
    jobId: 'JOB-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    filename: file.name,
    size: file.size,
    acceptedAt: new Date().toISOString(),
  };
}

// Simulated analysis job status — replace with polling of a real job id.
export async function fetchAnalysisStatus(jobId) {
  await delay(150);
  // Return a fixed sequence so the UI walks through a realistic lifecycle.
  const sequence = ['queued', 'parsing', 'analyzing', 'enriching', 'done'];
  const idx = Math.min(
    sequence.length - 1,
    Math.floor((Date.now() / 1000) % sequence.length)
  );
  return {
    jobId,
    stage: sequence[idx],
    progress: Math.round(((idx + 1) / sequence.length) * 100),
    processed: 1000 * (idx + 1),
    threats: 0,
  };
}

// -------- Alerts --------

export async function fetchAlerts(filters = {}) {
  await delay();
  let result = clone(alertsStore);

  if (filters.severity && filters.severity !== 'all') {
    result = result.filter((a) => a.severity === filters.severity);
  }
  if (filters.status && filters.status !== 'all') {
    result = result.filter((a) => a.status === filters.status);
  }
  if (filters.method && filters.method !== 'all') {
    result = result.filter((a) => a.detectionMethod === filters.method);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.sourceIp.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }

  // newest first
  result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { items: result, total: result.length };
}

export async function fetchAlertById(id) {
  await delay(150);
  const alert = alertsStore.find((a) => a.id === id);
  if (!alert) throw new Error('Alert not found');
  let signature = null;
  if (alert.signatureId) {
    signature = signaturesStore.find((s) => s.id === alert.signatureId) || null;
  }
  const logs = sampleLogs.filter((l) => alert.relatedLogIds.includes(l.id));
  return { alert: clone(alert), signature: signature ? clone(signature) : null, logs: clone(logs) };
}

export async function updateAlertStatus(id, status) {
  await delay(150);
  alertsStore = alertsStore.map((a) =>
    a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a
  );
  return clone(alertsStore.find((a) => a.id === id));
}

// -------- Signatures --------

export async function fetchSignatures(filters = {}) {
  await delay();
  let result = clone(signaturesStore);
  if (filters.severity && filters.severity !== 'all') {
    result = result.filter((s) => s.severity === filters.severity);
  }
  if (filters.category && filters.category !== 'all') {
    result = result.filter((s) => s.category === filters.category);
  }
  if (filters.enabled && filters.enabled !== 'all') {
    const flag = filters.enabled === 'true';
    result = result.filter((s) => s.enabled === flag);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.pattern.toLowerCase().includes(q)
    );
  }
  return { items: result, total: result.length };
}

export async function fetchSignatureCategories() {
  await delay(100);
  const set = new Set(signaturesStore.map((s) => s.category));
  return Array.from(set).sort();
}

export async function createSignature(payload) {
  await delay(200);
  const newSig = {
    id: 'SIG-' + String(signaturesStore.length + 1).padStart(3, '0'),
    name: payload.name,
    description: payload.description,
    pattern: payload.pattern,
    severity: payload.severity,
    category: payload.category,
    enabled: payload.enabled ?? true,
    author: payload.author || 'soc.team',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matches: 0,
  };
  signaturesStore = [newSig, ...signaturesStore];
  return clone(newSig);
}

export async function updateSignature(id, payload) {
  await delay(200);
  let updated = null;
  signaturesStore = signaturesStore.map((s) => {
    if (s.id === id) {
      updated = {
        ...s,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    }
    return s;
  });
  if (!updated) throw new Error('Signature not found');
  return clone(updated);
}

export async function deleteSignature(id) {
  await delay(150);
  const before = signaturesStore.length;
  signaturesStore = signaturesStore.filter((s) => s.id !== id);
  if (signaturesStore.length === before) {
    throw new Error('Signature not found');
  }
  return { ok: true };
}

export async function toggleSignature(id) {
  await delay(120);
  let updated = null;
  signaturesStore = signaturesStore.map((s) => {
    if (s.id === id) {
      updated = { ...s, enabled: !s.enabled, updatedAt: new Date().toISOString() };
      return updated;
    }
    return s;
  });
  if (!updated) throw new Error('Signature not found');
  return clone(updated);
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
