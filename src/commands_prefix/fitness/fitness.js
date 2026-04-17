/**
 * NexusBot — Fitness, santé et bien-être (prefix)
 * n!exercice, n!imc, n!calories, n!programme, n!meditation, n!hydratation...
 */
const { EmbedBuilder } = require('discord.js');

const EXERCICES = [
  { name:'Pompes (push-ups)', muscles:'Pectoraux, triceps, épaules', desc:'Position planche, bras écartés largeur d\'épaules. Descendez jusqu\'à effleurer le sol.', reps:'3x15', difficulte:'Débutant' },
  { name:'Squats', muscles:'Quadriceps, fessiers, ischio-jambiers', desc:'Pieds écartés, dos droit, descendez comme pour vous asseoir. Genoux dans l\'axe des pieds.', reps:'3x20', difficulte:'Débutant' },
  { name:'Planche (plank)', muscles:'Core, abdos, lombaires', desc:'Position de pompe, bras tendus ou sur les coudes. Maintenez le corps aligné.', reps:'3x45s', difficulte:'Débutant' },
  { name:'Fentes (lunges)', muscles:'Quadriceps, fessiers, équilibre', desc:'Un pas en avant, genou arrière effleure le sol. Alternez les jambes.', reps:'3x12 (chaque jambe)', difficulte:'Intermédiaire' },
  { name:'Dips (chaise)', muscles:'Triceps, épaules', desc:'Mains sur le bord d\'une chaise, jambes devant. Fléchissez les coudes à 90°.', reps:'3x12', difficulte:'Intermédiaire' },
  { name:'Burpees', muscles:'Corps entier, cardio', desc:'Accroupissez-vous, sautez en position de planche, pompe, revenez, sautez en l\'air.', reps:'3x10', difficulte:'Avancé' },
  { name:'Mountain climbers', muscles:'Core, épaules, cardio', desc:'Position planche, amenez alternativement les genoux vers la poitrine rapidement.', reps:'3x30s', difficulte:'Intermédiaire' },
  { name:'Superman', muscles:'Lombaires, fessiers, dos', desc:'Allongé sur le ventre, levez simultanément bras et jambes. Maintenez 2s.', reps:'3x15', difficulte:'Débutant' },
  { name:'Crunchs', muscles:'Abdominaux droits', desc:'Sur le dos, genoux fléchis, mains derrière la tête. Décolllez les épaules du sol.', reps:'3x20', difficulte:'Débutant' },
  { name:'Jump squats', muscles:'Explosivité, cuisses, fessiers', desc:'Squat classique puis sautez le plus haut possible à chaque montée.', reps:'3x15', difficulte:'Avancé' },
];

const ETIREMENTS = [
  { name:'Étirement ischio-jambiers', desc:'Assis, jambe tendue, penchez-vous vers les pieds. Maintenez 30s chaque jambe.' },
  { name:'Étirement quadriceps', desc:'Debout, pliez un genou et amenez le pied vers les fesses. Maintenez 30s.' },
  { name:'Étirement épaules', desc:'Un bras en travers de la poitrine, appuyez avec l\'autre. 30s chaque côté.' },
  { name:'Étirement cervical', desc:'Penchez la tête vers l\'épaule, aidez doucement avec la main. 30s chaque côté.' },
  { name:'Chat-vache (yoga)', desc:'À 4 pattes : inspirez en creusant le dos (vache), expirez en l\'arrondissant (chat). 10 répétitions.' },
  { name:'Pigeon (fente yoga)', desc:'Genou avant plié, jambe arrière tendue. Inclinaison avant pour l\'étirement profond. 1 min chaque côté.' },
];

const MEDITATION_TECHNIQUES = [
  { name:'Respiration 4-7-8', desc:'Inspirez 4 secondes, retenez 7 secondes, expirez 8 secondes. Répétez 4 fois. Réduit le stress et aide à dormir.' },
  { name:'Cohérence cardiaque', desc:'Inspirez 5 secondes, expirez 5 secondes. 6 cycles par minute pendant 5 minutes. Régule le système nerveux autonome.' },
  { name:'Pleine conscience (mindfulness)', desc:'Asseyez-vous confortablement. Concentrez-vous uniquement sur votre respiration. Quand l\'esprit vagabonde, revenez doucement. 5-10 minutes.' },
  { name:'Body scan', desc:'Allongé, balayez mentalement votre corps des pieds à la tête, en relâchant chaque tension. 10-20 minutes.' },
  { name:'Méditation bienveillance', desc:'Visualisez des personnes que vous aimez et envoyez-leur mentalement de l\'amour et de la bienveillance. Commencez par vous-même.' },
  { name:'Respiration en boîte (box breathing)', desc:'Inspirez 4s, retenez 4s, expirez 4s, retenez vide 4s. Technique utilisée par les Navy SEALs.' },
];

