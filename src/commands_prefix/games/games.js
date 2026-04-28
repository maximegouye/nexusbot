const { EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: 'trivia',
    aliases: ['quiz', 'question', 'q'],
    description: 'Question de culture générale',
    category: 'Jeux',
    cooldown: 10,
    async run(message, args, client, db) {
      const questions = [
        { q: 'Quelle est la capitale de l\'Australie ?', a: ['canberra'], wrong: ['sydney', 'melbourne', 'perth'] },
        { q: 'Combien de côtés a un hexagone ?', a: ['6', 'six'], wrong: ['5','7','8'] },
        { q: 'Quel est l\'élément chimique avec le symbole Au ?', a: ['or', 'gold'], wrong: ['argent','platine','cuivre'] },
        { q: 'En quelle année a été fondée Google ?', a: ['1998'], wrong: ['1994','2000','1996'] },
        { q: 'Combien de planètes dans notre système solaire ?', a: ['8', 'huit'], wrong: ['9','7','10'] },
        { q: 'Qui a peint la Joconde ?', a: ['léonard de vinci', 'leonard de vinci', 'da vinci'], wrong: ['raphaël','michel-ange','botticelli'] },
        { q: 'Quelle est la plus grande planète du système solaire ?', a: ['jupiter'], wrong: ['saturne','uranus','neptune'] },
        { q: 'Quel est le pays le plus grand du monde en superficie ?', a: ['russie', 'russia'], wrong: ['canada','états-unis','chine'] },
        { q: 'Combien de dents a un adulte humain ?', a: ['32'], wrong: ['28','30','36'] },
        { q: 'Quelle langue est la plus parlée dans le monde ?', a: ['anglais', 'english'], wrong: ['mandarin','espagnol','hindi'] },
        { q: 'Quel est le plus long fleuve du monde ?', a: ['nil', 'nile'], wrong: ['amazone','yangtsé','congo'] },
        { q: 'En quelle année l\'homme a-t-il marché sur la Lune pour la première fois ?', a: ['1969'], wrong: ['1963','1972','1967'] },
      ];
      const qq = questions[Math.floor(Math.random() * questions.length)];
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';

      const embed = new EmbedBuilder().setColor('#9B59B6').setTitle('🧠 Trivia !').setDescription(`**${qq.q}**\n\n⏱️ Vous avez **30 secondes** pour répondre !`).setFooter({ text: 'Tapez votre réponse dans le chat' });
      await message.channel.send({ embeds: [embed] });

      const filter = m => m.author.id === message.author.id;
      try {
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        const answer = collected.first().content.toLowerCase().trim();
        if (qq.a.some(a => answer.includes(a))) {
          db.addCoins(message.author.id, message.guild.id, 75);
          message.channel.send({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Bonne réponse !').setDescription(`**${qq.a[0]}** était la bonne réponse ! +75 ${coin}`)] });
        } else {
          message.channel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Faux !').setDescription(`La bonne réponse était : **${qq.a[0]}**`)] });
        }
      } catch {
        message.channel.send(`⏱️ Temps écoulé ! La réponse était : **${qq.a[0]}**`);
      }
    }
  },
  {
    name: 'roulette',
    aliases: ['russian', 'rr', 'russianroulette'],
    description: 'Roulette russe — 1 chance sur 6 de perdre tout',
    category: 'Jeux',
    cooldown: 30,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const bet = parseInt(args[0]);
      if (!bet || bet < 50) return message.reply('❌ Mise minimum 50€. Usage: `&roulette 500`');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance||0) < bet) return message.reply('❌ Solde insuffisant.');

      const chambers = [false, false, false, false, false, true]; // 1 balle sur 6
      const result = chambers[Math.floor(Math.random() * 6)];

      if (result) {
        db.removeCoins(message.author.id, message.guild.id, bet);
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('💥 BANG !').setDescription(`🔫 La balle était là ! <@${message.author.id}> perd **${bet} ${coin}** !`)] });
      } else {
        db.addCoins(message.author.id, message.guild.id, Math.floor(bet * 0.2));
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('😅 *Click* — Vous survivez !').setDescription(`🔫 Chambre vide ! +**${Math.floor(bet*0.2)} ${coin}** !`)] });
      }
    }
  },
  {
    name: 'connect4',
    aliases: ['puissance4', 'c4', 'p4'],
    description: 'Puissance 4 contre le bot',
    category: 'Jeux',
    cooldown: 15,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const COLS = 7, ROWS = 6;
      const board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
      const EMPTY = '⬛', P1 = '🔴', P2 = '🟡';

      function renderBoard(board) {
        let s = '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n';
        for (let r = 0; r < ROWS; r++) s += board[r].map(c => c===1?P1:c===2?P2:EMPTY).join('') + '\n';
        return s;
      }
      function checkWin(board, player) {
        for (let r=0;r<ROWS;r++) for (let c=0;c<COLS-3;c++) if ([0,1,2,3].every(i=>board[r][c+i]===player)) return true;
        for (let r=0;r<ROWS-3;r++) for (let c=0;c<COLS;c++) if ([0,1,2,3].every(i=>board[r+i][c]===player)) return true;
        for (let r=0;r<ROWS-3;r++) for (let c=0;c<COLS-3;c++) if ([0,1,2,3].every(i=>board[r+i][c+i]===player)) return true;
        for (let r=3;r<ROWS;r++) for (let c=0;c<COLS-3;c++) if ([0,1,2,3].every(i=>board[r-i][c+i]===player)) return true;
        return false;
      }
      function dropPiece(board, col, player) {
        for (let r=ROWS-1;r>=0;r--) if (!board[r][col]) { board[r][col]=player; return true; }
        return false;
      }
      function botMove(board) {
        const valid = [];
        for (let c=0;c<COLS;c++) if (!board[0][c]) valid.push(c);
        return valid[Math.floor(Math.random()*valid.length)];
      }

      const m = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🔴 Puissance 4 vs Bot').setDescription(renderBoard(board)+'\nTapez le numéro de colonne (1-7)')] });
      let turns = 0;
      const filter = msg => msg.author.id===message.author.id && /^[1-7]$/.test(msg.content.trim());

      for (let i=0;i<ROWS*COLS;i++) {
        try {
          const collected = await message.channel.awaitMessages({ filter, max:1, time:30000, errors:['time'] });
          const col = parseInt(collected.first().content.trim())-1;
          await collected.first().delete().catch(()=>{});
          if (!dropPiece(board,col,1)) continue;
          if (checkWin(board,1)) {
            db.addCoins(message.author.id,message.guild.id,200);
            return m.edit({ embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle('🏆 Vous gagnez !').setDescription(renderBoard(board)+`\n+200 ${coin}`)] });
          }
          const bc = botMove(board);
          if (bc===undefined) break;
          dropPiece(board,bc,2);
          if (checkWin(board,2)) return m.edit({ embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('🤖 Le bot gagne !').setDescription(renderBoard(board))] });
          await m.edit({ embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('🔴 Puissance 4').setDescription(renderBoard(board)+'\nVotre tour ! (1-7)')] });
        } catch { return m.edit({ content:'⏱️ Temps écoulé !', embeds:[] }); }
      }
      m.edit({ embeds:[new EmbedBuilder().setColor('#F39C12').setTitle('🤝 Match nul !').setDescription(renderBoard(board))] });
    }
  },
  {
    name: 'lottery',
    aliases: ['loto', 'lotterie', 'loterie'],
    description: 'Acheter un ticket de loterie (tirage chaque heure)',
    category: 'Jeux',
    cooldown: 3600,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const price = 100;
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance||0) < price) return message.reply(`❌ Il vous faut **${price} ${coin}** pour un ticket.`);
      db.removeCoins(message.author.id, message.guild.id, price);
      const nums = Array.from({length:6}, ()=>Math.floor(Math.random()*49)+1).sort((a,b)=>a-b);
      try {
        db.db.prepare('INSERT INTO lottery_tickets (guild_id,user_id,numbers) VALUES(?,?,?)').run(message.guild.id, message.author.id, nums.join(','));
      } catch {
        db.db.prepare(`CREATE TABLE IF NOT EXISTS lottery_tickets (id INTEGER PRIMARY KEY, guild_id TEXT, user_id TEXT, numbers TEXT, draw_id INTEGER, created_at INTEGER DEFAULT (strftime('%s','now')))`).run();
        db.db.prepare('INSERT INTO lottery_tickets (guild_id,user_id,numbers) VALUES(?,?,?)').run(message.guild.id, message.author.id, nums.join(','));
      }
      message.channel.send({ embeds:[new EmbedBuilder().setColor('#F1C40F').setTitle('🎫 Ticket de Loterie !').setDescription(`Vos numéros : **${nums.join(' - ')}**\nGros lot accumulé avec chaque ticket vendu !`).setFooter({text:`Prix: ${price} ${coin} • Tirage à la prochaine heure ronde`})] });
    }
  },
  {
    name: 'highlow',
    aliases: ['hl', 'hilo', 'plusmoins'],
    description: 'Devinez si le prochain nombre est plus haut ou plus bas',
    category: 'Jeux',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const bet = parseInt(args[0]) || 100;
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance||0) < bet) return message.reply('❌ Solde insuffisant.');
      const current = Math.floor(Math.random()*98)+1;
      await message.channel.send({ embeds:[new EmbedBuilder().setColor('#3498DB').setTitle('📈 Plus Haut ou Plus Bas ?').setDescription(`Le nombre actuel est **${current}** (sur 100)\nTapez \`haut\` ou \`bas\` !`).addFields({name:'💰 Mise',value:`${bet} ${coin}`,inline:true})] });
      const filter = m=>m.author.id===message.author.id&&['haut','bas','h','b'].includes(m.content.toLowerCase());
      try {
        const col = await message.channel.awaitMessages({filter,max:1,time:15000,errors:['time']});
        const choice = ['haut','h'].includes(col.first().content.toLowerCase()) ? 'haut' : 'bas';
        const next = Math.floor(Math.random()*98)+1;
        const correct = (choice==='haut' && next>current) || (choice==='bas' && next<current);
        if (correct) db.addCoins(message.author.id, message.guild.id, bet);
        else db.removeCoins(message.author.id, message.guild.id, bet);
        message.channel.send({ embeds:[new EmbedBuilder().setColor(correct?'#2ECC71':'#E74C3C').setTitle(correct?'✅ Correct !':'❌ Faux !').setDescription(`Vous avez dit **${choice}**, le nombre suivant était **${next}**\n${correct?`+${bet} ${coin}`:`-${bet} ${coin}`}`)] });
      } catch { message.reply('⏱️ Temps écoulé !'); }
    }
  },
  {
    name: 'akinator',
    aliases: ['aki', 'devine', 'genie'],
    description: 'Je pense à un animal/objet, devinez lequel !',
    category: 'Jeux',
    cooldown: 10,
    async run(message, args, client, db) {
      const things = ['chien','chat','éléphant','guitare','voiture','pizza','soleil','montagne','livre','téléphone','ordinateur','avion','dauphin','bouteille','parapluie'];
      const thing = things[Math.floor(Math.random()*things.length)];
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const hints = [`Il peut être petit ou grand.`,`Il existe dans de nombreuses variétés.`,`Beaucoup de gens l'ont vu ou utilisé.`];
      let tries = 0;
      await message.channel.send({ embeds:[new EmbedBuilder().setColor('#9B59B6').setTitle('🧞 Akinator !').setDescription(`Je pense à quelque chose...\nDevinez en 3 essais ! Tapez votre réponse.`).setFooter({text:`Récompense: 150 ${coin}`})] });
      const filter = m=>m.author.id===message.author.id;
      while (tries < 3) {
        try {
          const col = await message.channel.awaitMessages({filter,max:1,time:20000,errors:['time']});
          const guess = col.first().content.toLowerCase().trim();
          if (guess===thing || thing.includes(guess) || guess.includes(thing)) {
            db.addCoins(message.author.id, message.guild.id, 150);
            return message.channel.send({ embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle('🎉 Bravo !').setDescription(`C'était **${thing}** ! +150 ${coin}`)] });
          }
          tries++;
          if (tries < 3) message.channel.send(`❌ Non ! Indice ${tries}: *${hints[tries-1]}* (${3-tries} essai(s) restant)`);
        } catch { break; }
      }
      message.channel.send({ embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('😈 Perdu !').setDescription(`C'était **${thing}** !`)] });
    }
  },
  {
    name: 'bomb',
    aliases: ['bombe', 'hotpotato', 'patate'],
    description: 'La bombe ! Passez-la avant qu\'elle explose',
    category: 'Jeux',
    cooldown: 10,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const bet = parseInt(args[0]) || 200;
      const timer = Math.floor(Math.random()*15)+8; // 8-23 secondes
      const holder = message.author;
      let currentHolder = holder;
      let ticks = 0;

      const m = await message.channel.send({ embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('💣 LA BOMBE !').setDescription(`<@${currentHolder.id}> tient la bombe !\nMentionnez quelqu'un pour la passer !`).addFields({name:'💰 Pénalité',value:`${bet} ${coin}`,inline:true},{name:'⏱️ Temps',value:`~${timer}s`,inline:true})] });

      let exploded = false;
      const timeout = setTimeout(async () => {
        exploded = true;
        db.removeCoins(currentHolder.id, message.guild.id, bet);
        m.edit({ embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('💥 BOOM !').setDescription(`La bombe a explosé entre les mains de <@${currentHolder.id}> ! -${bet} ${coin}`)] });
      }, timer*1000);

      const filter = msg => !msg.author.bot && msg.mentions.users.size>0 && msg.author.id===currentHolder.id;
      const collector = message.channel.createMessageCollector({filter, time:timer*1000+500});
      collector.on('collect', msg => {
        if (exploded) return;
        currentHolder = msg.mentions.users.first();
        m.edit({ embeds:[new EmbedBuilder().setColor('#E67E22').setTitle('💣 BOMBE PASSÉE !').setDescription(`<@${currentHolder.id}> tient maintenant la bombe ! Passez-la vite !`)] }).catch(()=>{});
      });
    }
  },
  {
    name: 'wordchain',
    aliases: ['chainemots', 'motchaine', 'scrabble'],
    description: 'Chaîne de mots - chaque mot doit commencer par la dernière lettre',
    category: 'Jeux',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const seed = ['chat','soleil','train','nuage','arbre','bateau'];
      let current = seed[Math.floor(Math.random()*seed.length)];
      const used = new Set([current]);
      let score = 0;

      await message.channel.send({ embeds:[new EmbedBuilder().setColor('#3498DB').setTitle('🔤 Chaîne de Mots').setDescription(`Mot de départ : **${current}**\nTrouvez un mot commençant par **${current.slice(-1).toUpperCase()}** !`).setFooter({text:'30s par mot • +10 coins par mot valide'})] });
      const filter = m=>m.author.id===message.author.id&&m.content.length>2&&/^[a-zA-ZÀ-ÿ]+$/.test(m.content.trim());
      while (true) {
        try {
          const col = await message.channel.awaitMessages({filter,max:1,time:30000,errors:['time']});
          const word = col.first().content.toLowerCase().trim();
          if (word[0] !== current.slice(-1)) { await message.channel.send(`❌ **${word}** ne commence pas par **${current.slice(-1).toUpperCase()}** !`); break; }
          if (used.has(word)) { await message.channel.send(`❌ **${word}** a déjà été utilisé !`); break; }
          used.add(word); current = word; score++;
          db.addCoins(message.author.id, message.guild.id, 10);
          if (score >= 10) {
            db.addCoins(message.author.id, message.guild.id, 100);
            return message.channel.send({ embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle(`🏆 Score parfait ! ${score} mots`).setDescription(`+${score*10+100} ${coin} total !`)] });
          }
          await message.channel.send(`✅ **${word}** — Prochain : lettre **${word.slice(-1).toUpperCase()}** (${score} mots, +10 ${coin})`);
        } catch { break; }
      }
      message.channel.send({ embeds:[new EmbedBuilder().setColor('#F39C12').setTitle(`🎮 Fin ! Score: ${score} mots`).setDescription(`+${score*10} ${coin} gagnés !`)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
