'use strict';
/**
 * Seed a local mock player pool so the game is playable without osu! API credentials.
 * Usage: node scripts/seedMockPlayers.js
 */
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}
const { runMigrations } = require('../server/db/migrations/schema.sql.js');
const { upsertPlayer } = require('../server/services/userService');
const { computeRarity } = require('../server/services/rarityService');

(async () => {
  await runMigrations();
  const bands = [
    { count: 20, rankMin: 1, rankMax: 10, ppMin: 12000, ppMax: 16000, prefix: 'SecretLegend' },
    { count: 40, rankMin: 11, rankMax: 100, ppMin: 9000, ppMax: 13000, prefix: 'MythicAce' },
    { count: 60, rankMin: 101, rankMax: 1000, ppMin: 7000, ppMax: 10000, prefix: 'LegendStar' },
    { count: 120, rankMin: 1001, rankMax: 10000, ppMin: 4500, ppMax: 8000, prefix: 'EpicPro' },
    { count: 200, rankMin: 10001, rankMax: 50000, ppMin: 2500, ppMax: 5000, prefix: 'RareTalent' },
    { count: 300, rankMin: 50001, rankMax: 250000, ppMin: 1000, ppMax: 3000, prefix: 'UncommonPlayer' },
    { count: 380, rankMin: 250001, rankMax: 2000000, ppMin: 100, ppMax: 1200, prefix: 'CommonPlayer' },
  ];

  let id = 1000000;
  let total = 0;
  for (const band of bands) {
    for (let i = 0; i < band.count; i++) {
      id++;
      const t = Math.random();
      const rank = Math.floor(band.rankMin + t * (band.rankMax - band.rankMin));
      const pp = Math.round((band.ppMin + (1 - t) * (band.ppMax - band.ppMin)) * 100) / 100;
      const player = { osu_user_id: id, username: `${band.prefix}${i + 1}`, avatar_url: `https://a.ppy.sh/${id}`, global_rank: rank, pp };
      player.rarity_id = computeRarity(player);
      await upsertPlayer(player);
      total++;
    }
  }
  console.log(`Seeded ${total} mock players.`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
