// /ayarlar panelinin bildirim bölümleri (oyun, yayın, haber, Instagram) için ortak kart.
//
// Her bildirim bölümü bir "panel" tanımlar; bolum(panel) onu /ayarlar'ın bölüm biçimine çevirir
// (bkz. ayarlar/index.js). Kartta:
//   · Kanal ve rol seçme menüleri (rol seçimini boşaltmak rol etiketini kaldırır)
//   · Bölüme özel düğmeler (ör. oyunda bedava oyunlar, indirimler, @everyone)
//   · Takip listesi olanlarda: "Ekle" düğmesi (form açar) ve listeden çıkarma menüsü
//   · Bildirimleri kapat
//
// Panel:
//   komut (bölüm kimliği), ad, simge, aciklama, anahtarlar: { kanal, rol }, kart(sunucuId)
//   gorunur?(): bölüm menüde görünsün mü (ör. Instagram bağlantısı kurulu mu)
//   kanalNotu?: kanal ilk kez seçilince eklenecek satır
//   dugmeler?(sunucuId): kendi satırına konan düğmeler (ör. aç/kapat)
//   altDugmeler?(sunucuId): son satırdaki düğmeler (ör. deneme bildirimi)
//   islem?(interaction, islem): bölüme özel düğmeye basılınca yapılanı anlatan satırlar
//   liste?: { ogeler(sunucuId) → [{ value, label }], cikar(interaction, value) → satırlar,
//             form() → ModalBuilder, ekle(interaction) → satırlar }
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType,
  PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const { ayarKaydet, ayarlariGetir } = require('./depo');
const { yazabilirMi, etiketEngeli } = require('./yardimci');

const KANAL_TURLERI = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const SAYFA_BOYU = 25; // Discord: bir seçme menüsünde en fazla 25 seçenek

// Bot bu kanala bildirim kartı gönderebilir mi? Gönderemiyorsa sebebi
function kanalEngeli(kanal) {
  if (yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) return null;
  return `${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`;
}

