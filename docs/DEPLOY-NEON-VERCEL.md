# Neon (PostgreSQL) & Vercel Deployment Guide

This project now supports **Neon Postgres** (recommended for production/Vercel) and **SQLite** (local fallback).
- If `DATABASE_URL` is set → uses Postgres/Neon.
- If `DATABASE_URL` is not set → uses local SQLite file (`DB_PATH`, default `./data/osurng.db`).

All game logic (rolls, luck, inventory, quests, feed, leaderboards) runs server-side; schema auto-migrates on startup/request.

## 1) Prerequisites
- GitHub/GitLab/Bitbucket repo with this project pushed (Vercel deploys from git).
- [Neon](https://neon.tech) account (free tier works).
- [Vercel](https://vercel.com) account.
- osu! account to create an OAuth application: https://osu.ppy.sh/home/account/edit → **OAuth**.

## 2) Create a Neon database
1. Sign in to Neon → **New Project**.
2. Choose a region close to your users/Vercel region, create project + database (default `neondb` is fine).
3. Open **Dashboard → Connection Details** and copy the **connection string** (use the pooled/`-pooler` endpoint if shown; both work here, pooled is better for serverless).
   - Format: `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`
4. Keep it secret; you will paste it into Vercel/local `.env` as `DATABASE_URL`.
5. No manual schema setup required: the app runs migrations automatically (`users`, `players`, `collections`, `inventory`, `rolls`, `quests`, `feed`, `sessions`, etc.). You can also run `npm run migrate` locally against Neon by setting `DATABASE_URL`.

## 3) Configure osu! OAuth (two environments)
Create OAuth applications/redirects that exactly match where auth runs:

**Local development**
- Application callback URL: `http://localhost:3000/auth/callback`
- `OSU_REDIRECT_URI=http://localhost:3000/auth/callback`
- `CLIENT_URL=http://localhost:5173`

**Vercel production** (after you know your domain)
- Application callback URL: `https://YOUR-APP.vercel.app/auth/callback` (or your custom domain)
- `OSU_REDIRECT_URI=https://YOUR-APP.vercel.app/auth/callback`
- `CLIENT_URL=https://YOUR-APP.vercel.app`
You can create a separate osu! OAuth app for prod vs local, or reuse one if you update its callback to match the environment in use (must match exactly).

## 4) Prepare the repo for Vercel (already included)
- `vercel.json`: builds client (`npm run vercel-build` → outputs `client/dist`), routes `/api/*` and `/auth/*` to the Express serverless function (`api/index.js`), and SPA-fallback to `index.html`.
- `api/index.js`: exports the Express app from `server/index.js`.
- Root `package.json`: includes `vercel-build` and `@neondatabase/serverless`.
- Migrations run lazily on first request (safe for serverless) and also via `npm run migrate`.

Commit and push your code to your git provider.

## 5) Deploy on Vercel
1. Vercel → **Add New… → Project** → import your repo.
2. **Framework preset:** Vite (or Other is fine; `vercel.json` controls build/output). Root directory: repo root.
3. Build settings (should auto-detect from `vercel.json`):
   - Build command: `npm run vercel-build`
   - Output directory: `client/dist`
4. **Environment Variables** (Project → Settings → Environment Variables). Add for Production (and Preview if desired):

| Variable | Value / notes |
|---|---|
| `DATABASE_URL` | Neon connection string (`postgresql://...?...sslmode=require`) |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | `https://YOUR-APP.vercel.app` (your deployed origin; comma-separated allowed) |
| `SESSION_SECRET` | long random string |
| `OSU_CLIENT_ID` | from osu! OAuth app |
| `OSU_CLIENT_SECRET` | from osu! OAuth app |
| `OSU_REDIRECT_URI` | `https://YOUR-APP.vercel.app/auth/callback` (must match osu! app) |
| `OSU_API_BASE` | `https://osu.ppy.sh/api/v2` |
| `OSU_AUTHORIZE_URL` | `https://osu.ppy.sh/oauth/authorize` |
| `OSU_TOKEN_URL` | `https://osu.ppy.sh/oauth/token` |
| `TIMEZONE` | `UTC` (quest daily key; default UTC-based) |
| `ADMIN_SECRET` | random secret to protect admin seed endpoint |

5. Click **Deploy**. First request will apply DB migrations on Neon automatically.

## 6) Seed the player pool (required before rolling)
Rolling needs players in `players` table.

**Option A – real osu! rankings (recommended when creds work):**
```bash
curl -X POST "https://YOUR-APP.vercel.app/api/admin/seed-rankings?pages=10" -H "x-admin-secret: YOUR_ADMIN_SECRET"
```
Requires valid `OSU_CLIENT_ID/OSU_CLIENT_SECRET`. Respects rate limits; adjust `pages` as needed.

**Option B – mock pool (no osu! API):** run locally against Neon so data is written to production DB:
```bash
# in project root, with .env or env var set to your Neon URL
set DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require  # PowerShell: $env:DATABASE_URL="..."
npm install
node scripts/seedMockPlayers.js
```
(or `npm run migrate` first; seeder also migrates). Verify by logging in and rolling.

## 7) Local development with Neon (optional) or SQLite
- **SQLite (default):** do not set `DATABASE_URL`, keep `DB_PATH=./data/osurng.db`, run `npm run migrate`, seed, `npm run dev`.
- **Neon locally:** set `DATABASE_URL` in `.env` to your Neon string; run `npm run migrate` and/or `node scripts/seedMockPlayers.js`, then `npm run dev`. (Server runs on 3000, client on 5173 via proxy.)

## 8) Verify after deploy
- Visit `https://YOUR-APP.vercel.app/api/health` → `{ "ok": true }`.
- Click **Login with osu!** → completes OAuth and redirects back to `/#/roll`.
- Perform rolls, check inventory/quests/collection/leaderboards/feed update and persist (refresh page, log in again).
- In Neon dashboard, confirm tables and rows are created.

## 9) Important notes & limitations
- **Serverless state:** in-memory anti-spam cooldown (`rollService`) is per-instance; DB and game state are authoritative in Neon. For stricter global rate limiting, add a DB/Redis-backed limiter.
- **Sessions:** stored in DB (`sessions` table) with httpOnly cookies (`secure` in production, `sameSite=lax`). Ensure `CLIENT_URL`/domain and HTTPS are correct.
- **Cold starts/migrations:** migrations run on first request; Neon serverless driver is used (`@neondatabase/serverless`).
- **Build:** Vercel installs root deps for the API function and runs `vercel-build` to build the client (`client/dist`). `config/` and `server/` are bundled with the function.
- **CORS/origin:** set `CLIENT_URL` to your exact site origin. For previews/custom domains, add them (comma-separated) or adjust CORS in `server/index.js`.
- **osu! API/seed:** seeding from rankings requires osu! credentials and is rate-limited; mock seeder is available for testing.
- **Do not commit `.env`**; keep secrets in Vercel env vars / Neon dashboard.
- Existing gameplay/balance remains configurable in `config/gameConfig.js` (rarities, luck, items, rolls, quests, milestones, feed).
