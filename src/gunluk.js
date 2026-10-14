// Sunucu günlüğü: üye, mesaj, ses ve yönetim olaylarını log kanalına yazar.
// Kanal /ayarla log-kanali, kategoriler /ayarla log-kategori ile ayarlanır.
const { AuditLogEvent, EmbedBuilder, Events } = require('discord.js');
const { ayarlariGetir } = require('./depo');

const KATEGORILER = {
  moderasyon: 'Moderasyon (ban, kick, susturma, mesaj temizleme)',
  uyeler: 'Üyeler (katılma, ayrılma, takma ad ve rol değişikliği)',
  mesajlar: 'Mesajlar (silinen ve düzenlenen mesajlar)',
  ses: 'Ses kanalları (girme, çıkma, kanal değiştirme)',
  sunucu: 'Sunucu (kanal ve rol oluşturma/silme)',
};

const YESIL = 0x57f287;
const KIRMIZI = 0xed4245;
const SARI = 0xfee75c;
const MAVI = 0x5865f2;
const GRI = 0x99aab5;

// Bir kategori açıkça kapatılmadıysa açıktır
const kategoriAcik = (ayar, kategori) => ayar.logKategorileri?.[kategori] !== false;

// files: isteğe bağlı ekler (ör. kanıt resmi). Bot kanala dosya ekleyemiyorsa kayıt eksiz gönderilir.
async function gunlukGonder(guild, kategori, embed, files = []) {
  const ayar = ayarlariGetir(guild.id);
  if (!ayar.logKanali || !kategoriAcik(ayar, kategori)) return;
  const kanal = await guild.channels.fetch(ayar.logKanali).catch(() => null);
  if (!kanal?.isTextBased()) return;
  // Günlükteki etiketler kimseye bildirim göndermesin
  const mesaj = { embeds: [embed.setTimestamp()], allowedMentions: { parse: [] } };
  const gitti = files.length ? await kanal.send({ ...mesaj, files }).then(() => true, () => false) : false;
  if (!gitti) await kanal.send(mesaj).catch(() => {});
}

const zaman = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;
const kisalt = (metin, sinir = 1000) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);

// alanlar: [ad, deger] çiftleri; değeri boş olanlar atlanır
function olustur(baslik, renk, alanlar) {
  return new EmbedBuilder()
    .setTitle(baslik)
    .setColor(renk)
    .addFields(alanlar.filter(([, deger]) => deger).map(([name, deger]) => ({ name, value: kisalt(String(deger)) })));
}

const kisi = (kullanici) => `${kullanici} (${kullanici.tag})`;

function uyeKatildi(uye) {
  return gunlukGonder(
    uye.guild,
    'uyeler',
    olustur('Üye katıldı', YESIL, [
      ['Kullanıcı', kisi(uye.user)],
      ['Hesap açılışı', zaman(uye.user.createdTimestamp)],
      ['Üye sayısı', uye.guild.memberCount],
    ]),
  );
}

function uyeAyrildi(uye) {
  const roller = uye.roles?.cache.filter((r) => r.id !== uye.guild.id).map((r) => `${r}`).join(' ');
  return gunlukGonder(
    uye.guild,
    'uyeler',
    olustur('Üye ayrıldı', GRI, [
      ['Kullanıcı', `${kisi(uye.user)} · ${uye.id}`],
      ['Katılma', uye.joinedTimestamp && zaman(uye.joinedTimestamp)],
      ['Rolleri', roller],
    ]),
  );
}

