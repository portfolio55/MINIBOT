# SIGMA MDX DEPLOY

A multi-user WhatsApp bot platform built with Baileys 6.7.19, Express, and Socket.io.

## Architecture

- **Entry point**: `start.js` → runs DB migration → imports `src/server.js`
- **Web server**: Express + Socket.io on port 5000 (`src/server.js`)
- **Bot manager**: `src/botManager.js` - manages multiple Baileys WhatsApp instances
- **Session manager**: `src/sessionManager.js` - bot metadata in PostgreSQL (in-memory cache + DB)
- **Database layer**: `src/db.js` - PostgreSQL pool + all query functions (`pg` package)
- **Migration script**: `src/migrate.js` - one-shot JSON → PostgreSQL migration (idempotent, runs at startup)
- **Group manager**: `groupManager.js` - group protections in PostgreSQL (in-memory cache + DB)
- **Frontend**: Static HTML files in `public/` (index.html, admin.html, dashboard.html)
- **Commands**: Individual command handlers in `commands/` directory
- **Bot logic**: `index.js` (legacy single-bot entry), `bug.js` (command routing)
- **Protections**: `protections.js`, `protections2.js`

## Security

- **Rate limiting**: pairing (5/min), admin (10/min), bot API (30/min) per IP via `express-rate-limit`
- **Admin auth**: Authorization header only (Bearer token), query param disabled, 15-min lockout after 5 failed attempts
- **Safe math**: `expr-eval` replaces `eval()` in calc commands — no arbitrary code execution
- **Protection isolation**: each bot gets its own `ProtectionManager` instance (no shared module-level state)
- **Audio response isolation**: per-bot via `global.responsRegistry[uuid]` (no global overwrite)

## Configuration

- Port: 5000 (set via `PORT` env var in `.env`)
- Host: 0.0.0.0
- Admin password: set via `ADMIN_PASSWORD` env var (default: admin123) — sent via `Authorization: Bearer` header
- **Baileys auth sessions stored in PostgreSQL** (`baileys_auth` table) — survives redeployment/republication
- Bot metadata + group protections stored in **PostgreSQL** (bots, bot_config, group_protections tables)
- Per-bot config files (prefix, sudo, owners, etc.) still in `sessions/bot_<UUID>/` on disk
- `storage/bots.json` and `storage/tokens.json` cleared after first migration (DB is sole source of truth)
- Tables auto-created by `ensureTables()` in `src/migrate.js` at startup

## Runtime

- Node.js 22
- Dependencies managed via npm with `--legacy-peer-deps`
- System dependency: ffmpeg (for audio/video processing)

## Deployment

- Target: VM (always-running, needed for persistent WebSocket connections)
- Run command: `node start.js`

## Key Features

- Multi-user WhatsApp bot pairing via web UI
- Pairing code-based authentication (no QR code scan needed)
- Admin dashboard at `/admin.html` — capacity meter (X/100), connected bots list
- Bot dashboard at `/dashboard.html`
- Real-time status via Socket.io
- Auto-reconnect on server restart
- 155 commands with `.` prefix (149 in `commands/`, 6 in `bug.js`)
- 15 protections (14 group protections via `protections.js`, audiorespons via `protections2.js`)

## Multi-User Isolation

All per-bot data is stored under `sessions/bot_<UUID>/`:
- `prefix.json` — command prefix (default `.`)
- `modeprefix.json` — prefix mode on/off
- `group.json` — group protection states
- `sudo.json` — sudo list
- `owners.json` — owner list
- `respon.mp3` — audiorespons audio file (set with `.setrespons`)

The `botContext` object passed to commands contains:
- `sessionPath` — absolute path to bot's session directory
- `uuid` — bot UUID
- `owners` — per-bot owner list
- `sudoList` — per-bot sudo list

`global.responsRegistry[uuid]` stores each bot's audiorespons system for per-bot isolation.

## h24 Stability System

- **Keepalive**: Baileys socket `keepAliveIntervalMs=25s` + `connectTimeoutMs=60s` + `maxMsgRetryCount=5` + `fireInitQueries=true`
- **Command timeout**: 15s per command via Promise.race — prevents blocking
- **Health check** (60s interval): Detects bots marked "connected" but with dead WebSocket (checks `isOpen` + `readyState`) — triggers auto-restart
- **Connected-count watchdog**: If connected bots drop to 0 (was >0 two minutes ago), triggers emergency recovery sweep
- **Recovery sweep** (5 min interval): Retries bots in error/conflict/disconnected/waiting_recovery state using `Promise.allSettled` (parallel, not sequential)
- **Disconnect handling**: Fine-grained per DisconnectReason:
  - `loggedOut` / `badSession` → permanent stop, session cleanup
  - `connectionClosed` / `timedOut` → fast retry (2s–10s)
  - `connectionLost` → backoff 5s/15s/30s
  - `connectionReplaced` → exponential backoff 30s–240s, max 5 attempts
  - `515` (server restart) → 10s fixed delay
  - Other → exponential backoff up to 5 min
- **Reconnect cap**: After 15 failed attempts, bot enters `waiting_recovery` state
- **Graceful shutdown**: SIGTERM/SIGINT cleanly disconnects all bots before exit
- **Process protection**: `uncaughtException` and `unhandledRejection` handlers log full stack trace WITHOUT killing the process

## Multi-User Isolation (per-bot)

- `global.config` and `global.autoVVIB` removed — replaced by `manager._autoVVConfig` and `manager._autoVVIB` per-bot
- `global.sigmaChatIB` replaced by per-bot Map in `sigmachat-ib.js`
- `global.responsRegistry[uuid]` correctly namespaced per-bot
- `globalCommands` is shared read-only (command definitions, not state)
- Each bot gets its own `ProtectionManager` instance with isolated config

## DB Performance

- PostgreSQL pool: max 20 connections, idleTimeout 30s, connectionTimeout 5s
- Indexes on: bots(uuid, status), baileys_auth(uuid, key), group_protections(group_jid, uuid), bot_config(uuid)
- Auth state: in-memory cache (all keys loaded at startup), writes batched/debounced 500ms
- Config reads: in-memory cache with 3s TTL

## Environment Variables

- `PORT=5000`
- `ADMIN_PASSWORD=admin123`
- `MAX_BOTS=100`
- `BOT_RECONNECT_CONCURRENCY=5`
- `BOT_RECONNECT_DELAY_MS=250`
- `BOT_SEND_MIN_DELAY_MS=350`
- `PREFIXE=.`
- `KEEPALIVE_INTERVAL_MS=25000`
- `MAX_RECONNECT_ATTEMPTS=15`
- `HEALTH_CHECK_INTERVAL_MS=60000`
- `RECOVERY_SWEEP_INTERVAL_MS=300000`
- `BOT_CONNECTING_TIMEOUT_MS=90000`

## Scaling

- Target: 100 simultaneous users
- MaxListeners set to 50 globally in `start.js`
- Staggered reconnect: 5 concurrent, 250ms delay between batches
