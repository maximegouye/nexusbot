const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const CHOICES = {
  rock:     { label: '🪨 Pierre',   beats: 'scissors', emoji: '🪨' },
  scissors: { label: '✂️ Ciseaux',  beats: 'paper',    emoji: '✂️' },
  paper:    { label: '📄 Feuille',  beats: 'rock',     emoji: '📄' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('🪨 Pierre-Feuille-Ciseaux contre le bot ou un ami !')
    .addUserOption(o => o.setName('adversaire').setDescription('Défier un membre (optionnel)').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    try {
    const opponent = interaction.options.getUser('adversaire');
    const cfg      = db.getConfig(interaction.guildId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Pierre').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Feuille').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Ciseaux').setStyle(ButtonStyle.Secondary),
    );

    // ── vs Bot ──
    if (!opponent || opponent.bot) {
      const msg = await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#7B2FBE')
          .setTitle('🪨 Pierre-Feuille-Ciseaux')
          .setDescription('Choisis ton arme !')
        ],
        components: [row],
        fetchReply: true,
      });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

      collector.on('collect', async i => {
        const playerKey = i.customId.replace('rps_', '');
        const botKey    = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];
        const player    = CHOICES[playerKey];
        const bot       = CHOICES[botKey];

        let result, color;
        if (playerKey === botKey) {
          result = '🤝 Égalité !'; color = '#FFA500';
        } else if (player.beats === botKey) {
          result = '🎉 Tu as gagné !'; color = '#2ECC71';
        } else {
          result = '😭 Tu as perdu !'; color = '#FF6B6B';
        }

        await i.update({
          embeds: [new EmbedBuilder()
            .setColor(color)
            .setTitle(`🪨 Pierre-Feuille-Ciseaux — ${result}`)
            .addFields(
              { name: `${interaction.user.username}`, value: player.label, inline: true },
              { name: 'VS 🤖 NexusBot',              value: bot.label,    inline: true },
            )
          ],
          components: []
        });
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    if (opponent.id === interaction.user.id) return interaction.editReply({ content: '❌ Tu ne peux pas jouer contre toi-même.', ephemeral: true });

    // ── vs Joueur ──
    const choices = {};
    const msg = await interaction.editReply({
      content: `${opponent}, **${interaction.user.username}** te défie à Pierre-Feuille-Ciseaux ! Choisis ton arme !`,
      embeds: [new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(`⚔️ ${interaction.user.username} vs ${opponent.username}`)
        .setDescription('Les deux joueurs doivent choisir !')
      ],
      components: [row],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => [interaction.user.id, opponent.id].includes(i.user.id),
      time: 60000,
    });

    collector.on('collect', async i => {
      const key = i.customId.replace('rps_', '');
      choices[i.user.id] = key;
      await i.reply({ content: `✅ Tu as choisi ${CHOICES[key].emoji} !`, ephemeral: true });

      if (Object.keys(choices).length === 2) collector.stop('done');
    });

    collector.on('end', async (_, reason) => {
      if (reason !== 'done') {
        return msg.edit({ content: '⏱️ Temps écoulé.', components: [] }).catch(() => {});
      }

      const pKey = choices[interaction.user.id];
      const oKey = choices[opponent.id];
      const p    = CHOICES[pKey];
      const o    = CHOICES[oKey];

      let result, color;
      if (pKey === oKey) {
        result = '🤝 Égalité !'; color = '#FFA500';
      } else if (p.beats === oKey) {
        result = `🎉 **${interaction.user.username}** gagne !`; color = '#2ECC71';
      } else {
        result = `🎉 **${opponent.username}** gagne !`; color = '#2ECC71';
      }

      await msg.edit({
        content: '',
        embeds: [new EmbedBuilder()
          .setColor(color)
          .setTitle(`⚔️ Résultat — ${result}`)
          .addFields(
            { name: interaction.user.username, value: p.label, inline: true },
            { name: 'VS',                      value: '⚔️',    inline: true },
            { name: opponent.username,         value: o.label, inline: true },
          )
        ],
        components: []
      });
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
