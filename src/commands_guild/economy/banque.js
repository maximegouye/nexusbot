// ============================================================
// banque.js — Amélioré : tiers VIP + intérêts composés
// Emplacement : src/commands_guild/economy/banque.js
//   (remplace l'ancien fichier banque.js)
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { checkCooldown, cooldownMessage } = require('../../utils/cooldownManager');

// ─── Migration sécurisée ──────────────────────────────────
try {
  const cols = db.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('bank'))           db.db.prepare('ALTER TABLE users ADD COLUMN bank INTEGER DEFAULT 0').run();
  if (!cols.includes('bank_tier'))      db.db.prepare('ALTER TABLE users ADD COLUMN bank_tier TEXT DEFAULT "bronze"').run();
  if (!cols.includes('last_interest'))  db.db.prepare('ALTER TABLE users ADD COLUMN last_interest TEXT DEFAULT ""').run();
} catch {}

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bank_transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT,
    user_id    TEXT,
    type       TEXT,
    amount     INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// ─── Tiers VIP ────────────────────────────────────────────
const TIERS = {
  bronze:   { name: 'Bronze',   emoji: '🟤', color: '#CD7F32', minBank: 0,       interest: 0.02, maxMultiplier: 10  },
  silver:   { name: 'Argent',   emoji: '⚪', color: '#C0C0C0', minBank: 5000,    interest: 0.03, maxMultiplier: 15  },
  gold:     { name: 'Or',       emoji: '🟡', color: '#FFD700', minBank: 25000,   interest: 0.04, maxMultiplier: 20  },
  platinum: { name: 'Platine',  emoji: '💠', color: '#00CED1', minBank: 100000,  interest: 0.05, maxMultiplier: 30  },
  diamond:  { name: 'Diamant',  emoji: '💎', color: '#B9F2FF', minBank: 500000,  interest: 0.07, maxMultiplier: 50  },
};

function getTier(bankBalance) {
  const tierList = Object.values(TIERS).sort((a, b) => b.minBank - a.minBank);
  return tierList.find(t => bankBalance >= t.minBank) || TIERS.bronze;
}

function formatNum(n) {
  return n.toLocaleString('fr-FR');
}

