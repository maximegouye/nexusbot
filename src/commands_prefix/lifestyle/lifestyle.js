/**
 * NexusBot — Lifestyle, productivité et développement personnel (prefix)
 * n!pomodoro, n!objectif, n!habit_tracker, n!gratitude, n!bucket_list, n!focus...
 */
const { EmbedBuilder } = require('discord.js');

const CONSEILS_PROD = [
  "📝 **Règle 2 minutes** : Si une tâche prend moins de 2 min, faites-la immédiatement.",
  "🎯 **Méthode Ivy Lee** : Le soir, listez vos 6 priorités de demain, classées par importance.",
  "🐸 **Eat the Frog** : Commencez par votre tâche la plus difficile / la moins plaisante.",
  "🔕 **Deep Work** : Bloquez 90-120 min sans distraction pour un travail de haute valeur.",
  "📵 **No-Phone Morning** : Évitez votre téléphone dans les 30 premières minutes de la journée.",
  "📦 **Boîte à idées** : Notez toutes les idées qui vous viennent — le cerveau est fait pour créer, pas stocker.",
  "🔁 **Revue hebdomadaire** : Chaque dimanche, revoyez vos objectifs et planifiez la semaine.",
  "⏰ **Time-blocking** : Réservez des créneaux dans votre agenda pour chaque type de tâche.",
  "🏃 **1% par jour** : S\'améliorer d\'1% chaque jour = 37x meilleur en 1 an (1.01^365 = 37.8).",
  "💭 **Mind-dump** : Videz votre cerveau sur papier le soir — réduit l\'anxiété et améliore le sommeil.",
];

const HABITUDES_SAINES = [
  { hab:'Méditer 10 min/jour', benefice:'Réduit le stress, améliore la concentration et le sommeil.', difficulte:'Facile', temps:'10 min' },
  { hab:'Boire 2L d\'eau/jour', benefice:'Énergie, peau, digestion, concentration optimales.', difficulte:'Facile', temps:'Toute la journée' },
  { hab:'Marcher 30 min/jour', benefice:'Santé cardiovasculaire, humeur, créativité.', difficulte:'Facile', temps:'30 min' },
  { hab:'Lire 20 pages/jour', benefice:'Culture, vocabulaire, empathie, détente.', difficulte:'Facile', temps:'20-30 min' },
  { hab:'Journaling (5 min)', benefice:'Clarté mentale, gratitude, traitement émotionnel.', difficulte:'Facile', temps:'5 min' },
  { hab:'Se coucher à heure fixe', benefice:'Qualité du sommeil améliorée, énergie constante.', difficulte:'Modéré', temps:'Ritual soir' },
  { hab:'Planifier la journée la veille', benefice:'Réduit la procrastination, meilleure exécution.', difficulte:'Facile', temps:'5-10 min' },
  { hab:'Réduire les réseaux sociaux à 30 min', benefice:'Concentration, moins d\'anxiété, plus de temps.', difficulte:'Difficile', temps:'En continu' },
];

const CITATIONS_PERSO = [
  "La discipline est choisir entre ce que tu veux maintenant et ce que tu veux le plus.",
  "Le succès n'est pas final, l'échec n'est pas fatal. C'est le courage de continuer qui compte.",
  "Vous n'avez pas besoin d'être parfait pour commencer, mais vous devez commencer pour être parfait.",
  "Chaque expert était autrefois un débutant.",
  "L'avenir appartient à ceux qui préparent aujourd'hui.",
  "Ce n'est pas ce qui vous arrive qui compte, mais comment vous y réagissez.",
  "Votre temps est limité — ne le gaspillez pas à vivre la vie de quelqu'un d'autre.",
];

