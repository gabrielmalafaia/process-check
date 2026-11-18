// Segurança do cliente: texto digitado (nomes, observações, perfis, perguntas) nunca vira HTML executável.
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const P = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>"><svg onload=window.__xss=3>';
(async () => {
  const A = cenario(); A.as('owner@x.com');
  const add = (aba, l) => A.ctx.anexar_(aba, l);
  add('Cad_Pessoas', [P, 'Colaborador', 'T1', 'Sim', 'Carlos Lider']);
  add('Cad_Pessoas', ['Lider ' + P, 'Líder', 'T1', 'Sim', '']);
  add('Cad_Estrutura', ['Doca', 'D' + P, 'Azul/Triângulo', 'Carlos Lider', 'T1']);
  A.call('salvarPerfil', { nome: 'Perfil ' + P.slice(0, 20), desc: P, perms: ['auditar'], telas: ['matriz', 'form'], escopo: { modo: 'proprias', processos: [], turnos: [] } }, true);
  A.run('limparCache_()');
  A.audit('aud1@x.com', 'Recebimento', { conf: 6, nc: 4, obs: P, f: { doca: '36', colaboradores: [P] } }); A.run('limparCache_()');
  const t = await abrir(A, 'owner@x.com');
  await TA('nenhuma tela transforma texto digitado em elemento HTML (img/svg/script) nem executa código', async () => {
    const vistas = [];
    for (const v of t.menu()) { try { await t.nav(v); } catch (e) { continue; } vistas.push(v);
      const pe = t.$$('img[src="x"], svg[onload], [onerror], [onload], #v-' + v + ' script'); ok(pe.length === 0, 'tela ' + v + ' criou elemento injetado: ' + pe.map(e => e.outerHTML.slice(0, 60)).join(' | '));
      ok(!t.win.__xss, 'código executou na tela ' + v); }
    ok(vistas.length >= 8, 'telas visitadas: ' + vistas.join(','));
  });
  await TA('subtelas (cadastros, acessos, detalhe, auditoria expandida, formulário) também escapam o texto', async () => {
    await t.nav('cad'); for (const b of t.$$('#v-cad [data-t]')) await t.click(b);
    await t.nav('acessos'); for (const b of t.$$('#v-acessos .tabs [data-at]')) await t.click(b);
    await t.nav('auditorias'); const l = t.$$('#v-auditorias tr.exp'); if (l[0]) await t.click(l[0]);
    await t.nav('colab'); await t.nav('matriz'); const c = t.$('#mg .mc'); if (c) await t.click(c);
    ok(t.$$('img[src="x"], svg[onload], [onerror]').length === 0, 'elemento injetado'); ok(!t.win.__xss, 'código executou');
  });
  await TA('controle positivo: o detector acusa HTML injetado de propósito e o texto malicioso chegou às telas (escapado)', async () => {
    t.doc.body.insertAdjacentHTML('beforeend', '<img src="x" id="ctl">'); ok(t.$$('img[src="x"]').length === 1, 'detector não enxerga o elemento'); t.$('#ctl').remove();
    await t.nav('auditorias'); ok(/onerror/.test(t.$('#v-auditorias').textContent), 'o texto do payload não chegou à tela, o teste não provaria nada');
  });
  console.log('Cliente segurança:', R.ok, 'passaram,', R.f.length, 'falharam'); R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
