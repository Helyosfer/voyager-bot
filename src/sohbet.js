// /sor cevabına Discord'da "Yanıtla" ile yazan kişi konuşmayı sürdürür: bot yanıt zincirini
// geriye doğru izleyip önceki soru ve cevapları modele bağlam olarak gönderir, cevabı da yanıt
// olarak yazar. Bu cevap da yanıtlanabilir.
//
// Her yanıt kişinin /sor hakkından bir tane kullanır; sınırlar /sor ile ortaktır (bkz. yapayzeka.js).
// Mesaj içeriğini okumak için "Message Content" izni gerekir (MESAJ_ICERIGI=1). İzin yoksa Discord
// yalnızca botu etiketleyen mesajların içeriğini verir: yanıtlarken etiket açık bırakılmışsa çalışır.
const { Events, MessageFlags, PermissionFlagsBits } = require('discord.js');
const yapayzeka = require('./yapayzeka');
const koruma = require('./koruma');
const { yazabilirMi, hataMetni } = require('./yardimci');

// Geriye doğru en fazla bu kadar mesaj izlenir (soru ve cevaplar birlikte)
const ZINCIR_SINIRI = 10;

// Mesaj botun yazdığı bir /sor cevabı mı? Dipnotu model yazamaz (bkz. yapayzeka.basliklariKir).
const sorCevabiMi = (mesaj, botId) => mesaj.author?.id === botId && (mesaj.content ?? '').split('\n').at(-1).startsWith(yapayzeka.DIPNOT);

// Botun cevap mesajını parçalarına ayırır: /sor'un ilk cevabının başında sorunun alıntısı, en altta dipnot durur.
// soru: alıntı varsa soru (konuşmanın başı), yoksa null
function cevabiAyir(icerik) {
  const satirlar = icerik.split('\n');
  satirlar.pop(); // Dipnot atılır
  const alinti = /^> \*\*(.*)\*\*$/.exec(satirlar[0] ?? '');
  if (alinti) satirlar.shift();
  return { soru: alinti ? alinti[1] : null, cevap: satirlar.join('\n').trim() };
}

// Yanıt zincirini geriye doğru izler; eskiden yeniye [{ rol, metin }] döndürür
async function gecmisiTopla(mesaj, botId) {
  const gecmis = [];
  let simdiki = mesaj;
  for (let i = 0; i < ZINCIR_SINIRI && simdiki.reference?.messageId; i++) {
    const onceki = await simdiki.fetchReference().catch(() => null);
    if (!onceki) break;
    if (onceki.author?.id === botId) {
      if (!sorCevabiMi(onceki, botId)) break;
      const { soru, cevap } = cevabiAyir(onceki.content);
      gecmis.unshift({ rol: 'model', metin: cevap });
      if (soru !== null) {
        gecmis.unshift({ rol: 'user', metin: soru });
        break;
      }
    } else {
      if (onceki.author?.bot || onceki.webhookId) break;
      gecmis.unshift({ rol: 'user', metin: onceki.content });
    }
    simdiki = onceki;
  }
  return gecmis;
}

async function mesajGeldi(mesaj) {
  if (!mesaj.guild || mesaj.author?.bot || mesaj.webhookId || mesaj.system || !mesaj.reference?.messageId) return;
  if (!yapayzeka.hazir()) return;
  const botId = mesaj.client.user.id;
  // Discord yanıtlanan mesajın yazarını mesajla birlikte verir; böylece bota yazılmayan yanıtlar için istek atılmaz
  if (mesaj.mentions?.repliedUser?.id !== botId) return;
  // Otomatik korumanın silmek üzere yakaladığı mesaj cevaplanmaz
  if (koruma.yakalandi(mesaj)) return;
  const soru = (mesaj.content ?? '').trim();
  if (!soru) return; // İçerik okunamıyor (izin yok) ya da mesajda yalnızca ek var
  const kanal = mesaj.channel;
  if (!yazabilirMi(kanal, [PermissionFlagsBits.ReadMessageHistory, ...(kanal.isThread?.() ? [PermissionFlagsBits.SendMessagesInThreads] : [])])) return;

  const hedef = await mesaj.fetchReference().catch(() => null);
  if (!hedef || !sorCevabiMi(hedef, botId)) return;

  kanal.sendTyping?.().catch(() => {});
  const gecmis = await gecmisiTopla(mesaj, botId);
  const sonuc = await yapayzeka.sor(mesaj.guild.id, mesaj.author.id, soru, { gecmis });
  // Modelin yazdığı hiçbir şey kimseyi etiketleyemez; yanıtlanan kişiye de bildirim gitmez
  const gonder = { allowedMentions: { parse: [], repliedUser: false } };
  if (sonuc.hata) return mesaj.reply({ ...gonder, content: sonuc.hata }).catch(() => {});
  return mesaj
    .reply({ ...gonder, content: `${sonuc.cevap}\n${yapayzeka.dipnot(sonuc.kalan)}`, flags: MessageFlags.SuppressEmbeds })
    .catch((hata) => console.error('/sor yanıtı gönderilemedi:', hataMetni(hata)));
}

function baslat(client) {
  client.on(Events.MessageCreate, (mesaj) => {
    // Bir tur sonra bakılır: otomatik koruma aynı olaydaki mesaj hakkında kararını o ana kadar vermiş olur (bkz. seviye.js)
    setImmediate(() => mesajGeldi(mesaj).catch((hata) => console.error('/sor yanıtı hatası:', hataMetni(hata))));
  });
}

module.exports = { baslat, mesajGeldi, gecmisiTopla, cevabiAyir, sorCevabiMi };
