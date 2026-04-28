/**
 * NexusBot — Système de sanctions complet
 * /sanctions — Avertissements, historique, gestion des cas
 * Mieux que MEE6, Carl-bot
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS sanctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, mod_id TEXT,
    type TEXT, reason TEXT DEFAULT 'Aucune raison',
    duration INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS warn_config (
    guild_id TEXT PRIMARY KEY,
    warn2_action TEXT DEFAULT 'none',
    warn3_action TEXT DEFAULT 'mute',
    warn3_duration INTEGER DEFAULT 3600,
    warn5_action TEXT DEFAULT 'kick',
    warn7_action TEXT DEFAULT 'ban'
  )`).run();
} catch {}

function getWarnCount(guildId, userId) {
  return db.db.prepare("SELECT COUNT(*) as c FROM sanctions WHERE guild_id=? AND user_id=? AND type='warn' AND active=1").get(guildId, userId).c;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sanctions')
    .setDescription('⚖️ Système de sanctions et avertissements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(s => s.setName('avertir').setDescription('⚠️ Donner un avertissement à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre à avertir').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true).setMaxLength(500)))

    .addSubcommand(s => s.setName('historique').setDescription('📋 Voir l\'historique des sanctions d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))

    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un avertissement (par ID de cas)')
      .addStringOption(o => o.setName('cas_id').setDescription('ID du cas à supprimer').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison de la suppression')))

    .addSubcommand(s => s.setName('effacer_tout').setDescription('🗑️ Effacer toutes les sanctions d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER').setRequired(true)))

    .addSubcommand(s => s.setName('cas').setDescription('🔍 Voir le détail d\'un cas')
      .addStringOption(o => o.setName('cas_id').setDescription('Numéro du cas').setRequired(true)))

    .addSubcommand(s => s.setName('serveur').setDescription('📊 Statistiques des sanctions du serveur'))

    .addSubcommand(s => s.setName('seuils').setDescription('⚙️ Configurer les actions automatiques selon les avertissements')
      .addIntegerOption(o => o.setName('nb_warn').setDescription('À quel nombre d\'avertissements').setRequired(true).setMinValue(1).setMaxValue(20))
      .addStringOption(o => o.setName('action').setDescription('Action à effectuer').setRequired(true)
        .addChoices(
          { name: '⚠️ Rien (garder en note)', value: 'none' },
          { name: '🔇 Mute temporaire', value: 'mute' },
          { name: '👢 Kick', value: 'kick' },
          { name: '🔨 Ban', value: 'ban' },
        ))
      .addIntegerOption(o => o.setName('duree_minutes').setDescription('Durée du mute en minutes (si mute)').setMinValue(1))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }); } catch (e) { /* already ack'd */ }
    }
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const modId = interaction.user.id;

    // Vérification de permission globale
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return interaction.editReply({ content: '❌ Tu n\'as pas les permissions.', ephemeral: true });

    if (sub === 'avertir') {
      const target = interaction.options.getUser('membre');
      const raison = interaction.options.getString('raison');
      if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ Impossible de s\'avertir soi-même.', ephemeral: true });

      const result = db.db.prepare("INSERT INTO sanctions (guild_id,user_id,mod_id,type,reason) VALUES(?,?,?,'warn',?)").run(guildId, target.id, modId, raison);
      const warnCount = getWarnCount(guildId, target.id);

      // Notification DM
      try {
        await target.send({ embeds: [new EmbedBuilder().setColor('#F59E0B')
          .setTitle(`⚠️ Avertissement sur ${interaction.guild.name}`)
          .addFields(
            { name: '📝 Raison', value: raison },
            { name: '🔢 Total', value: `Vous avez maintenant **${warnCount}** avertissement(s).` },
          )] });
      } catch {}

      // Check seuils
      let actionMsg = '';
      try {
        const wc = db.db.prepare('SELECT * FROM warn_config WHERE guild_id=?').get(guildId);
        if (wc) {
          const member = await interaction.guild.members.fetch(target.id).catch(() => null);
          if (member) {
            const check = async (n, actionKey, durKey) => {
              if (warnCount === n) {
                const action = wc[actionKey];
                if (action === 'kick') { await member.kick(`${warnCount} avertissements`).catch(()=>{}); actionMsg = '👢 Kick automatique déclenché.'; }
                else if (action === 'ban') { await member.ban({ reason: `${warnCount} avertissements` }).catch(()=>{}); actionMsg = '🔨 Ban automatique déclenché.'; }
                else if (action === 'mute') {
                  const dur = (wc[durKey] || 3600) * 1000;
                  await member.timeout(dur, `${warnCount} avertissements`).catch(()=>{});
                  actionMsg = `🔇 Mute automatique de ${Math.floor((wc[durKey]||3600)/60)} min.`;
                }
              }
            };
            await check(3, 'warn3_action', 'warn3_duration');
            await check(5, 'warn5_action', 'warn5_duration');
            await check(7, 'warn7_action', 'warn7_duration');
          }
        }
      } catch {}

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#F59E0B')
        .setTitle(`⚠️ Avertissement — Cas #${result.lastInsertRowid}`)
        .addFields(
          { name: '👤 Membre',      value: `<@${target.id}>`, inline: true },
          { name: '👮 Modérateur',  value: `<@${modId}>`,     inline: true },
          { name: '🔢 Total warns', value: `${warnCount}`,     inline: true },
          { name: '📝 Raison',      value: raison,             inline: false },
          ...(actionMsg ? [{ name: '🤖 Action auto', value: actionMsg, inline: false }] : []),
        )
        .setFooter({ text: `ID de cas #${result.lastInsertRowid}` })] });
    }

    if (sub === 'historique') {
      const target = interaction.options.getUser('membre');
      const cases  = db.db.prepare('SELECT * FROM sanctions WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20').all(guildId, target.id);
      if (!cases.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ **${target.username}** n\'a aucune sanction.`, ephemeral: true });

      const typeEmoji = { warn:'⚠️', mute:'🔇', kick:'👢', ban:'🔨', note:'📝' };
      const lines = cases.map(c => {
        const e = typeEmoji[c.type] || '📌';
        const date = `<t:${c.created_at}:d>`;
        return `${e} **Cas #${c.id}** — ${c.type.toUpperCase()} | ${date}\n> ${c.reason} — par <@${c.mod_id}>`;
      });

      const warnActive = getWarnCount(guildId, target.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`📋 Sanctions de ${target.username}`)
        .setDescription(lines.join('\n\n'))
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: `${cases.length} sanction(s) | ${warnActive} warn(s) actif(s)` })], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const casId = parseInt(interaction.options.getString('cas_id'));
      const raison = interaction.options.getString('raison') || 'Suppression manuelle';
      const cas = db.db.prepare('SELECT * FROM sanctions WHERE id=? AND guild_id=?').get(casId, guildId);
      if (!cas) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Cas #${casId} introuvable.`, ephemeral: true });
      db.db.prepare('UPDATE sanctions SET active=0 WHERE id=?').run(casId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`✅ Cas **#${casId}** (${cas.type} sur <@${cas.user_id}>) marqué comme inactif.\n📝 Raison : ${raison}`)
        .setFooter({ text: `Action par ${interaction.user.username}` })] });
    }

    if (sub === 'effacer_tout') {
      if (interaction.options.getString('confirmation') !== 'CONFIRMER')
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tapez exactement **CONFIRMER**.', ephemeral: true });
      const target = interaction.options.getUser('membre');
      const count  = db.db.prepare('SELECT COUNT(*) as c FROM sanctions WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      db.db.prepare('DELETE FROM sanctions WHERE guild_id=? AND user_id=?').run(guildId, target.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`🗑️ **${count.c}** sanction(s) de <@${target.id}> supprimées.`)] });
    }

    if (sub === 'cas') {
      const casId = parseInt(interaction.options.getString('cas_id'));
      const cas = db.db.prepare('SELECT * FROM sanctions WHERE id=? AND guild_id=?').get(casId, guildId);
      if (!cas) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Cas #${casId} introuvable.`, ephemeral: true });
      const typeEmoji = { warn:'⚠️', mute:'🔇', kick:'👢', ban:'🔨', note:'📝' };
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`${typeEmoji[cas.type]||'📌'} Cas #${casId} — ${cas.type.toUpperCase()}`)
        .addFields(
          { name: '👤 Membre',     value: `<@${cas.user_id}>`, inline: true },
          { name: '👮 Modérateur', value: `<@${cas.mod_id}>`,  inline: true },
          { name: '📊 Statut',     value: cas.active ? '🟢 Actif' : '⚫ Inactif', inline: true },
          { name: '📅 Date',       value: `<t:${cas.created_at}:F>`, inline: true },
          { name: '📝 Raison',     value: cas.reason, inline: false },
        )], ephemeral: true });
    }

    if (sub === 'serveur') {
      const total   = db.db.prepare('SELECT COUNT(*) as c FROM sanctions WHERE guild_id=?').get(guildId);
      const warns   = db.db.prepare("SELECT COUNT(*) as c FROM sanctions WHERE guild_id=? AND type='warn'").get(guildId);
      const mutes   = db.db.prepare("SELECT COUNT(*) as c FROM sanctions WHERE guild_id=? AND type='mute'").get(guildId);
      const kicks   = db.db.prepare("SELECT COUNT(*) as c FROM sanctions WHERE guild_id=? AND type='kick'").get(guildId);
      const bans    = db.db.prepare("SELECT COUNT(*) as c FROM sanctions WHERE guild_id=? AND type='ban'").get(guildId);
      const top5    = db.db.prepare("SELECT user_id, COUNT(*) as c FROM sanctions WHERE guild_id=? GROUP BY user_id ORDER BY c DESC LIMIT 5").all(guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('📊 Statistiques des sanctions')
        .addFields(
          { name: '📈 Total',          value: `${total.c}`, inline: true },
          { name: '⚠️ Avertissements', value: `${warns.c}`, inline: true },
          { name: '🔇 Mutes',          value: `${mutes.c}`, inline: true },
          { name: '👢 Kicks',          value: `${kicks.c}`, inline: true },
          { name: '🔨 Bans',           value: `${bans.c}`,  inline: true },
          { name: '🏆 Membres les + sanctionnés',
            value: top5.map((r,i) => `**${i+1}.** <@${r.user_id}> — ${r.c} cas`).join('\n') || 'Aucun', inline: false },
        )], ephemeral: true });
    }

    if (sub === 'seuils') {
      const n    = parseInt(interaction.options.getString('nb_warn'));
      const act  = interaction.options.getString('action');
      const dur  = parseInt(interaction.options.getString('duree_minutes')) || 60;
      db.db.prepare(`INSERT INTO warn_config (guild_id) VALUES(?) ON CONFLICT(guild_id) DO NOTHING`).run(guildId);
      const col  = `warn${n}_action`;
      const durCol = `warn${n}_duration`;
      try {
        db.db.prepare(`UPDATE warn_config SET ${col}=?, ${durCol}=? WHERE guild_id=?`).run(act, dur * 60, guildId);
      } catch {
        db.db.prepare(`ALTER TABLE warn_config ADD COLUMN ${col} TEXT DEFAULT 'none'`).run();
        db.db.prepare(`ALTER TABLE warn_config ADD COLUMN ${durCol} INTEGER DEFAULT 3600`).run();
        db.db.prepare(`UPDATE warn_config SET ${col}=?, ${durCol}=? WHERE guild_id=?`).run(act, dur * 60, guildId);
      }
      const actionLabels = { none:'⚠️ Aucune action', mute:`🔇 Mute (${dur}min)`, kick:'👢 Kick', ban:'🔨 Ban' };
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#F59E0B')
        .setTitle('⚙️ Seuil configuré')
        .setDescription(`À **${n} avertissements** → **${actionLabels[act]}**`)] });
    }
  }
};
