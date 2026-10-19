const {
  SlashCommandBuilder,
  ApplicationCommandOptionType: T,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const REHBER = require('../yardim-rehberi');

const RENK = 0x5865f2;
const ACIK_KALMA = 5 * 60 * 1000; // Menü bu süre boyunca çalışır

// Yardım sayfaları. Bir komut hiçbir bölümde yoksa "Diğer" sayfasına düşer.
// ilkAdim: alt komutları olan komutlarda nereden başlanacağını gösterir.
const BOLUMLER = [
  {
    id: 'genel',
    simge: '🧭',
    ad: 'Genel',
    ozet: 'Herkesin kullanabildiği komutlar',
    komutlar: ['sor', 'ozetle', 'hatirlat', 'ping', 'yardim'],
  },
  {
    id: 'moderasyon',
    simge: '🛡️',
    ad: 'Moderasyon',
    ozet: 'Üyeleri uyarma, susturma, atma, yasaklama ve mesaj temizleme',
    komutlar: ['uyari', 'sustur', 'kick', 'ban', 'unban', 'temizle'],
    ilkAdim: { uyari: 'ver' },
  },
  {
    id: 'guvenlik',
    simge: '🚨',
    ad: 'Güvenlik',
    ozet: 'Spam ve küfür filtresi, saldırı anında sunucuyu kilitleme',
    komutlar: ['koruma', 'kitle', 'kilidiac'],
    ilkAdim: { koruma: 'spam' },
  },
  {
    id: 'bildirim',
    simge: '📣',
    ad: 'Bildirimler',
    ozet: 'Oyun fırsatları, canlı yayınlar ve haberler kanalına gelsin',
    komutlar: ['oyun', 'yayin', 'haber', 'instagram'],
    ilkAdim: { oyun: 'kanal', yayin: 'kanal', haber: 'kanal', instagram: 'kanal' },
  },
  {
    id: 'topluluk',
    simge: '🎉',
    ad: 'Topluluk',
    ozet: 'Seviyeler ve sıralama, çekilişler, düğmeyle rol alma menüleri',
    komutlar: ['seviye', 'cekilis', 'rolmenu'],
    ilkAdim: { seviye: 'goster', cekilis: 'baslat' },
  },
  {
    id: 'sunucu',
    simge: '⚙️',
    ad: 'Sunucu ayarları',
    ozet: 'Kayıt kanalı, hoş geldin mesajı, otomatik rol ve hazır sunucu kurulumu',
    komutlar: ['ayarla', 'sunucukur'],
    ilkAdim: { ayarla: 'goster' },
  },
];
const DIGER = { id: 'diger', simge: '📦', ad: 'Diğer', ozet: 'Diğer komutlar', komutlar: [] };

// Komutların istediği yetkilerin Discord'daki Türkçe adları
const YETKI_ADLARI = {
  Administrator: 'Yönetici',
  ManageGuild: 'Sunucuyu Yönet',
  ManageRoles: 'Rolleri Yönet',
  ManageChannels: 'Kanalları Yönet',
  ManageMessages: 'Mesajları Yönet',
  BanMembers: 'Üyeleri Yasakla',
  KickMembers: 'Üyeleri At',
  ModerateMembers: 'Üyelere Zaman Aşımı Uygula',
};
// Seçenek türlerinin okunur adları
const TUR = {
  [T.String]: 'metin',
  [T.Integer]: 'sayı',
  [T.Number]: 'sayı',
  [T.Boolean]: 'evet/hayır',
  [T.User]: 'kullanıcı',
  [T.Channel]: 'kanal',
  [T.Role]: 'rol',
  [T.Mentionable]: 'kullanıcı ya da rol',
  [T.Attachment]: 'dosya',
};

const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);
const kucuk = (metin) => metin.toLocaleLowerCase('tr');

