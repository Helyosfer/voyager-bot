const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { duzAd } = require('../yardimci');
const haber = require('../haber');
const ortak = require('../bildirim-ayar');

const eklenen = new Set(); // Şu an kaynak eklemekte olan sunucular
const ANAHTARLAR = { kanal: 'haberKanali', rol: 'haberRol' };

const kaynakSecenegi = (aciklama, zorunlu) => (o) =>
  o.setName('kaynak').setDescription(aciklama).setRequired(zorunlu).setMaxLength(300).setAutocomplete(true);

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
        'Kendi rolü olan kaynak (→ ile gösterilir) genel rol yerine onu etiketler. Böylece her konunun ayrı rolü olabilir: üyeler yalnızca ilgilendikleri haberlerde etiketlenir.',
      ].join('\n'),
    )
    .addFields({
      name: `Kaynaklar · ${kaynaklar.length}/${haber.SUNUCU_BASI_SINIR}`,
      value:
        kaynaklar
          .map((k, i) => `**${i + 1}.** [${duzAd(k.ad.slice(0, 40))}](${new URL(k.adres).origin})${ortak.rolEtiketi(k.rol)}`)
          .join('\n')
          .slice(0, 1000) || 'Henüz kaynak eklenmemiş. `/haber ekle` ile ekle.',
    })
    .setFooter({ text: `Kaynaklar ${haber.KONTROL_ARALIGI / 60_000} dakikada bir kontrol edilir · Değiştirmek için: /haber ayar` });
}

// Tek bir kaynağın rolü: /haber ayar kaynak:<kaynak> rol:<rol> ya da kaldir:rol
function kaynakRolu(interaction, kaynak) {
  const rol = interaction.options.getRole('rol');
  const kaldir = interaction.options.getString('kaldir');
  if (interaction.options.getChannel('kanal') || kaldir === 'kanal') return { hata: 'Kaynak seçtiğinde yalnızca o kaynağın rolü değiştirilebilir. Kanal için `kaynak` seçeneğini boş bırak.' };
  if (rol && kaldir === 'rol') return { hata: 'Aynı anda hem rol seçip hem rolü kaldıramazsın.' };
  if (!rol && kaldir !== 'rol') return { hata: 'Kaynağa ne yapılacağını seç: `rol` ile bir rol ver ya da `kaldir:Rol etiketlemesini kaldır` ile genel role döndür.' };
  const durum = rol ? ortak.rolDenetle(interaction, rol) : {};
  if (durum.engel) return { hata: durum.engel };
  const kayit = haber.rolAyarla(interaction.guildId, kaynak, rol?.id ?? null);
  if (!kayit) return { hata: 'Listede böyle bir kaynak yok. Kayıtlı kaynakları `/haber ayar` gösterir.' };
  const ad = `**${duzAd(kayit.ad)}**`;
  if (!rol) return { satirlar: [`✅ ${ad} artık genel haber rolünü kullanacak.`] };
  return { satirlar: [durum.uyari ? `⚠️ ${durum.uyari}` : `✅ ${ad} haberlerinde ${rol} etiketlenecek.`] };
}

