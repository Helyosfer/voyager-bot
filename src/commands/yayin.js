const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { duzAd } = require('../yardimci');
const yayin = require('../yayin');
const ortak = require('../bildirim-ayar');

const ANAHTARLAR = { kanal: 'yayinKanali', rol: 'yayinRol' };
const platformAdlari = Object.entries(yayin.PLATFORMLAR).map(([value, p]) => ({ name: p.ad, value }));

const platformSecenegi = (zorunlu) => (o) =>
  o
    .setName('platform')
    .setDescription(zorunlu ? 'Yayın platformu' : 'Yayın platformu (aynı ad birden fazla platformda varsa gerekir)')
    .setRequired(zorunlu)
    .addChoices(...platformAdlari);
const yayinciSecenegi = (aciklama, zorunlu) => (o) =>
  o.setName('yayinci').setDescription(aciklama).setRequired(zorunlu).setMaxLength(200).setAutocomplete(true);

const BULUNAMADI = {
  yok: 'Listede böyle bir yayıncı yok. Takip edilenleri `/yayin ayar` gösterir.',
  belirsiz: 'Bu ad birden fazla platformda var; `platform` seçeneğiyle hangisi olduğunu seç.',
};

// Mevcut ayarlar ve takip listesi
function kart(sunucuId) {
  const ayar = ayarlariGetir(sunucuId);
  const kayitlar = yayin.liste(sunucuId);
  const alanlar = Object.entries(yayin.PLATFORMLAR).map(([anahtar, p]) => {
    const yayincilar = kayitlar.filter((y) => y.platform === anahtar);
    // Bir alanın değeri en fazla 1024 karakter olabilir; sığmayanların yalnızca sayısı yazılır
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
        'Kendi rolü olan yayıncı (→ ile gösterilir) genel rol yerine onu etiketler.',
      ].join('\n'),
    )
    .addFields(alanlar)
    .setFooter({ text: `${kayitlar.length} yayıncı takip ediliyor · Değiştirmek için: /yayin ayar` });
}

// Tek bir yayıncının rolü: /yayin ayar yayinci:<ad> rol:<rol> ya da kaldir:rol
function yayinciRolu(interaction, girdi) {
  const rol = interaction.options.getRole('rol');
  const kaldir = interaction.options.getString('kaldir');
  if (interaction.options.getChannel('kanal') || kaldir === 'kanal' || interaction.options.getBoolean('test')) {
    return { hata: 'Yayıncı seçtiğinde yalnızca o yayıncının rolü değiştirilebilir. Diğer ayarlar için `yayinci` seçeneğini boş bırak.' };
  }
  if (rol && kaldir === 'rol') return { hata: 'Aynı anda hem rol seçip hem rolü kaldıramazsın.' };
  if (!rol && kaldir !== 'rol') return { hata: 'Yayıncıya ne yapılacağını seç: `rol` ile bir rol ver ya da `kaldir:Rol etiketlemesini kaldır` ile genel role döndür.' };
  const durum = rol ? ortak.rolDenetle(interaction, rol) : {};
  if (durum.engel) return { hata: durum.engel };
  const { kayit, hata } = yayin.rolAyarla(interaction.guildId, interaction.options.getString('platform'), girdi, rol?.id ?? null);
  if (hata) return { hata: BULUNAMADI[hata] };
  const ad = `**${duzAd(kayit.ad)}** (${yayin.PLATFORMLAR[kayit.platform].ad})`;
  if (!rol) return { satirlar: [`✅ ${ad} artık genel yayın rolünü kullanacak.`] };
  return { satirlar: [durum.uyari ? `⚠️ ${durum.uyari}` : `✅ ${ad} yayına geçince ${rol} etiketlenecek.`] };
}

