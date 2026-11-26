// Cliente v10 fase 2: Programação (Site Leader/Admin), Minhas metas do líder e contador no menu.
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir, sleep } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const cen = () => {
  const A = cenario(); A.as('owner@x.com'); A.call('migrarV10');
  A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar'], telas: ['matriz', 'form', 'minhas'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']); A.run('limparCache_()');
  return A;
};
const linhas = (A) => A.sheets.Metas_Lider.d.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined));
const badge = (t) => { const b = t.$('#nav button[data-v="minhas"] .badge-n'); return b ? b.textContent : ''; };
(async () => {
  await TA('só Admin e Site Leader veem o item Programação; Analista, líder e Auditor não', async () => {
    const A = cen();
    for (const e of ['sl@x.com', 'owner@x.com']) { const t = await abrir(A, e); ok(t.menu().includes('programacao'), e); eq(t.erros, []); }
    for (const e of ['ana@x.com', 'carlosa@x.com', 'aud1@x.com']) { const t = await abrir(A, e); ok(!t.menu().includes('programacao'), e); }
  });
  await TA('programar pela tela: grava, avisa por e-mail, mostra na lista com progresso e some o formulário preenchido', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    ok(/Programar auditorias/.test(t.$('#v-programacao').textContent), 'tela aberta'); ok(/Nenhuma meta ativa/.test(t.$('#v-programacao').textContent));
    ok(!/Sandra SL/.test(t.$('#pgEmail').textContent), 'o ator não aparece como responsável');
    ok(/Carlos Lider/.test(t.$('#pgEmail').textContent));
    t.set('#pgEmail', 'carlosa@x.com'); t.set('#pgQtd', '2', 'input');
    const p = t.$('#v-programacao [data-pg-p="Expedição"]'); p.checked = true; t.ev(p, 'change');
    ok(/Carlos Lider deve fazer 2 auditoria\(s\)/.test(t.$('#pgPrev').textContent), 'resumo ao vivo'); ok(/Processos: Expedição/.test(t.$('#pgPrev').textContent));
    await t.click('#pgSalvar'); await t.idle();
    eq(linhas(A).length, 1); eq(linhas(A)[0][1], 'carlosa@x.com'); eq(A.emails.filter((m) => m.to === 'carlosa@x.com').length, 1);
    ok(/aviso foi enviado por e-mail/.test(t.toast()), t.toast());
    ok(/Carlos Lider/.test(t.$('#v-programacao table').textContent) && /0<\/b> de 2/.test(t.$('#v-programacao table').innerHTML), 'linha com progresso');
    eq(t.$('#pgEmail').value, '', 'formulário volta ao início'); eq(t.erros, []);
  });
  await TA('erro de validação do servidor aparece no formulário, sem gravar; formulário continua preenchido', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    t.set('#pgEmail', 'carlosa@x.com'); t.set('#pgQtd', '0', 'input'); await t.click('#pgSalvar'); await t.idle();
    ok(/inteiro entre 1 e 9999/.test(t.$('#pgErr').textContent), t.$('#pgErr').textContent); eq(linhas(A).length, 0); eq(t.$('#pgEmail').value, 'carlosa@x.com');
    ok(!t.$('#pgSalvar').disabled, 'botão liberado para corrigir'); eq(t.erros, []);
  });
  await TA('cancelar pede confirmação; ao confirmar a meta vira Cancelada e sai das Ativas e aparece no filtro Canceladas', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    t.set('#pgEmail', 'carlosa@x.com'); await t.click('#pgSalvar'); await t.idle();
    await t.click('[data-pg-cancel]'); ok(/Confirmar cancelamento/.test(t.$('[data-pg-cancel]').textContent)); eq(String(linhas(A)[0][13]), 'Ativa');
    await t.click('[data-pg-cancel]'); await t.idle();
    eq(String(linhas(A)[0][13]), 'Cancelada'); ok(!t.$('[data-pg-cancel]'), 'saiu das ativas');
    await t.click('[data-pl-f="cancelada"]'); ok(/Cancelada/.test(t.$('#plLista-metas table').textContent)); ok(!t.$('[data-pg-cancel]')); eq(t.erros, []);
  });
  await TA('o líder vê o contador no menu, abre Minhas metas, vê a meta como Nova e o contador zera (no servidor também)', async () => {
    const A = cen(); const sl = await abrir(A, 'sl@x.com'); await sl.nav('programacao');
    sl.set('#pgEmail', 'carlosa@x.com'); await sl.click('#pgSalvar'); await sl.idle();
    const t = await abrir(A, 'carlosa@x.com');
    eq(badge(t), '1'); ok(/nova\(s\)/.test(t.$('#nav button[data-v="minhas"]').getAttribute('aria-label')), 'aria-label com texto');
    await t.nav('minhas'); ok(/Programadas pela liderança/.test(t.$('#v-minhas').textContent) && /Nova/.test(t.$('#v-minhas').textContent));
    eq(badge(t), '', 'contador some'); eq(A.call('contarMetasNovas'), 0); eq(t.erros, []);
  });
  await TA('a consulta silenciosa atualiza o contador sem recarregar a tela', async () => {
    const A = cen(); const t = await abrir(A, 'carlosa@x.com', { poll: 40 }); eq(badge(t), '');
    A.as('sl@x.com'); A.call('salvarMetaLider', { email: 'carlosa@x.com', qtd: 1, ini: A.hojeStr, fim: A.dia(3), desc: '', times: [], turnos: [], cores: [], processos: [] });
    for (let i = 0; i < 40 && badge(t) !== '1'; i++) await sleep(25);
    eq(badge(t), '1'); eq(t.erros, []);
  });
  await TA('observação com aspas e sinais fica escapada na lista e em Minhas metas (sem HTML injetado)', async () => {
    const A = cen(); const sl = await abrir(A, 'sl@x.com'); await sl.nav('programacao');
    sl.set('#pgEmail', 'carlosa@x.com'); sl.set('#pgDesc', 'Foco "doca" & prazo', 'input'); await sl.click('#pgSalvar'); await sl.idle();
    ok(/Foco "doca" & prazo/.test(sl.$('#v-programacao table').textContent)); eq(sl.$$('#v-programacao table img, #v-programacao table script').length, 0);
    const t = await abrir(A, 'carlosa@x.com'); await t.nav('minhas'); ok(/Foco "doca" & prazo/.test(t.$('#v-minhas').textContent)); eq(t.erros, []);
  });
  await TA('cancelar: a confirmação não redesenha a tela (mesmo botão, foco mantido), o nome acessível muda e Esc desfaz', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    t.set('#pgEmail', 'carlosa@x.com'); await t.click('#pgSalvar'); await t.idle();
    const b = t.$('[data-pg-cancel]'); b.focus(); await t.click(b);
    ok(t.$('[data-pg-cancel]') === b, 'mesmo elemento'); ok(/Confirmar cancelamento/.test(b.textContent)); ok(/Confirmar o cancelamento da meta de Carlos Lider/.test(b.getAttribute('aria-label')));
    ok(/Clique de novo/.test(t.$('#pgLive').textContent), 'anunciado'); eq(t.doc.activeElement, b, 'foco no botão');
    t.doc.dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok(/^Cancelar$/.test(b.textContent.trim())); ok(/Cancelar a meta de Carlos Lider/.test(b.getAttribute('aria-label'))); eq(String(linhas(A)[0][13]), 'Ativa'); eq(t.erros, []);
  });
  await TA('estrutura acessível: grupos em fieldset/legend, tabela com caption e cabeçalhos com scope, aviso pendente visível', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    eq(t.$$('#v-programacao fieldset legend').length, 4); ok(t.$('#pgEmail').required);
    t.set('#pgEmail', 'carlosa@x.com'); A.mailFalha = true; await t.click('#pgSalvar'); await t.idle(); A.mailFalha = false;
    ok(t.$('#v-programacao table caption')); ok(t.$$('#v-programacao th[scope="col"]').length >= 6); ok(/Aviso por e-mail pendente/.test(t.$('#v-programacao table').textContent)); ok(/não foi enviado/.test(t.toast()));
  });
  await TA('rótulo do contador no menu em inglês e espanhol', async () => {
    const A = cen(); const sl = await abrir(A, 'sl@x.com'); await sl.nav('programacao'); sl.set('#pgEmail', 'carlosa@x.com'); await sl.click('#pgSalvar'); await sl.idle();
    const en = await abrir(A, 'carlosa@x.com', { lang: 'en' }); ok(/Minhas metas|My goals/.test(en.$('#nav button[data-v="minhas"]').getAttribute('aria-label'))); ok(/1 new/.test(en.$('#nav button[data-v="minhas"]').getAttribute('aria-label')), en.$('#nav button[data-v="minhas"]').getAttribute('aria-label'));
  });
  await TA('Programação em inglês e espanhol', async () => {
    const A = cen();
    const en = await abrir(A, 'sl@x.com', { lang: 'en' }); await en.nav('programacao'); ok(/Schedule audits/.test(en.$('#v-programacao').textContent), en.$('#v-programacao').textContent.slice(0, 80)); ok(/Schedule goal/.test(en.$('#pgSalvar').textContent));
    const es = await abrir(A, 'sl@x.com', { lang: 'es' }); await es.nav('programacao'); ok(/Programar auditorías/.test(es.$('#v-programacao').textContent)); eq(en.erros.concat(es.erros), []);
  });
  console.log('Cliente v10 fase 2 (programação e metas do líder): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
