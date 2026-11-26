const assert = require('assert');
const R = { ok: 0, falhas: [], nome: '' };
function T(nome, fn) {
  try { fn(); R.ok++; } catch (e) { R.falhas.push(nome + '\n      -> ' + String(e.message).split('\n').slice(0, 4).join('\n         ')); }
}
// sem mensagem, o Node 26 recusa `undefined` no assert; aqui a falha mostra o esperado e o recebido
const json = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const eq = (a, b, m) => {
  const A = json(a), B = json(b);
  try { assert.deepStrictEqual(A, B); } catch (e) { throw new Error((m ? m + ': ' : '') + 'esperado ' + String(JSON.stringify(B)).slice(0, 300) + ', veio ' + String(JSON.stringify(A)).slice(0, 300)); }
};
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
