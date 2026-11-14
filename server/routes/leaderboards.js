'use strict';
const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const totalRolls = await query(`
      SELECT u.id,u.osu_user_id,u.username,u.avatar_url,s.total_rolls as value
      FROM user_stats s JOIN users u ON u.id=s.user_id
      ORDER BY s.total_rolls DESC LIMIT 50`, []);
    const uniquePlayers = await query(`
      SELECT u.id,u.osu_user_id,u.username,u.avatar_url,s.unique_players as value
      FROM user_stats s JOIN users u ON u.id=s.user_id
      ORDER BY s.unique_players DESC LIMIT 50`, []);
    const totalDiscoveries = await query(`
      SELECT u.id,u.osu_user_id,u.username,u.avatar_url,s.total_discoveries as value
      FROM user_stats s JOIN users u ON u.id=s.user_id
      ORDER BY s.total_discoveries DESC LIMIT 50`, []);
    const highestRarity = await query(`
      SELECT u.id,u.osu_user_id,u.username,u.avatar_url,s.highest_rarity_id as value,s.highest_rarity_rank
      FROM user_stats s JOIN users u ON u.id=s.user_id
      WHERE s.highest_rarity_id IS NOT NULL
      ORDER BY s.highest_rarity_rank DESC, s.total_rolls DESC LIMIT 50`, []);
    const highestRank = await query(`
      SELECT u.id,u.osu_user_id,u.username,u.avatar_url,s.highest_player_rank as value
      FROM user_stats s JOIN users u ON u.id=s.user_id
      WHERE s.highest_player_rank IS NOT NULL
      ORDER BY s.highest_player_rank ASC LIMIT 50`, []);
    const completion = await query(`
      SELECT u.id,u.osu_user_id,u.username,u.avatar_url,
             (CAST(s.unique_players AS DOUBLE PRECISION) / NULLIF((SELECT COUNT(*) FROM players),0) * 100) as value
      FROM user_stats s JOIN users u ON u.id=s.user_id
      ORDER BY value DESC NULLS LAST LIMIT 50`, []);

    res.json({ totalRolls, highestRarity, uniquePlayers, highestRank, totalDiscoveries, completion });
  } catch (e) { next(e); }
});

module.exports = router;
