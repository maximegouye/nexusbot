'use strict';
// ============================================================
// setup-topics.js — Met à jour les descriptions de tous les canaux
// Usage : /setup-topics (admin uniquement)
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const CHANNEL_TOPICS = {
  'changelog':      '📋 Dernières mises à jour du serveur et de NexusBot — lis avant de poser des questions !',
  'info-serveur':   'ℹ️ Règles, informations importantes et présentation du serveur — lecture obligatoire',
  'roadmap':        '🗺️ Ce qui arrive bientôt — Fonctionnalités à venir pour le serveur et NexusBot',
  'partenariats':   '🌐 Nos partenaires officiels — Pour proposer un partenariat : /partenariat',
  'giveaways':      '🎁 Giveaways actifs — Réagis pour participer ! Crée le tien avec /giveaway',
  'événements':     '🎉 Événements, concours et animations — reste actif pour ne rien rater !',
  'ticket':         '🎫 Besoin d\'aide ? Ouvre un ticket avec /ticket — réponse sous 24h',
  'bump':           '🔔 Aide-nous à grandir ! Bumpez avec /bump — récompenses automatiques à la clé',
  'général':        '💬 Discussion générale — Bienvenue ! Présente-toi et discute avec la communauté',
  'commandes':      '🤖 Espace dédié aux commandes — NexusBot, Carl-bot, DISBOARD et plus',
  'mèmes':          '😂 Partage tes meilleurs mèmes — humour bienvenu, contenu choquant interdit',
  'médias':         '📸 Photos, vidéos, clips et créations — montre-nous ce que tu as !',
  'off-topic':      '🌐 Discussion hors-sujet — tout est permis dans le respect des règles',
  'idées':          '💡 Suggère des améliorations pour le serveur — les meilleures idées sont appliquées !',
  'candidatures':   '📋 Postule pour rejoindre l\'équipe staff — remplis le formulaire avec soin',
  'économie':       '💰 Gère ton argent, travaille et fais-toi une fortune — /daily /work /aide',
  'classement':     '🏆 Top joueurs — meilleur XP, meilleur solde, meilleures stats — /classement',
  'récompenses':    '🎁 Tes missions, récompenses quotidiennes et cadeaux — /missions /daily',
  'boutique':       '🛍️ Dépense tes coins — items exclusifs, rôles premium et avantages — /shop',
  'casino':         '🎰 Zone casino — 15+ jeux : /slots /blackjack /crash /hippodrome et bien plus !',
};

module.exports = {
  name: 'setup-topics',
  data: new SlashCommandBuilder()
    .setName('setup-topics')
    .setDescription('🔧 Met à jour les descriptions de tous les canaux (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild    = interaction.guild;
    const channels = guild.channels.cache.filter(c => c.type === 0);
    const results  = { updated: [], skipped: [], failed: [] };

    for (const [, channel] of channels) {
      const topic = CHANNEL_TOPICS[channel.name] ||
        Object.entries(CHANNEL_TOPICS).find(([k]) => channel.name.includes(k))?.[1];

      if (!topic) {
        results.skipped.push(`#${channel.name}`);
        continue;
      }

      if (channel.topic === topic) {
        results.skipped.push(`#${channel.name} (déjà à jour)`);
        continue;
      }

      const ok = await channel.setTopic(topic, 'NexusBot — /setup-topics').catch(() => null);
      if (ok) {
        results.updated.push(`#${channel.name}`);
      } else {
        results.failed.push(`#${channel.name}`);
      }

      await new Promise(r => setTimeout(r, 600)); // Rate limit safety
    }

    const embed = new EmbedBuilder()
      .setColor(results.failed.length > 0 ? '#E74C3C' : '#27AE60')
      .setTitle('🔧 Mise à jour des descriptions de canaux')
      .addFields(
        {
          name: `✅ Mis à jour (${results.updated.length})`,
          value: results.updated.length > 0 ? results.updated.join(', ') : 'Aucun',
          inline: false,
        },
        {
          name: `⏭️ Ignorés (${results.skipped.length})`,
          value: results.skipped.length > 0 ? results.skipped.slice(0, 10).join(', ') + (results.skipped.length > 10 ? '...' : '') : 'Aucun',
          inline: false,
        },
        ...(results.failed.length > 0 ? [{
          name: `❌ Échecs (${results.failed.length})`,
          value: results.failed.join(', '),
          inline: false,
        }] : []),
      )
      .setFooter({ text: 'NexusBot — Admin Setup' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
