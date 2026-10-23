// /ayarlar bölümlerinin ortak küçük araçları: düğme, satır, form alanları
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// customId: "ay:<bölüm>:<işlem>[:<ek>]"
const kimlik = (bolum, ...parcalar) => ['ay', bolum, ...parcalar].join(':');
const dugme = (bolum, islem, etiket, stil = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(kimlik(bolum, islem)).setLabel(etiket).setStyle(stil);
// Aç/kapat düğmesi: etikette şu anki durum yazar, basınca tersine döner
const acKapat = (bolum, islem, ad, acik) => dugme(bolum, islem, `${ad}: ${acik ? 'Açık' : 'Kapalı'}`, acik ? ButtonStyle.Success : ButtonStyle.Secondary);
const satir = (...bilesenler) => new ActionRowBuilder().addComponents(bilesenler.filter(Boolean));

// Form: baslik ve [LabelBuilder] alanları
const form = (bolum, islem, baslik, ...alanlar) => new ModalBuilder().setCustomId(kimlik(bolum, islem)).setTitle(baslik).addLabelComponents(alanlar);

// Formda metin kutusu. secenek: { aciklama, deger, yerTutucu, uzun, zorunlu, enFazla }
function metinAlani(id, etiket, { aciklama, deger, yerTutucu, uzun = false, zorunlu = true, enFazla = 400 } = {}) {
  const kutu = new TextInputBuilder()
    .setCustomId(id)
    .setStyle(uzun ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(zorunlu)
    .setMaxLength(enFazla);
  if (deger !== undefined && deger !== null && String(deger)) kutu.setValue(String(deger));
  if (yerTutucu) kutu.setPlaceholder(yerTutucu);
  const alan = new LabelBuilder().setLabel(etiket).setTextInputComponent(kutu);
  if (aciklama) alan.setDescription(aciklama);
  return alan;
}

// Formdan okunan değerler; alan yoksa ya da boşsa null
function formMetni(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id)?.trim() || null;
  } catch {
    return null;
  }
}
function formSecimi(interaction, id, tur) {
  try {
    if (tur === 'rol') return interaction.fields.getSelectedRoles(id)?.first() ?? null;
    if (tur === 'kanal') return interaction.fields.getSelectedChannels(id)?.first() ?? null;
    if (tur === 'uye') return interaction.fields.getSelectedUsers(id)?.first() ?? null;
    return interaction.fields.getStringSelectValues(id)?.[0] ?? null;
  } catch {
    return null;
  }
}

// "60", "60 dk" gibi yazılardan tam sayı; geçersizse null
function sayi(metin, enAz, enFazla) {
  if (metin === null || metin === undefined) return null;
  const temiz = String(metin).replace(/[^\d-]/g, '');
  if (!temiz) return null; // "abc" sıfır sayılmasın
  const n = Number(temiz);
  if (!Number.isInteger(n) || n < enAz || n > enFazla) return null;
  return n;
}

// Virgül, boşluk ya da satırla ayrılmış liste
const liste = (metin) => (metin ? metin.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) : []);

module.exports = { kimlik, dugme, acKapat, satir, form, metinAlani, formMetni, formSecimi, sayi, liste, ButtonStyle };
