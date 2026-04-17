const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  const cols = db.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('bank')) db.db.prepare('ALTER TABLE users ADD COLUMN bank INTEGER DEFAULT 0').run();
} catch {}

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    type TEXT, amount INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const INTEREST_RATE = 0.02; // 2% par jour
const MAX_BANK_MULTIPLIER = 10; // max 10x le solde portefeuille

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('🏦 Gérez votre compte bancaire et vos économies')
    .addSubcommand(s => s.setName('solde').setDescription('💰 Voir votre solde bancaire'))
    .addSubcommand(s => s.setName('deposer').setDescription('⬆️ Déposer des coins à la banque')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à déposer (0 = tout)').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('retirer').setDescription('⬇️ Retirer des coins de la banque')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à retirer (0 = tout)').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('historique').setDescription('📋 Historique des 10 dernières transactions'))
    .addSubcommand(s => s.setName('interets').setDescription('📈 Réclamer vos intérêts journaliers (2% du solde bancaire)'))
    .addSubcommand(s => s.setName('virer').setDescription('💸 Virer des coins à un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à virer').setRequired(true).setMinValue(1))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const u = db.getUser(userId, guildId);
    const bank = u.bank || 0;

    if (sub === 'solde') {
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏦 Votre compte bancaire')
          .setThumbnail(interaction.user.displayAvatarURL())
          .addFields(
            { name: '👛 Portefeuille', value: `**${u.balance} ${coin}**`, inline: true },
            { name: '🏦 Banque', value: `**${bank} ${coin}**`, inline: true },
            { name: '💎 Total', value: `**${u.balance + bank} ${coin}**`, inline: true },
          )
          .setFooter({ text: `Taux d'intérêt journalier : 2% • /banque interets` })
      ], ephemeral: true });
    }

    if (sub === 'deposer') {
      const montant = interaction.options.getInteger('montant');
      if (u.balance < montant) return interaction.reply({ content: `❌ Solde insuffisant. Vous avez **${u.balance} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -montant);
      db.db.prepare('UPDATE users SET bank=COALESCE(bank,0)+? WHERE user_id=? AND guild_id=?').run(montant, userId, guildId);
      db.db.prepare('INSERT INTO bank_transactions (guild_id, user_id, type, amount) VALUES (?,?,?,?)').run(guildId, userId, 'depot', montant);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Dépôt effectué !')
          .setDescription(`**+${montant} ${coin}** déposés en banque.`)
          .addFields(
            { name: '👛 Nouveau portefeuille', value: `${u.balance - montant} ${coin}`, inline: true },
            { name: '🏦 Nouveau solde banque', value: `${bank + montant} ${coin}`, inline: true },
          )
      ]});
    }

    if (sub === 'retirer') {
      const montant = interaction.options.getInteger('montant');
      if (bank < montant) return interaction.reply({ content: `❌ Solde bancaire insuffisant. Vous avez **${bank} ${coin}** en banque.`, ephemeral: true });

      db.db.prepare('UPDATE users SET bank=bank-? WHERE user_id=? AND guild_id=?').run(montant, userId, guildId);
      db.addCoins(userId, guildId, montant);
      db.db.prepare('INSERT INTO bank_transactions (guild_id, user_id, type, amount) VALUES (?,?,?,?)').run(guildId, userId, 'retrait', montant);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle('✅ Retrait effectué !')
          .setDescription(`**${montant} ${coin}** retirés de la banque.`)
          .addFields(
            { name: '👛 Nouveau portefeuille', value: `${u.balance + montant} ${coin}`, inline: true },
            { name: '🏦 Nouveau solde banque', value: `${bank - montant} ${coin}`, inline: true },
          )
      ]});
    }

    if (sub === 'historique') {
      const hist = db.db.prepare('SELECT * FROM bank_transactions WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 10').all(guildId, userId);
      if (!hist.length) return interaction.reply({ content: '❌ Aucune transaction.', ephemeral: true });

      const lines = hist.map(t => {
        const emoji = t.type === 'depot' ? '⬆️' : t.type === 'retrait' ? '⬇️' : t.type === 'interets' ? '📈' : '💸';
        const date = new Date(t.created_at * 1000).toLocaleDateString('fr-FR');
        return `${emoji} **${t.type}** — ${t.amount} ${coin} — ${date}`;
      }).join('\n');

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('📋 Historique des transactions').setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'interets') {
      if (bank < 100) return interaction.reply({ content: `❌ Vous devez avoir au moins **100 ${coin}** en banque pour gagner des intérêts.`, ephemeral: true });

      // Vérifier le dernier gain d'intérêts (1x par jour)
      const lastInterest = db.db.prepare("SELECT created_at FROM bank_transactions WHERE guild_id=? AND user_id=? AND type='interets' ORDER BY created_at DESC LIMIT 1").get(guildId, userId);
      const now = Math.floor(Date.now() / 1000);
      if (lastInterest && now - lastInterest.created_at < 86400) {
        const nextTime = lastInterest.created_at + 86400;
        return interaction.reply({ content: `⏳ Intérêts déjà réclamés aujourd'hui ! Prochain gain : <t:${nextTime}:R>`, ephemeral: true });
      }

      const gains = Math.floor(bank * INTEREST_RATE);
      if (gains < 1) return interaction.reply({ content: `❌ Vos intérêts sont trop faibles (${gains} ${coin}).`, ephemeral: true });

      db.db.prepare('UPDATE users SET bank=bank+? WHERE user_id=? AND guild_id=?').run(gains, userId, guildId);
      db.db.prepare('INSERT INTO bank_transactions (guild_id, user_id, type, amount) VALUES (?,?,?,?)').run(guildId, userId, 'interets', gains);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('📈 Intérêts perçus !')
          .setDescription(`Vous avez gagné **+${gains} ${coin}** d'intérêts (2% de ${bank} ${coin}).`)
          .addFields({ name: '🏦 Nouveau solde banque', value: `**${bank + gains} ${coin}**`, inline: true })
          .setFooter({ text: 'Revenez demain pour de nouveaux intérêts !' })
      ]});
    }

    if (sub === 'virer') {
      const target = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');

      if (target.id === userId) return interaction.reply({ content: '❌ Vous ne pouvez pas vous virer des coins à vous-même.', ephemeral: true });
      if (target.bot) return interaction.reply({ content: '❌ Impossible de virer à un bot.', ephemeral: true });
      if (bank < montant) return interaction.reply({ content: `❌ Solde bancaire insuffisant (**${bank} ${coin}**).`, ephemeral: true });

      db.db.prepare('UPDATE users SET bank=bank-? WHERE user_id=? AND guild_id=?').run(montant, userId, guildId);
      db.addCoins(target.id, guildId, montant);
      db.db.prepare('INSERT INTO bank_transactions (guild_id, user_id, type, amount) VALUES (?,?,?,?)').run(guildId, userId, 'virement', montant);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('💸 Virement effectué !')
          .setDescription(`**${montant} ${coin}** virés à <@${target.id}>.`)
      ]});
    }
  }
};
