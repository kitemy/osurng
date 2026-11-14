'use strict';
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { runMigrations } = require('./db/migrations/schema.sql.js');

const authRoutes = require('./routes/auth');
const rollRoutes = require('./routes/roll');
const inventoryRoutes = require('./routes/inventory');
const collectionRoutes = require('./routes/collection');
const leaderboardRoutes = require('./routes/leaderboards');
const questRoutes = require('./routes/quests');
const feedRoutes = require('./routes/feed');
const metaRoutes = require('./routes/meta');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true);
    // allow vercel preview/prod if same project domain pattern? keep simple: allow configured
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Lazy migration for serverless; cached in schema module
let migratePromise = null;
function ensureMigrated(req, res, next) {
  if (!migratePromise) migratePromise = runMigrations();
  migratePromise.then(() => next()).catch(next);
}
app.use(ensureMigrated);

app.use('/auth', authRoutes);
app.use('/api/roll', rollRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', metaRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve client build in production (non-Vercel traditional host)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`osu! RNG server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
