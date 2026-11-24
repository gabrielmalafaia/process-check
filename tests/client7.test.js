// Cliente v8: Hub no cabeçalho, online, log, aba Hubs, carga em massa, aviso de aceite e cadastro com Hub/Turno.
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const dois = () => {
  const A = cenario(); A.as('owner@x.com');
  A.ctx.anexar_('Cad_Hubs', ['H1', 'Hub Um', 'Operação A', 'Sim']); A.ctx.anexar_('Cad_Hubs', ['H2', 'Hub Dois', 'Operação B', 'Sim']);
  A.call('ativarHubs');
  A.ctx.anexar_('Cad_Usuarios', ['sl2@x.com', 'Sandra Dois', 'Site Leader', 'Sim', 'H2']); A.run('limparCache_()');
  return A;
};
(async () => {
  await TA('Admin global: cabeçalho com seletor de Hub, botão Online e tela de Log', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com');
    ok(!t.$('#hubChip').classList.contains('hidden')); ok(t.$('#hubSel'), 'seletor de Hub'); eq(t.$$('#hubSel option').length, 2);
    ok(!t.$('#onlineBtn').classList.contains('hidden'));
    ok(t.chamadas.some(c => c[0] === 'pulso'), 'envia o pulso ao entrar');
    await t.nav('log'); await t.idle(); ok(t.$('#v-log').textContent.includes('Log de atividade')); ok(t.$('#lgForm [data-lf="hub"]'), 'filtro por Hub'); eq(t.erros, []);
  });
  await TA('Site Leader: vê o próprio Hub fixo (sem seletor) e o Log sem filtro de Hub', async () => {
    const A = dois(); const t = await abrir(A, 'sl2@x.com');
    ok(t.$('#hubChip').textContent.includes('Hub Dois')); ok(!t.$('#hubSel'));
    await t.nav('log'); await t.idle(); ok(!t.$('#lgForm [data-lf="hub"]')); eq(t.erros, []);
  });
  await TA('Online: lista os usuários e fecha pelo botão', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com'); await t.click('#onlineBtn');
    ok(t.$('#modal') && /Usuários online/.test(t.$('#modal').textContent)); eq(t.erros, []);
  });
  await TA('Aba Hubs: só Admin global; cria um Hub e a lista mostra', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com'); await t.nav('acessos');
    const b = t.$('#v-acessos .tabs [data-at="hubs"]'); ok(b, 'aba Hubs'); await t.click(b);
    t.set('#acBody [data-h="nome"]', 'Hub Tres', 'input'); t.set('#acBody [data-h="operacao"]', 'Operação C', 'input'); await t.click('#hbSalvar');
    ok(t.$('#acBody').textContent.includes('Hub Tres'), t.$('#acBody').textContent.slice(0, 200)); eq(t.erros, []);
    const s = await abrir(A, 'sl2@x.com'); await s.nav('acessos'); ok(!s.$('#v-acessos .tabs [data-at="hubs"]'));
  });
  await TA('Formulário de usuário do Admin global tem o campo Hub obrigatório', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com'); await t.nav('acessos');
    ok(t.$('#acBody [data-u="Hub"]'), 'campo Hub'); eq(t.erros, []);
  });
  await TA('Carga em massa: erros com linha e coluna; nada gravado; depois grava', async () => {
    const A = dois(); const t = await abrir(A, 'sl2@x.com'); await t.nav('cad');
    await t.click('#v-cad [data-t="Cad_Pessoas"]'); const b = t.$('#btnCarga'); ok(b, 'botão de carga em massa'); await t.click(b);
    t.$('#cgTexto').value = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nAna Nova\tAuditor\tT9\tSim\t'; await t.click('#cgValidar');
    ok(/Nada foi gravado/.test(t.$('#cgRes').textContent) && /Linha 2/.test(t.$('#cgRes').textContent), t.$('#cgRes').textContent);
    ok(t.$('#cgGravar').classList.contains('hidden'));
    await t.click('#cgModelo');
    t.$('#cgTexto').value = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nLider Novo\tLíder\tT1\tSim\t'; await t.click('#cgValidar');
    ok(!t.$('#cgGravar').classList.contains('hidden'), t.$('#cgRes').textContent); await t.click('#cgGravar');
    A.as('sl2@x.com'); ok(A.call('lerBruto_', 'Cad_Pessoas').some(p => p.Nome === 'Lider Novo' && p.Hub === 'H2')); eq(t.erros, []);
  });
  await TA('Aviso de transparência: bloqueia o app até aceitar; depois entra', async () => {
    const A = dois(); A.as('owner@x.com'); A.call('ativarAvisoLog'); A.run('limparCache_()');
    const t = await abrir(A, 'sl2@x.com');
    ok(t.$('#avisoTela'), 'aviso na tela'); ok(t.$('#app').classList.contains('hidden'));
    await t.click('#avAceitar');
    ok(!t.$('#avisoTela')); ok(!t.$('#app').classList.contains('hidden'), 'app liberado'); eq(t.erros, []);
  });
  await TA('Cadastro: Hub obrigatório e Turno só para Líder', async () => {
    const A = dois(); const t = await abrir(A, 'novo@x.com');
    ok(t.$('#login') && !t.$('#login').classList.contains('hidden'));
    ok(t.win.__S.bl.hubs.length === 2, 'lista de Hubs no login');
    t.win.eval("abrirCadastro && abrirCadastro()");
    ok(!t.$('#cdHubW').classList.contains('hidden')); ok(t.$('#cdTurnoW').classList.contains('hidden'));
    t.set('#cdCargo', 'Líder'); ok(!t.$('#cdTurnoW').classList.contains('hidden')); eq(t.erros, []);
  });
  await TA('Login sempre aparece na primeira visita da sessão e só entra depois de Entrar com Google', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com', { gate: true });
    ok(!t.$('#login').classList.contains('hidden'), 'tela de login'); ok(t.$('#app').classList.contains('hidden'), 'app oculto');
    ok(t.$('#lgEmail').textContent === 'owner@x.com');
    await t.click('#lgGoogle'); ok(!t.$('#app').classList.contains('hidden'), 'entrou'); eq(t.erros, []);
  });
  await TA('Login: e-mail não cadastrado vê o aviso de acesso, sem entrar', async () => {
    const A = dois(); const t = await abrir(A, 'fora@outra.com', { gate: true });
    ok(!t.$('#login').classList.contains('hidden')); ok(t.$('#app').classList.contains('hidden')); ok(/Login não encontrado/.test(t.$('#modal').textContent)); eq(t.erros, []);
  });
  await TA('Usar outra conta Google: abre o seletor de contas da página inteira (target _top)', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com', { gate: true });
    const vistos = []; t.win.HTMLAnchorElement.prototype.click = function () { vistos.push([this.href, this.target]); };
    await t.click('#lgOutra');
    eq(vistos.length, 1, 'nada aconteceu ao clicar'); ok(vistos[0][0].indexOf('https://accounts.google.com/AccountChooser?continue=') === 0, vistos[0][0]); eq(vistos[0][1], '_top');
    ok(decodeURIComponent(vistos[0][0]).indexOf('/exec') > 0, 'continua para o endereço do app'); eq(t.erros, []);
  });
  await TA('Trocar de Hub: sem recarregar, mostra o novo Hub e os dados dele; Atualizar enxerga Hub novo', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com'); let recarregou = false;
    t.win.__S.u.hub; const l0 = t.$$('#hubSel option').length; eq(l0, 2);
    t.set('#hubSel', 'H2'); await t.idle();
    ok(t.$('#hubChip').textContent.includes('Operação B'), t.$('#hubChip').textContent); eq(t.$('#hubSel').value, 'H2'); ok(!t.$('#hubSel').disabled);
    ok(!t.$('#app').classList.contains('hidden'), 'tela não pode ficar em branco'); ok(t.$('.view:not(.hidden)'), 'há uma tela visível');
    ok(t.chamadas.some(c => c[0] === 'definirHubAtivo' && c[1][0] === 'H2'));
    A.sheets.Cad_Hubs.appendRow(['H3', 'Hub Tres', 'Operação C', 'Sim']);
    await t.click('#refresh'); eq(t.$$('#hubSel option').length, 3, 'Atualizar deve trazer o Hub novo'); eq(t.$('#hubSel').value, 'H2'); eq(t.erros, []);
  });
  await TA('Revisão 2: Atualizar com aviso pendente ou usuário desativado não corrompe o estado; ao aceitar, volta ao app', async () => {
    const A = dois(); const t = await abrir(A, 'sl2@x.com'); ok(t.win.__S.procs.length > 0);
    A.as('owner@x.com'); A.call('ativarAvisoLog'); A.run('limparCache_()');
    await t.click('#refresh'); ok(t.$('#avisoTela'), 'aviso aparece no meio da sessão'); ok(t.win.__S.procs.length > 0, 'estado do cliente intacto');
    await t.click('#avAceitar'); ok(!t.$('#avisoTela')); ok(!t.$('#app').classList.contains('hidden')); eq(t.erros, []);
  });
  await TA('Revisão 2: chamada que falha por aceite pendente leva à tela de aceite', async () => {
    const A = dois(); const t = await abrir(A, 'sl2@x.com'); A.as('owner@x.com'); A.call('ativarAvisoLog'); A.run('limparCache_()');
    await t.nav('log'); await t.idle(); await t.idle(); ok(t.$('#avisoTela'), 'tela de aceite'); eq(t.erros, []);
  });
  await TA('Revisão 2: trocar de Hub com falha no servidor desfaz a troca e avisa; seletor volta ao Hub real', async () => {
    const A = dois(); const t = await abrir(A, 'owner@x.com'); const orig = A.ctx.bootstrap; let n = 0;
    A.ctx.bootstrap = function (f) { if (++n === 1) throw new Error('tempo esgotado'); return orig(f); };
    t.set('#hubSel', 'H2'); await t.idle(); await t.idle();
    eq(t.$('#hubSel').value, 'H1', 'seletor deve voltar ao Hub real'); ok(/não foi trocado/i.test(t.$('#toast') ? t.$('#toast').textContent : t.doc.body.textContent));
    A.as('owner@x.com'); eq(A.call('bootstrap', false).user.hub.id, 'H1', 'o servidor foi revertido'); eq(t.erros, []);
  });
  await TA('Revisão 2: Gravar da carga em massa some ao editar o texto validado', async () => {
    const A = dois(); const t = await abrir(A, 'sl2@x.com'); await t.nav('cad'); await t.click('#v-cad [data-t="Cad_Pessoas"]'); await t.click('#btnCarga');
    t.$('#cgTexto').value = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nLider Dois\tLíder\tT1\tSim\t'; await t.click('#cgValidar'); ok(!t.$('#cgGravar').classList.contains('hidden'));
    t.$('#cgTexto').value += ' x'; t.ev(t.$('#cgTexto'), 'input'); ok(t.$('#cgGravar').classList.contains('hidden'), 'Gravar deve esconder'); eq(t.erros, []);
  });
  await TA('Revisão 2: Tentar novamente refaz o carregamento sem recarregar a página', async () => {
    const A = dois(); let falhas = 1; const orig = A.ctx.bootstrap; A.ctx.bootstrap = function (f) { if (falhas-- > 0) throw new Error('indisponível'); return orig(f); };
    const t = await abrir(A, 'owner@x.com'); ok(!t.$('#plRetry').classList.contains('hidden'), 'botão de nova tentativa');
    await t.click('#plRetry'); await t.idle(); ok(!t.$('#app').classList.contains('hidden'), 'app abre depois de tentar de novo'); eq(t.$$('#hubSel').length, 1);
  });
  await TA('Sessão: depois de entrar, uma aba nova da mesma conta entra direto; outra conta ou sessão vencida pede o login', async () => {
    const A = dois(); const t1 = await abrir(A, 'owner@x.com', { gate: true }); await t1.click('#lgGoogle');
    const guardado = t1.win.localStorage ? t1.win.localStorage.getItem('pc_sess') : (t1.win.__pcMem || {}).pc_sess; ok(guardado, 'sessão gravada');
    ok(JSON.parse(guardado).e === 'owner@x.com');
    const semanaVelha = JSON.stringify({ e: 'owner@x.com', t: Date.now() - 9 * 3600000 }), outra = JSON.stringify({ e: 'outro@x.com', t: Date.now() });
    const t2 = await abrir(A, 'owner@x.com', { gate: true, sess: guardado }); ok(!t2.$('#app').classList.contains('hidden'), 'aba nova da mesma conta entra direto'); ok(t2.$('#login').classList.contains('hidden'));
    const t3 = await abrir(A, 'owner@x.com', { gate: true, sess: outra }); ok(!t3.$('#login').classList.contains('hidden'), 'outra conta pede login');
    const t4 = await abrir(A, 'owner@x.com', { gate: true, sess: semanaVelha }); ok(!t4.$('#login').classList.contains('hidden'), 'sessão vencida pede login'); eq(t2.erros, []);
  });
  await TA('Revisão 4: sessão com relógio adiantado não vale; Hub trocado em outra aba limpa o estado do formulário', async () => {
    const A = dois(); const futuro = JSON.stringify({ e: 'owner@x.com', t: Date.now() + 30 * 86400000 });
    const t = await abrir(A, 'owner@x.com', { gate: true, sess: futuro }); ok(!t.$('#login').classList.contains('hidden'), 'sessão do futuro pede login');
    const u = await abrir(A, 'owner@x.com'); u.win.__S.F = { lider: 'Carlos Lider' }; u.win.__S.flt.lider = 'Carlos Lider';
    A.as('owner@x.com'); A.call('definirHubAtivo', 'H2'); await u.click('#refresh'); await u.idle();
    ok(u.win.__S.F === null, 'formulário do Hub anterior descartado'); eq(u.win.__S.flt.lider, ''); eq(u.$('#hubSel').value, 'H2'); eq(u.erros, []);
  });
  console.log('Cliente v8 (Hub, online, log, carga, aceite): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
