'use strict';
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}
const { runMigrations } = require('../server/db/migrations/schema.sql.js');
const { query, close } = require('../server/db');
const { computeRarity } = require('../server/services/rarityService');

(async () => {
  await runMigrations();
  let offset = 0; const batch = 1000; let n = 0;
  while (true) {
    const players = await query('SELECT id,pp FROM players ORDER BY id LIMIT ? OFFSET ?', [batch, offset]);
    if (!players.length) break;
    for (const p of players) {
      const r = computeRarity({ pp: p.pp });
      await query('UPDATE players SET rarity_id=? WHERE id=?', [r, p.id]);
      n++;
    }
    offset += players.length;
    if (offset % 2000 === 0) console.log('recomputed', offset);
  }
  const dist = await query('SELECT rarity_id, COUNT(*) as c FROM players GROUP BY rarity_id ORDER BY c DESC');
  console.log('done ' + n);
  console.log(JSON.stringify(dist, null, 2));
  await close();
})().catch(e => { console.error('ERR:' + e.message); process.exit(1); });
