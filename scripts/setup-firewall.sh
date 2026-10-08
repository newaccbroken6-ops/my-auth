#!/usr/bin/env bash
# ==============================================================================
# Host Firewall (nftables / iptables) Setup Script
# Reference: Section 6 of architettura_sicurezza_web.txt
# Policy: Default DROP on INPUT and FORWARD
# Inbound: Port 443 allowed strictly from Cloudflare edge IP ranges
# ==============================================================================

set -euo pipefail

echo "==> Configuring Kernel Network Security Parameters (sysctl)..."
sysctl -w net.ipv4.tcp_syncookies=1
sysctl -w net.ipv4.conf.all.rp_filter=1
sysctl -w net.ipv4.conf.default.rp_filter=1
sysctl -w net.ipv4.conf.all.accept_redirects=0
sysctl -w net.ipv4.conf.all.send_redirects=0
sysctl -w net.ipv4.conf.all.accept_source_route=0
sysctl -w net.ipv4.tcp_max_syn_backlog=8192
sysctl -w net.core.somaxconn=8192

echo "==> Flushing existing firewall chains..."
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

echo "==> Setting Default Policies to DROP (Section 6.1)..."
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

echo "==> Allowing Loopback and Established Connections..."
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP

echo "==> Allowlist Cloudflare Edge IPv4 Ranges on Port 443 (Section 6.2)..."
CF_IPV4=(
  "173.245.48.0/20"
  "103.21.244.0/22"
  "103.22.200.0/22"
  "103.31.4.0/22"
  "141.101.64.0/18"
  "108.162.192.0/18"
  "190.93.240.0/20"
  "188.114.96.0/20"
  "197.234.240.0/22"
  "198.41.128.0/17"
  "162.158.0.0/15"
  "104.16.0.0/13"
  "104.24.0.0/14"
  "172.64.0.0/13"
  "131.0.72.0/22"
)

for cidr in "${CF_IPV4[@]}"; do
  iptables -A INPUT -p tcp -s "$cidr" --dport 443 -j ACCEPT
done

echo "==> Allowing Bastion / Private Admin SSH (Replace subnet as appropriate)..."
# Never open 0.0.0.0/0 to SSH (Section 5.4 & 15.6)
# iptables -A INPUT -p tcp -s 10.20.0.0/28 --dport 22 -j ACCEPT

echo "==> Rate-limited Logging for Dropped Packets..."
iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "FW_DROP: " --log-level 7

echo "==> Host firewall configured successfully with Zero-Trust / Default-Deny policy."