module.exports = {
  // /ayarlar paneli de bu kartı gösterir
  kart,

  data: new SlashCommandBuilder()
    .setName('haber')
    .setDescription('Haber sitelerinin yeni haberlerini bir kanala duyurur (RSS)')
    .addSubcommand((s) =>
      s
        .setName('ayar')
        .setDescription('Ayarları ve kaynakları gösterir; seçenek verirsen yalnızca onları değiştirir')
        .addChannelOption(ortak.kanalSecenegi('Haberlerin gönderileceği kanal'))
        .addRoleOption(ortak.rolSecenegi('Yeni haberde etiketlenecek rol (kaynak seçersen yalnızca o kaynağın rolü)'))
        .addStringOption(kaynakSecenegi('Rolü değiştirilecek kaynak (boş: bütün kaynakların genel rolü)', false))
        .addStringOption(ortak.kaldirSecenegi),
    )
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Takip edilecek bir haber kaynağı ekler')
        .addStringOption((o) =>
          o.setName('adres').setDescription('Sitenin adresi ya da RSS adresi (ör. webtekno.com)').setRequired(true).setMaxLength(300),
        )
        .addRoleOption((o) => o.setName('rol').setDescription('Bu kaynağın haberlerinde etiketlenecek rol, ör. @Oyun Haberleri (boş: genel rol)')),
    )
    .addSubcommand((s) =>
      s.setName('cikar').setDescription('Bir haber kaynağını takipten çıkarır').addStringOption(kaynakSecenegi('Çıkarılacak kaynak: adı ya da listedeki sıra numarası', true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  // kaynak seçeneğine yazarken listedeki kaynaklar önerilir
  async autocomplete(interaction) {
    const yazilan = interaction.options.getFocused().trim().toLocaleLowerCase('tr');
    const oneriler = haber
      .liste(interaction.guildId)
      .map((k, i) => ({ name: `${i + 1}. ${k.ad}`.slice(0, 100), value: k.adres.length <= 100 ? k.adres : String(i + 1), ara: `${k.ad} ${k.adres}`.toLocaleLowerCase('tr') }))
      .filter((k) => k.ara.includes(yazilan))
      .slice(0, 25);
    await interaction.respond(oneriler.map(({ name, value }) => ({ name, value })));
  },

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (alt === 'ayar') {
      const kaynak = interaction.options.getString('kaynak');
      const { hata, satirlar } = kaynak ? kaynakRolu(interaction, kaynak) : ortak.kanalVeRol(interaction, ANAHTARLAR, 'Haber bildirimleri');
      if (hata) return cevapla(`❌ ${hata}`);
      return ortak.ayarCevabi(interaction, satirlar, kart(sunucuId));
    }

    if (alt === 'ekle') {
      // Rol, siteye bağlanmadan önce denetlenir: reddedilecek bir ekleme için site indirilmesin
      const rol = interaction.options.getRole('rol');
      const rolDurumu = rol ? ortak.rolDenetle(interaction, rol) : {};
      if (rolDurumu.engel) return cevapla(`❌ ${rolDurumu.engel}`);
      // Her ekleme birkaç sayfa indirir; aynı sunucudan üst üste gelen istekler sıraya alınmaz, reddedilir
      if (eklenen.has(sunucuId)) return cevapla('⏳ Bu sunucuda şu an başka bir kaynak ekleniyor. Bitmesini bekle.');
      eklenen.add(sunucuId);
      let sonuc;
      try {
        // Siteye bağlanıldığı için 3 saniyeyi aşabilir. Yanıtı ertelemek de başarısız olabilir (etkileşim zaman
        // aşımına uğradıysa); o durumda da sunucu, bot yeniden başlayana kadar kilitli kalmamalı.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        sonuc = await haber.ekle(sunucuId, interaction.options.getString('adres', true)).catch((hata) => {
          console.error('/haber ekle hatası:', hata.message);
          return null;
        });
      } finally {
        eklenen.delete(sunucuId);
      }
      if (!sonuc) return interaction.editReply('❌ Kaynak eklenirken bir hata oluştu.');
      if (sonuc.hata) return interaction.editReply(`❌ ${sonuc.hata}`);
      if (rol) haber.rolAyarla(sunucuId, sonuc.besleme.adres, rol.id);
      return interaction.editReply({
        content: [
          `✅ **${duzAd(sonuc.besleme.ad)}** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.`,
          rol && (rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `Bu kaynağın haberlerinde ${rol} etiketlenecek.`),
          ortak.kanalVarsay(interaction, ANAHTARLAR.kanal, 'haber'),
        ]
          .filter(Boolean)
          .join('\n'),
        allowedMentions: { parse: [] },
      });
    }

    // cikar
    const silinen = haber.cikar(sunucuId, interaction.options.getString('kaynak', true));
    if (!silinen) return cevapla('❌ Listede böyle bir kaynak yok. Kayıtlı kaynakları `/haber ayar` gösterir.');
    return cevapla(`✅ **${duzAd(silinen.ad)}** takipten çıkarıldı.`);
  },
};
