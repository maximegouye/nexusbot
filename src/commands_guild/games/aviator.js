// aviator.js — ✈️ Aviator : courbe qui monte, cash out avant le crash
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { applyRtp, capWin } = require('../../utils/realCasinoEngine');

// RTP réel d'Aviator (Spribe) ≈ 97% — on cible 95% pour favoriser le casino légèrement
const RTP = 0.95;

// Distribution du multiplier au crash (réaliste, queue lourde) :
// 50% < 1.5x, 30% < 3x, 15% < 10x, 4% < 50x, 1% < 1000x
function generateCrashMultiplier() {
  const r = Math.random();
  if (r < 0.50) return 1.0 + Math.random() * 0.5;          // 1.0 - 1.5x
  if (r < 0.80) return 1.5 + Math.random() * 1.5;          // 1.5 - 3x
  if (r < 0.95) return 3.0 + Math.random() * 7.0;          // 3 - 10x
  if (r < 0.99) return 10.0 + Math.random() * 40.0;        // 10 - 50x
  if (r < 0.999) return 50.0 + Math.random() * 100.0;      // 50 - 150x
  return 150.0 + Math.random() * 850.0;                    // 150 - 1000x (jackpot)
}

const games = new Map(); // userId -> { mise, multiplier, ticking, channelId }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aviator')
    .setDescription('✈️ Aviator — l\'avion monte, retire-toi avant le crash !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 100)').setMinValue(100).setMaxValue(1000000).setRequired(true)),
  cooldown: 4,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    try {
      const mise = interaction.options.getInteger('mise');
      const cfg  = db.getConfig(interaction.guildId);
      const emoji= cfg.currency_emoji || '€';
      const name = cfg.currency_name  || 'Euros';
      const user = db.getUser(interaction.user.id, interaction.guildId);

      if (user.balance < mise) {
        return interaction.editReply({ content: `❌ Tu n'as pas assez. Tu as ${user.balance.toLocaleString('fr')} ${emoji}.` });
      }

      // Game déjà en cours
      if (games.has(interaction.user.id)) {
        return interaction.editReply({ content: '✈️ Tu as déjà un avion en l\'air ! Retire-toi du précédent.' });
      }

      // Retire la mise
      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      // Génère le crash multiplier en avance
      const crashAt = generateCrashMultiplier();
      const startTime = Date.now();
      games.set(interaction.user.id, { mise, multiplier: 1.0, crashAt, ticking: true });

      const renderEmbed = (mult, status = 'flying') => {
        const altitude = Math.min(20, Math.floor((mult - 1) * 4));
        const sky = '\n'.repeat(Math.max(0, 8 - altitude));
        const plane = '✈️';
        const trail = '・'.repeat(Math.min(10, altitude));
        const grass = '・'.repeat(20);

        const color = status === 'crashed' ? '#E74C3C' : status === 'cashed' ? '#2ECC71' : '#F39C12';
        const titleEmoji = status === 'crashed' ? '💥' : status === 'cashed' ? '✅' : '✈️';
        const title = status === 'crashed' ? 'CRASH !' : status === 'cashed' ? 'CASH OUT !' : 'En vol...';

        const e = new EmbedBuilder()
          .setColor(color)
          .setTitle(`${titleEmoji} ・ Aviator ・ ${title}`)
          .setDescription(`\`\`\`\n${sky}${' '.repeat(20 - trail.length)}${plane}\n${' '.repeat(20 - trail.length)}${trail}\n${grass}\n\`\`\``)
          .addFields(
            { name: '📈 Multiplier', value: `**×${mult.toFixed(2)}**`, inline: true },
            { name: '💰 Mise',       value: `${mise.toLocaleString('fr')} ${emoji}`, inline: true },
            { name: '💵 Cash out',   value: `${Math.floor(mise * mult).toLocaleString('fr')} ${emoji}`, inline: true },
          );
        if (status === 'crashed') {
          e.setFooter({ text: `💥 Crashé à ×${crashAt.toFixed(2)}. Tu as perdu ta mise.` });
        } else if (status === 'cashed') {
          const won = Math.floor(mise * mult);
          e.setFooter({ text: `Tu as encaissé ${won.toLocaleString('fr')} ${name} (×${mult.toFixed(2)}) !` });
        } else {
          e.setFooter({ text: 'Clique CASH OUT avant le crash !' });
        }
        return e;
      };

      const button = (active = true) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`aviator_cashout_${interaction.user.id}_${startTime}`)
          .setLabel('💵 CASH OUT')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!active),
      );

      let mult = 1.0;
      const replyMsg = await interaction.editReply({ embeds: [renderEmbed(mult)], components: [button(true)] });

      // Boucle : multiplier monte de manière exponentielle
      const tick = async () => {
        const game = games.get(interaction.user.id);
        if (!game || !game.ticking) return;
        const elapsed = (Date.now() - startTime) / 1000;
        // Courbe exponentielle réaliste
        mult = Math.exp(elapsed * 0.18);
        game.multiplier = mult;

        if (mult >= crashAt) {
          // CRASH !
          game.ticking = false;
          games.delete(interaction.user.id);
          await interaction.editReply({ embeds: [renderEmbed(crashAt, 'crashed')], components: [button(false)] }).catch(() => {});
          return;
        }

        // Update toutes les ~700ms pour pas spammer Discord
        await interaction.editReply({ embeds: [renderEmbed(mult)], components: [button(true)] }).catch(() => {});
        setTimeout(tick, 700);
      };
      setTimeout(tick, 700);

      // Collector pour le bouton CASH OUT
      const collector = replyMsg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith(`aviator_cashout_${interaction.user.id}`),
        time: 60_000, max: 1,
      });

      collector.on('collect', async (btn) => {
        const game = games.get(interaction.user.id);
        if (!game || !game.ticking) {
          await btn.reply({ content: '⏰ Trop tard, l\'avion a crashé !', ephemeral: true }).catch(() => {});
          return;
        }
        game.ticking = false;
        const finalMult = game.multiplier;
        let won = Math.floor(mise * finalMult);
        won = applyRtp('aviator', mise, won);
        won = capWin('aviator', mise, won);

        db.addCoins(interaction.user.id, interaction.guildId, won);
        games.delete(interaction.user.id);

        await btn.update({ embeds: [renderEmbed(finalMult, 'cashed')], components: [button(false)] }).catch(() => {});
      });

      collector.on('end', () => {
        const game = games.get(interaction.user.id);
        if (game?.ticking) {
          game.ticking = false;
          games.delete(interaction.user.id);
        }
      });

    } catch (err) {
      console.error('[CMD aviator]', err);
      try {
        await interaction.editReply({ content: `❌ Erreur : ${err?.message || err}` });
      } catch {}
    }
  }
};
