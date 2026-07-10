# 📡 Restream Server

A **self-hosted, multi-platform live stream relay server** — a lightweight alternative to Restream.io.

Receive one RTMP stream from OBS and redistribute it to multiple platforms (YouTube, Twitch, Kick, Facebook, TikTok, Custom) **without transcoding**.

## Architecture

```
OBS
 │
 ▼
SRS (RTMP Ingest) ──► Node.js Backend ──► FFmpeg -c copy ──► YouTube
                          │                                ──► Twitch
                          │                                ──► Kick
                          ▼                                ──► Facebook
                   React Dashboard                         ──► Custom RTMP
                   (Live WebSocket)
```

**Zero transcoding** — FFmpeg uses `-c copy` to remux the stream, resulting in minimal CPU usage.

---

## Quick Start

### 1. Clone & Configure

```bash
git clone <your-repo>
cd Restream-Server
cp .env.example .env
# Optional: edit .env for APP_PORT only
```

### 2. Deploy

```bash
docker compose up -d
```

### 3. Open Dashboard

Navigate to `http://<your-server-ip>:3000` and open Settings.

### 4. Configure OBS

| Setting | Value |
|---------|-------|
| **Server** | `rtmp://<your-server-ip>:1935/live` |
| **Stream Key** | Copy it from Dashboard -> Settings |

---

## Features

- ✅ **Single RTMP Ingest** — One stream in, many streams out
- ✅ **Zero Transcoding** — FFmpeg `-c copy` relay (minimal CPU)
- ✅ **RTMP & RTMPS** — Supports secure RTMP destinations
- ✅ **Live Dashboard** — Real-time stats via WebSocket
- ✅ **Platform Presets** — YouTube, Twitch, Kick, Facebook, TikTok
- ✅ **Per-Destination Control** — Enable/disable individually
- ✅ **Auto-Reconnect** — Exponential backoff on failures
- ✅ **Stream Key Auth** — Reject unauthorized publishers
- ✅ **Live Logs** — Color-coded scrolling log viewer
- ✅ **Config Persistence** — JSON-based, survives restarts
- ✅ **Dockerized** — One-command deployment
- ✅ **Dark UI** — Modern glassmorphism design

---

## Ports

| Port | Service | Description |
|------|---------|-------------|
| `1935` | SRS | RTMP ingest (OBS connects here) |
| `3000` | App | Dashboard + REST API |
| `1985` | SRS | SRS HTTP API (optional) |
| `8080` | SRS | SRS HTTP server (optional) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/stats` | Aggregated monitoring stats |
| `GET` | `/api/destinations` | List all destinations |
| `POST` | `/api/destinations` | Add a destination |
| `PUT` | `/api/destinations/:id` | Update a destination |
| `DELETE` | `/api/destinations/:id` | Delete a destination |
| `PATCH` | `/api/destinations/:id/toggle` | Toggle enable/disable |
| `POST` | `/api/stream/start` | Start all relays |
| `POST` | `/api/stream/stop` | Stop all relays |
| `POST` | `/api/stream/restart` | Restart all relays |
| `GET` | `/api/settings` | Get settings |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/config/export` | Export config |
| `POST` | `/api/config/import` | Import config |

**WebSocket**: `ws://<host>:3000/ws`

---

## Environment Variables

| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `APP_PORT` | `3000` | Local Compose | External port for Node backend dashboard |
| `SRS_HOST` | `srs` | Node Backend | SRS hostname/private IP (e.g. `srs.railway.internal`) |
| `SRS_API_PORT` | `1985` | Node Backend | SRS HTTP API port |
| `SRS_RTMP_PORT` | `1935` | Node Backend | SRS RTMP port |
| `PUBLIC_RTMP_URL` | *(calculated)* | Node Backend | Custom RTMP URL to show in OBS (e.g. `rtmp://tcp.railway.app:12345/live`) |
| `BACKEND_HOST` | `app` | SRS Server | Hostname of the Node backend for HTTP callbacks (e.g. `app.railway.internal`) |
| `BACKEND_PORT` | `3001` | SRS Server | Local listening port of the Node backend container |

---

## Development

### Backend

```bash
cd backend
npm install
npm run dev    # Starts with tsx watch
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # Vite dev server with API proxy
```

---

## Railway Deployment

You will deploy this repository as **two separate services** inside the same Railway project.

### Service 1: SRS Media Server

1. Add a new service from your GitHub repo.
2. Under **Settings** ➔ **Build**:
   - Set **Dockerfile Path** to `Dockerfile.srs`.
3. Under **Settings** ➔ **General**:
   - Change the service name to `srs` (so private networking generates `srs.railway.internal`).
4. Under **Variables**:
   - Add `BACKEND_HOST=app.railway.internal` (assuming your backend service is named `app`).
   - Add `BACKEND_PORT=3001` (internal backend port).
5. Under **Settings** ➔ **Networking**:
   - Click **Add TCP Proxy**.
   - Set **Port** to `1935` (RTMP).
   - *Note down the assigned domain and port (e.g. `rtmp://tcp-proxy-domain.railway.app:12345/live`)*.

---

### Service 2: Node.js Backend & Dashboard

1. Add another service from the same GitHub repo.
2. Under **Settings** ➔ **Build**:
   - Set **Dockerfile Path** to `Dockerfile` (default).
3. Under **Settings** ➔ **General**:
   - Change the service name to `app` (so private networking generates `app.railway.internal`).
4. Under **Variables**:
   - Add `PORT=3001` (the backend container listens on port 3001).
   - Add `SRS_HOST=srs.railway.internal` (points to Service 1 via Railway Private Network).
   - Add `SRS_API_PORT=1985` (SRS HTTP API).
   - Add `SRS_RTMP_PORT=1935` (SRS RTMP ingest).
   - Add `PUBLIC_RTMP_URL=rtmp://tcp-proxy-domain.railway.app:12345/live` (use the public RTMP TCP proxy URL noted from Service 1).
5. Under **Settings** ➔ **Networking**:
   - Generate a **Public Domain** to expose the Dashboard on port `3001`.

---

## Tech Stack

- **Streaming Engine**: [SRS](https://github.com/ossrs/srs) (Simple Realtime Server)
- **Relay**: FFmpeg (`-c copy`, zero transcoding)
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + Tailwind CSS
- **Real-time**: WebSocket
- **Infrastructure**: Docker + Docker Compose

---

## License

MIT
