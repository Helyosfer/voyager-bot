const {
  EmbedBuilder, ModalBuilder, LabelBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder,
} = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { duzAd } = require('../yardimci');
const yayin = require('../yayin');
const ortak = require('../bildirim-ayar');

const ANAHTARLAR = { kanal: 'yayinKanali', rol: 'yayinRol' };

// Mevcut ayarlar ve takip listesi
function kart(sunucuId) {
  const ayar = ayarlariGetir(sunucuId);
  const kayitlar = yayin.liste(sunucuId);
  const alanlar = Object.entries(yayin.PLATFORMLAR).map(([anahtar, p]) => {
    const yayincilar = kayitlar.filter((y) => y.platform === anahtar);
    // Alan değeri 1024 karakterle sınırlı; sığmayanlar sayıyla belirtilir
    const sigan = [];
    let uzunluk = 0;
    for (const y of yayincilar) {
      const baglanti = `[${duzAd(y.ad)}](${p.kanalAdresi(y)})${ortak.rolEtiketi(y.rol)}`;
      if (uzunluk + baglanti.length > 900) break;
      sigan.push(baglanti);
      uzunluk += baglanti.length + 3;
    }
    const kalan = yayincilar.length - sigan.length;
    const satirlar = [];
    if (!p.hazir()) satirlar.push('⚠️ Bağlantı kurulmamış');
    if (sigan.length) satirlar.push(sigan.join(' · ') + (kalan ? ` · +${kalan} daha` : ''));
    else if (p.hazir()) satirlar.push('Henüz yayıncı eklenmemiş');
    return { name: `${p.simge} ${p.ad} · ${yayincilar.length}`, value: satirlar.join('\n') };
  });
  return new EmbedBuilder()
    .setTitle('📡 Yayın bildirimleri')
    .setColor(0x5865f2)
    .setDescription(
      [
        `**Kanal:** ${ayar.yayinKanali ? `<#${ayar.yayinKanali}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
        `**Etiketlenecek rol:** ${ayar.yayinRol ? `<@&${ayar.yayinRol}>` : 'yok'}`,
        'Kendi rolü olan yayıncı (→ ile gösterilir) genel rol yerine onu etiketler. Yayıncıya özel rol: **Ekle** formunda rol seç (listedeyse yalnızca rolü değişir).',
      ].join('\n'),
    )
    .addFields(alanlar)
    .setFooter({ text: `${kayitlar.length} yayıncı takip ediliyor · Her şeyi aşağıdan değiştirebilirsin` });
}

// Bildirim kanalına örnek bir bildirim gönderir; olanı anlatan satır döndürür
async function deneme(interaction) {
  const { yayinKanali } = ayarlariGetir(interaction.guildId);
  if (!yayinKanali) return '❌ Deneme bildirimi için önce yukarıdan bir kanal seç.';
  const kanal = await interaction.guild.channels.fetch(yayinKanali).catch(() => null);
  if (!kanal?.isTextBased()) return '❌ Bildirim kanalı bulunamadı; yukarıdan yeniden seç.';
  await kanal.send(
    yayin.bildirimMesaji('twitch', {
      ad: 'Örnek Yayıncı',
      baslik: 'Bu bir deneme bildirimidir',
      oyun: 'Just Chatting',
      url: 'https://www.twitch.tv',
      basladi: Date.now(),
    }),
  );
  return `✅ ${kanal} kanalına deneme bildirimi gönderildi (kimse etiketlenmedi).`;
}

// Ekleme formu: platform, kanal adı ya da adresi, isteğe bağlı özel rol
function form() {
  return new ModalBuilder()
    .setCustomId('ay:yayin:ekle-form')
    .setTitle('Yayıncı ekle')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Platform')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('platform')
            .addOptions(Object.entries(yayin.PLATFORMLAR).map(([value, p]) => ({ value, label: p.ad, emoji: p.simge }))),
        ),
      new LabelBuilder()
        .setLabel('Kanal adı ya da adresi')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('yayinci').setStyle(TextInputStyle.Short).setMaxLength(200).setPlaceholder('ör. pqueen ya da https://kick.com/kanal'),
        ),
      new LabelBuilder()
        .setLabel('Özel rol (isteğe bağlı)')
        .setDescription('Boş bırakırsan genel rol etiketlenir. Yayıncı zaten listedeyse yalnızca rolü değişir.')
        .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('rol').setMaxValues(1).setRequired(false)),
    );
}

