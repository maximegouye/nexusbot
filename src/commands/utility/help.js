/**
 * /aide (et /help) — menu d'aide interactif, persisté (handler global).
 * Remplace l'ancien /help.
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const CATALOGUE = require('../../utils/helpCatalogue');
const db = require('../../database/db');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


function buildHomeEmbed(interaction, color) {
  const guild = interaction.guild;
  const cmdCount = interaction.client.commands?.size || 0;
  const prefixCount = (() => {
    try { return require('../../utils/prefixHandler').prefixCommands.size; } catch { return 0; }
  })();

  return new EmbedBuilder()
    .setColor(color)
    .setTitle('📚 NexusBot — Aide')
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setDescription(
      `Bienvenue **${interaction.user.username}** ! Voici toutes les catégories disponibles.\n\n` +
      `• **${cmdCount}** commandes slash \`/\`\n` +
      `• **${prefixCount}** commandes préfixe \`&\`\n` +
      `• **25+** catégories configurables dans \`&config\`\n\n` +
      `Choisis une catégorie dans le menu ci-dessous pour voir les commandes 👇`,
    )
    .addFields(
      ...Object.entries(CATALOGUE)
        .filter(([k]) => k !== 'accueil')
        .slice(0, 9)
        .map(([, c]) => ({ name: c.label, value: c.description, inline: true })),
    )
    .setFooter({ text: `${guild.name} · NexusBot · FR · sans limite · IA intégrée` })
    .setTimestamp();
}

function buildCategoryEmbed(cat, color) {
  const c = CATALOGUE[cat];
  if (!c) return null;
  const lines = (c.commands || []).map(x => x.desc ? `**${x.cmd}** — ${x.desc}` : `**${x.cmd}**`).join('\n');
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(c.label)
    .setDescription(c.description + '\n\n' + (lines || '*Rien pour l\'instant*'))
    .setFooter({ text: 'Tous les textes sont personnalisables via &config → 🗣️ Textes & libellés' })
    .setTimestamp();
}

function buildComponents(userId, currentCat = 'accueil') {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`help_cat:${userId}`)
    .setPlaceholder('📂 Choisir une catégorie…')
    .addOptions(
      Object.entries(CATALOGUE).map(([k, c]) => ({
        label: c.label,
        value: k,
        description: c.description.slice(0, 100),
        default: k === currentCat,
      })).slice(0, 25),
    );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help_home:${userId}`).setLabel('🏠 Accueil').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`help_config:${userId}`).setLabel('⚙️ Ouvrir &config').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setURL('https://discord.gg/Hpyj7QHqvv').setLabel('🤝 Zone Entraide').setStyle(ButtonStyle.Link),
  );

  return [new ActionRowBuilder().addComponents(select), row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aide')
    .setDescription('📚 Aide interactive de NexusBot (toutes les catégories)'),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    const cfg = db.getConfig(interaction.guildId);
    const color = cfg.color || '#7B2FBE';
    return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [buildHomeEmbed(interaction, color)],
      components: buildComponents(interaction.user.id, 'accueil'),
    });
  },


  async handleComponent(interaction, cid) {
    if (!cid.startsWith('help_')) return false;
    const userId = cid.split(':')[1];
    const cfg   = db.getConfig(interaction.guildId);
    const color = cfg.color || '#7B2FBE';

    if (cid.startsWith('help_home:')) {
      await interaction.update({
        embeds:     [buildHomeEmbed(interaction, color)],
        components: buildComponents(userId, 'accueil'),
      });
      return true;
    }
    if (cid.startsWith('help_config:')) {
      await interaction.editReply({ content: '⚙️ Tape **`&config`** dans le chat pour ouvrir le panneau de configuration !', ephemeral: true });
      return true;
    }
    if (cid.startsWith('help_cat:') && interaction.isStringSelectMenu()) {
      const cat   = interaction.values[0];
      const embed = buildCategoryEmbed(cat, color);
      await interaction.update({
        embeds:     [embed || buildHomeEmbed(interaction, color)],
        components: buildComponents(userId, cat),
      });
      return true;
    }
    return false;
  },
  // Exports utilitaires pour le handler global
  _build: { buildHomeEmbed, buildCategoryEmbed, buildComponents, CATALOGUE },

  name: 'aide2',
  aliases: ['help2', 'menu'],
  async run(message, args) {
    const fake = mkFake(message, {});
    await this.execute(fake);
  },
};
;
