const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

db.db.prepare(`CREATE TABLE IF NOT EXISTS no_xp (
  guild_id TEXT, type TEXT, target_id TEXT, PRIMARY KEY(guild_id, type, target_id)
)`).run();
db.db.prepare(`CREATE TABLE IF NOT EXISTS xp_multipliers (
  guild_id TEXT, role_id TEXT, multiplier REAL DEFAULT 1.0, PRIMARY KEY(guild_id, role_id)
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpconfig')
    .setDescription('⚙️ Configurer le système de niveaux et XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('statut').setDescription('Voir la configuration XP actuelle'))
    .addSubcommand(s => s.setName('activer').setDescription('Activer/désactiver le système XP')
      .addBooleanOption(o => o.setName('actif').setDescription('Actif ?').setRequired(true)))
    .addSubcommand(s => s.setName('taux').setDescription('Modifier le taux de XP par message')
      .addIntegerOption(o => o.setName('xp_min').setDescription('XP par message').setMinValue(1).setRequired(false))
      .addIntegerOption(o => o.setName('euros').setDescription('€ par message').setMinValue(1).setRequired(false)))
    .addSubcommand(s => s.setName('noxp_canal').setDescription('Ajouter/retirer un canal sans XP')
      .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true))
      .addBooleanOption(o => o.setName('ajouter').setDescription('Ajouter (true) ou retirer (false)').setRequired(true)))
    .addSubcommand(s => s.setName('noxp_role').setDescription('Ajouter/retirer un rôle sans XP')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
      .addBooleanOption(o => o.setName('ajouter').setDescription('Ajouter (true) ou retirer (false)').setRequired(true)))
    .addSubcommand(s => s.setName('multiplicateur').setDescription('XP x2, x3... pour un rôle (ex: Booster)')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
      .addNumberOption(o => o.setName('valeur').setDescription('Multiplicateur (ex: 2.0 pour x2)').setMinValue(0).setRequired(true)))
    .addSubcommand(s => s.setName('message_levelup').setDescription('Personnaliser le message de montée de niveau')
      .addStringOption(o => o.setName('message').setDescription('Message ({user}, {level}, {guild} dispo)').setRequired(true)))
    .addSubcommand(s => s.setName('canal_levelup').setDescription('Canal où afficher les montées de niveau')
      .addChannelOption(o => o.setName('canal').setDescription('Canal (vide = canal actuel)').setRequired(false))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    try {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (sub === 'statut') {
      const noXpCh   = db.db.prepare("SELECT target_id FROM no_xp WHERE guild_id=? AND type='channel'").all(interaction.guildId);
      const noXpR    = db.db.prepare("SELECT target_id FROM no_xp WHERE guild_id=? AND type='role'").all(interaction.guildId);
      const mults    = db.db.prepare('SELECT role_id, multiplier FROM xp_multipliers WHERE guild_id=?').all(interaction.guildId);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⚙️ Configuration XP')
        .addFields(
          { name: '✅ XP activé',        value: cfg.xp_enabled ? 'Oui' : 'Non', inline: true },
          { name: '⭐ Taux XP/message',   value: `${cfg.xp_rate || 15} XP`, inline: true },
          { name: '💶 €/message',    value: `${cfg.coins_per_msg || 5} €`, inline: true },
          { name: '🚫 Canaux sans XP',    value: noXpCh.length ? noXpCh.map(r => `<#${r.target_id}>`).join(' ') : 'Aucun', inline: false },
          { name: '🚫 Rôles sans XP',     value: noXpR.length ? noXpR.map(r => `<@&${r.target_id}>`).join(' ') : 'Aucun', inline: false },
          { name: '✨ Multiplicateurs',   value: mults.length ? mults.map(m => `<@&${m.role_id}> → x${m.multiplier}`).join('\n') : 'Aucun', inline: false },
          { name: '📢 Canal level-up',    value: cfg.level_channel ? `<#${cfg.level_channel}>` : 'Canal actuel', inline: true },
        )
      ], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⚙️ Configuration XP')
        .addFields(
          { name: '✅ XP activé',        value: cfg.xp_enabled ? 'Oui' : 'Non', inline: true },
          { name: '⭐ Taux XP/message',   value: `${cfg.xp_rate || 15} XP`, inline: true },
          { name: '💶 €/message',    value: `${cfg.coins_per_msg || 5} €`, inline: true },
          { name: '🚫 Canaux sans XP',    value: noXpCh.length ? noXpCh.map(r => `<#${r.target_id}>`).join(' ') : 'Aucun', inline: false },
          { name: '🚫 Rôles sans XP',     value: noXpR.length ? noXpR.map(r => `<@&${r.target_id}>`).join(' ') : 'Aucun', inline: false },
          { name: '✨ Multiplicateurs',   value: mults.length ? mults.map(m => `<@&${m.role_id}> → x${m.multiplier}`).join('\n') : 'Aucun', inline: false },
          { name: '📢 Canal level-up',    value: cfg.level_channel ? `<#${cfg.level_channel}>` : 'Canal actuel', inline: true },
        )
      ], ephemeral: true }));
    }

    if (sub === 'activer') {
      const actif = interaction.options.getBoolean('actif');
      db.db.prepare('UPDATE guild_config SET xp_enabled=? WHERE guild_id=?').run(actif ? 1 : 0, interaction.guildId);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red').setDescription(`✅ Système XP ${actif ? 'activé' : 'désactivé'}.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red').setDescription(`✅ Système XP ${actif ? 'activé' : 'désactivé'}.`)], ephemeral: true }));
    }

    if (sub === 'taux') {
      const xpMin = interaction.options.getInteger('xp_min');
      const euros = interaction.options.getInteger('euros');
      if (xpMin !== null) db.db.prepare('UPDATE guild_config SET xp_rate=? WHERE guild_id=?').run(xpMin, interaction.guildId);
      if (euros !== null) db.db.prepare('UPDATE guild_config SET coins_per_msg=? WHERE guild_id=?').run(euros, interaction.guildId);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Taux XP mis à jour.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Taux XP mis à jour.`)], ephemeral: true }));
    }

    if (sub === 'noxp_canal') {
      const canal  = interaction.options.getChannel('canal');
      const ajouter = interaction.options.getBoolean('ajouter');
      if (ajouter) {
        db.db.prepare('INSERT OR IGNORE INTO no_xp (guild_id,type,target_id) VALUES (?,?,?)').run(interaction.guildId, 'channel', canal.id);
        return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <#${canal.id}> ajouté aux canaux sans XP.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <#${canal.id}> ajouté aux canaux sans XP.`)], ephemeral: true }));
      } else {
        db.db.prepare('DELETE FROM no_xp WHERE guild_id=? AND type=? AND target_id=?').run(interaction.guildId, 'channel', canal.id);
        return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <#${canal.id}> retiré des canaux sans XP.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <#${canal.id}> retiré des canaux sans XP.`)], ephemeral: true }));
      }
    }

    if (sub === 'noxp_role') {
      const role   = interaction.options.getRole('role');
      const ajouter = interaction.options.getBoolean('ajouter');
      if (ajouter) {
        db.db.prepare('INSERT OR IGNORE INTO no_xp (guild_id,type,target_id) VALUES (?,?,?)').run(interaction.guildId, 'role', role.id);
        return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@&${role.id}> ajouté aux rôles sans XP.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@&${role.id}> ajouté aux rôles sans XP.`)], ephemeral: true }));
      } else {
        db.db.prepare('DELETE FROM no_xp WHERE guild_id=? AND type=? AND target_id=?').run(interaction.guildId, 'role', role.id);
        return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@&${role.id}> retiré des rôles sans XP.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@&${role.id}> retiré des rôles sans XP.`)], ephemeral: true }));
      }
    }

    if (sub === 'multiplicateur') {
      const role   = interaction.options.getRole('role');
      const valeur = interaction.options.getNumber('valeur');
      if (valeur <= 0) {
        db.db.prepare('DELETE FROM xp_multipliers WHERE guild_id=? AND role_id=?').run(interaction.guildId, role.id);
        return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Multiplicateur de <@&${role.id}> supprimé.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Multiplicateur de <@&${role.id}> supprimé.`)], ephemeral: true }));
      }
      db.db.prepare('INSERT OR REPLACE INTO xp_multipliers (guild_id,role_id,multiplier) VALUES (?,?,?)').run(interaction.guildId, role.id, valeur);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@&${role.id}> → **x${valeur}** XP.`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@&${role.id}> → **x${valeur}** XP.`)], ephemeral: true }));
    }

    if (sub === 'message_levelup') {
      const msg = interaction.options.getString('message');
      db.db.prepare('UPDATE guild_config SET level_msg=? WHERE guild_id=?').run(msg, interaction.guildId);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Message de level-up mis à jour:\n${msg}`)], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Message de level-up mis à jour:\n${msg}`)], ephemeral: true }));
    }

    if (sub === 'canal_levelup') {
      const canal = interaction.options.getChannel('canal');
      db.db.prepare('UPDATE guild_config SET level_channel=? WHERE guild_id=?').run(canal?.id || null, interaction.guildId);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(canal ? `✅ Level-up → <#${canal.id}>` : '✅ Level-up dans le canal actuel.')], ephemeral: true }) : interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(canal ? `✅ Level-up → <#${canal.id}>` : '✅ Level-up dans le canal actuel.')], ephemeral: true }));
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
