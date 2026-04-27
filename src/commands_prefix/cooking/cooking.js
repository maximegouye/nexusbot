/**
 * NexusBot — Cuisine et recettes (prefix)
 * n!recette, n!ingredient, n!technique, n!conversion_cuisine, n!epice, n!menu...
 */
const { EmbedBuilder } = require('discord.js');

const RECETTES = [
  { name:'Crêpes françaises', temps:'30 min', difficulte:'Facile', personnes:4, ingr:'250g farine, 3 œufs, 50cl lait, 30g beurre, 1 pincée sel', steps:'1. Mélanger farine + sel dans un saladier.\n2. Creuser un puits, ajouter les œufs.\n3. Incorporer le lait progressivement pour éviter les grumeaux.\n4. Ajouter le beurre fondu.\n5. Cuire 1-2 min de chaque côté dans une poêle huilée.' },
  { name:'Riz au lait', temps:'35 min', difficulte:'Facile', personnes:4, ingr:'200g riz rond, 1L lait, 80g sucre, 1 gousse vanille, cannelle', steps:'1. Rincer le riz.\n2. Mettre dans casserole avec lait + sucre + vanille fendue.\n3. Cuire à feu doux 30 min en remuant souvent.\n4. Servir chaud ou froid avec cannelle.' },
  { name:'Ratatouille', temps:'1h', difficulte:'Intermédiaire', personnes:4, ingr:'2 courgettes, 2 aubergines, 3 tomates, 1 poivron, 1 oignon, huile olive, ail, herbes', steps:'1. Couper tous les légumes en dés.\n2. Faire revenir l\'oignon et l\'ail.\n3. Ajouter aubergine puis courgette puis poivron.\n4. Ajouter les tomates, sel, poivre, herbes.\n5. Mijoter 40 min à couvert.' },
  { name:'Omelette parfaite', temps:'10 min', difficulte:'Facile', personnes:2, ingr:'4 œufs, 20g beurre, sel, poivre, herbes au choix', steps:'1. Battre les œufs énergiquement avec sel et poivre.\n2. Faire fondre beurre dans poêle très chaude.\n3. Verser les œufs, remuer avec une spatule en faisant des 8.\n4. Laisser prendre légèrement puis rouler en demi-lune.\n5. Servir immédiatement.' },
  { name:'Guacamole', temps:'10 min', difficulte:'Facile', personnes:4, ingr:'3 avocats mûrs, 1 citron vert, 1 oignon rouge, 1 tomate, coriandre, sel, piment', steps:'1. Écraser les avocats à la fourchette (garder des morceaux).\n2. Ajouter jus de citron vert immédiatement (évite l\'oxydation).\n3. Mixer oignon, tomate coupée en dés, coriandre ciselée.\n4. Assaisonner sel, piment selon goût.\n5. Servir avec nachos ou légumes.' },
  { name:'Soupe à l\'oignon', temps:'1h', difficulte:'Intermédiaire', personnes:4, ingr:'1kg oignons, 80g beurre, 25cl vin blanc, 1L bouillon bœuf, gruyère râpé, pain grillé', steps:'1. Émincer finement les oignons.\n2. Faire fondre dans le beurre 30 min à feu moyen jusqu\'à caramélisation.\n3. Déglacer au vin blanc.\n4. Ajouter le bouillon, cuire 20 min.\n5. Verser en bols, croûton + gruyère, gratiner au four 5 min.' },
  { name:'Poulet mariné au citron', temps:'45 min (+2h marinade)', difficulte:'Intermédiaire', personnes:4, ingr:'4 escalopes poulet, 2 citrons, 4 gousses ail, thym, huile olive, sel, poivre', steps:'1. Mélanger jus citrons + ail écrasé + thym + huile + sel/poivre.\n2. Mariner le poulet 2h minimum.\n3. Cuire à la poêle 6 min de chaque côté.\n4. Déglacer avec la marinade restante.\n5. Servir avec légumes grillés ou riz.' },
];

