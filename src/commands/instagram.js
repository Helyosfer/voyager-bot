const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { duzAd } = require('../yardimci');
const instagram = require('../instagram');
const ortak = require('../bildirim-ayar');

const ANAHTARLAR = { kanal: 'instagramKanali', rol: 'instagramRol' };

const hesapSecenegi = (aciklama, zorunlu, oneri) => (o) =>
  o.setName('hesap').setDescription(aciklama).setRequired(zorunlu).setMaxLength(200).setAutocomplete(oneri);

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
        'Kendi rolü olan hesap (→ ile gösterilir) genel rol yerine onu etiketler.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .addFields({
      name: `Takip edilen hesaplar · ${hesaplar.length}/${instagram.SUNUCU_BASI_SINIR}`,
      value:
        hesaplar.map((h) => `[${duzAd(h.ad)}](https://www.instagram.com/${h.giris}/)${ortak.rolEtiketi(h.rol)}`).join(' · ').slice(0, 1000) ||
        'Henüz hesap eklenmemiş. `/instagram ekle` ile ekle.',
    })
    .setFooter({ text: `Hesaplar yaklaşık ${dakika} dakikada bir kontrol edilir · Değiştirmek için: /instagram ayar` });
}

// Tek bir hesabın rolü: /instagram ayar hesap:<hesap> rol:<rol> ya da kaldir:rol
function hesapRolu(interaction, girdi) {
  const rol = interaction.options.getRole('rol');
  const kaldir = interaction.options.getString('kaldir');
  if (interaction.options.getChannel('kanal') || kaldir === 'kanal' || interaction.options.getBoolean('test')) {
    return { hata: 'Hesap seçtiğinde yalnızca o hesabın rolü değiştirilebilir. Diğer ayarlar için `hesap` seçeneğini boş bırak.' };
  }
  if (rol && kaldir === 'rol') return { hata: 'Aynı anda hem rol seçip hem rolü kaldıramazsın.' };
  if (!rol && kaldir !== 'rol') return { hata: 'Hesaba ne yapılacağını seç: `rol` ile bir rol ver ya da `kaldir:Rol etiketlemesini kaldır` ile genel role döndür.' };
  const durum = rol ? ortak.rolDenetle(interaction, rol) : {};
  if (durum.engel) return { hata: durum.engel };
  const kayit = instagram.rolAyarla(interaction.guildId, girdi, rol?.id ?? null);
  if (!kayit) return { hata: 'Listede böyle bir hesap yok. Takip edilenleri `/instagram ayar` gösterir.' };
  const ad = `**${duzAd(kayit.ad)}** (@${kayit.giris})`;
  if (!rol) return { satirlar: [`✅ ${ad} artık genel Instagram rolünü kullanacak.`] };
  return { satirlar: [durum.uyari ? `⚠️ ${durum.uyari}` : `✅ ${ad} gönderilerinde ${rol} etiketlenecek.`] };
}

// Bildirim kanalına örnek bir bildirim gönderir; olanı anlatan satır döndürür
async function deneme(interaction) {
  const { instagramKanali } = ayarlariGetir(interaction.guildId);
  if (!instagramKanali) return '❌ Deneme bildirimi için önce bir kanal seç (`kanal` seçeneği).';
  const kanal = await interaction.guild.channels.fetch(instagramKanali).catch(() => null);
  if (!kanal?.isTextBased()) return '❌ Bildirim kanalı bulunamadı; `kanal` seçeneğiyle yeniden seç.';
  await kanal.send(
    instagram.bildirimMesaji(
      { giris: 'ornekhesap', ad: 'Örnek Hesap' },
      { metin: 'Bu bir deneme bildirimidir. Gerçek bildirimlerde gönderinin açıklaması ve görseli burada görünür.', url: 'https://www.instagram.com/', zaman: Date.now() },
    ),
  );
  return `✅ ${kanal} kanalına deneme bildirimi gönderildi (kimse etiketlenmedi).`;
}

