const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbDir = path.resolve(__dirname, 'databases/login-logoutdb');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'data.db');
const db = new sqlite3.Database(dbPath);


module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-log')
    .setDescription('Choose to view your login or logout records.'),
  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('log_choice')
      .setPlaceholder('Choose:')
      .addOptions([
        {

          label: 'Login',
          value: 'login',

        },

        {

          label: 'Logout',
          value: 'logout',

        },

      ]);

    const row = new ActionRowBuilder()
      .addComponents(menu);
    await interaction.reply({ content: 'Choose:', components: [row], ephemeral: true });
    const filter = (i) => i.user.id === interaction.user.id && i.customId === 'log_choice';
    const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, time: 60000 });
    collector.on('collect', async (i) => {
      if (i.values[0] === 'login') {
        db.all(`SELECT timestamp FROM login_events WHERE userId = ? ORDER BY timestamp DESC LIMIT 5`, [interaction.user.id], (err, rows) => {
          if (err) {
            console.error(err);
            i.reply({ content: 'Error fetching login records.', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle('Last 5 Login Times')
            .setDescription(rows.map(row => row.timestamp).join('\n') || 'No records found.');
          i.reply({ embeds: [embed], ephemeral: true });
        });
      } else if (i.values[0] === 'logout') {
        db.all(`SELECT timestamp, report FROM logout_events WHERE userId = ? ORDER BY timestamp DESC LIMIT 5`, [interaction.user.id], (err, rows) => {
          if (err) {
            console.error(err);
            i.reply({ content: 'Error fetching logout records.', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle('Last 5 Logout Times with Reports')
            .setDescription(rows.map(row => `Time: ${row.timestamp}\nReport: ${row.report || 'No report'}\n`).join('\n') || 'No records found.');
          i.reply({ embeds: [embed], ephemeral: true });
        });
      }
    });
  },
};
