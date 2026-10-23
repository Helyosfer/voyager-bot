// /ayarlar → Uyarı kuralları: uyarı sayısı bir eşiğe gelince otomatik susturma, atma ya da yasaklama
const { EmbedBuilder, LabelBuilder, StringSelectMenuBuilder } = require('discord.js');
const uyari = require('../uyari');
const { kimlik, dugme, satir, form, metinAlani, formMetni, formSecimi, sayi, ButtonStyle } = require('./arac');

const ID = 'uyari';
const IZIN_ADLARI = { sustur: 'Üyelere Zaman Aşımı Uygula', at: 'Üyeleri At', yasakla: 'Üyeleri Yasakla' };

function kart(sunucuId) {
  const liste = uyari.kurallar(sunucuId);
  return new EmbedBuilder()
    .setTitle('⚠️ Uyarı kuralları')
    .setColor(0xfee75c)
    .setDescription(
      [
        liste.length ? liste.map((k) => `• ${uyari.kuralMetni(k)}`).join('\n') : 'Henüz kural yok; uyarılar yalnızca kaydedilir.',
        '',
        `Kural, üyenin uyarı sayısı tam eşiğe geldiğinde bir kez uygulanır. En fazla ${uyari.KURAL_SINIRI} kural. Uyarıyı veren yetkili işlemi kendisi yapamıyorsa uygulanmaz ve günlüğe yazılır.`,
      ].join('\n'),
    );
}

const kuralFormu = () =>
  form(
    ID,
    'ekle-form',
    'Uyarı kuralı ekle',
    metinAlani('esik', 'Kaçıncı uyarıda?', { enFazla: 2, yerTutucu: 'ör. 3', aciklama: `1 ile ${uyari.ESIK_SINIRI} arası. Aynı eşikte kural varsa yenisiyle değişir.` }),
    new LabelBuilder()
      .setLabel('Ne yapılsın?')
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId('islem')
          .addOptions({ label: 'Sustur', value: 'sustur' }, { label: 'At', value: 'at' }, { label: 'Yasakla', value: 'yasakla' }),
      ),
    metinAlani('dakika', 'Susturma kaç dakika?', { zorunlu: false, enFazla: 5, yerTutucu: '60', aciklama: 'Yalnızca susturmada; boş bırakırsan 60 dakika.' }),
  );

// Kuralı ekleyen, kuralın uyguladığı işlemi kendisi de yapabiliyor olmalı
function kuralEkle(interaction) {
  const esik = sayi(formMetni(interaction, 'esik'), 1, uyari.ESIK_SINIRI);
  if (esik === null) return [`❌ Eşik 1 ile ${uyari.ESIK_SINIRI} arasında bir sayı olmalı.`];
  const islem = formSecimi(interaction, 'islem');
  if (!uyari.ISLEMLER[islem]) return ['❌ Ne yapılacağını seç.'];
  const yazilanDakika = formMetni(interaction, 'dakika');
  const dakika = yazilanDakika === null ? 60 : sayi(yazilanDakika, 1, 40320);
  if (dakika === null) return ['❌ Susturma süresi 1 ile 40320 dakika arasında olmalı.'];
  const { ad, yetki } = uyari.ISLEMLER[islem];
  if (!interaction.memberPermissions?.has(yetki)) return [`❌ ${ad} kuralı ekleyebilmek için bu işlemi senin de yapabiliyor olman gerekir.`];
  const yeni = { esik, islem, ...(islem === 'sustur' ? { dakika } : {}) };
  // Aynı eşikteki kural yenisiyle değişir (kuralEkle)
  if (!uyari.kuralEkle(interaction.guildId, yeni)) return [`❌ En fazla ${uyari.KURAL_SINIRI} kural olabilir. Önce listeden birini kaldır.`];
  return [
    `✅ Kural kaydedildi: ${uyari.kuralMetni(yeni)}.`,
    interaction.guild.members.me.permissions.has(yetki) ? null : `⚠️ Bunun çalışması için bana ${IZIN_ADLARI[islem]} iznini ver.`,
  ].filter(Boolean);
}

module.exports = {
  id: ID,
  ad: 'Uyarı kuralları',
  simge: '⚠️',
  aciklama: 'Uyarı sayısına göre otomatik susturma, atma ya da yasaklama',
  ozet(guild) {
    const n = uyari.kurallar(guild.id).length;
    return n ? `🟢 ${n} kural` : '⚫ Kural yok';
  },
  ekran(interaction) {
    const liste = uyari.kurallar(interaction.guildId);
    const satirlar = [];
    if (liste.length) {
      satirlar.push(
        satir(
          new StringSelectMenuBuilder()
            .setCustomId(kimlik(ID, 'sil'))
            .setPlaceholder('Kaldırmak için bir kural seç')
            .addOptions(liste.map((k) => ({ value: String(k.esik), label: uyari.kuralMetni(k).slice(0, 100) }))),
        ),
      );
    }
    satirlar.push(satir(dugme(ID, 'ekle', '➕ Kural ekle', ButtonStyle.Primary)));
    return { embeds: [kart(interaction.guildId)], components: satirlar };
  },
  form: (interaction, islem) => (islem === 'ekle' ? kuralFormu() : null),
  islem(interaction, islem) {
    if (islem === 'ekle-form') return kuralEkle(interaction);
    if (islem === 'sil') {
      const esik = Number(interaction.values[0]);
      return [uyari.kuralSil(interaction.guildId, esik) ? `✅ ${esik} uyarı kuralı kaldırıldı.` : `❌ ${esik} uyarı için bir kural yok.`];
    }
    return [];
  },
};
