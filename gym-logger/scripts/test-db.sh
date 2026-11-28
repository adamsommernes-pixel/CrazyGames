#!/usr/bin/env bash
# Tester databaseoppsettet (migrasjonene og sikkerhetsreglene) mot en midlertidig lokal Postgres.
#   bash scripts/test-db.sh
# Krever Postgres 15+ installert (initdb/pg_ctl). Ingenting sendes til Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

BIN="$(pg_config --bindir 2>/dev/null || true)"
[ -x "$BIN/initdb" ] || BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -x "$BIN/initdb" ] || { echo "Fant ikke Postgres (initdb)."; exit 1; }

DIR="$(mktemp -d)"
PORT=54329
run() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$DIR"
cleanup() { run "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

run "$BIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
run "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null

PSQL=("$BIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
# 010 og 011 (pausevarsler) trenger pg_cron og vault fra Supabase, og hoppes over her.
FILES=(supabase/tests/00_supabase_stub.sql)
for f in supabase/migrations/*.sql; do
  case "$f" in *010_*|*011_*) continue;; esac
  FILES+=("$f")
done
# Kjør migrasjonene to ganger: de skal tåle det (setup.sql kjøres ofte på nytt).
for f in "${FILES[@]}" "${FILES[@]:1}"; do run env PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}" -f "$f" >/dev/null; done
FAILED=0
for t in supabase/tests/[1-9]*.sql; do
  echo "▶ $t"
  if out="$(run "${PSQL[@]}" -f "$t" 2>&1)"; then
    echo "$out" | sed -n 's/^.*NOTICE:  \(ok .*\)$/  \1/p'
  else
    echo "$out" | sed -n 's/^.*NOTICE:  \(ok .*\)$/  \1/p'
    echo "$out" | grep -E 'ERROR|FEIL' | sed 's/^/  ✗ /'
    FAILED=1
  fi
done
[ "$FAILED" = 0 ] || { echo "✗ Databasetester feilet"; exit 1; }
echo "✓ Alle databasetester bestått"
