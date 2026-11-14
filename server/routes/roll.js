'use strict';
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { performRoll, performRolls } = require('../services/rollService');
const { getUserLuck } = require('../services/inventoryService');
const { getStats } = require('../services/userService');
const { ROLLING } = require('../../config/gameConfig');

const router = express.Router();
router.use(authMiddleware);

router.post('/', async (req, res) => {
  try {
    const mode = (req.body && req.body.mode) || 'normal';
    if (!['normal', 'auto', 'quick'].includes(mode)) return res.status(400).json({ error: 'Invalid roll mode' });
    const count = mode === 'auto' ? Math.max(1, Math.min(Number(req.body.count) || 1, ROLLING.maxAutoBatch)) : 1;
    if (mode === 'auto') {
      const results = await performRolls(req.userId, mode, count);
      return res.json({ mode, results, luck: await getUserLuck(req.userId), stats: await getStats(req.userId) });
    }
    const result = await performRoll(req.userId, mode);
    res.json({ mode, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status', async (req, res, next) => {
  try {
    res.json({ luck: await getUserLuck(req.userId), stats: await getStats(req.userId), rolling: ROLLING });
  } catch (err) { next(err); }
});

module.exports = router;
