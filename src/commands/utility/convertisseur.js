const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CONVERSIONS = {
  longueur: {
    label: '📏 Longueur',
    units: {
      mm: { name: 'Millimètre', toBase: 0.001 },
      cm: { name: 'Centimètre', toBase: 0.01 },
      m:  { name: 'Mètre',      toBase: 1 },
      km: { name: 'Kilomètre',  toBase: 1000 },
      in: { name: 'Pouce',      toBase: 0.0254 },
      ft: { name: 'Pied',       toBase: 0.3048 },
      yd: { name: 'Yard',       toBase: 0.9144 },
      mi: { name: 'Mile',       toBase: 1609.344 },
    }
  },
  poids: {
    label: '⚖️ Poids',
    units: {
      mg: { name: 'Milligramme', toBase: 0.000001 },
      g:  { name: 'Gramme',      toBase: 0.001 },
      kg: { name: 'Kilogramme',  toBase: 1 },
      t:  { name: 'Tonne',       toBase: 1000 },
      oz: { name: 'Once',        toBase: 0.028349 },
      lb: { name: 'Livre',       toBase: 0.453592 },
    }
  },
  temperature: {
    label: '🌡️ Température',
    units: {
      c: { name: 'Celsius' },
      f: { name: 'Fahrenheit' },
      k: { name: 'Kelvin' },
    }
  },
  vitesse: {
    label: '💨 Vitesse',
    units: {
      ms:  { name: 'm/s',   toBase: 1 },
      kmh: { name: 'km/h',  toBase: 0.277778 },
      mph: { name: 'mph',   toBase: 0.44704 },
      kt:  { name: 'Nœuds', toBase: 0.514444 },
    }
  },
  surface: {
    label: '📐 Surface',
    units: {
      cm2: { name: 'cm²',  toBase: 0.0001 },
      m2:  { name: 'm²',   toBase: 1 },
      km2: { name: 'km²',  toBase: 1000000 },
      ha:  { name: 'Hectare', toBase: 10000 },
      ft2: { name: 'pied²',   toBase: 0.092903 },
    }
  },
  volume: {
    label: '🧪 Volume',
    units: {
      ml:  { name: 'Millilitre', toBase: 0.001 },
      cl:  { name: 'Centilitre', toBase: 0.01 },
      l:   { name: 'Litre',      toBase: 1 },
      m3:  { name: 'm³',         toBase: 1000 },
      pt:  { name: 'Pinte',      toBase: 0.473176 },
      gal: { name: 'Gallon',     toBase: 3.785411 },
    }
  },
  monnaie: {
    label: '💶 Monnaie (approximatif)',
    units: {
      eur: { name: 'Euro (€)',   toBase: 1 },
      usd: { name: 'Dollar ($)', toBase: 0.92 },
      gbp: { name: 'Livre (£)',  toBase: 1.16 },
      chf: { name: 'Franc CH',   toBase: 1.05 },
      jpy: { name: 'Yen (¥)',    toBase: 0.0062 },
      cad: { name: 'Dollar CA',  toBase: 0.68 },
    }
  },
};

function convertTemp(value, from, to) {
  let celsius;
  if (from === 'c') celsius = value;
  else if (from === 'f') celsius = (value - 32) * 5 / 9;
  else celsius = value - 273.15;

  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  return celsius + 273.15;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('convertir')
    .setDescription('🔢 Convertisseur universel (longueur, poids, temp, vitesse...)')
    .addSubcommand(s => s.setName('calculer').setDescription('🔢 Convertir une valeur')
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie').setRequired(true)
        .addChoices(
          { name: '📏 Longueur', value: 'longueur' },
          { name: '⚖️ Poids', value: 'poids' },
          { name: '🌡️ Température', value: 'temperature' },
          { name: '💨 Vitesse', value: 'vitesse' },
          { name: '📐 Surface', value: 'surface' },
          { name: '🧪 Volume', value: 'volume' },
          { name: '💶 Monnaie', value: 'monnaie' },
        ))
      .addNumberOption(o => o.setName('valeur').setDescription('Valeur à convertir').setRequired(true))
      .addStringOption(o => o.setName('de').setDescription('Unité source (ex: km, kg, c, mph...)').setRequired(true))
      .addStringOption(o => o.setName('vers').setDescription('Unité cible (ex: mi, lb, f, kmh...)').setRequired(true)))
    .addSubcommand(s => s.setName('unites').setDescription('📋 Voir toutes les unités disponibles')
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie').setRequired(true)
        .addChoices(
          { name: '📏 Longueur', value: 'longueur' },
          { name: '⚖️ Poids', value: 'poids' },
          { name: '🌡️ Température', value: 'temperature' },
          { name: '💨 Vitesse', value: 'vitesse' },
          { name: '📐 Surface', value: 'surface' },
          { name: '🧪 Volume', value: 'volume' },
          { name: '💶 Monnaie', value: 'monnaie' },
        ))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'unites') {
      const cat = CONVERSIONS[interaction.options.getString('categorie')];
      const lines = Object.entries(cat.units).map(([k, v]) => `\`${k}\` — ${v.name}`).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle(`${cat.label} — Unités disponibles`).setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'calculer') {
      const cat = interaction.options.getString('categorie');
      const valeur = parseFloat(interaction.options.getString('valeur'));
      const de = interaction.options.getString('de').toLowerCase();
      const vers = interaction.options.getString('vers').toLowerCase();
      const conv = CONVERSIONS[cat];

      if (!conv.units[de]) return interaction.reply({ content: `❌ Unité **${de}** inconnue. Voir \`/convertir unites\`.`, ephemeral: true });
      if (!conv.units[vers]) return interaction.reply({ content: `❌ Unité **${vers}** inconnue. Voir \`/convertir unites\`.`, ephemeral: true });

      let result;
      if (cat === 'temperature') {
        result = convertTemp(valeur, de, vers);
      } else {
        const base = valeur * conv.units[de].toBase;
        result = base / conv.units[vers].toBase;
      }

      const rounded = Math.round(result * 10000) / 10000;

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle(`${conv.label} — Conversion`)
          .setDescription(`**${valeur} ${conv.units[de].name}** = **${rounded} ${conv.units[vers].name}**`)
          .addFields(
            { name: 'De', value: `${valeur} \`${de}\``, inline: true },
            { name: 'Vers', value: `${rounded} \`${vers}\``, inline: true },
          )
      ]});
    }
  }
};
