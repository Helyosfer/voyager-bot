// /yardim panelinden komut çalıştırma: üye komutu yazmaz; menüden işlemi seçer, gerekiyorsa açılan
// formu doldurur. Form, komutun kendi seçeneklerinden kurulur (kullanıcı, rol ve kanal için seçim
// kutusu; seçimli seçenekler için liste; metin ve sayı için yazı kutusu). Formdaki değerlerle komutun
// kendi execute'u çağrılır; böylece yazarak ve panelden kullanmak birebir aynı işi yapar, aynı
// denetimlerden geçer.
const {
  ApplicationCommandOptionType: T,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ComponentType,
  MessageFlags,
} = require('discord.js');
const { komutYetkisiVar, hataMetni } = require('./yardimci');

// Discord bir formda en fazla 5 alan kabul eder
const FORM_SINIRI = 5;
const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);

// Panelden çalıştırılamayan komutlar: /yardim panelin kendisi
const PANEL_DISI = new Set(['yardim']);

// Komut bu üye için panelden çalıştırılabilir mi? Discord'un "komutu kim kullanabilir" denetimi
// yalnızca komut yazılınca yapılır; panelde bu denetimi bot yapar. Sunucu yöneticilerinin
// Entegrasyonlar bölümünden verdiği ek izinler burada geçmez: komutun bildirdiği yetki şarttır.
function calistirilabilir(interaction, komut) {
  return Boolean(
    komut &&
      interaction.guildId &&
      !komut.sahipKomutu &&
      !PANEL_DISI.has(komut.data.name) &&
      komut.etkin?.() !== false &&
      komutYetkisiVar(interaction, komut),
  );
}

// Komutun (ya da alt komutun) seçenekleri. altAd: "alt" ya da "grup alt"; alt komutsuz komutta null.
// Komutta böyle bir alt komut yoksa null döner.
function hedefBul(veri, altAd) {
  const ust = veri.options ?? [];
  const altli = ust.some((o) => o.type === T.Subcommand || o.type === T.SubcommandGroup);
  if (!altli) return altAd ? null : { grup: null, alt: null, secenekler: ust };
  if (!altAd) return null;
  const [a, b] = altAd.split(' ');
  if (b) {
    const alt = ust.find((o) => o.type === T.SubcommandGroup && o.name === a)?.options?.find((o) => o.name === b);
    return alt ? { grup: a, alt: b, secenekler: alt.options ?? [] } : null;
  }
  const alt = ust.find((o) => o.type === T.Subcommand && o.name === a);
  return alt ? { grup: null, alt: a, secenekler: alt.options ?? [] } : null;
}

// Açıklaması form etiketine (45 karakter) sığmayan seçeneklerin okunur adları. Burada olmayanın adı
// yalnızca ilk harfi büyütülerek yazılır.
const SECENEK_ADLARI = {
  kisaltici: 'Kısaltılmış bağlantılar',
  everyone: '@everyone etiketi',
  test: 'Deneme bildirimi',
  'tek-secim': 'Tek seçim',
};
const okunurAd = (ad) => SECENEK_ADLARI[ad] ?? `${ad[0].toLocaleUpperCase('tr')}${ad.slice(1).replace(/-/g, ' ')}`;

// Seçenekleri form alanlarına çevirir. rol1, rol2 … rol10 gibi sıralı aynı türden seçenekler tek bir
// çoklu seçim alanında toplanır (Discord formu 5 alanla sınırlı).
function alanlariHazirla(secenekler) {
  const alanlar = [];
  for (let i = 0; i < secenekler.length; i++) {
    const o = secenekler[i];
    const sirali = /^(.+?)1$/.exec(o.name);
    const grup = [o];
    if (sirali && [T.User, T.Role, T.Channel, T.Mentionable].includes(o.type)) {
      while (secenekler[i + 1]?.type === o.type && secenekler[i + 1].name === `${sirali[1]}${grup.length + 1}`) grup.push(secenekler[++i]);
    }
    const coklu = grup.length > 1;
    const aciklama = coklu ? `${o.description} · en fazla ${grup.length}` : o.description;
    // Etiket en fazla 45 karakter: açıklama sığıyorsa o; sığmıyorsa parantezden önceki kısmı, o da
    // sığmıyorsa seçeneğin adı. Kısaltılan açıklamanın tamamı etiketin altına yazılır.
    const parantezsiz = aciklama.split(' (')[0];
    const etiket = aciklama.length <= 45 ? aciklama : parantezsiz.length <= 45 ? parantezsiz : okunurAd(coklu ? sirali[1] : o.name);
    alanlar.push({
      secenekler: grup,
      tur: o.type,
      zorunlu: Boolean(o.required),
      etiket,
      aciklama: etiket === aciklama ? null : kisalt(aciklama, 100),
    });
  }
  return alanlar;
}

