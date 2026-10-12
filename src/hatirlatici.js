const { oku, yaz } = require('./depo');

function kur(client, kayit) {
  const kalan = Math.max(kayit.zaman - Date.now(), 0);
  setTimeout(async () => {
    const kanal = await client.channels.fetch(kayit.kanalId).catch(() => null);
    if (kanal?.isTextBased()) {
      await kanal
        .send({
          content: `⏰ <@${kayit.kullaniciId}> hatırlatma: ${kayit.mesaj}`,
          // Mesajın içine @everyone yazılsa bile sadece ilgili kişi etiketlenir
          allowedMentions: { users: [kayit.kullaniciId] },
        })
        .catch(() => {});
    }
    yaz('hatirlaticilar', oku('hatirlaticilar', []).filter((h) => h.id !== kayit.id));
  }, kalan);
}

function ekle(client, kayit) {
  yaz('hatirlaticilar', [...oku('hatirlaticilar', []), kayit]);
  kur(client, kayit);
}

// Bot açıldığında, kapalıyken bekleyen hatırlatıcıları yeniden kurar.
function hepsiniYukle(client) {
  for (const kayit of oku('hatirlaticilar', [])) kur(client, kayit);
}

module.exports = { ekle, hepsiniYukle };