async function ekle(interaction) {
  const sunucuId = interaction.guildId;
  const platform = interaction.fields.getStringSelectValues('platform')[0];
  const girdi = interaction.fields.getTextInputValue('yayinci').trim();
  const rol = ortak.formRolu(interaction);
  const rolDurumu = rol ? ortak.rolDenetle(interaction, rol) : {};
  if (rolDurumu.engel) return [`❌ ${rolDurumu.engel}`];
  let sonuc;
  try {
    sonuc = await yayin.ekle(sunucuId, platform, girdi);
  } catch (hata) {
    console.error('Yayıncı eklenemedi:', hata.message);
    return ['❌ Eklenemedi: platforma ulaşılamadı ya da botun bu platformla bağlantısında sorun var. Biraz sonra yeniden dene; sürerse botun sahibine haber ver.'];
  }
  // Zaten listedeyse yalnızca rolü güncellenir
  if (sonuc.zaten && rol) {
    yayin.rolAyarla(sunucuId, platform, `${platform}:${sonuc.zaten.id}`, rol.id);
    const ad = `**${duzAd(sonuc.zaten.ad)}** (${yayin.PLATFORMLAR[platform].ad})`;
    return [rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `✅ ${ad} zaten listedeydi; yayına geçince ${rol} etiketlenecek.`];
  }
  if (sonuc.zaten) return [`❌ ${sonuc.hata} Rolünü değiştirmek için formda bir rol seç.`];
  if (sonuc.hata) return [`❌ ${sonuc.hata}`];
  if (rol) yayin.rolAyarla(sunucuId, platform, `${platform}:${sonuc.yayinci.id}`, rol.id);
  return [
    `✅ **${duzAd(sonuc.yayinci.ad)}** (${yayin.PLATFORMLAR[platform].ad}) takibe alındı.`,
    rol && (rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `Yayına geçince ${rol} etiketlenecek.`),
    ortak.kanalVarsay(interaction, ANAHTARLAR.kanal),
  ].filter(Boolean);
}

function cikar(interaction, deger) {
  const { silinen, hata } = yayin.cikar(interaction.guildId, null, deger);
  if (hata) return ['❌ Bu yayıncı listede yok; başka biri çıkarmış olabilir.'];
  // Başka sunucu da takip etmiyorsa platformdaki abonelik de kaldırılır
  yayin.esitle(silinen.platform).catch((h) => console.error('Abonelik kaldırılamadı:', h.message));
  return [`✅ **${duzAd(silinen.ad)}** (${yayin.PLATFORMLAR[silinen.platform].ad}) takipten çıkarıldı.`];
}

const panel = {
  komut: 'yayin',
  ad: 'Yayın bildirimleri',
  simge: '📡',
  aciklama: 'Twitch, Kick ve YouTube yayınları başlayınca haber verir',
  anahtarlar: ANAHTARLAR,
  kart,
  altDugmeler: (sunucuId) => (ayarlariGetir(sunucuId).yayinKanali ? [ortak.dugme(panel, 'deneme', 'Deneme bildirimi')] : []),
  islem: async (interaction, islem) => (islem === 'deneme' ? [await deneme(interaction)] : []),
  liste: {
    ogeler: (sunucuId) =>
      yayin.liste(sunucuId).map((y) => {
        const p = yayin.PLATFORMLAR[y.platform];
        return { value: `${y.platform}:${y.id}`, label: `${p.simge} ${y.ad} · ${p.ad}` };
      }),
    cikar,
    form,
    ekle,
  },
};

module.exports = { ...ortak.bolum(panel), panel };
