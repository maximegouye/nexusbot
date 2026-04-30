// treasure-hunt.js — 🏴‍☠️ Treasure Hunt : choisis parmi 9 coffres mystères
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { applyRtp, capWin } = require('../../utils/realCasinoEngine');

// 9 coffres : 1 piège (perd tout), 4 petits, 3 moyens, 1 gros
// Distribution attendue : RTP ~95%
//   - 1 piège (×0)     : 11.1%
//   - 4 petits (×0.5)  : 44.4% → contribue 22.2%
//   - 3 moyens (×2)    : 33.3% → contribue 66.6%
//   - 1 gros (×5)      : 11.1% → contribue 55.5%
//   - + chance jackpot rare ×100
// Total : ~144% sans cap = on cape avec RTP

function generateChests() {
  const chests = [
    { mult: 0,    label: '💣 Piège', emoji: '💣' },
    { mult: 0.5,  label: '×0.5',   emoji: '🥉' },
    { mult: 0.5,  label: '×0.5',   emoji: '🥉' },
    { mult: 0.5,  label: '×0.5',   emoji: '🥉' },
    { mult: 0.5,  label: '×0.5',   emoji: '🥉' },
    { mult: 2,    label: '×2',     emoji: '🥈' },
    { mult: 2,    label: '×2',     emoji: '🥈' },
    { mult: 2,    label: '×2',     emoji: '🥈' },
    { mult: 5,    label: '×5 GROS',emoji: '🥇' },
  ];
  // 0.5% chance que le ×5 devienne ×100 (jackpot)
  if (Math.random() < 0.005) chests[8] = { mult: 100, label: '×100 JACKPOT', emoji: '💎' };

  // Mélange Fisher-Yates
  for (let i = chests.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chests[i], chests[j]] = [chests[j], chests[i]];
  }
  return chests;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('treasure-hunt')
    .setDescription('🏴‍☠️ Treasure Hunt — choisis 1 coffre parmi 9 (1 piège, 1 jackpot caché)')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 200)').setMinValue(200).setMaxValue(500000).setRequired(true)),
  cooldown: 6,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    try {
      const mise = interaction.options.getInteger('mise');
      const cfg  = db.getConfig(interaction.guildId);
      const emoji= cfg.currency_emoji || '€';
      const u    = db.getUser(interaction.user.id, interaction.guildId);

      if (u.balance < mise) {
        return interaction.editReply({ content: `❌ Tu as besoin de ${mise.toLocaleString('fr')} ${emoji}.` });
      }

      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      const chests = generateChests();
      const userId = interaction.user.id;

      // Affiche les 9 coffres fermés
      const buildRows = (revealed = -1) => {
        const rows = [];
        for (let r = 0; r < 3; r++) {
          const row = new ActionRowBuilder();
          for (let c = 0; c < 3; c++) {
            const idx = r * 3 + c;
            const isRevealed = idx === revealed;
            row.addComponents(new ButtonBuilder()
              .setCustomId(`treasure_${userId}_${idx}_${Date.now()}`)
              .setLabel(isRevealed ? chests[idx].label : `Coffre ${idx + 1}`)
              .setEmoji(isRevealed ? chests[idx].emoji : '🎁')
              .setStyle(isRevealed ? (chests[idx].mult > 0 ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Primary)
              .setDisabled(revealed !== -1)
            );
          }
          rows.push(row);
        }
        return rows;
      };

      const initialEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏴‍☠️ ・ Treasure Hunt ・ Choisis ton coffre')
        .setDescription(`Tu as misé **${mise.toLocaleString('fr')} ${emoji}**.\n9 coffres : **1 piège** (perds tout), **4 petits** (×0.5), **3 moyens** (×2), **1 gros** (×5).\n\n⏰ Tu as 30 secondes.`)
        .setFooter({ text: '0.5% de chance que le coffre ×5 soit en réalité un JACKPOT ×100 !' });

      const reply = await interaction.editReply({ embeds: [initialEmbed], components: buildRows(-1) });

      const collector = reply.createMessageComponentCollector({
        filter: i => i.user.id === userId && i.customId.startsWith(`treasure_${userId}_`),
        time: 30_000, max: 1,
      });

      collector.on('collect', async (btn) => {
        const idx = parseInt(btn.customId.split('_')[2], 10);
        const chest = chests[idx];
        let win = Math.floor(mise * chest.mult);
        win = applyRtp('treasure-hunt', mise, win);
        win = capWin('treasure-hunt', mise, win);

        if (win > 0) db.addCoins(interaction.user.id, interaction.guildId, win);

        const profit = win - mise;
        const isJackpot = chest.mult >= 100;
        const isWin = chest.mult > 0;

        const color = isJackpot ? '#FFD700' : isWin ? '#2ECC71' : '#E74C3C';
        const titleEmoji = isJackpot ? '💎' : isWin ? '✅' : '💣';
        const title = isJackpot ? 'JACKPOT ×100 !' : isWin ? `Trouvé ${chest.label}` : 'PIÈGE !';

        const e = new EmbedBuilder()
          .setColor(color)
          .setTitle(`${titleEmoji} ・ Treasure Hunt ・ ${title}`)
          .setDescription(`Tu as ouvert le **coffre ${idx + 1}** : ${chest.emoji} ${chest.label}`)
          .addFields(
            { name: '💰 Mise',  value: `${mise.toLocaleString('fr')} ${emoji}`, inline: true },
            { name: '🎯 Multi', value: `**×${chest.mult}**`, inline: true },
            { name: '💵 Gain',  value: `${win.toLocaleString('fr')} ${emoji} (${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr')})`, inline: true },
          )
          .setFooter({ text: 'Relance avec /treasure-hunt mise:X' });

        await btn.update({ embeds: [e], components: buildRows(idx) }).catch(() => {});
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({ embeds: [new EmbedBuilder()
            .setColor('#95A5A6')
            .setTitle('⏰ Trop tard !')
            .setDescription(`Tu n'as pas choisi à temps. Mise de ${mise.toLocaleString('fr')} ${emoji} perdue.`)
          ], components: buildRows(-1).map(r => { r.components.forEach(c => c.setDisabled(true)); return r; }) }).catch(() => {});
        }
      });

    } catch (err) {
      console.error('[CMD treasure-hunt]', err);
      await interaction.editReply({ content: `❌ Erreur : ${err?.message || err}` }).catch(() => {});
    }
  }
};
