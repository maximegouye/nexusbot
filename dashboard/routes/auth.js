// ============================================================
// dashboard/routes/auth.js — Discord OAuth2
// ============================================================
'use strict';

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID     || process.env.DASHBOARD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || process.env.DASHBOARD_CLIENT_SECRET;
const REDIRECT_URI  = process.env.DASHBOARD_REDIRECT_URI
  || `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/auth/callback`;

const DISCORD_API    = 'https://discord.com/api/v10';
const OAUTH_SCOPE    = 'identify guilds';
const OAUTH_URL      = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(OAUTH_SCOPE)}`;

// ── GET /auth/login ───────────────────────────────────────
router.get('/login', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(503).send('OAuth non configuré — ajoute DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET dans Railway.');
  }
  res.redirect(OAUTH_URL);
});

// ── GET /auth/callback ────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/');

  try {
    // Échanger le code contre un token
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const { access_token, token_type } = tokenRes.data;

    // Récupérer les infos de l'utilisateur
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `${token_type} ${access_token}` },
    });

    // Récupérer les guildes
    const guildsRes = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `${token_type} ${access_token}` },
    });

    req.session.user = {
      ...userRes.data,
      guilds:       guildsRes.data,
      access_token,
      avatar_url: userRes.data.avatar
        ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userRes.data.discriminator || 0) % 5}.png`,
    };

    res.redirect('/dashboard');
  } catch (e) {
    console.error('[Auth] OAuth error:', e.response?.data || e.message);
    res.redirect('/?error=auth_failed');
  }
});

// ── GET /auth/logout ──────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── Middleware : vérifie que l'user est connecté ──────────
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  res.redirect('/auth/login');
}

// ── Middleware : injecte user dans toutes les vues ────────
function injectUser(req, res, next) {
  res.locals.user = req.session?.user ?? null;
  next();
}

module.exports = { router, requireAuth, injectUser };
