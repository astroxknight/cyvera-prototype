# CYVERA — Cybersecurity Log Analysis Dashboard

A SOC-style frontend for ingesting, analyzing and visualizing security logs,
raised alerts, and detection signatures. Built for the B.Tech minor project.

## Stack

- **React 19** (functional components + hooks)
- **Vite** (dev server / bundler)
- **react-router-dom** (routing)
- **recharts** (charts)
- **lucide-react** (icons)

## Architecture

```
src/
  data/          Sample seed data (would be replaced by backend responses)
  services/
    api.js       Single data access layer — every component calls this file.
                 Swap function bodies for fetch() to plug in a real REST API.
  pages/         One component per route
  components/
    layout/      Sidebar, Topbar
    common/      Reusable: SeverityBadge, StatusBadge, Modal, Toast, Card, …
    dashboard/   StatCard, charts
    logs/        FileUpload (with simulated analysis progress)
  utils/         Pure formatters (date, bytes, numbers)
  styles/        Global component stylesheet
```

### Frontend / backend / ML separation

The React app is **strictly presentation + state**. All data access is
funneled through `src/services/api.js`, which today resolves to the in-memory
seed data and tomorrow should call a REST API. **No ML logic, no detection
algorithms, and no database access live in the React code.**

## Pages

| Route                | Purpose                                                       |
|----------------------|---------------------------------------------------------------|
| `/`                  | Dashboard — KPIs, trend chart, severity distribution, alerts  |
| `/logs`              | Log Analysis — file upload, progress, filterable log table    |
| `/alerts`            | Alerts list with severity / status / method filters           |
| `/alerts/:id`        | Alert detail with matched signature or anomaly explanation    |
| `/signatures`        | CRUD for detection signatures                                 |
| `/reports`           | Generated and scheduled reports                               |
| `/settings`          | Platform configuration (persisted in localStorage)            |

## Running

```bash
cd cyvera
npm install
npm run dev
```

The app starts on `http://localhost:5173`.

## Wiring a real backend

To connect a REST backend, replace the function bodies in
`src/services/api.js` with `fetch()` calls. The exported function names,
parameters, and return shapes are designed to be stable — no component code
needs to change.

```js
// example
export async function fetchAlerts(filters) {
  const res = await fetch('/api/alerts?' + new URLSearchParams(filters));
  if (!res.ok) throw new Error('Failed to load alerts');
  return res.json();
}
```
