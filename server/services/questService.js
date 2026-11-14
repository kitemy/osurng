'use strict';
const { query, queryOne, transaction } = require('../db');
const { DAILY_QUESTS, MILESTONES, getRarityOrder } = require('../../config/gameConfig');
const { grantItem } = require('./inventoryService');

function currentPeriod(_timezone = 'UTC') {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

async function ensureDailyQuests(userId) {
  const period = currentPeriod(process.env.TIMEZONE || 'UTC');
  for (const q of DAILY_QUESTS) {
    await query(`INSERT INTO quests (user_id,quest_def_id,progress,completed,claimed,period) VALUES (?,?,0,0,0,?) ON CONFLICT (user_id,quest_def_id,period) DO NOTHING`,
      [userId, q.id, period]);
  }
  return period;
}

async function getQuests(userId) {
  const period = await ensureDailyQuests(userId);
  const rows = await query(`SELECT * FROM quests WHERE user_id=? AND period=?`, [userId, period]);
  const defs = Object.fromEntries(DAILY_QUESTS.map(q => [q.id, q]));
  return (rows || []).map(r => ({ ...r, progress: Number(r.progress||0), completed: !!Number(r.completed), claimed: !!Number(r.claimed), definition: defs[r.quest_def_id] || null })).filter(r => r.definition);
}

async function applyQuestProgress(userId, event) {
  return transaction(async (db) => {
    const period = currentPeriod(process.env.TIMEZONE || 'UTC');
    for (const q of DAILY_QUESTS) {
      await db.query(`INSERT INTO quests (user_id,quest_def_id,progress,completed,claimed,period) VALUES (?,?,0,0,0,?) ON CONFLICT (user_id,quest_def_id,period) DO NOTHING`, [userId, q.id, period]);
      const row = await db.queryOne(`SELECT * FROM quests WHERE user_id=? AND quest_def_id=? AND period=?`, [userId, q.id, period]);
      if (!row || Number(row.completed)) continue;
      let inc = 0;
      if (q.type === 'rolls') inc = event.rollsIncrement || 0;
      else if (q.type === 'unique_discoveries') inc = event.uniqueIncrement || 0;
      else if (q.type === 'min_rarity') {
        if (event.rarityId && getRarityOrder(event.rarityId) >= getRarityOrder(q.rarityId)) inc = 1;
      }
      if (inc <= 0) continue;
      const newProgress = Math.min(q.target, Number(row.progress || 0) + inc);
      const completed = newProgress >= q.target ? 1 : 0;
      await db.query(`UPDATE quests SET progress=?, completed=? WHERE id=?`, [newProgress, completed, row.id]);
    }
  });
}

async function claimQuest(userId, questDefId) {
  return transaction(async (db) => {
    const period = currentPeriod(process.env.TIMEZONE || 'UTC');
    const row = await db.queryOne(`SELECT * FROM quests WHERE user_id=? AND quest_def_id=? AND period=?`, [userId, questDefId, period]);
    if (!row) throw new Error('Quest not found');
    if (!Number(row.completed)) throw new Error('Quest not completed');
    if (Number(row.claimed)) throw new Error('Quest already claimed');
    const def = DAILY_QUESTS.find(q => q.id === questDefId);
    await db.query(`UPDATE quests SET claimed=1 WHERE id=?`, [row.id]);
    if (def && def.rewards) await applyRewards(userId, def.rewards);
  });
  // return fresh quests outside tx
}

async function claimQuestAndGet(userId, questDefId) {
  await claimQuest(userId, questDefId);
  return getQuests(userId);
}

async function checkMilestones(userId, totalRolls) {
  const unlocked = [];
  for (const m of MILESTONES) {
    if (totalRolls >= m.rolls) {
      // try insert ignore, check if inserted by selecting? easier: insert on conflict do nothing returning
      const inserted = await queryOne(`INSERT INTO milestone_rewards (user_id,milestone_rolls,claimed) VALUES (?,?,1) ON CONFLICT (user_id,milestone_rolls) DO NOTHING RETURNING id`, [userId, m.rolls]);
      if (inserted) {
        await applyRewards(userId, m.rewards);
        unlocked.push(m);
      }
    }
  }
  return unlocked;
}

async function applyRewards(userId, rewards) {
  for (const r of rewards || []) {
    if (r.type === 'item') await grantItem(userId, r.itemId, r.itemType, r.quantity || 1);
  }
}

module.exports = { getQuests, applyQuestProgress, claimQuest: claimQuestAndGet, checkMilestones, ensureDailyQuests };