function yetkiMetni(bitler) {
  if (!bitler) return 'Herkes';
  // false: Yönetici yetkisi bütün yetkileri içeriyor sayılmasın, yalnızca istenen yazılsın
  const adlar = new PermissionsBitField(BigInt(bitler)).toArray(false).map((ad) => YETKI_ADLARI[ad] ?? ad);
  return `**${adlar.join(', ')}** yetkisi olanlar`;
}

// Alt komutlar (gruplardakiler "grup alt" adıyla)
const altKomutlar = (komut) =>
  (komut.options ?? []).flatMap((o) => {
    if (o.type === T.SubcommandGroup) return (o.options ?? []).map((a) => ({ ...a, tamAd: `${o.name} ${a.name}` }));
    return o.type === T.Subcommand ? [{ ...o, tamAd: o.name }] : [];
  });

function secenekSatiri(o) {
  // Seçmeli seçenekte üye yazmaz, listeden seçer
  const ek = [o.choices?.length ? 'seçim' : (TUR[o.type] ?? 'değer')];
  if (o.min_value != null && o.max_value != null) ek.push(`${o.min_value}-${o.max_value}`);
  else if (o.max_value != null) ek.push(`en fazla ${o.max_value}`);
  if (o.choices?.length) ek.push(o.choices.map((c) => c.name).join(' / '));
  return `› \`${o.name}\`${o.required ? ' **(zorunlu)**' : ''}: ${o.description} *(${ek.join(' · ')})*`;
}

// Komut adından Discord kimliğine: tıklanabilir komut bağlantıları için
async function kimlikler(client) {
  if (!client.komutKimlikleri) {
    const yuklu = await client.application.commands.fetch().catch(() => null);
    if (!yuklu) return new Map(); // Alınamazsa düz yazıya dönülür, bir sonraki sefer yeniden denenir
    client.komutKimlikleri = new Map(yuklu.map((k) => [k.name, k.id]));
  }
  return client.komutKimlikleri;
}

// Komut yüklüyse tıklanabilir bağlantı, değilse düz yazı
const baglayici = (kimlik) => (komut, alt) => {
  const tam = alt ? `${komut} ${alt}` : komut;
  return kimlik.has(komut) ? `</${tam}:${kimlik.get(komut)}>` : `\`/${tam}\``;
};

// Üyenin kullanabildiği komutlar, bölümlere ayrılmış halde
function bolumleriHazirla(interaction) {
  const komutlar = new Map(
    interaction.client.komutlar
      .filter((k) => !k.sahipKomutu && k.etkin?.() !== false) // Sahibe özel ve kapalı komutlar listelenmez
      .map((k) => k.data.toJSON())
      .filter((k) => !k.default_member_permissions || interaction.memberPermissions?.has(BigInt(k.default_member_permissions)))
      .map((k) => [k.name, k]),
  );
  const yerlesen = new Set(BOLUMLER.flatMap((b) => b.komutlar));
  const diger = { ...DIGER, komutlar: [...komutlar.keys()].filter((ad) => !yerlesen.has(ad)).sort((a, b) => a.localeCompare(b, 'tr')) };
  return [...BOLUMLER, diger]
    .map((b) => ({ ...b, komutlar: b.komutlar.map((ad) => komutlar.get(ad)).filter(Boolean) }))
    .filter((b) => b.komutlar.length);
}

function anaSayfa(interaction, bolumler) {
  const yetkili = bolumler.some((b) => b.id !== 'genel');
  return new EmbedBuilder()
    .setTitle(`${interaction.client.user.username} · Yardım`)
    .setColor(RENK)
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setDescription(
      [
        'Aşağıdaki menüden bir bölüm seç; o bölümdeki komutları gösteririm. Sonra ikinci menüden bir komut seçersen ' +
          'ne işe yaradığını, seçeneklerini ve örnek kullanımlarını ayrıntılı anlatırım.',
        'Bir komuta doğrudan bakmak için: `/yardim komut:ban`',
        ...bolumler.map((b) => `${b.simge} **${b.ad}**\n${b.ozet}`),
      ].join('\n\n'),
    )
    .setFooter({ text: yetkili ? 'Yalnızca senin kullanabildiğin komutlar listelenir.' : 'Yönetim komutları yalnızca yetkililere görünür.' });
}

