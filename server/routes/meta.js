'use strict';
const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { getUserById, getStats } = require('../services/userService');
const { RARITIES, ROLLING, MILESTONES, PERMANENT_ITEMS, TEMPORARY_ITEMS } = require('../../config/gameConfig');

const router = express.Router();

router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const user = await getUserById(req.userId);
    const stats = await getStats(req.userId);
    res.json({ user, stats });
  } catch (e) { next(e); }
});

router.get('/config', optionalAuth, (_req, res) => {
  res.json({
    rarities: RARITIES,
    rolling: ROLLING,
    milestones: MILESTONES,
    items: { permanent: PERMANENT_ITEMS, temporary: TEMPORARY_ITEMS },
  });
});

module.exports = router;
