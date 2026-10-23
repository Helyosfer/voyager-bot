// /ayarlar → Kurulum: hazır sunucu şablonu ve rol menüsü
//
// Şablon akışı kartın içinde ilerler (durum): "" → "sablonlar" (liste) → "onizleme:<şablon>" → kurulum.
// Şablon kurmak Yönetici ister. Rol menüsü tek bir formla kurulur ve Rolleri Yönet ister.
const {
  ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, LabelBuilder, PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const topluluk = require('../topluluk');
const rolmenu = require('../rolmenu');
const { yazabilirMi, rolVermeEngeli, logGonder } = require('../yardimci');
const { kimlik, dugme, satir, form, metinAlani, formMetni, formSecimi, ButtonStyle } = require('./arac');

const ID = 'kurulum';
const { SABLONLAR } = topluluk;

// Şablon kurulumunun eksiksiz çalışması için botta olması gereken izinler
const GEREKLI = [
  [PermissionFlagsBits.ManageChannels, 'Kanalları Yönet'],
  [PermissionFlagsBits.ManageRoles, 'Rolleri Yönet'],
];
// Olmazsa kurulum yine çalışır ama ilgili izin kuralları eksik kalır
const ONERILEN = [
  [PermissionFlagsBits.Connect, 'Bağlan'],
  [PermissionFlagsBits.Speak, 'Konuş'],
  [PermissionFlagsBits.Stream, 'Video'],
  [PermissionFlagsBits.AttachFiles, 'Dosya Ekle'],
];
const kurulan = new Set(); // Kurulumu süren sunucular

const yonetici = (interaction) => Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
const eksikIzinler = (guild, liste) => liste.filter(([izin]) => !guild.members.me.permissions.has(izin)).map(([, ad]) => ad);

function anaKart() {
  return new EmbedBuilder()
    .setTitle('🧰 Kurulum')
    .setColor(0x5865f2)
    .setDescription(
      [
        '**🛠️ Hazır sunucu şablonu** · Sunucunun amacına uyan şablonu seç; roller, kategoriler, kanallar, izinler ve botun ayarları kendiliğinden kurulur. Önce ne kurulacağını gösteririm, onaylamadan hiçbir şey değişmez. Mevcut kanal ve roller silinmez. *(Yönetici gerekir)*',
        '',
        '**🎭 Rol menüsü** · Seçtiğin kanala, üyelerin düğmeye basarak rol alıp bıraktığı bir menü koyar (en fazla 10 rol). *(Rolleri Yönet gerekir)*',
      ].join('\n'),
    );
}

// Şablonların karşılaştırması: hangisi ne kurar
function sablonListesi() {
  const embed = new EmbedBuilder()
    .setTitle('🛠️ Sunucu kurulumu · Şablon seç')
    .setColor(0x5865f2)
    .setDescription('Sunucunun kullanım amacına uyan şablonu aşağıdaki menüden seç. Seçince ne kurulacağını gösteririm; onaylamadan hiçbir şey değişmez.');
  for (const sablon of Object.values(SABLONLAR)) {
    const kanal = sablon.kategoriler.reduce((t, k) => t + k.kanallar.length, 0);
    const ozellikler = [sablon.onay ? 'üyelik onayı' : 'onaysız', sablon.kategoriler.some((k) => k.anahtar === 'talepler') ? 'destek talepleri' : null]
      .filter(Boolean)
      .join(', ');
    embed.addFields({ name: sablon.ad, value: `${sablon.aciklama}\n-# ${sablon.roller.length} rol · ${sablon.kategoriler.length} kategori · ${kanal} kanal · ${ozellikler}` });
  }
  return embed;
}

function onizleme(plan, eksikOnerilen) {
  const sablon = SABLONLAR[plan.sablon];
  const isaret = (oge) => (oge.mevcut ? '▫️' : '🟢');
  const embed = new EmbedBuilder()
    .setTitle(`🛠️ Sunucu kurulumu · ${sablon.ad}`)
    .setColor(0x5865f2)
    .setDescription(
      [sablon.aciklama, '🟢 oluşturulacak · ▫️ zaten var, dokunulmayacak', '', `**Roller (${plan.roller.length})**`, plan.roller.map((r) => `${isaret(r)} ${r.ad}`).join(' · ')].join('\n'),
    );
  // Alan değeri 1024 karakterle sınırlı: her kategori kendi alanında
  for (const kategori of plan.kategoriler) {
    embed.addFields({
      name: `${isaret(kategori)} ${kategori.ad}`,
      value: kategori.kanallar.map((k) => `${isaret(k)} ${k.ad}`).join('\n').slice(0, 1024) || '*Talep açıldıkça odalar burada oluşur*',
      inline: true,
    });
  }
  embed.addFields({
    name: 'Bilmen gerekenler',
    value: [
      `• **${plan.yeni} yeni öğe** oluşturulacak; yaklaşık ${plan.yeni > 40 ? '1-2 dakika' : 'yarım dakika'} sürer.`,
      '• Mevcut kanal ve rollerin hiçbiri silinmez ya da değiştirilmez.',
      sablon.onay
        ? '• Yeni gelenler **Yeni Gelen** rolüyle başlar; onay düğmesine basınca **Üye** olur ve topluluk kanalları açılır.'
        : '• Üyelik onayı yok: sunucuya katılan herkes kanalları hemen görür.',
      '• Günlük, hoş geldin ve bildirim kanalları botun ayarlarına kendiliğinden bağlanır.',
      plan.ayarlar.length ? `• Açılacak: **${plan.ayarlar.map((a) => a.ad).join(', ')}**. Sonradan /ayarlar ile kapatabilirsin.` : null,
      plan.atlanan.length
        ? `• Açılmayacak: ${plan.atlanan.map((a) => a.ad).join(', ')}. Bunlar mesaj metnini okumayı ister, ama botta Message Content Intent kapalı.`
        : null,
      eksikOnerilen.length ? `• ⚠️ Bende şu izinler yok: **${eksikOnerilen.join(', ')}**. Kurulum çalışır ama bu izinlere dayanan kurallar (özellikle ses kanalları) eksik kalır.` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return embed;
}

function sonucKarti(sonuc, sablon) {
  const embed = new EmbedBuilder()
    .setTitle(sonuc.hata ? '⚠️ Kurulum yarıda kaldı' : '✅ Kurulum tamamlandı')
    .setColor(sonuc.hata ? 0xfee75c : 0x57f287)
    .setDescription(
      [
        `${sablon.ad} şablonu: ${sonuc.olusturulan} öğe oluşturuldu.`,
        sonuc.hata ? `Hata: ${sonuc.hata}\nOluşturulanlar yerinde duruyor; şablonu yeniden kurarsan kaldığı yerden devam eder.` : null,
        ...sonuc.uyarilar.map((u) => `⚠️ ${u}`),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  if (sonuc.baglanan.length) embed.addFields({ name: 'Bota bağlananlar', value: sonuc.baglanan.join('\n').slice(0, 1024) });
  if (sonuc.acilan.length) embed.addFields({ name: 'Açılan özellikler', value: sonuc.acilan.map((a) => `• ${a}`).join('\n') });
  if (!sonuc.hata) {
    embed.addFields({
      name: 'Sıradaki adımlar',
      value: [
        '• **Voyager rolünü** rol listesinde yeni rollerin üstüne taşı; yoksa rol verme işleri çalışmaz.',
        '• Ekibine yetkili rollerini ver.',
        ...(sablon.sonraki ?? []).map((s) => `• ${s}`),
        '• Koruma ayarları ve saldırı anında acil kilit: `/ayarlar`.',
      ]
        .join('\n')
        .slice(0, 1024),
    });
  }
  return embed;
}

// --- Rol menüsü formu ---
const rolmenuFormu = () =>
  form(
    ID,
    'rolmenu-form',
    'Rol menüsü kur',
    metinAlani('baslik', 'Başlık', { enFazla: 100, yerTutucu: 'ör. Bildirim rolleri' }),
    metinAlani('aciklama', 'Açıklama', { zorunlu: false, uzun: true, enFazla: 1000, aciklama: 'Başlığın altına yazılır.' }),
    new LabelBuilder()
      .setLabel('Roller')
      .setDescription(`Menüde düğmesi olacak roller (en fazla ${rolmenu.ROL_SINIRI}).`)
      .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('roller').setMinValues(1).setMaxValues(rolmenu.ROL_SINIRI)),
    new LabelBuilder()
      .setLabel('Kanal')
      .setDescription('Boş bırakırsan bu kanala konur.')
      .setChannelSelectMenuComponent(
        new ChannelSelectMenuBuilder().setCustomId('kanal').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMaxValues(1).setRequired(false),
      ),
    new LabelBuilder()
      .setLabel('Üye kaç rol alabilsin?')
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId('tek')
          .setRequired(false)
          .addOptions(
            { label: 'İstediği kadar', value: 'hayir', default: true },
            { label: 'Yalnızca bir tane (yenisini seçince eskisi bırakılır)', value: 'evet' },
          ),
      ),
  );

async function rolmenuKur(interaction) {
  const { guild } = interaction;
  const kanal = formSecimi(interaction, 'kanal', 'kanal') ?? interaction.channel;
  let roller = [];
  try {
    roller = [...(interaction.fields.getSelectedRoles('roller')?.values() ?? [])];
  } catch {
    roller = [];
  }
  if (!roller.length) return ['❌ En az bir rol seç.'];
  for (const rol of roller) {
    const engel = rolVermeEngeli(interaction, rol, { kime: 'İsteyen herkese', amac: 'Rolü menüye ekleyebilmen' });
    if (engel) return [`❌ ${rol}: ${engel}`];
  }
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return ['❌ Rol verebilmem için bana Rolleri Yönet iznini ver.'];
  if (!kanal?.isTextBased?.() || !yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) {
    return [`❌ ${kanal ?? 'Bu kanal'} kanalına yazamıyorum. Bana Kanalı Gör, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`];
  }
  const mesaj = await kanal.send(
    rolmenu.mesajHazirla({ baslik: formMetni(interaction, 'baslik'), aciklama: formMetni(interaction, 'aciklama'), roller, tek: formSecimi(interaction, 'tek') === 'evet' }),
  );
  await logGonder(guild, {
    baslik: 'Rol menüsü kuruldu',
    renk: 0x5865f2,
    yetkili: interaction.user,
    ek: [
      { name: 'Kanal', value: `${kanal} · [mesaja git](${mesaj.url})` },
      { name: 'Roller', value: roller.map((r) => `${r}`).join(' ') },
    ],
  });
  return [`✅ Rol menüsü kuruldu: ${mesaj.url}`, 'Kaldırmak için mesajı silmen yeterli.'];
}

// --- Şablon kurulumu ---
async function kur(interaction, sablonAdi) {
  const { guild } = interaction;
  if (!SABLONLAR[sablonAdi]) return { satirlar: ['❌ Böyle bir şablon yok.'], durum: 'sablonlar' };
  // Aynı anda iki kurulum her şeyi çift oluşturur
  if (kurulan.has(guild.id)) return { satirlar: ['⏳ Bu sunucuda şu an başka bir kurulum sürüyor. Bitmesini bekle.'] };
  kurulan.add(guild.id);
  await interaction.editReply({ content: '⏳ Kuruluyor…', embeds: [], components: [] });
  // Onay beklenirken sunucu değişmiş olabilir; plan güncel haliyle yeniden çıkarılır
  const sonuc = await topluluk
    .kur(guild, topluluk.planla(guild, sablonAdi), interaction.user.tag, (metin) => interaction.editReply({ content: metin }))
    .finally(() => kurulan.delete(guild.id));
  return { satirlar: [], embeds: [sonucKarti(sonuc, SABLONLAR[sablonAdi])] };
}

module.exports = {
  id: ID,
  ad: 'Kurulum',
  simge: '🧰',
  aciklama: 'Hazır sunucu şablonu ve rol menüsü kur',
  ozet: () => 'Şablon ve rol menüsü',
  ekran(interaction, durum = '') {
    const { guild } = interaction;
    const geri = dugme(ID, 'geri', '‹ Geri');
    if (durum === 'sablonlar') {
      return {
        embeds: [sablonListesi()],
        components: [
          satir(
            new StringSelectMenuBuilder()
              .setCustomId(kimlik(ID, 'sablon-sec'))
              .setPlaceholder('Bir şablon seç')
              .addOptions(Object.entries(SABLONLAR).map(([value, s]) => ({ label: s.ad.replace(/^\S+\s/, ''), emoji: s.ad.split(' ')[0], value, description: s.aciklama.slice(0, 100) }))),
          ),
          satir(geri),
        ],
      };
    }
    if (durum.startsWith('onizleme:')) {
      const sablonAdi = durum.slice('onizleme:'.length);
      const plan = topluluk.planla(guild, sablonAdi);
      return {
        embeds: [onizleme(plan, eksikIzinler(guild, ONERILEN))],
        components: [satir(dugme(ID, `kur:${sablonAdi}`, `Kur (${plan.yeni} öğe)`, ButtonStyle.Success), dugme(ID, 'sablon', '‹ Başka şablon'))],
      };
    }
    return {
      embeds: [anaKart()],
      components: [satir(dugme(ID, 'sablon', '🛠️ Hazır sunucu şablonu', ButtonStyle.Primary), dugme(ID, 'rolmenu', '🎭 Rol menüsü kur', ButtonStyle.Primary))],
    };
  },
  // Rol menüsü formu yalnızca Rolleri Yönet yetkisi olana açılır; olmayana islem hata yazar
  form: (interaction, islem) => (islem === 'rolmenu' && interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ? rolmenuFormu() : null),
  ertele: (islem) => islem === 'kur' || islem === 'rolmenu-form',
  async islem(interaction, islem, ek) {
    if (islem === 'geri') return [];
    if (islem === 'rolmenu') return ['❌ Rol menüsü kurmak için Rolleri Yönet yetkin olmalı.'];
    if (islem === 'rolmenu-form') return rolmenuKur(interaction);
    // Şablon işlemleri Yönetici ister
    if (!yonetici(interaction)) return ['❌ Hazır sunucu şablonu kurmak için Yönetici yetkin olmalı.'];
    const eksik = eksikIzinler(interaction.guild, GEREKLI);
    if (eksik.length) {
      return [`❌ Kurulum için bana şu izinleri vermen gerekiyor: **${eksik.join(', ')}**. Sunucu Ayarları → Roller → Voyager bölümünden açıp yeniden dene.`];
    }
    if (islem === 'sablon') return { satirlar: [], durum: 'sablonlar' };
    if (islem === 'sablon-sec') {
      const sablonAdi = interaction.values[0];
      if (!topluluk.planla(interaction.guild, sablonAdi).yeni) {
        return { satirlar: ['✅ Bu şablondaki her şey sunucuda zaten var; oluşturulacak bir şey yok.'], durum: 'sablonlar' };
      }
      return { satirlar: [], durum: `onizleme:${sablonAdi}` };
    }
    if (islem === 'kur') return kur(interaction, ek);
    return [];
  },
  // Test için
  onizleme,
  sablonListesi,
  sonucKarti,
};
