/**
 * NexusBot — Collection de Mini-Jeux
 * /minijeu — Plus/moins, anagramme, rapidité, mémorisation et plus !
 */
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

const activeGames = new Map();

// ── Plus/Moins ──────────────────────────────────────────────────────────────
function startPlusMoins(min = 1, max = 100) {
  return { type: 'plusmoins', secret: Math.floor(Math.random() * (max - min + 1)) + min, min, max, tries: 0 };
}

// ── Anagramme ───────────────────────────────────────────────────────────────
const WORD_BANK = ['PYTHON','DISCORD','SERVEUR','CLAVIER','SOURIS','ECRAN','MUSIQUE','ROBOT',
  'SOLEIL','MONTAGNE','RIVIERE','FORET','DRAGON','CHATEAU','EPEE','BOUCLIER',
  'NUAGE','PLANETE','GALAXIE','OCEAN','VOLCANO','DESERT','JUNGLE'];

function shuffleWord(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function startAnagramme() {
  const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  let anagram = shuffleWord(word);
  while (anagram === word) anagram = shuffleWord(word);
  return { type: 'anagramme', word, anagram };
}

// ── Rapidité (réaction) ─────────────────────────────────────────────────────
const EMOJIS_REACT = ['🍕','🌟','🎮','🦊','🌈','⚡','🏆','💎'];

function startReaction() {
  const emoji = EMOJIS_REACT[Math.floor(Math.random() * EMOJIS_REACT.length)];
  return { type: 'reaction', emoji, startTime: null };
}

// ── Maths rapides ────────────────────────────────────────────────────────────
const OPS = ['+', '-', '*'];
function startMaths() {
  const op = OPS[Math.floor(Math.random() * OPS.length)];
  let a, b, answer;
  if (op === '+') { a = Math.floor(Math.random()*100)+1; b = Math.floor(Math.random()*100)+1; answer = a+b; }
  else if (op === '-') { a = Math.floor(Math.random()*100)+50; b = Math.floor(Math.random()*a)+1; answer = a-b; }
  else { a = Math.floor(Math.random()*12)+2; b = Math.floor(Math.random()*12)+2; answer = a*b; }
  return { type: 'maths', question: `${a} ${op} ${b}`, answer: answer.toString() };
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
    .setName('minijeu')
    .setDescription('🎲 Collection de mini-jeux rapides')
    .addSubcommand(s => s.setName('plusmoins')
      .setDescription('🔢 Devinez le nombre secret (1–100)')
      .addStringOption(o => o.setName('mise').setDescription('Mise en coins (all/tout/50%) — ILLIMITÉ').setMaxLength(30)))
    .addSubcommand(s => s.setName('anagramme')
      .setDescription('🔤 Reconstituez le mot à partir de ses lettres mélangées')
      .addStringOption(o => o.setName('mise').setDescription('Mise en coins (all/tout/50%) — ILLIMITÉ').setMaxLength(30)))
    .addSubcommand(s => s.setName('reaction')
      .setDescription('⚡ Tapez l\'emoji le plus vite possible !')
      .addStringOption(o => o.setName('mise').setDescription('Mise en coins (all/tout/50%) — ILLIMITÉ').setMaxLength(30)))
    .addSubcommand(s => s.setName('maths')
      .setDescription('➕ Résoudre un calcul rapidement !')
      .addStringOption(o => o.setName('mise').setDescription('Mise en coins (all/tout/50%) — ILLIMITÉ').setMaxLength(30))),
  // ↑ Toutes les mises sont maintenant des strings pour lever les limites

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    const _me0    = db.getUser(userId, guildId);
    const parseBet = (raw, base) => {
      if (raw == null) return 0;
      const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
      if (!s) return 0;
      if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
      if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
      const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
      if (!m) return NaN;
      const n = parseFloat(m[1]);
      if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
      return Math.floor(n);
    };
    const miseRaw = interaction.options.get('mise')?.value;
    const mise    = Number.isFinite(parseBet(miseRaw, _me0.balance)) ? parseBet(miseRaw, _me0.balance) : 0;

    if (activeGames.has(userId)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '⚠️ Tu as déjà un jeu en cours !', ephemeral: true });

    if (mise > 0) {
      const user = db.getUser(userId, guildId);
      if (user.coins < mise) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pas assez de coins ! Tu as **${user.coins}** 🪙`, ephemeral: true });
      db.removeCoins(userId, guildId, mise);
    }

    // ── PLUS/MOINS ──
    if (sub === 'plusmoins') {
      const game = startPlusMoins(1, 100);
      activeGames.set(userId, { ...game, mise, guildId });

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔢 Plus ou Moins !')
        .setDescription(`J'ai choisi un nombre entre **1** et **100**.\nEnvoie tes propositions dans le chat !\nTu as **10 essais** pour le trouver.`)
        .setFooter({ text: `Mise : ${mise} coins` });
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === userId && /^\d+$/.test(m.content.trim()),
        time: 60000,
      });

      collector.on('collect', async (msg) => {
        const g = activeGames.get(userId);
        if (!g) return;
        g.tries++;
        const guess = parseInt(msg.content.trim());

        if (guess === g.secret) {
          activeGames.delete(userId);
          collector.stop('found');
          const gain = mise > 0 ? Math.round(mise * (1 + (10 - g.tries) * 0.2)) : 50;
          if (mise > 0 || true) db.addCoins(userId, guildId, gain);
          await msg.react('✅');
          await interaction.channel.send({ embeds: [new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎉 Trouvé !')
            .setDescription(`C'était bien **${g.secret}** !\nTrouvé en **${g.tries}** essai(s) → +**${gain}** coins !`)
          ]});
        } else if (g.tries >= 10) {
          activeGames.delete(userId);
          collector.stop('max');
          await msg.react('❌');
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ Raté ! C'était **${g.secret}**. Perdu : ${mise} coins.`)] });
        } else {
          const hint = guess < g.secret ? '📈 Plus grand !' : '📉 Plus petit !';
          await msg.reply(`${hint} (essai ${g.tries}/10)`);
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          const g = activeGames.get(userId);
          if (g) {
            activeGames.delete(userId);
            interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription(`⏱️ Temps écoulé ! C'était **${g.secret}**.`)] }).catch(() => {});
          }
        }
      });
      return;
    }

    // ── ANAGRAMME ──
    if (sub === 'anagramme') {
      const game = startAnagramme();
      activeGames.set(userId, { ...game, mise, guildId });

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🔤 Anagramme !')
        .setDescription(`Reconstituez ce mot :\n\n**\`${game.anagram}\`**\n\nEnvoyez votre réponse dans le chat ! ⏱️ 30 secondes.`)
        .setFooter({ text: `${game.word.length} lettres — Mise : ${mise} coins` })
      ]});

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === userId,
        time: 30000,
      });

      collector.on('collect', async (msg) => {
        const g = activeGames.get(userId);
        if (!g) return;
        if (msg.content.toUpperCase().trim() === g.word) {
          activeGames.delete(userId);
          collector.stop('found');
          const gain = mise > 0 ? mise * 2 : 75;
          db.addCoins(userId, guildId, gain);
          await msg.react('✅');
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ **${msg.author.username}** a trouvé ! C'était **${g.word}** — +**${gain}** coins !`)] });
        } else {
          await msg.react('❌');
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          const g = activeGames.get(userId);
          if (g) {
            activeGames.delete(userId);
            interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`⏱️ Temps écoulé ! C'était **${g.word}**.`)] }).catch(() => {});
          }
        }
      });
      return;
    }

    // ── RÉACTION ──
    if (sub === 'reaction') {
      const game = startReaction();
      activeGames.set(userId, { ...game, mise, guildId });

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('⚡ Test de Réaction !')
        .setDescription(`Prépare-toi... L'emoji apparaîtra dans **1–5 secondes**.\nQuand il apparaît, **tapez-le exactement** dans le chat !`)
        .setFooter({ text: `Mise : ${mise} coins` })
      ]});

      const delay = Math.floor(Math.random() * 4000) + 1000;
      setTimeout(async () => {
        const g = activeGames.get(userId);
        if (!g) return;
        g.startTime = Date.now();
        activeGames.set(userId, g);
        await interaction.channel.send(`🎯 **Tapez maintenant :** ${g.emoji}`);

        const collector = interaction.channel.createMessageCollector({
          filter: m => m.author.id === userId,
          time: 10000,
          max: 1,
        });

        collector.on('collect', async (msg) => {
          activeGames.delete(userId);
          const elapsed = Date.now() - g.startTime;
          if (msg.content.trim() === g.emoji) {
            const gain = mise > 0 ? mise * 2 : Math.max(10, Math.round(100 - elapsed / 50));
            db.addCoins(userId, guildId, gain);
            await msg.react('✅');
            await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`⚡ Réaction en **${elapsed}ms** ! Excellent ! +**${gain}** coins !`)] });
          } else {
            await msg.react('❌');
            await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ Mauvais emoji ! C'était **${g.emoji}**. Mise perdue.`)] });
          }
        });

        collector.on('end', (_, reason) => {
          if (reason === 'time') {
            activeGames.delete(userId);
            interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('⏱️ Trop lent !')] }).catch(() => {});
          }
        });
      }, delay);
      return;
    }

    // ── MATHS ──
    if (sub === 'maths') {
      const game = startMaths();
      game.startTime = Date.now();
      activeGames.set(userId, { ...game, mise, guildId });

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('➕ Calcul Rapide !')
        .setDescription(`Résoudre :\n\n**\`${game.question} = ?\`**\n\nEnvoyez la réponse dans le chat ! ⏱️ 20 secondes.`)
        .setFooter({ text: `Mise : ${mise} coins` })
      ]});

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === userId,
        time: 20000,
      });

      collector.on('collect', async (msg) => {
        const g = activeGames.get(userId);
        if (!g) return;
        if (msg.content.trim() === g.answer) {
          activeGames.delete(userId);
          collector.stop('found');
          const elapsed = Math.round((Date.now() - g.startTime) / 1000);
          const speedBonus = Math.max(0, 10 - elapsed);
          const gain = mise > 0 ? Math.round(mise * (1.5 + speedBonus * 0.05)) : 50 + speedBonus * 5;
          db.addCoins(userId, guildId, gain);
          await msg.react('✅');
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ **${g.question} = ${g.answer}** — Correct en ${elapsed}s ! +**${gain}** coins !`)] });
        } else {
          await msg.react('❌');
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          const g = activeGames.get(userId);
          if (g) {
            activeGames.delete(userId);
            interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`⏱️ Temps écoulé ! La réponse était **${g.answer}**.`)] }).catch(() => {});
          }
        }
      });
      return;
    }
  },

  name: 'minijeu',
  aliases: ['minigame', 'jeurapide'],
  async run(message, args) {
    const sub  = args[0] || 'plusmoins';
    const mise = args[1] || null;
    const fake = mkFake(message, {
      getSubcommand: () => sub,
      getString: (k) => k === 'mise' ? mise : null,
    });
    await this.execute(fake);
  },

};