// Rol bildirimlerde etiketlenebilir mi? engel: seçilemez. uyari: seçilir ama etiket bildirim göndermez.
function rolDenetle(interaction, rol) {
  if (rol.id === interaction.guild.id) return { engel: '@everyone seçilemez; ayrı bir rol oluştur.' };
  const engel = etiketEngeli(interaction, rol);
  if (engel) return { engel };
  const etiketleyebilir = rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
  return {
    uyari: etiketleyebilir ? null : `${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
  };
}

// Bildirim kanalı hiç seçilmemişse, işlemin yapıldığı kanal (bot oraya kart gönderebiliyorsa)
// kendiliğinden bildirim kanalı olur. Yapılanı anlatan satır ya da null döner.
function kanalVarsay(interaction, anahtar) {
  const sunucuId = interaction.guildId;
  if (ayarlariGetir(sunucuId)[anahtar]) return null;
  const kanal = interaction.channel;
  if (!kanal || kanal.isThread?.() || !KANAL_TURLERI.includes(kanal.type) || kanalEngeli(kanal)) {
    return 'ℹ️ Bildirimlerin gelmesi için yukarıdaki menüden bir kanal seç.';
  }
  ayarKaydet(sunucuId, anahtar, kanal.id);
  return `ℹ️ Henüz bildirim kanalı seçilmemişti; bildirimler bu kanala (${kanal}) gelecek. Değiştirmek için yukarıdaki kanal menüsünü kullan.`;
}

// --- Kartın bileşenleri ---
// customId: "ay:<bölüm>:<işlem>[:<sayfa>]" (ayarlar/index.js yönlendirir)
const kimlik = (panel, ...parcalar) => ['ay', panel.komut, ...parcalar].join(':');
const dugme = (panel, islem, etiket, stil = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(kimlik(panel, islem)).setLabel(etiket).setStyle(stil);

// Aç/kapat düğmesi: etikette şu anki durum yazar, basınca tersine döner
const acKapat = (panel, islem, ad, acik) => dugme(panel, islem, `${ad}: ${acik ? 'Açık' : 'Kapalı'}`, acik ? ButtonStyle.Success : ButtonStyle.Secondary);

const satir = (...bilesenler) => new ActionRowBuilder().addComponents(bilesenler);
const sayfaSayisi = (ogeler) => Math.max(1, Math.ceil(ogeler.length / SAYFA_BOYU));

// Kartın satırları (en fazla 4; ilk satır /ayarlar'ın bölüm menüsü)
function bilesenler(panel, guild, sayfa) {
  const ayar = ayarlariGetir(guild.id);
  const kanalId = ayar[panel.anahtarlar.kanal];
  const rolId = ayar[panel.anahtarlar.rol];
  const satirlar = [];

  // Seçili kanal ve rol menüde hazır görünür (silinmişse gösterilmez; Discord bilinmeyeni reddeder)
  const kanalMenusu = new ChannelSelectMenuBuilder()
    .setCustomId(kimlik(panel, 'kanal'))
    .setPlaceholder('Bildirimlerin gideceği kanalı seç')
    .setChannelTypes(KANAL_TURLERI);
  if (kanalId && guild.channels?.cache?.has(kanalId)) kanalMenusu.setDefaultChannels(kanalId);
  satirlar.push(satir(kanalMenusu));

  const rolMenusu = new RoleSelectMenuBuilder()
    .setCustomId(kimlik(panel, 'rol'))
    .setPlaceholder('Etiketlenecek rol (boş: kimse etiketlenmez)')
    .setMinValues(0)
    .setMaxValues(1);
  if (rolId && guild.roles?.cache?.has(rolId)) rolMenusu.setDefaultRoles(rolId);
  satirlar.push(satir(rolMenusu));

  const ozel = panel.dugmeler?.(guild.id) ?? [];
  if (ozel.length) satirlar.push(satir(...ozel));

  // Takip listesinden çıkarma menüsü; 25'ten fazla kayıt sayfalara bölünür
  const ogeler = panel.liste?.ogeler(guild.id) ?? [];
  const sayfalar = sayfaSayisi(ogeler);
  sayfa = Math.min(Math.max(0, sayfa), sayfalar - 1);
  if (ogeler.length) {
    const bu = ogeler.slice(sayfa * SAYFA_BOYU, (sayfa + 1) * SAYFA_BOYU);
    satirlar.push(
      satir(
        new StringSelectMenuBuilder()
          .setCustomId(kimlik(panel, 'cikar', sayfa))
          .setPlaceholder(`Takipten çıkarmak için seç${sayfalar > 1 ? ` (sayfa ${sayfa + 1}/${sayfalar})` : ''}`)
          .addOptions(bu.map((o) => ({ value: o.value.slice(0, 100), label: o.label.slice(0, 100) || o.value.slice(0, 100) }))),
      ),
    );
  }

  const son = [
    panel.liste && dugme(panel, 'ekle', '➕ Ekle', ButtonStyle.Primary),
    ...(panel.altDugmeler?.(guild.id) ?? []),
    sayfalar > 1 && dugme(panel, `sayfa:${sayfa - 1}`, '‹').setDisabled(sayfa === 0),
    sayfalar > 1 && dugme(panel, `sayfa:${sayfa + 1}`, '›').setDisabled(sayfa === sayfalar - 1),
    kanalId && dugme(panel, 'kapat', 'Bildirimleri kapat', ButtonStyle.Danger),
  ].filter(Boolean);
  if (son.length) satirlar.push(satir(...son));
  return satirlar;
}

// --- Kanal ve rol seçimi ---
function kanalSec(interaction, panel, kanal) {
  const sorun = kanalEngeli(kanal);
  if (sorun) return [`❌ ${sorun}`];
  const onceki = ayarlariGetir(interaction.guildId)[panel.anahtarlar.kanal];
  ayarKaydet(interaction.guildId, panel.anahtarlar.kanal, kanal.id);
  return [`✅ ${panel.ad} ${kanal} kanalına gönderilecek.`, !onceki && panel.kanalNotu].filter(Boolean);
}

function rolSec(interaction, panel, rol) {
  if (!rol) {
    ayarKaydet(interaction.guildId, panel.anahtarlar.rol, null);
    return ['✅ Bildirimlerde artık rol etiketlenmeyecek.'];
  }
  const durum = rolDenetle(interaction, rol);
  if (durum.engel) return [`❌ ${durum.engel}`];
  ayarKaydet(interaction.guildId, panel.anahtarlar.rol, rol.id);
  return [durum.uyari ? `⚠️ ${durum.uyari}` : `✅ Bildirimlerde ${rol} etiketlenecek.`];
}

// Panelin /ayarlar bölümü
function bolum(panel) {
  return {
    id: panel.komut,
    ad: panel.ad,
    simge: panel.simge,
    aciklama: panel.aciklama,
    gorunur: panel.gorunur,
    // Genel bakıştaki satır
    ozet(guild) {
      const ayar = ayarlariGetir(guild.id);
      const kanal = ayar[panel.anahtarlar.kanal];
      const liste = panel.liste ? ` · ${panel.liste.ogeler(guild.id).length} kayıt` : '';
      return kanal ? `🟢 <#${kanal}>${liste}` : `⚫ Kapalı${liste}`;
    },
    ekran: (interaction, durum) => ({
      embeds: [panel.kart(interaction.guildId)],
      components: bilesenler(panel, interaction.guild, Number(durum) || 0),
    }),
    // Form, düğmeye verilecek ilk cevap olmalı: ertelemeden önce açılır
    form: (interaction, islem) => (islem === 'ekle' && interaction.isButton() && panel.liste ? panel.liste.form() : null),
    // Yalnızca dış servise ya da kanala istek atan işlemler ertelenir; kanal/rol/aç-kapat anında güncellenir
    ertele: (islem) => islem === 'ekle-form' || islem === 'simdi' || islem === 'deneme' || islem === 'cikar',
    async islem(interaction, islem, ek) {
      const sayfa = Number(ek) || 0;
      let satirlar = [];
      if (islem === 'kanal') {
        const kanal = interaction.channels?.first();
        if (kanal) satirlar = kanalSec(interaction, panel, kanal);
      } else if (islem === 'rol') satirlar = rolSec(interaction, panel, interaction.roles?.first() ?? null);
      else if (islem === 'kapat') {
        ayarKaydet(interaction.guildId, panel.anahtarlar.kanal, null);
        satirlar = [`✅ ${panel.ad} kapatıldı. Liste ve ayarlar duruyor; yeniden açmak için yukarıdan bir kanal seç.`];
      } else if (islem === 'cikar') satirlar = await panel.liste.cikar(interaction, interaction.values[0]);
      else if (islem === 'ekle-form') satirlar = await panel.liste.ekle(interaction);
      else if (islem !== 'sayfa') satirlar = (await panel.islem?.(interaction, islem)) ?? [];
      return { satirlar, durum: String(sayfa) };
    },
  };
}

// Formdaki isteğe bağlı rol seçimi (seçilmediyse null)
function formRolu(interaction, alan = 'rol') {
  try {
    return interaction.fields.getSelectedRoles(alan)?.first() ?? null;
  } catch {
    return null;
  }
}

// Kendi rolü olan kayıtta o rol gösterilir, yoksa genel rol kullanılır
const rolEtiketi = (kayitRolu) => (kayitRolu ? ` → <@&${kayitRolu}>` : '');

module.exports = { kanalEngeli, rolDenetle, kanalVarsay, dugme, acKapat, bolum, formRolu, rolEtiketi, SAYFA_BOYU, KANAL_TURLERI };
