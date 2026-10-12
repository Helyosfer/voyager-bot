require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags, Partials } = require('discord.js');
const { ayarlariGetir } = require('./depo');
const hatirlatici = require('./hatirlatici');
const firsatlar = require('./firsatlar');
const gunluk = require('./gunluk');
const yayin = require('./yayin');
const koruma = require('./koruma');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN bulunamadı. .env dosyasını oluşturup doldurdun mu?');
  process.exit(1);
}

// Silinen/düzenlenen mesajların içeriğini günlüğe yazmak için gerekli. Ayrıcalıklı bir
// izin olduğundan Developer Portal > Bot > "Message Content Intent" açılmadan
// etkinleştirilirse bot bağlanamaz; bu yüzden .env ile ayrıca açılır.
const mesajIcerigi = process.env.MESAJ_ICERIGI === '1' ? [GatewayIntentBits.MessageContent] : [];

const client = new Client({
  // GuildMembers: yeni üye geldiğinde haber almak için gerekli.
  // Developer Portal > Bot > "Server Members Intent" açık olmalı.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    // Sunucu günlüğü için: denetim kaydı, mesaj ve ses olayları
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    ...mesajIcerigi,
  ],
  // Bot açılmadan önce yazılmış mesajların silinmesi de haber verilsin
  partials: [Partials.Message],
  // Sebep gibi kullanıcının yazdığı metinlerdeki @everyone ve rol etiketleri
  // bildirim göndermesin; sadece kullanıcı etiketleri çalışır.
  allowedMentions: { parse: ['users'] },
});

// commands/ klasöründeki her dosya bir komut
client.komutlar = new Collection();
const komutKlasoru = path.join(__dirname, 'commands');
for (const dosya of fs.readdirSync(komutKlasoru).filter((d) => d.endsWith('.js'))) {
  const komut = require(path.join(komutKlasoru, dosya));
  client.komutlar.set(komut.data.name, komut);
}

client.once(Events.ClientReady, (c) => {
  console.log(`Bot hazır: ${c.user.tag} · ${c.guilds.cache.size} sunucuda`);
  for (const sunucu of c.guilds.cache.values()) console.log(`  · ${sunucu.name} (${sunucu.id}) · ${sunucu.memberCount} üye`);
  hatirlatici.hepsiniYukle(client);
  firsatlar.baslat(client);
  yayin.baslat(client);
  console.log(`Mesaj içeriği günlüğü: ${mesajIcerigi.length ? 'açık' : 'kapalı'}`);
});

// Botun eklendiği ve çıkarıldığı sunucular kayıtlarda görünsün
client.on(Events.GuildCreate, (sunucu) => console.log(`Sunucuya eklendi: ${sunucu.name} (${sunucu.id}) · ${sunucu.memberCount} üye`));
client.on(Events.GuildDelete, (sunucu) => console.log(`Sunucudan çıkarıldı: ${sunucu.name} (${sunucu.id})`));

// Dinleyici olmazsa bağlantı hatası botu çökertir
client.on(Events.Error, (hata) => console.error('Discord bağlantı hatası:', hata));

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

gunluk.baslat(client);
koruma.baslat(client);

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
