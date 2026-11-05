#!/usr/bin/env bash
set -euo pipefail

# Habilita adb para celulares Xiaomi/Redmi en Linux (regla udev).
# Uso: bash scripts/adb-setup.sh

VENDOR_ID="2717"
RULE_FILE="/etc/udev/rules.d/51-android.rules"

echo "== 1/4 Escribiendo regla udev para vendor $VENDOR_ID =="
printf 'SUBSYSTEM=="usb", ATTR{idVendor}=="%s", MODE="0666", GROUP="plugdev"\n' "$VENDOR_ID" |
  sudo tee "$RULE_FILE" >/dev/null
sudo chmod 644 "$RULE_FILE"

echo "== 2/4 Recargando udev =="
sudo udevadm control --reload-rules
sudo udevadm trigger

echo "== 3/4 Reiniciando servidor adb =="
adb kill-server >/dev/null 2>&1 || true
adb start-server

echo "== 4/4 Dispositivos conectados =="
adb devices -l

echo
echo "Listo. Si dice 'device', ya podés correr: npm run android"
echo "Si dice 'unauthorized', aceptá el diálogo en el celular y volvé a correr este script."
