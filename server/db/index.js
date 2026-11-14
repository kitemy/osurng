'use strict';
/**
 * DB adapter supporting Neon/Postgres (DATABASE_URL) and local SQLite (DB_PATH).
 * Exposes async API: query, queryOne, exec, transaction.
 * - Params: use `?` placeholders in SQL; converted to $1.. for Postgres.
 * - Returns: query -> rows array, queryOne -> first row or null, exec -> { rowCount }.
 * - INSERT ... RETURNING id supported for Postgres; for SQLite we emulate returning inserted id when needed via lastInsertRowid.
 */
const fs = require('fs');
const path = require('path');
try { require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); } catch {}

const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;

let pgPool = null;
let sqliteDb = null;
let sqliteTxDepth = 0;

function toPgParams(sql) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return text;
}

function normalizeBoolRows(rows) {
  // keep as-is; app treats 0/1 or bool compatibly in most places
  return rows;
}

async function getPg() {
  if (pgPool) return pgPool;
  let Pool;
  try {
    // Prefer Neon serverless driver if installed, else pg
    ({ Pool } = require('@neondatabase/serverless'));
  } catch {
    ({ Pool } = require('pg'));
  }
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSL_DISABLE ? false : { rejectUnauthorized: false },
  });
  return pgPool;
}

function getSqlite() {
  if (sqliteDb) return sqliteDb;
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'osurng.db');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA busy_timeout = 5000;');
  return sqliteDb;
}

async function exec(sql) {
  if (isPostgres) {
    const pool = await getPg();
    await pool.query(sql);
    return { rowCount: 0 };
  }
  const db = getSqlite();
  db.exec(sql);
  return { rowCount: 0 };
}

function isReadQuery(sql) {
  const t = String(sql).trim().toUpperCase();
  return t.startsWith('SELECT') || t.startsWith('WITH') || t.startsWith('PRAGMA') || /\bRETURNING\b/.test(t);
}

async function query(sql, params = []) {
  if (isPostgres) {
    const pool = await getPg();
    const text = toPgParams(sql);
    const res = await pool.query(text, params);
    return res.rows || [];
  }
  const db = getSqlite();
  const stmt = db.prepare(sql);
  if (isReadQuery(sql)) return stmt.all(...params);
  const info = stmt.run(...params);
  return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
}

async function queryOne(sql, params = []) {
  if (isPostgres) {
    const rows = await query(sql, params);
    return rows[0] || null;
  }
  const db = getSqlite();
  const stmt = db.prepare(sql);
  if (isReadQuery(sql)) return stmt.get(...params) || null;
  const info = stmt.run(...params);
  return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
}

async function transaction(fn) {
  if (isPostgres) {
    const pool = await getPg();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        query: async (sql, params = []) => (await client.query(toPgParams(sql), params)).rows,
        queryOne: async (sql, params = []) => {
          const r = await client.query(toPgParams(sql), params);
          return r.rows[0] || null;
        },
        exec: async (sql) => { await client.query(sql); },
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      throw err;
    } finally {
      client.release();
    }
  }
  const db = getSqlite();
  const outer = sqliteTxDepth === 0;
  const sp = `sp_${sqliteTxDepth++}`;
  if (outer) db.exec('BEGIN IMMEDIATE'); else db.exec(`SAVEPOINT ${sp}`);
  const tx = {
    query: async (sql, params = []) => {
      const stmt = db.prepare(sql);
      if (isReadQuery(sql)) return stmt.all(...params);
      const info = stmt.run(...params);
      return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    },
    queryOne: async (sql, params = []) => {
      const stmt = db.prepare(sql);
      if (isReadQuery(sql)) return stmt.get(...params) || null;
      const info = stmt.run(...params);
      return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    },
    exec: async (sql) => { db.exec(sql); },
  };
  try {
    const result = await fn(tx);
    if (outer) db.exec('COMMIT'); else db.exec(`RELEASE ${sp}`);
    sqliteTxDepth--;
    return result;
  } catch (err) {
    try {
      if (outer) db.exec('ROLLBACK'); else { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); }
    } catch {}
    sqliteTxDepth--;
    throw err;
  }
}

async function close() {
  if (pgPool) { await pgPool.end(); pgPool = null; }
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }
}

module.exports = { query, queryOne, exec, transaction, close, isPostgres, DATABASE_URL };
