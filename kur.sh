#!/usr/bin/env bash
# Voyager botunu bu VPS'e kurar veya günceller.
# Kullanım: sudo bash kur.sh
set -euo pipefail

HEDEF=/opt/voyager
KULLANICI=voyager
KAYNAK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Bağımlılıkların bot kullanıcısıyla kurulduğu ara klasör (voyager-guncelle de kullanır)
ARA="$HEDEF/.bagimliliklar"

if [[ $EUID -ne 0 ]]; then
  echo "Bu betik sudo ile çalıştırılmalı: sudo bash kur.sh"
  exit 1
fi

# Node.js: yoksa kur. Varsa ama eskiyse dokunma; sunucudaki başka bir
# uygulama (ör. web sitesi) o sürüme bağlı olabilir.
if ! command -v node >/dev/null; then
  echo ">> Node.js kuruluyor..."
  apt-get update
  apt-get install -y curl ca-certificates gnupg
  # NodeSource deposu elle eklenir: internetten indirilen bir betik root olarak çalıştırılmaz,
  # paketler deponun imza anahtarıyla doğrulanır.
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
elif (( $(node -p 'process.versions.node.split(".")[0]') < 18 )); then
  echo "Bu sunucuda eski bir Node.js var: $(node --version). Bot için en az 18 gerekli."
  echo "Başka bir uygulaman bu sürümü kullanıyor olabilir, o yüzden otomatik yükseltmedim."
  exit 1
fi
if ! command -v npm >/dev/null; then
  echo "npm bulunamadı. Node.js ile birlikte kurulu olmalı."
  exit 1
fi
NODE="$(command -v node)"
NPM_CLI="$(readlink -f "$(command -v npm)")"
echo ">> Node.js: $(node --version)"

# Bot kendi yetkisiz kullanıcısıyla çalışır
if ! id "$KULLANICI" &>/dev/null; then
  useradd --system --home-dir "$HEDEF" --shell /usr/sbin/nologin "$KULLANICI"
fi

# Aynı anda çalışan bir güncelleme (voyager-guncelle) ile aynı dosyalara dokunulmasın
exec 9>/run/voyager-guncelle.kilit
flock 9

# Kod klasörü root'a aittir: bot kullanıcısı kodu, bağımlılıkları ve .env'i yalnızca okur, yalnızca data/'ya
# yazar. Eski kurulumlarda klasör bot kullanıcısınındı; önce klasörün kendisi root'a alınır ki aşağıdaki
# denetimlerden sonra içine yeni bir dosya ya da sembolik bağ konamasın.
if [[ -L "$HEDEF" ]]; then
  echo "$HEDEF sembolik bağ; kurulum durduruldu."
  exit 1
fi
mkdir -p "$HEDEF"
if [[ "$(stat -c %u "$HEDEF")" != 0 ]]; then
  # Eski düzen: komutlar "sudo -u voyager npm run komutlar" ile kısıtsız çalışıyordu. O sırada başlatılıp
  # geride kalmış bir süreç, aşağıdaki işlemler sürerken bot kullanıcısının klasörlerine yazamasın.
  # Bot betiğin sonunda yeniden başlatılır.
  echo ">> Eski kurulum düzeni root'a alınıyor; bot bir süre kapalı kalacak."
  echo "   Betik yarıda kalırsa bot kapalı kalır: sorunu giderip kur.sh'ı yeniden çalıştır."
  systemctl stop voyager 2>/dev/null || true
  pkill -KILL -u "$KULLANICI" || true
fi
chown root:root "$HEDEF"
chmod 755 "$HEDEF"
# Aşağıda root bu yollara kopyalar, chmod/chown yapar ya da onları okur. Hiçbiri sembolik bağ olmamalı;
# öyleyse biri root'un eliyle başka bir dosyayı (ör. /etc/sudoers.d altını) değiştirmeye çalışıyor olabilir.
for YOL in .env .env.example package.json package-lock.json src node_modules data; do
  if [[ -L "$HEDEF/$YOL" ]]; then
    echo "$HEDEF/$YOL sembolik bağ; kurulum durduruldu. Sunucuyu incele: SECURITY_PROTOCOL.md, bölüm 6."
    exit 1
  fi
done

