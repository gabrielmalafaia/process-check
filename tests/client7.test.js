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
  console.log('Cliente v8 (Hub, online, log, carga, aceite): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x)); process.exit(R.f.length ? 1 : 0);
})();
