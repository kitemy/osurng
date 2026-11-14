'use strict';
const { query, queryOne, transaction } = require('../db');
const { getRarityOrder, FEED } = require('../../config/gameConfig');

async function ensureUser(osuProfile) {
  return transaction(async (db) => {
    const existing = await db.queryOne('SELECT * FROM users WHERE osu_user_id=?', [osuProfile.id]);
    if (existing) {
      await db.query('UPDATE users SET username=?, avatar_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [osuProfile.username, osuProfile.avatar_url, existing.id]);
    } else {
      const inserted = await db.queryOne('INSERT INTO users (osu_user_id, username, avatar_url) VALUES (?,?,?) RETURNING id', [osuProfile.id, osuProfile.username, osuProfile.avatar_url]);
      const uid = inserted?.id ?? (await db.queryOne('SELECT id FROM users WHERE osu_user_id=?', [osuProfile.id]))?.id;
      await db.query('INSERT INTO user_stats (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING', [uid]);
    }
    const user = await db.queryOne('SELECT * FROM users WHERE osu_user_id=?', [osuProfile.id]);
    await db.query('INSERT INTO user_stats (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    return user;
  });
}

async function getUserById(id) {
  return queryOne('SELECT * FROM users WHERE id=?', [id]);
}

async function getStats(userId) {
  const stats = await queryOne('SELECT * FROM user_stats WHERE user_id=?', [userId]);
  const rarityCounts = await query(`
    SELECT p.rarity_id, COUNT(*)::int as count FROM user_collections uc
    JOIN players p ON p.id = uc.player_id WHERE uc.user_id=? GROUP BY p.rarity_id
  `.replace('::int', ''), [userId]); // sqlite ignores ::int syntax? no; handle below
  // compatibility: ensure count numeric
  const counts = (rarityCounts || []).map(r => ({ ...r, count: Number(r.count) }));
  const totalPlayersRow = await queryOne('SELECT COUNT(*) as c FROM players', []);
  const totalPlayers = Number(totalPlayersRow?.c || 0);
  return { ...(stats || {}), rarityCounts: counts, totalPlayersInPool: totalPlayers };
}

async function upsertPlayer(player) {
  // Upsert by osu_user_id and return row
  const row = await queryOne(
    `INSERT INTO players (osu_user_id,username,avatar_url,global_rank,pp,rarity_id)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT (osu_user_id) DO UPDATE SET username=EXCLUDED.username, avatar_url=EXCLUDED.avatar_url, global_rank=EXCLUDED.global_rank, pp=EXCLUDED.pp, rarity_id=EXCLUDED.rarity_id
     RETURNING *`,
    [player.osu_user_id, player.username, player.avatar_url, player.global_rank, player.pp, player.rarity_id]
  );
  if (row) return row;
  return queryOne('SELECT * FROM players WHERE osu_user_id=?', [player.osu_user_id]);
}

async function recordDiscovery(userId, player, rollType) {
  return transaction(async (db) => {
    const now = new Date().toISOString();
    await db.query('INSERT INTO rolls (user_id,player_id,roll_type,rarity_id,created_at) VALUES (?,?,?,?,?)',
      [userId, player.id, rollType, player.rarity_id, now]);

    const existing = await db.queryOne('SELECT * FROM user_collections WHERE user_id=? AND player_id=?', [userId, player.id]);
    let isNew = false;
    if (existing) {
      await db.query('UPDATE user_collections SET duplicates = duplicates + 1 WHERE id=?', [existing.id]);
    } else {
      isNew = true;
      await db.query('INSERT INTO user_collections (user_id,player_id,discovered_at,duplicates) VALUES (?,?,?,0)', [userId, player.id, now]);
    }

    const stats = await db.queryOne('SELECT * FROM user_stats WHERE user_id=?', [userId]) || { total_rolls:0, unique_players:0, total_discoveries:0, highest_rarity_rank:-1 };
    const newTotal = Number(stats.total_rolls || 0) + 1;
    const newUnique = Number(stats.unique_players || 0) + (isNew ? 1 : 0);
    const newDiscoveries = Number(stats.total_discoveries || 0) + 1;
    const rarityOrder = getRarityOrder(player.rarity_id);
    let highestRarityId = stats.highest_rarity_id || player.rarity_id;
    let highestRarityRank = stats.highest_rarity_rank ?? -1;
    if (rarityOrder >= highestRarityRank) { highestRarityId = player.rarity_id; highestRarityRank = rarityOrder; }
    let highestPlayerRank = stats.highest_player_rank;
    if (player.global_rank != null && (highestPlayerRank == null || player.global_rank < highestPlayerRank)) highestPlayerRank = player.global_rank;
    let highestPp = Number(stats.highest_pp || 0);
    if (Number(player.pp || 0) > highestPp) highestPp = Number(player.pp || 0);

    await db.query(
      `UPDATE user_stats SET total_rolls=?, unique_players=?, total_discoveries=?, highest_rarity_id=?, highest_rarity_rank=?, highest_player_rank=?, highest_pp=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
      [newTotal, newUnique, newDiscoveries, highestRarityId, highestRarityRank, highestPlayerRank, highestPp, userId]
    );

    if (FEED.includeRarities.includes(player.rarity_id)) {
      await db.query('INSERT INTO discovery_feed (user_id,player_id,rarity_id,created_at) VALUES (?,?,?,?)', [userId, player.id, player.rarity_id, now]);
    }

    const newStats = await db.queryOne('SELECT * FROM user_stats WHERE user_id=?', [userId]);
    return { isNew, stats: newStats };
  });
}

async function getCollection(userId, { rarity, search, sortBy = 'discovered_at', order = 'desc', limit = 100, offset = 0 } = {}) {
  const where = ['uc.user_id = ?'];
  const params = [userId];
  if (rarity) { where.push('p.rarity_id = ?'); params.push(rarity); }
  if (search) { where.push('p.username ILIKE ?'); params.push(`%${search}%`); } // ILIKE for pg; sqlite compat handled below
  const rarityCase = `CASE p.rarity_id WHEN 'secret' THEN 6 WHEN 'mythic' THEN 5 WHEN 'legendary' THEN 4 WHEN 'epic' THEN 3 WHEN 'rare' THEN 2 WHEN 'uncommon' THEN 1 ELSE 0 END`;
  const sortMap = {
    rarity: rarityCase,
    rank: '(CASE WHEN p.global_rank IS NULL THEN 1 ELSE 0 END), p.global_rank',
    pp: 'p.pp',
    discovered_at: 'uc.discovered_at',
    username: 'p.username'
  };
  const sortCol = sortMap[sortBy] || 'uc.discovered_at';
  const dir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  // SQLite doesn't support ILIKE; use LIKE. Detect by trying simple replacement.
  const { isPostgres } = require('../db');
  const likeOp = isPostgres ? 'ILIKE' : 'LIKE';
  const whereSql = where.join(' AND ').replace(/ILIKE/g, likeOp);
  const lim = Number(limit) || 100;
  const off = Number(offset) || 0;
  const sql = `SELECT uc.*, p.username, p.avatar_url, p.global_rank, p.pp, p.rarity_id, p.osu_user_id
    FROM user_collections uc JOIN players p ON p.id=uc.player_id
    WHERE ${whereSql} ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`;
  const rows = await query(sql, [...params, lim, off]);
  const totalRow = await queryOne(`SELECT COUNT(*) as c FROM user_collections uc JOIN players p ON p.id=uc.player_id WHERE ${whereSql}`, params);
  return { items: rows || [], total: Number(totalRow?.c || 0) };
}

module.exports = { ensureUser, getUserById, getStats, upsertPlayer, recordDiscovery, getCollection };
