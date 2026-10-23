// /ayarlar → Günlük: olayların yazılacağı günlük kanalı, kaydedilecek olay türleri ve kanal özetleri
const { ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { yazabilirMi } = require('../yardimci');
const { KATEGORILER, kategoriAcik } = require('../gunluk');
const { icerikOkunabilir } = require('../koruma');
const yapayzeka = require('../yapayzeka');
const { kimlik, acKapat, satir } = require('./arac');

const ID = 'gunluk';
// "Moderasyon (ban, kick…)" → "Moderasyon" ve parantez içi
const kategoriAdi = (ad) => ad.replace(/\s*\(.*\)$/, '');
const kategoriAciklamasi = (ad) => /\((.*)\)$/.exec(ad)?.[1] ?? '';

function kart(sunucuId) {
  const a = ayarlariGetir(sunucuId);
  return new EmbedBuilder()
    .setTitle('📋 Günlük')
    .setColor(0x5865f2)
    .setDescription(
      [
        `**Günlük kanalı:** ${a.logKanali ? `<#${a.logKanali}>` : 'ayarlanmadı (kayıt tutulmuyor)'}`,
        '',
        Object.entries(KATEGORILER)
          .map(([k, ad]) => `${kategoriAcik(a, k) ? '🟢' : '⚫'} ${ad}`)
          .join('\n'),
        '',
        `**Kanal özetleri:** ${a.ozetAcik ? '🟢 açık' : '⚫ kapalı'} · Üyeler bir kanalın son mesajlarını yapay zekâyla özetletebilir.`,
      ].join('\n'),
    )
    .setFooter({ text: 'Kanal menüsünü boşaltırsan kayıt tutulmaz · Olay türlerini alttaki menüden seç' });
}

function ozetAcKapat(interaction) {
  const sunucuId = interaction.guildId;
  const acik = !ayarlariGetir(sunucuId).ozetAcik;
  if (acik && !yapayzeka.hazir()) {
    return ['❌ Özetleme yapay zekâ ister, ama bu botta yapay zekâ kurulu değil (botun sahibi .env içinde GEMINI_API_KEY ve GEMINI_MODEL girmeli).'];
  }
  if (acik && !icerikOkunabilir(interaction.client)) {
    return ['❌ Özetleme mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.'];
  }
  ayarKaydet(sunucuId, 'ozetAcik', acik);
  return acik
    ? [
        '✅ Kanal özetleri açık. Üyeler bulundukları kanalın son mesajlarını özetletebilir.',
        "ℹ️ Özetlenen mesajlar Google'ın yapay zekâsına gönderilir; bot mesajları saklamaz. Yalnızca kanalın mesaj geçmişini okuyabilenler özet alabilir. Özet varsayılan olarak yalnızca isteyene görünür.",
        'Her özet, kişinin günlük yapay zekâ hakkından bir tane kullanır.',
      ]
    : ['✅ Kanal özetleri kapatıldı.'];
}

module.exports = {
  id: ID,
  ad: 'Günlük',
  simge: '📋',
  aciklama: 'Üye, mesaj, ses ve yönetim olaylarının yazılacağı kanal; kanal özetleri',
  ozet(guild) {
    const a = ayarlariGetir(guild.id);
    return a.logKanali ? `🟢 <#${a.logKanali}>` : '⚫ Kapalı';
  },
  ekran(interaction) {
    const { guild } = interaction;
    const a = ayarlariGetir(guild.id);
    const kanal = new ChannelSelectMenuBuilder()
      .setCustomId(kimlik(ID, 'kanal'))
      .setPlaceholder('Günlük kanalını seç (boş: kayıt tutulmaz)')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1);
    if (a.logKanali && guild.channels?.cache?.has(a.logKanali)) kanal.setDefaultChannels(a.logKanali);
    const turler = Object.entries(KATEGORILER);
    const kategoriler = new StringSelectMenuBuilder()
      .setCustomId(kimlik(ID, 'kategoriler'))
      .setPlaceholder('Kaydedilecek olay türleri')
      .setMinValues(0)
      .setMaxValues(turler.length)
      .addOptions(turler.map(([value, ad]) => ({ value, label: kategoriAdi(ad), description: kategoriAciklamasi(ad).slice(0, 100), default: kategoriAcik(a, value) })));
    return {
      embeds: [kart(guild.id)],
      components: [satir(kanal), satir(kategoriler), satir(acKapat(ID, 'ozet', '🧠 Kanal özetleri', Boolean(a.ozetAcik)))],
    };
  },
  islem(interaction, islem) {
    const sunucuId = interaction.guildId;
    if (islem === 'kanal') {
      const kanal = interaction.channels?.first();
      if (!kanal) {
        ayarKaydet(sunucuId, 'logKanali', null);
        return ['✅ Günlük kanalı kaldırıldı; artık kayıt tutulmuyor.'];
      }
      if (!yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) {
        return [`❌ ${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`];
      }
      ayarKaydet(sunucuId, 'logKanali', kanal.id);
      return [`✅ Günlük kanalı ${kanal} olarak ayarlandı.`];
    }
    if (islem === 'kategoriler') {
      const secilen = new Set(interaction.values);
      ayarKaydet(sunucuId, 'logKategorileri', Object.fromEntries(Object.keys(KATEGORILER).map((k) => [k, secilen.has(k)])));
      return [`✅ Kaydedilecek olaylar: ${secilen.size ? [...secilen].map((k) => kategoriAdi(KATEGORILER[k])).join(', ') : 'hiçbiri'}.`];
    }
    if (islem === 'ozet') return ozetAcKapat(interaction);
    return [];
  },
};
