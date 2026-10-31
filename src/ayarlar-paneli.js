// /ayarlar paneli: botun sunucu ayarları tek kartta, tıklayarak.
//
// Komut yalnızca yazana görünen bir kart açar. İlk satır bölüm menüsüdür; bölüm seçilince kart o bölümün
// ekranına döner. Açma/kapama düğmeleri ve kanal/rol menüleri ayarı hemen değiştirir; diğer işler
// (ör. yasaklı kelime ekleme) düğmeye basınca açılan formla yapılır.
//
// Ayarları panel kendisi değiştirmez: her değişiklik ilgili komutun kendi execute'u ile yapılır (ör. spam
// düğmesi "/koruma filtre tur:spam durum:Açık" çalıştırır). Böylece yazarak ve tıklayarak yapmak aynı
// denetimlerden geçer. Komutun cevabı kartın üstünde gösterilir, kart yeni durumla yeniden çizilir.
// Komutu olmayan birkaç küçük iş (ör. günlük kategorileri, bir ayarı kaldırmak) burada yapılır.
//
// Kart kalıcıdır: süre dolmaz, bot yeniden başlasa da çalışır. Durum customId'de taşınır:
//   ay:b                         bölüm menüsü (seçilen değer bölüm kimliği)
//   ay:g:<bölüm>                 bölümü yeniden çiz (Vazgeç)
//   ay:h:<bölüm>:<kontrol>       açma/kapama düğmesi ya da kanal/rol menüsü
//   ay:i:<bölüm>:<işlem>         komut düğmesi; işlem "komut" ya da "komut alt"
//   ay:o:<bölüm>:<işlem>         geri alınması zor işlemin onayı
//   ay:a:<bölüm>:<işlem>         formu 5 alandan uzun işlemde doldurulacak alanların seçimi
//   ay:f:<bölüm>:<işlem>:<sıra>  gönderilen form; sıra: formdaki alanların sıra numaraları (boş: hepsi)
//   ay:ac                        kartı yeni bir mesajda açar (/yardim'daki ve botun ilk mesajındaki düğme)
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('./depo');
const panel = require('./komut-paneli');
const ISLEMLER = require('./yardim-islemler');
const koruma = require('./koruma');
const seviye = require('./seviye');
const uyari = require('./uyari');
const yapayzeka = require('./yapayzeka');
const instagram = require('./instagram');
const yayin = require('./yayin');
const haber = require('./haber');
const { KATEGORILER, kategoriAcik } = require('./gunluk');
const { hataMetni } = require('./yardimci');

const RENK = 0x5865f2;
const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);
const kanal = (id) => (id ? `<#${id}>` : null);
const rol = (id) => (id ? `<@&${id}>` : null);
const satir = (...bilesenler) => new ActionRowBuilder().addComponents(bilesenler.filter(Boolean));
const dugme = (customId, etiket, stil = ButtonStyle.Secondary, simge = null) => {
  const d = new ButtonBuilder().setCustomId(customId).setLabel(kisalt(etiket, 80)).setStyle(stil);
  return simge ? d.setEmoji(simge) : d;
};
// Aç/kapat düğmesi: etikette şu anki durum yazar, basınca tersine döner
const acKapat = (customId, ad, acik, simge) => dugme(customId, `${ad}: ${acik ? 'Açık' : 'Kapalı'}`, acik ? ButtonStyle.Success : ButtonStyle.Secondary, simge);

// Kanal ve rol menüleri: seçili olan önceden işaretli gelir; boşaltılırsa ayar kalkar
function kanalMenusu(customId, yer, secili, guild) {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(yer)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(0)
    .setMaxValues(1);
  if (secili && guild?.channels?.cache?.has(secili)) menu.setDefaultChannels(secili);
  return menu;
}
function rolMenusu(customId, yer, secili, guild) {
  const menu = new RoleSelectMenuBuilder().setCustomId(customId).setPlaceholder(yer).setMinValues(0).setMaxValues(1);
  if (secili && guild?.roles?.cache?.has(secili)) menu.setDefaultRoles(secili);
  return menu;
}

// Komut çağrısı: hızlı kontrollerin döndürdüğü, komutun hangi seçeneklerle çalıştırılacağı
const komutla = (deger, degerler = {}) => ({ deger, degerler });

