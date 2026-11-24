#!/usr/bin/env bash
# Roda todas as suites (simulador do Apps Script + cliente em jsdom). Falha se alguma suite falhar.
cd "$(dirname "$0")"
rc=0
for f in duplicados.test.js server.test.js server2.test.js server3.test.js server4.test.js server5.test.js server6.test.js server7.test.js server8.test.js server9.test.js server10.test.js server11.test.js server12.test.js server13.test.js server14.test.js server15.test.js perf10.test.js client.test.js client2.test.js client3.test.js client4.test.js client5.test.js client6.test.js client7.test.js client8.test.js client9.test.js client10.test.js; do
  out=$(node "$f" 2>&1); code=$?
  echo "$out" | grep -E "passaram|FALHA|->" || true
  [ $code -ne 0 ] && { echo "FALHOU: $f"; rc=1; }
done
exit $rc
