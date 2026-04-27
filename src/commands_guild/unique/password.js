const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CHARS = {
  lower:   'abcdefghijklmnopqrstuvwxyz',
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits:  '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  similar: 'iIlL1oO0',
};

function generate(length, opts) {
  let pool = '';
  if (opts.lower)     pool += CHARS.lower;
  if (opts.upper)     pool += CHARS.upper;
  if (opts.digits)    pool += CHARS.digits;
  if (opts.symbols)   pool += CHARS.symbols;
  if (opts.nosimilar) for (const c of CHARS.similar) pool = pool.split(c).join('');
  if (!pool) pool = CHARS.lower + CHARS.upper + CHARS.digits;

  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += pool[Math.floor(Math.random() * pool.length)];
  }
  return pwd;
}

function strength(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 20) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 2;
  if (score <= 2) return { label: '🔴 Faible',   color: '#E74C3C' };
  if (score <= 4) return { label: '🟡 Moyen',    color: '#F1C40F' };
  if (score <= 6) return { label: '🟠 Fort',     color: '#E67E22' };
  return            { label: '🟢 Très Fort', color: '#2ECC71' };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('password')
    .setDescription('🔐 Générateur de mots de passe sécurisés')
    .addSubcommand(s => s.setName('generer').setDescription('🔑 Générer un mot de passe')
      .addBooleanOption(o => o.setName('majuscules').setDescription('Inclure des majuscules (défaut: oui)'))
      .addBooleanOption(o => o.setName('chiffres').setDescription('Inclure des chiffres (défaut: oui)'))
      .addBooleanOption(o => o.setName('symboles').setDescription('Inclure des symboles (défaut: non)'))
      .addBooleanOption(o => o.setName('nosimilaires').setDescription('Exclure les caractères similaires (i,l,1,o,0)')))
    .addSubcommand(s => s.setName('analyser').setDescription('🔍 Analyser la force d\'un mot de passe')
      .addStringOption(o => o.setName('mot_de_passe').setDescription('Mot de passe à analyser').setRequired(true))),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'generer') {
        const length  = interaction.options.getInteger('longueur')   ?? 16;
        const upper   = interaction.options.getBoolean('majuscules') ?? true;
        const digits  = interaction.options.getBoolean('chiffres')   ?? true;
        const symbols = interaction.options.getBoolean('symboles')   ?? false;
        const nosim   = interaction.options.getBoolean('nosimilaires') ?? false;
        const qty     = interaction.options.getInteger('quantite')   ?? 1;

        const passwords = Array.from({ length: Math.min(qty || 1, 5) }, () =>
          generate(Math.min(length || 16, 64), { lower: true, upper, digits, symbols, nosimilar: nosim })
        );
        const { label, color } = strength(passwords[0]);
        const desc = passwords.map((p, i) => `**${i + 1}.** \`${p}\``).join('\n');

        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle('🔐 Mot(s) de passe généré(s)')
            .setDescription(desc)
            .addFields(
              { name: '📏 Longueur', value: `${length} caractères`, inline: true },
              { name: '🛡️ Force',   value: label, inline: true },
            )
            .setFooter({ text: '⚠️ Ces mots de passe s\'affichent en éphémère uniquement' })
        ], ephemeral: true });
      }

      if (sub === 'analyser') {
        const pwd = interaction.options.getString('mot_de_passe');
        if (!pwd) return interaction.reply({ content: '❌ Mot de passe manquant.', ephemeral: true });

        const { label, color } = strength(pwd);
        const hasLower   = /[a-z]/.test(pwd);
        const hasUpper   = /[A-Z]/.test(pwd);
        const hasDigit   = /[0-9]/.test(pwd);
        const hasSymbol  = /[^a-zA-Z0-9]/.test(pwd);
        const longEnough = pwd.length >= 12;

        const details = [
          `📏 Longueur : **${pwd.length}**`,
          (hasLower   ? '✅' : '❌') + ' Minuscules',
          (hasUpper   ? '✅' : '❌') + ' Majuscules',
          (hasDigit   ? '✅' : '❌') + ' Chiffres',
          (hasSymbol  ? '✅' : '❌') + ' Symboles',
          (longEnough ? '✅' : '❌') + ' 12+ caractères',
        ];

        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle('🔍 Analyse du mot de passe')
            .addFields(
              { name: '🛡️ Force',     value: label,                inline: true },
              { name: '📊 Critères', value: details.join('\n'),   inline: false },
            )
        ], ephemeral: true });
      }
    } catch (err) {
      console.error('[password] Erreur:', err?.message || err);
      const errMsg = { content: `❌ Erreur : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(errMsg).catch(() => {});
        else await interaction.reply(errMsg).catch(() => {});
      } catch {}
    }
  },
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
