const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tournois (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT,
    game TEXT, prize TEXT,
    max_players INTEGER DEFAULT 8,
    status TEXT DEFAULT 'inscription',
    bracket TEXT DEFAULT '[]',
    current_round INTEGER DEFAULT 1,
    created_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tournoi_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournoi_id INTEGER, guild_id TEXT,
    user_id TEXT, score INTEGER DEFAULT 0,
    eliminated INTEGER DEFAULT 0,
    joined_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(tournoi_id, user_id)
  )`).run();
} catch {}

function generateBracket(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const rounds = [];
  let currentRound = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    currentRound.push({ p1: shuffled[i], p2: shuffled[i+1], winner: null });
  }
  if (shuffled.length % 2 !== 0) currentRound.push({ p1: shuffled[shuffled.length-1], p2: null, winner: shuffled[shuffled.length-1] });
  rounds.push(currentRound);
  return rounds;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournoi')
    .setDescription('🏆 Système de tournois avec bracket automatique')
    .addSubcommand(s => s.setName('creer').setDescription('🏆 Créer un tournoi (Admin/Staff)')
      .addStringOption(o => o.setName('nom').setDescription('Nom du tournoi').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('jeu').setDescription('Jeu/activité').setRequired(true))
      .addStringOption(o => o.setName('prix').setDescription('Prix/récompense').setRequired(true))
      .addIntegerOption(o => o.setName('max').setDescription('Max joueurs (4, 8, 16)').addChoices(
        { name: '4 joueurs', value: 4 }, { name: '8 joueurs', value: 8 }, { name: '16 joueurs', value: 16 }
      )))
    .addSubcommand(s => s.setName('inscrire').setDescription('✋ S\'inscrire à un tournoi')
      .addIntegerOption(o => o.setName('id').setDescription('ID du tournoi').setRequired(true)))
    .addSubcommand(s => s.setName('lancer').setDescription('▶️ Lancer le tournoi (Admin/Staff)')
      .addIntegerOption(o => o.setName('id').setDescription('ID du tournoi').setRequired(true)))
    .addSubcommand(s => s.setName('resultat').setDescription('✅ Entrer le résultat d\'un match (Admin/Staff)')
      .addIntegerOption(o => o.setName('id').setDescription('ID du tournoi').setRequired(true))
      .addUserOption(o => o.setName('gagnant').setDescription('Joueur gagnant du match').setRequired(true)))
    .addSubcommand(s => s.setName('bracket').setDescription('📊 Voir le bracket du tournoi')
      .addIntegerOption(o => o.setName('id').setDescription('ID du tournoi').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les tournois actifs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const isStaff = interaction.member.permissions.has(0x4000n);

    if (sub === 'creer') {
      if (!isStaff) return interaction.reply({ content: '❌ Staff uniquement.', ephemeral: true });
      const nom = interaction.options.getString('nom');
      const jeu = interaction.options.getString('jeu');
      const prix = interaction.options.getString('prix');
      const max = parseInt(interaction.options.getString('max')) || 8;

      const result = db.db.prepare('INSERT INTO tournois (guild_id, name, game, prize, max_players, created_by) VALUES (?,?,?,?,?,?)').run(guildId, nom, jeu, prix, max, userId);
      const id = result.lastInsertRowid;

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle(`🏆 Tournoi créé — ${nom}`)
        .addFields(
          { name: '🎮 Jeu', value: jeu, inline: true },
          { name: '🏅 Prix', value: prix, inline: true },
          { name: '👥 Max', value: `${max} joueurs`, inline: true },
          { name: '🆔 ID', value: `#${id}`, inline: true },
        )
        .setDescription('Les inscriptions sont ouvertes ! Utilisez `/tournoi inscrire id:' + id + '`')
        .setFooter({ text: `Organisé par ${interaction.user.username}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tournoi_join_${id}`).setLabel('✋ S\'inscrire').setStyle(ButtonStyle.Success)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (sub === 'inscrire') {
      const id = parseInt(interaction.options.getString('id'));
      const tournoi = db.db.prepare('SELECT * FROM tournois WHERE id=? AND guild_id=?').get(id, guildId);
      if (!tournoi) return interaction.reply({ content: `❌ Tournoi #${id} introuvable.`, ephemeral: true });
      if (tournoi.status !== 'inscription') return interaction.reply({ content: '❌ Les inscriptions sont fermées.', ephemeral: true });

      const count = db.db.prepare('SELECT COUNT(*) as c FROM tournoi_players WHERE tournoi_id=?').get(id);
      if (count.c >= tournoi.max_players) return interaction.reply({ content: '❌ Le tournoi est complet.', ephemeral: true });

      try {
        db.db.prepare('INSERT INTO tournoi_players (tournoi_id, guild_id, user_id) VALUES (?,?,?)').run(id, guildId, userId);
      } catch {
        return interaction.reply({ content: '❌ Vous êtes déjà inscrit.', ephemeral: true });
      }

      return interaction.reply({ content: `✅ Inscrit au tournoi **${tournoi.name}** ! (${count.c + 1}/${tournoi.max_players})`, ephemeral: true });
    }

    if (sub === 'lancer') {
      if (!isStaff) return interaction.reply({ content: '❌ Staff uniquement.', ephemeral: true });
      const id = parseInt(interaction.options.getString('id'));
      const tournoi = db.db.prepare('SELECT * FROM tournois WHERE id=? AND guild_id=?').get(id, guildId);
      if (!tournoi) return interaction.reply({ content: `❌ Tournoi #${id} introuvable.`, ephemeral: true });
      if (tournoi.status !== 'inscription') return interaction.reply({ content: '❌ Ce tournoi a déjà commencé ou est terminé.', ephemeral: true });

      const players = db.db.prepare('SELECT user_id FROM tournoi_players WHERE tournoi_id=? AND eliminated=0').all(id);
      if (players.length < 2) return interaction.reply({ content: '❌ Au moins 2 joueurs requis pour lancer.', ephemeral: true });

      const bracket = generateBracket(players.map(p => p.user_id));
      db.db.prepare('UPDATE tournois SET status=?, bracket=? WHERE id=?').run('en_cours', JSON.stringify(bracket), id);

      const match = bracket[0][0];
      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle(`🏆 ${tournoi.name} — Tour 1`)
        .setDescription(`Le tournoi **${tournoi.name}** a commencé !\n\n**Premier match :**\n<@${match.p1}> ⚔️ ${match.p2 ? `<@${match.p2}>` : 'BYE (passe automatiquement)'}`)
        .addFields({ name: '👥 Joueurs', value: `${players.length}`, inline: true }, { name: '🏅 Prix', value: tournoi.prize, inline: true });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'resultat') {
      if (!isStaff) return interaction.reply({ content: '❌ Staff uniquement.', ephemeral: true });
      const id = parseInt(interaction.options.getString('id'));
      const winner = interaction.options.getUser('gagnant');
      const tournoi = db.db.prepare('SELECT * FROM tournois WHERE id=? AND guild_id=?').get(id, guildId);
      if (!tournoi || tournoi.status !== 'en_cours') return interaction.reply({ content: '❌ Tournoi introuvable ou non actif.', ephemeral: true });

      const bracket = JSON.parse(tournoi.bracket || '[]');
      const round = bracket[tournoi.current_round - 1];
      if (!round) return interaction.reply({ content: '❌ Erreur de bracket.', ephemeral: true });

      // Trouver le match avec ce joueur
      const matchIdx = round.findIndex(m => !m.winner && (m.p1 === winner.id || m.p2 === winner.id));
      if (matchIdx === -1) return interaction.reply({ content: '❌ Match introuvable pour ce joueur dans ce tour.', ephemeral: true });

      round[matchIdx].winner = winner.id;
      const loserId = round[matchIdx].p1 === winner.id ? round[matchIdx].p2 : round[matchIdx].p1;
      if (loserId) db.db.prepare('UPDATE tournoi_players SET eliminated=1 WHERE tournoi_id=? AND user_id=?').run(id, loserId);

      // Vérifier si le tour est terminé
      const allDone = round.every(m => m.winner);
      let embed;

      if (allDone) {
        const winners = round.map(m => m.winner).filter(Boolean);
        if (winners.length === 1) {
          // Tournoi terminé !
          db.db.prepare('UPDATE tournois SET status=? WHERE id=?').run('termine', id);
          const cfg = db.getConfig(guildId);
          const coinEmoji = cfg.currency_emoji || '🪙';
          db.addCoins(winners[0], guildId, 5000);
          db.addXP(winners[0], guildId, 1000);

          embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 ${tournoi.name} — FINALE `)
            .setDescription(`🎉 <@${winners[0]}> remporte le tournoi **${tournoi.name}** !`)
            .addFields(
              { name: '🏅 Prix', value: tournoi.prize, inline: true },
              { name: '🎁 Bonus', value: `+5000 ${coinEmoji} +1000 XP`, inline: true },
            );
        } else {
          // Préparer le prochain tour
          const nextRound = generateBracket(winners)[0];
          bracket.push(nextRound);
          db.db.prepare('UPDATE tournois SET bracket=?, current_round=current_round+1 WHERE id=?').run(JSON.stringify(bracket), id);

          embed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle(`🏆 ${tournoi.name} — Tour ${tournoi.current_round + 1}`)
            .setDescription(`Tour ${tournoi.current_round} terminé !\n\n**Prochains matchs :**\n` +
              nextRound.map(m => `<@${m.p1}> ⚔️ ${m.p2 ? `<@${m.p2}>` : 'BYE'}`).join('\n'));
        }
      } else {
        db.db.prepare('UPDATE tournois SET bracket=? WHERE id=?').run(JSON.stringify(bracket), id);
        embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle(`✅ Résultat enregistré`)
          .setDescription(`<@${winner.id}> avance au tour suivant !${loserId ? `\n<@${loserId}> est éliminé.` : ''}`);
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'bracket') {
      const id = parseInt(interaction.options.getString('id'));
      const tournoi = db.db.prepare('SELECT * FROM tournois WHERE id=? AND guild_id=?').get(id, guildId);
      if (!tournoi) return interaction.reply({ content: `❌ Tournoi #${id} introuvable.`, ephemeral: true });

      const bracket = JSON.parse(tournoi.bracket || '[]');
      const players = db.db.prepare('SELECT user_id, eliminated FROM tournoi_players WHERE tournoi_id=?').all(id);

      const desc = bracket.map((round, ri) => {
        const roundLines = round.map(m => {
          const w = m.winner ? `✅ <@${m.winner}>` : '⏳';
          return `<@${m.p1}> vs ${m.p2 ? `<@${m.p2}>` : 'BYE'} → ${w}`;
        }).join('\n');
        return `**Tour ${ri + 1}**\n${roundLines}`;
      }).join('\n\n');

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`🏆 Bracket — ${tournoi.name}`)
          .setDescription(desc || '*Pas encore commencé.*')
          .addFields(
            { name: '📊 Statut', value: tournoi.status, inline: true },
            { name: '👥 Joueurs', value: `${players.length}/${tournoi.max_players}`, inline: true },
          )
      ]});
    }

    if (sub === 'liste') {
      const tournois = db.db.prepare("SELECT * FROM tournois WHERE guild_id=? AND status != 'termine' ORDER BY created_at DESC LIMIT 10").all(guildId);
      if (!tournois.length) return interaction.reply({ content: '❌ Aucun tournoi actif.', ephemeral: true });

      const desc = tournois.map(t => {
        const statusEmoji = t.status === 'inscription' ? '📝' : t.status === 'en_cours' ? '⚔️' : '🏁';
        const count = db.db.prepare('SELECT COUNT(*) as c FROM tournoi_players WHERE tournoi_id=?').get(t.id);
        return `${statusEmoji} **#${t.id} — ${t.name}** (${t.game}) — ${count.c}/${t.max_players} joueurs`;
      }).join('\n');

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Tournois').setDescription(desc)
      ]});
    }
  }
};
