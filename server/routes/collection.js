'use strict';
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getCollection, getStats } = require('../services/userService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { rarity, search, sortBy, order, limit, offset } = req.query;
    const data = await getCollection(req.userId, { rarity, search, sortBy, order, limit, offset });
    const stats = await getStats(req.userId);
    const completion = stats.totalPlayersInPool ? (Number(stats.unique_players||0) / stats.totalPlayersInPool) * 100 : 0;
    res.json({ ...data, completion, stats });
  } catch (e) { next(e); }
});

module.exports = router;