const commands = [
  {
    name: 'exercice',
    aliases: ['workout', 'entrainement', 'sport_exo'],
    description: 'Exercice de fitness aléatoire avec instructions',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const e = EXERCICES[Math.floor(Math.random() * EXERCICES.length)];
      const colors = { Débutant:'#2ECC71', Intermédiaire:'#F39C12', Avancé:'#E74C3C' };
      return message.reply({ embeds: [new EmbedBuilder().setColor(colors[e.difficulte] || '#3498DB')
        .setTitle(`💪 ${e.name}`)
        .addFields(
          { name: '🎯 Muscles', value: e.muscles, inline: true },
          { name: '📊 Difficulté', value: e.difficulte, inline: true },
          { name: '🔢 Séries/Reps', value: e.reps, inline: true },
          { name: '📖 Technique', value: e.desc, inline: false },
        )] });
    }
  },
  {
    name: 'imc',
    aliases: ['bmi', 'indice_masse'],
    description: 'Calculer votre Indice de Masse Corporelle (IMC)',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const [poids, taille] = args.map(parseFloat);
      if (isNaN(poids) || isNaN(taille) || taille <= 0) {
        return message.reply('❌ Usage : `n!imc <poids_kg> <taille_m>` ex: `n!imc 70 1.75`');
      }
      const imc = poids / (taille * taille);
      let categorie, couleur;
      if (imc < 18.5)      { categorie = 'Insuffisance pondérale'; couleur = '#3498DB'; }
      else if (imc < 25)   { categorie = 'Poids normal ✅';         couleur = '#2ECC71'; }
      else if (imc < 30)   { categorie = 'Surpoids';               couleur = '#F39C12'; }
      else if (imc < 35)   { categorie = 'Obésité modérée';        couleur = '#E67E22'; }
      else                 { categorie = 'Obésité sévère';          couleur = '#E74C3C'; }
      return message.reply({ embeds: [new EmbedBuilder().setColor(couleur)
        .setTitle('📏 Indice de Masse Corporelle')
        .addFields(
          { name: '📊 IMC', value: `**${imc.toFixed(2)}**`, inline: true },
          { name: '🏷️ Catégorie', value: categorie, inline: true },
          { name: '⚖️ Paramètres', value: `${poids}kg / ${taille}m`, inline: true },
        )
        .setFooter({ text: 'IMC normal : 18.5 - 24.9 | Ce calcul est indicatif seulement.' })] });
    }
  },
  {
    name: 'calories',
    aliases: ['kcal', 'besoin_calorique', 'tdee'],
    description: 'Calculer vos besoins caloriques journaliers',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const [poids, taille, age, sexe, activite] = args;
      if (!poids || !taille || !age) {
        return message.reply('❌ Usage : `n!calories <poids_kg> <taille_cm> <age> <h/f> <activite(1-5)>`\nActivité : 1=sédentaire, 2=léger, 3=modéré, 4=actif, 5=très actif');
      }
      const p = parseFloat(poids), t = parseFloat(taille), a = parseInt(age);
      const s = sexe?.toLowerCase() === 'h' ? 'h' : 'f';
      const act = parseInt(activite) || 3;
      // Formule de Mifflin-St Jeor
      const bmr = s === 'h'
        ? 10 * p + 6.25 * t - 5 * a + 5
        : 10 * p + 6.25 * t - 5 * a - 161;
      const FACTEURS = [1, 1.2, 1.375, 1.55, 1.725, 1.9];
      const facteur = FACTEURS[Math.min(5, Math.max(1, act))];
      const tdee = Math.round(bmr * facteur);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle('🍽️ Besoins caloriques')
        .addFields(
          { name: '🔥 Maintien', value: `**${tdee} kcal/jour**`, inline: true },
          { name: '📉 Perte de poids', value: `**${tdee - 500} kcal/jour**`, inline: true },
          { name: '📈 Prise de masse', value: `**${tdee + 300} kcal/jour**`, inline: true },
          { name: '💤 Métabolisme de base', value: `${Math.round(bmr)} kcal`, inline: true },
        )
        .setFooter({ text: 'Formule Mifflin-St Jeor — Consultez un professionnel de santé.' })] });
    }
  },
  {
    name: 'programme_fitness',
    aliases: ['plan_sport', 'programme', 'fitness_plan'],
    description: 'Programme d\'entraînement sur mesure',
    category: 'Fitness',
    cooldown: 10,
    async execute(message, args) {
      const niveau = args[0]?.toLowerCase() || 'debutant';
      const PROGRAMMES = {
        debutant: {
          titre: '🟢 Programme Débutant (3j/semaine)',
          jours: [
            'Lundi : 3x15 pompes, 3x20 squats, 3x45s planche, 3x20 crunchs',
            'Mercredi : 3x10 dips chaise, 3x12 fentes (chaque jambe), 3x15 Superman, marche 20 min',
            'Vendredi : Circuit complet : 2 tours de [15 pompes, 20 squats, 30s planche, 10 fentes, 15s mountain climber]',
          ]
        },
        intermediaire: {
          titre: '🟡 Programme Intermédiaire (4j/semaine)',
          jours: [
            'Lundi (Haut du corps): 4x12 pompes, 4x10 dips, 4x15 pike push-ups, 4x20 mountain climbers',
            'Mardi (Bas du corps): 4x15 squats, 4x12 fentes, 4x15 jump squats, 4x20 calf raises',
            'Jeudi (Core+cardio): 4x20 crunchs, 4x1min planche, 4x20 Russian twists, 20 min HIIT',
            'Samedi (Full body): 3 tours : [10 burpees, 15 pompes, 20 squats, 30s planche]',
          ]
        },
        avance: {
          titre: '🔴 Programme Avancé (5j/semaine)',
          jours: [
            'Lun (Push): 5x15 pompes, 5x12 pike push-ups, 5x10 dips, 5x20 tricep push-ups',
            'Mar (Pull+Core): 5x10 pull-ups (si barre), 5x15 crunchs, 5x1min planche, 5x20 Russian twists',
            'Mer (Legs): 5x20 squats, 5x15 jump squats, 5x12 bulgarians, 5x20 calf raises',
            'Jeu (HIIT): 8 rounds de : [30s burpees, 30s mountain climbers, 30s jump squats, 30s rest]',
            'Ven (Full body force): Complexe : 5 rounds [5 burpees, 10 pompes, 15 squats, 20 mountain climbers]',
          ]
        }
      };
      const prog = PROGRAMMES[niveau] || PROGRAMMES.debutant;
      const desc = prog.jours.map((j, i) => `**${j}**`).join('\n\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(prog.titre)
        .setDescription(desc)
        .setFooter({ text: 'Niveaux disponibles : debutant, intermediaire, avance | Repos et étirements inclus recommandés !' })] });
    }
  },
  {
    name: 'etirement',
    aliases: ['stretch', 'souplesse', 'flex'],
    description: 'Exercice d\'étirement guidé',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const e = ETIREMENTS[Math.floor(Math.random() * ETIREMENTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1ABC9C')
        .setTitle(`🧘 ${e.name}`)
        .setDescription(e.desc)] });
    }
  },
  {
    name: 'meditation',
    aliases: ['mediter', 'relaxation', 'zen'],
    description: 'Technique de méditation guidée',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const m = MEDITATION_TECHNIQUES[Math.floor(Math.random() * MEDITATION_TECHNIQUES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🧘 ${m.name}`)
        .setDescription(m.desc)] });
    }
  },
  {
    name: 'hydratation',
    aliases: ['eau', 'boire', 'water'],
    description: 'Calculer vos besoins en eau quotidiens',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const poids = parseFloat(args[0]);
      if (isNaN(poids) || poids <= 0) return message.reply('❌ Usage : `n!hydratation <poids_kg>` ex: `n!hydratation 70`');
      const litres = (poids * 35 / 1000).toFixed(2);
      const verres = Math.ceil(parseFloat(litres) / 0.25);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('💧 Besoins en eau')
        .addFields(
          { name: '💧 Litres/jour', value: `**${litres} L**`, inline: true },
          { name: '🥛 Verres (25cl)', value: `**~${verres} verres**`, inline: true },
          { name: '📊 Formule', value: `35ml × ${poids}kg`, inline: true },
          { name: '💡 Conseil', value: 'Augmentez de 0.5-1L par heure de sport ou temps chaud.', inline: false },
        )
        .setFooter({ text: 'Valeur indicative (30-40ml/kg selon l\'activité)' })] });
    }
  },
  {
    name: 'sommeil',
    aliases: ['sleep', 'dormir', 'repos'],
    description: 'Conseils et calcul des cycles de sommeil',
    category: 'Fitness',
    cooldown: 5,
    async execute(message, args) {
      const heure = args[0]; // HH:MM
      if (heure) {
        const [h, m] = heure.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const reveils = [5, 6, 7, 8].map(cycles => {
            const mins = h * 60 + m + cycles * 90 + 14; // +14 min pour s'endormir
            const rH = Math.floor((mins / 60) % 24).toString().padStart(2, '0');
            const rM = (mins % 60).toString().padStart(2, '0');
            return `${rH}:${rM} (${cycles} cycles)`;
          });
          return message.reply({ embeds: [new EmbedBuilder().setColor('#1A1A2E')
            .setTitle('🌙 Calcul des cycles de sommeil')
            .setDescription(`Si vous vous couchez à **${heure}**, réveillez-vous à :`)
            .addFields({ name: '⏰ Heures idéales', value: reveils.join('\n'), inline: false })
            .setFooter({ text: 'Chaque cycle = 90 minutes. Se réveiller entre 2 cycles = plus reposé.' })] });
        }
      }
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1A1A2E')
        .setTitle('😴 Guide du sommeil')
        .addFields(
          { name: '🧠 Besoins moyens', value: 'Adulte : 7-9h | Ado : 8-10h | Enfant : 9-11h', inline: false },
          { name: '💡 Cycle de sommeil', value: '90 minutes : Léger → Profond → REM (rêves)', inline: false },
          { name: '📱 Écrans', value: 'Évitez les écrans 1h avant le coucher (lumière bleue ↑ cortisol)', inline: false },
          { name: '🌡️ Température idéale', value: '16-19°C dans la chambre', inline: false },
          { name: '⏰ Usage', value: '`n!sommeil HH:MM` pour calculer vos heures de réveil idéales', inline: false },
        )] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
