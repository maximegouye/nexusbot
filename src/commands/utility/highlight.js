const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

db.db.prepare(`CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, user_id TEXT, keyword TEXT,
  UNIQUE(guild_id, user_id, keyword)
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('highlight')
    .setDescription('🔔 Recevoir une notif en DM quand un mot-clé est mentionné')
    .addSubcommand(s => s.setName('ajouter').setDescription('Ajouter un mot-clé à surveiller')
      .addStringOption(o => o.setName('mot').setDescription('Mot ou expression à surveiller').setRequired(true)))
    .addSubcommand(s => s.setName('retirer').setDescription('Retirer un mot-clé')
      .addStringOption(o => o.setName('mot').setDescription('Mot à retirer').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('Voir ta liste de highlights'))
    .addSubcommand(s => s.setName('vider').setDescription('Supprimer tous tes highlights')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const mot = interaction.options.getString('mot')?.toLowerCase().trim();

    if (sub === 'ajouter') {
      const count = db.db.prepare('SELECT COUNT(*) as c FROM highlights WHERE guild_id=? AND user_id=?').get(interaction.guildId, interaction.user.id)?.c ?? 0;
      if (count >= 25) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 25 highlights par serveur.', ephemeral: true });
      try {
        db.db.prepare('INSERT INTO highlights (guild_id,user_id,keyword) VALUES (?,?,?)').run(interaction.guildId, interaction.user.id, mot);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`🔔 Tu seras notifié quand \`${mot}\` est mentionné.`)], ephemeral: true });
      } catch {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ \`${mot}\` est déjà dans ta liste.`, ephemeral: true });
      }
    }

    if (sub === 'retirer') {
      const r = db.db.prepare('DELETE FROM highlights WHERE guild_id=? AND user_id=? AND keyword=?').run(interaction.guildId, interaction.user.id, mot);
      if (!r.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ \`${mot}\` n'est pas dans ta liste.`, ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ \`${mot}\` retiré.`)], ephemeral: true });
    }

    if (sub === 'liste') {
      const hl = db.db.prepare('SELECT keyword FROM highlights WHERE guild_id=? AND user_id=?').all(interaction.guildId, interaction.user.id);
      if (!hl.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: 'Tu n\'as aucun highlight sur ce serveur.', ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
        .setTitle('🔔 Tes highlights')
        .setDescription(hl.map((h, i) => `**${i+1}.** \`${h.keyword}\``).join('\n'))], ephemeral: true });
    }

    if (sub === 'vider') {
      db.db.prepare('DELETE FROM highlights WHERE guild_id=? AND user_id=?').run(interaction.guildId, interaction.user.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Tous tes highlights supprimés.')], ephemeral: true });
    }
  }
};
