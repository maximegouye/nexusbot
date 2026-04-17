const db = require('../database/db');

async function handleAutoresponder(message) {
  if (!message.guild || message.author.bot) return false;
  const content = message.content.toLowerCase().trim();
  if (!content) return false;

  const rows = db.db.prepare('SELECT * FROM autoresponder WHERE guild_id=?').all(message.guildId);
  for (const row of rows) {
    const matches = row.exact_match ? content === row.trigger : content.includes(row.trigger);
    if (!matches) continue;

    // Cooldown
    const now = Math.floor(Date.now() / 1000);
    if (row.cooldown > 0 && now - row.last_used < row.cooldown) continue;

    db.db.prepare('UPDATE autoresponder SET uses=uses+1, last_used=? WHERE id=?').run(now, row.id);

    // Remplacements dans la réponse
    const resp = row.response
      .replace(/{user}/g, `<@${message.author.id}>`)
      .replace(/{username}/g, message.author.username)
      .replace(/{server}/g, message.guild.name)
      .replace(/{membercount}/g, message.guild.memberCount);

    await message.channel.send(resp).catch(() => {});
    return true; // on en déclenche qu'un
  }
  return false;
}

module.exports = { handleAutoresponder };