const EPICES = [
  { name:'Curcuma', origine:'Inde', saveur:'Terreux, légèrement amer', usages:'Curry, riz, smoothies, anti-inflammatoire naturel.', fait:'Utilisé depuis 4 000 ans. Colorant naturel jaune.' },
  { name:'Cumin', origine:'Moyen-Orient', saveur:'Chaud, épicé, légèrement amer', usages:'Couscous, tajine, guacamole, houmous.', fait:'Plante cultivée depuis -5000 ans en Égypte.' },
  { name:'Cannelle', origine:'Sri Lanka', saveur:'Douce, chaude, légèrement sucrée', usages:'Desserts, boissons chaudes, tajines marocains.', fait:'Écorce interne séchée de l\'arbre Cinnamomum.' },
  { name:'Paprika', origine:'Hongrie', saveur:'Doux à fort selon la variété', usages:'Goulasch, poulet, sauces, charcuteries.', fait:'Fait de poivrons séchés moulus. Riche en vitamine C.' },
  { name:'Safran', origine:'Perse/Espagne', saveur:'Floral, légèrement métallique, très aromatique', usages:'Paella, risotto, bouillabaisse.', fait:'Épice la plus chère au monde (1g = 10-15€). Pistils de crocus.' },
  { name:'Cardamome', origine:'Inde/Guatemala', saveur:'Complexe : menthe, citron, épicé', usages:'Thé chai, café arabe, pâtisseries scandinaves.', fait:'3ème épice la plus chère après safran et vanille.' },
  { name:'Coriandre', origine:'Méditerranée/Asie', saveur:'Citronné, frais (feuilles), chaud (graines)', usages:'Guacamole, curry, tajine, cuisine asiatique.', fait:'Certaines personnes y trouvent un goût de savon — génétique !' },
];

const TECHNIQUES = [
  { name:'Blanchir', desc:'Plonger brièvement dans eau bouillante puis dans eau glacée. But : conserver couleur, précuire légèrement, peler facilement.' },
  { name:'Déglacer', desc:'Verser un liquide (vin, bouillon) dans une poêle chaude après cuisson pour récupérer les sucs caramélisés.' },
  { name:'Chemiser', desc:'Tapisser le fond et les bords d\'un moule de papier cuisson ou de beurre/farine.' },
  { name:'Julienne', desc:'Couper en bâtonnets fins et réguliers (2-3mm). Technique de coupe classique pour légumes.' },
  { name:'Brunoise', desc:'Couper en très petits dés (2-3mm de côté). Base de nombreuses sauces et garnitures.' },
  { name:'Monter au beurre', desc:'Ajouter du beurre froid en petits dés hors du feu dans une sauce pour l\'émulsionner et lui donner brillant.' },
  { name:'Sauter', desc:'Cuire rapidement à feu vif dans peu de matière grasse, en remuant souvent.' },
  { name:'Mirepoix', desc:'Mélange aromatique de carottes, céleri et oignon coupés en dés. Base de nombreuses sauces et bouillons.' },
];

const CONVERSIONS_CUISINE = {
  '1 tasse farine': '120g',
  '1 tasse sucre': '200g',
  '1 tasse beurre': '227g',
  '1 c. à café': '5ml',
  '1 c. à soupe': '15ml',
  '1 tasse liquide': '240ml',
  '1 once': '28g',
  '1 livre (lb)': '454g',
};

