'use strict';
const express = require('express');
const { seedPlayersFromRankings, backfillPlayerStats } = require('../services/osuService');

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
    const offset = Number(req.query.offset) || 0;
    const missingOnly = String(req.query.missingOnly || req.query.missing || '').toLowerCase() === 'true' || req.query.missingOnly === '1' || req.query.missing === '1';
    const result = await backfillPlayerStats({ limit, offset, missingOnly });
    const msg = missingOnly
      ? 'Fetched and updated missing rank/pp/rarity from osu! user stats.'
      : 'Refreshed rank/pp/rarity for pulled players from osu! user stats. Use nextOffset while hasMore is true to continue.';
    res.json({ ok: true, ...result, message: msg });
  } catch (e) {
    const status = /not configured/i.test(e.message) ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

module.exports = router;
