// Cliente v10 fase 3: feedback obrigatório (aba em Programação, tela Meus feedbacks, selos).
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir, sleep } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => (m === undefined ? assert.deepStrictEqual(a, b) : assert.deepStrictEqual(a, b, m));
const TXT = 'Conversei com o colaborador sobre os itens reprovados nas últimas auditorias e combinamos reforçar a conferência antes de liberar a doca.';
const cen = () => {
  const A = cenario(); A.as('owner@x.com'); A.call('migrarV10');
  for (let i = 0; i < 3; i++) A.audit('aud1@x.com', 'Expedição', { conf: 5, f: { doca: '07', colaboradores: ['Carla Dias'] } });
  A.run('gerarPendenciasFeedback_()');
  return A;
};
const selo = (t, v) => { const b = t.$('#nav button[data-v="' + v + '"] .badge-n'); return b ? b.textContent : ''; };
const aba = async (t, id) => { await t.click('#pgTab-' + id); };
(async () => {
  await TA('Site Leader: selo em Programação, aba Feedbacks lista a pendência com time e auditorias', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com');
    eq(selo(t, 'programacao'), '1'); ok(/precisam de ação/.test(t.$('#nav button[data-v="programacao"]').getAttribute('aria-label')));
    await t.nav('programacao'); await aba(t, 'feedbacks');
    const v = t.$('#v-programacao').textContent; ok(/Carla Dias/.test(v) && /Time na época: Dora Lider \(T2\)/.test(v) && /5 auditoria\(s\) abaixo de 90%/.test(v) && /Aguardando designação/.test(v), v.slice(0, 300));
    eq(t.$('#pgTab-feedbacks').getAttribute('aria-selected'), 'true'); ok(t.$('table caption')); eq(t.erros, []);
  });
  await TA('designar pela tela: grava, avisa, mostra o designado e o prazo; sem escolha, pede a escolha', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    await t.click('[data-fb-des]'); ok(/Escolha quem dará o feedback\./.test(t.$('#fbErr').textContent));
    t.set('[data-fb-sel]', 'aud2@x.com'); await t.click('[data-fb-des]'); await t.idle();
    ok(/Feedback designado/.test(t.toast()), t.toast()); await t.click('[data-pl-f="designada"]'); ok(/Designado/.test(t.$('#v-programacao table').textContent) && /Audi Dois/.test(t.$('#v-programacao table').textContent));
    eq(A.emails.filter((m) => m.to === 'aud2@x.com').length, 1); eq(t.erros, []);
  });
  await TA('aviso (não bloqueio) quando o escolhido fez uma das auditorias: só o Admin vê; ainda designa', async () => {
    const A = cen(); const t = await abrir(A, 'owner@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    t.set('[data-fb-sel]', 'aud1@x.com'); ok(/fez uma ou mais das auditorias/.test(t.$('[data-fb-av]').textContent));
    t.set('[data-fb-sel]', 'ana@x.com'); eq(t.$('[data-fb-av]').textContent, '');
    t.set('[data-fb-sel]', 'aud1@x.com'); await t.click('[data-fb-des]'); await t.idle(); eq(String(A.sheets.Feedback_Pendencias.d[1][11]), 'Designada'); eq(t.erros, []);
  });
  await TA('sigilo: o Site Leader designa sem saber quem auditou (sem o aviso)', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    t.set('[data-fb-sel]', 'aud1@x.com'); eq(t.$('[data-fb-av]').textContent, ''); eq(t.erros, []);
  });
  await TA('designado: tela Meus feedbacks aparece pelos dados, com selo; contador de caracteres libera o botão; registra', async () => {
    const A = cen(); A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias[0].id; A.call('designarFeedback', id, 'aud2@x.com');
    const t = await abrir(A, 'aud2@x.com'); ok(t.menu().includes('feedbacks')); eq(selo(t, 'feedbacks'), '1');
    await t.nav('feedbacks'); ok(/Carla Dias/.test(t.$('#v-feedbacks').textContent)); eq(selo(t, 'feedbacks'), '1', 'selo = a registrar'); 
    const ta = t.$('[data-fb-txt]'), b = t.$('[data-fb-reg]'); ok(b.disabled);
    ta.value = 'curto'; t.ev(ta, 'input'); ok(b.disabled); ok(/5 de 50 caracteres no mínimo/.test(t.$('[data-fb-cont]').textContent));
    ta.value = TXT; t.ev(ta, 'input'); ok(!b.disabled); ok(/Tamanho mínimo atingido/.test(t.$('[data-fb-live]').textContent));
    await t.click(b); await t.idle();
    eq(A.sheets.Feedback_Registros.d.length, 2); ok(/Feedback registrado/.test(t.toast()), t.toast()); ok(/Registrado em/.test(t.$('#v-feedbacks').textContent)); eq(selo(t, 'feedbacks'), '');
    eq(t.erros, []);
  });
  await TA('erro do servidor (texto de baixa qualidade) aparece no cartão e não grava', async () => {
    const A = cen(); A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias[0].id; A.call('designarFeedback', id, 'aud2@x.com');
    const t = await abrir(A, 'aud2@x.com'); await t.nav('feedbacks');
    const ta = t.$('[data-fb-txt]'); ta.value = 'a '.repeat(40); t.ev(ta, 'input'); await t.click(t.$('[data-fb-reg]')); await t.idle();
    ok(/Descreva o que foi conversado/.test(t.$('[data-fb-err]').textContent), t.$('[data-fb-err]').textContent); eq(A.sheets.Feedback_Registros.d.length, 1);
    ok(!t.$('[data-fb-reg]').disabled, 'botão liberado'); eq(t.erros, []);
  });
  await TA('quem não foi designado não vê a tela nem o selo; o Site Leader lê o texto registrado na aba', async () => {
    const A = cen(); A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias[0].id; A.call('designarFeedback', id, 'aud2@x.com');
    const o = await abrir(A, 'aud1@x.com'); ok(!o.menu().includes('feedbacks')); eq(selo(o, 'feedbacks'), '');
    A.as('aud2@x.com'); A.call('registrarFeedback', id, TXT);
    const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    ok(/Ver feedback registrado/.test(t.$('#v-programacao').textContent)); ok(t.$('#v-programacao').textContent.includes(TXT)); eq(t.erros, []);
  });
  await TA('texto com HTML fica escapado (sem injeção) para o Site Leader', async () => {
    const A = cen(); A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias[0].id; A.call('designarFeedback', id, 'aud2@x.com');
    A.as('aud2@x.com'); eq(A.call('registrarFeedback', id, 'Falamos sobre <img src=x onerror=alert(1)> e as conferências da doca com o colaborador hoje cedo.').ok, true);
    const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks'); eq(t.$$('#v-programacao img').length, 0); ok(/<img src=x/.test(t.$('#v-programacao').textContent)); eq(t.erros, []);
  });
  await TA('teclado: setas trocam de aba e a aba de metas continua funcionando', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    t.$('#pgTab-metas').focus(); t.doc.dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); 
    t.$('#pgTab-metas').dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await t.idle();
    eq(t.$('#pgTab-feedbacks').getAttribute('aria-selected'), 'true'); await aba(t, 'metas'); ok(t.$('#pgEmail')); t.set('#pgQtd', '3', 'input'); eq(t.erros, []);
  });
  await TA('a consulta silenciosa mostra a nova designação sem recarregar', async () => {
    const A = cen(); const t = await abrir(A, 'aud2@x.com', { poll: 40 }); ok(!t.menu().includes('feedbacks'));
    A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias[0].id; A.call('designarFeedback', id, 'aud2@x.com');
    for (let i = 0; i < 60 && !t.menu().includes('feedbacks'); i++) await sleep(25);
    ok(t.menu().includes('feedbacks')); eq(selo(t, 'feedbacks'), '1'); eq(t.erros, []);
  });
  await TA('dois feedbacks: registrar um não apaga o texto digitado no outro; clique no menu ativo mantém o rascunho', async () => {
    const A = cen(); for (let i = 0; i < 3; i++) A.audit('aud1@x.com', 'Expedição', { conf: 5, f: { doca: '07', colaboradores: ['Davi Reis'] } });
    A.run('gerarPendenciasFeedback_()'); A.as('sl@x.com'); const ps = A.call('listarFeedbacks').pendencias; eq(ps.length, 2);
    ps.forEach((p) => A.call('designarFeedback', p.id, 'aud2@x.com'));
    const t = await abrir(A, 'aud2@x.com'); await t.nav('feedbacks'); eq(t.$$('[data-fb-txt]').length, 2);
    const [a, b] = t.$$('[data-fb-txt]'); ok(/Carla|Davi/.test(t.$('#v-feedbacks [role="heading"]').textContent));
    b.value = 'Rascunho que não deve ser apagado ao registrar o outro feedback da lista agora.'; t.ev(b, 'input');
    a.value = TXT; t.ev(a, 'input'); await t.click(t.$('[data-fb-reg="' + a.dataset.fbTxt + '"]')); await t.idle();
    const rest = t.$$('[data-fb-txt]'); eq(rest.length, 1); ok(/Rascunho que não deve ser apagado/.test(rest[0].value)); ok(!t.$('[data-fb-reg]').disabled, 'contador refeito');
    ok(/Feedback registrado/.test(t.$('#fbLive').textContent)); await t.nav('feedbacks'); ok(/Rascunho que não deve ser apagado/.test(t.$('[data-fb-txt]').value)); eq(t.erros, []);
  });
  await TA('inglês e espanhol', async () => {
    const A = cen();
    const en = await abrir(A, 'sl@x.com', { lang: 'en' }); await en.nav('programacao'); await aba(en, 'feedbacks'); ok(/Mandatory feedbacks/.test(en.$('#v-programacao').textContent) && /Waiting for assignment/.test(en.$('#v-programacao').textContent), en.$('#v-programacao').textContent.slice(0, 200));
    const es = await abrir(A, 'sl@x.com', { lang: 'es' }); await es.nav('programacao'); await aba(es, 'feedbacks'); ok(/Feedbacks obligatorios/.test(es.$('#v-programacao').textContent)); eq(en.erros.concat(es.erros), []);
  });
  await TA('ver quem auditou: com a permissão liberada pelo Admin, o Site Leader vê "Auditado por" e o aviso ao designar', async () => {
    const A = cen(); A.as('owner@x.com'); const perf = A.call('listarAcessos').perfis.find((p) => p.nome === 'Site Leader');
    A.call('salvarPerfil', Object.assign({}, perf, { perms: perf.perms.concat(['ver_auditor']) }), false);
    const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    ok(/Auditado por Audi Um/.test(t.$('#pgPainel').textContent), 'sem o nome de quem auditou');
    t.set('[data-fb-sel]', 'aud1@x.com'); ok(/fez uma ou mais das auditorias/.test(t.$('[data-fb-av]').textContent)); eq(t.erros, []);
  });
  await TA('ver quem auditou: sem a permissão, nenhum nome de auditor aparece', async () => {
    const A = cen(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    ok(!/Auditado por/.test(t.$('#pgPainel').textContent)); ok(!/Audi Um|aud1@x\.com/.test(JSON.stringify(t.win.__S.fbl.pendencias)), 'o dado chegou ao navegador'); // "responsaveis" lista quem pode ser designado: não é quem auditou
  });
  // v10.9: feedback imediato (pergunta marcada pelo Site Leader; uma não conformidade nela gera a pendência na hora)
  const cenImed = () => {
    const A = cen(); A.as('owner@x.com');
    const o = A.call('listarCadastro', 'Cad_Processos_Perguntas').find((x) => x.Processo === 'Recebimento' && x.Descricao_Item === 'Recebimento item 10');
    A.as('sl@x.com'); A.call('salvarCadastro', 'Cad_Processos_Perguntas', Object.assign({}, o, { Feedback_Imediato: 'Sim' }), o);
    A.audit('aud1@x.com', 'Recebimento', { conf: 9, nc: 1, f: { doca: '36', colaboradores: ['Bruno Lima'] } });
    return A;
  };
  await TA('feedback imediato: em vermelho, primeiro da lista e com o motivo (a pergunta) para o Site Leader', async () => {
    const A = cenImed(); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    const linhas = t.$$('#pgPainel tbody tr'); ok(linhas[0].classList.contains('fb-imed'), 'imediato deveria vir primeiro e marcado');
    ok(/Feedback imediato/.test(linhas[0].textContent) && /Recebimento item 10/.test(linhas[0].textContent), linhas[0].textContent);
    eq(t.$$('#pgPainel tr.fb-imed').length, 1); eq(t.erros, []);
  });
  await TA('feedback imediato: quem dá o feedback também vê o destaque e o motivo', async () => {
    const A = cenImed(); A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias.find((p) => p.imediato).id; A.call('designarFeedback', id, 'aud2@x.com');
    const t = await abrir(A, 'aud2@x.com'); await t.nav('feedbacks');
    const c = t.$('#v-feedbacks .fb-imed'); ok(c, 'sem destaque'); ok(/Recebimento item 10/.test(c.textContent)); eq(t.erros, []);
  });
  await TA('cadastro de perguntas: o campo de feedback imediato aparece só para Site Leader e Admin', async () => {
    const A = cen();
    const abre = async (email) => { const t = await abrir(A, email); await t.nav('cad'); const tb = t.$('#v-cad [data-t="Cad_Processos_Perguntas"]'); if (tb) await t.click(tb); await t.click(t.$('#v-cad [data-addsub]')); return t; };
    const sl = await abre('sl@x.com'); ok(sl.$('[data-c="Feedback_Imediato"]'), 'Site Leader deveria ver o campo'); eq(sl.erros, []);
    const an = await abre('ana@x.com'); ok(!an.$('[data-c="Feedback_Imediato"]'), 'Analista não deveria ver o campo'); eq(an.erros, []);
  });
  // v10.10: filtro por situação, busca e páginas de 20 em Programação; observação do auditor nos feedbacks
  const cenMuitas = (n) => {
    const A = cen(), d = A.sheets.Feedback_Pendencias.d;
    for (let i = 0; i < n; i++) { const r = new Array(20).fill(''); Object.assign(r, { 0: 'FBK-T' + i, 1: 'T' + i, 2: 'Pessoa ' + String(i).padStart(2, '0'), 3: 'Dora Lider', 4: 'T2', 5: '2026-11-01', 6: '2026-11-02', 7: 3, 8: '', 9: 90, 10: '2026-11-20 10:00:00', 11: 'Aberta' }); d.push(r); }
    return A;
  };
  const busca = (t, v) => { const i = t.$('[data-pl-q="feedbacks"]'); i.value = v; t.ev(i, 'input'); };
  const linhasPl = (t) => t.$$('#plLista-feedbacks tbody tr').length;
  await TA('Feedbacks: abre em Abertas, 20 por página, Próxima mostra o resto', async () => {
    const A = cenMuitas(25); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    eq(t.$('[data-pl-f="aberta"]').getAttribute('aria-pressed'), 'true'); ok(/26/.test(t.$('[data-pl-f="aberta"]').textContent));
    eq(linhasPl(t), 20); ok(/Página 1 de 2/.test(t.$('#plLista-feedbacks').textContent));
    await t.click('[data-pl-p="1"]'); eq(linhasPl(t), 6); ok(t.$('[data-pl-p="1"]').disabled); eq(t.erros, []);
  });
  await TA('Feedbacks: busca pelo colaborador (sem acento) e filtro sem itens', async () => {
    const A = cenMuitas(25); const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    busca(t, 'carla'); await sleep(300); eq(linhasPl(t), 1); ok(/Carla Dias/.test(t.$('#plLista-feedbacks').textContent));
    ok(t.$('[data-pl-q="feedbacks"]'), 'o campo de busca continua lá');
    busca(t, 'zzz'); await sleep(300); ok(/Nada encontrado para esta busca/.test(t.$('#plLista-feedbacks').textContent));
    busca(t, ''); await sleep(300);
    await t.click('[data-pl-f="concluida"]'); ok(/Nada nesta situação/.test(t.$('#plLista-feedbacks').textContent));
    await t.click('[data-pl-f="todas"]'); eq(linhasPl(t), 20); eq(t.erros, []);
  });
  await TA('Metas: filtro Canceladas e Ativas, com a quantidade em cada um', async () => {
    const A = cen(); A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar'], telas: ['matriz', 'form', 'minhas'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
    A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']); A.run('limparCache_()');
    const t = await abrir(A, 'sl@x.com'); await t.nav('programacao');
    t.set('#pgEmail', 'carlosa@x.com'); await t.click('#pgSalvar'); await t.idle();
    ok(/1/.test(t.$('[data-pl-f="ativas"]').textContent)); eq(t.$$('#plLista-metas tbody tr').length, 1);
    await t.click('[data-pl-f="cancelada"]'); ok(/Nada nesta situação/.test(t.$('#plLista-metas').textContent)); eq(t.erros, []);
  });
  const cenObs = () => {
    const A = cenario(); A.as('owner@x.com'); A.call('migrarV10');
    for (let i = 0; i < 3; i++) A.audit('aud1@x.com', 'Expedição', { conf: 5, f: { doca: '07', colaboradores: ['Carla Dias'], observacoes: i ? '' : 'Doca <b>suja</b> na entrada' } });
    A.run('gerarPendenciasFeedback_()'); return A;
  };
  await TA('observação do auditor aparece no feedback do Site Leader e de quem dá o feedback (escapada)', async () => {
    const A = cenObs(); A.as('sl@x.com'); const p = A.call('listarFeedbacks').pendencias[0];
    eq(p.auditorias.filter((x) => x.obs).map((x) => x.obs), ['Doca <b>suja</b> na entrada']);
    const t = await abrir(A, 'sl@x.com'); await t.nav('programacao'); await aba(t, 'feedbacks');
    ok(/Observação: Doca <b>suja<\/b> na entrada/.test(t.$('#plLista-feedbacks').textContent)); ok(!t.$('#plLista-feedbacks b b, .fb-obs b'), 'HTML não escapado');
    A.as('sl@x.com'); A.call('designarFeedback', p.id, 'aud2@x.com');
    A.as('aud2@x.com'); eq(A.call('meusFeedbacks')[0].auditorias.filter((x) => x.obs).length, 1);
    const d = await abrir(A, 'aud2@x.com'); await d.nav('feedbacks'); ok(/Observação: Doca/.test(d.$('#v-feedbacks').textContent)); eq(t.erros, []); eq(d.erros, []);
  });
  console.log('Cliente v10 fase 3 (feedback): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