// Seçenek önerilerini (ör. takip edilen yayıncılar) komutun kendi autocomplete'inden alır; formda
// yazı kutusu yerine listeden seçilir. Öneri yoksa ya da liste dolu (daha fazlası olabilir) ise null.
async function oneriler(interaction, komut, hedef, secenek) {
  if (!secenek.autocomplete || !komut.autocomplete) return null;
  let liste = null;
  const sahte = komutEtkilesimi(interaction, komut.data.name, secenekCozucu(hedef, new Map(), secenek.name), {
    respond: async (gelen) => {
      liste = gelen;
    },
  });
  await Promise.resolve(komut.autocomplete(sahte)).catch((hata) => console.error(`/${komut.data.name} önerileri (panel):`, hataMetni(hata)));
  return liste?.length && liste.length < 25 ? liste : null;
}

const secenekListesi = (liste) => liste.slice(0, 25).map((s) => ({ label: kisalt(String(s.name), 100), value: String(s.value).slice(0, 100) }));

// Bir form alanının içindeki bileşen. Hangi bileşenin kullanıldığı alan.bilesen'e yazılır (okurken gerekir).
function bilesenKur(alan, id, oneri) {
  const o = alan.secenekler[0];
  const adet = alan.secenekler.length;
  const secim = (b) => b.setCustomId(id).setRequired(alan.zorunlu).setMinValues(alan.zorunlu ? 1 : 0).setMaxValues(adet);
  if (o.type === T.User) return ['kullanici', 'setUserSelectMenuComponent', secim(new UserSelectMenuBuilder())];
  if (o.type === T.Role) return ['rol', 'setRoleSelectMenuComponent', secim(new RoleSelectMenuBuilder())];
  if (o.type === T.Mentionable) return ['etiket', 'setMentionableSelectMenuComponent', secim(new MentionableSelectMenuBuilder())];
  if (o.type === T.Channel) {
    const kanal = secim(new ChannelSelectMenuBuilder());
    if (o.channel_types?.length) kanal.setChannelTypes(...o.channel_types);
    return ['kanal', 'setChannelSelectMenuComponent', kanal];
  }
  const liste =
    o.type === T.Boolean
      ? [
          { label: 'Evet', value: 'evet' },
          { label: 'Hayır', value: 'hayir' },
        ]
      : o.choices?.length
        ? secenekListesi(o.choices)
        : oneri
          ? secenekListesi(oneri)
          : null;
  if (liste) {
    const menu = new StringSelectMenuBuilder().setCustomId(id).setRequired(alan.zorunlu).setMinValues(alan.zorunlu ? 1 : 0).setMaxValues(1).addOptions(liste);
    return ['liste', 'setStringSelectMenuComponent', menu];
  }

  const yazi = new TextInputBuilder()
    .setCustomId(id)
    .setRequired(alan.zorunlu)
    .setStyle((o.max_length ?? 100) > 200 ? TextInputStyle.Paragraph : TextInputStyle.Short);
  if (o.type === T.Integer || o.type === T.Number) {
    yazi.setMaxLength(20);
    const aralik = o.min_value != null && o.max_value != null ? `${o.min_value}-${o.max_value} arası` : o.max_value != null ? `en fazla ${o.max_value}` : o.min_value != null ? `en az ${o.min_value}` : null;
    yazi.setPlaceholder(['Sayı', aralik].filter(Boolean).join(', '));
  } else {
    yazi.setMaxLength(Math.min(o.max_length ?? 4000, 4000));
    if (o.min_length) yazi.setMinLength(o.min_length);
  }
  return ['yazi', 'setTextInputComponent', yazi];
}

