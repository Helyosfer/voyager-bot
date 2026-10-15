#!/usr/bin/env bash
# Botu uzaktan güncellemek için VPS'te kısıtlı bir kullanıcı kurar.
# Bu kullanıcı yalnızca SSH anahtarıyla girer ve root olarak tek bir şey
# çalıştırabilir: /usr/local/sbin/voyager-guncelle
# Kullanım: sudo bash erisim-kur.sh <açık-anahtar-dosyası.pub>
set -euo pipefail

KULLANICI=voyager-deploy
ANAHTAR="${1:-}"

if [[ $EUID -ne 0 ]]; then
  echo "Bu betik sudo ile çalıştırılmalı."
  exit 1
fi
if [[ ! -d /opt/voyager || ! -f /opt/voyager/.env ]]; then
  echo "/opt/voyager kurulu değil. Önce kur.sh ile botu kur."
  exit 1
fi
# Güncelleme betiği kur.sh'ın kurduğu düzene dayanır: kod root'a ait; komut yükleyici ve bağımlılık
# kurulumu kısıtlı systemd birimleri
if [[ "$(stat -c %u:%g /opt/voyager)" != 0:0 || ! -f /etc/systemd/system/voyager-komutlar.service       || ! -f /etc/systemd/system/voyager-bagimliliklar.service ]]; then
  echo "/opt/voyager eski düzende kurulu. Önce kur.sh'ın son sürümünü çalıştır: sudo bash kur.sh"
  exit 1
fi
if [[ ! -f "$ANAHTAR" ]]; then
  echo "Kullanım: sudo bash erisim-kur.sh <açık-anahtar-dosyası.pub>"
  exit 1
fi
if grep -q 'PRIVATE KEY' "$ANAHTAR"; then
  echo "Bu ÖZEL anahtar. Sunucuya .pub uzantılı AÇIK anahtar gönderilmeli; özel anahtarı sunucudan sil."
  exit 1
fi
if ! ssh-keygen -l -f "$ANAHTAR" >/dev/null 2>&1; then
  echo "$ANAHTAR geçerli bir SSH açık anahtarı değil."
  exit 1
fi

if ! id "$KULLANICI" &>/dev/null; then
  adduser --disabled-password --gecos "" "$KULLANICI"
fi
# Bot kayıtlarını sudo'suz okuyabilsin
usermod -aG systemd-journal "$KULLANICI"

EV="$(getent passwd "$KULLANICI" | cut -d: -f6)"
install -d -m 700 -o "$KULLANICI" -g "$KULLANICI" "$EV/.ssh"
install -m 600 -o "$KULLANICI" -g "$KULLANICI" "$ANAHTAR" "$EV/.ssh/authorized_keys"
install -d -o "$KULLANICI" -g "$KULLANICI" "$EV/voyager"

# Güncelleme betiği root'a aittir; deploy kullanıcısı içeriğini değiştiremez.
cat > /usr/local/sbin/voyager-guncelle <<'EOF'
#!/usr/bin/env bash
# voyager-deploy kullanıcısının gönderdiği kodu /opt/voyager'a alır ve botu yeniden başlatır.
# Gönderilen hiçbir şey root olarak çalıştırılmaz ya da npm'e root olarak verilmez; root yalnızca
# dosyaları taşır ve sahipliklerini düzeltir.
set -euo pipefail

KAYNAK=/home/voyager-deploy/voyager
HEDEF=/opt/voyager
ARA="$HEDEF/.bagimliliklar"

# Aynı anda iki güncelleme (ya da kur.sh) aynı dosyalara dokunmasın
exec 9>/run/voyager-guncelle.kilit
if ! flock -n 9; then
  echo "Başka bir güncelleme sürüyor."
  exit 1
fi

# Kod klasörü root'a ait olmalı; bot ve deploy kullanıcıları içine dosya ya da sembolik bağ koyamaz.
# Eski kurulumlarda klasör bot kullanıcısınındı: kur.sh'ın son sürümü bunu düzeltir.
if [[ -L "$HEDEF" || "$(stat -c %u:%g "$HEDEF")" != 0:0 \
      || ! -f /etc/systemd/system/voyager-komutlar.service \
      || ! -f /etc/systemd/system/voyager-bagimliliklar.service ]]; then
  echo "$HEDEF eski düzende kurulu. Sunucuda önce kur.sh'ın son sürümü çalıştırılmalı: sudo bash kur.sh"
  exit 1
fi
# Root aşağıda bu yollara yazar ya da onları okur; hiçbiri sembolik bağ olmamalı
for YOL in src package.json package-lock.json node_modules; do
  if [[ -L "$HEDEF/$YOL" ]]; then
    echo "$HEDEF/$YOL sembolik bağ; güncelleme durduruldu. Sunucunun incelenmesi gerekiyor."
    exit 1
  fi
done

if [[ ! -d "$KAYNAK/src" || ! -f "$KAYNAK/package.json" || ! -f "$KAYNAK/package-lock.json" ]]; then
  echo "$KAYNAK içinde src/, package.json veya package-lock.json yok."
  exit 1
fi

# Gönderilenler önce yalnızca root'un girebildiği geçici klasöre alınır ve orada denetlenir; kaynak klasör
# deploy kullanıcısının elinde olduğu için doğrudan güvenilmez. Geçici klasör hedefle aynı dosya sisteminde
# durur: her şey yerine "mv" (rename) ile tek adımda geçer. rename hedefteki bir sembolik bağı izlemez,
# bağın kendisinin yerine geçer; "cp" ise hedefteki bağı izleyip bağın gösterdiği dosyaya yazar.
GECICI="$(mktemp -d "$HEDEF/.guncelleme.XXXXXX")"
trap 'rm -rf "$GECICI" "$ARA"' EXIT
mkdir "$GECICI/kod"
cp -rP "$KAYNAK/src" "$KAYNAK/package.json" "$KAYNAK/package-lock.json" "$GECICI/kod/"
if [[ -n "$(find "$GECICI/kod" -mindepth 1 ! -type f ! -type d -print -quit)" ]]; then
  echo "Gönderilen dosyalar arasında sembolik bağ veya özel dosya var, reddedildi."
  exit 1
