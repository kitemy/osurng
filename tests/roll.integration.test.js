'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, '..', 'data', 'test-osurng.db');
delete process.env.DATABASE_URL;
try { fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true }); fs.rmSync(process.env.DB_PATH, { force: true }); } catch {}

const { runMigrations } = require('../server/db/migrations/schema.sql.js');
const { close } = require('../server/db');
const { upsertPlayer, ensureUser, getStats } = require('../server/services/userService');
const { computeRarity } = require('../server/services/rarityService');
const { performRoll } = require('../server/services/rollService');
const { getInventory } = require('../server/services/inventoryService');

test('roll generation updates stats and is server-side consistent', async () => {
  await runMigrations();
  for (let i = 1; i <= 60; i++) {
    const p = { osu_user_id: 500000 + i, username: `P${i}`, avatar_url: '', global_rank: i * 1000, pp: Math.max(200, 12000 - i * 150) };
    p.rarity_id = computeRarity(p);
    await upsertPlayer(p);
  }
  const user = await ensureUser({ id: 999001, username: 'tester', avatar_url: '' });
  const before = Number((await getStats(user.id)).total_rolls || 0);
  const res = await performRoll(user.id, 'normal');
  assert.ok(res.player && res.player.username);
  assert.ok(res.player.rarity_id);
  const after = Number((await getStats(user.id)).total_rolls || 0);
  assert.equal(after, before + 1);
  const inv = await getInventory(user.id);
  assert.ok(inv.luck.finalLuck >= 1);
  await close();
});
