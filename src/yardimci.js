const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { gunlukGonder } = require('./gunluk');

// Komutu kullanan kişi bu üyeye işlem yapabilir mi? Yapamazsa sebebini döndürür.
function mudahaleEngeli(interaction, uye) {
  if (!uye) return null; // Sunucuda değil (ör. ID ile ban), rol kontrolü gerekmez
  if (uye.id === interaction.user.id) return 'Kendine işlem yapamazsın.';
  if (uye.id === interaction.client.user.id) return 'Bana işlem yapamazsın.';
  if (uye.id === interaction.guild.ownerId) return 'Sunucu sahibine işlem yapılamaz.';

  const sahipMi = interaction.user.id === interaction.guild.ownerId;
  if (!sahipMi && interaction.member.roles.highest.comparePositionTo(uye.roles.highest) <= 0) {
    return 'Bu üyenin rolü seninkiyle aynı veya daha yüksek.';
  }
  if (!uye.manageable) {
    return 'Bu üyenin rolü benim rolümden yüksek. Bot rolünü rol listesinde yukarı taşı.';
  }
  return null;
}

// Bot bu kanala yazabiliyor mu? Yazamıyorsa mesajlar sessizce kaybolur, o yüzden baştan söyle.
function yazabilirMi(kanal, ekIzinler = []) {
  const izinler = kanal.permissionsFor(kanal.guild.members.me);
  return izinler?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, ...ekIzinler]) ?? false;
}

// Moderasyon işlemini log kanalına yazar (ayarlanmışsa).
// hedef ve sebep isteğe bağlıdır (ör. /temizle'de ikisi de yok).
async function logGonder(guild, { baslik, renk, hedef, yetkili, sebep, ek }) {
  const embed = new EmbedBuilder().setTitle(baslik).setColor(renk);
  if (hedef) embed.addFields({ name: 'Kullanıcı', value: `${hedef} (${hedef.id})` });
  embed.addFields({ name: 'Yetkili', value: `${yetkili}` });
  if (sebep) embed.addFields({ name: 'Sebep', value: sebep });
  if (ek) embed.addFields(ek);

  await gunlukGonder(guild, 'moderasyon', embed);
}

// Yeni gelen herkese kendiliğinden verilmemesi gereken, yönetim yetkisi taşıyan izinler
const YONETIM_IZINLERI = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.ViewAuditLog,
];
const yonetimRolu = (rol) => rol.permissions.any(YONETIM_IZINLERI);

// Bu rol bot üzerinden üyelere verilebilir mi (oto rol, rol menüsü)? Verilemezse sebebini döndürür.
// Rolü bot verir; bu yüzden komutu kullanan kişinin o rolü kendisinin de verebiliyor olması
// gerekir. Yoksa yalnızca Sunucuyu Yönet yetkisi olan biri, kendi veremeyeceği bir rolü
// (ör. moderatör rolünü) yeni gelen herkese, yani kendi ikinci hesabına da verdirebilir.
// kime: rolü kimin alacağı ("Yeni gelen herkese"); amac: cümle başı, "Oto rol yapabilmen" gibi.
function rolVermeEngeli(interaction, rol, { kime, amac }) {
  const { guild, member } = interaction;
  if (rol.managed || rol.id === guild.id) return 'Bu rol bot tarafından verilemez.';
  if (yonetimRolu(rol)) {
    return `Bu rol yönetim yetkisi taşıyor (ör. üye atma, mesaj ya da rol yönetme). ${kime} verilmesi güvenli değil; yetkisiz bir rol seç.`;
  }
  if (rol.position >= guild.members.me.roles.highest.position) {
    return 'Bu rol benim rolümden yüksek. Bot rolünü rol listesinde bu rolün üstüne taşı.';
  }
  const sahipMi = interaction.user.id === guild.ownerId;
  if (!sahipMi && (!member.permissions.has(PermissionFlagsBits.ManageRoles) || rol.position >= member.roles.highest.position)) {
    return `Bu rolü sen de veremiyorsun. ${amac} için Rolleri Yönet yetkin olmalı ve rol senin en yüksek rolünden aşağıda olmalı.`;
  }
  return null;
}
const otoRolEngeli = (interaction, rol) => rolVermeEngeli(interaction, rol, { kime: 'Yeni gelen herkese', amac: 'Oto rol yapabilmen' });

