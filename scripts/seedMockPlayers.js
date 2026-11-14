'use strict';
/**
 * Seed a large mock player pool so the game is playable without osu! API credentials.
 * Usage:
 *   node scripts/seedMockPlayers.js [targetCount]
 *   node scripts/seedMockPlayers.js 1000000
 * Env:
 *   SEED_TARGET=1000000  (alternative to arg)
 *   SEED_BATCH=5000      (insert batch size for progress/memory)
 * Generates deterministic-style synthetic osu-like players (ids 1,000,001+) with rank/pp/rarity bands.
 * Real osu! players (seeded via rankings/API) use real osu! user IDs; mocks are separate and can be removed by real seeding.
 */
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}
const { runMigrations } = require('../server/db/migrations/schema.sql.js');
const { computeRarity } = require('../server/services/rarityService');
const { transaction } = require('../server/db');

(async () => {
  await runMigrations();
  const target = Math.max(1, Number(process.argv[2] || process.env.SEED_TARGET || 1120));
  const batchSize = Math.max(100, Number(process.env.SEED_BATCH || 5000));

  // Approx distribution across rank/pp bands -> maps to rarities via computeRarity thresholds
  const bands = [
    { weight: 0.00001, rankMin: 1, rankMax: 10, ppMin: 12000, ppMax: 16000, prefix: 'SecretLegend' },
    { weight: 0.0002,  rankMin: 11, rankMax: 100, ppMin: 9000, ppMax: 13000, prefix: 'MythicAce' },
    { weight: 0.002,   rankMin: 101, rankMax: 1000, ppMin: 7000, ppMax: 10000, prefix: 'LegendStar' },
    { weight: 0.03,    rankMin: 1001, rankMax: 10000, ppMin: 4500, ppMax: 8000, prefix: 'EpicPro' },
    { weight: 0.09,    rankMin: 10001, rankMax: 50000, ppMin: 2500, ppMax: 5000, prefix: 'RareTalent' },
    { weight: 0.22,    rankMin: 50001, rankMax: 250000, ppMin: 1000, ppMax: 3000, prefix: 'UncommonPlayer' },
    { weight: 0.65779, rankMin: 250001, rankMax: 5000000, ppMin: 50, ppMax: 1200, prefix: 'CommonPlayer' },
  ];
  const totalWeight = bands.reduce((s, b) => s + b.weight, 0);
  const alloc = bands.map(b => Math.floor((b.weight / totalWeight) * target));
  let allocated = alloc.reduce((s, n) => s + n, 0);
  for (let i = 0; allocated < target; i = (i + 1) % alloc.length) { alloc[i]++; allocated++; }

  let osuId = 1000000;
  let total = 0;
  let bandIndex = 0;
  let inBand = 0;

  async function flush(batch) {
    if (!batch.length) return;
    await transaction(async (db) => {
      for (const p of batch) {
        await db.query(
          `INSERT INTO players (osu_user_id,username,avatar_url,global_rank,pp,rarity_id)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT (osu_user_id) DO UPDATE SET username=EXCLUDED.username, avatar_url=EXCLUDED.avatar_url, global_rank=EXCLUDED.global_rank, pp=EXCLUDED.pp, rarity_id=EXCLUDED.rarity_id`,
          [p.osu_user_id, p.username, p.avatar_url, p.global_rank, p.pp, p.rarity_id]
        );
      }
    });
  }

  let batch = [];
  while (total < target) {
    while (bandIndex < bands.length && inBand >= alloc[bandIndex]) { bandIndex++; inBand = 0; }
    if (bandIndex >= bands.length) bandIndex = bands.length - 1;
    const band = bands[bandIndex];
    osuId++;
    inBand++;
    const t = Math.random();
    const rank = Math.floor(band.rankMin + t * (band.rankMax - band.rankMin));
    const pp = Math.round((band.ppMin + (1 - t) * (band.ppMax - band.ppMin)) * 100) / 100;
    const player = {
      osu_user_id: osuId,
      username: `${band.prefix}${total + 1}`,
      avatar_url: `https://a.ppy.sh/${osuId}`,
      global_rank: rank,
      pp,
    };
    player.rarity_id = computeRarity(player);
    batch.push(player);
    total++;
    if (batch.length >= batchSize) {
      await flush(batch);
      batch = [];
      if (total % 50000 === 0 || total === target) console.log(`Seeded ${total}/${target} mock players...`);
    }
  }
  await flush(batch);
  console.log(`Seeded ${total} mock players (ids ${1000001}..${osuId}).`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
