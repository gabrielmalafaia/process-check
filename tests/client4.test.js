// v7.1: indicador global de espera e telas estreitas.
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const A = cenario(); A.as('owner@x.com');
  const t = await abrir(A, 'owner@x.com'); await t.nav('geral');
  await TA('espera: chamada lenta (acima de 0,3 s) liga o indicador e a última a terminar desliga', async () => {
    const b = t.doc.body; t.win.eval('esperaIni(); esperaIni();');
    ok(!b.classList.contains('espera'), 'não pisca antes de 0,3 s'); await sleep(350); ok(b.classList.contains('espera'));
    t.win.eval('esperaFim();'); ok(b.classList.contains('espera'), 'ainda há uma chamada em andamento');
    t.win.eval('esperaFim();'); ok(!b.classList.contains('espera'));
  });
  await TA('espera: chamada rápida nunca acende o indicador', async () => {
    t.win.eval('esperaIni(); esperaFim();'); await sleep(350); ok(!t.doc.body.classList.contains('espera'));
  });
  await TA('espera: falha do servidor também desliga o indicador', async () => {
    try { await t.win.eval("rpc('funcaoInexistente')"); } catch (e) { /* esperado */ }
    await t.idle(); await sleep(50); ok(!t.doc.body.classList.contains('espera'));
  });
  await TA('barra existe no HTML e o corpo volta ao normal depois de navegar', async () => {
    ok(t.$('#rpcbar i')); await t.nav('auditorias'); await t.nav('colab'); await t.idle(); ok(!t.doc.body.classList.contains('espera'));
  });
  console.log('Cliente v7.1:', R.ok, 'passaram,', R.f.length, 'falharam'); R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
