const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

// Migration tables
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mariages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user1_id TEXT, user2_id TEXT,
    married_at TEXT DEFAULT (datetime('now')),
    UNIQUE(guild_id, user1_id), UNIQUE(guild_id, user2_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS propositions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, proposeur_id TEXT, cible_id TEXT, message_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();
} catch {}

module.exports = {
  // data retiré — doublon de src/commands/social/mariage.js (global), accessible globalement
  name: 'mariage',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === 'proposer') {
      const target = interaction.options.getUser('membre');
      if (target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas épouser un bot... 🤖', ephemeral: true });
      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas te marier avec toi-même !', ephemeral: true });

      // Vérifier si déjà marié
      const existingU1 = db.db.prepare('SELECT * FROM mariages WHERE guild_id=? AND (user1_id=? OR user2_id=?)').get(guildId, userId, userId);
      if (existingU1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu es déjà marié(e) ! Divorce d\'abord avec `/mariage divorcer`.', ephemeral: true });

      const existingU2 = db.db.prepare('SELECT * FROM mariages WHERE guild_id=? AND (user1_id=? OR user2_id=?)').get(guildId, target.id, target.id);
      if (existingU2) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> est déjà marié(e) !`, ephemeral: true });

      const accept = new ButtonBuilder().setCustomId(`marry_accept_${userId}_${target.id}`).setLabel('Accepter 💍').setStyle(ButtonStyle.Success);
      const refuse = new ButtonBuilder().setCustomId(`marry_refuse_${userId}_${target.id}`).setLabel('Refuser 💔').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(accept, refuse);

      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('💍 Demande en Mariage !')
        .setDescription(`<@${userId}> fait une demande en mariage à <@${target.id}> ! 🌹\n\n<@${target.id}>, acceptes-tu de te marier ?`)
        .setThumbnail('https://cdn.discordapp.com/emojis/💍')
        .setFooter({ text: 'La demande expire dans 60 secondes' })
        .setTimestamp();

      const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `<@${target.id}>`, embeds: [embed], components: [row], fetchReply: true });

      // Collector
      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== target.id) return i.reply({ content: '❌ Cette demande ne te concerne pas.', ephemeral: true });

        if (i.customId.startsWith('marry_accept_')) {
          try {
            db.db.prepare('INSERT INTO mariages (guild_id, user1_id, user2_id) VALUES (?,?,?)').run(guildId, userId, target.id);
          } catch {
            return i.update({ embeds: [embed.setDescription('❌ Erreur lors du mariage.')], components: [] });
          }
          const successEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🎉 Félicitations !')
            .setDescription(`<@${userId}> et <@${target.id}> sont maintenant **mariés** ! 💍\n\nQue votre union soit longue et heureuse ! 🥂`)
            .setTimestamp();
          await i.update({ embeds: [successEmbed], components: [] });
        } else {
          const refusEmbed = new EmbedBuilder().setColor('Red').setDescription(`💔 <@${target.id}> a refusé la demande en mariage...`);
          await i.update({ embeds: [refusEmbed], components: [] });
        }
        collector.stop();
      });
      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ components: [] }).catch(() => {});
        }
      });
    }

    if (sub === 'divorcer') {
      const mariage = db.db.prepare('SELECT * FROM mariages WHERE guild_id=? AND (user1_id=? OR user2_id=?)').get(guildId, userId, userId);
      if (!mariage) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu n\'es pas marié(e).', ephemeral: true });

      const conjointId = mariage.user1_id === userId ? mariage.user2_id : mariage.user1_id;
      db.db.prepare('DELETE FROM mariages WHERE id=?').run(mariage.id);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Red')
          .setTitle('💔 Divorce prononcé')
          .setDescription(`<@${userId}> et <@${conjointId}> ont divorcé.\nC'est une page qui se tourne...`)
          .setTimestamp()
      ]});
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const mariage = db.db.prepare('SELECT * FROM mariages WHERE guild_id=? AND (user1_id=? OR user2_id=?)').get(guildId, target.id, target.id);

      if (!mariage) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('Grey').setDescription(`💔 <@${target.id}> est célibataire.`)
        ], ephemeral: true });
      }

      const conjointId = mariage.user1_id === target.id ? mariage.user2_id : mariage.user1_id;
      const depuis = mariage.married_at ? `<t:${Math.floor(new Date(mariage.married_at).getTime() / 1000)}:R>` : 'Récemment';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#FF69B4')
          .setTitle('💍 Statut matrimonial')
          .setDescription(`<@${target.id}> est marié(e) avec <@${conjointId}>`)
          .addFields({ name: '📅 Mariés depuis', value: depuis, inline: true })
          .setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'liste') {
      const couples = db.db.prepare('SELECT * FROM mariages WHERE guild_id=? ORDER BY married_at DESC LIMIT 20').all(guildId);
      if (!couples.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun couple sur ce serveur.', ephemeral: true });

      const lines = couples.map((m, i) => `**${i + 1}.** <@${m.user1_id}> 💍 <@${m.user2_id}>`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#FF69B4')
          .setTitle('💑 Couples du serveur')
          .setDescription(lines)
          .setFooter({ text: `${couples.length} couple(s)` })
          .setTimestamp()
      ], ephemeral: true });
    }
  }
};
