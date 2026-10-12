const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const koruma = require('../koruma');

const KELIME_SINIRI = 100;

const durumSecenegi = (o) =>
  o
    .setName('durum')
    .setDescription('Açık mı kapalı mı?')
    .setRequired(true)
    .addChoices({ name: 'Açık', value: 'acik' }, { name: 'Kapalı', value: 'kapali' });

const susturmaSecenegi = (aciklama) => (o) =>
  o.setName('susturma-dakika').setDescription(aciklama).setMinValue(0).setMaxValue(40320);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('koruma')
    .setDescription('Otomatik spam koruması ve ağır küfür filtresi')
    .addSubcommand((s) =>
      s
        .setName('spam')
        .setDescription('Kısa sürede çok kanala yazan ya da aynı şeyi tekrarlayan hesapları durdurur')
        .addStringOption(durumSecenegi)
        .addIntegerOption(susturmaSecenegi('Spam yapan kaç dakika susturulsun? 0 = yalnızca mesajları sil (varsayılan 60)')),
    )
    .addSubcommand((s) =>
      s
        .setName('kufur')
        .setDescription('Ağır küfür içeren mesajları siler')
        .addStringOption(durumSecenegi)
        .addIntegerOption(susturmaSecenegi('Küfür eden kaç dakika susturulsun? 0 = yalnızca mesajı sil (varsayılan 0)')),
    )
    .addSubcommand((s) =>
      s
        .setName('kelime-ekle')
        .setDescription('Küfür filtresine bu sunucuya özel bir kelime ekler')
        .addStringOption((o) => o.setName('kelime').setDescription('Yasaklanacak kelime').setRequired(true).setMaxLength(40)),
    )
    .addSubcommand((s) =>
      s
        .setName('kelime-cikar')
        .setDescription('Bu sunucuya özel eklenmiş bir kelimeyi çıkarır')
        .addStringOption((o) => o.setName('kelime').setDescription('Çıkarılacak kelime').setRequired(true).setMaxLength(40)),
    )
    .addSubcommand((s) => s.setName('goster').setDescription('Koruma ayarlarını gösterir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const ben = interaction.guild.members.me;

    if (alt === 'spam') {
      const acik = interaction.options.getString('durum', true) === 'acik';
      const dakika = interaction.options.getInteger('susturma-dakika');
      ayarKaydet(sunucuId, 'korumaSpam', acik);
      if (dakika !== null) ayarKaydet(sunucuId, 'korumaSpamDakika', dakika);
      if (!acik) return cevapla('✅ Spam koruması kapatıldı.');
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
          ayarlariGetir(sunucuId).logKanali ? null : 'ℹ️ Olanları görmek için `/ayarla log-kanali` ile bir log kanalı seç.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (alt === 'kufur') {
      const acik = interaction.options.getString('durum', true) === 'acik';
      const dakika = interaction.options.getInteger('susturma-dakika');
      if (acik && !koruma.icerikOkunabilir(interaction.client)) {
        return cevapla('❌ Küfür filtresi mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı (README: Sunucu günlüğü bölümü).');
      }
      ayarKaydet(sunucuId, 'korumaKufur', acik);
      if (dakika !== null) ayarKaydet(sunucuId, 'korumaKufurDakika', dakika);
      if (!acik) return cevapla('✅ Küfür filtresi kapatıldı.');
      const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
      return cevapla(
        [
          `✅ Küfür filtresi açık. Ağır küfür içeren mesajlar silinir${ayar.kufurDakika ? ` ve yazan ${ayar.kufurDakika} dakika susturulur` : ''}.`,
          'Yalnızca ağır küfürler yakalanır; "amk", "aq" gibi kısaltmalar listede yok. Eklemek istersen `/koruma kelime-ekle` kullan.',
          'Mesajları Yönet yetkisi olanlar muaftır.',
          ben.permissions.has(PermissionFlagsBits.ManageMessages) ? null : '⚠️ Bunun çalışması için bana Mesajları Yönet iznini ver.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (alt === 'kelime-ekle' || alt === 'kelime-cikar') {
      const kelime = koruma.kelimeBicimi(interaction.options.getString('kelime', true));
      if (kelime.length < 2) return cevapla('❌ En az iki harfli tek bir kelime yaz.');
      const mevcut = koruma.ayarCoz(ayarlariGetir(sunucuId)).kelimeler;

      if (alt === 'kelime-ekle') {
        if (mevcut.includes(kelime)) return cevapla(`❌ ||${kelime}|| zaten listede.`);
        if (mevcut.length >= KELIME_SINIRI) return cevapla(`❌ En fazla ${KELIME_SINIRI} özel kelime eklenebilir.`);
        ayarKaydet(sunucuId, 'korumaKelimeler', [...mevcut, kelime]);
        return cevapla(`✅ ||${kelime}|| eklendi. Yalnızca tam bu kelime yakalanır; ekli halleri için ayrıca ekle.`);
      }
      if (!mevcut.includes(kelime)) return cevapla('❌ Bu kelime özel listede yok. Hazır listedeki kelimeler çıkarılamaz.');
      ayarKaydet(sunucuId, 'korumaKelimeler', mevcut.filter((k) => k !== kelime));
      return cevapla(`✅ ||${kelime}|| çıkarıldı.`);
    }

    // goster
    const ayar = koruma.ayarCoz(ayarlariGetir(sunucuId));
    const durum = (acik, dakika) => (acik ? `🟢 Açık\n${dakika ? `${dakika} dakika susturma` : 'Yalnızca silme'}` : '⚫ Kapalı');
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Otomatik koruma')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Spam koruması', value: durum(ayar.spam, ayar.spamDakika), inline: true },
        { name: 'Küfür filtresi', value: durum(ayar.kufur, ayar.kufurDakika), inline: true },
        {
          name: `Özel kelimeler · ${ayar.kelimeler.length}`,
          value: ayar.kelimeler.length ? `||${ayar.kelimeler.join(', ').slice(0, 1000)}||` : 'Yok',
        },
      )
      .setFooter({ text: 'Mesajları Yönet yetkisi olanlar ve botlar muaftır.' });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
