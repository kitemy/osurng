'use strict';
/**
 * Backfill missing rank/pp for players in pool using osu! API user stats.
 * Usage: node scripts/backfillPlayerStats.js [limit]
 * Requires OSU_CLIENT_ID/OSU_CLIENT_SECRET and DATABASE_URL (or DB_PATH).
 * Run repeatedly until checked=0 if limited.
 */
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}
const { runMigrations } = require('../server/db/migrations/schema.sql.js');
const { backfillMissingPlayerStats } = require('../server/services/osuService');
const { close, queryOne } = require('../server/db');

(async () => {
  await runMigrations();
  const limit = Number(process.argv[2]) || 500;
  const result = await backfillMissingPlayerStats(limit);
  const counts = await queryOne('SELECT COUNT(*) FILTER (WHERE global_rank IS NOT NULL AND pp IS NOT NULL) as ranked, COUNT(*) FILTER (WHERE global_rank IS NULL OR pp IS NULL) as missing, COUNT(*) as total FROM players').catch(async () => {
    return queryOne("SELECT SUM(CASE WHEN global_rank IS NOT NULL AND pp IS NOT NULL THEN 1 ELSE 0 END) as ranked, SUM(CASE WHEN global_rank IS NULL OR pp IS NULL THEN 1 ELSE 0 END) as missing, COUNT(*) as total FROM players");
  });
  console.log(JSON.stringify({ ...result, counts }, null, 2));
  await close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
