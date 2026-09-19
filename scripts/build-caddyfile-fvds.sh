#!/usr/bin/env bash
# Собрать scripts/caddyfile.fvds.prod (prod + staging) из шаблона.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HEADER="$ROOT/scripts/caddy/fvds-header.caddy"
TEMPLATE="$ROOT/scripts/caddy/armada-vhost.template"
OUT="$ROOT/scripts/caddyfile.fvds.prod"

render_snippet() {
  local name="$1" web_root="$2"
  sed -e "s|__SNIPPET__|$name|g" -e "s|__WEB_ROOT__|$web_root|g" "$TEMPLATE"
}

{
  cat "$HEADER"
  render_snippet armada /var/www/armada
  echo ""
  echo "app.armada.sx {"
  echo "	import armada"
  echo "}"
  echo ""
  render_snippet armada_staging /var/www/armada-staging
  echo ""
  echo "staging.app.armada.sx {"
  echo "	# До появления DNS A: проверка через hosts + предупреждение о сертификате"
  echo "	tls internal"
  echo "	import armada_staging"
  echo "}"
} > "$OUT"

echo "OK → $OUT"
