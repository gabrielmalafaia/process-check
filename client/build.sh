#!/usr/bin/env bash
# Junta as partes do JavaScript do cliente em src/JS_Client.html (o arquivo que vai para o Apps Script).
set -e
cd "$(dirname "$0")/parts"
(echo '<script>'; cat i18n_*.js p0.js p1.js p2.js p3.js p4.js p5.js p6.js p7.js p8.js p9.js p10.js; echo '</script>') > ../../src/JS_Client.html
echo "src/JS_Client.html gerado"
