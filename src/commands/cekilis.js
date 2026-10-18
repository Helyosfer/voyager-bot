const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js');
const { yazabilirMi, logGonder, sureMetni } = require('../yardimci');
const cekilis = require('../cekilis');

const mesajSecenegi = (o) => o.setName('mesaj').setDescription('Çekiliş mesajının bağlantısı ya da kimliği').setRequired(true).setMaxLength(200);

// "https://discord.com/channels/1/2/3" ya da "3" → "3". Bu sunucuya ait değilse null.
function cekilisBul(interaction) {
  const id = interaction.options.getString('mesaj', true).trim().match(/(\d{15,25})\/?$/)?.[1];
  const kayit = id ? cekilis.bul(id) : null;
  return kayit?.sunucuId === interaction.guildId ? kayit : null;
}

async function baslat(interaction) {
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const kanal = interaction.options.getChannel('kanal') ?? interaction.channel;
  const dakika = interaction.options.getInteger('dakika', true);
  const gerekenRol = interaction.options.getRole('gereken-rol');

  if (cekilis.suren(interaction.guildId).length >= cekilis.SUNUCU_BASI_SINIR) {
    return cevapla(`❌ Aynı anda en fazla ${cekilis.SUNUCU_BASI_SINIR} çekiliş sürebilir. Biri bitince yenisini başlatabilirsin.`);
  }
  if (gerekenRol?.id === interaction.guildId) return cevapla('❌ Herkes zaten @everyone rolünde; şart koymak istemiyorsan bu seçeneği boş bırak.');
  if (!kanal?.isTextBased() || !yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory])) {
    return cevapla(`❌ ${kanal ?? 'Bu kanal'} kanalına yazamıyorum. Bana Kanalı Gör, Mesaj Gönder, Bağlantı Yerleştir ve Mesaj Geçmişini Oku izinlerini ver.`);
  }

  const kayit = {
    sunucuId: interaction.guildId,
    kanalId: kanal.id,
    odul: interaction.options.getString('odul', true),
    kazananSayisi: interaction.options.getInteger('kazanan') ?? 1,
    bitis: Date.now() + dakika * 60_000,
    baslatanId: interaction.user.id,
    gerekenRol: gerekenRol?.id ?? null,
    katilanlar: [],
    bitti: false,
    kazananlar: [],
  };
  const mesaj = await kanal.send(cekilis.kart(kayit));
  cekilis.ekle(interaction.client, { id: mesaj.id, ...kayit });

  await cevapla(`✅ Çekiliş başladı: ${mesaj.url}\nErken bitirmek için \`/cekilis bitir\`, iptal etmek için \`/cekilis iptal\`.`);
  await logGonder(interaction.guild, {
    baslik: 'Çekiliş başladı',
    renk: 0xeb459e,
    yetkili: interaction.user,
    ek: [
      { name: 'Ödül', value: kayit.odul },
      { name: 'Süre', value: sureMetni(dakika), inline: true },
      { name: 'Kazanan', value: String(kayit.kazananSayisi), inline: true },
      { name: 'Kanal', value: `${kanal} · [mesaja git](${mesaj.url})` },
    ],
  });
}

async function bitir(interaction) {
  const kayit = cekilisBul(interaction);
  if (!kayit) return interaction.reply({ content: '❌ Bu sunucuda böyle bir çekiliş yok.', flags: MessageFlags.Ephemeral });
  if (kayit.bitti) return interaction.reply({ content: '❌ Bu çekiliş zaten bitti. Yeniden çekmek için `/cekilis yeniden`.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const son = await cekilis.bitir(interaction.client, kayit.id);
  await interaction.editReply(son ? `✅ Çekiliş bitirildi; ${son.kazananlar.length} kazanan duyuruldu.` : '❌ Çekiliş az önce bitti.');
}

async function yeniden(interaction) {
  const kayit = cekilisBul(interaction);
  if (!kayit) return interaction.reply({ content: '❌ Bu sunucuda böyle bir çekiliş yok (biten çekilişler 7 gün saklanır).', flags: MessageFlags.Ephemeral });
  if (!kayit.bitti) return interaction.reply({ content: '❌ Çekiliş henüz bitmedi.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const yeni = await cekilis.yenidenCek(interaction.client, kayit.id, interaction.options.getInteger('kazanan') ?? 1);
  await interaction.editReply(yeni?.length ? `✅ ${yeni.length} yeni kazanan duyuruldu.` : '❌ Seçilebilecek başka katılımcı kalmadı.');
}

async function iptal(interaction) {
  const kayit = cekilisBul(interaction);
  if (!kayit) return interaction.reply({ content: '❌ Bu sunucuda böyle bir çekiliş yok.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await cekilis.iptal(interaction.client, kayit.id);
  await interaction.editReply('✅ Çekiliş iptal edildi; kimse seçilmedi.');
  await logGonder(interaction.guild, { baslik: 'Çekiliş iptal edildi', renk: 0x99aab5, yetkili: interaction.user, ek: { name: 'Ödül', value: kayit.odul } });
}

const ALT_KOMUTLAR = { baslat, bitir, yeniden, iptal };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Düğmeyle katılınan çekiliş başlatır; süre dolunca kazananları seçip duyurur')
    .addSubcommand((s) =>
      s
        .setName('baslat')
        .setDescription('Yeni bir çekiliş başlatır')
        .addStringOption((o) => o.setName('odul').setDescription('Ne çekilecek?').setRequired(true).setMaxLength(200))
        .addIntegerOption((o) =>
          o.setName('dakika').setDescription(`Kaç dakika sürsün? (en fazla ${cekilis.EN_UZUN} = 14 gün)`).setRequired(true).setMinValue(1).setMaxValue(cekilis.EN_UZUN),
        )
        .addIntegerOption((o) => o.setName('kazanan').setDescription('Kaç kişi kazansın? (varsayılan 1)').setMinValue(1).setMaxValue(20))
        .addRoleOption((o) => o.setName('gereken-rol').setDescription('Yalnızca bu roldekiler katılabilsin'))
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Çekilişin yapılacağı kanal (varsayılan: bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((s) => s.setName('bitir').setDescription('Çekilişi süresi dolmadan bitirir ve kazananları seçer').addStringOption(mesajSecenegi))
    .addSubcommand((s) =>
      s
        .setName('yeniden')
        .setDescription('Biten çekilişte, daha önce kazanmamışlar arasından yeniden seçer')
        .addStringOption(mesajSecenegi)
        .addIntegerOption((o) => o.setName('kazanan').setDescription('Kaç kişi seçilsin? (varsayılan 1)').setMinValue(1).setMaxValue(20)),
    )
    .addSubcommand((s) => s.setName('iptal').setDescription('Çekilişi kimseyi seçmeden iptal eder').addStringOption(mesajSecenegi))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  execute(interaction) {
    return ALT_KOMUTLAR[interaction.options.getSubcommand()](interaction);
  },
};