// --- Bölümler ---
//   id, simge, ad, aciklama        menüde görünen ad ve açıklama
//   gorunur?()                      bölüm menüde görünsün mü (ör. Instagram bağlantısı kurulu mu)
//   ozet(interaction)               genel bakıştaki tek satırlık durum
//   kart(interaction)               bölümün ayar kartı
//   kontroller?(interaction)        açma/kapama düğmeleri, kanal ve rol menüleri (en fazla 2 satır)
//   hizli?: { kontrol: (interaction) => komutla(...) | { metin } }
//   islemler: [{ deger, ad?, simge?, kartta?, embedler?, onay? }]  düğmeyle çalışan komutlar (en fazla 10)
//     kartta: false → komut kendi mesajında çalışır (kendi önizleme ve onay adımları olan /sunucukur gibi)
//     embedler: komutun cevap kartı da gösterilsin (ör. kilit sonucu)
//     onay: false → geri alınması zor olsa da panel ayrıca onay sormaz (komut kendisi soruyor)

const FILTRELER = [
  { tur: 'spam', ad: 'Spam', simge: '📨' },
  { tur: 'kufur', ad: 'Küfür', simge: '🤬' },
  { tur: 'baglanti', ad: 'Zararlı bağlantı', simge: '🔗' },
  { tur: 'gorsel', ad: 'Dolandırıcılık görseli', simge: '🖼️' },
];

const KORUMA = {
  id: 'koruma',
  simge: '🛡️',
  ad: 'Koruma',
  aciklama: 'Spam, küfür, zararlı bağlantı ve dolandırıcılık görseli filtreleri; acil durum kilidi',
  ozet(interaction) {
    const ayar = koruma.ayarCoz(ayarlariGetir(interaction.guildId));
    const acik = FILTRELER.filter((f) => ayar[f.tur]).map((f) => f.ad);
    return acik.length ? `🟢 ${acik.join(' · ')}` : '⚫ Bütün filtreler kapalı';
  },
  kart: (interaction) => require('./commands/koruma').ayarKarti(interaction.guildId),
  kontroller(interaction) {
    const ayar = koruma.ayarCoz(ayarlariGetir(interaction.guildId));
    return [satir(...FILTRELER.map((f) => acKapat(`ay:h:koruma:${f.tur}`, f.ad, ayar[f.tur], f.simge)))];
  },
  hizli: Object.fromEntries(
    FILTRELER.map((f) => [
      f.tur,
      (interaction) => {
        const acik = koruma.ayarCoz(ayarlariGetir(interaction.guildId))[f.tur];
        return komutla('koruma filtre', { tur: f.tur, durum: acik ? 'kapali' : 'acik' });
      },
    ]),
  ),
  islemler: [
    { deger: 'koruma filtre', simge: '⚙️', ad: 'Susturma süresi ve ayrıntılar' },
    { deger: 'koruma kelime' },
    { deger: 'koruma alan' },
    { deger: 'kilit kapat', embedler: true },
    { deger: 'kilit ac' },
  ],
};

