const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CHARS = {
  lower:   'abcdefghijklmnopqrstuvwxyz',
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits:  '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  similar: 'iIlL1oO0',
};

function generate(length, opts) {
  let pool = '';
  if (opts.lower)   pool += CHARS.lower;
  if (opts.upper)   pool += CHARS.upper;
  if (opts.digits)  pool += CHARS.digits;
  if (opts.symbols) pool += CHARS.symbols;
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
  if (score <= 2) return { label: '🔴 Faible',  color: '#E74C3C' };
  if (score <= 4) return { label: '🟡 Moyen',   color: '#F1C40F' };
  if (score <= 6) return { label: '🟠 Fort',    color: '#E67E22' };
  return            { label: '🟢 Très Fort', color: '#2ECC71' };
}


// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts) {
  opts = opts || {};
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('password')
    .setDescription('🔐 Générateur de mots de passe sécurisés')
    .addSubcommand(s => s.setName('generer').setDescription('🔑 Générer un mot de passe')
      .addIntegerOption(o => o.setName('longueur').setDescription('Longueur du mot de passe (défaut: 16)').setMinValue(4).setMaxValue(128).setRequired(false))
      .addIntegerOption(o => o.setName('quantite').setDescription('Nombre de mots de passe (défaut: 1)').setMinValue(1).setMaxValue(10).setRequired(false))
      .addBooleanOption(o => o.setName('majuscules').setDescription('Inclure des majuscules (défaut: oui)'))
      .addBooleanOption(o => o.setName('chiffres').setDescription('Inclure des chiffres (défaut: oui)'))
      .addBooleanOption(o => o.setName('symboles').setDescription('Inclure des symboles (défaut: non)'))
      .addBooleanOption(o => o.setName('nosimilaires').setDescription('Exclure les caractères similaires (i,l,1,o,0)')))
    .addSubcommand(s => s.setName('analyser').setDescription('🔍 Analyser la force d\'un mot de passe')
      .addStringOption(o => o.setName('mot_de_passe').setDescription('Mot de passe à analyser').setRequired(true))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    try {
    const sub = interaction.options.getSubcommand();

    if (sub === 'generer') {
      const length  = interaction.options.getInteger('longueur')  ?? 16;
      const upper   = interaction.options.getBoolean('majuscules')  ?? true;
      const digits  = interaction.options.getBoolean('chiffres')    ?? true;
      const symbols = interaction.options.getBoolean('symboles')    ?? false;
      const nosim   = interaction.options.getBoolean('nosimilaires') ?? false;
      const qty     = interaction.options.getInteger('quantite')    ?? 1;

      const passwords = Array.from({ length: qty }, () => generate(length, { lower: true, upper, digits, symbols, nosimilar: nosim }));
      const { label, color } = strength(passwords[0]);

      const desc = passwords.map((p, i) => `**${i+1}.** \`${p}\``).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor(color).setTitle('🔐 Mot(s) de passe généré(s)')
          .setDescription(desc)
          .addFields(
            { name: '📏 Longueur', value: `${length} caractères`, inline: true },
            { name: '🛡️ Force', value: label, inline: true },
          )
          .setFooter({ text: '⚠️ Ces mots de passe s\'affichent en éphémère uniquement' })
      ], ephemeral: true });
    }

    if (sub === 'analyser') {
      const pwd = interaction.options.getString('mot_de_passe');
      const { label, color } = strength(pwd);

      const details = [
        `📏 Longueur : **${pwd.length}**`,
        `${/[a-z]/.test(pwd) ? '✅' : '❌'} Minuscules`,
        `${/[A-Z]/.test(pwd) ? '✅' : '❌'} Majuscules`,
        `${/[0-9]/.test(pwd) ? '✅' : '❌'} Chiffres`,
        `${/[^a-zA-Z0-9]/.test(pwd) ? '✅' : '❌'} Symboles`,
        `${pwd.length >= 12 ? '✅' : '❌'} 12+ caractères`,
      ];

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor(color).setTitle('🔍 Analyse du mot de passe')
          .addFields(
            { name: '🛡️ Force', value: label, inline: true },
            { name: '📊 Critères', value: details.join('\n'), inline: false },
          )
      ], ephemeral: true });
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }},

  name: 'password',
  aliases: ['mdp', 'motdepasse', 'passgen'],
  async run(message, args) {
    const sub = args[0] === 'analyser' ? 'analyser' : 'generer';
    const pwd = sub === 'analyser' ? args.slice(1).join(' ') : null;
    const fake = mkFake(message, {
      getSubcommand: () => sub,
      getString: (k) => k === 'mot_de_passe' ? pwd : null,
    });
    await this.execute(fake);
  },

};
