const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('🕐 Générer des timestamps Discord pour n\'importe quelle date')
    .addStringOption(o => o.setName('date').setDescription('Date (ex: 25/12/2025 ou 2025-12-25 ou maintenant+7j)').setRequired(true))
    .addStringOption(o => o.setName('heure').setDescription('Heure (ex: 14:30) — optionnel').setRequired(false)),

  async execute(interaction) {
    const dateStr = interaction.options.getString('date').trim();
    const heureStr = interaction.options.getString('heure')?.trim() || '00:00';

    let ts;
    try {
      // Formats supportés
      if (/^maintenant$/i.test(dateStr)) {
        ts = Math.floor(Date.now() / 1000);
      } else if (/^maintenant\+(\d+)([jhdm])$/i.test(dateStr)) {
        const m = dateStr.match(/\+(\d+)([jhdm])/i);
        const units = { j: 86400, h: 3600, d: 86400, m: 60 };
        ts = Math.floor(Date.now() / 1000) + parseInt(m[1]) * (units[m[2].toLowerCase()] || 86400);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, mo, y] = dateStr.split('/');
        const [h, mi] = heureStr.split(':');
        ts = Math.floor(new Date(`${y}-${mo}-${d}T${h.padStart(2,'0')}:${(mi||'00').padStart(2,'0')}:00`).getTime() / 1000);
      } else {
        const [h, mi] = heureStr.split(':');
        const d = new Date(`${dateStr}T${h.padStart(2,'0')}:${(mi||'00').padStart(2,'0')}:00`);
        ts = Math.floor(d.getTime() / 1000);
      }
      if (!ts || isNaN(ts)) throw new Error('invalid');
    } catch {
      return interaction.editReply({ content: '❌ Format de date invalide.\n**Exemples valides:** `25/12/2025`, `2025-12-25`, `maintenant`, `maintenant+7j`', ephemeral: true });
    }

    const formats = [
      { code: 't', label: 'Heure courte', example: `<t:${ts}:t>` },
      { code: 'T', label: 'Heure longue', example: `<t:${ts}:T>` },
      { code: 'd', label: 'Date courte', example: `<t:${ts}:d>` },
      { code: 'D', label: 'Date longue', example: `<t:${ts}:D>` },
      { code: 'f', label: 'Date + heure courte', example: `<t:${ts}:f>` },
      { code: 'F', label: 'Date + heure longue', example: `<t:${ts}:F>` },
      { code: 'R', label: 'Relatif', example: `<t:${ts}:R>` },
    ];

    const lines = formats.map(f => `**${f.label}** → \`<t:${ts}:${f.code}>\` → ${f.example}`).join('\n');

    return interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('🕐 Timestamps Discord')
      .setDescription(lines)
      .addFields({ name: '🔢 Unix timestamp', value: `\`${ts}\``, inline: true })
      .setFooter({ text: 'Copie le format voulu et colle-le dans ton message Discord' })
    ]});
  }
};
