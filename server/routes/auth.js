'use strict';
const express = require('express');
const { createOAuthState, consumeOAuthState, createSession, setSessionCookie, clearSessionCookie, destroySession, authMiddleware } = require('../middleware/auth');
const { exchangeCode, getMe } = require('../services/osuService');
const { ensureUser, getUserById, getStats } = require('../services/userService');

const router = express.Router();

router.get('/login', async (req, res, next) => {
  try {
    const clientId = process.env.OSU_CLIENT_ID;
    const redirectUri = process.env.OSU_REDIRECT_URI;
    if (!clientId || !redirectUri) return res.status(500).json({ error: 'OAuth not configured' });
    const state = await createOAuthState();
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'identify public', state,
    });
    res.redirect(`${process.env.OSU_AUTHORIZE_URL || 'https://osu.ppy.sh/oauth/authorize'}?${params.toString()}`);
  } catch (err) { next(err); }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !(await consumeOAuthState(state))) return res.status(400).send('Invalid OAuth state');
    const tokenData = await exchangeCode(code);
    const me = await getMe(tokenData.access_token);
    const user = await ensureUser({ id: me.id, username: me.username, avatar_url: me.avatar_url });
    const session = await createSession(user.id);
    setSessionCookie(res, session);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/#/roll`);
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('Authentication failed');
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const sid = req.cookies && req.cookies.osurng_sid;
    await destroySession(sid);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await getUserById(req.userId);
    const stats = await getStats(req.userId);
    res.json({ user, stats });
  } catch (err) { next(err); }
});

module.exports = router;
