require('dotenv').config({ quiet: true }); // quiet: her açılışta kayda bilgi satırı yazmasın
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags, Partials } = require('discord.js');
const { ayarlariGetir } = require('./depo');
const hatirlatici = require('./hatirlatici');
const firsatlar = require('./firsatlar');
const gunluk = require('./gunluk');
const yayin = require('./yayin');
const koruma = require('./koruma');
const instagram = require('./instagram');
const haber = require('./haber');
const yapayzeka = require('./yapayzeka');
const topluluk = require('./topluluk');
const kilit = require('./kilit');
const { otoRolVer, komutYetkisiVar, hataMetni } = require('./yardimci');

// Yakalanmamış bir hata botu kapatır; systemd birkaç saniyede yeniden başlatır. Bu davranış
// değişmez, ama kapanmadan önce sebep kayda açıkça yazılır. Node'un kendi çıktısı hata
// nesnesinin tamamını basar; onda kullanıcının yazdığı metin de bulunabilir (bkz. hataMetni).
for (const olay of ['uncaughtException', 'unhandledRejection']) {
  process.on(olay, (hata) => {
    console.error(`Yakalanmamış hata (${olay}), bot kapanıyor:`, hataMetni(hata));
    process.exit(1);
  });
}

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
  instagram.baslat(client);
  haber.baslat(client);
  if (yapayzeka.hazir()) {
    const { ayar } = yapayzeka;
    const kapsam = yapayzeka.izinListesi().size ? `yalnızca ${yapayzeka.izinListesi().size} sunucuda (GEMINI_SUNUCULAR)` : 'her sunucuda';
    console.log(`Yapay zekâ: hazır · /sor ${ayar.modeller.join(' > ')} (${kapsam}; günde en fazla ${yapayzeka.TOPLAM_GUNLUK}, dakikada ${ayar.dakikalik}) · incelemeler ${ayar.incelemeModelleri.join(' > ')} · görsel denetimi ${ayar.gorselModelleri.join(' > ')} (günde en fazla ${yapayzeka.GOREVLER.gorsel.gunluk})`);
  } else {
    console.log('Yapay zekâ (/sor ve oyun incelemeleri): kapalı (eksik: GEMINI_API_KEY ve GEMINI_MODEL)');
  }
  console.log(`Mesaj içeriği günlüğü: ${mesajIcerigi.length ? 'açık' : 'kapalı'}`);
});

// Botun eklendiği ve çıkarıldığı sunucular kayıtlarda görünsün
client.on(Events.GuildCreate, (sunucu) => console.log(`Sunucuya eklendi: ${sunucu.name} (${sunucu.id}) · ${sunucu.memberCount} üye`));
client.on(Events.GuildDelete, (sunucu) => console.log(`Sunucudan çıkarıldı: ${sunucu.name} (${sunucu.id})`));

// Dinleyici olmazsa bağlantı hatası botu çökertir
client.on(Events.Error, (hata) => console.error('Discord bağlantı hatası:', hata));

client.on(Events.InteractionCreate, async (interaction) => {
  // Botun bulunmadığı bir sunucudan gelen etkileşim (bot bir kullanıcının hesabına kurulmuşsa
  // olur). Komutlar sunucunun üyelerine, kanallarına ve rollerine eriştiği için orada çalışamaz.
  if (interaction.inGuild() && !interaction.inCachedGuild()) {
    if (interaction.isRepliable()) {
      await interaction.reply({ content: '❌ Voyager bu sunucuda değil. Komutları kullanmak için bir yönetici botu sunucuya eklemeli.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return;
  }

  // /sunucukur ile kurulan kalıcı düğme, menü ve formlar (üyelik onayı, roller, destek)
  if ((interaction.isMessageComponent() || interaction.isModalSubmit()) && interaction.customId.startsWith('tp:')) {
    try {
      await topluluk.etkilesim(interaction);
    } catch (hata) {
      console.error(`${interaction.customId} hatası:`, hataMetni(hata));
      const cevap = { content: 'İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(cevap).catch(() => {});
      else await interaction.reply(cevap).catch(() => {});
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const komut = client.komutlar.get(interaction.commandName);
  if (!komut) return;

  // Geri alınması zor komutlarda (kesinYetki) gereken yetkiyi bot da denetler; ayrıntı yardimci.js'te
  if (komut.kesinYetki && !komutYetkisiVar(interaction, komut)) {
    await interaction.reply({ content: '❌ Bu komutu kullanmak için gereken yetkin yok.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  try {
    await komut.execute(interaction);
  } catch (hata) {
    console.error(`/${interaction.commandName} hatası:`, hataMetni(hata));
    const cevap = { content: 'Komut çalışırken bir hata oluştu.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(cevap).catch(() => {});
    else await interaction.reply(cevap).catch(() => {});
  }
});

gunluk.baslat(client);
koruma.baslat(client);
kilit.baslat(client);

// Yeni üye: hoş geldin mesajı + otomatik rol
client.on(Events.GuildMemberAdd, async (uye) => {
  // Burada yakalanmayan bir hata (ör. ayar dosyası okunamazsa) botu bütün sunucularda kapatır
  try {
    const { hosgeldinKanali, otoRol } = ayarlariGetir(uye.guild.id);

    if (otoRol) await otoRolVer(uye, otoRol);
    if (hosgeldinKanali) {
      const kanal = await uye.guild.channels.fetch(hosgeldinKanali).catch(() => null);
      if (kanal?.isTextBased()) {
        await kanal.send(`👋 Hoş geldin ${uye}! Seninle birlikte **${uye.guild.memberCount}** kişiyiz.`).catch(() => {});
      }
    }
  } catch (hata) {
    console.error('Yeni üye işlenemedi:', hataMetni(hata));
  }
});

client.login(process.env.DISCORD_TOKEN);
