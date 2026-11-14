'use strict';
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getQuests, claimQuest } = require('../services/questService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try { res.json({ quests: await getQuests(req.userId) }); } catch (e) { next(e); }
});

router.post('/claim', async (req, res) => {
  try {
    const { questId } = req.body || {};
    if (!questId) return res.status(400).json({ error: 'questId required' });
    res.json({ quests: await claimQuest(req.userId, questId) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