// İşlemin formu. alanlar: alanlariHazirla'nın çıktısı (en fazla 5). Dönen form alanları da günceller.
async function formKur({ interaction, komut, hedef, alanlar, customId, baslik }) {
  const form = new ModalBuilder().setCustomId(customId).setTitle(kisalt(baslik, 45));
  for (const [i, alan] of alanlar.entries()) {
    const oneri = await oneriler(interaction, komut, hedef, alan.secenekler[0]);
    const [bilesen, ekle, ogesi] = bilesenKur(alan, `a${i}`, oneri);
    alan.bilesen = bilesen;
    const etiket = new LabelBuilder().setLabel(kisalt(alan.etiket, 45));
    if (alan.aciklama) etiket.setDescription(alan.aciklama);
    form.addLabelComponents(etiket[ekle](ogesi));
  }
  return form;
}

// Formdaki bileşenin türü → formuOku'nun kullandığı ad. Form başka bir tıklamada kurulduysa
// (ör. /ayarlar kartı, moderasyon kartı) hangi bileşenin kullanıldığı gönderilen formdan okunur.
const BILESEN_TURLERI = {
  [ComponentType.TextInput]: 'yazi',
  [ComponentType.StringSelect]: 'liste',
  [ComponentType.UserSelect]: 'kullanici',
  [ComponentType.RoleSelect]: 'rol',
  [ComponentType.MentionableSelect]: 'etiket',
  [ComponentType.ChannelSelect]: 'kanal',
};

// Gönderilen formu okur. degerler: seçenek adı → komutun beklediği değer (User, Role, kanal, sayı…)
function formuOku(gonderim, alanlar) {
  const degerler = new Map();
  const hatalar = [];
  for (const [i, alan] of alanlar.entries()) {
    const id = `a${i}`;
    const o = alan.secenekler[0];
    const alanVerisi = gonderim.fields.fields.get(id);
    if (!alanVerisi) continue;
    const bilesen = alan.bilesen ?? BILESEN_TURLERI[alanVerisi.type];
    if (bilesen === 'yazi') {
      const metin = (alanVerisi.value ?? '').trim();
      if (!metin) continue;
      if (o.type === T.Integer || o.type === T.Number) {
        const sayi = o.type === T.Integer ? (/^-?\d+$/.test(metin) ? Number(metin) : NaN) : Number(metin.replace(',', '.'));
        if (!Number.isFinite(sayi) || (o.min_value != null && sayi < o.min_value) || (o.max_value != null && sayi > o.max_value)) {
          const aralik = o.min_value != null && o.max_value != null ? `${o.min_value} ile ${o.max_value} arasında ` : '';
          hatalar.push(`**${alan.etiket}**: ${aralik}${o.type === T.Integer ? 'bir tam sayı' : 'bir sayı'} yaz.`);
          continue;
        }
        degerler.set(o.name, sayi);
      } else {
        degerler.set(o.name, metin);
      }
    } else if (bilesen === 'liste') {
      const secilen = alanVerisi.values?.[0];
      if (secilen == null) continue;
      if (o.type === T.Boolean) degerler.set(o.name, secilen === 'evet');
      else if (o.type === T.Integer || o.type === T.Number) degerler.set(o.name, Number(secilen));
      else degerler.set(o.name, secilen);
    } else {
      // Seçim sırası korunur (ör. rol menüsündeki rollerin sırası)
      const kaynak = { kullanici: alanVerisi.users, rol: alanVerisi.roles, kanal: alanVerisi.channels }[bilesen];
      const secilenler = (alanVerisi.values ?? [])
        .map((deger) => (bilesen === 'etiket' ? (alanVerisi.users?.get(deger) ?? alanVerisi.roles?.get(deger)) : kaynak?.get(deger)))
        .filter(Boolean);
      alan.secenekler.forEach((s, sira) => secilenler[sira] && degerler.set(s.name, secilenler[sira]));
    }
    if (alan.zorunlu && !alan.secenekler.some((s) => degerler.has(s.name))) hatalar.push(`**${alan.etiket}** boş bırakılamaz.`);
  }
  return { degerler, hatalar };
}