// Bildirim kanalına örnek bir bildirim gönderir; olanı anlatan satır döndürür
async function deneme(interaction) {
  const { yayinKanali } = ayarlariGetir(interaction.guildId);
  if (!yayinKanali) return '❌ Deneme bildirimi için önce bir kanal seç (`kanal` seçeneği).';
  const kanal = await interaction.guild.channels.fetch(yayinKanali).catch(() => null);
  if (!kanal?.isTextBased()) return '❌ Bildirim kanalı bulunamadı; `kanal` seçeneğiyle yeniden seç.';
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

module.exports = {
  // /ayarlar paneli de bu kartı gösterir
  kart,

  data: new SlashCommandBuilder()
    .setName('yayin')
    .setDescription('Canlı yayın bildirimlerini ayarlar (Twitch, Kick, YouTube)')
    .addSubcommand((s) =>
      s
        .setName('ayar')
        .setDescription('Ayarları ve takip listesini gösterir; seçenek verirsen yalnızca onları değiştirir')
        .addChannelOption(ortak.kanalSecenegi('Yayın bildirimlerinin gönderileceği kanal'))
        .addRoleOption(ortak.rolSecenegi('Yayın başlayınca etiketlenecek rol (yayıncı seçersen yalnızca onun rolü)'))
        .addStringOption(yayinciSecenegi('Rolü değiştirilecek yayıncı (boş: bütün yayıncıların genel rolü)', false))
        .addStringOption(platformSecenegi(false))
        .addStringOption(ortak.kaldirSecenegi)
        .addBooleanOption((o) => o.setName('test').setDescription('Bildirim kanalına örnek bir bildirim gönderilsin mi?')),
    )
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Takip edilecek bir yayıncı ekler')
        .addStringOption(platformSecenegi(true))
        .addStringOption((o) => o.setName('yayinci').setDescription('Kanal adı ya da kanal adresi').setRequired(true).setMaxLength(200))
        .addRoleOption((o) => o.setName('rol').setDescription('Bu yayıncı yayına geçince etiketlenecek rol (boş: genel rol)')),
    )
    .addSubcommand((s) =>
      s
        .setName('cikar')
        .setDescription('Bir yayıncıyı takipten çıkarır')
        .addStringOption(yayinciSecenegi('Çıkarılacak yayıncı: kanal adı ya da adresi', true))
        .addStringOption(platformSecenegi(false)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  // yayinci seçeneğine yazarken takip edilenler önerilir (yalnızca ayar ve cikar'da; ekle'de öneri yok)
  async autocomplete(interaction) {
    const yazilan = interaction.options.getFocused().trim().toLowerCase();
    const oneriler = yayin
      .liste(interaction.guildId)
      .filter((y) => [y.ad, y.giris].some((d) => d.toLowerCase().includes(yazilan)))
      .slice(0, 25)
      .map((y) => ({ name: `${yayin.PLATFORMLAR[y.platform].simge} ${y.ad} · ${yayin.PLATFORMLAR[y.platform].ad}`.slice(0, 100), value: `${y.platform}:${y.id}`.slice(0, 100) }));
    await interaction.respond(oneriler);
  },

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (alt === 'ayar') {
      const girdi = interaction.options.getString('yayinci');
      const { hata, satirlar } = girdi ? yayinciRolu(interaction, girdi) : ortak.kanalVeRol(interaction, ANAHTARLAR, 'Yayın bildirimleri');
      if (hata) return cevapla(`❌ ${hata}`);
      if (interaction.options.getBoolean('test')) satirlar.push(await deneme(interaction));
      return ortak.ayarCevabi(interaction, satirlar, kart(sunucuId));
    }

    if (alt === 'ekle') {
      const platform = interaction.options.getString('platform', true);
      const girdi = interaction.options.getString('yayinci', true);
      const rol = interaction.options.getRole('rol');
      const rolDurumu = rol ? ortak.rolDenetle(interaction, rol) : {};
      if (rolDurumu.engel) return cevapla(`❌ ${rolDurumu.engel}`);
      // Platforma sorulduğu için 3 saniyeyi aşabilir
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let sonuc;
      try {
        sonuc = await yayin.ekle(sunucuId, platform, girdi);
      } catch (hata) {
        console.error('/yayin ekle hatası:', hata.message);
        return interaction.editReply('❌ Eklenemedi: platforma ulaşılamadı ya da botun bu platformla bağlantısında sorun var. Biraz sonra yeniden dene; sürerse botun sahibine haber ver.');
      }
      if (sonuc.hata) return interaction.editReply(`❌ ${sonuc.hata}`);
      if (rol) yayin.rolAyarla(sunucuId, platform, `${platform}:${sonuc.yayinci.id}`, rol.id);
      return interaction.editReply({
        content: [
          `✅ **${duzAd(sonuc.yayinci.ad)}** (${yayin.PLATFORMLAR[platform].ad}) takibe alındı.`,
          rol && (rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `Yayına geçince ${rol} etiketlenecek.`),
          ortak.kanalVarsay(interaction, ANAHTARLAR.kanal, 'yayin'),
        ]
          .filter(Boolean)
          .join('\n'),
        allowedMentions: { parse: [] },
      });
    }

    // cikar
    const { silinen, hata } = yayin.cikar(sunucuId, interaction.options.getString('platform'), interaction.options.getString('yayinci', true));
    if (hata) return cevapla(`❌ ${BULUNAMADI[hata]}`);
    // Başka sunucu da takip etmiyorsa platformdaki abonelik de kaldırılır
    yayin.esitle(silinen.platform).catch((hata) => console.error('Abonelik kaldırılamadı:', hata.message));
    return cevapla(`✅ **${duzAd(silinen.ad)}** (${yayin.PLATFORMLAR[silinen.platform].ad}) takipten çıkarıldı.`);
  },
};
