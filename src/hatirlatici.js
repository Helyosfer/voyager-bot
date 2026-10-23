// Hatırlatıcılar: bir mesaja sağ tıklayıp "Hatırlat" seçilince süre ve not formu açılır; süre dolunca
// bot o kanalda kullanıcıyı etiketleyerek hatırlatır. Kayıt: hatirlaticilar.json
const {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  DiscordAPIError,
  InteractionContextType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { oku, yaz } = require('./depo');
const { formMetni, sayi } = require('./ayarlar/arac');

// Bir kişinin aynı anda bekleyen en fazla hatırlatıcı sayısı
const KISI_BASI_SINIR = 5;
const EN_UZUN_DAKIKA = 10080; // 7 gün

// Gönderim geçici bir hatayla (ağ kopması, Discord arızası) başarısız olursa
// bu aralıkla, en fazla bu kadar kez denenir.
const TEKRAR_BEKLEME = 60_000;
const EN_FAZLA_DENEME = 5;

// Hatırlatıcıyı kuran kişi hâlâ bu kanala yazabiliyor mu? Sunucudan ayrılmış,
// yasaklanmış veya susturulmuşsa mesajı bot üzerinden göndermesine izin verme.
async function halaYazabilir(kanal, kullaniciId) {
  if (!kanal.guild) return false;
  const uye = await kanal.guild.members.fetch(kullaniciId);
  if (uye.isCommunicationDisabled()) return false;
  const izin = kanal.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  return kanal.permissionsFor(uye)?.has(izin) ?? false;
}

async function gonder(client, kayit) {
  const kanal = await client.channels.fetch(kayit.kanalId);
  if (!kanal?.isTextBased() || !(await halaYazabilir(kanal, kayit.kullaniciId))) return;
  await kanal.send({
    content: `⏰ <@${kayit.kullaniciId}> hatırlatma: ${kayit.mesaj}`,
    // Mesajın içine @everyone yazılsa bile sadece ilgili kişi etiketlenir
    allowedMentions: { users: [kayit.kullaniciId] },
  });
}

function kur(client, kayit, deneme = 1) {
  const kalan = deneme === 1 ? Math.max(kayit.zaman - Date.now(), 0) : TEKRAR_BEKLEME;
  setTimeout(async () => {
    try {
      await gonder(client, kayit);
    } catch (hata) {
      // Discord'un reddettiği istekler (kanal silinmiş, üye ayrılmış, yetki yok)
      // tekrar denenince düzelmez; diğerleri geçici olabilir.
      const kalici = hata instanceof DiscordAPIError && hata.status < 500;
      if (!kalici && deneme < EN_FAZLA_DENEME) return kur(client, kayit, deneme + 1);
      console.error(`Hatırlatma gönderilemedi (${kayit.id}):`, hata.message);
    }
    // Zamanlayıcının içinde yakalanmayan bir hata (ör. dosya yazılamazsa) botu bütün sunucularda kapatır
    try {
      yaz('hatirlaticilar', oku('hatirlaticilar', []).filter((h) => h.id !== kayit.id));
    } catch (hata) {
      console.error(`Hatırlatıcı kaydı silinemedi (${kayit.id}):`, hata.message);
    }
  }, kalan);
}

// Kişi sınırı dolduysa eklemez ve false döndürür.
function ekle(client, kayit) {
  const hepsi = oku('hatirlaticilar', []);
  if (hepsi.filter((h) => h.kullaniciId === kayit.kullaniciId).length >= KISI_BASI_SINIR) return false;
  yaz('hatirlaticilar', [...hepsi, kayit]);
  kur(client, kayit);
  return true;
}

// Bot açıldığında, kapalıyken bekleyen hatırlatıcıları yeniden kurar.
function hepsiniYukle(client) {
  for (const kayit of oku('hatirlaticilar', [])) kur(client, kayit);
}

// Sağ tıklanan mesajdan hatırlatıcı formu açar; varsayılan metin mesajın içeriği ya da bağlantısıdır
function hatirlatFormu(kanalId, mesaj) {
  const varsayilan = (mesaj?.cleanContent ?? mesaj?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) || mesaj?.url || '';
  const notKutusu = new TextInputBuilder().setCustomId('mesaj').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500).setPlaceholder('Ne hatırlatayım?');
  if (varsayilan) notKutusu.setValue(varsayilan);
  return new ModalBuilder()
    .setCustomId(`ht:form:${kanalId}`)
    .setTitle('Hatırlatıcı kur')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kaç dakika sonra?')
        .setDescription('1 ile 10080 (7 gün) arası. 1 saat = 60, 1 gün = 1440.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('dakika').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5).setPlaceholder('ör. 30')),
      new LabelBuilder().setLabel('Ne hatırlatayım?').setTextInputComponent(notKutusu),
    );
}

// "ht:" önekli form gönderimi
async function etkilesim(interaction) {
  if (!interaction.isModalSubmit()) return;
  const [, islem, kanalId] = interaction.customId.split(':');
  if (islem !== 'form') return;
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

  const dakika = sayi(formMetni(interaction, 'dakika'), 1, EN_UZUN_DAKIKA);
  if (dakika === null) return cevapla(`❌ Süre 1 ile ${EN_UZUN_DAKIKA} dakika (7 gün) arasında bir sayı olmalı.`);
  const mesaj = formMetni(interaction, 'mesaj');
  if (!mesaj) return cevapla('❌ Hatırlatılacak metni yaz.');

  const zaman = Date.now() + dakika * 60_000;
  const eklendi = ekle(interaction.client, {
    id: interaction.id,
    kullaniciId: interaction.user.id,
    kanalId: kanalId || interaction.channelId,
    zaman,
    mesaj,
  });
  if (!eklendi) {
    return cevapla(`❌ Aynı anda en fazla ${KISI_BASI_SINIR} hatırlatıcın olabilir. Biri bitince yenisini kurabilirsin.`);
  }
  // <t:...:R> Discord'da "5 dakika içinde" gibi canlı bir sayaç gösterir. Sayaç okuyanın uygulama diliyle
  // yazıldığı için cümlenin ortasına değil sonuna konur.
  return cevapla(`⏰ Tamam, hatırlatacağım: <t:${Math.floor(zaman / 1000)}:R>`);
}

// Mesaja sağ tık menüsü ("Uygulamalar → Hatırlat")
const sagTikKomutu = {
  data: new ContextMenuCommandBuilder().setName('Hatırlat').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild),
  execute: (interaction) => interaction.showModal(hatirlatFormu(interaction.channelId, interaction.targetMessage)),
};

module.exports = { ekle, hepsiniYukle, hatirlatFormu, etkilesim, sagTikKomutu, KISI_BASI_SINIR, EN_UZUN_DAKIKA };