// interaction.options yerine geçen nesne: komut seçeneklerini formdan gelen değerlerden okur
function secenekCozucu(hedef, degerler, odak = null) {
  const al = (ad, zorunlu = false) => {
    const deger = degerler.get(ad) ?? null;
    if (deger === null && zorunlu) throw new Error(`Zorunlu seçenek eksik: ${ad}`);
    return deger;
  };
  return {
    getSubcommand: (zorunlu = true) => {
      if (!hedef.alt && zorunlu) throw new Error('Alt komut yok');
      return hedef.alt ?? null;
    },
    getSubcommandGroup: () => hedef.grup ?? null,
    getString: al,
    getInteger: al,
    getNumber: al,
    getBoolean: al,
    getUser: al,
    getRole: al,
    getChannel: al,
    getMentionable: al,
    getAttachment: () => null,
    getFocused: (tam = false) => (tam ? { name: odak, value: '' } : ''),
  };
}

// Düğme ya da form etkileşimini, komutun beklediği eğik çizgi komutu gibi gösterir. Cevaplama
// (reply, deferReply, editReply…) asıl etkileşim üzerinden yapılır.
function komutEtkilesimi(asil, komutAdi, secenekler, ek = {}) {
  const ozel = {
    options: secenekler,
    commandName: komutAdi,
    isChatInputCommand: () => true,
    isCommand: () => true,
    ...ek,
  };
  return new Proxy(asil, {
    get(hedef, ad) {
      if (Object.hasOwn(ozel, ad)) return ozel[ad];
      const deger = Reflect.get(hedef, ad, hedef);
      return typeof deger === 'function' ? deger.bind(hedef) : deger;
    },
  });
}

// Komutun cevabını yeni bir mesaj olarak değil, düğmenin bulunduğu kartın içinde gösterir (ör. /ayarlar).
// ciz(): kartın güncel hali; komut ayarı değiştirdikten sonra çağrılır, böylece kart yeni durumu gösterir.
// Komutun yazdığı metin kartın üstüne gelir. embedler: komutun kartları da gösterilsin mi (ör. kilit sonucu);
// gösterilmezse yalnızca metin alınır (çoğu ayar komutu ayrıca ayar kartı da döndürür, kartta zaten görünür).
function kartIcinde(asil, ciz, { embedler = false } = {}) {
  let cevaplandi = false;
  const icerik = (m) => {
    const mesaj = typeof m === 'string' ? { content: m } : (m ?? {});
    const kart = ciz();
    return {
      ...kart,
      content: mesaj.content || kart.content || null,
      embeds: [...(embedler ? (mesaj.embeds ?? []) : []), ...kart.embeds].slice(0, 10),
      allowedMentions: { parse: [] },
    };
  };
  const yaz = (m) => {
    if (cevaplandi) return asil.editReply(icerik(m));
    cevaplandi = true;
    return asil.update(icerik(m));
  };
  return {
    reply: yaz,
    editReply: yaz,
    deferReply: async () => {
      if (cevaplandi) return;
      cevaplandi = true;
      await asil.deferUpdate();
    },
    // İkinci bir cevap (ör. uyarı notu) ayrı, yalnızca kullanana görünen mesaj olarak gelir
    followUp: (m) => asil.followUp({ ...(typeof m === 'string' ? { content: m } : m), flags: MessageFlags.Ephemeral }),
  };
}

// Komutu panelden çalıştırır. Yetki her seferinde, bu etkileşimdeki güncel izinlerle yeniden denetlenir.
// ek: etkileşimin yerine geçecek alanlar (ör. kartIcinde'nin cevaplama işlevleri)
async function calistir(interaction, komut, hedef, degerler = new Map(), ek = {}) {
  if (!calistirilabilir(interaction, komut)) {
    return interaction.reply({ content: '❌ Bu komutu kullanmak için gereken yetkin yok.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  try {
    await komut.execute(komutEtkilesimi(interaction, komut.data.name, secenekCozucu(hedef, degerler), ek));
  } catch (hata) {
    console.error(`/${komut.data.name} hatası (panel):`, hataMetni(hata));
    const cevap = { content: 'Komut çalışırken bir hata oluştu.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(cevap).catch(() => {});
    else await interaction.reply(cevap).catch(() => {});
  }
}

module.exports = { FORM_SINIRI, calistirilabilir, hedefBul, alanlariHazirla, formKur, formuOku, secenekCozucu, komutEtkilesimi, kartIcinde, calistir };
