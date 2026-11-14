'use strict';
const { query, queryOne } = require('../db');
const { ROLLING } = require('../../config/gameConfig');
const { rollRarity } = require('./rarityService');
const { getUserLuck } = require('./inventoryService');
const { recordDiscovery, getStats } = require('./userService');
const { applyQuestProgress, checkMilestones } = require('./questService');

const lastRollAt = new Map();

async function pickRandomPlayerByRarity(rarityId) {
  let row = await queryOne(`SELECT * FROM players WHERE rarity_id=? ORDER BY RANDOM() LIMIT 1`, [rarityId]);
  if (!row) row = await queryOne(`SELECT * FROM players ORDER BY RANDOM() LIMIT 1`, []);
  return row;
}

function assertCanRoll(userId, mode, totalRolls) {
  const unlock = ROLLING[mode]?.unlockRolls ?? 0;
  if (Number(totalRolls) < unlock) throw new Error(`${mode} roll unlocks at ${unlock} total rolls`);
  const now = Date.now();
  const last = lastRollAt.get(String(userId)) || 0;
  if (now - last < ROLLING.rollCooldownMs) throw new Error('Roll cooldown active');
  lastRollAt.set(String(userId), now);
}

async function performRoll(userId, mode = 'normal') {
  const stats = await getStats(userId);
  if (!stats) throw new Error('User stats not found');
  assertCanRoll(userId, mode, stats.total_rolls || 0);
  const pool = await queryOne('SELECT COUNT(*) as c FROM players', []);
  if (!Number(pool?.c)) throw new Error('Player pool is empty. Seed players first.');

  const luck = await getUserLuck(userId);
  const rarityId = rollRarity(luck.finalLuck);
  const player = await pickRandomPlayerByRarity(rarityId);
  if (!player) throw new Error('No player available for roll');

  const result = await recordDiscovery(userId, player, mode);
  await applyQuestProgress(userId, { rollsIncrement: 1, uniqueIncrement: result.isNew ? 1 : 0, rarityId: player.rarity_id });
  const milestones = await checkMilestones(userId, result.stats.total_rolls);

  return {
    player: {
      id: player.id,
      osu_user_id: player.osu_user_id,
      username: player.username,
      avatar_url: player.avatar_url,
      global_rank: player.global_rank,
      pp: player.pp,
      rarity_id: player.rarity_id,
      profile_url: `https://osu.ppy.sh/users/${player.osu_user_id}`,
    },
    isNew: result.isNew,
    mode,
    luck,
    stats: await getStats(userId),
    milestonesUnlocked: milestones,
  };
}

async function performRolls(userId, mode, count) {
  const n = Math.max(1, Math.min(Number(count) || 1, ROLLING.maxAutoBatch));
  const results = [];
  for (let i = 0; i < n; i++) {
    try {
      results.push({ ok: true, ...(await performRoll(userId, mode)) });
    } catch (err) {
      results.push({ ok: false, error: err.message });
      break;
    }
  }
  return results;
}

module.exports = { performRoll, performRolls, pickRandomPlayerByRarity };