function bolumSayfasi(bolum, kimlik) {
  const bag = baglayici(kimlik);
  const bloklar = bolum.komutlar.map((komut) => {
    const altlar = altKomutlar(komut).map((s) => s.tamAd);
    if (!altlar.length) return `${bag(komut.name)}\n${komut.description}`;
    const ilk = altlar.includes(bolum.ilkAdim?.[komut.name]) ? bolum.ilkAdim[komut.name] : altlar[0];
    const kalan = altlar.filter((ad) => ad !== ilk);
    return [
      `**/${komut.name}**`,
      komut.description,
      `Buradan başla: ${bag(komut.name, ilk)}`,
      kalan.length ? `Diğerleri: ${kalan.map((ad) => bag(komut.name, ad)).join(' · ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });
  return new EmbedBuilder()
    .setTitle(`${bolum.simge} ${bolum.ad}`)
    .setColor(RENK)
    .setDescription(bloklar.join('\n\n'))
    .setFooter({ text: 'Bir komutun ayrıntılı anlatımı için aşağıdaki ikinci menüden komutu seç.' });
}

// Bir komutun ayrıntılı sayfası: elle yazılmış anlatım (yardim-rehberi.js) ve komutun tanımından okunan
// alt komutlar ile seçenekler
function komutSayfasi(komut, kimlik) {
  const rehber = REHBER[komut.name] ?? {};
  const bag = baglayici(kimlik);
  const altlar = altKomutlar(komut);
  const embed = new EmbedBuilder()
    .setTitle(`/${komut.name}`)
    .setColor(RENK)
    .setDescription(kisalt([rehber.anlatim ?? komut.description, altlar.length ? null : `**Kullanım:** ${bag(komut.name)}`].filter(Boolean).join('\n\n'), 4096))
    .addFields({ name: '👤 Kim kullanabilir', value: kisalt(rehber.kim ?? yetkiMetni(komut.default_member_permissions), 1024) });

  if (altlar.length) {
    for (const alt of altlar) {
      const satirlar = [`${bag(komut.name, alt.tamAd)}: ${alt.description}`, ...(alt.options ?? []).map(secenekSatiri)];
      embed.addFields({ name: `▸ ${alt.tamAd}`, value: kisalt(satirlar.join('\n'), 1024) });
    }
  } else {
    const secenekler = (komut.options ?? []).map(secenekSatiri);
    embed.addFields({ name: '⚙️ Seçenekler', value: secenekler.length ? kisalt(secenekler.join('\n'), 1024) : 'Seçeneği yok; yazıp göndermen yeterli.' });
  }
  if (rehber.ornekler?.length) embed.addFields({ name: '💡 Örnekler', value: kisalt(rehber.ornekler.map((o) => `\`${o}\``).join('\n'), 1024) });
  if (rehber.notlar?.length) embed.addFields({ name: '📌 Bilmen gerekenler', value: kisalt(rehber.notlar.map((n) => `• ${n}`).join('\n'), 1024) });
  return embed.setFooter({ text: 'Komutu yazarken Discord seçenekleri adım adım sorar; zorunlu olmayanları boş bırakabilirsin.' });
}

const bolumMenusu = (bolumler, secili) =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('yardim-bolum')
      .setPlaceholder('Bir bölüm seç')
      .addOptions(
        { label: 'Ana sayfa', value: 'ana', emoji: '🏠', default: secili === 'ana' },
        ...bolumler.map((b) => ({ label: b.ad, description: kisalt(b.ozet, 100), value: b.id, emoji: b.simge, default: secili === b.id })),
      ),
  );

const komutMenusu = (bolum, secili) =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('yardim-komut')
      .setPlaceholder('Bir komutun ayrıntısına bak')
      .addOptions(
        bolum.komutlar.slice(0, 25).map((k) => ({ label: `/${k.name}`, description: kisalt(k.description, 100), value: k.name, default: k.name === secili })),
      ),
  );

