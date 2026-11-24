// Cliente v9: aba "Regras de auditoria" (Site Leader e Admin definem o que cada líder audita e vê).
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const cen = () => {
  const A = cenario(); A.as('owner@x.com');
  A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar'], telas: ['matriz', 'form'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']); A.run('limparCache_()');
  return A;
};
const aba = (t) => t.$$('#v-acessos .tabs button').find(b => /Regras de auditoria/.test(b.textContent));
(async () => {
  await TA('Site Leader e Admin veem a aba; Analista e líder não', async () => {
    const A = cen();
    for (const e of ['sl@x.com', 'owner@x.com']) { const t = await abrir(A, e); await t.nav('acessos'); ok(aba(t), e + ' deveria ver a aba'); eq(t.erros, []); }
    const a = await abrir(A, 'ana@x.com'); await a.nav('acessos'); ok(!aba(a), 'Analista não vê a aba');
    const l = await abrir(A, 'carlosa@x.com'); ok(!l.menu().includes('acessos'), 'líder não vê Acessos');
  });
  await TA('lista os líderes, edita a regra (outros times, turno), mostra o resumo e grava no servidor', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('acessos'); await t.click(aba(t)); await t.idle();
    ok(/Carlos Lider/.test(t.$('#acBody').textContent) && /Padrão/.test(t.$('#acBody').textContent), 'líder listado como Padrão');
    ok(!/Sandra SL/.test(t.$('#acBody').textContent), 'o Site Leader não aparece na lista (nem edita a si mesmo)');
    await t.click('[data-rg-ed="carlosa@x.com"]'); ok(t.$('#rgEd'), 'editor aberto');
    ok(!t.$('#rgEd [data-rg-t]'), 'lista de times só aparece com "outros times"');
    const outros = t.$('#rgEd [data-rg="outros"]'); outros.checked = true; t.ev(outros, 'change'); await t.idle();
    ok(t.$('#rgEd [data-rg-t]'), 'lista de times aparece'); ok(/Audita o próprio time e outros times/.test(t.$('#rgPrev').textContent));
    const t2 = t.$('#rgEd [data-rg-tu="T2"]'); t2.checked = true; t.ev(t2, 'change'); ok(/Turnos: T2/.test(t.$('#rgPrev').textContent));
    await t.click('#rgSalvar'); await t.idle();
    const r = A.call('regraDe_', 'carlosa@x.com', true); eq([r.outros, r.turnos, r.ok], [true, ['T2'], true]);
    ok(/Exceção/.test(t.$('#acBody').textContent) && !t.$('#rgEd'), 'volta para a lista como Exceção'); eq(t.erros, []);
  });
  await TA('aviso quando a regra deixa o líder sem ninguém; recusa do servidor aparece; voltar ao padrão pede confirmação', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('acessos'); await t.click(aba(t)); await t.idle();
    await t.click('[data-rg-ed="carlosa@x.com"]');
    const p = t.$('#rgEd [data-rg="proprio"]'); p.checked = false; t.ev(p, 'change'); await t.idle();
    ok(/não poderá auditar ninguém/.test(t.$('#rgAv').textContent), 'aviso de regra vazia'); ok(t.$('#rgAv [role], #rgAv').getAttribute, 'área de aviso presente');
    await t.click('#rgSalvar'); await t.idle(); eq(A.call('regraDe_', 'carlosa@x.com', true).proprio, false);
    await t.click('[data-rg-ed="carlosa@x.com"]'); ok(t.$('#rgPadrao'), 'botão voltar ao padrão');
    await t.click('#rgPadrao'); ok(/Confirmar/.test(t.$('#rgPadrao').textContent), 'primeiro clique só pede confirmação'); eq(A.call('regraDe_', 'carlosa@x.com', true).existe, true);
    await t.click('#rgPadrao'); await t.idle(); eq(A.call('regraDe_', 'carlosa@x.com', true).existe, false); eq(t.erros, []);
  });
  console.log('Cliente v9 (regras de auditoria por líder): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
