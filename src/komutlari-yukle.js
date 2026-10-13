// Komutları Discord'a tanıtır. Yeni komut eklediğinde veya bir komutun
// adını/seçeneklerini değiştirdiğinde bir kez çalıştır: npm run komutlar
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_IDS } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('.env dosyasında DISCORD_TOKEN ve CLIENT_ID dolu olmalı.');
  process.exit(1);
}

const komutKlasoru = path.join(__dirname, 'commands');
const hepsi = fs
  .readdirSync(komutKlasoru)
  .filter((d) => d.endsWith('.js'))
  .map((d) => require(path.join(komutKlasoru, d)))
  // Gereken bağlantısı kurulmamış komutlar (ör. /instagram) yüklenmez
  .filter((k) => k.etkin?.() !== false);
// Bot sahibine özel komutlar (ör. /sunucular) yalnızca GUILD_IDS sunucularına yüklenir
// Komutlar yalnızca botun eklendiği sunucularda kullanılabilir (integration_types 0 = sunucuya
// kurulum). Belirtilmezse, uygulamada "User Install" açıkken botu kendi hesabına kuran herkes
// komutları botun bulunmadığı sunucularda da çalıştırabilir; komutlar buna göre yazılmadı.
const kayit = (k) => ({ ...k.data.toJSON(), integration_types: [0] });
const genel = hepsi.filter((k) => !k.sahipKomutu).map(kayit);
const sahibeOzel = hepsi.filter((k) => k.sahipKomutu).map(kayit);

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  // Genel komutlar botun eklendiği her sunucuda kendiliğinden görünür
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: genel });
    console.log(`${genel.length} komut yüklendi (botun bulunduğu tüm sunucular)`);
  } catch (hata) {
    console.error('Komutlar yüklenemedi:', hata.message);
    process.exitCode = 1;
    return;
  }

  // Sunucuya özel liste her seferinde baştan yazılır; eski sürümlerden kalan
  // kopyalar da böylece silinir ve komutlar iki kez görünmez.
  for (const sunucuId of (GUILD_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, sunucuId), { body: sahibeOzel });
      console.log(`${sahibeOzel.length} sahip komutu yüklendi -> sunucu ${sunucuId}`);
    } catch (hata) {
      console.error(`Sunucu ${sunucuId} için sahip komutları yüklenemedi:`, hata.message);
      process.exitCode = 1;
    }
  }
})();
