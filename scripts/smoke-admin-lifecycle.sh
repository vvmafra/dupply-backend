#!/usr/bin/env bash
# End-to-end smoke for the admin lifecycle routes (demo gaps 1 and 3).
# Prereqs: API running (default http://localhost:8081) on a DB seeded with `npm run seed:dev`.
# Usage: BASE=http://localhost:8081 bash scripts/smoke-admin-lifecycle.sh
RUN=$(date +%s)
set -euo pipefail
BASE=${BASE:-http://localhost:8081}
PW=dev-password-change-me

login() { curl -s -X POST "$BASE/v1/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken'; }

SELLER=$(login seller@dupply.dev.local)
ANALYST=$(login analyst@dupply.dev.local)
ADMIN=$(login admin@dupply.dev.local)
INVESTOR=$(login investor@dupply.dev.local)

step() { echo; echo "== $1"; }
post() { # token url [json]
  if [ -n "${3:-}" ]; then
    curl -s -o "${TMPDIR:-/tmp}/smoke-body" -w '%{http_code}' -X POST "$BASE$2" -H "authorization: Bearer $1" \
      -H 'content-type: application/json' -d "$3"
  else
    curl -s -o "${TMPDIR:-/tmp}/smoke-body" -w '%{http_code}' -X POST "$BASE$2" -H "authorization: Bearer $1"
  fi; echo " $(cat "${TMPDIR:-/tmp}/smoke-body")"; }
status() { curl -s "$BASE/v1/receivables/$1" -H "authorization: Bearer $ADMIN" \
  | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).receivable; `status=${r.status} targetFunding=${r.targetFunding} funded=${r.funded}`'; }

step "seller: create + submit receivable"
post "$SELLER" /v1/receivables/submit "{\"payerCnpj\":\"11222333000181\",\"payerLegalName\":\"Smoke Payer LTDA\",\"payerFinancialEmail\":\"fin@smoke.dev\",\"value\":1000,\"receivableMetaData\":{\"type\":\"commercial\",\"billNumber\":\"SMOKE-$RUN\",\"invoiceNumber\":\"INV-SMOKE-$RUN\",\"issuedAt\":\"2026-09-01\",\"dueDate\":\"2026-12-01\",\"payerCnpj\":\"11222333000181\",\"payerLegalName\":\"Smoke Payer LTDA\",\"payerFinancialEmail\":\"fin@smoke.dev\",\"fiscalDocumentType\":\"nfe\",\"fiscalDocumentKey\":\"SMOKE-KEY-$RUN\",\"proofType\":\"delivery\",\"payerAcceptanceStatus\":\"accepted\",\"desiredAnticipationValue\":900,\"antifraudDeclarationsAccepted\":true}}"
ID=$(node -pe 'JSON.parse(require("fs").readFileSync(0)).id' < "${TMPDIR:-/tmp}/smoke-body")
echo "receivable id: $ID"; status "$ID"

step "analyst: offer 900"
post "$ANALYST" "/v1/receivables/$ID/risk-decision" '{"decision":"offer","proposedValue":900}'
step "seller: accept → confirmed"
post "$SELLER" "/v1/receivables/$ID/seller-decision" '{"decision":"accept"}'; status "$ID"

step "GAP 3 guard: admin advance-stage on confirmed → 409"
post "$ADMIN" "/v1/admin/receivables/$ID/advance-stage"

step "GAP 1 guard: seller calls open-funding → 403"
post "$SELLER" "/v1/admin/receivables/$ID/open-funding"

step "GAP 1: admin open-funding → funding, targetFunding from proposedValue"
post "$ADMIN" "/v1/admin/receivables/$ID/open-funding"; status "$ID"

step "investor: GET /v1/receivables now lists it"
curl -s "$BASE/v1/receivables" -H "authorization: Bearer $INVESTOR" \
  | node -pe 'const l=JSON.parse(require("fs").readFileSync(0)).receivables; l.filter(r=>r.id==="'"$ID"'").map(r=>`${r.id} ${r.status} target=${r.targetFunding}`).join("\n") || "NOT LISTED"'

step "investor: balance before, invest 900 → funded"
curl -s "$BASE/v1/investors/me" -H "authorization: Bearer $INVESTOR" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)))' | cut -c1-200
post "$INVESTOR" /v1/investors/invest "{\"receivableId\":\"$ID\",\"amount\":900,\"idempotencyKey\":\"smoke-$ID\"}"; status "$ID"

step "GAP 3: admin advance-stage x3"
post "$ADMIN" "/v1/admin/receivables/$ID/advance-stage"; status "$ID"
post "$ADMIN" "/v1/admin/receivables/$ID/advance-stage"; status "$ID"
post "$ADMIN" "/v1/admin/receivables/$ID/advance-stage"; status "$ID"

step "investor: balance after payout + investment status"
curl -s "$BASE/v1/investors/me" -H "authorization: Bearer $INVESTOR" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)))' | cut -c1-200
curl -s "$BASE/v1/investors/investments" -H "authorization: Bearer $INVESTOR" \
  | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)))' | grep -o "\"receivableId\":\"$ID\"[^}]*" | head -1

step "GAP 3 guard: fourth call on payer_settled → 409"
post "$ADMIN" "/v1/admin/receivables/$ID/advance-stage"