const GUNLUK = {
  id: 'gunluk',
  simge: '📜',
  ad: 'Günlük (log)',
  aciklama: 'Üye, mesaj, ses ve yönetim olaylarının yazılacağı kanal',
  ozet(interaction) {
    const a = ayarlariGetir(interaction.guildId);
    if (!a.logKanali) return '⚫ Kanal seçilmedi';
    const kapali = Object.keys(KATEGORILER).filter((k) => !kategoriAcik(a, k)).length;
    return `🟢 ${kanal(a.logKanali)}${kapali ? ` · ${kapali} kategori kapalı` : ''}`;
  },
  kart(interaction) {
    const a = ayarlariGetir(interaction.guildId);
    return new EmbedBuilder()
      .setTitle('📜 Sunucu günlüğü')
      .setColor(RENK)
      .setDescription(
        [
          `**Kanal:** ${kanal(a.logKanali) ?? 'seçilmedi (kayıt tutulmuyor)'}`,
          '',
          ...Object.entries(KATEGORILER).map(([k, ad]) => `${kategoriAcik(a, k) ? '🟢' : '⚫'} ${ad}`),
        ].join('\n'),
      )
      .setFooter({ text: 'Kanalı ilk menüden seç; hangi olayların yazılacağını ikinci menüden işaretle.' });
  },
  kontroller(interaction) {
    const a = ayarlariGetir(interaction.guildId);
    const kategoriler = new StringSelectMenuBuilder()
      .setCustomId('ay:h:gunluk:kategori')
      .setPlaceholder('Yazılacak olaylar (hiçbiri: kayıt tutulmaz)')
      .setMinValues(0)
      .setMaxValues(Object.keys(KATEGORILER).length)
      .addOptions(Object.entries(KATEGORILER).map(([k, ad]) => ({ label: kisalt(ad.split(' (')[0], 100), description: kisalt(ad, 100), value: k, default: kategoriAcik(a, k) })));
    return [satir(kanalMenusu('ay:h:gunluk:kanal', 'Günlük kanalı seç (boşalt: kayıt tutulmaz)', a.logKanali, interaction.guild)), satir(kategoriler)];
  },
  hizli: {
    kanal(interaction) {
      const secilen = interaction.channels?.first();
      if (secilen) return komutla('ayarla gunluk', { kanal: secilen });
      ayarKaydet(interaction.guildId, 'logKanali', null);
      return { metin: '✅ Günlük kanalı kaldırıldı; artık kayıt tutulmuyor.' };
    },
    kategori(interaction) {
      const secilen = new Set(interaction.values ?? []);
      ayarKaydet(interaction.guildId, 'logKategorileri', Object.fromEntries(Object.keys(KATEGORILER).map((k) => [k, secilen.has(k)])));
      const uyar = secilen.size && !ayarlariGetir(interaction.guildId).logKanali ? '\nKayıtların yazılması için yukarıdan bir kanal seç.' : '';
      return { metin: `✅ Günlüğe yazılacak olaylar güncellendi: ${secilen.size}/${Object.keys(KATEGORILER).length} açık.${uyar}` };
    },
  },
  islemler: [],
};

const KARSILAMA = {
  id: 'karsilama',
  simge: '👋',
  ad: 'Karşılama',
  aciklama: 'Yeni üyelere hoş geldin mesajı ve otomatik rol',
  ozet(interaction) {
    const a = ayarlariGetir(interaction.guildId);
    const parcalar = [kanal(a.hosgeldinKanali), a.otoRol && `oto rol ${rol(a.otoRol)}`].filter(Boolean);
    return parcalar.length ? `🟢 ${parcalar.join(' · ')}` : '⚫ Kapalı';
  },
  kart(interaction) {
    const a = ayarlariGetir(interaction.guildId);
    return new EmbedBuilder()
      .setTitle('👋 Karşılama')
      .setColor(RENK)
      .setDescription(
        [
          `**Hoş geldin kanalı:** ${kanal(a.hosgeldinKanali) ?? 'seçilmedi (mesaj atılmaz)'}`,
          `**Oto rol:** ${rol(a.otoRol) ?? 'yok'}`,
          '',
          'Yeni üye katılınca hoş geldin kanalına bir karşılama mesajı atılır ve oto rol verilir.',
        ].join('\n'),
      )
      .setFooter({ text: 'Bir menüyü boşaltırsan o ayar kalkar.' });
  },
  kontroller(interaction) {
    const a = ayarlariGetir(interaction.guildId);
    return [
      satir(kanalMenusu('ay:h:karsilama:kanal', 'Hoş geldin kanalı (boşalt: mesaj atılmaz)', a.hosgeldinKanali, interaction.guild)),
      satir(rolMenusu('ay:h:karsilama:rol', 'Yeni üyelere verilecek rol (boşalt: yok)', a.otoRol, interaction.guild)),
    ];
  },
  hizli: {
    kanal(interaction) {
      const secilen = interaction.channels?.first();
      if (secilen) return komutla('ayarla hosgeldin', { kanal: secilen });
      ayarKaydet(interaction.guildId, 'hosgeldinKanali', null);
      return { metin: '✅ Hoş geldin mesajı kapatıldı.' };
    },
    rol(interaction) {
      const secilen = interaction.roles?.first();
      if (secilen) return komutla('ayarla hosgeldin', { 'oto-rol': secilen });
      ayarKaydet(interaction.guildId, 'otoRol', null);
      return { metin: '✅ Oto rol kaldırıldı.' };
    },
  },
  islemler: [],
};

