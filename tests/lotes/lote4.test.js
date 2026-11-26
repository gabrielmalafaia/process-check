/* Lote 4 da revisão v10 (desempenho): mede chamadas à planilha e células lidas, e o pulso único do cliente. */
const { criarAmbiente, teste, eq, resumo } = require('./harness');

function base(op) {
  const env = criarAmbiente(op);
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', ''], ['aud@x.com', 'Auditora', 'Auditor', 'Sim', '']]);
  return env;
}
const zerar = (s) => Object.keys(s.stats).forEach((k) => { s.stats[k] = 0; });

console.log('H7: gravação com menos chamadas à planilha');
teste('anexar formata as colunas de texto com uma chamada só', () => {
  const env = base();
  const s = env.abas.Auditorias_Historico;
  zerar(s);
  env.run("anexar_('Auditorias_Historico', ['AUD-1', '2026-11-24 10:00:00', 'Recebimento', '01', '', '', 'T1', 'X', 100, 'ok', '', '{}', 'a@x.com', '', 'N'])");
  eq(s.stats.setNumberFormat, 1, 'chamadas de formatação');
});
teste('cabeçalho do histórico é conferido uma vez e depois fica em cache', () => {
  const env = base();
  const s = env.abas.Auditorias_Historico;
  env.run('prepararHist_()');
  zerar(s);
  env.run('prepararHist_()');
  eq(s.stats.getRange, 0, 'segunda conferência não lê a planilha');
});
teste('aba_ guarda a aba na execução (não procura de novo a cada uso)', () => {
  const env = base();
  env.run("__busca = 0; __ss = SpreadsheetApp.getActive(); __orig = __ss.getSheetByName; __ss.getSheetByName = function (n) { __busca++; return __orig(n); }");
  env.run("aba_('Cad_Pessoas'); aba_('Cad_Pessoas'); aba_('Cad_Pessoas')");
  eq(env.run('__busca') <= 1, true, 'buscas: ' + env.run('__busca'));
});

console.log('H8: rascunho sem ler a aba inteira (nem o JSON dos outros)');
function comRascunhos(env, n) {
  const big = JSON.stringify({ resp: 'x'.repeat(2000) });
  const ls = [];
  for (let i = 0; i < n; i++) ls.push(env.linha('Auditorias_Rascunho', { ID_Rascunho: 'R' + i, Timestamp_Inicio: env.run('agora_()'), Auditor_Email: 'outro' + i + '@x.com', Processo: 'Recebimento', Doca_Cluster: String(i), Json_Respostas_Parciais: big }));
  env.linhas('Auditorias_Rascunho', ls);
}
teste('salvar rascunho lê só as colunas de chave (nada do JSON dos outros)', () => {
  const env = base();
  comRascunhos(env, 200);
  const s = env.abas.Auditorias_Rascunho;
  zerar(s);
  env.ctx.__p = { processo: 'Recebimento', chave: '01', estado: { resp: { 2: true } } };
  env.run('salvarRascunho(__p)');
  eq(s.stats.getDataRange, 0, 'não lê a aba inteira');
  eq(s.stats.celulasLidas <= 200 * 5 + 10, true, 'células lidas: ' + s.stats.celulasLidas);
});
teste('salvar de novo atualiza o mesmo rascunho (não cria outro)', () => {
  const env = base();
  comRascunhos(env, 3);
  env.ctx.__p = { processo: 'Recebimento', chave: '01', estado: { a: 1 } };
  const id1 = env.run('salvarRascunho(__p)');
  env.ctx.__p = { processo: 'Recebimento', chave: '01', estado: { a: 2 } };
  const id2 = env.run('salvarRascunho(__p)');
  eq(id2, id1);
  eq(env.abas.Auditorias_Rascunho.linhas.length, 5);
  eq(env.run("getRascunho('Recebimento', '01')"), { a: 2 });
});
teste('descartar remove só o rascunho do próprio auditor', () => {
  const env = base();
  comRascunhos(env, 3);
  env.ctx.__p = { processo: 'Recebimento', chave: '1', estado: { a: 1 } };
  env.run('salvarRascunho(__p)');
  env.run("descartarRascunho('Recebimento', '1')");
  const ls = env.abas.Auditorias_Rascunho.linhas.slice(1);
  eq(ls.length, 3);
  eq(ls.some((l) => l[2] === 'outro1@x.com'), true, 'o de outro auditor com a mesma chave continua');
});
teste('com Hubs ligados, o rascunho de outro Hub com a mesma chave não é tocado', () => {
  const env = criarAmbiente({ props: { HUBS_ATIVO: 'Sim' } });
  env.linhas('Cad_Hubs', [['H1', 'Hub 1', 'Op', 'Sim'], ['H2', 'Hub 2', 'Op', 'Sim']]);
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '*']]);
  env.props.set('hubAtivo:admin@x.com', 'H1');
  env.linhas('Auditorias_Rascunho', [env.linha('Auditorias_Rascunho', { ID_Rascunho: 'RH2', Timestamp_Inicio: env.run('agora_()'), Auditor_Email: 'admin@x.com', Processo: 'Recebimento', Doca_Cluster: '01', Json_Respostas_Parciais: '{"h":2}', Hub: 'H2' })]);
  env.ctx.__p = { processo: 'Recebimento', chave: '01', estado: { h: 1 } };
  const id = env.run('salvarRascunho(__p)');
  eq(id !== 'RH2', true, 'criou um rascunho no H1');
  eq(env.abas.Auditorias_Rascunho.linhas[1][5], '{"h":2}', 'o do H2 continua igual');
});

teste('se a linha do rascunho mudar entre achar e ler, não devolve o rascunho de outro auditor', () => {
  const env = base();
  comRascunhos(env, 3); // linhas 2..4 de outros auditores
  env.ctx.__p = { processo: 'Recebimento', chave: '01', estado: { meu: 1 } };
  env.run('salvarRascunho(__p)');
  env.run("__orig = localizarRascunhos_; localizarRascunhos_ = function () { return __orig.apply(null, arguments).map(function (r) { r._row = 2; return r; }); }"); // a linha "desceu"
  eq(env.run("getRascunho('Recebimento', '01')"), null);
});
teste('cabeçalho do histórico apagado à mão é refeito mesmo com o cache', () => {
  const env = base();
  env.run('prepararHist_()');
  env.abas.Auditorias_Historico.linhas.length = 0; // alguém limpou a aba
  env.run('prepararHist_()');
  eq(env.abas.Auditorias_Historico.linhas[0][0], 'ID_Auditoria');
});

console.log('H9: um pulso só traz presença e contadores');
teste('pulso devolve os contadores que o perfil pode ver', () => {
  const env = base();
  const r = env.run('pulso()');
  eq(typeof r.fb, 'object', 'feedbacks');
  eq(typeof r.pend, 'number', 'pendentes (Admin autoriza)');
  eq(typeof r.online, 'number', 'online (Admin vê)');
});
teste('perfil sem permissão não recebe os contadores dos outros', () => {
  const env = base({ ativo: 'aud@x.com' });
  const r = env.run('pulso()');
  eq(r.pend === undefined && r.online === undefined, true);
});
teste('um contador com erro não derruba o pulso (os outros chegam)', () => {
  const env = base();
  env.run("pendentes_ = function () { throw new Error('falha simulada'); }");
  const r = env.run('pulso()');
  eq(r.ok, true);
  eq(r.pend, undefined);
  eq(typeof r.fb, 'object');
});

resumo();
