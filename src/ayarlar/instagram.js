const { EmbedBuilder, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { duzAd } = require('../yardimci');
const instagram = require('../instagram');
const ortak = require('../bildirim-ayar');

const ANAHTARLAR = { kanal: 'instagramKanali', rol: 'instagramRol' };

// Mevcut ayarlar ve hesap listesi
function kart(sunucuId) {
  const ayar = ayarlariGetir(sunucuId);
  const hesaplar = instagram.liste(sunucuId);
  const dakika = Math.round(instagram.kontrolAraligi() / 60_000);
  return new EmbedBuilder()
    .setTitle('📸 Instagram bildirimleri')
    .setColor(0xe1306c)
    .setDescription(
      [
        instagram.hazir() ? null : '⚠️ Instagram bağlantısı kurulmamış; bildirimler çalışmıyor.',
        `**Kanal:** ${ayar.instagramKanali ? `<#${ayar.instagramKanali}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
        `**Etiketlenecek rol:** ${ayar.instagramRol ? `<@&${ayar.instagramRol}>` : 'yok'}`,
        'Kendi rolü olan hesap (→ ile gösterilir) genel rol yerine onu etiketler. Hesaba özel rol: **Ekle** formunda rol seç (listedeyse yalnızca rolü değişir).',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .addFields({
      name: `Takip edilen hesaplar · ${hesaplar.length}/${instagram.SUNUCU_BASI_SINIR}`,
      value:
        hesaplar.map((h) => `[${duzAd(h.ad)}](https://www.instagram.com/${h.giris}/)${ortak.rolEtiketi(h.rol)}`).join(' · ').slice(0, 1000) ||
        'Henüz hesap eklenmemiş. **Ekle** düğmesiyle ekle.',
    })
    .setFooter({ text: `Hesaplar yaklaşık ${dakika} dakikada bir kontrol edilir · Her şeyi aşağıdan değiştirebilirsin` });
}

// Bildirim kanalına örnek bir bildirim gönderir; olanı anlatan satır döndürür
async function deneme(interaction) {
  const { instagramKanali } = ayarlariGetir(interaction.guildId);
  if (!instagramKanali) return '❌ Deneme bildirimi için önce yukarıdan bir kanal seç.';
  const kanal = await interaction.guild.channels.fetch(instagramKanali).catch(() => null);
  if (!kanal?.isTextBased()) return '❌ Bildirim kanalı bulunamadı; yukarıdan yeniden seç.';
  await kanal.send(
    instagram.bildirimMesaji(
      { giris: 'ornekhesap', ad: 'Örnek Hesap' },
      { metin: 'Bu bir deneme bildirimidir. Gerçek bildirimlerde gönderinin açıklaması ve görseli burada görünür.', url: 'https://www.instagram.com/', zaman: Date.now() },
    ),
  );
  return `✅ ${kanal} kanalına deneme bildirimi gönderildi (kimse etiketlenmedi).`;
}

// Ekleme formu: kullanıcı adı, isteğe bağlı özel rol
function form() {
  return new ModalBuilder()
    .setCustomId('ay:instagram:ekle-form')
    .setTitle('Instagram hesabı ekle')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kullanıcı adı ya da profil adresi')
        .setDescription('Yalnızca herkese açık profesyonel (işletme ya da içerik üreticisi) hesaplar.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('hesap').setStyle(TextInputStyle.Short).setMaxLength(200).setPlaceholder('ör. nasa')),
      new LabelBuilder()
        .setLabel('Özel rol (isteğe bağlı)')
        .setDescription('Boş bırakırsan genel rol etiketlenir. Hesap zaten listedeyse yalnızca rolü değişir.')
        .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('rol').setMaxValues(1).setRequired(false)),
    );
}

async function ekle(interaction) {
  const sunucuId = interaction.guildId;
  const rol = ortak.formRolu(interaction);
  const rolDurumu = rol ? ortak.rolDenetle(interaction, rol) : {};
  if (rolDurumu.engel) return [`❌ ${rolDurumu.engel}`];
  let sonuc;
  try {
    sonuc = await instagram.ekle(sunucuId, interaction.fields.getTextInputValue('hesap'));
  } catch (hata) {
    console.error('Instagram hesabı eklenemedi:', hata.message);
    return ["❌ Eklenemedi: Instagram'a ulaşılamadı ya da botun Instagram bağlantısında sorun var. Biraz sonra yeniden dene; sürerse botun sahibine haber ver."];
  }
  // Zaten listedeyse yalnızca rolü güncellenir
  if (sonuc.zaten && rol) {
    const kayit = instagram.rolAyarla(sunucuId, sonuc.zaten, rol.id);
    return [rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `✅ **${duzAd(kayit.ad)}** (@${kayit.giris}) zaten listedeydi; gönderilerinde ${rol} etiketlenecek.`];
  }
  if (sonuc.zaten) return [`❌ ${sonuc.hata} Rolünü değiştirmek için formda bir rol seç.`];
  if (sonuc.hata) return [`❌ ${sonuc.hata}`];
  if (rol) instagram.rolAyarla(sunucuId, sonuc.hesap.giris, rol.id);
  return [
    `✅ **${duzAd(sonuc.hesap.ad)}** (@${sonuc.hesap.giris}) takibe alındı. Bundan sonraki gönderileri duyurulacak.`,
    rol && (rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `Bu hesabın gönderilerinde ${rol} etiketlenecek.`),
    ortak.kanalVarsay(interaction, ANAHTARLAR.kanal),
  ].filter(Boolean);
}

function cikar(interaction, giris) {
  const silinen = instagram.cikar(interaction.guildId, giris);
  if (!silinen) return ['❌ Bu hesap listede yok; başka biri çıkarmış olabilir.'];
  return [`✅ **${duzAd(silinen.ad)}** (@${silinen.giris}) takipten çıkarıldı.`];
}

const panel = {
  komut: 'instagram',
  ad: 'Instagram bildirimleri',
  simge: '📸',
  aciklama: 'Instagram hesaplarının yeni gönderilerini duyurur',
  // Instagram bağlantısı kurulmamışsa bölüm menüde görünmez
  gorunur: () => instagram.hazir(),
  anahtarlar: ANAHTARLAR,
  kart,
  altDugmeler: (sunucuId) => (ayarlariGetir(sunucuId).instagramKanali ? [ortak.dugme(panel, 'deneme', 'Deneme bildirimi')] : []),
  islem: async (interaction, islem) => (islem === 'deneme' ? [await deneme(interaction)] : []),
  liste: {
    ogeler: (sunucuId) => instagram.liste(sunucuId).map((h) => ({ value: h.giris, label: `${h.ad} (@${h.giris})` })),
    cikar,
    form,
    ekle,
  },
};

module.exports = { ...ortak.bolum(panel), panel };