const SEVIYE = {
  id: 'seviye',
  simge: '📈',
  ad: 'Seviye sistemi',
  aciklama: 'Mesaj yazdıkça kazanılan seviyeler ve seviye ödülü rolleri',
  ozet(interaction) {
    const ayar = seviye.ayarCoz(ayarlariGetir(interaction.guildId));
    return ayar.acik ? `🟢 Açık${ayar.oduller.length ? ` · ${ayar.oduller.length} ödül` : ''}` : '⚫ Kapalı';
  },
  kart(interaction) {
    const ayar = seviye.ayarCoz(ayarlariGetir(interaction.guildId));
    return new EmbedBuilder()
      .setTitle('📈 Seviye sistemi')
      .setColor(0x57f287)
      .setDescription(
        [
          `**Durum:** ${ayar.acik ? '🟢 Açık' : '⚫ Kapalı'}`,
          `**Duyuru kanalı:** ${kanal(ayar.kanal) ?? 'mesajın yazıldığı kanal'}`,
          `**Rol ödülleri:** ${ayar.oduller.length ? ayar.oduller.map((o) => `${o.seviye}. seviye → ${rol(o.rolId)}`).join(' · ') : 'yok'}`,
          '',
          'Üyeler mesaj yazdıkça XP kazanır (dakikada en fazla bir kez). Kapatınca kazanılmış XP silinmez.',
        ].join('\n'),
      );
  },
  kontroller(interaction) {
    const ayar = seviye.ayarCoz(ayarlariGetir(interaction.guildId));
    return [
      satir(acKapat('ay:h:seviye:durum', 'Seviye sistemi', ayar.acik, '📈')),
      satir(kanalMenusu('ay:h:seviye:kanal', 'Seviye duyuru kanalı (boşalt: mesajın yazıldığı kanal)', ayar.kanal, interaction.guild)),
    ];
  },
  hizli: {
    durum(interaction) {
      const { acik } = seviye.ayarCoz(ayarlariGetir(interaction.guildId));
      return komutla('seviye ayar', { durum: acik ? 'kapali' : 'acik' });
    },
    kanal(interaction) {
      const secilen = interaction.channels?.first();
      if (secilen) return komutla('seviye ayar', { kanal: secilen });
      ayarKaydet(interaction.guildId, 'seviyeKanali', null);
      return { metin: '✅ Seviye atlayanlar artık mesajı yazdıkları kanalda duyurulacak.' };
    },
  },
  islemler: [{ deger: 'seviye odul' }, { deger: 'seviye sifirla' }],
};

const UYARI = {
  id: 'uyari',
  simge: '⚠️',
  ad: 'Uyarı cezaları',
  aciklama: 'Uyarı sayısına göre otomatik susturma, atma ya da yasaklama',
  ozet(interaction) {
    const liste = uyari.kurallar(interaction.guildId);
    return liste.length ? `🟢 ${liste.length} kural` : '⚫ Kural yok';
  },
  kart(interaction) {
    const liste = uyari.kurallar(interaction.guildId);
    return new EmbedBuilder()
      .setTitle('⚠️ Uyarı cezaları')
      .setColor(0xfee75c)
      .setDescription(
        [
          liste.length ? liste.map((k) => `• ${uyari.kuralMetni(k)}`).join('\n') : 'Henüz kural yok; uyarılar yalnızca kaydedilir.',
          '',
          'Üyenin uyarı sayısı bir kuralın eşiğine gelince o işlem kendiliğinden uygulanır (ör. 3. uyarıda 1 saat susturma).',
          'Uyarı vermek için üyeye sağ tıkla → **Uygulamalar → Moderasyon**.',
        ].join('\n'),
      );
  },
  islemler: [{ deger: 'uyari kural', simge: '➕', ad: 'Kural ekle ya da kaldır' }],
};

