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
  const u = entry.user || entry;
  const stats = u.statistics || entry.statistics || {};
  return {
    osu_user_id: u.id,
    username: u.username,
    avatar_url: u.avatar_url,
    global_rank: stats.global_rank ?? stats.rank?.global ?? null,
    pp: stats.pp ?? null,
  };
}

async function seedPlayersFromRankings(pages = OSU.seedPages) {
  const { upsertPlayer } = require('./userService');
  const { computeRarity } = require('./rarityService');
  let count = 0;
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
      break;
    }
  }
  return count;
}

module.exports = { exchangeCode, getMe, seedPlayersFromRankings, getAppToken, fetchRankingsPage, mapRankingUser };

