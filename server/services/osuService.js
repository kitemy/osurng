'use strict';
const { OSU } = require('../../config/gameConfig');

const cache = new Map(); // key -> { data, expires }

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data, ttl = OSU.cacheTtlMs) {
  cache.set(key, { data, expires: Date.now() + ttl });
}

async function osuFetch(url, token) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || 2) * 1000;
    await new Promise(r => setTimeout(r, retry));
    return osuFetch(url, token);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`osu! API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getAppToken() {
  const cached = getCached('app_token');
  if (cached) return cached;
  const clientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('OSU_CLIENT_ID/OSU_CLIENT_SECRET not configured');
  const res = await fetch(process.env.OSU_TOKEN_URL || 'https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials', scope: 'public' }),
  });
  if (!res.ok) throw new Error(`Failed to obtain osu! app token: ${res.status}`);
  const data = await res.json();
  setCached('app_token', data.access_token, (data.expires_in - 60) * 1000);
  return data.access_token;
}

async function exchangeCode(code) {
  const res = await fetch(process.env.OSU_TOKEN_URL || 'https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.OSU_CLIENT_ID,
      client_secret: process.env.OSU_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.OSU_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  return res.json();
}

async function getMe(accessToken) {
  return osuFetch('https://osu.ppy.sh/api/v2/me/osu', accessToken);
}

async function fetchRankingsPage(mode = 'osu', type = 'performance', cursorPage = 1) {
  const token = await getAppToken();
  const url = `https://osu.ppy.sh/api/v2/rankings/${mode}/${type}?cursor[page]=${cursorPage}`;
  return osuFetch(url, token);
}

function mapRankingUser(entry) {
  const u = entry.user || entry || {};
  const stats = u.statistics || entry.statistics || u.statistics_rulesets?.osu || entry.statistics_rulesets?.osu || {};
  const rankRaw = entry.global_rank ?? stats.global_rank ?? stats.rank?.global ?? entry.rank ?? u.global_rank ?? null;
  const ppRaw = entry.pp ?? stats.pp ?? entry.performance ?? u.pp ?? stats.performance ?? null;
  const global_rank = rankRaw != null && Number.isFinite(Number(rankRaw)) ? Number(rankRaw) : null;
  const pp = ppRaw != null && Number.isFinite(Number(ppRaw)) ? Number(ppRaw) : null;
  return {
    osu_user_id: u.id ?? entry.id ?? entry.user_id,
    username: u.username ?? entry.username,
    avatar_url: u.avatar_url ?? entry.avatar_url ?? (u.id ? `https://a.ppy.sh/${u.id}` : null),
    global_rank,
    pp,
  };
}

async function clearMockPlayers() {
  const { query, queryOne } = require('../db');
  const where = `(username LIKE 'SecretLegend%' OR username LIKE 'MythicAce%' OR username LIKE 'LegendStar%' OR username LIKE 'EpicPro%' OR username LIKE 'RareTalent%' OR username LIKE 'UncommonPlayer%' OR username LIKE 'CommonPlayer%') AND osu_user_id >= 1000000 AND osu_user_id < 2000000`;
  const ids = await query(`SELECT id FROM players WHERE ${where}`, []);
  if (!ids || !ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const vals = ids.map(r => r.id);
  await query(`DELETE FROM discovery_feed WHERE player_id IN (${placeholders})`, vals);
  await query(`DELETE FROM rolls WHERE player_id IN (${placeholders})`, vals);
  await query(`DELETE FROM user_collections WHERE player_id IN (${placeholders})`, vals);
  await query(`DELETE FROM players WHERE id IN (${placeholders})`, vals);
  return ids.length;
}

async function seedPlayersFromRankings(pages = OSU.seedPages) {
  const { upsertPlayer } = require('./userService');
  const { computeRarity } = require('./rarityService');
  let count = 0;
  let firstError = null;
  for (let page = 1; page <= pages; page++) {
    try {
      const data = await fetchRankingsPage('osu', 'performance', page);
      const ranking = data.ranking || [];
      for (const entry of ranking) {
        const p = mapRankingUser(entry);
        if (!p.osu_user_id) continue;
        p.rarity_id = computeRarity(p);
        await upsertPlayer(p);
        count++;
      }
      await new Promise(r => setTimeout(r, OSU.rateLimitDelayMs));
    } catch (err) {
      console.error('Seed page failed', page, err.message);
      firstError = err;
      break;
    }
  }
  if (count === 0) {
    throw new Error(firstError ? `Failed to seed osu! players: ${firstError.message}` : 'No players returned from osu! rankings. Check OSU_CLIENT_ID/OSU_CLIENT_SECRET and API access.');
  }
  const removedMocks = await clearMockPlayers();
  console.log(`Seeded ${count} osu! players, removed ${removedMocks} mock players.`);
  return count;
}

async function fetchUserOsu(osuUserId) {
  const token = await getAppToken();
  return osuFetch(`https://osu.ppy.sh/api/v2/users/${osuUserId}/osu`, token);
}

function mapUserStats(data) {
  const u = data || {};
  const stats = u.statistics || u.statistics_rulesets?.osu || {};
  const rankRaw = stats.global_rank ?? stats.rank?.global ?? u.global_rank ?? null;
  const ppRaw = stats.pp ?? u.pp ?? stats.performance ?? null;
  const global_rank = rankRaw != null && Number.isFinite(Number(rankRaw)) ? Number(rankRaw) : null;
  const pp = ppRaw != null && Number.isFinite(Number(ppRaw)) ? Number(ppRaw) : null;
  return {
    osu_user_id: u.id,
    username: u.username,
    avatar_url: u.avatar_url || (u.id ? `https://a.ppy.sh/${u.id}` : null),
    global_rank,
    pp,
  };
}

async function backfillPlayerStats({ limit = 500, offset = 0, missingOnly = false } = {}) {
  // Refreshes player stats (pp, rank, username/avatar, rarity) from osu! API.
  // missingOnly=true: only players missing rank/pp. missingOnly=false (default): refresh pulled players in DB (batch via offset).
  const { query } = require('../db');
  const { upsertPlayer } = require('./userService');
  const { computeRarity } = require('./rarityService');
  const lim = Math.max(1, Number(limit) || 500);
  const off = Math.max(0, Number(offset) || 0);
  const where = missingOnly ? 'WHERE global_rank IS NULL OR pp IS NULL' : '';
  const rows = await query(
    `SELECT id, osu_user_id FROM players ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [lim, off]
  );
  let updated = 0;
  let failed = 0;
  for (const row of rows || []) {
    try {
      const data = await fetchUserOsu(row.osu_user_id);
      const p = mapUserStats(data);
      if (!p.osu_user_id) { failed++; continue; }
      p.rarity_id = computeRarity(p);
      await upsertPlayer(p);
      updated++;
      await new Promise(r => setTimeout(r, OSU.rateLimitDelayMs));
    } catch (err) {
      console.error('Backfill failed for', row.osu_user_id, err.message);
      failed++;
    }
  }
  const checked = (rows || []).length;
  const nextOffset = off + checked;
  return { checked, updated, failed, offset: off, nextOffset, hasMore: checked === lim, missingOnly: !!missingOnly };
}

// Back-compat wrapper
async function backfillMissingPlayerStats(limit = 500) {
  return backfillPlayerStats({ limit, offset: 0, missingOnly: true });
}


module.exports = { exchangeCode, getMe, seedPlayersFromRankings, getAppToken, fetchRankingsPage, fetchUserOsu, mapRankingUser, mapUserStats, clearMockPlayers, backfillPlayerStats, backfillMissingPlayerStats };
