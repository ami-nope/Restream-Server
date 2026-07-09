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
# Edit .env and set your STREAM_KEY
```

### 2. Deploy

```bash
docker compose up -d
```

### 3. Configure OBS

| Setting | Value |
|---------|-------|
| **Server** | `rtmp://<your-server-ip>:1935/live` |
| **Stream Key** | Your `STREAM_KEY` from `.env` |

### 4. Open Dashboard

Navigate to `http://<your-server-ip>:3000`

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

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_KEY` | `live` | Stream key for OBS authentication |
| `APP_PORT` | `3000` | External port for dashboard |
| `SRS_HOST` | `srs` | SRS hostname (Docker service) |
| `SRS_API_PORT` | `1985` | SRS HTTP API port |
| `SRS_RTMP_PORT` | `1935` | SRS RTMP port |

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

1. Connect your GitHub repo to Railway
2. Set the root directory to `/`
3. Railway will detect the Dockerfile
4. Add environment variable: `STREAM_KEY=your-key`
5. Note: RTMP port 1935 requires Railway TCP proxy setup

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
