const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function trackMission(userId, guildId, type, amount = 1) {
  try { require('../../commands_guild/unique/missions').progressMission(userId, guildId, type, amount); } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 Récupère ta récompense quotidienne (bonus de fidélité croissant)'),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';

    const now       = Math.floor(Date.now() / 1000);
    const lastDaily = user.last_daily || 0;
    const cooldown  = cfg.daily_cooldown > 0 ? cfg.daily_cooldown : 86400; // panel-configurable

    if (now - lastDaily < cooldown) {
      const remaining = cooldown - (now - lastDaily);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⏳ Récompense déjà récupérée')
          .setDescription(`Reviens dans **${h} h ${m} min** pour ta prochaine récompense quotidienne.`)
          .setFooter({ text: '🔥 Passe chaque jour pour conserver ta série de récompenses !' })
        ], ephemeral: true
      });
    }

    // Calcul du streak (fenêtre de 48h pour ne pas pénaliser)
    const wasYesterday = lastDaily > 0 && (now - lastDaily) < (cooldown * 2);
    const newStreak    = wasYesterday ? (user.streak || 0) + 1 : 1;

    // Récompenses — tout est panel-configurable via &config → ⚡ Économie pro
    const base         = cfg.daily_amount || 25;
    const streakPct    = Math.max(0, cfg.daily_streak_bonus ?? 10); // % par jour de streak
    const streakBonus  = Math.min(newStreak - 1, 60) * Math.max(1, Math.floor(base * streakPct / 100));
    const milestones   = { 7: base * 2, 14: base * 4, 30: base * 10, 60: base * 20, 100: base * 40 };
    const milestone    = milestones[newStreak] || 0;
    const total        = base + streakBonus + milestone;

    db.addCoins(interaction.user.id, interaction.guildId, total);
    db.db.prepare('UPDATE users SET last_daily = ?, streak = ? WHERE user_id = ? AND guild_id = ?')
      .run(now, newStreak, interaction.user.id, interaction.guildId);

    trackMission(interaction.user.id, interaction.guildId, 'daily');
    trackMission(interaction.user.id, interaction.guildId, 'earn_coins', total);

    let specialMsg = '';
    if (newStreak === 7)   specialMsg = `\n🎖️ **1 semaine de fidélité !** Bonus exceptionnel de ${milestones[7].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 14)  specialMsg = `\n🥇 **2 semaines de fidélité !** Bonus exceptionnel de ${milestones[14].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 30)  specialMsg = `\n🏆 **1 mois de fidélité !** Incroyable ! Bonus de ${milestones[30].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 60)  specialMsg = `\n👑 **2 mois de fidélité !** Bonus majestueux de ${milestones[60].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 100) specialMsg = `\n💎 **100 jours d'affilée !** Légendaire ! Bonus de ${milestones[100].toLocaleString('fr-FR')}${symbol}.`;

    const flames = '🔥'.repeat(Math.min(newStreak, 7));

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`${symbol} Récompense quotidienne récupérée !`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setDescription(`Tu as reçu **${total.toLocaleString('fr-FR')}${symbol}**.${specialMsg}`)
      .addFields(
        { name: `${symbol} Base`,           value: `**+${base.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: '🔥 Bonus de fidélité',     value: `**+${streakBonus.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        ...(milestone ? [{ name: '🎉 Palier',    value: `**+${milestone.toLocaleString('fr-FR')}${symbol}**`, inline: true }] : []),
        { name: `${flames} Série`,          value: `**${newStreak} jour${newStreak > 1 ? 's' : ''}** consécutif${newStreak > 1 ? 's' : ''}`, inline: true },
        { name: `${symbol} Nouveau solde`,  value: `**${(user.balance + total).toLocaleString('fr-FR')}${symbol}**`, inline: true },
      )
      .setFooter({ text: 'Reviens demain pour conserver ta série !' });

    await interaction.editReply({ embeds: [embed] });
  }
};