// Bildirim bölümleri: kart komutun kendi kartıdır; işler komutun alt komutlarıdır
function bildirimBolumu({ id, simge, ad, aciklama, komut, kanalAnahtari, sayi, gorunur }) {
  return {
    id,
    simge,
    ad,
    aciklama,
    gorunur,
    ozet(interaction) {
      const a = ayarlariGetir(interaction.guildId);
      const adet = sayi?.(interaction.guildId);
      return a[kanalAnahtari] ? `🟢 ${kanal(a[kanalAnahtari])}${adet != null ? ` · ${adet}` : ''}` : '⚫ Kanal seçilmedi';
    },
    kart: (interaction) =>
      EmbedBuilder.from(require(`./commands/${komut}`).kart(interaction.guildId)).setFooter({ text: 'Değiştirmek için aşağıdaki düğmeleri kullan; gereken bilgiler form olarak sorulur.' }),
    islemler: Object.keys(ISLEMLER)
      .filter((d) => d.startsWith(`${komut} `))
      .map((deger) => ({ deger })),
  };
}

const OYUN = bildirimBolumu({ id: 'oyun', simge: '🎮', ad: 'Oyun fırsatları', aciklama: 'Bedava oyun ve indirim bildirimleri (Steam, Epic, GOG)', komut: 'oyun', kanalAnahtari: 'oyunKanali' });
const YAYIN = bildirimBolumu({
  id: 'yayin',
  simge: '📺',
  ad: 'Canlı yayınlar',
  aciklama: 'Twitch, Kick ve YouTube yayıncıları yayına geçince bildirim',
  komut: 'yayin',
  kanalAnahtari: 'yayinKanali',
  sayi: (id) => `${yayin.liste(id).length} yayıncı`,
});
const HABER = bildirimBolumu({
  id: 'haber',
  simge: '📰',
  ad: 'Haberler',
  aciklama: 'Takip edilen sitelerin yeni haberleri (RSS)',
  komut: 'haber',
  kanalAnahtari: 'haberKanali',
  sayi: (id) => `${haber.liste(id).length} kaynak`,
});
const INSTAGRAM = bildirimBolumu({
  id: 'instagram',
  simge: '📸',
  ad: 'Instagram',
  aciklama: 'Seçilen hesapların yeni gönderileri',
  komut: 'instagram',
  kanalAnahtari: 'instagramKanali',
  sayi: (id) => `${instagram.liste(id).length} hesap`,
  gorunur: () => instagram.hazir(),
});

const OZET = {
  id: 'ozet',
  simge: '📝',
  ad: 'Kanal özetleri',
  aciklama: 'Üyeler /ozetle ile kanalın son mesajlarını yapay zekâya özetletebilsin',
  gorunur: () => yapayzeka.hazir(),
  ozet: (interaction) => (ayarlariGetir(interaction.guildId).ozetAcik ? '🟢 Açık' : '⚫ Kapalı'),
  kart(interaction) {
    const acik = Boolean(ayarlariGetir(interaction.guildId).ozetAcik);
    return new EmbedBuilder()
      .setTitle('📝 Kanal özetleri')
      .setColor(RENK)
      .setDescription(
        [
          `**Durum:** ${acik ? '🟢 Açık' : '⚫ Kapalı'}`,
          '',
          'Açıkken üyeler `/ozetle` ile bulundukları kanalın son mesajlarını kısa maddelerle özetletebilir.',
          'Özetlenen mesajlar Google\'ın yapay zekâsına gönderilir; bot mesajları saklamaz. Yalnızca kanalın mesaj geçmişini okuyabilenler özet alabilir.',
        ].join('\n'),
      );
  },
  kontroller: (interaction) => [satir(acKapat('ay:h:ozet:durum', 'Kanal özetleri', Boolean(ayarlariGetir(interaction.guildId).ozetAcik), '📝'))],
  hizli: { durum: (interaction) => komutla('ayarla ozet', { durum: ayarlariGetir(interaction.guildId).ozetAcik ? 'kapali' : 'acik' }) },
  islemler: [],
};

const KURULUM = {
  id: 'kurulum',
  simge: '🏗️',
  ad: 'Kurulum ve roller',
  aciklama: 'Hazır şablonla sunucu kurulumu, kurulumu silme, rol seçme menüsü',
  ozet: () => 'Hazır şablon · rol menüsü',
  kart: () =>
    new EmbedBuilder()
      .setTitle('🏗️ Kurulum ve roller')
      .setColor(RENK)
      .setDescription(
        [
          '**🏗️ Hazır sunucu kurulumu:** boş ya da yeni bir sunucuya roller, kanallar, izinler, üyelik onayı ve destek sistemini tek seferde kurar. Önce ne kurulacağını gösterir, onayını bekler.',
          '**🧹 Kurulumu sil:** hazır kurulumun oluşturduklarını, yine önce listeleyip onay alarak siler.',
          '**🎭 Rol menüsü:** üyelerin düğmeye basarak kendine rol alabildiği bir mesaj koyar (ör. oyun ya da bildirim rolleri).',
          '',
          'Kurulumdan önce Sunucu Ayarları → Roller bölümünde **Voyager** rolünü listenin üstlerine taşı.',
        ].join('\n'),
      ),
  islemler: [{ deger: 'sunucukur', kartta: false }, { deger: 'sunucusil', kartta: false, onay: false }, { deger: 'rolmenu' }],
};

