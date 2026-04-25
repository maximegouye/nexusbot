// ============================================================
// bumpDetector.js — Rappel automatique DISBOARD toutes les 2h
// Détecte le message de confirmation, attend 2h, envoie un
// rappel avec bouton dans le même salon.
// ============================================================
'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DISBOARD_ID    = '302050872383242240'; // ID officiel du bot DISBOARD
const BUMP_COOLDOWN  = 2 * 60 * 60 * 1000;  // 2 heures en ms

// Timer actif par guild
const bumpTimers  = new Map(); // guildId → Timeout
const bumpChannel = new Map(); // guildId → channelId
const bumpWho     = new Map(); // guildId → userId (qui a bumpé)

// ── Détection du message de confirmation DISBOARD ─────────
function isDisboardBumpConfirm(message) {
  if (message.author.id !== DISBOARD_ID) return false;
  // DISBOARD envoie un embed avec « bump » dans la description ou le titre
  for (const embed of message.embeds) {
    const text = [
      embed.description || '',
      embed.title       || '',
      ...(embed.fields || []).map(f => f.value + f.name),
    ].join(' ').toLowerCase();

    if (
      text.includes('bump') &&
      (text.includes('2 hours') || text.includes('2 heures') ||
       text.includes('done') || text.includes('effectué') ||
       text.includes('successfully') || text.includes('next bump'))
    ) {
      return true;
    }
  }
  // Parfois DISBOARD répond sans embed (message texte)
  const content = (message.content || '').toLowerCase();
  return content.includes('bump') && (content.includes('done') || content.includes('next'));
}

// ── Envoi du rappel ───────────────────────────────────────
async function sendBumpReminder(client, guildId) {
  const channelId = bumpChannel.get(guildId);
  const userId    = bumpWho.get(guildId);
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const icon  = guild?.iconURL({ dynamic: true }) ?? null;

    const embed = new EmbedBuilder()
      .setColor('#24B7B7')
      .setTitle('⏰ Il est temps de bumper !')
      .setDescription(
        `**2 heures se sont écoulées** depuis le dernier bump.\n\n` +
        `Tape \`/bump\` dans ce salon pour remonter le serveur sur **DISBOARD** et attirer de nouveaux membres !\n\n` +
        `> 💡 Plus vous bumpez régulièrement, plus vous êtes visibles.`
      )
      .addFields(
        { name: '🔔 Dernier bump par', value: userId ? `<@${userId}>` : 'Inconnu', inline: true },
        { name: '⏳ Prochain bump', value: 'Maintenant !', inline: true },
      )
      .setFooter({ text: 'NexusBot • Bump Reminder', iconURL: icon ?? undefined })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bump_remind_${guildId}`)
        .setLabel('📋 Comment bumper ?')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Ouvrir DISBOARD')
        .setStyle(ButtonStyle.Link)
        .setURL('https://disboard.org'),
    );

    await channel.send({
      content: userId ? `<@${userId}> 🔔 **Rappel de bump !**` : '🔔 **Rappel de bump !**',
      embeds: [embed],
      components: [row],
      allowedMentions: { users: userId ? [userId] : [] },
    });
  } catch (e) {
    console.error('[BumpReminder] Erreur envoi rappel:', e.message);
  } finally {
    bumpTimers.delete(guildId);
  }
}

// ── Gestion du bouton « Comment bumper ? » ────────────────
async function handleBumpButton(interaction) {
  if (!interaction.customId?.startsWith('bump_remind_')) return false;

  await interaction.reply({
    content: [
      '**📋 Comment bumper votre serveur ?**',
      '',
      '1️⃣ Tape `/bump` dans n\'importe quel salon',
      '2️⃣ Sélectionne la commande **DISBOARD** `/bump`',
      '3️⃣ Appuie sur **Entrée** — c\'est tout !',
      '',
      '⏰ Tu peux rebumper toutes les **2 heures**.',
      '💡 NexusBot te rappellera automatiquement à chaque fois.',
    ].join('\n'),
    ephemeral: true,
  }).catch(() => {});

  return true;
}

// ── Module principal ──────────────────────────────────────
module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    // ── 1. Détection bump DISBOARD ─────────────────────────
    if (message.author.id === DISBOARD_ID && message.guild) {
      if (isDisboardBumpConfirm(message)) {
        const guildId   = message.guild.id;
        const channelId = message.channel.id;

        // Chercher qui a utilisé /bump (le message référencé ou le message juste avant)
        let bumperId = null;
        try {
          if (message.reference) {
            const ref = await message.channel.messages
              .fetch(message.reference.messageId)
              .catch(() => null);
            if (ref) bumperId = ref.author?.id ?? null;
          }
          if (!bumperId) {
            // Chercher le dernier message humain dans le canal
            const recent = await message.channel.messages.fetch({ limit: 10 }).catch(() => null);
            if (recent) {
              const human = recent.find(m => !m.author.bot && m.id !== message.id);
              if (human) bumperId = human.author.id;
            }
          }
        } catch (_) {}

        // Annuler timer précédent si déjà actif
        if (bumpTimers.has(guildId)) clearTimeout(bumpTimers.get(guildId));

        bumpChannel.set(guildId, channelId);
        if (bumperId) bumpWho.set(guildId, bumperId);

        // Confirmer la détection (message éphémère-style dans le canal)
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#2ECC71')
              .setDescription(`✅ **Bump enregistré !** Je vous rappellerai dans **2 heures** pour rebumper. 🔔`)
              .setFooter({ text: 'NexusBot • Bump Reminder' }),
          ],
        }).catch(() => {});

        // Démarrer le timer 2h
        const timer = setTimeout(
          () => sendBumpReminder(client, guildId),
          BUMP_COOLDOWN,
        );
        bumpTimers.set(guildId, timer);

        console.log(`[BumpReminder] Bump détecté sur ${message.guild.name} — rappel dans 2h`);
      }
    }
  },

  // Exposé pour interactionCreate via handleComponent
  async handleComponent(interaction) {
    return handleBumpButton(interaction);
  },

  // Accès aux timers pour debug (optionnel)
  bumpTimers,
  bumpChannel,
};
