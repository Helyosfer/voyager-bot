require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { ayarlariGetir } = require('./depo');
const hatirlatici = require('./hatirlatici');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN bulunamadı. .env dosyasını oluşturup doldurdun mu?');
  process.exit(1);
}

const client = new Client({
  // GuildMembers: yeni üye geldiğinde haber almak için gerekli.
  // Developer Portal > Bot > "Server Members Intent" açık olmalı.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// commands/ klasöründeki her dosya bir komut
client.komutlar = new Collection();
const komutKlasoru = path.join(__dirname, 'commands');
for (const dosya of fs.readdirSync(komutKlasoru).filter((d) => d.endsWith('.js'))) {
  const komut = require(path.join(komutKlasoru, dosya));
  client.komutlar.set(komut.data.name, komut);
}

client.once(Events.ClientReady, (c) => {
  console.log(`Bot hazır: ${c.user.tag}`);
  hatirlatici.hepsiniYukle(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const komut = client.komutlar.get(interaction.commandName);
  if (!komut) return;

  try {
    await komut.execute(interaction);
  } catch (hata) {
    console.error(`/${interaction.commandName} hatası:`, hata);
    const cevap = { content: 'Komut çalışırken bir hata oluştu.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(cevap).catch(() => {});
    else await interaction.reply(cevap).catch(() => {});
  }
});

// Yeni üye: hoş geldin mesajı + otomatik rol
client.on(Events.GuildMemberAdd, async (uye) => {
  const { hosgeldinKanali, otoRol } = ayarlariGetir(uye.guild.id);

  if (otoRol) {
    await uye.roles.add(otoRol).catch((h) => console.error('Oto rol verilemedi:', h.message));
  }
  if (hosgeldinKanali) {
    const kanal = await uye.guild.channels.fetch(hosgeldinKanali).catch(() => null);
    if (kanal?.isTextBased()) {
      await kanal.send(`👋 Hoş geldin ${uye}! Seninle birlikte **${uye.guild.memberCount}** kişiyiz.`).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