const BOLUMLER = [KORUMA, GUNLUK, KARSILAMA, SEVIYE, UYARI, OYUN, YAYIN, HABER, INSTAGRAM, OZET, KURULUM];
const bolumBul = (id) => BOLUMLER.find((b) => b.id === id) ?? null;
const gorunenler = () => BOLUMLER.filter((b) => b.gorunur?.() ?? true);

// Bölümün bu üyenin çalıştırabildiği işlemleri; ad ve simge yardim-islemler.js'ten
function islemler(interaction, bolum) {
  return bolum.islemler
    .map((t) => {
      const [komut, alt = null] = t.deger.split(' ');
      return { ...ISLEMLER[t.deger], ...t, komut, alt, modul: interaction.client.komutlar?.get(komut) };
    })
    .filter((i) => panel.calistirilabilir(interaction, i.modul));
}
const islemBul = (interaction, bolum, deger) => islemler(interaction, bolum).find((i) => i.deger === deger) ?? null;

function islemAlanlari(islem) {
  const hedef = panel.hedefBul(islem.modul.data.toJSON(), islem.alt);
  return { hedef, alanlar: hedef ? panel.alanlariHazirla(hedef.secenekler) : [] };
}

// --- Ekranlar ---
function bolumMenusu(secili) {
  return satir(
    new StringSelectMenuBuilder()
      .setCustomId('ay:b')
      .setPlaceholder('Bir bölüm seç')
      .addOptions(
        { label: 'Genel bakış', value: 'genel', emoji: '🏠', description: 'Bütün ayarların özeti', default: secili === 'genel' },
        ...gorunenler().map((b) => ({ label: b.ad, value: b.id, emoji: b.simge, description: kisalt(b.aciklama, 100), default: b.id === secili })),
      ),
  );
}

function genelKart(interaction) {
  return new EmbedBuilder()
    .setTitle('⚙️ Voyager ayarları')
    .setColor(RENK)
    .setDescription(
      [
        'Aşağıdaki menüden bir bölüm seç; ayarları düğmelerle açıp kapatabilir, kanal ve rolleri menüden seçebilirsin. Komut yazman gerekmez.',
        'Bu kartı yalnızca sen görüyorsun.',
      ].join('\n'),
    )
    .addFields(gorunenler().map((b) => ({ name: `${b.simge} ${b.ad}`, value: kisalt(b.ozet(interaction), 1024), inline: true })))
    .setFooter({ text: 'Komutla yapmayı seviyorsan hepsi yerinde: /koruma, /ayarla, /seviye, /oyun… · Bütün komutlar: /yardim' });
}