module.exports = {
  // /ayarlar paneli de bu kartı gösterir
  kart,

  // Instagram bağlantısı kurulmamışsa komut Discord'a hiç yüklenmez
  etkin: () => instagram.hazir(),

  data: new SlashCommandBuilder()
    .setName('instagram')
    .setDescription('Instagram hesaplarının yeni gönderilerini bir kanala duyurur')
    .addSubcommand((s) =>
      s
        .setName('ayar')
        .setDescription('Ayarları ve takip listesini gösterir; seçenek verirsen yalnızca onları değiştirir')
        .addChannelOption(ortak.kanalSecenegi('Gönderi bildirimlerinin gönderileceği kanal'))
        .addRoleOption(ortak.rolSecenegi('Yeni gönderide etiketlenecek rol (hesap seçersen yalnızca onun rolü)'))
        .addStringOption(hesapSecenegi('Rolü değiştirilecek hesap (boş: bütün hesapların genel rolü)', false, true))
        .addStringOption(ortak.kaldirSecenegi)
        .addBooleanOption((o) => o.setName('test').setDescription('Bildirim kanalına örnek bir bildirim gönderilsin mi?')),
    )
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Takip edilecek bir Instagram hesabı ekler')
        .addStringOption(hesapSecenegi('Kullanıcı adı ya da profil adresi', true, false))
        .addRoleOption((o) => o.setName('rol').setDescription('Bu hesabın gönderilerinde etiketlenecek rol (boş: genel rol)')),
    )
    .addSubcommand((s) => s.setName('cikar').setDescription('Bir hesabı takipten çıkarır').addStringOption(hesapSecenegi('Çıkarılacak hesap', true, true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  // hesap seçeneğine yazarken takip edilenler önerilir (ayar ve cikar'da)
  async autocomplete(interaction) {
    const yazilan = interaction.options.getFocused().trim().toLowerCase();
    const oneriler = instagram
      .liste(interaction.guildId)
      .filter((h) => h.giris.includes(yazilan) || h.ad.toLowerCase().includes(yazilan))
      .slice(0, 25)
      .map((h) => ({ name: `${h.ad} (@${h.giris})`.slice(0, 100), value: h.giris }));
    await interaction.respond(oneriler);
  },

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (alt === 'ayar') {
      const girdi = interaction.options.getString('hesap');
      const { hata, satirlar } = girdi ? hesapRolu(interaction, girdi) : ortak.kanalVeRol(interaction, ANAHTARLAR, 'Instagram bildirimleri');
      if (hata) return cevapla(`❌ ${hata}`);
      if (interaction.options.getBoolean('test')) satirlar.push(await deneme(interaction));
      return ortak.ayarCevabi(interaction, satirlar, kart(sunucuId));
    }

    if (alt === 'ekle') {
      const rol = interaction.options.getRole('rol');
      const rolDurumu = rol ? ortak.rolDenetle(interaction, rol) : {};
      if (rolDurumu.engel) return cevapla(`❌ ${rolDurumu.engel}`);
      // Instagram'a sorulduğu için 3 saniyeyi aşabilir
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let sonuc;
      try {
        sonuc = await instagram.ekle(sunucuId, interaction.options.getString('hesap', true));
      } catch (hata) {
        console.error('/instagram ekle hatası:', hata.message);
        return interaction.editReply("❌ Eklenemedi: Instagram'a ulaşılamadı ya da botun Instagram bağlantısında sorun var. Biraz sonra yeniden dene; sürerse botun sahibine haber ver.");
      }
      if (sonuc.hata) return interaction.editReply(`❌ ${sonuc.hata}`);
      if (rol) instagram.rolAyarla(sunucuId, sonuc.hesap.giris, rol.id);
      return interaction.editReply({
        content: [
          `✅ **${duzAd(sonuc.hesap.ad)}** (@${sonuc.hesap.giris}) takibe alındı. Bundan sonraki gönderileri duyurulacak.`,
          rol && (rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `Bu hesabın gönderilerinde ${rol} etiketlenecek.`),
          ortak.kanalVarsay(interaction, ANAHTARLAR.kanal, 'instagram'),
        ]
          .filter(Boolean)
          .join('\n'),
        allowedMentions: { parse: [] },
      });
    }

    // cikar
    const silinen = instagram.cikar(sunucuId, interaction.options.getString('hesap', true));
    if (!silinen) return cevapla('❌ Listede böyle bir hesap yok. Takip edilenleri `/instagram ayar` gösterir.');
    return cevapla(`✅ **${duzAd(silinen.ad)}** (@${silinen.giris}) takipten çıkarıldı.`);
  },
};