async function uyeGuncellendi(eski, yeni) {
  if (eski.partial) return; // Önceki hali bilinmiyorsa neyin değiştiği de bilinmez

  if (eski.nickname !== yeni.nickname) {
    await gunlukGonder(
      yeni.guild,
      'uyeler',
      olustur('Takma ad değişti', MAVI, [
        ['Kullanıcı', kisi(yeni.user)],
        ['Önce', eski.nickname ?? '(yok)'],
        ['Sonra', yeni.nickname ?? '(yok)'],
      ]),
    );
  }

  const eklenen = yeni.roles.cache.filter((r) => !eski.roles.cache.has(r.id));
  const cikarilan = eski.roles.cache.filter((r) => !yeni.roles.cache.has(r.id));
  if (eklenen.size || cikarilan.size) {
    await gunlukGonder(
      yeni.guild,
      'uyeler',
      olustur('Roller değişti', MAVI, [
        ['Kullanıcı', kisi(yeni.user)],
        ['Verilen', eklenen.map((r) => `${r}`).join(' ')],
        ['Alınan', cikarilan.map((r) => `${r}`).join(' ')],
      ]),
    );
  }
}

function mesajSilindi(mesaj) {
  if (!mesaj.guild || mesaj.author?.bot) return;
  return gunlukGonder(
    mesaj.guild,
    'mesajlar',
    olustur('Mesaj silindi', KIRMIZI, [
      // Bot açılmadan önce yazılmış mesajların yazarı ve içeriği bilinmez
      ['Yazan', mesaj.author ? kisi(mesaj.author) : 'Bilinmiyor (eski mesaj)'],
      ['Kanal', `${mesaj.channel}`],
      ['İçerik', mesaj.content],
      ['Ek dosya', mesaj.attachments?.size ? `${mesaj.attachments.size} adet` : null],
    ]),
  );
}

// /temizle kendi kaydını yetkili bilgisiyle yazar; aynı silme iki kez görünmesin
const botunTemizledigi = new Set();
function temizlemeBildir(kanalId) {
  botunTemizledigi.add(kanalId);
  setTimeout(() => botunTemizledigi.delete(kanalId), 10_000);
}

function topluSilindi(mesajlar, kanal) {
  if (!kanal.guild || botunTemizledigi.has(kanal.id)) return;
  return gunlukGonder(
    kanal.guild,
    'mesajlar',
    olustur('Toplu mesaj silindi', KIRMIZI, [
      ['Kanal', `${kanal}`],
      ['Adet', `${mesajlar.size} mesaj`],
    ]),
  );
}

function mesajDuzenlendi(eski, yeni) {
  if (!yeni.guild || yeni.author?.bot) return;
  // İçerik yalnızca Message Content Intent açıkken gelir; yoksa karşılaştıracak bir şey olmaz
  if (eski.partial || !eski.content || !yeni.content || eski.content === yeni.content) return;
  return gunlukGonder(
    yeni.guild,
    'mesajlar',
    olustur('Mesaj düzenlendi', SARI, [
      ['Yazan', kisi(yeni.author)],
      ['Kanal', `${yeni.channel} · [mesaja git](${yeni.url})`],
      ['Önce', eski.content],
      ['Sonra', yeni.content],
    ]),
  );
}

function sesDegisti(eski, yeni) {
  if (eski.channelId === yeni.channelId) return; // Susturma, kamera vb. değişiklikler
  const uye = yeni.member ?? eski.member;
  if (!uye) return;
  const kullanici = ['Kullanıcı', kisi(uye.user)];
  let embed;
  if (!eski.channelId) embed = olustur('Ses kanalına girdi', YESIL, [kullanici, ['Kanal', `${yeni.channel}`]]);
  else if (!yeni.channelId) embed = olustur('Ses kanalından çıktı', GRI, [kullanici, ['Kanal', `${eski.channel}`]]);
  else embed = olustur('Ses kanalı değiştirdi', MAVI, [kullanici, ['Önce', `${eski.channel}`], ['Sonra', `${yeni.channel}`]]);
  return gunlukGonder(yeni.guild, 'ses', embed);
}

