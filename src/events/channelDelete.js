'use strict';

// Auto-ferme les tickets orphelins quand un salon est supprimé manuellement
const db = require('../database/db');

module.exports = {
  name: 'channelDelete',

  async execute(channel) {
    try {
      const ticket = db.db
        .prepare("SELECT * FROM tickets WHERE channel_id=? AND status='open'")
        .get(channel.id);

      if (!ticket) return;

      const now = Math.floor(Date.now() / 1000);
      db.db
        .prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")
        .run(now, ticket.id);

    } catch (err) {
      console.error('[channelDelete] Erreur auto-close ticket orphelin:', err?.message);
    }
  },
};
