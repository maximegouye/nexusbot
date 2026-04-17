const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function trackMission(userId, guildId, type, amount = 1) {
  try { require('../../commands_guild/unique/missions').progressMission(userId, guildId, type, amount); } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 Récupère ta récompense quotidienne (bonus de streak !)'),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';

    const now       = Math.floor(Date.now() / 1000);
    const lastDaily = user.last_daily || 0;
    const cooldown  = 86400; // 24h

    if (now - lastDaily < cooldown) {
      const remaining = cooldown - (now - lastDaily);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⏳ Déjà récupéré !')
          .setDescription(`Reviens dans **${h}h ${m}min** pour ton prochain daily.`)
          .setFooter({ text: '🔥 Reviens chaque jour pour maintenir ton streak !' })
        ], ephemeral: true
      });
    }

    // Calcul du streak (fenêtre de 48h pour ne pas pénaliser)
    const wasYesterday = lastDaily > 0 && (now - lastDaily) < (cooldown * 2);
    const newStreak    = wasYesterday ? (user.streak || 0) + 1 : 1;

    // Récompenses en €
    const base   = cfg.daily_amount || 25;
    const streakBonus = Math.min(newStreak - 1, 30) * 2; // +2€/jour, max +60€
    const milestones = { 7: 50, 14: 100, 30: 250, 60: 500, 100: 1000 };
    const milestone  = milestones[newStreak] || 0;
    const total      = base + streakBonus + milestone;

    db.addCoins(interaction.user.id, interaction.guildId, total);
    db.db.prepare('UPDATE users SET last_daily = ?, streak = ? WHERE user_id = ? AND guild_id = ?')
      .run(now, newStreak, interaction.user.id, interaction.guildId);

    trackMission(interaction.user.id, interaction.guildId, 'daily');
    trackMission(interaction.user.id, interaction.guildId, 'earn_coins', total);

    let specialMsg = '';
    if (newStreak === 7)   specialMsg = '\n🎖️ **1 semaine de streak !** Bonus de 50€ !';
    if (newStreak === 14)  specialMsg = '\n🥇 **2 semaines !** Bonus de 100€ !';
    if (newStreak === 30)  specialMsg = '\n🏆 **1 mois de streak !** Incroyable ! Bonus de 250€ !';
    if (newStreak === 100) specialMsg = '\n💎 **100 jours !!** Légendaire ! Bonus de 1 000€ !';

    const flames = '🔥'.repeat(Math.min(newStreak, 7));

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`${symbol} Daily récupéré !`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setDescription(`Tu as reçu **${total.toLocaleString('fr')}${symbol}** !${specialMsg}`)
      .addFields(
        { name: `${symbol} Base`,          value: `**+${base}${symbol}**`,                 inline: true },
        { name: '🔥 Bonus streak',         value: `**+${streakBonus}${symbol}**`,           inline: true },
        ...(milestone ? [{ name: '🎉 Milestone', value: `**+${milestone}${symbol}**`,      inline: true }] : []),
        { name: `${flames} Streak`,        value: `**${newStreak} jour${newStreak > 1 ? 's' : ''}** consécutif${newStreak > 1 ? 's' : ''}`, inline: true },
        { name: `${symbol} Nouveau solde`, value: `**${(user.balance + total).toLocaleString('fr')}${symbol}**`, inline: true },
      )
      .setFooter({ text: 'Reviens demain pour maintenir ton streak !' });

    await interaction.reply({ embeds: [embed] });
  }
};
