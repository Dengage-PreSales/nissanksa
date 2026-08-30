#!/usr/bin/env bash
# Gives the lead relay a fixed egress address, using one small Ubuntu server.
#
# The relay (supabase/functions/nissan-lead-relay) runs on infrastructure with
# no stable outbound IP, and Dengage's REST API only accepts allowlisted
# addresses. This script turns a fresh Ubuntu 22.04 or 24.04 server with a
# dedicated public IPv4 into the fix: an authenticated CONNECT proxy that the
# relay tunnels its Dengage calls through, so every call reaches Dengage from
# this server's one fixed address. The proxy relays encrypted bytes it cannot
# read, TLS stays end to end, and tunnels are limited to port 443.
#
# Run on the server, as root:
#
#   curl -fsSL https://raw.githubusercontent.com/dengage-presales/nissanksa/main/tools/vps-egress-setup.sh | sudo bash
#
# Optional arguments: a proxy username and password. Without them a username
# is set and a strong random password is generated. The script ends by
# printing the two values to configure: the address to allowlist in Dengage,
# and the DENGAGE_EGRESS_PROXY secret for Supabase.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

PROXY_USER="${1:-nissanrelay}"
PROXY_PASS="${2:-$(openssl rand -hex 24)}"
PROXY_PORT=8642

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq tinyproxy ufw curl >/dev/null

CONF=/etc/tinyproxy/tinyproxy.conf
[ -f "${CONF}.original" ] || cp "$CONF" "${CONF}.original"

cat > "$CONF" <<EOF
# Egress proxy for the Nissan KSA demo lead relay. Written by
# tools/vps-egress-setup.sh; the original file is kept alongside as
# tinyproxy.conf.original.
User tinyproxy
Group tinyproxy
Port ${PROXY_PORT}
Timeout 600
LogFile "/var/log/tinyproxy/tinyproxy.log"
LogLevel Notice
PidFile "/run/tinyproxy/tinyproxy.pid"
MaxClients 50
# Credentials are the gate; the address filter is open on purpose because
# the caller has no fixed address of its own.
BasicAuth ${PROXY_USER} ${PROXY_PASS}
Allow 0.0.0.0/0
# Tunnels are allowed to TLS ports only, so this cannot serve as a
# general purpose proxy.
ConnectPort 443
DisableViaHeader Yes
EOF

systemctl enable tinyproxy >/dev/null 2>&1 || true
systemctl restart tinyproxy

# The firewall keeps SSH and the proxy port, nothing else. OpenSSH is allowed
# before the firewall is enabled so this session cannot cut itself off.
ufw allow OpenSSH >/dev/null
ufw allow ${PROXY_PORT}/tcp >/dev/null
ufw --force enable >/dev/null

DIRECT_IP=$(curl -fsS --max-time 15 https://api.ipify.org || echo unknown)
VIA_PROXY=$(curl -fsS --max-time 15 -x "http://${PROXY_USER}:${PROXY_PASS}@127.0.0.1:${PROXY_PORT}" https://api.ipify.org || echo failed)

echo
echo "==============================================================="
if [ "$VIA_PROXY" = "$DIRECT_IP" ] && [ "$VIA_PROXY" != "failed" ]; then
  echo "Proxy is up and answering on this server's own address."
else
  echo "WARNING: the self test did not come back clean."
  echo "  direct address:  $DIRECT_IP"
  echo "  through proxy:   $VIA_PROXY"
  echo "Check: systemctl status tinyproxy; tail /var/log/tinyproxy/tinyproxy.log"
fi
echo
echo "1. Allowlist this address in Dengage (Settings > Identity and"
echo "   Access Management > API IP Restriction > Add > Choose IP):"
echo
echo "   ${DIRECT_IP}"
echo
echo "2. Set this secret on the Supabase project (Edge Functions >"
echo "   nissan-lead-relay > Secrets), exactly as printed:"
echo
echo "   DENGAGE_EGRESS_PROXY=http://${PROXY_USER}:${PROXY_PASS}@${DIRECT_IP}:${PROXY_PORT}"
echo
echo "3. Confirm: open the relay URL in a browser. egress_ip must show"
echo "   ${DIRECT_IP} and egress_proxy_configured must be true."
echo "==============================================================="