// Denetim kaydından izlenen işlemler. Bunlar Discord arayüzünden elle yapılan
// işlemleri de yakalar; botun kendi komutları zaten ayrıca kaydedilir.
const DENETIM = {
  [AuditLogEvent.MemberKick]: { kategori: 'moderasyon', baslik: 'Üye atıldı', renk: SARI, hedef: 'kullanici' },
  [AuditLogEvent.MemberBanAdd]: { kategori: 'moderasyon', baslik: 'Üye yasaklandı', renk: KIRMIZI, hedef: 'kullanici' },
  [AuditLogEvent.MemberBanRemove]: { kategori: 'moderasyon', baslik: 'Yasak kaldırıldı', renk: YESIL, hedef: 'kullanici' },
  [AuditLogEvent.ChannelCreate]: { kategori: 'sunucu', baslik: 'Kanal oluşturuldu', renk: YESIL, hedef: 'ad' },
  [AuditLogEvent.ChannelDelete]: { kategori: 'sunucu', baslik: 'Kanal silindi', renk: KIRMIZI, hedef: 'ad' },
  [AuditLogEvent.RoleCreate]: { kategori: 'sunucu', baslik: 'Rol oluşturuldu', renk: YESIL, hedef: 'ad' },
  [AuditLogEvent.RoleDelete]: { kategori: 'sunucu', baslik: 'Rol silindi', renk: KIRMIZI, hedef: 'ad' },
};

function denetimKaydi(kayit, guild) {
  if (kayit.executorId === guild.client.user.id) return; // Botun kendi işlemleri

  const yetkili = ['Yetkili', kayit.executorId && `<@${kayit.executorId}>`];
  const sebep = ['Sebep', kayit.reason];

  // Susturma, üye güncellemesinin içinde bir değişiklik olarak gelir
  if (kayit.action === AuditLogEvent.MemberUpdate) {
    const susturma = kayit.changes.find((d) => d.key === 'communication_disabled_until');
    if (!susturma) return;
    const bitis = susturma.new && Date.parse(susturma.new);
    return gunlukGonder(
      guild,
      'moderasyon',
      olustur(bitis ? 'Üye susturuldu' : 'Susturma kaldırıldı', 0xeb459e, [
        ['Kullanıcı', `<@${kayit.targetId}>`],
        yetkili,
        ['Bitiş', bitis && zaman(bitis)],
        sebep,
      ]),
    );
  }

  const tanim = DENETIM[kayit.action];
  if (!tanim) return;
  const ad = kayit.changes.find((d) => d.key === 'name');
  const hedef =
    tanim.hedef === 'kullanici'
      ? ['Kullanıcı', `<@${kayit.targetId}> · ${kayit.targetId}`]
      : ['Ad', ad?.new ?? ad?.old ?? kayit.targetId];
  return gunlukGonder(guild, tanim.kategori, olustur(tanim.baslik, tanim.renk, [hedef, yetkili, sebep]));
}

function baslat(client) {
  // Günlükteki bir hata botu etkilemesin
  const dinle = (olay, islev) =>
    client.on(olay, (...argumanlar) => {
      Promise.resolve()
        .then(() => islev(...argumanlar))
        .catch((hata) => console.error(`Günlük hatası (${olay}):`, hata.message));
    });

  dinle(Events.GuildMemberAdd, uyeKatildi);
  dinle(Events.GuildMemberRemove, uyeAyrildi);
  dinle(Events.GuildMemberUpdate, uyeGuncellendi);
  dinle(Events.MessageDelete, mesajSilindi);
  dinle(Events.MessageBulkDelete, topluSilindi);
  dinle(Events.MessageUpdate, mesajDuzenlendi);
  dinle(Events.VoiceStateUpdate, sesDegisti);
  dinle(Events.GuildAuditLogEntryCreate, denetimKaydi);
}

module.exports = {
  KATEGORILER,
  kategoriAcik,
  gunlukGonder,
  temizlemeBildir,
  baslat,
  // Test için
  olaylar: { uyeKatildi, uyeAyrildi, uyeGuncellendi, mesajSilindi, topluSilindi, mesajDuzenlendi, sesDegisti, denetimKaydi },
};
