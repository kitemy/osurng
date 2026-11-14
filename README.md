# osu! RNG – Player Collection Game

RNG collection web app based on real osu! players. Users log in with osu! OAuth, roll for players, earn luck/items via active play, complete daily quests/milestones, track collections, view global discoveries, and compete on leaderboards.

## Architecture
- **Frontend:** React + Vite (`client/`)
- **Backend:** Node.js + Express (`server/`, serverless-ready via `api/index.js`)
- **Database:** **Neon/Postgres** when `DATABASE_URL` is set, or local **SQLite** (`node:sqlite`) when not (`server/db/`)
- **Game logic:** centralized config in `config/gameConfig.js`, server-side services in `server/services/`
- **Auth:** osu! OAuth2, server-side sessions stored in DB (cookie `osurng_sid`)

## Quick start (local, SQLite)
**Prereqs:** Node.js 22+ (uses `node:sqlite`), npm.

1. `npm install` and `npm --prefix client install`
2. `copy .env.example .env` and set values (see below). Leave `DATABASE_URL` unset for SQLite.
3. `npm run migrate`
4. Seed player pool: `node scripts/seedMockPlayers.js` (or seed from osu! rankings with creds)
5. `npm run dev` → server `http://localhost:3000`, client `http://localhost:5173`
6. `npm test` (unit + integration) / `npm run build` then `npm start` for production.

## Neon + Vercel deployment
See **[docs/DEPLOY-NEON-VERCEL.md](docs/DEPLOY-NEON-VERCEL.md)** for step-by-step instructions:
- Create Neon project and copy `DATABASE_URL`
- Configure osu! OAuth callback for your Vercel domain
- Push repo and import into Vercel (`vercel.json` included)
- Set environment variables (`DATABASE_URL`, `CLIENT_URL`, `OSU_*`, `SESSION_SECRET`, `ADMIN_SECRET`, etc.)
- Deploy, seed player pool, verify

## Environment variables (`.env.example`)
- `DATABASE_URL` – Neon/Postgres connection string; if unset uses SQLite at `DB_PATH` (`./data/osurng.db`)
- `PORT`, `NODE_ENV`, `CLIENT_URL` (comma-separated allowed), `SESSION_SECRET`
- `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, `OSU_REDIRECT_URI` (must match osu! OAuth app)
- `OSU_API_BASE`, `OSU_AUTHORIZE_URL`, `OSU_TOKEN_URL`
- `TIMEZONE` (UTC default), `ADMIN_SECRET` (protects admin seed in production)

## Core docs
- Balance/config: `config/gameConfig.js`, `docs/BALANCE.md`
- Rarity: rank+pp thresholds → tier; base weights roll distribution.
- Luck: `finalLuck = min(cap, baseLuck*(1+permanentBonus)*temporaryMultiplier)`, applied to normalized rarity probabilities (sum 100%).
- DB schema auto-migrates (Postgres or SQLite variants). Seed: `node scripts/seedMockPlayers.js` or `POST /api/admin/seed-rankings?pages=N` with `x-admin-secret`.

## Notes
- Rolls, luck, inventory, quests, and stats are server-side and persisted in DB.
- osu! passwords never handled by the app (OAuth only).
- For Vercel/serverless, in-memory cooldown is per-instance; DB remains source of truth.
