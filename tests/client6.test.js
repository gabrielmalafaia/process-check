// v7.2: perda de dado do usuário e estado errado na tela (revisão ECC).
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir, sleep } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const marca = (t, i, v) => { const r = t.$$('#v-form input[data-q][value="' + (v || '1') + '"]')[i || 0]; r.checked = true; t.ev(r, 'change'); };
const respostas = t => Object.keys(t.win.__S.F.resp).length;
(async () => {
  const A = cenario();
  const abrirForm = async (user) => { const t = await abrir(A, user || 'aud1@x.com'); await t.nav('form'); t.set('#v-form [data-f="processo"]', 'Recebimento'); await t.idle(); t.set('#v-form [data-f="doca"]', '36'); await t.idle(); return t; };

  await TA('formulário: trocar a doca mantém as respostas já marcadas (não apaga em silêncio)', async () => {
    const t = await abrirForm(); marca(t, 0); marca(t, 1, '0'); eq(respostas(t), 2);
    t.set('#v-form [data-f="doca"]', '01'); await t.idle();
    eq(respostas(t), 2, 'as respostas foram apagadas ao trocar a doca'); eq(t.$$('#v-form input[data-q]:checked').length, 2);
  });
  await TA('formulário: rascunho que chega atrasado não sobrescreve o que a pessoa acabou de marcar', async () => {
    A.as('aud1@x.com'); A.call('salvarRascunho', { processo: 'Recebimento', chave: '07', estado: { colaboradores: [], lider: '', turno: '', obs: 'texto antigo', resp: {} } });
    const t = await abrirForm(); t.set('#v-form [data-f="doca"]', '07'); marca(t, 0); await t.idle();
    eq(respostas(t), 1, 'a marcação foi perdida'); eq(t.win.__S.F.obs, '', 'o rascunho antigo sobrescreveu a observação'); ok(/rascunho/i.test(t.toast()), t.toast());
  });
  await TA('formulário: sem respostas na tela, o rascunho da nova doca é carregado normalmente', async () => {
    const t = await abrirForm(); t.set('#v-form [data-f="doca"]', '07'); await t.idle();
    eq(t.win.__S.F.obs, 'texto antigo');
  });
  await TA('formulário: falha ao salvar o rascunho não deixa o indicador preso em "Salvando…"', async () => {
    const t = await abrirForm(); const orig = A.ctx.salvarRascunho; A.ctx.salvarRascunho = () => { throw new Error('falha simulada'); };
    try { marca(t, 0); await sleep(1500); await t.idle(); } finally { A.ctx.salvarRascunho = orig; }
    ok(/Falha ao salvar/.test(t.$('#sv').textContent), t.$('#sv').textContent);
  });
  await TA('formulário: se a leitura do rascunho falhar, o salvamento automático fica pausado (não sobrescreve o rascunho do servidor)', async () => {
    const t = await abrirForm(); const orig = A.ctx.getRascunho; A.ctx.getRascunho = () => { throw new Error('falha simulada'); };
    try { t.set('#v-form [data-f="doca"]', '07'); await t.idle(); } finally { A.ctx.getRascunho = orig; }
    const n0 = t.chamadas.filter(c => c[0] === 'salvarRascunho').length; marca(t, 0); await sleep(1500); await t.idle();
    eq(t.chamadas.filter(c => c[0] === 'salvarRascunho').length, n0, 'gravou rascunho por cima sem ter lido o anterior');
    ok(/pausado/.test(t.$('#sv').textContent), t.$('#sv').textContent);
  });
  await TA('formulário: responder um item limpa o aviso de "itens pendentes"', async () => {
    const t = await abrirForm(); t.set('#v-form [data-f="turno"]', 'T1'); await t.click('#bFin'); ok(t.$('#falerta'), 'aviso deveria aparecer');
    for (let i = 0; i < t.$$('#v-form .item').length; i++) marca(t, i); await t.idle();
    ok(!t.$('#falerta'), 'aviso continuou depois de responder tudo');
  });
  await TA('Indução: abrir outro card antes da resposta do primeiro não mistura os formulários', async () => {
    A.as('aud1@x.com'); A.call('salvarRascunho', { processo: 'Indução', chave: 'Ana Souza', estado: { colaboradores: ['Ana Souza'], lider: 'Carlos Lider', turno: 'T1', obs: 'do Carlos', resp: {} } });
    const t = await abrir(A, 'aud1@x.com'); await t.nav('matriz');
    t.win.eval("abrirForm('Indução', 'Carlos Lider')"); t.win.eval("abrirForm('Indução', 'Dora Lider')"); await t.idle();
    const F = t.win.__S.F; eq(F.lider, 'Dora Lider'); ok(F.colaboradores.indexOf('Ana Souza') < 0, 'colaborador de outro líder apareceu no card da Dora'); eq(F.obs, '');
  });
  await TA('filtros: período inválido restaura as datas e mantém o período anterior', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('geral'); const f0 = { de: t.win.__S.flt.de, ate: t.win.__S.flt.ate };
    t.set('#f-de', '2099-01-01', 'change'); await t.idle();
    eq([t.$('#f-de').value, t.$('#f-ate').value], [f0.de, f0.ate]); eq([t.win.__S.flt.de, t.win.__S.flt.ate], [f0.de, f0.ate]);
    t.set('#f-de', '', 'change'); await t.idle(); eq(t.$('#f-de').value, f0.de);
  });
  await TA('menu: clicar na tela atual dentro de um detalhe volta para a lista', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('colab'); await t.click(t.$$('#v-colab tr[data-det]')[0]); ok(t.win.__S.det, 'detalhe não abriu');
    await t.nav('colab'); eq(t.win.__S.det, null); ok(t.$$('#v-colab tr[data-det]').length > 0, 'a lista não voltou');
  });
  await TA('exportação: tela redesenhada durante o envio mantém o botão bloqueado e o arquivo usa o período pedido', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('export'); const de = t.win.__S.flt.de, ate = t.win.__S.flt.ate;
    t.$('#exp-go').click(); t.win.eval('renderExport()'); ok(t.$('#exp-go').disabled, 'botão liberado durante a exportação');
    t.win.__S.flt.de = '2000-01-01'; await t.idle(); await sleep(50); await t.idle();
    eq(t.win.__download, 'auditorias_' + de + '_' + ate + '.csv'); ok(!t.$('#exp-go').disabled, 'botão não voltou ao normal');
  });
  await TA('colaboradores: a busca age só na tabela do próprio cartão (Equipes não some)', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('colab');
    const outras = t.$$('#v-colab table').filter(tb => !tb.closest('.card').querySelector('[data-busca]')), antes = outras.map(tb => tb.querySelectorAll('tbody tr').length);
    ok(outras.length > 0, 'esperava outra tabela na tela'); t.set('#v-colab [data-busca]', 'zzzz', 'input');
    eq(outras.map(tb => tb.querySelectorAll('tbody tr:not(.hidden)').length), antes);
  });
  await TA('Acessos: armar a exclusão não apaga o formulário em preenchimento', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos'); t.set('[data-u="Email_Google"]', 'digitando@x.com', 'input');
    t.$$('#v-acessos [data-ux]')[0].click(); await t.idle();
    eq(t.$('[data-u="Email_Google"]').value, 'digitando@x.com'); ok(/Confirmar/.test(t.$$('#v-acessos [data-ux]')[0].textContent));
  });
  await TA('Acessos: a consulta automática de pendentes não redesenha a tela (edição em curso fica)', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos'); t.set('[data-u="Email_Google"]', 'digitando@x.com', 'input');
    t.win.__S.pend = -5; t.win.eval('sondar()'); await t.idle();
    eq(t.$('[data-u="Email_Google"]').value, 'digitando@x.com');
  });
  await TA('Acessos: terminar de salvar depois de trocar de aba não desenha a aba errada', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos');
    t.set('[data-u="Email_Google"]', 'nova.aba@x.com', 'input'); t.set('[data-u="Nome"]', 'Nova Aba', 'input'); t.set('[data-u="Perfil"]', 'Auditor');
    t.$('#uSalvar').click(); await t.click('#v-acessos [data-at="log"]'); await t.idle();
    ok(!t.$('#acBody [data-u="Email_Google"]'), 'o formulário de usuários apareceu sobre a aba Log');
  });
  await TA('e-mail do relatório: duas alterações seguidas na mesma linha não revertem uma à outra', async () => {
    A.as('owner@x.com'); A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Semanal', idioma: 'pt' });
    const t = await abrir(A, 'owner@x.com'); await t.nav('cfg'); await t.idle();
    const linha = () => t.$('#emailRel tr[data-em="sl@x.com"]');
    t.set(linha().querySelector('[data-ef="freq"]'), 'Mensal', 'change'); t.set(linha().querySelector('[data-ef="idioma"]'), 'en', 'change'); await t.idle();
    const l = A.call('listarEmailRel').linhas.find(x => x.email === 'sl@x.com'); eq([l.freq, l.idioma], ['Mensal', 'en']);
  });
  await TA('e-mail do relatório: se o envio falhar, o botão volta ao rótulo original', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('cfg'); await t.idle();
    const orig = A.ctx.enviarRelatorioAgora; A.ctx.enviarRelatorioAgora = () => { throw new Error('falha simulada'); };
    try { await t.click('#emailRel [data-eagora]'); } finally { A.ctx.enviarRelatorioAgora = orig; }
    const b = t.$('#emailRel [data-eagora]'); ok(b && !/Enviando/.test(b.textContent) && !b.disabled, b && b.textContent);
  });
  console.log('Cliente v7.2 (perda de dado e estado errado):', R.ok, 'passaram,', R.f.length, 'falharam'); R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
