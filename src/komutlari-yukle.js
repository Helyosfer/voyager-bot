// Komutları Discord'a tanıtır. Yeni komut eklediğinde veya bir komutun
// adını/seçeneklerini değiştirdiğinde bir kez çalıştır: npm run komutlar
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_IDS } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_IDS) {
  console.error('.env dosyasında DISCORD_TOKEN, CLIENT_ID ve GUILD_IDS dolu olmalı.');
  process.exit(1);
}

const komutKlasoru = path.join(__dirname, 'commands');
const komutlar = fs
  .readdirSync(komutKlasoru)
  .filter((d) => d.endsWith('.js'))
  .map((d) => require(path.join(komutKlasoru, d)).data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  for (const sunucuId of GUILD_IDS.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, sunucuId), { body: komutlar });
      console.log(`${komutlar.length} komut yüklendi -> sunucu ${sunucuId}`);
    } catch (hata) {
      console.error(`Sunucu ${sunucuId} için yüklenemedi:`, hata.message);
      process.exitCode = 1;
    }
  }
})();
