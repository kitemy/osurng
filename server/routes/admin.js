'use strict';
const express = require('express');
const { seedPlayersFromRankings, backfillMissingPlayerStats } = require('../services/osuService');

const router = express.Router();

function requireAdminSecret(req, res) {
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.headers['x-admin-secret'] !== secret) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
  }
  return true;
}

router.post('/seed-rankings', async (req, res) => {
  try {
    if (!requireAdminSecret(req, res)) return;
    const pages = Number(req.query.pages) || undefined;
    const seeded = await seedPlayersFromRankings(pages);
    res.json({ ok: true, seeded, message: 'Real osu! players seeded. Mock placeholder players (if any) were removed.' });
  } catch (e) {
    const status = /not configured|Failed to seed|No players returned/i.test(e.message) ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

router.post('/backfill-stats', async (req, res) => {
  try {
    if (!requireAdminSecret(req, res)) return;
    const limit = Number(req.query.limit) || 500;
    const result = await backfillMissingPlayerStats(limit);
    res.json({ ok: true, ...result, message: 'Fetched and updated missing rank/pp from osu! user stats.' });
  } catch (e) {
    const status = /not configured/i.test(e.message) ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

module.exports = router;