// durum: { icerik, onay, alanSecimi }
// onay: onay bekleyen işlemin değeri · alanSecimi: hangi alanların doldurulacağı sorulan işlemin değeri
function ekran(interaction, bolumId, durum = {}) {
  const temel = { content: durum.icerik ? kisalt(durum.icerik, 2000) : null, allowedMentions: { parse: [] } };
  const bolum = bolumBul(bolumId);
  if (!bolum || !(bolum.gorunur?.() ?? true)) return { ...temel, embeds: [genelKart(interaction)], components: [bolumMenusu('genel')] };

  const satirlar = [bolumMenusu(bolum.id), ...(bolum.kontroller?.(interaction) ?? [])];
  const isler = islemler(interaction, bolum);
  const onay = isler.find((i) => i.deger === durum.onay);
  const alanSecimi = isler.find((i) => i.deger === durum.alanSecimi);
  if (onay) {
    temel.content = `⚠️ **${onay.simge} ${onay.ad}**: geri alınması zor bir işlem. Emin misin?`;
    satirlar.push(satir(dugme(`ay:o:${bolum.id}:${onay.deger}`, `Evet: ${onay.ad}`, ButtonStyle.Danger, onay.simge), dugme(`ay:g:${bolum.id}`, 'Vazgeç')));
  } else if (alanSecimi) {
    const { alanlar } = islemAlanlari(alanSecimi);
    const zorunlu = alanlar.filter((a) => a.zorunlu).length;
    const secmeli = alanlar.map((a, sira) => ({ a, sira })).filter(({ a }) => !a.zorunlu);
    temel.content = `${alanSecimi.simge} **${alanSecimi.ad}**: bu işlemin ${alanlar.length} seçeneği var, bir formda en fazla ${panel.FORM_SINIRI} tanesi sorulabilir. Değiştirmek istediklerini aşağıdan seç; seçmediklerin olduğu gibi kalır.`;
    satirlar.push(
      satir(
        new StringSelectMenuBuilder()
          .setCustomId(`ay:a:${bolum.id}:${alanSecimi.deger}`)
          .setPlaceholder('Değiştirmek istediğin seçenekleri seç')
          .setMinValues(1)
          .setMaxValues(Math.min(panel.FORM_SINIRI - zorunlu, secmeli.length))
          .addOptions(secmeli.slice(0, 25).map(({ a, sira }) => ({ label: kisalt(a.etiket, 100), value: String(sira), ...(a.aciklama && { description: a.aciklama }) }))),
      ),
      satir(dugme(`ay:g:${bolum.id}`, 'Vazgeç')),
    );
  } else {
    // Bir satıra en fazla 5 düğme sığar
    for (let i = 0; i < isler.length && satirlar.length < 5; i += 5) {
      satirlar.push(satir(...isler.slice(i, i + 5).map((is) => dugme(`ay:i:${bolum.id}:${is.deger}`, is.ad, is.tehlikeli ? ButtonStyle.Danger : ButtonStyle.Primary, is.simge))));
    }
  }
  return { ...temel, embeds: [bolum.kart(interaction)], components: satirlar.slice(0, 5) };
}

// /ayarlar komutu ve "Ayarlar" düğmeleri: kartı yeni bir mesajda açar
function ac(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ Ayarları değiştirmek için **Sunucuyu Yönet** yetkin olmalı. Kullanabildiğin komutlar için `/yardim` yaz.', flags: MessageFlags.Ephemeral });
  }
  return interaction.reply({ ...ekran(interaction, 'genel'), flags: MessageFlags.Ephemeral });
}

// --- İşlemler ---
// Etkileşim kartı yerinde güncelleyebilir mi? Düğme ve menüler her zaman; form yalnızca karttaki bir
// düğmeyle açıldıysa.
const kartiGunceller = (interaction) => typeof interaction.update === 'function' && (interaction.isModalSubmit?.() ? interaction.isFromMessage() : true);
const guncelle = (interaction, cevap) => (kartiGunceller(interaction) ? interaction.update(cevap) : interaction.reply({ ...cevap, flags: MessageFlags.Ephemeral }));

// Komutu çalıştırır. Kartta çalışan işlemde komutun cevabı kartın üstüne gelir ve kart yeniden çizilir.
function calistir(interaction, bolum, islem, hedef, degerler) {
  if (islem.kartta === false || !kartiGunceller(interaction)) return panel.calistir(interaction, islem.modul, hedef, degerler);
  return panel.calistir(interaction, islem.modul, hedef, degerler, panel.kartIcinde(interaction, () => ekran(interaction, bolum.id), { embedler: islem.embedler }));
}

async function formAc(interaction, bolum, islem, hedef, alanlar, siralar = '') {
  const customId = `ay:f:${bolum.id}:${islem.deger}:${siralar}`;
  const form = await panel.formKur({ interaction, komut: islem.modul, hedef, alanlar, customId, baslik: `${islem.simge} ${islem.ad}` });
  return interaction.showModal(form);
}

