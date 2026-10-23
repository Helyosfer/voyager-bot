const { EmbedBuilder, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { duzAd } = require('../yardimci');
const haber = require('../haber');
const ortak = require('../bildirim-ayar');

const eklenen = new Set(); // Şu an kaynak eklemekte olan sunucular
const ANAHTARLAR = { kanal: 'haberKanali', rol: 'haberRol' };

// Mevcut ayarlar ve kaynak listesi
function kart(sunucuId) {
  const ayar = ayarlariGetir(sunucuId);
  const kaynaklar = haber.liste(sunucuId);
  return new EmbedBuilder()
    .setTitle('📰 Haber bildirimleri')
    .setColor(0x3b82f6)
    .setDescription(
      [
        `**Kanal:** ${ayar.haberKanali ? `<#${ayar.haberKanali}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
        `**Etiketlenecek rol:** ${ayar.haberRol ? `<@&${ayar.haberRol}>` : 'yok'}`,
        'Kendi rolü olan kaynak (→ ile gösterilir) genel rol yerine onu etiketler. Böylece her konunun ayrı rolü olabilir: üyeler yalnızca ilgilendikleri haberlerde etiketlenir. Kaynağa özel rol: **Ekle** formunda rol seç (listedeyse yalnızca rolü değişir).',
      ].join('\n'),
    )
    .addFields({
      name: `Kaynaklar · ${kaynaklar.length}/${haber.SUNUCU_BASI_SINIR}`,
      value:
        kaynaklar
          .map((k, i) => `**${i + 1}.** [${duzAd(k.ad.slice(0, 40))}](${new URL(k.adres).origin})${ortak.rolEtiketi(k.rol)}`)
          .join('\n')
          .slice(0, 1000) || 'Henüz kaynak eklenmemiş. **Ekle** düğmesiyle ekle.',
    })
    .setFooter({ text: `Kaynaklar ${haber.KONTROL_ARALIGI / 60_000} dakikada bir kontrol edilir · Her şeyi aşağıdan değiştirebilirsin` });
}

// Ekleme formu: site adresi, isteğe bağlı özel rol
function form() {
  return new ModalBuilder()
    .setCustomId('ay:haber:ekle-form')
    .setTitle('Haber kaynağı ekle')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Sitenin adresi ya da RSS adresi')
        .setDescription('Bot sitenin haber beslemesini kendisi bulur.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('adres').setStyle(TextInputStyle.Short).setMaxLength(300).setPlaceholder('ör. webtekno.com')),
      new LabelBuilder()
        .setLabel('Konu rolü (isteğe bağlı)')
        .setDescription('Bu kaynağın haberlerinde etiketlenir (ör. @Oyun Haberleri). Kaynak listedeyse yalnızca rolü değişir.')
        .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('rol').setMaxValues(1).setRequired(false)),
    );
}

async function ekle(interaction) {
  const sunucuId = interaction.guildId;
  // Rol, siteye bağlanmadan önce denetlenir: reddedilecek bir ekleme için site indirilmesin
  const rol = ortak.formRolu(interaction);
  const rolDurumu = rol ? ortak.rolDenetle(interaction, rol) : {};
  if (rolDurumu.engel) return [`❌ ${rolDurumu.engel}`];
  // Her ekleme birkaç sayfa indirir; aynı sunucudan üst üste gelenler sıraya girmez, reddedilir
  if (eklenen.has(sunucuId)) return ['⏳ Bu sunucuda şu an başka bir kaynak ekleniyor. Bitmesini bekle.'];
  eklenen.add(sunucuId);
  let sonuc;
  try {
    sonuc = await haber.ekle(sunucuId, interaction.fields.getTextInputValue('adres')).catch((hata) => {
      console.error('Haber kaynağı eklenemedi:', hata.message);
      return null;
    });
  } finally {
    eklenen.delete(sunucuId);
  }
  if (!sonuc) return ['❌ Kaynak eklenirken bir hata oluştu.'];
  // Zaten listedeyse yalnızca rolü güncellenir
  if (sonuc.zaten && rol) {
    const kayit = haber.rolAyarla(sunucuId, sonuc.zaten, rol.id);
    return [rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `✅ **${duzAd(kayit.ad)}** zaten listedeydi; haberlerinde ${rol} etiketlenecek.`];
  }
  if (sonuc.zaten) return [`❌ ${sonuc.hata} Rolünü değiştirmek için formda bir rol seç.`];
  if (sonuc.hata) return [`❌ ${sonuc.hata}`];
  if (rol) haber.rolAyarla(sunucuId, sonuc.besleme.adres, rol.id);
  return [
    `✅ **${duzAd(sonuc.besleme.ad)}** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.`,
    rol && (rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `Bu kaynağın haberlerinde ${rol} etiketlenecek.`),
    ortak.kanalVarsay(interaction, ANAHTARLAR.kanal),
  ].filter(Boolean);
}

function cikar(interaction, adres) {
  const silinen = haber.cikar(interaction.guildId, adres);
  if (!silinen) return ['❌ Bu kaynak listede yok; başka biri çıkarmış olabilir.'];
  return [`✅ **${duzAd(silinen.ad)}** takipten çıkarıldı.`];
}

const panel = {
  komut: 'haber',
  ad: 'Haber bildirimleri',
  simge: '📰',
  aciklama: 'Haber sitelerinin yeni haberlerini duyurur (RSS)',
  anahtarlar: ANAHTARLAR,
  kart,
  liste: {
    // Değer kaynağın tam adresi; 100 karakteri aşan adreste sıra numarası (cikar ikisini de bulur)
    ogeler: (sunucuId) => haber.liste(sunucuId).map((k, i) => ({ value: k.adres.length <= 100 ? k.adres : String(i + 1), label: `${i + 1}. ${k.ad}` })),
    cikar,
    form,
    ekle,
  },
};

module.exports = { ...ortak.bolum(panel), panel };
