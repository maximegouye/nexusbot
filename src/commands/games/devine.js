const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeGames = new Map(); // userId:guildId → game state

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devine')
    .setDescription('🔮 Devine un nombre entre 1 et 100 en moins de 7 essais !'),
  cooldown: 10,

  async execute(interaction) {
    const key = `${interaction.user.id}:${interaction.guildId}`;
    if (activeGames.has(key)) {
      return interaction.reply({ content: '⏳ Tu as déjà une partie en cours ! Termine-la d\'abord.', ephemeral: true });
    }

    const secret  = Math.floor(Math.random() * 100) + 1;
    const maxTries = 7;

    activeGames.set(key, { secret, tries: 0, maxTries });

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🔮 Devine le Nombre !')
      .setDescription(`J'ai choisi un nombre entre **1** et **100**.\nTu as **${maxTries} essais** pour le trouver !\n\n**Réponds avec un nombre dans ce salon.**`)
      .setFooter({ text: `Essais : 0/${maxTries}` });

    await interaction.reply({ embeds: [embed] });

    // Collector de messages
    const filter  = m => m.author.id === interaction.user.id && !isNaN(parseInt(m.content.trim()));
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000 });

    collector.on('collect', async (msg) => {
      const game  = activeGames.get(key);
      if (!game) return collector.stop();
      game.tries++;
      const guess = parseInt(msg.content.trim());
      let responseEmbed;

      if (guess === game.secret) {
        activeGames.delete(key);
        collector.stop('won');
        responseEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🎉 Bravo ! Tu as trouvé !')
          .setDescription(`C'était bien **${game.secret}** ! Trouvé en **${game.tries} essai${game.tries > 1 ? 's' : ''}** !`)
          .setFooter({ text: game.tries <= 3 ? '🏆 Incroyable !' : game.tries <= 5 ? '👍 Bien joué !' : '😅 Ouf, c\'était juste !' });
      } else if (game.tries >= game.maxTries) {
        activeGames.delete(key);
        collector.stop('lost');
        responseEmbed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Perdu !')
          .setDescription(`Tu as épuisé tes **${game.maxTries} essais** !\nC'était **${game.secret}**. Meilleure chance la prochaine fois !`);
      } else {
        const hint    = guess < game.secret ? '📈 C\'est **plus** !' : '📉 C\'est **moins** !';
        const left    = game.maxTries - game.tries;
        responseEmbed = new EmbedBuilder()
          .setColor('#F39C12')
          .setDescription(`${hint} Il te reste **${left} essai${left > 1 ? 's' : ''}**.`)
          .setFooter({ text: `Essais : ${game.tries}/${game.maxTries}` });
      }

      await msg.reply({ embeds: [responseEmbed] }).catch(() => {});
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        activeGames.delete(key);
        const game = activeGames.get(key);
        interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor('#888888')
            .setDescription(`⏰ <@${interaction.user.id}> Temps écoulé ! C'était **${activeGames.get(key)?.secret || '???'}**.`)
          ]
        }).catch(() => {});
        activeGames.delete(key);
      }
    });
  }
};
