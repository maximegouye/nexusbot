const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

db.db.prepare(`CREATE TABLE IF NOT EXISTS autoresponder (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, trigger TEXT, response TEXT,
  exact_match INTEGER DEFAULT 0, wildcard INTEGER DEFAULT 0,
  cooldown INTEGER DEFAULT 0, last_used INTEGER DEFAULT 0,
  uses INTEGER DEFAULT 0
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoresponder')
    .setDescription('🤖 Répondre automatiquement à des messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('ajouter').setDescription('Ajouter une réponse automatique')
      .addStringOption(o => o.setName('declencheur').setDescription('Texte qui déclenche la réponse').setRequired(true))
      .addStringOption(o => o.setName('reponse').setDescription('Réponse à envoyer').setRequired(true))
      .addBooleanOption(o => o.setName('exact').setDescription('Correspondance exacte du message entier (sinon: contient)'))
    .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer une réponse automatique')
      .addStringOption(o => o.setName('id').setDescription('ID de la réponse').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('Voir toutes les réponses automatiques'))
    .addSubcommand(s => s.setName('test').setDescription('Tester un déclencheur')
      .addStringOption(o => o.setName('message').setDescription('Message à tester').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const trigger  = interaction.options.getString('declencheur').toLowerCase();
      const response = interaction.options.getString('reponse');
      const exact    = interaction.options.getBoolean('exact') ?? false;
      const cooldown = parseInt(interaction.options.getString('cooldown')) ?? 0;

      const count = db.db.prepare('SELECT COUNT(*) as c FROM autoresponder WHERE guild_id=?').get(interaction.guildId)?.c ?? 0;
      const max   = (db.isPremium && db.isPremium(interaction.guildId)) ? 100 : 25;
      const premiumHint = max === 25 ? ' | Premium = 100' : '';
      if (count >= max) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Maximum ${max} réponses auto${premiumHint}.`, ephemeral: true });

      db.db.prepare('INSERT INTO autoresponder (guild_id,trigger,response,exact_match,cooldown) VALUES (?,?,?,?,?)')
        .run(interaction.guildId, trigger, response, exact ? 1 : 0, cooldown);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green')
        .setTitle('🤖 Réponse automatique ajoutée')
        .addFields(
          { name: '📥 Déclencheur', value: `\`${trigger}\``, inline: true },
          { name: '📤 Type', value: exact ? 'Exact' : 'Contient', inline: true },
          { name: '⏱️ Cooldown', value: cooldown ? `${cooldown}s` : 'Aucun', inline: true },
        )], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const id = parseInt(interaction.options.getString('id'));
      const r  = db.db.prepare('DELETE FROM autoresponder WHERE id=? AND guild_id=?').run(id, interaction.guildId);
      if (!r.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réponse introuvable.', ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`🗑️ Réponse #${id} supprimée.`)], ephemeral: true });
    }

    if (sub === 'liste') {
      const rows = db.db.prepare('SELECT * FROM autoresponder WHERE guild_id=? ORDER BY id').all(interaction.guildId);
      if (!rows.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: 'Aucune réponse automatique configurée.', ephemeral: true });
      const lines = rows.map(r => `**#${r.id}** \`${r.trigger}\` → ${r.response.slice(0,50)}${r.response.length>50?'…':''} *(${r.exact_match?'exact':'contient'}, ${r.uses} utilisations)*`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
        .setTitle(`🤖 Réponses automatiques (${rows.length})`)
        .setDescription(lines.slice(0, 4000))], ephemeral: true });
    }

    if (sub === 'test') {
      const msg  = interaction.options.getString('message').toLowerCase();
      const rows = db.db.prepare('SELECT * FROM autoresponder WHERE guild_id=?').all(interaction.guildId);
      const match = rows.find(r => r.exact_match ? msg === r.trigger : msg.includes(r.trigger));
      if (!match) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune réponse ne correspond à ce message.', ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green')
        .setTitle('✅ Correspondance trouvée !')
        .addFields(
          { name: '📥 Déclencheur', value: `\`${match.trigger}\``, inline: true },
          { name: '📤 Réponse', value: match.response.slice(0, 200), inline: false },
        )], ephemeral: true });
    }
  }
};
