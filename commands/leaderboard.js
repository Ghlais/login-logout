const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

  

  db.run(`CREATE TABLE IF NOT EXISTS login_durations (
    userId TEXT NOT NULL,
    username TEXT NOT NULL,
    duration INTEGER NOT NULL,
    PRIMARY KEY (userId, username)
  )`);

});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the leaderboard of users with the longest login durations.'),
  async execute(interaction) {
    db.serialize(() => {
      db.all(`SELECT userId, username, timestamp FROM login_events WHERE userId IN (SELECT DISTINCT userId FROM logout_events)`, [], (err, loginRows) => {
        if (err) {
          console.error(err);
          interaction.reply({ content: 'Error fetching leaderboard data.', ephemeral: true });
          return;
        }
        loginRows.forEach(loginRow => {
          db.get(`SELECT timestamp FROM logout_events WHERE userId = ? ORDER BY timestamp DESC LIMIT 1`, [loginRow.userId], (err, logoutRow) => {
            if (err) {
              console.error(err);
              return;
            }
            if (logoutRow) {
              const loginTime = new Date(loginRow.timestamp);
              const logoutTime = new Date(logoutRow.timestamp);
              const duration = Math.floor((logoutTime - loginTime) / 1000);
              db.run(`INSERT INTO login_durations (userId, username, duration) VALUES (?, ?, ?) ON CONFLICT(userId, username) DO UPDATE SET duration = duration + ?`, [loginRow.userId, loginRow.username, duration, duration]);
            }
          });
        });
      });
    });

    db.all(`SELECT username, SUM(duration) as totalDuration FROM login_durations GROUP BY username ORDER BY totalDuration DESC LIMIT 10`, [], (err, rows) => {
      if (err) {
        console.error(err);
        interaction.reply({ content: 'Error fetching leaderboard data.', ephemeral: true });
        return;
      }
      const leaderboard = rows.map((row, index) => `**${index + 1}. ${row.username}** - ${row.totalDuration} seconds`).join('\n') || 'No records found.';
      const embed = new EmbedBuilder()
        .setTitle('🏆 Leaderboard')
        .setDescription(leaderboard)
        .setFooter({ text: 'Top users by total login duration' });
      interaction.reply({ embeds: [embed] });
    });
  },
};