if [[ "$KAYNAK" != "$HEDEF" ]]; then
  if [[ ! -d "$KAYNAK/src" || ! -f "$KAYNAK/package.json" || ! -f "$KAYNAK/package-lock.json" ]]; then
    echo "$KAYNAK içinde src/, package.json veya package-lock.json yok. Dosyaların hepsi gönderildi mi?"
    exit 1
  fi
  # Eski src'yi sil: yoksa kaynakta silinen komut dosyaları sunucuda kalır ve yüklenmeye devam eder
  rm -rf "$HEDEF/src"
  cp -r --remove-destination "$KAYNAK/package.json" "$KAYNAK/package-lock.json" "$KAYNAK/.env.example" "$KAYNAK/src" "$HEDEF/"
fi
if [[ ! -f "$HEDEF/package-lock.json" ]]; then
  echo "$HEDEF/package-lock.json yok. Bağımlılıklar yalnızca kilit dosyasındaki sürümlerle kurulur."
  exit 1
fi
for YOL in src package.json package-lock.json .env.example; do
  if [[ -e "$HEDEF/$YOL" ]]; then
    chown -hR root:root "$HEDEF/$YOL"
    chmod -R u=rwX,go=rX "$HEDEF/$YOL"
  fi
done

# .env'i root yazar, bot yalnızca okur
if [[ ! -f "$HEDEF/.env" ]]; then
  install -m 640 -o root -g "$KULLANICI" "$HEDEF/.env.example" "$HEDEF/.env"
  echo
  echo ">> $HEDEF/.env oluşturuldu. Şimdi içini doldur:"
  echo "     sudo nano $HEDEF/.env"
  echo "   Sonra bu betiği tekrar çalıştır:"
  echo "     sudo bash kur.sh"
  exit 0
fi

if grep -Eq '^(DISCORD_TOKEN|CLIENT_ID)=[[:space:]]*$' "$HEDEF/.env"; then
  echo "$HEDEF/.env içinde boş değer var. Doldur: sudo nano $HEDEF/.env"
  exit 1
fi

chown root:"$KULLANICI" "$HEDEF/.env"
chmod 640 "$HEDEF/.env"
# Kayıt klasörü servis başlamadan önce var olmalı: servis dosya sistemini salt okunur görür,
# yalnızca burası yazılabilir (aşağıdaki ReadWritePaths)
install -d -m 700 -o "$KULLANICI" -g "$KULLANICI" "$HEDEF/data"

