'use strict';
const { exec, queryOne, query, isPostgres } = require('../index');

const SCHEMA_POSTGRES = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  osu_user_id BIGINT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  osu_user_id BIGINT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  global_rank INTEGER,
  pp DOUBLE PRECISION,
  rarity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_collections (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duplicates INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, player_id)
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_rolls INTEGER NOT NULL DEFAULT 0,
  unique_players INTEGER NOT NULL DEFAULT 0,
  total_discoveries INTEGER NOT NULL DEFAULT 0,
  highest_rarity_id TEXT,
  highest_rarity_rank INTEGER NOT NULL DEFAULT -1,
  highest_player_rank INTEGER,
  highest_pp DOUBLE PRECISION,
  playtime_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('permanent','temporary')),
  quantity INTEGER NOT NULL DEFAULT 0,
  is_equipped INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id, item_type)
);

CREATE TABLE IF NOT EXISTS active_effects (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effect_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  multiplier DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rolls (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id),
  roll_type TEXT NOT NULL CHECK(roll_type IN ('normal','auto','quick')),
  rarity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discovery_feed (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id),
  rarity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_def_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quest_def_id, period)
);

CREATE TABLE IF NOT EXISTS milestone_rewards (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_rolls INTEGER NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, milestone_rolls)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_rank ON players(global_rank);
CREATE INDEX IF NOT EXISTS idx_players_rarity ON players(rarity_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_rolls_user ON rolls(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_created ON discovery_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quests_user ON quests(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

const SCHEMA_SQLITE = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  osu_user_id INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  osu_user_id INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  global_rank INTEGER,
  pp REAL,
  rarity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS user_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  duplicates INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, player_id)
);
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_rolls INTEGER NOT NULL DEFAULT 0,
  unique_players INTEGER NOT NULL DEFAULT 0,
  total_discoveries INTEGER NOT NULL DEFAULT 0,
  highest_rarity_id TEXT,
  highest_rarity_rank INTEGER NOT NULL DEFAULT -1,
  highest_player_rank INTEGER,
  highest_pp REAL,
  playtime_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('permanent','temporary')),
  quantity INTEGER NOT NULL DEFAULT 0,
  is_equipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, item_id, item_type)
);
CREATE TABLE IF NOT EXISTS active_effects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effect_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  multiplier REAL NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  roll_type TEXT NOT NULL CHECK(roll_type IN ('normal','auto','quick')),
  rarity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS discovery_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  rarity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_def_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, quest_def_id, period)
);
CREATE TABLE IF NOT EXISTS milestone_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_rolls INTEGER NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, milestone_rolls)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_rank ON players(global_rank);
CREATE INDEX IF NOT EXISTS idx_players_rarity ON players(rarity_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_rolls_user ON rolls(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_created ON discovery_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quests_user ON quests(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

let migrated = false;
async function runMigrations() {
  if (migrated) return;
  await exec(isPostgres ? SCHEMA_POSTGRES : SCHEMA_SQLITE);
  migrated = true;
  console.log(`Migrations completed successfully (${isPostgres ? 'Postgres/Neon' : 'SQLite'}).`);
}

module.exports = { runMigrations, SCHEMA_POSTGRES, SCHEMA_SQLITE };
