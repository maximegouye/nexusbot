const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wizard')
    .setDescription('🧙 Assistant de configuration guidé — parfait pour débuter !')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 10,

  async execute(interaction) {
    try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const cfg = db.getConfig(interaction.guildId);
    const guild = interaction.guild;

    // ─── Page 1 : Résumé de configuration ───────────────
    const checkmark = (val) => val ? '✅' : '❌';

    const statusEmbed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('🧙 Assistant NexusBot — Configuration du Serveur')
      .setDescription(
        `Bienvenue dans l'assistant de configuration de **NexusBot** !\n\n` +
        `Voici l'état actuel de la configuration :`
      )
      .addFields(
        {
          name: '📋 État de la Configuration',
          value: [
            `${checkmark(cfg.welcome_channel)} Canal de bienvenue ${cfg.welcome_channel ? `<#${cfg.welcome_channel}>` : '— non configuré'}`,
            `${checkmark(cfg.leave_channel)} Canal de départ ${cfg.leave_channel ? `<#${cfg.leave_channel}>` : '— non configuré'}`,
            `${checkmark(cfg.log_channel)} Logs généraux ${cfg.log_channel ? `<#${cfg.log_channel}>` : '— non configuré'}`,
            `${checkmark(cfg.mod_log_channel)} Logs de modération ${cfg.mod_log_channel ? `<#${cfg.mod_log_channel}>` : '— non configuré'}`,
            `${checkmark(cfg.level_channel)} Canal de niveaux ${cfg.level_channel ? `<#${cfg.level_channel}>` : '— non configuré'}`,
            `${checkmark(cfg.autorole)} Auto-rôle ${cfg.autorole ? `<@&${cfg.autorole}>` : '— non configuré'}`,
            `${checkmark(cfg.mute_role)} Rôle mute ${cfg.mute_role ? `<@&${cfg.mute_role}>` : '— non configuré'}`,
            `${checkmark(cfg.suggestion_channel)} Canal de suggestions ${cfg.suggestion_channel ? `<#${cfg.suggestion_channel}>` : '— non configuré'}`,
          ].join('\n'),
          inline: false
        },
        {
          name: '⚙️ Paramètres',
          value: [
            `🎨 Couleur : **${cfg.color || '#7B2FBE'}**`,
            `💰 Monnaie : **${cfg.currency_emoji || '🪙'} ${cfg.currency_name || 'Coins'}**`,
            `⭐ XP : **${cfg.xp_enabled !== 0 ? 'Activé' : 'Désactivé'}** (×${cfg.xp_multiplier || 1})`,
            `💵 Daily : **${cfg.daily_amount || 200} ${cfg.currency_emoji || '🪙'}**`,
            `🛡️ Automod : **${cfg.automod_enabled ? 'Activé' : 'Désactivé'}**`,
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Utilisez les commandes ci-dessous pour configurer NexusBot' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wizard_commands').setLabel('📋 Liste des commandes').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('wizard_quickstart').setLabel('🚀 Guide de démarrage').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('wizard_done').setLabel('✅ Fermer').setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.reply({ embeds: [statusEmbed], components: [row1], fetchReply: true, ephemeral: true });

    const filter = i => i.user.id === interaction.user.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 120000 });

    collector.on('collect', async (btn) => {
      await btn.deferUpdate();

      if (btn.customId === 'wizard_done') {
        await msg.edit({ components: [] });
        collector.stop();
        return;
      }

      if (btn.customId === 'wizard_commands') {
        const helpEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('📋 Commandes de Configuration')
          .setDescription('Voici les commandes essentielles pour configurer NexusBot :')
          .addFields(
            { name: '⚙️ Setup Principal', value: '`/setup voir` — Voir la config\n`/setup welcome` — Canal de bienvenue\n`/setup leave` — Canal de départ\n`/setup autorole` — Rôle automatique\n`/setup xp` — Paramètres XP\n`/setup couleur` — Couleur des embeds', inline: false },
            { name: '📋 Logs', value: '`/logs setup` — Configurer un canal de log\n`/logs voir` — Voir tous les canaux configurés', inline: false },
            { name: '🛡️ Modération', value: '`/automod activer` — Activer l\'automod\n`/automod antilink` — Bloquer les liens\n`/antinuke activer` — Protection anti-nuke\n`/lockdown salon` — Verrouiller un salon', inline: false },
            { name: '🎭 Niveaux & Rôles', value: '`/levelrole ajouter` — Rôle par niveau\n`/levelrole liste` — Voir les level roles\n`/xpboost set` — Multiplicateur XP', inline: false },
            { name: '💡 Suggestions & Tickets', value: '`/suggestion setup` — Canal de suggestions\n`/ticket setup` — Système de tickets', inline: false },
            { name: '🤖 Personnalisation', value: '`/customcmd ajouter` — Réponse automatique\n`/setup monnaie` — Nom de la monnaie', inline: false },
          )
          .setFooter({ text: 'Toutes les commandes sont en français !' });

        await msg.edit({ embeds: [helpEmbed], components: [row1] });
        return;
      }

      if (btn.customId === 'wizard_quickstart') {
        const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        const channelList = [...channels.values()].slice(0, 5).map(c => `• ${c}`).join('\n') + '\n*...et plus*';

        const quickEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🚀 Guide de Démarrage Rapide')
          .setDescription('Suis ces étapes pour configurer NexusBot en 5 minutes :')
          .addFields(
            { name: '1️⃣ Configurer les canaux', value: '```\n/logs setup type:Logs généraux salon:#logs\n/logs setup type:Logs de modération salon:#mod-logs\n/setup welcome canal:#accueil\n/setup leave canal:#départs```', inline: false },
            { name: '2️⃣ Système de niveaux', value: '```\n/setup levels canal:#levels\n/levelrole ajouter niveau:5 role:@Membre\n/levelrole ajouter niveau:20 role:@Actif\n/levelrole ajouter niveau:50 role:@VIP```', inline: false },
            { name: '3️⃣ Modération automatique', value: '```\n/automod activer\n/antinuke activer```', inline: false },
            { name: '4️⃣ Économie', value: '```\n/setup monnaie nom:Gold emoji:💰\n/setup xp actif:True multiplicateur:1```', inline: false },
            { name: '5️⃣ Fonctionnalités bonus', value: '```\n/suggestion setup canal:#suggestions\n/ticket setup canal-logs:#ticket-logs\n/giveaway créer prix:... durée:24h```', inline: false },
          )
          .setFooter({ text: 'Tape /wizard pour revenir à cet assistant à tout moment !' });

        await msg.edit({ embeds: [quickEmbed], components: [row1] });
      }
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
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
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
