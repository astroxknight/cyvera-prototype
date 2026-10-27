# CYVERA — Security Log Analysis & Anomaly Detection

CYVERA is a cybersecurity web application that analyzes uploaded security logs, detects suspicious activity using rule-based signatures and machine learning, and displays alerts through an interactive dashboard.

## Features

- Upload and parse security logs.
- Detect suspicious activity using signatures and Isolation Forest.
- View alerts, severity levels, and dashboard statistics.
- Manage detection signatures and application settings.
- Visualize log trends and security events.
- Store logs and alerts in a database.

## Tech Stack

| Component        | Technology                     |
| ---------------- | ------------------------------ |
| Frontend         | React, Vite, Recharts          |
| Backend          | Python, FastAPI                |
| Machine Learning | Scikit-learn, Isolation Forest |
| Database         | SQLite                         |
| Testing          | Pytest, HTTPX                  |
| Version Control  | Git, GitHub                    |

## System Architecture

```text
User
 ↓
React + Vite Frontend
 ↓ REST API
FastAPI Backend
 ↓
Log Parsing → Signature Detection
            → ML Anomaly Detection
 ↓
Alerts, Statistics & Analysis
 ↓
SQLite Database
```

## Project Structure

```text
cyvera-prototype/
├── backend/
│   ├── app/
│   │   ├── main.py          # API endpoints
│   │   ├── database.py      # Database operations
│   │   ├── data.py          # Initial/application data
│   │   ├── parsing.py       # Log parsing and normalization
│   │   ├── detection.py     # Rule-based and ML detection
│   │   ├── schemas.py       # Data validation schemas
│   │   └── __init__.py
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_detection.py
│   │   └── test_parsing.py
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── dashboard/
│   │   │   └── layout/
│   │   ├── data/
│   │   ├── pages/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
└── README.md
```

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/astroxknight/cyvera-prototype.git
cd cyvera-prototype
```

### 2. Run the Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate
```

Install dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Run the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## API Endpoints

| Method     | Endpoint                        | Purpose                     |
| ---------- | ------------------------------- | --------------------------- |
| GET        | `/api/dashboard/summary`        | Dashboard statistics        |
| GET        | `/api/dashboard/trend`          | Activity trends             |
| GET        | `/api/logs`                     | Retrieve logs               |
| POST       | `/api/logs/upload`              | Upload log files            |
| GET        | `/api/alerts`                   | Retrieve security alerts    |
| PATCH      | `/api/alerts/{alert_id}/status` | Update alert status         |
| GET/POST   | `/api/signatures`               | View or create signatures   |
| PUT/DELETE | `/api/signatures/{sig_id}`      | Update or delete signatures |
| GET/PUT    | `/api/settings`                 | Retrieve or update settings |

## Database

CYVERA currently uses **SQLite**, with the database initialized by the backend. Its default database file is `backend/cyvera.db`.

The database stores application data such as logs, alerts, detection signatures, and related records.

## Testing

Run the backend tests from the `backend` directory:

```bash
python -m pytest -v
```

Tests cover API behavior, log parsing, and detection logic. Record actual test results before reporting them in project documentation.

## Limitations

- The current database is SQLite, not MySQL.
- ML anomaly detection operates on uploaded log batches.
- An anomaly is a suspicious indicator, not proof of an attack.
- Authentication and role-based access control are not implemented.
- Production security, scalability, and performance require further validation.

## Future Enhancements

- MySQL integration and secure authentication.
- Real-time log monitoring.
- Improved ML evaluation and detection accuracy.
- Security notifications and incident-response integrations.
- Deployment in a production environment.

## Repository

[CYVERA on GitHub](https://github.com/astroxknight/cyvera-prototype)

## Acknowledgements

CYVERA uses open-source libraries and tools, including React, FastAPI, and Scikit-learn. Their respective licenses and documentation should be acknowledged in accordance with their terms.