// durum: { bolum: bölüm kimliği ya da 'ana', komut: komut adı ya da null }
function sayfa(interaction, bolumler, kimlik, durum) {
  const bolum = bolumler.find((b) => b.id === durum.bolum);
  const komut = bolum && durum.komut ? bolum.komutlar.find((k) => k.name === durum.komut) : null;
  const embed = komut ? komutSayfasi(komut, kimlik) : bolum ? bolumSayfasi(bolum, kimlik) : anaSayfa(interaction, bolumler);
  const satirlar = [bolumMenusu(bolumler, bolum ? bolum.id : 'ana')];
  if (bolum) satirlar.push(komutMenusu(bolum, komut?.name));
  return { embeds: [embed], components: satirlar };
}

// "/Ban" ya da "ban" yazılabilir; cevaba geri yazıldığı için yalnızca komut adında olabilecek harfler kalır
const komutAdi = (metin) => kucuk(metin ?? '').replace(/^\//, '').replace(/[^a-z0-9çğıöşü-]/g, '').slice(0, 32);

module.exports = {
  // Test için
  BOLUMLER,
  bolumleriHazirla,
  komutSayfasi,
  sayfa,

  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Komutları bölüm bölüm gösterir ve ne işe yaradıklarını anlatır')
    .addStringOption((o) => o.setName('komut').setDescription('Ayrıntısını görmek istediğin komut (ör. ban)').setAutocomplete(true)),

  // komut seçeneğine yazarken, üyenin kullanabildiği komutlardan eşleşenler önerilir; adı yazılanla başlayanlar önce
  async autocomplete(interaction) {
    const yazilan = kucuk(interaction.options.getFocused()).trim().replace(/^\//, '');
    const eslesen = bolumleriHazirla(interaction)
      .flatMap((b) => b.komutlar)
      .filter((k) => k.name.includes(yazilan) || kucuk(k.description).includes(yazilan))
      .sort((a, b) => Number(!a.name.startsWith(yazilan)) - Number(!b.name.startsWith(yazilan)))
      .slice(0, 25);
    await interaction.respond(eslesen.map((k) => ({ name: kisalt(`/${k.name} · ${k.description}`, 100), value: k.name })));
  },

  async execute(interaction) {
    const bolumler = bolumleriHazirla(interaction);
    const kimlik = await kimlikler(interaction.client);
    let durum = { bolum: 'ana', komut: null };
    let uyari = null;
    const istenen = komutAdi(interaction.options.getString('komut'));
    if (istenen) {
      const bolum = bolumler.find((b) => b.komutlar.some((k) => k.name === istenen));
      if (bolum) durum = { bolum: bolum.id, komut: istenen };
      else uyari = `❌ \`/${istenen}\` diye kullanabileceğin bir komut yok. Aşağıdaki menüden bölüm bölüm bakabilirsin.`;
    }

    await interaction.reply({ ...sayfa(interaction, bolumler, kimlik, durum), ...(uyari && { content: uyari }), flags: MessageFlags.Ephemeral });
    const mesaj = await interaction.fetchReply();
    const toplayici = mesaj.createMessageComponentCollector({ time: ACIK_KALMA });
    toplayici.on('collect', (secim) => {
      const deger = secim.values?.[0];
      if (secim.customId === 'yardim-bolum') durum = { bolum: bolumler.some((b) => b.id === deger) ? deger : 'ana', komut: null };
      else if (secim.customId === 'yardim-komut') durum = { ...durum, komut: deger };
      // content: null, varsa "böyle bir komut yok" uyarısını kaldırır
      secim.update({ ...sayfa(interaction, bolumler, kimlik, durum), content: null }).catch((hata) => console.error('Yardım sayfası gösterilemedi:', hata.message));
    });
    // Süre dolunca menü kaldırılır; çalışmayan bir menü kalmasın
    toplayici.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