const commands = [
  {
    name: 'productivite',
    aliases: ['prod', 'conseil_prod', 'efficacite'],
    description: 'Conseil de productivité aléatoire',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      const c = CONSEILS_PROD[Math.floor(Math.random() * CONSEILS_PROD.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('⚡ Conseil Productivité')
        .setDescription(c)] });
    }
  },
  {
    name: 'habitude',
    aliases: ['habit', 'bonne_habitude', 'routine'],
    description: 'Habitude saine à adopter',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      const h = HABITUDES_SAINES[Math.floor(Math.random() * HABITUDES_SAINES.length)];
      const colors = { Facile:'#2ECC71', Modéré:'#F39C12', Difficile:'#E74C3C' };
      return message.reply({ embeds: [new EmbedBuilder().setColor(colors[h.difficulte] || '#3498DB')
        .setTitle(`✅ Habitude : ${h.hab}`)
        .addFields(
          { name: '🎯 Bénéfice', value: h.benefice, inline: false },
          { name: '📊 Difficulté', value: h.difficulte, inline: true },
          { name: '⏱️ Temps', value: h.temps, inline: true },
        )] });
    }
  },
  {
    name: 'pomodoro',
    aliases: ['pomo', 'timer_prod', 'focus_timer'],
    description: 'Guide de la technique Pomodoro',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('🍅 Technique Pomodoro')
        .setDescription('La méthode Pomodoro divise le travail en blocs de 25 minutes avec des pauses régulières.')
        .addFields(
          { name: '⏱️ 1 Pomodoro', value: '25 min de travail concentré', inline: true },
          { name: '☕ Pause courte', value: '5 min après chaque Pomodoro', inline: true },
          { name: '🛋️ Pause longue', value: '15-30 min après 4 Pomodoros', inline: true },
          { name: '📋 Règles', value: '• Aucune distraction pendant le Pomodoro\n• Si interrompu, recommencez à zéro\n• Notez les idées parasites sur papier', inline: false },
          { name: '💡 Astuce', value: 'Utilisez `/rappel` de NexusBot pour programmer vos sessions !', inline: false },
        )] });
    }
  },
  {
    name: 'gratitude',
    aliases: ['merci', 'positive', 'positif'],
    description: 'Exercice de gratitude quotidien',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      const name = message.member?.displayName || message.author.username;
      const PROMPTS = [
        "Cite 3 choses qui se sont bien passées aujourd'hui.",
        "Qui t'a aidé récemment ? Comment pourrais-tu le remercier ?",
        "Quelle compétence es-tu content(e) de posséder ?",
        "Quel moment de bonheur simple as-tu vécu aujourd'hui ?",
        "Qu'est-ce que tu as appris cette semaine ?",
        "Nomme une personne importante dans ta vie et pourquoi tu lui es reconnaissant(e).",
        "Quel défi as-tu surmonté récemment dont tu peux être fier(ère) ?",
      ];
      const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`🙏 Exercice de Gratitude pour ${name}`)
        .setDescription(`**${p}**`)
        .setFooter({ text: 'Prenez 2 minutes pour y réfléchir sincèrement 💛' })] });
    }
  },
  {
    name: 'objectif',
    aliases: ['goal', 'smart_goal', 'but'],
    description: 'Framework SMART pour fixer un objectif',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      if (!args.length) {
        return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
          .setTitle('🎯 Méthode SMART pour vos objectifs')
          .addFields(
            { name: '🅢 Spécifique', value: 'Votre objectif doit être clair et précis.', inline: false },
            { name: '🅜 Mesurable', value: 'Comment saurez-vous que vous avez réussi ?', inline: false },
            { name: '🅐 Atteignable', value: 'Est-il réaliste compte tenu de vos ressources ?', inline: false },
            { name: '🅡 Réaliste', value: 'Correspond-il à vos valeurs et priorités ?', inline: false },
            { name: '🅣 Temporel', value: 'Quelle est la date limite ?', inline: false },
            { name: '💡 Exemple', value: '❌ "Je veux courir"\n✅ "Je cours 5km sans m\'arrêter d\'ici le 1er août, en m\'entraînant 3x/semaine"', inline: false },
          )] });
      }
      const objectif = args.join(' ');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('🎯 Analyse SMART de votre objectif')
        .setDescription(`**Objectif :** *"${objectif}"*`)
        .addFields(
          { name: '✅ Spécifique ?', value: 'Précisez qui, quoi, où, quand, comment.', inline: true },
          { name: '✅ Mesurable ?', value: 'Ajoutez un chiffre : combien, quelle fréquence.', inline: true },
          { name: '✅ Temporel ?', value: 'Définissez une deadline précise.', inline: true },
        )] });
    }
  },
  {
    name: 'bucket_list',
    aliases: ['bucketlist', 'avant_de_mourir', 'liste_vie'],
    description: 'Idées de bucket list (liste de vie)',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      const ITEMS = [
        "🌏 Voyager dans au moins 10 pays différents",
        "🏔️ Gravir une grande montagne ou marcher un sentier célèbre",
        "📚 Lire 100 livres dans sa vie",
        "🎸 Apprendre à jouer d'un instrument de musique",
        "🌊 Plonger sous l'eau et voir un récif corallien",
        "🏃 Courir un semi-marathon ou marathon",
        "🌅 Voir un lever de soleil depuis un endroit magnifique",
        "✍️ Écrire son histoire, même un court récit autobiographique",
        "🤝 Faire du bénévolat pour une cause qui vous touche",
        "🌟 Apprendre une nouvelle langue étrangère",
        "🎨 Créer quelque chose avec vos mains (peinture, sculpture, construction)",
        "🌌 Observer des étoiles dans un endroit sans pollution lumineuse",
      ];
      const shuffled = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 5);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle('🌟 5 idées de Bucket List')
        .setDescription(shuffled.join('\n'))
        .setFooter({ text: 'Quelle est votre n°1 ? Partagez-la !' })] });
    }
  },
  {
    name: 'mindset',
    aliases: ['etat_esprit', 'croissance', 'growth'],
    description: 'Conseil mindset et état d\'esprit de croissance',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      const MINDSETS = [
        { fixed:'❌ Fixe : "Je ne suis pas doué pour ça."', growth:'✅ Croissance : "Je ne suis pas encore doué — je peux apprendre."' },
        { fixed:'❌ Fixe : "Les talents sont innés."', growth:'✅ Croissance : "Les compétences se développent avec l\'effort."' },
        { fixed:'❌ Fixe : "L\'échec me définit."', growth:'✅ Croissance : "L\'échec est une information, pas une identité."' },
        { fixed:'❌ Fixe : "Je n\'ai pas le temps."', growth:'✅ Croissance : "Je choisis où mettre mon temps."' },
        { fixed:'❌ Fixe : "C\'est trop difficile."', growth:'✅ Croissance : "C\'est difficile — ça vaut la peine d\'essayer."' },
      ];
      const m = MINDSETS[Math.floor(Math.random() * MINDSETS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#27AE60')
        .setTitle('🧠 Mindset de Croissance vs Fixe')
        .addFields(
          { name: '🚫 Mindset Fixe', value: m.fixed, inline: false },
          { name: '✨ Mindset de Croissance', value: m.growth, inline: false },
        )
        .setFooter({ text: 'Carol Dweck — Mindset: The New Psychology of Success (2006)' })] });
    }
  },
  {
    name: 'bilan_jour',
    aliases: ['daily_review', 'journee', 'soir_bilan'],
    description: 'Bilan de journée guidé (journaling)',
    category: 'Mode de vie',
    cooldown: 5,
    async execute(message, args) {
      const name = message.member?.displayName || message.author.username;
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1ABC9C')
        .setTitle(`📔 Bilan de journée — ${name}`)
        .setDescription('Prenez 5-10 minutes pour répondre à ces questions dans votre journal :')
        .addFields(
          { name: '✅ Réussites', value: 'Qu\'ai-je accompli aujourd\'hui ? (même de petites choses)', inline: false },
          { name: '📚 Apprentissages', value: 'Qu\'ai-je appris aujourd\'hui ?', inline: false },
          { name: '💪 Défis', value: 'Qu\'est-ce qui m\'a été difficile ? Comment le gérer mieux ?', inline: false },
          { name: '🙏 Gratitude', value: 'Citez 1-3 choses pour lesquelles vous êtes reconnaissant(e).', inline: false },
          { name: '🎯 Demain', value: 'Quelle est ma priorité n°1 pour demain ?', inline: false },
        )] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
