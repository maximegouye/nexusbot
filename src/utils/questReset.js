const db = require('../database/db');

module.exports = async (client) => {
  // Expirer les quêtes terminées / dépassées
  const now = Math.floor(Date.now() / 1000);
  db.db.prepare('UPDATE quests SET status = "expired" WHERE status = "active" AND ends_at IS NOT NULL AND ends_at < ?').run(now);
  console.log('[QuestReset] Quêtes expirées mises à jour.');
};