// ─── Module ───────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('🏦 Gérez votre compte bancaire avec tiers VIP et intérêts composés')
    .addSubcommand(s => s
      .setName('solde')
      .setDescription('💰 Voir votre solde bancaire et votre tier VIP'))
    .addSubcommand(s => s
      .setName('deposer')
      .setDescription('📥 Déposer des coins à la banque')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à déposer (0 = tout)').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('📤 Retirer des coins de la banque')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à retirer (0 = tout)').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName('interets')
      .setDescription('📈 Réclamer vos intérêts quotidiens (composés selon votre tier)'))
    .addSubcommand(s => s
      .setName('historique')
      .setDescription('📋 Voir les 10 dernières transactions'))
    .addSubcommand(s => s
      .setName('virer')
      .setDescription('💸 Virer des coins à un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à virer').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName('tiers')
      .setDescription('🏆 Voir tous les tiers VIP et leurs avantages')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    const sub     = interaction.options.getSubcommand(false) || 'solde';
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const cfg     = db.getConfig(guildId) || {};
    const coin    = cfg.currency_emoji || '€';
    const u       = db.getUser(userId, guildId) || { balance: 0, bank: 0 };
    const bank    = u.bank || 0;
    const tier    = getTier(bank);

    // ── SOLDE ─────────────────────────────────────────────
    if (sub === 'solde') {
      const maxBankCap = u.balance * tier.maxMultiplier;
      const nextTierList = Object.values(TIERS).sort((a, b) => a.minBank - b.minBank);
      const nextTier = nextTierList.find(t => t.minBank > bank);

      const embed = new EmbedBuilder()
        .setColor(tier.color)
        .setTitle(`${tier.emoji} Compte Bancaire — Tier ${tier.name}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '💼 Portefeuille',    value: `**${formatNum(u.balance)} ${coin}**`,  inline: true },
          { name: '🏦 Banque',           value: `**${formatNum(bank)} ${coin}**`,       inline: true },
          { name: '💎 Total',            value: `**${formatNum(u.balance + bank)} ${coin}**`, inline: true },
          { name: '📈 Taux d\'intérêt', value: `**${tier.interest * 100}%**/jour`,     inline: true },
          { name: '📊 Plafond banque',   value: `**${formatNum(maxBankCap)} ${coin}**`, inline: true },
          { name: `${tier.emoji} Tier`,  value: `**${tier.name}**`,                    inline: true },
        );

      if (nextTier) {
        const needed = nextTier.minBank - bank;
        embed.addFields({
          name: `⬆️ Prochain tier : ${nextTier.emoji} ${nextTier.name}`,
          value: `Encore **${formatNum(needed)} ${coin}** à la banque (taux → **${nextTier.interest * 100}%**)`
        });
      }

      embed.setFooter({ text: '/banque interets — intérêts composés disponibles 1x/jour' });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    // ── DÉPOSER ───────────────────────────────────────────
    if (sub === 'deposer') {
      let montant = interaction.options.getInteger('montant');
      if (montant === 0) montant = u.balance;
      if (montant > u.balance) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant (**${formatNum(u.balance)} ${coin}**).`, ephemeral: true });

      const maxCap = u.balance * tier.maxMultiplier;
      if (bank >= maxCap) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Banque pleine ! Plafond tier ${tier.name} : **${formatNum(maxCap)} ${coin}**.`, ephemeral: true });
      }

      const allowed = Math.min(montant, maxCap - bank);
      db.addCoins(userId, guildId, -allowed);
      db.db.prepare('UPDATE users SET bank=COALESCE(bank,0)+? WHERE user_id=? AND guild_id=?').run(allowed, userId, guildId);
      db.db.prepare('INSERT INTO bank_transactions (guild_id,user_id,type,amount) VALUES (?,?,?,?)').run(guildId, userId, 'depot', allowed);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('📥 Dépôt effectué')
        .addFields(
          { name: '💰 Déposé',  value: `**+${formatNum(allowed)} ${coin}**`, inline: true },
          { name: '🏦 Banque',  value: `**${formatNum(bank + allowed)} ${coin}**`, inline: true }
        );

      if (allowed < montant) embed.addFields({ name: '⚠️ Plafond atteint', value: `Seuls **${formatNum(allowed)} ${coin}** ont été déposés (plafond tier ${tier.name}).` });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    // ── RETIRER ───────────────────────────────────────────
    if (sub === 'retirer') {
      let montant = interaction.options.getInteger('montant');
      if (montant === 0) montant = bank;
      if (montant > bank) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous n'avez que **${formatNum(bank)} ${coin}** en banque.`, ephemeral: true });

      db.addCoins(userId, guildId, montant);
      db.db.prepare('UPDATE users SET bank=bank-? WHERE user_id=? AND guild_id=?').run(montant, userId, guildId);
      db.db.prepare('INSERT INTO bank_transactions (guild_id,user_id,type,amount) VALUES (?,?,?,?)').run(guildId, userId, 'retrait', montant);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('📤 Retrait effectué')
          .addFields(
            { name: '💰 Retiré',     value: `**-${formatNum(montant)} ${coin}**`, inline: true },
            { name: '🏦 Banque',     value: `**${formatNum(bank - montant)} ${coin}**`, inline: true },
            { name: '💼 Portefeuille', value: `**${formatNum(u.balance + montant)} ${coin}**`, inline: true }
          )]
      });
    }

    // ── INTÉRÊTS ──────────────────────────────────────────
    if (sub === 'interets') {
      const cd = checkCooldown(userId, 'banque_interets', 22 * 3600);
      if (cd.onCooldown) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: cooldownMessage(cd.remaining), ephemeral: true });
      }

      if (bank === 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas d\'argent à la banque.', ephemeral: true });
      }

      // Intérêts composés selon le tier
      const interet = Math.floor(bank * tier.interest);
      db.db.prepare('UPDATE users SET bank=bank+? WHERE user_id=? AND guild_id=?').run(interet, userId, guildId);
      db.db.prepare('INSERT INTO bank_transactions (guild_id,user_id,type,amount) VALUES (?,?,?,?)').run(guildId, userId, 'interets', interet);

      const embed = new EmbedBuilder()
        .setColor(tier.color)
        .setTitle(`${tier.emoji} Intérêts composés réclamés !`)
        .setDescription(`Votre tier **${tier.name}** vous rapporte **${tier.interest * 100}%/jour** sur votre solde bancaire.`)
        .addFields(
          { name: '💰 Intérêts gagnés', value: `**+${formatNum(interet)} ${coin}**`, inline: true },
          { name: '🏦 Nouveau solde',   value: `**${formatNum(bank + interet)} ${coin}**`, inline: true },
          { name: `${tier.emoji} Tier`, value: `**${tier.name}**`, inline: true }
        )
        .setFooter({ text: 'Prochain intérêt disponible dans ~22h' });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    // ── HISTORIQUE ────────────────────────────────────────
    if (sub === 'historique') {
      const txs = db.db.prepare(
        'SELECT * FROM bank_transactions WHERE user_id=? AND guild_id=? ORDER BY created_at DESC LIMIT 10'
      ).all(userId, guildId);

      if (!txs.length) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📋 Aucune transaction trouvée.', ephemeral: true });
      }

      const typeEmoji = { depot: '📥', retrait: '📤', interets: '📈', virement_in: '💸', virement_out: '💸' };
      const lines = txs.map(tx => {
        const date = new Date(tx.created_at * 1000).toLocaleDateString('fr-FR');
        const sign = ['retrait', 'virement_out'].includes(tx.type) ? '-' : '+';
        return `${typeEmoji[tx.type] || '💰'} \`${date}\` **${sign}${formatNum(tx.amount)} ${coin}** — ${tx.type}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('📋 10 dernières transactions')
        .setDescription(lines);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    // ── VIRER ─────────────────────────────────────────────
    if (sub === 'virer') {
      const target  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');

      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous virer de l\'argent.', ephemeral: true });
      if (montant > bank) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde bancaire insuffisant.`, ephemeral: true });

      db.db.prepare('UPDATE users SET bank=bank-? WHERE user_id=? AND guild_id=?').run(montant, userId, guildId);
      db.db.prepare('UPDATE users SET bank=COALESCE(bank,0)+? WHERE user_id=? AND guild_id=?').run(montant, target.id, guildId);
      db.db.prepare('INSERT INTO bank_transactions (guild_id,user_id,type,amount) VALUES (?,?,?,?)').run(guildId, userId, 'virement_out', montant);
      db.db.prepare('INSERT INTO bank_transactions (guild_id,user_id,type,amount) VALUES (?,?,?,?)').run(guildId, target.id, 'virement_in', montant);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('💸 Virement effectué')
          .setDescription(`Vous avez viré **${formatNum(montant)} ${coin}** à ${target}.`)
          .addFields(
            { name: '🏦 Votre banque', value: `**${formatNum(bank - montant)} ${coin}**`, inline: true }
          )]
      });
    }

    // ── TIERS ─────────────────────────────────────────────
    if (sub === 'tiers') {
      const tierFields = Object.values(TIERS).sort((a, b) => a.minBank - b.minBank).map(t => ({
        name: `${t.emoji} ${t.name}`,
        value: `Dépôt min : **${formatNum(t.minBank)} ${coin}**\nIntérêts : **${t.interest * 100}%/jour**\nPlafond : **x${t.maxMultiplier}** votre portefeuille`,
        inline: true
      }));

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Tiers VIP Bancaires')
        .setDescription(`Votre tier actuel : ${tier.emoji} **${tier.name}** — Déposez plus pour progresser !`)
        .addFields(tierFields)
        .setFooter({ text: 'Plus votre dépôt est élevé, plus vos intérêts composés sont puissants !' });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }
  }
};

