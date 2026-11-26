/* Roda todos os testes (tests/lote*.test.js), cada um num processo separado. Sai com código 1 se algum falhar. Uso: node tests/run-all.js */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pasta = __dirname;
const arquivos = fs.readdirSync(pasta).filter((f) => /^lote\d+\.test\.js$/.test(f)).sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
let falhou = false;
arquivos.forEach((f) => {
  const r = spawnSync(process.execPath, [path.join(pasta, f)], { encoding: 'utf8' });
  const ultima = (r.stdout || '').trim().split('\n').pop();
  console.log((r.status === 0 ? 'ok    ' : 'FALHA ') + f.padEnd(16) + ultima);
  if (r.status !== 0) { falhou = true; process.stdout.write((r.stdout || '') + (r.stderr || '')); }
});
process.exitCode = falhou ? 1 : 0;
