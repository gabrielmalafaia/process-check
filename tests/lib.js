const assert = require('assert');
const R = { ok: 0, falhas: [], nome: '' };
function T(nome, fn) {
  try { fn(); R.ok++; } catch (e) { R.falhas.push(nome + '\n      -> ' + String(e.message).split('\n').slice(0, 4).join('\n         ')); }
}
const eq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
function nega(fn, trecho, m) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  if (!err) throw new Error('DEVERIA ter sido negado' + (m ? ': ' + m : ''));
  if (trecho && String(err.message).indexOf(trecho) < 0) throw new Error('mensagem inesperada: "' + err.message + '" (esperava conter "' + trecho + '")');
}
function fim(titulo) {
  console.log('\n' + titulo + ': ' + R.ok + ' passaram, ' + R.falhas.length + ' falharam');
  R.falhas.forEach(f => console.log('  FALHA: ' + f));
  process.exit(R.falhas.length ? 1 : 0);
}
module.exports = { T, eq, ok, nega, fim, R };
