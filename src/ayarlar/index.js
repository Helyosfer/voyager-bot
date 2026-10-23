// /ayarlar paneli: botun bütün sunucu ayarları tek komutta.
//
// Komut yalnızca yazana görünen bir kart açar. Kartın ilk satırı her zaman bölüm menüsüdür;
// bölüm seçilince kart o bölümün ekranına döner. Bölümler bu klasördeki dosyalardır ve şu biçimdedir:
//   id, ad, simge, aciklama          menüde görünen ad ve açıklama
//   izin?, izinAdi?                  Sunucuyu Yönet'e ek olarak gereken yetki (ör. Yönetici)
//   gorunur?()                       bölüm menüde görünsün mü (ör. Instagram bağlantısı kurulu mu)
//   ozet(guild)                      genel bakıştaki tek satırlık durum
//   ekran(interaction, durum)        { embeds, components } (en fazla 4 satır)
//   form?(interaction, islem, ek)    açılacak form varsa ModalBuilder (ertelemeden önce açılır)
//   islem(interaction, islem, ek)    satırlar ya da { satirlar, durum }; durum ekrana geri verilir
//
// customId: "ay:<bölüm>:<işlem>[:<ek>]"; bölüm menüsü "ay:nav". index.js "ay:" ile başlayanları buraya yollar.
const { ActionRowBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');

const BOLUMLER = [
  require('./oyun'),
  require('./yayin'),
  require('./haber'),
  require('./instagram'),
  require('./koruma'),
  require('./gunluk'),
  require('./karsilama'),
  require('./seviye'),
  require('./uyari'),
  require('./kilit'),
  require('./kurulum'),
];
const bul = (id) => BOLUMLER.find((b) => b.id === id);

const izinli = (interaction, b) => !b.izin || Boolean(interaction.memberPermissions?.has(b.izin));
const gorunenler = (interaction) => BOLUMLER.filter((b) => (b.gorunur?.() ?? true) && izinli(interaction, b));

function menuSatiri(interaction, secili) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ay:nav')
      .setPlaceholder('Bir bölüm seç')
      .addOptions(
        { label: 'Genel bakış', value: 'genel', emoji: '🏠', description: 'Bütün ayarların özeti', default: secili === 'genel' },
        ...gorunenler(interaction).map((b) => ({ label: b.ad, value: b.id, emoji: b.simge, description: b.aciklama.slice(0, 100), default: b.id === secili })),
      ),
  );
}

function genelKart(interaction) {
  return new EmbedBuilder()
    .setTitle('⚙️ Voyager ayarları')
    .setColor(0x5865f2)
    .setDescription('Aşağıdaki menüden bir bölüm seç; her şeyi oradan açıp kapatabilir, değiştirebilirsin. Bu kartı yalnızca sen görüyorsun.')
    .addFields(gorunenler(interaction).map((b) => ({ name: `${b.simge} ${b.ad}`, value: b.ozet(interaction.guild).slice(0, 1024), inline: true })));
}

// Bölüm ekranı; satirlar yapılan değişiklikleri anlatır (yoksa içerik null: eski satırlar silinir).
// embeds verilirse bölümün kendi kartı yerine onlar gösterilir (ör. kurulum sonucu).
function mesaj(interaction, bolumId, satirlar = [], durum = '', embeds = null) {
  const content = satirlar.filter(Boolean).join('\n').slice(0, 2000) || null;
  const temel = { content, allowedMentions: { parse: [] } };
  const b = bolumId !== 'genel' && bul(bolumId);
  if (!b) return { ...temel, embeds: [genelKart(interaction)], components: [menuSatiri(interaction, 'genel')] };
  const ekran = b.ekran(interaction, durum);
  return { ...temel, embeds: embeds ?? ekran.embeds, components: [menuSatiri(interaction, b.id), ...ekran.components] };
}

// /ayarlar komutu
function ac(interaction) {
  const m = mesaj(interaction, 'genel');
  return interaction.reply({ ...m, content: undefined, flags: MessageFlags.Ephemeral });
}

const gizliCevap = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

async function etkilesim(interaction) {
  const [, bolumId, islem = '', ...kalan] = interaction.customId.split(':');
  const ek = kalan.join(':');
  // Kart yalnızca komutu kullanana görünür, ama yetkisi sonradan alınmış olabilir
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return gizliCevap(interaction, '❌ Ayarları değiştirmek için Sunucuyu Yönet yetkin olmalı.');
  }
  if (bolumId === 'nav') {
    const hedef = interaction.values[0];
    if (hedef !== 'genel' && !gorunenler(interaction).some((b) => b.id === hedef)) return gizliCevap(interaction, '❌ Bu bölümü açamazsın.');
    return interaction.update(mesaj(interaction, hedef));
  }
  const b = bul(bolumId);
  if (!b) return gizliCevap(interaction, '❌ Bu kart eski. `/ayarlar` komutunu yeniden yaz.');
  if (!izinli(interaction, b)) return gizliCevap(interaction, `❌ Bu bölüm için ${b.izinAdi} yetkin olmalı.`);

  // Form, düğmeye verilecek ilk cevap olmalı (ertelemeden önce)
  if (!interaction.isModalSubmit()) {
    const acilacak = await b.form?.(interaction, islem, ek);
    if (acilacak) return interaction.showModal(acilacak);
  }
  // Hızlı (yerel) işlemler kartı doğrudan tek istekte günceller: düğme anında yeşile döner.
  // Dışarıya istek atan ya da uzun süren işlemlerde (b.ertele) 3 saniye sınırı aşılmasın diye önce ertelenir.
  const ertele = b.ertele?.(islem) ?? false;
  if (!ertele && interaction.update && (!interaction.isModalSubmit() || interaction.isFromMessage())) {
    const sonuc = (await b.islem(interaction, islem, ek)) ?? [];
    const { satirlar = [], durum = '', embeds = null } = Array.isArray(sonuc) ? { satirlar: sonuc } : sonuc;
    return interaction.update(mesaj(interaction, b.id, satirlar, durum, embeds));
  }
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  else await interaction.deferUpdate();

  const sonuc = (await b.islem(interaction, islem, ek)) ?? [];
  const { satirlar = [], durum = '', embeds = null } = Array.isArray(sonuc) ? { satirlar: sonuc } : sonuc;
  return interaction.editReply(mesaj(interaction, b.id, satirlar, durum, embeds));
}

// Önceki sürümlerin kartları ("ba:" ile başlar): yeni panele yönlendirilir
const eskiKart = (interaction) => gizliCevap(interaction, 'Bu kart eski. Ayarlar artık tek yerde: `/ayarlar` yaz.');

module.exports = { BOLUMLER, ac, etkilesim, eskiKart, mesaj };
