'use strict';
const { query, queryOne, exec } = require('../db');
const crypto = require('crypto');

const SESSION_COOKIE = 'osurng_sid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function createSession(userId) {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await query('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)', [id, userId, expiresAt]);
  return { id, expiresAt };
}

async function getSession(sessionId) {
  if (!sessionId) return null;
  const row = await queryOne('SELECT * FROM sessions WHERE id=?', [sessionId]);
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await query('DELETE FROM sessions WHERE id=?', [sessionId]);
    return null;
  }
  return row;
}

async function destroySession(sessionId) {
  if (!sessionId) return;
  await query('DELETE FROM sessions WHERE id=?', [sessionId]);
}

async function createOAuthState() {
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await query('INSERT INTO oauth_states (state,expires_at) VALUES (?,?)', [state, expiresAt]);
  return state;
}

async function consumeOAuthState(state) {
  if (!state) return false;
  const row = await queryOne('SELECT * FROM oauth_states WHERE state=?', [state]);
  await query('DELETE FROM oauth_states WHERE state=?', [state]);
  if (!row) return false;
  return new Date(row.expires_at) > new Date();
}

async function authMiddleware(req, res, next) {
  try {
    const sid = req.cookies && req.cookies[SESSION_COOKIE];
    const session = await getSession(sid);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    req.userId = session.user_id;
    req.sessionId = sid;
    next();
  } catch (err) { next(err); }
}

async function optionalAuth(req, _res, next) {
  try {
    const sid = req.cookies && req.cookies[SESSION_COOKIE];
    const session = await getSession(sid);
    if (session) { req.userId = session.user_id; req.sessionId = sid; }
    next();
  } catch (err) { next(err); }
}

function setSessionCookie(res, session) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    expires: new Date(session.expiresAt),
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

module.exports = {
  authMiddleware, optionalAuth, createSession, destroySession, getSession,
  createOAuthState, consumeOAuthState, setSessionCookie, clearSessionCookie, SESSION_COOKIE,
};