// Oto rolü yeni üyeye verir. Rol ayarlandıktan sonra ona yönetim yetkisi eklenmişse vermez;
// sessizce durmasın diye (en sık saatte bir) kayda ve log kanalına uyarı yazar.
const otoRolUyarisi = beklemeSayaci(60 * 60_000);
async function otoRolVer(uye, rolId) {
  const rol = uye.guild.roles.cache.get(rolId);
  if (!rol) return; // Rol silinmiş
  if (!yonetimRolu(rol)) {
    await uye.roles.add(rol).catch((h) => console.error('Oto rol verilemedi:', h.message));
    return;
  }
  if (otoRolUyarisi.bekle(uye.guild.id)) return;
  otoRolUyarisi.isaretle(uye.guild.id);
  console.error(`Oto rol verilmedi (${uye.guild.id}): rol yönetim yetkisi taşıyor`);
  await gunlukGonder(
    uye.guild,
    'uyeler',
    new EmbedBuilder()
      .setTitle('⚠️ Oto rol verilmiyor')
      .setColor(0xfee75c)
      .setDescription(`${rol} rolü yönetim yetkisi taşıdığı için yeni gelenlere verilmiyor. Rolün yetkilerini kaldır ya da \`/ayarla oto-rol\` ile başka bir rol seç.`),
  );
}

// Komutun bildirdiği yetki, komutu kullanan kişide var mı? Bu denetimi normalde Discord yapar,
// ama sunucu yöneticileri kuralı Sunucu Ayarları → Entegrasyonlar bölümünden gevşetebilir.
// "kesinYetki" işaretli komutlarda bot ayrıca bununla da denetler (bkz. index.js).
function komutYetkisiVar(interaction, komut) {
  const gereken = komut.data.toJSON().default_member_permissions;
  return !gereken || Boolean(interaction.memberPermissions?.has(BigInt(gereken)));
}

// hepsi: { [sunucuId]: [kayıtlar] }. Bu sunucunun sahibine ait bütün sunuculardaki kayıt sayısını
// döndürür. Bot herkese açıkken, birkaç sunucusu olan tek kişi bütün sunucuların paylaştığı
// kapasiteyi (ör. toplam haber kaynağı sayısı) tek başına dolduramasın diye kullanılır.
function sahibinToplami(client, hepsi, sunucuId) {
  const sahip = client?.guilds.cache.get(sunucuId)?.ownerId;
  if (!sahip) return 0;
  return Object.entries(hepsi).reduce(
    (toplam, [id, kayitlar]) => toplam + (client.guilds.cache.get(id)?.ownerId === sahip ? kayitlar.length : 0),
    0,
  );
}

// Bildirimlerde etiketlenecek rolü seçen kişi o rolü kendisi de etiketleyebiliyor olmalı;
// yoksa etiketleyemediği bir rolü bot üzerinden etiketletmiş olur.
function etiketEngeli(interaction, rol) {
  if (rol.mentionable || interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)) return null;
  return `${rol} rolünü etiketleme yetkin yok. Rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç ya da başka bir rol seç.`;
}

// Dışarıdan gelen metin (haber özeti, gönderi açıklaması) kart içinde [yazı](adres) biçiminde
// gizli bağlantı oluşturamasın
const baglantisiz = (metin) => metin.replace(/\]\(/g, ']\\(');

// Hatanın kayda yazılacak hali. Hata nesnesinin tamamı yazılmaz: Discord hatalarında
// gönderilen isteğin gövdesi, yani kullanıcının yazdığı metin (ör. yasaklama sebebi) de bulunur.
const hataMetni = (hata) => hata?.stack ?? String(hata);

// Bir işlemin sunucu ya da kişi başına ne sıklıkla yapılabileceğini izler (bellekte tutulur,
// bot yeniden başlayınca sıfırlanır). bekle(anahtar): beklenecek milisaniye, serbestse 0.
function beklemeSayaci(aralik) {
  const sonlar = new Map();
  return {
    bekle: (anahtar) => Math.max((sonlar.get(anahtar) ?? 0) + aralik - Date.now(), 0),
    isaretle(anahtar) {
      sonlar.set(anahtar, Date.now());
      if (sonlar.size > 5000) {
        for (const [a, zaman] of sonlar) if (Date.now() - zaman > aralik) sonlar.delete(a);
      }
    },
  };
}

// "<t:...:R>" Discord'da "5 dakika içinde" gibi canlı bir sayaç gösterir
const neZaman = (ms) => `<t:${Math.ceil((Date.now() + ms) / 1000)}:R>`;

// Dakikayı okunur süreye çevirir: 1440 → "1 gün", 120 → "2 saat", 90 → "90 dakika"
function sureMetni(dakika) {
  if (dakika > 0 && dakika % 1440 === 0) return `${dakika / 1440} gün`;
  if (dakika > 0 && dakika % 60 === 0) return `${dakika / 60} saat`;
  return `${dakika} dakika`;
}

module.exports = {
  mudahaleEngeli, logGonder, yazabilirMi, rolVermeEngeli, otoRolEngeli, otoRolVer, yonetimRolu, komutYetkisiVar, etiketEngeli,
  baglantisiz, hataMetni, beklemeSayaci, neZaman, sureMetni, sahibinToplami,
};
