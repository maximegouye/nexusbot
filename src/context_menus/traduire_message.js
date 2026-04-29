const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('🌍 Traduire en français')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const msg = interaction.targetMessage;
      const text = msg.content;

      if (!text) return await interaction.editReply('❌ Ce message ne contient pas de texte à traduire.');
      if (text.length > 500) return await interaction.editReply('❌ Texte trop long (500 caractères max).');

      try {
        const https = require('https');

        const translated = await new Promise((resolve, reject) => {
          const encoded = encodeURIComponent(text);
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encoded}`;
          https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                const result = json[0].map(s => s[0]).filter(Boolean).join('');
                const detectedLang = json[2] || 'inconnu';
                resolve({ text: result, lang: detectedLang });
              } catch { reject(new Error('Parse error')); }
            });
          }).on('error', reject);
        });

        return await interaction.editReply({ embeds: [
          new EmbedBuilder()
            .setColor('#4285F4')
            .setTitle('🌍 Traduction')
            .addFields(
              { name: '🔤 Texte original', value: `\`\`\`${text.slice(0, 300)}\`\`\`` },
              { name: `🇫🇷 Traduction (depuis: ${translated.lang})`, value: `\`\`\`${translated.text.slice(0, 300)}\`\`\`` },
            )
            .setFooter({ text: 'Traduction via Google Translate' })
        ]});
      } catch (e) {
        return await interaction.editReply('❌ Erreur lors de la traduction. Réessaie dans un moment.');
      }
    } catch (err) {
      console.error('[traduire_message.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.reply(msg);
      } catch {}
    }
  }
};
