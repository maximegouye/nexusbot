const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('🥷 Tente de voler des euros à un autre membre (risqué — cooldown 12h)')
    .addUserOption(o => o.setName('cible').setDescription('Membre à voler').setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const target = interaction.options.getUser('cible');

    if (target.bot)  return interaction.editReply({ content: '❌ Tu ne peux pas voler un bot.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ Tu ne peux pas te voler toi-même.', ephemeral: true });

    const robber   = db.getUser(interaction.user.id, interaction.guildId);
    const victim   = db.getUser(target.id, interaction.guildId);
    const now      = Math.floor(Date.now() / 1000);
    const lastRob  = robber.last_rob || 0;
    const cooldown = cfg.rob_cooldown > 0 ? cfg.rob_cooldown : 43200; // panel-configurable

    if (now - lastRob < cooldown) {
      const remaining = cooldown - (now - lastRob);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#FF6B6B').setTitle('🚔 Trop tôt !')
          .setDescription(`La police surveille encore ta zone. Attends **${h}h ${m}min**.`)],
        ephemeral: true
      });
    }

    if (victim.balance < 20) {
      return interaction.editReply({ content: `❌ **${target.username}** a trop peu d'argent pour être volé (moins de 20€).`, ephemeral: true });
    }

    // Bonus si kit de vol du marché noir
    const hasKit = (robber.bm_steal_kit || 0) > 0;
    const successRate = hasKit ? 0.65 : 0.40; // 40% base, 65% avec kit

    if (hasKit) {
      db.db.prepare('UPDATE users SET bm_steal_kit = bm_steal_kit - 1 WHERE user_id=? AND guild_id=?').run(interaction.user.id, interaction.guildId);
    }

    db.db.prepare('UPDATE users SET last_rob = ? WHERE user_id = ? AND guild_id = ?').run(now, interaction.user.id, interaction.guildId);

    const success = Math.random() < successRate;

    if (success) {
      // Panel override : cfg.rob_max_percent plafonne le % volé (défaut 30%)
      const capPct = (cfg.rob_max_percent != null && cfg.rob_max_percent > 0) ? cfg.rob_max_percent / 100 : 0.30;
      const pct    = Math.min(capPct, 0.10 + Math.random() * Math.max(0.01, capPct - 0.10));
      const stolen = Math.min(Math.floor(victim.balance * pct), victim.balance);
      db.addCoins(interaction.user.id, interaction.guildId, stolen);
      db.removeCoins(target.id, interaction.guildId, stolen);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🥷 Vol réussi !')
          .setDescription(`Tu as volé **${stolen.toLocaleString('fr-FR')}${symbol}** à **${target.username}** !`)
          .addFields(
            { name: '💰 Volé',        value: `**+${stolen.toLocaleString('fr-FR')}${symbol}**`,               inline: true },
            { name: '📊 % Volé',      value: `**${Math.round(pct*100)}%** du portefeuille`,                inline: true },
            ...(hasKit ? [{ name: '🔓 Kit utilisé', value: 'Bonus de réussite appliqué',                  inline: true }] : []),
          )
          .setFooter({ text: 'Prochain vol possible dans 12h' })
        ]
      });
    } else {
      // Panel override : cfg.rob_fail_penalty est un montant fixe (si > 0), sinon 20% du solde
      const penaltyFlat = (cfg.rob_fail_penalty != null && cfg.rob_fail_penalty > 0) ? cfg.rob_fail_penalty : 0;
      const fine = penaltyFlat > 0
        ? Math.min(penaltyFlat, robber.balance)
        : Math.min(Math.floor(robber.balance * 0.20), robber.balance);
      db.removeCoins(interaction.user.id, interaction.guildId, fine);
      db.addCoins(target.id, interaction.guildId, Math.floor(fine * 0.5)); // victime récupère 50%

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🚔 Pris en flagrant délit !')
          .setDescription(`**${target.username}** t'a vu et a appelé la police ! Tu paies une amende.`)
          .addFields(
            { name: '💸 Amende',      value: `**-${fine.toLocaleString('fr-FR')}${symbol}**`,                 inline: true },
            { name: '💰 Victime',     value: `a récupéré **+${Math.floor(fine*0.5).toLocaleString('fr-FR')}${symbol}**`, inline: true },
          )
          .setFooter({ text: 'Prochain vol dans 12h' })
        ]
      });
    }
  }
};
