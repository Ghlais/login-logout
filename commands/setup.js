const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname, 'databases/login-logoutdb');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'data.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS login_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    userId TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logout_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    userId TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    report TEXT
  )`);
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup login and logout system'),
  async execute(interaction) {
    const embed1 = new EmbedBuilder()
      .setTitle('🔑 Login/Logout')
      .setDescription('Please use the buttons below to log in or out.');
    const loginButton = new ButtonBuilder()
      .setCustomId('login')
      .setLabel('تسجيل دخول')
      .setStyle(ButtonStyle.Primary);
    const logoutButton = new ButtonBuilder()
      .setCustomId('logout')
      .setLabel('تسجيل خروج')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder()
      .addComponents(loginButton, logoutButton);

    const channel1 = await interaction.client.channels.fetch('1244173070810353735');//ايدي الشات الي يرسل فيه رسالة تسجيل الدخول
    await channel1.send({ embeds: [embed1], components: [row] });

    const embed2 = new EmbedBuilder()
      .setTitle('👥 Admins Manager')
      .setDescription('Users who have logged in:');
    const channel2 = await interaction.client.channels.fetch('1244172070183763988');//ايدي القناة الي يرسل فيها الاشخاص المتواجدين
    const message2 = await channel2.send({ embeds: [embed2] });
    let loggedInUsers = [];
    db.all(`SELECT DISTINCT username FROM login_events WHERE userId NOT IN (SELECT userId FROM logout_events)`, [], (err, rows) => {
      if (err) {
        throw err;
      }
      loggedInUsers = rows.map(row => row.username);
    });

    interaction.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton()) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const logChannel = await interaction.client.channels.fetch('1242397017657970699');//ايدي شات اللوق
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString();
        if (interaction.customId === 'login') {
          if (!loggedInUsers.includes(username)) {
            loggedInUsers.push(username);

            db.run(`INSERT INTO login_events (username, userId, timestamp) VALUES (?, ?, ?)`, [username, userId, formattedDate]);
            const logEmbed = new EmbedBuilder()
              .setTitle('تسجيل دخول')
              .setDescription(`قام ${username} بتسجيل الدخول\n${formattedDate}`);
            await logChannel.send({ embeds: [logEmbed] });
            await interaction.reply({ content: 'تم تسجيل الدخول بنجاح ✅', ephemeral: true });
          } else {
            await interaction.reply({ content: 'انت قمت بي تسجيل الدخول بالفعل ❗', ephemeral: true });
          }
        } else if (interaction.customId === 'logout') {
          if (!loggedInUsers.includes(username)) {
            await interaction.reply({ content: 'لا يمكنك تسجيل الخروج لأنك لم تقم بتسجيل الدخول ❗', ephemeral: true });
            return;
          }
          const modal = new ModalBuilder()
            .setCustomId('logoutReportModal')
            .setTitle('تقرير تسجيل خروج')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('reportInput')
                  .setLabel('ادخل التقرير الخاص بك هنا')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
              )
            );
          await interaction.showModal(modal);
        }
        const updatedEmbed2 = new EmbedBuilder()
          .setTitle('👥 Admins Manager')
          .setDescription('المشرفين المتواجدين | The Online Admins:\n' + (loggedInUsers.length > 0 ? loggedInUsers.join('\n') : 'No users logged in.'));
        await message2.edit({ embeds: [updatedEmbed2] });
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'logoutReportModal') {
          const username = interaction.user.username;
          const report = interaction.fields.getTextInputValue('reportInput');
          const currentDate = new Date();
          const formattedDate = currentDate.toLocaleString();
          const logChannel = await interaction.client.channels.fetch('1242397017657970699');

          db.run(`INSERT INTO logout_events (username, userId, timestamp, report) VALUES (?, ?, ?, ?)`, [username, interaction.user.id, formattedDate, report]);
          const logEmbed = new EmbedBuilder()
            .setTitle('تسجيل خروج')
            .addFields(
              { name: 'المستخدم', value: username, inline: true },
              { name: 'الوقت والتاريخ', value: formattedDate, inline: true },
              { name: 'التقرير', value: report, inline: false }
            );  

          await logChannel.send({ embeds: [logEmbed] });
          const index = loggedInUsers.indexOf(username);
          if (index > -1) {
            loggedInUsers.splice(index, 1);
          }

          const updatedEmbed2 = new EmbedBuilder()
            .setTitle('👥 Admins Manager')
            .setDescription('المشرفين المتواجدين | The Online Admins:\n' + (loggedInUsers.length > 0 ? loggedInUsers.join('\n') : 'No users logged in.'));
          await message2.edit({ embeds: [updatedEmbed2] });
          await interaction.reply({ content: 'تم إرسال التقرير بنجاح.', ephemeral: true });
        }
      }
    });
    await interaction.reply({ content: 'Setup completed!', ephemeral: true });
  },

};