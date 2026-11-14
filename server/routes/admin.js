'use strict';
const express = require('express');
const { seedPlayersFromRankings } = require('../services/osuService');

const router = express.Router();

router.post('/seed-rankings', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const secret = process.env.ADMIN_SECRET;
      if (!secret || req.headers['x-admin-secret'] !== secret) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const pages = Number(req.query.pages) || undefined;
    const seeded = await seedPlayersFromRankings(pages);
    res.json({ ok: true, seeded, message: 'Real osu! players seeded. Mock placeholder players (if any) were removed.' });
  } catch (e) {
    const status = /not configured|Failed to seed|No players returned/i.test(e.message) ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

module.exports = router;
