'use strict';
/**
 * Refresh player stats (pp, rank, username/avatar, rarity) for pulled players using osu! API.
 * Usage:
 *   node scripts/backfillPlayerStats.js [limit] [offset] [--missing]
 *   node scripts/backfillPlayerStats.js 500              -> refresh first 500 pulled players
 *   node scripts/backfillPlayerStats.js 500 500          -> refresh next 500 (offset 500)
 *   node scripts/backfillPlayerStats.js 500 0 --missing  -> only players missing rank/pp
 * Env: OSU_CLIENT_ID/OSU_CLIENT_SECRET and DATABASE_URL (or DB_PATH). Rate-limited per player.
 * Run repeatedly with nextOffset while hasMore is true to refresh the full pool.
 */
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}
const { runMigrations } = require('../server/db/migrations/schema.sql.js');
const { backfillPlayerStats } = require('../server/services/osuService');
const { close, queryOne } = require('../server/db');

(async () => {
  await runMigrations();
  const args = process.argv.slice(2).filter(a => a !== '--');
  const missingOnly = args.includes('--missing') || args.includes('missing');
  const nums = args.filter(a => a !== '--missing' && a !== 'missing' && !isNaN(Number(a))).map(Number);
  const limit = nums[0] || 500;
  const offset = nums[1] || 0;
  const result = await backfillPlayerStats({ limit, offset, missingOnly });
  const counts = await queryOne('SELECT COUNT(*) as total, SUM(CASE WHEN global_rank IS NOT NULL AND pp IS NOT NULL THEN 1 ELSE 0 END) as ranked FROM players');
  console.log(JSON.stringify({ ...result, counts: { total: Number(counts?.total || 0), ranked: Number(counts?.ranked || 0) } }, null, 2));
  await close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
