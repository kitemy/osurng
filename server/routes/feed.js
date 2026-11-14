'use strict';
const express = require('express');
const { query } = require('../db');
const { FEED } = require('../../config/gameConfig');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || FEED.maxItems, 100);
    const sinceId = Number(req.query.sinceId) || 0;
    let rows;
    if (sinceId > 0) {
      rows = await query(`
        SELECT f.id,f.rarity_id,f.created_at,
               u.username as user_username,u.avatar_url as user_avatar,u.osu_user_id as user_osu_id,
               p.username as player_username,p.avatar_url as player_avatar,p.global_rank,p.pp,p.osu_user_id
        FROM discovery_feed f
        JOIN users u ON u.id=f.user_id JOIN players p ON p.id=f.player_id
        WHERE f.id > ? ORDER BY f.id ASC LIMIT ?
      `, [sinceId, limit]);
    } else {
      const desc = await query(`
        SELECT f.id,f.rarity_id,f.created_at,
               u.username as user_username,u.avatar_url as user_avatar,u.osu_user_id as user_osu_id,
               p.username as player_username,p.avatar_url as player_avatar,p.global_rank,p.pp,p.osu_user_id
        FROM discovery_feed f
        JOIN users u ON u.id=f.user_id JOIN players p ON p.id=f.player_id
        ORDER BY f.id DESC LIMIT ?
      `, [limit]);
      rows = [...(desc || [])].reverse();
    }
    res.json({ items: rows || [], config: { pollIntervalMs: FEED.pollIntervalMs } });
  } catch (e) { next(e); }
});

module.exports = router;
