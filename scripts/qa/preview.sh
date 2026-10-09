#!/bin/zsh
# CANNA local preview — the full app on http://localhost:3100 against a LOCAL
# Supabase (ports 553xx, fictional data). Never touches production.
#
#   ./scripts/qa/preview.sh          start (seeds demo data on first run)
#   ./scripts/qa/preview.sh stop     stop app + Supabase (data is kept)
#
# Demo logins: admin.a@canna.test / doctor.a1@canna.test / patient.a@canna.test
# (password in scripts/qa/qa-config.mjs). Needs Docker (colima) + supabase CLI.
set -e
ROOT=${0:A:h:h:h}
SB=$ROOT/scripts/qa/local-supabase
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres

if [[ "$1" == "stop" ]]; then
  pkill -f "next start -p 3100" || true
  (cd $SB && supabase stop) || true
  exit 0
fi

colima status >/dev/null 2>&1 || colima start --cpu 4 --memory 6 --disk 30

# Migrations come from the repo; 011 (storage) needs the storage schema, so it runs after start.
rm -rf $SB/supabase/migrations && mkdir -p $SB/supabase/migrations
for f in $ROOT/supabase/migrations/*.sql; do [[ ${f:t} == 011_* ]] || cp $f $SB/supabase/migrations/; done
(cd $SB && supabase start -x vector,logflare,imgproxy,edge-runtime,supavisor,studio,mailpit)
psql $DB -q -f $ROOT/supabase/migrations/011_storage_buckets.sql >/dev/null 2>&1 || true

# Local-stack env (generated from `supabase status`; never the production keys).
STATUS=$(cd $SB && supabase status -o json 2>/dev/null)
export NEXT_PUBLIC_SUPABASE_URL=$(echo $STATUS | python3 -c 'import sys,json;print(json.load(sys.stdin)["API_URL"])')
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo $STATUS | python3 -c 'import sys,json;print(json.load(sys.stdin)["ANON_KEY"])')
export SUPABASE_SERVICE_ROLE_KEY=$(echo $STATUS | python3 -c 'import sys,json;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')
export NEXT_PUBLIC_APP_URL=http://localhost:3100
export RESEND_API_KEY=            # no real email from the preview
export CRON_SECRET=local-qa-cron

if [[ "$(psql $DB -Atc "select count(*) from users where email like '%@canna.test'")" == "0" ]]; then
  (cd $ROOT && SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL node scripts/qa/seed-local.mjs >/dev/null)
fi

cd $ROOT
npx next build
echo "\nCANNA preview: http://localhost:3100\n"
exec npx next start -p 3100