# Node ev klasörlerinin altındaysa (ör. nvm ile kurulmuşsa) ProtectHome servisin Node'u görmesini engeller
EV_KORUMASI="ProtectHome=true"
case "$(readlink -f "$NODE")" in
  /home/* | /root/* | /run/user/*) EV_KORUMASI="" ;;
esac

# Bot, komut yükleyici ve bağımlılık kurulumu aynı kısıtlamalarla çalışır; üçü de gönderilen kodu ya da
# paketleri bot kullanıcısıyla işler. Yazabildikleri tek klasör her birimde ayrıca verilir (ReadWritePaths).
KORUMALAR="NoNewPrivileges=true
PrivateTmp=true
# Bot ele geçirilse bile yapabilecekleri sınırlı kalsın: dosya sistemi salt okunurdur (kendi kodunu
# da değiştiremez), yalnızca kendi klasörüne yazabilir; ev klasörlerini ve aygıtları göremez.
ProtectSystem=strict
$EV_KORUMASI
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
UMask=0077"

# systemd servisi: çökerse veya VPS yeniden başlarsa bot kendiliğinden açılır
cat > /etc/systemd/system/voyager.service <<EOF
[Unit]
Description=Voyager Discord botu
After=network-online.target
Wants=network-online.target

[Service]
User=$KULLANICI
WorkingDirectory=$HEDEF
ExecStart=$NODE src/index.js
Restart=always
RestartSec=5
ReadWritePaths=$HEDEF/data
$KORUMALAR

[Install]
WantedBy=multi-user.target
EOF

# Komutları Discord'a yükler (kur.sh ve voyager-guncelle çalıştırır). package.json betikleri kullanılmaz;
# kod sudo ile kısıtsız bir kullanıcı olarak değil, servisle aynı kısıtlamalar altında çalışır.
cat > /etc/systemd/system/voyager-komutlar.service <<EOF
[Unit]
Description=Voyager Discord botu: komutları Discord'a yükler
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$KULLANICI
WorkingDirectory=$HEDEF
ExecStart=$NODE src/komutlari-yukle.js
TimeoutStartSec=120
ReadWritePaths=$HEDEF/data
$KORUMALAR
EOF

# Bağımlılıkları kilit dosyasındaki sürümlerle, bot kullanıcısıyla ve yalnızca ara klasöre yazarak kurar.
# npm root olarak çalıştırılmaz: paket listesi deploy kullanıcısından gelir; npm paket arşivindeki izin
# bitlerini (setuid dahil) korur ve eski npm sürümlerinde git bağımlılıklarını hazırlarken betik çalıştırabilir.
# Paketlerin kurulum betikleri çalıştırılmaz.
cat > /etc/systemd/system/voyager-bagimliliklar.service <<EOF
[Unit]
Description=Voyager Discord botu: bağımlılıkları kurar
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$KULLANICI
WorkingDirectory=$ARA
Environment=HOME=$ARA/.ev
ExecStart=$NODE $NPM_CLI ci --omit=dev --ignore-scripts --no-audit --no-fund
TimeoutStartSec=600
ReadWritePaths=$ARA
$KORUMALAR
EOF

systemctl daemon-reload

# Tek seferlik bir birimi çalıştırır ve bu çalışmanın kayıtlarını gösterir
birimi_calistir() {
  local durum=0
  systemctl start "$1" || durum=$?
  journalctl --sync 2>/dev/null || true
  journalctl --no-pager -o cat _SYSTEMD_INVOCATION_ID="$(systemctl show -p InvocationID --value "$1")" || true
  return "$durum"
}

echo ">> Bağımlılıklar kuruluyor..."
rm -rf "$ARA"
install -d -m 700 -o "$KULLANICI" -g "$KULLANICI" "$ARA"
install -m 644 "$HEDEF/package.json" "$HEDEF/package-lock.json" "$ARA/"
if ! birimi_calistir voyager-bagimliliklar.service; then
  rm -rf "$ARA"
  echo ">> Bağımlılıklar kurulamadı. Kayıtlar: sudo journalctl -u voyager-bagimliliklar -n 50"
  exit 1
fi
# Kurulanlar root'a alınır, bot kullanıcısı yalnızca okur. Birim bittiği için bot kullanıcısının bu
# klasörde çalışan süreci kalmadı; önce klasörün kendisi root'a alınır ki içindekiler değiştirilemesin.
chown root:root "$ARA"
chmod 700 "$ARA"
if [[ -L "$ARA/node_modules" || ! -d "$ARA/node_modules" ]]; then
  echo ">> Bağımlılık kurulumu node_modules klasörü üretmedi."
  exit 1
fi
chown -hR root:root "$ARA/node_modules"
if [[ -n "$(find "$ARA/node_modules" ! -type f ! -type d ! -type l -print -quit)" ]]; then
  echo ">> Kurulan bağımlılıklar arasında özel dosya var, reddedildi."
  exit 1
fi
chmod -R u-s,g-s,go-w,go+rX "$ARA/node_modules"
# voyager-guncelle kilit dosyası değişmedikçe bağımlılıkları yeniden kurmaz
rm -f "$ARA/node_modules/.kilit-ozeti"
sha256sum "$HEDEF/package-lock.json" | cut -d' ' -f1 > "$ARA/node_modules/.kilit-ozeti"
if [[ -e "$HEDEF/node_modules" ]]; then
  mv -T "$HEDEF/node_modules" "$ARA/eski-node_modules"
fi
mv -T "$ARA/node_modules" "$HEDEF/node_modules"
rm -rf "$ARA"

echo ">> Komutlar Discord'a yükleniyor..."
if ! birimi_calistir voyager-komutlar.service; then
  echo ">> Komutlar yüklenemedi; bot yeniden başlatılmadı. Kayıtlar: sudo journalctl -u voyager-komutlar -n 50"
  exit 1
fi

systemctl enable voyager >/dev/null
systemctl restart voyager
sleep 3
systemctl --no-pager --lines=5 status voyager || true

if ! systemctl is-active --quiet voyager; then
  echo
  echo ">> Bot başlamadı. Kayıtlara bak: sudo journalctl -u voyager -n 50"
  echo "   Sorun servis kısıtlamalarındaysa /etc/systemd/system/voyager.service içinde"
  echo "   ProtectSystem satırından UMask satırına kadar olan bölümü sil, sonra şunu çalıştır:"
  echo "     sudo systemctl daemon-reload && sudo systemctl restart voyager"
  exit 1
fi

echo
echo ">> Bitti. Canlı kayıtları izlemek için: sudo journalctl -u voyager -f"