fi
# Kod root'a ait kalır, bot kullanıcısı yalnızca okur
chmod -R u=rwX,go=rX "$GECICI/kod"

# Bağımlılıklar yalnızca kilit dosyası değiştiyse (ya da node_modules eski düzende bot kullanıcısına
# aitse) yeniden kurulur. Kurulumu kur.sh'ın tanımladığı voyager-bagimliliklar birimi yapar: bot
# kullanıcısıyla, servisle aynı kısıtlamalar altında, yalnızca ara klasöre yazarak. Sonra kurulanlar
# root'a alınır; bot kullanıcısı yalnızca okur.
OZET="$(sha256sum "$GECICI/kod/package-lock.json" | cut -d' ' -f1)"
KUR=1
if [[ -d "$HEDEF/node_modules" && "$(stat -c %u "$HEDEF/node_modules")" == 0 \
      && -f "$HEDEF/node_modules/.kilit-ozeti" && ! -L "$HEDEF/node_modules/.kilit-ozeti" ]]; then
  if [[ "$(cat "$HEDEF/node_modules/.kilit-ozeti")" == "$OZET" ]]; then
    KUR=0
  fi
fi

# Tek seferlik bir birimi çalıştırır ve bu çalışmanın kayıtlarını gösterir
birimi_calistir() {
  local durum=0
  systemctl start "$1" || durum=$?
  journalctl --sync 2>/dev/null || true
  journalctl --no-pager -o cat _SYSTEMD_INVOCATION_ID="$(systemctl show -p InvocationID --value "$1")" || true
  return "$durum"
}

if (( KUR )); then
  rm -rf "$ARA"
  install -d -m 700 -o voyager -g voyager "$ARA"
  install -m 644 "$GECICI/kod/package.json" "$GECICI/kod/package-lock.json" "$ARA/"
  if ! birimi_calistir voyager-bagimliliklar.service; then
    echo "Bağımlılıklar kurulamadı; hiçbir şey değiştirilmedi."
    exit 1
  fi
  # Birim bittiği için bot kullanıcısının bu klasörde çalışan süreci kalmadı; önce klasörün kendisi
  # root'a alınır ki içindekiler artık değiştirilemesin
  chown root:root "$ARA"
  chmod 700 "$ARA"
  if [[ -L "$ARA/node_modules" || ! -d "$ARA/node_modules" ]]; then
    echo "Bağımlılık kurulumu node_modules klasörü üretmedi."
    exit 1
  fi
  chown -hR root:root "$ARA/node_modules"
  if [[ -n "$(find "$ARA/node_modules" ! -type f ! -type d ! -type l -print -quit)" ]]; then
    echo "Kurulan bağımlılıklar arasında özel dosya var, reddedildi."
    exit 1
  fi
  # npm paket arşivindeki izin bitlerini korur; setuid gibi bitler ve başkalarına yazma izni kalmasın
  chmod -R u-s,g-s,go-w,go+rX "$ARA/node_modules"
  rm -f "$ARA/node_modules/.kilit-ozeti"
  echo "$OZET" > "$ARA/node_modules/.kilit-ozeti"
fi

# Yerine taşı. Klasör dolu bir klasörün üzerine taşınamaz: eskisi geçici klasöre alınır, çıkışta silinir.
mv -fT "$GECICI/kod/package.json" "$HEDEF/package.json"
mv -fT "$GECICI/kod/package-lock.json" "$HEDEF/package-lock.json"
if [[ -e "$HEDEF/src" ]]; then
  mv -T "$HEDEF/src" "$GECICI/eski-src"
fi
mv -T "$GECICI/kod/src" "$HEDEF/src"
if (( KUR )); then
  if [[ -e "$HEDEF/node_modules" ]]; then
    mv -T "$HEDEF/node_modules" "$GECICI/eski-node_modules"
  fi
  mv -T "$ARA/node_modules" "$HEDEF/node_modules"
fi

# Gönderilen kod root ya da kısıtsız bir kullanıcı olarak çalıştırılmaz; package.json betiklerine de
# güvenilmez. Komut yükleyici servisle aynı kısıtlamalarla çalışır (voyager-komutlar birimi, kur.sh).
if ! birimi_calistir voyager-komutlar.service; then
  echo "Komutlar yüklenemedi; bot yeniden başlatılmadı."
  exit 1
fi
systemctl restart voyager
sleep 3
systemctl --no-pager --lines=10 status voyager
EOF
chown root:root /usr/local/sbin/voyager-guncelle
chmod 755 /usr/local/sbin/voyager-guncelle

# sudo izni: yalnızca bu betik, argümansız
SUDOERS="$(mktemp)"
echo "$KULLANICI ALL=(root) NOPASSWD: /usr/local/sbin/voyager-guncelle \"\"" > "$SUDOERS"
if ! visudo -cf "$SUDOERS" >/dev/null; then
  rm -f "$SUDOERS"
  echo "sudoers satırı doğrulanamadı, sudo izni eklenmedi."
  exit 1
fi
install -m 440 -o root -g root "$SUDOERS" /etc/sudoers.d/voyager-deploy
rm -f "$SUDOERS"

echo
echo ">> Hazır. '$KULLANICI' kullanıcısı anahtarla girebilir."
echo "   Gönderilen açık anahtar dosyasını artık silebilirsin: rm $ANAHTAR"