// Hızlı kontrol (aç/kapat düğmesi, kanal ya da rol menüsü)
async function hizliKontrol(interaction, bolum, kontrol) {
  const isle = bolum.hizli?.[kontrol];
  if (!isle) return interaction.update(ekran(interaction, bolum.id));
  const sonuc = await isle(interaction);
  if (sonuc.metin) return interaction.update(ekran(interaction, bolum.id, { icerik: sonuc.metin }));

  const [komut, alt = null] = sonuc.deger.split(' ');
  const modul = interaction.client.komutlar.get(komut);
  if (!panel.calistirilabilir(interaction, modul)) return interaction.update(ekran(interaction, bolum.id, { icerik: '❌ Bunu değiştirmek için gereken yetkin yok.' }));
  const hedef = panel.hedefBul(modul.data.toJSON(), alt);
  return calistir(interaction, bolum, { modul }, hedef, new Map(Object.entries(sonuc.degerler)));
}

async function islemYap(interaction, tur, bolum, deger, siralar) {
  const islem = islemBul(interaction, bolum, deger);
  // Listede olmayan değer (yetki alınmış ya da eski kart): yalnızca bölüm yeniden çizilir
  if (!islem) {
    return guncelle(interaction, ekran(interaction, bolum.id, { icerik: '❌ Bu işlemi yapamazsın ya da kart eski.' }));
  }
  const { hedef, alanlar } = islemAlanlari(islem);

  if (tur === 'o') return calistir(interaction, bolum, islem, hedef, new Map());
  if (tur === 'a') {
    // Seçilen sıra numaraları da kullanıcıdan gelir; yalnızca bu işlemin seçmeli alanları kabul edilir
    const secilen = new Set((interaction.values ?? []).map(Number));
    const sira = alanlar.map((a, i) => (a.zorunlu || secilen.has(i) ? i : null)).filter((i) => i !== null).slice(0, panel.FORM_SINIRI);
    return formAc(interaction, bolum, islem, hedef, sira.map((i) => alanlar[i]), sira.join(','));
  }
  if (tur === 'f') {
    const sira = siralar ? siralar.split(',').map(Number) : alanlar.map((_, i) => i);
    const formdakiler = sira.map((i) => alanlar[i]).filter(Boolean).slice(0, panel.FORM_SINIRI);
    const { degerler, hatalar } = panel.formuOku(interaction, formdakiler);
    if (hatalar.length) {
      return guncelle(interaction, ekran(interaction, bolum.id, { icerik: `❌ ${hatalar.join('\n')}\nDüğmeye yeniden basıp formu düzelterek gönder.` }));
    }
    return calistir(interaction, bolum, islem, hedef, degerler);
  }

  // Düğme
  if (!alanlar.length) {
    if (islem.onay ?? islem.tehlikeli) return interaction.update(ekran(interaction, bolum.id, { onay: islem.deger }));
    return calistir(interaction, bolum, islem, hedef, new Map());
  }
  if (alanlar.length > panel.FORM_SINIRI) return interaction.update(ekran(interaction, bolum.id, { alanSecimi: islem.deger }));
  return formAc(interaction, bolum, islem, hedef, alanlar);
}

// "ay:" ile başlayan düğme, menü ve formlar (index.js yollar)
async function etkilesim(interaction) {
  const [, tur, bolumId, ...kalan] = interaction.customId.split(':');
  if (tur === 'ac') return ac(interaction);
  // Kart yalnızca açana görünür, ama yetkisi sonradan alınmış olabilir
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ Ayarları değiştirmek için **Sunucuyu Yönet** yetkin olmalı.', flags: MessageFlags.Ephemeral });
  }
  if (tur === 'b') return interaction.update(ekran(interaction, interaction.values?.[0]));
  const bolum = bolumBul(bolumId);
  if (!bolum || !(bolum.gorunur?.() ?? true)) return guncelle(interaction, ekran(interaction, 'genel'));
  if (tur === 'g') return interaction.update(ekran(interaction, bolum.id));
  if (tur === 'h') return hizliKontrol(interaction, bolum, kalan[0]);
  if (['i', 'o', 'a', 'f'].includes(tur)) {
    // f: son parça formdaki alanların sıra numaraları; işlemin adında ":" yok
    const deger = tur === 'f' ? kalan.slice(0, -1).join(':') : kalan.join(':');
    return islemYap(interaction, tur, bolum, deger, tur === 'f' ? kalan.at(-1) : '');
  }
  console.error('Ayarlar paneli: bilinmeyen işlem', hataMetni(interaction.customId));
  return interaction.update(ekran(interaction, bolum.id));
}

module.exports = { BOLUMLER, ac, ekran, etkilesim };
