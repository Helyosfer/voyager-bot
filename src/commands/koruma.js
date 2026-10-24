const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const koruma = require('../koruma');
const yapayzeka = require('../yapayzeka');
const baglanti = require('../baglanti');
const { sureMetni } = require('../yardimci');

const KELIME_SINIRI = 100;
const ALAN_SINIRI = 100; // Engel ve izin listelerinin her birinin en fazla uzunluğu

const DURUMLAR = [
  { name: 'Açık', value: 'acik' },
  { name: 'Kapalı', value: 'kapali' },
];

// /koruma filtre tur seçimleri
const TURLER = [
  { name: 'Spam (kısa sürede çok kanala yazma, tekrar)', value: 'spam' },
  { name: 'Küfür', value: 'kufur' },
  { name: 'Dolandırıcılık görseli (yapay zekâ)', value: 'gorsel' },
  { name: 'Zararlı ve sahte bağlantı', value: 'baglanti' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('koruma')
    .setDescription('Otomatik spam koruması, küfür filtresi, zararlı bağlantı ve dolandırıcılık görseli denetimi')
    .addSubcommand((s) =>
      s
        .setName('filtre')
        .setDescription('Bir koruma filtresini açar, kapatır ya da ayarlar (yalnızca türü seçersen ayarları gösterir)')
        .addStringOption((o) => o.setName('tur').setDescription('Hangi filtre?').setRequired(true).addChoices(...TURLER))
        .addStringOption((o) => o.setName('durum').setDescription('Açık mı kapalı mı?').addChoices(...DURUMLAR))
        .addIntegerOption((o) =>
          o
            .setName('susturma-dakika')
            .setDescription('Kaç dakika susturulsun? 0 = yalnızca sil (varsayılan: spam 60, küfür 0, görsel 1440, bağlantı 60)')
            .setMinValue(0)
            .setMaxValue(40320),
        )
        .addStringOption((o) =>
          o
            .setName('kapsam')
            .setDescription('Yalnızca görsel: hangi resimler denetlensin? (varsayılan: yalnızca riskli olanlar)')
            .addChoices({ name: 'Yalnızca riskli olanlar', value: 'riskli' }, { name: 'Bütün resimler', value: 'hepsi' }),
        )
        .addBooleanOption((o) => o.setName('kisaltici').setDescription('Yalnızca bağlantı: bit.ly gibi kısaltılmış bağlantılar da silinsin mi? (varsayılan: hayır)')),
    )
    .addSubcommand((s) =>
      s
        .setName('kelime')
        .setDescription('Küfür filtresine bu sunucuya özel bir kelime ekler ya da çıkarır')
        .addStringOption((o) => o.setName('kelime').setDescription('Kelime').setRequired(true).setMaxLength(40))
        .addStringOption((o) =>
          o.setName('islem').setDescription('Ne yapılsın? (varsayılan: ekle)').addChoices({ name: 'Ekle', value: 'ekle' }, { name: 'Çıkar', value: 'cikar' }),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('alan')
        .setDescription('Bağlantı denetimi için bir alanı engeller ya da izin listesine ekler (yanlış alarm için)')
        .addStringOption((o) => o.setName('alan').setDescription('Alan adı ya da bağlantı (ör. kotu.site)').setRequired(true).setMaxLength(200))
        .addStringOption((o) =>
          o
            .setName('islem')
            .setDescription('Ne yapılsın?')
            .setRequired(true)
            .addChoices({ name: 'Engelle', value: 'engel' }, { name: 'İzin ver', value: 'izin' }, { name: 'Listeden çıkar', value: 'cikar' }),
        ),
    )
    .addSubcommand((s) => s.setName('goster').setDescription('Koruma ayarlarını gösterir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const ben = interaction.guild.members.me;

    // /koruma filtre: tur seçilir; durum verilmezse filtrenin şimdiki durumu korunur, yalnızca verilen ayarlar değişir
    const tur = alt === 'filtre' ? interaction.options.getString('tur', true) : null;
    const durumSecimi = interaction.options.getString('durum');
    const acik = tur && (durumSecimi ? durumSecimi === 'acik' : koruma.ayarCoz(ayarlariGetir(sunucuId))[tur]);
    if (tur) {
      const secilen = ['durum', 'kapsam'].map((ad) => interaction.options.getString(ad)).concat(
        interaction.options.getInteger('susturma-dakika'),
        interaction.options.getBoolean('kisaltici'),
      );
      // Yalnızca tür seçildiyse bütün ayarlar gösterilir
      if (secilen.every((d) => d === null)) return interaction.reply({ embeds: [ayarKarti(sunucuId)], flags: MessageFlags.Ephemeral });
      if (interaction.options.getString('kapsam') && tur !== 'gorsel') return cevapla('❌ `kapsam` yalnızca görsel denetiminde geçerli.');
      if (interaction.options.getBoolean('kisaltici') !== null && tur !== 'baglanti') return cevapla('❌ `kisaltici` yalnızca bağlantı denetiminde geçerli.');
    }
    // Kapalı filtrenin yalnızca ayarı değiştiyse "kapatıldı" denmez
    const kapali = (ad) => (durumSecimi ? `✅ ${ad} kapatıldı.` : `✅ Ayar kaydedildi. ${ad} şu an kapalı; açmak için \`durum:Açık\` ekle.`);

    if (tur === 'spam') {
      const dakika = interaction.options.getInteger('susturma-dakika');
      ayarKaydet(sunucuId, 'korumaSpam', acik);
      if (dakika !== null) ayarKaydet(sunucuId, 'korumaSpamDakika', dakika);
      if (!acik) return cevapla(kapali('Spam koruması'));
      const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
      const eksik = [
        !ben.permissions.has(PermissionFlagsBits.ManageMessages) && 'Mesajları Yönet',
        ayar.spamDakika > 0 && !ben.permissions.has(PermissionFlagsBits.ModerateMembers) && 'Üyelere Zaman Aşımı Uygula',
      ].filter(Boolean);
      return cevapla(
        [
          `✅ Spam koruması açık. ${koruma.PENCERE / 1000} saniyede ${koruma.KANAL_ESIGI} farklı kanala yazan ya da aynı içeriği tekrarlayan üyenin mesajları silinir${ayar.spamDakika ? ` ve üye ${ayar.spamDakika} dakika susturulur` : ''}.`,
          'Mesajları Yönet yetkisi olanlar muaftır.',
          eksik.length ? `⚠️ Bunun çalışması için bana şu izinleri ver: ${eksik.join(', ')}.` : null,
          ayarlariGetir(sunucuId).logKanali ? null : 'ℹ️ Olanları görmek için `/ayarla gunluk kanal:` ile bir günlük kanalı seç.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (tur === 'kufur') {
      const dakika = interaction.options.getInteger('susturma-dakika');
      if (acik && !koruma.icerikOkunabilir(interaction.client)) {
        return cevapla('❌ Küfür filtresi mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı (README: Sunucu günlüğü bölümü).');
      }
      ayarKaydet(sunucuId, 'korumaKufur', acik);
      if (dakika !== null) ayarKaydet(sunucuId, 'korumaKufurDakika', dakika);
      if (!acik) return cevapla(kapali('Küfür filtresi'));
      const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
      return cevapla(
        [
          `✅ Küfür filtresi açık. Ağır küfür içeren mesajlar silinir${ayar.kufurDakika ? ` ve yazan ${ayar.kufurDakika} dakika susturulur` : ''}.`,
          'Yalnızca ağır küfürler yakalanır; "amk", "aq" gibi kısaltmalar listede yok. Eklemek istersen `/koruma kelime` kullan.',
          'Mesajları Yönet yetkisi olanlar muaftır.',
          ben.permissions.has(PermissionFlagsBits.ManageMessages) ? null : '⚠️ Bunun çalışması için bana Mesajları Yönet iznini ver.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (tur === 'gorsel') {
      const kapsam = interaction.options.getString('kapsam');
      const dakika = interaction.options.getInteger('susturma-dakika');
      if (acik && !yapayzeka.hazir()) return cevapla('❌ Görsel denetimi yapay zekâ ister, ama bu botta yapay zekâ kurulu değil (botun sahibi .env içinde GEMINI_API_KEY ve GEMINI_MODEL girmeli).');
      if (acik && !koruma.icerikOkunabilir(interaction.client)) {
        return cevapla('❌ Görsel denetimi mesajlardaki resimleri görebilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.');
      }
      ayarKaydet(sunucuId, 'korumaGorsel', acik);
      if (kapsam) ayarKaydet(sunucuId, 'korumaGorselKapsam', kapsam);
      if (dakika !== null) ayarKaydet(sunucuId, 'korumaGorselDakika', dakika);
      if (!acik) return cevapla(kapali('Görsel denetimi'));
      const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
      const eksik = [
        !ben.permissions.has(PermissionFlagsBits.ManageMessages) && 'Mesajları Yönet',
        ayar.gorselDakika > 0 && !ben.permissions.has(PermissionFlagsBits.ModerateMembers) && 'Üyelere Zaman Aşımı Uygula',
      ].filter(Boolean);
      return cevapla(
        [
          `✅ Görsel denetimi açık. Dolandırıcılık resmi yakalanınca mesaj silinir${ayar.gorselDakika ? `, atan ${ayar.gorselDakika} dakika susturulur` : ''} ve günlüğe kanıtıyla yazılır. Aynı resim yeniden atılırsa beklemeden silinir.`,
          ayar.gorselKapsam === 'hepsi'
            ? 'Kapsam: **bütün resimler**.'
            : 'Kapsam: **yalnızca riskli resimler** (yeni üyeler, bağlantılı ya da toplu etiketli mesajlar, tek mesajda birden fazla resim, aynı resmi birden fazla kanala atma).',
          'ℹ️ Denetlenen resimler Google\'ın yapay zekâsına gönderilir. Yapay zekâ yanılabilir; yanlış alarmda susturmayı elle kaldırabilirsin. Karar 30-60 saniye sürebilir.',
          'Mesajları Yönet yetkisi olanlar muaftır.',
          eksik.length ? `⚠️ Bunun çalışması için bana şu izinleri ver: ${eksik.join(', ')}.` : null,
          ayarlariGetir(sunucuId).logKanali ? null : 'ℹ️ Yakalananları görmek için `/ayarla gunluk kanal:` ile bir günlük kanalı seç.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (tur === 'baglanti') {
      const kisaltici = interaction.options.getBoolean('kisaltici');
      const dakika = interaction.options.getInteger('susturma-dakika');
      if (acik && !koruma.icerikOkunabilir(interaction.client)) {
        return cevapla('❌ Bağlantı denetimi mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.');
      }
      ayarKaydet(sunucuId, 'korumaBaglanti', acik);
      if (kisaltici !== null) ayarKaydet(sunucuId, 'korumaKisaltici', kisaltici);
      if (dakika !== null) ayarKaydet(sunucuId, 'korumaBaglantiDakika', dakika);
      if (!acik) return cevapla(kapali('Bağlantı denetimi'));
      const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
      const eksik = [
        !ben.permissions.has(PermissionFlagsBits.ManageMessages) && 'Mesajları Yönet',
        ayar.baglantiDakika > 0 && !ben.permissions.has(PermissionFlagsBits.ModerateMembers) && 'Üyelere Zaman Aşımı Uygula',
      ].filter(Boolean);
      return cevapla(
        [
          `✅ Bağlantı denetimi açık. Discord, Steam, Epic Games, Roblox ve Twitch'i taklit eden alanlar, görünen adresiyle gittiği adres farklı bağlantılar ve bedava Nitro alanları silinir${ayar.baglantiDakika ? `, atan ${sureMetni(ayar.baglantiDakika)} susturulur` : ''}.`,
          ayar.kisaltici ? 'Kısaltılmış bağlantılar (bit.ly vb.) da silinir.' : 'Kısaltılmış bağlantılar (bit.ly vb.) silinmez; istersen `kisaltici` seçeneğini aç.',
          'Bağlantılar açılmaz ve hiçbir yere gönderilmez; karar adresin kendisinden verilir. Yanlış alarmda alanı `/koruma alan islem:İzin ver` ile izin listesine ekle.',
          'Mesajları Yönet yetkisi olanlar muaftır.',
          eksik.length ? `⚠️ Bunun çalışması için bana şu izinleri ver: ${eksik.join(', ')}.` : null,
          ayarlariGetir(sunucuId).logKanali ? null : 'ℹ️ Yakalananları görmek için `/ayarla gunluk kanal:` ile bir günlük kanalı seç.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (alt === 'alan') {
      const alan = baglanti.alanBicimi(interaction.options.getString('alan', true));
      if (!alan) return cevapla('❌ Geçerli bir alan adı yaz (ör. `kotu.site`).');
      const islem = interaction.options.getString('islem', true);
      const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
      // Bir alan iki listede birden durmaz
      const engel = ayar.alanEngel.filter((a) => a !== alan);
      const izin = ayar.alanIzin.filter((a) => a !== alan);
      if (islem === 'engel') engel.push(alan);
      if (islem === 'izin') izin.push(alan);
      if (engel.length > ALAN_SINIRI || izin.length > ALAN_SINIRI) return cevapla(`❌ Her listede en fazla ${ALAN_SINIRI} alan olabilir.`);
      if (islem === 'cikar' && engel.length === ayar.alanEngel.length && izin.length === ayar.alanIzin.length) {
        return cevapla(`❌ \`${alan}\` listelerde yok.`);
      }
      ayarKaydet(sunucuId, 'korumaAlanEngel', engel);
      ayarKaydet(sunucuId, 'korumaAlanIzin', izin);
      return cevapla(
        {
          engel: `✅ \`${alan}\` ve alt alan adları engellendi.`,
          izin: `✅ \`${alan}\` ve alt alan adları izin listesinde; bağlantı denetimi bunlara dokunmaz.`,
          cikar: `✅ \`${alan}\` listeden çıkarıldı.`,
        }[islem] + (ayar.baglanti ? '' : ' Bağlantı denetimi şu an kapalı; `/koruma filtre tur:Zararlı ve sahte bağlantı durum:Açık` ile açabilirsin.'),
      );
    }

    if (alt === 'kelime') {
      const kelime = koruma.kelimeBicimi(interaction.options.getString('kelime', true));
      if (kelime.length < 2) return cevapla('❌ En az iki harfli tek bir kelime yaz.');
      const mevcut = koruma.ayarCoz(ayarlariGetir(sunucuId)).kelimeler;

      if (interaction.options.getString('islem') !== 'cikar') {
        if (mevcut.includes(kelime)) return cevapla(`❌ ||${kelime}|| zaten listede.`);
        if (mevcut.length >= KELIME_SINIRI) return cevapla(`❌ En fazla ${KELIME_SINIRI} özel kelime eklenebilir.`);
        ayarKaydet(sunucuId, 'korumaKelimeler', [...mevcut, kelime]);
        return cevapla(`✅ ||${kelime}|| eklendi. Yalnızca tam bu kelime yakalanır; ekli halleri için ayrıca ekle.`);
      }
      if (!mevcut.includes(kelime)) return cevapla('❌ Bu kelime özel listede yok. Hazır listedeki kelimeler çıkarılamaz.');
      ayarKaydet(sunucuId, 'korumaKelimeler', mevcut.filter((k) => k !== kelime));
      return cevapla(`✅ ||${kelime}|| çıkarıldı.`);
    }

    // goster alt komutu
    return interaction.reply({ embeds: [ayarKarti(sunucuId)], flags: MessageFlags.Ephemeral });
  },
};

// Bütün koruma ayarları
function ayarKarti(sunucuId) {
  const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
  const durum = (acik, dakika) => (acik ? `🟢 Açık\n${dakika ? `${dakika} dakika susturma` : 'Yalnızca silme'}` : '⚫ Kapalı');
  return new EmbedBuilder()
    .setTitle('🛡️ Otomatik koruma')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Spam koruması', value: durum(ayar.spam, ayar.spamDakika), inline: true },
      { name: 'Küfür filtresi', value: durum(ayar.kufur, ayar.kufurDakika), inline: true },
      {
        name: 'Görsel denetimi',
        value: ayar.gorsel ? `${durum(true, ayar.gorselDakika)}\n${ayar.gorselKapsam === 'hepsi' ? 'Bütün resimler' : 'Riskli resimler'}` : '⚫ Kapalı',
        inline: true,
      },
      {
        name: 'Bağlantı denetimi',
        value: ayar.baglanti ? `${durum(true, ayar.baglantiDakika)}${ayar.kisaltici ? '\nKısaltıcılar da' : ''}` : '⚫ Kapalı',
        inline: true,
      },
      {
        name: `Engellenen alanlar · ${ayar.alanEngel.length}`,
        value: ayar.alanEngel.length ? `\`${ayar.alanEngel.join(', ').slice(0, 1000)}\`` : 'Yok',
        inline: true,
      },
      {
        name: `İzin verilen alanlar · ${ayar.alanIzin.length}`,
        value: ayar.alanIzin.length ? `\`${ayar.alanIzin.join(', ').slice(0, 1000)}\`` : 'Yok',
        inline: true,
      },
      {
        name: `Özel kelimeler · ${ayar.kelimeler.length}`,
        value: ayar.kelimeler.length ? `||${ayar.kelimeler.join(', ').slice(0, 1000)}||` : 'Yok',
      },
    )
    .setFooter({ text: 'Mesajları Yönet yetkisi olanlar ve botlar muaftır.' });
}