const commands = [
  {
    name: 'recette',
    aliases: ['recipe', 'cuisine', 'plat_recette'],
    description: 'Recette simple et détaillée',
    category: 'Cuisine',
    cooldown: 5,
    async run(message, args) {
      const search = args.join(' ').toLowerCase();
      let r;
      if (search) {
        r = RECETTES.find(x => x.name.toLowerCase().includes(search) ||
          x.ingr.toLowerCase().includes(search));
      }
      if (!r) r = RECETTES[Math.floor(Math.random() * RECETTES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`🍳 ${r.name}`)
        .addFields(
          { name: '⏱️ Temps', value: r.temps, inline: true },
          { name: '📊 Difficulté', value: r.difficulte, inline: true },
          { name: '👥 Personnes', value: r.personnes.toString(), inline: true },
          { name: '🛒 Ingrédients', value: r.ingr, inline: false },
          { name: '📖 Préparation', value: r.steps, inline: false },
        )] });
    }
  },
  {
    name: 'epice',
    aliases: ['epices', 'spice', 'condiment'],
    description: 'Informations sur une épice',
    category: 'Cuisine',
    cooldown: 3,
    async run(message, args) {
      const search = args[0]?.toLowerCase();
      let e;
      if (search) {
        e = EPICES.find(x => x.name.toLowerCase().includes(search));
      }
      if (!e) e = EPICES[Math.floor(Math.random() * EPICES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle(`🌶️ Épice : ${e.name}`)
        .addFields(
          { name: '🌍 Origine', value: e.origine, inline: true },
          { name: '👅 Saveur', value: e.saveur, inline: false },
          { name: '🍽️ Usages', value: e.usages, inline: false },
          { name: '💡 Fait', value: e.fait, inline: false },
        )] });
    }
  },
  {
    name: 'technique_cuisine',
    aliases: ['technique', 'methode_cuisson', 'chef_tip'],
    description: 'Technique culinaire professionnelle',
    category: 'Cuisine',
    cooldown: 3,
    async run(message, args) {
      const t = TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`👨‍🍳 Technique : ${t.name}`)
        .setDescription(t.desc)] });
    }
  },
  {
    name: 'conversion_cuisine',
    aliases: ['mesures', 'conv_cuisine', 'mesure_cuisson'],
    description: 'Tableau de conversions de mesures culinaires',
    category: 'Cuisine',
    cooldown: 3,
    async run(message, args) {
      const desc = Object.entries(CONVERSIONS_CUISINE).map(([k, v]) => `📏 **${k}** = ${v}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('📐 Conversions culinaires')
        .setDescription(desc)
        .setFooter({ text: 'Mesures approximatives — varient selon le produit' })] });
    }
  },
  {
    name: 'menu_semaine',
    aliases: ['meal_plan', 'repas_semaine', 'planning_repas'],
    description: 'Idée de menu pour la semaine',
    category: 'Cuisine',
    cooldown: 10,
    async run(message, args) {
      const REPAS = [
        ['Crêpes salées au jambon','Poulet rôti + purée','Soupe de légumes','Pâtes bolognaise','Quiche lorraine','Couscous','Brunch dominical'],
        ['Omelette aux champignons','Lentilles corail au lait de coco','Ratatouille + riz','Poisson vapeur + légumes','Pizza maison','Tajine de poulet','Risotto aux poireaux'],
        ['Pancakes sains à l\'avoine','Riz sauté aux légumes','Salade niçoise','Steak + haricots verts','Tarte aux légumes','Curry de pois chiches','Wok de légumes'],
      ];
      const menu = REPAS[Math.floor(Math.random() * REPAS.length)];
      const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
      const desc = jours.map((j, i) => `**${j}** : ${menu[i]}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('📅 Menu de la semaine')
        .setDescription(desc)
        .setFooter({ text: 'Idées indicatives — adaptez selon vos préférences !' })] });
    }
  },
  {
    name: 'accord_vin',
    aliases: ['vin', 'accord_mets', 'sommelier'],
    description: 'Accord mets-vins',
    category: 'Cuisine',
    cooldown: 5,
    async run(message, args) {
      const ACCORDS = [
        { plat:'Poisson grillé', vin:'Blanc sec (Chablis, Muscadet, Sauvignon Blanc)', conseil:'La légèreté du blanc complète la délicatesse du poisson.' },
        { plat:'Viande rouge', vin:'Rouge structuré (Bordeaux, Côte du Rhône, Barolo)', conseil:'Les tanins du rouge s\'adoucissent avec les protéines de la viande.' },
        { plat:'Volaille', vin:'Blanc sec ou Rosé (Chardonnay, Rosé de Provence)', conseil:'La volaille s\'accorde avec des vins élégants et fruités.' },
        { plat:'Fromages affinés', vin:'Rouge léger (Pinot Noir, Beaujolais) ou Blanc moelleux', conseil:'Évitez les rouges très tanniques avec les fromages.' },
        { plat:'Desserts chocolatés', vin:'Rouge fruité ou Porto', conseil:'Mariage classique avec un vin légèrement sucré et corsé.' },
        { plat:'Huîtres et fruits de mer', vin:'Blanc très sec et minéral (Chablis, Champagne Brut)', conseil:'L\'acidité coupe la richesse des fruits de mer.' },
      ];
      const a = ACCORDS[Math.floor(Math.random() * ACCORDS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle(`🍷 Accord : ${a.plat}`)
        .addFields(
          { name: '🍾 Vin conseillé', value: a.vin, inline: false },
          { name: '💡 Pourquoi ?', value: a.conseil, inline: false },
        )] });
    }
  },
  {
    name: 'astuce_cuisine',
    aliases: ['tip_cuisine', 'conseil_chef', 'hack_cuisine'],
    description: 'Astuce de chef cuisinier',
    category: 'Cuisine',
    cooldown: 5,
    async run(message, args) {
      const ASTUCES = [
        "🧂 **Sel pâtes** : L\'eau doit être aussi salée que la mer (~10g/L). Ça fait toute la différence !",
        "🥚 **Œufs frais** : Plongez-les dans l\'eau froide. Un œuf frais coule, un œuf moins frais flotte.",
        "🧅 **Oignons** : Mettez-les 15 min au congélateur avant de les couper — plus de larmes !",
        "🍅 **Tomates** : Ne les mettez jamais au frigo — ça détruit leur texture et leur goût.",
        "🔪 **Couteaux** : Un couteau émoussé est plus dangereux qu'un couteau aiguisé — ça glisse !",
        "🧄 **Ail** : Pour le peler facilement, posez la lame de couteau à plat dessus et appuyez fort.",
        "🍞 **Pain rassis** : Humidifiez légèrement et passez au four 5 min à 180°C — comme neuf !",
        "🥦 **Légumes verts** : Ajoutez-les en fin de cuisson pour garder leur couleur et croquant.",
        "🍳 **Poêle** : Une bonne poêle ne colle pas quand elle est très chaude avec peu d\'huile.",
        "🧈 **Beurre** : Pour brunir le beurre (beurre noisette) : chauffez jusqu\'à odeur de noisette — parfait pour les sauces.",
      ];
      const a = ASTUCES[Math.floor(Math.random() * ASTUCES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('👨‍🍳 Astuce de Chef')
        .setDescription(a)] });
    }
  },
  {
    name: 'nutrition',
    aliases: ['nutriments', 'aliment_info', 'valeur_nutritive'],
    description: 'Valeur nutritive d\'un aliment commun',
    category: 'Cuisine',
    cooldown: 3,
    async run(message, args) {
      const ALIMENTS = [
        { name:'Œuf entier', cal:'155 kcal/100g', prot:'13g', lipides:'11g', glucides:'1g', fait:'Protéine de référence. Contient les 9 acides aminés essentiels.' },
        { name:'Poulet (sans peau)', cal:'165 kcal/100g', prot:'31g', lipides:'3.6g', glucides:'0g', fait:'Excellent rapport protéines/calories. Aliment de base fitness.' },
        { name:'Riz blanc cuit', cal:'130 kcal/100g', prot:'2.7g', lipides:'0.3g', glucides:'28g', fait:'Index glycémique moyen. Digestion facile.' },
        { name:'Avocats', cal:'160 kcal/100g', prot:'2g', lipides:'15g', glucides:'9g', fait:'Riches en acides gras monoinsaturés (bon gras). Vitamine K, potassium.' },
        { name:'Brocoli', cal:'34 kcal/100g', prot:'2.8g', lipides:'0.4g', glucides:'7g', fait:'Excellent source de vitamine C, K. Propriétés anticancéreuses étudiées.' },
        { name:'Saumon', cal:'208 kcal/100g', prot:'20g', lipides:'13g', glucides:'0g', fait:'Riche en oméga-3 DHA/EPA. Bon pour le cœur et le cerveau.' },
        { name:'Lentilles cuites', cal:'116 kcal/100g', prot:'9g', lipides:'0.4g', glucides:'20g', fait:'Excellente source de fer végétal, fibres, protéines. Indexglycémique bas.' },
      ];
      const search = args[0]?.toLowerCase();
      let a;
      if (search) a = ALIMENTS.find(x => x.name.toLowerCase().includes(search));
      if (!a) a = ALIMENTS[Math.floor(Math.random() * ALIMENTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`🥗 Nutrition : ${a.name}`)
        .addFields(
          { name: '🔥 Calories', value: a.cal, inline: true },
          { name: '💪 Protéines', value: a.prot, inline: true },
          { name: '🫧 Lipides', value: a.lipides, inline: true },
          { name: '🍞 Glucides', value: a.glucides, inline: true },
          { name: '💡 Fait', value: a.fait, inline: false },
        )
        .setFooter({ text: 'Valeurs pour 100g — source : tables CIQUAL/USDA' })] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
