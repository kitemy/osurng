'use strict';
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getInventory, equipPermanent, unequipPermanent, activateTemporary } = require('../services/inventoryService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try { res.json(await getInventory(req.userId)); } catch (e) { next(e); }
});
router.post('/equip', async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    res.json(await equipPermanent(req.userId, itemId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/unequip', async (req, res) => {
  try { res.json(await unequipPermanent(req.userId)); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/activate', async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    res.json(await activateTemporary(req.userId, itemId));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
