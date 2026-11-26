/* Lote 3 da revisão v10 (passo das 22h): cada teste reproduz um achado (falha antes da correção, passa depois). */
const { criarAmbiente, teste, eq, lanca, resumo } = require('./harness');

/** Execução pelo gatilho: sem usuário ativo, às 23h, hubs desligados. */
function gatilho(op = {}) {
  const env = criarAmbiente(Object.assign({ ativo: '', efetivo: 'dono@x.com', hora: 23 }, op));
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', ''], ['lider@x.com', 'Lia Lima', 'Auditor', 'Sim', '']]);
  return env;
}
/** Troca os três passos noturnos por espiões que anotam a chamada e o prazo recebido. */
function espiar(env, falha) {
  env.run("__chamadas = []; ['reenviarAvisosMetas_', 'gerarFeedbackTodosHubs_', 'reenviarAvisosFeedback_'].forEach(function (n) { this[n] = function (prazo) { __chamadas.push([n, prazo]); if (n === __falha) throw new Error('falha simulada em ' + n); return 0; }; }, this)".replace('__falha', JSON.stringify(falha || '')));
  return () => env.run('__chamadas');
}

console.log('H6: passo noturno com gatilho próprio, prazo único e passos isolados');
teste('passoNoturno roda os três passos mesmo se o primeiro falhar, e conta a falha', () => {
  const env = gatilho();
  const chamadas = espiar(env, 'reenviarAvisosMetas_');
  env.run('passoNoturno()');
  eq(chamadas().map((c) => c[0]), ['reenviarAvisosMetas_', 'gerarFeedbackTodosHubs_', 'reenviarAvisosFeedback_']);
  eq(Number(env.props.get('LOG_FALHAS') || 0) >= 1, true, 'falha contada para a tela de Log');
});
teste('todos os passos recebem o mesmo prazo, dentro do limite de 6 min', () => {
  const env = gatilho();
  const chamadas = espiar(env);
  const ini = Date.now();
  env.run('passoNoturno()');
  const prazos = chamadas().map((c) => c[1]);
  eq(prazos.every((p) => p === prazos[0]), true, 'prazo único');
  eq(prazos[0] > ini && prazos[0] <= ini + 340000, true, 'prazo até ~5,5 min');
});
teste('passoNoturno chamado pelo navegador é negado', () => {
  const env = gatilho({ ativo: 'admin@x.com' });
  espiar(env);
  lanca(() => env.run('passoNoturno()'), /Acesso negado/);
});
teste('relatório agendado não roda os passos noturnos quando o gatilho próprio existe', () => {
  const env = gatilho({ gatilhos: ['enviarRelatoriosAgendados', 'passoNoturno'] });
  const chamadas = espiar(env);
  env.run('enviarRelatoriosAgendados()');
  eq(chamadas().length, 0);
});
teste('sem o gatilho próprio (publicação antiga), o relatório ainda roda os passos noturnos', () => {
  const env = gatilho({ gatilhos: ['enviarRelatoriosAgendados'] });
  const chamadas = espiar(env);
  env.run('enviarRelatoriosAgendados()');
  eq(chamadas().length, 3);
});
teste('ligar o agendamento cria o gatilho novo antes de apagar o antigo e garante o passo noturno', () => {
  const env = criarAmbiente({ gatilhos: ['enviarRelatoriosAgendados'] });
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '']]);
  env.run('alternarAgendamentoRel(true)');
  eq(env.eventos.indexOf('cria:enviarRelatoriosAgendados') < env.eventos.indexOf('apaga:enviarRelatoriosAgendados'), true, 'ordem: cria e depois apaga');
  eq(env.gatilhos.map((t) => t.getHandlerFunction()).sort(), ['enviarRelatoriosAgendados', 'passoNoturno']);
});
teste('se criar o gatilho falhar, o antigo continua', () => {
  const env = criarAmbiente({ gatilhos: ['enviarRelatoriosAgendados'], gatilhoFalha: true });
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '']]);
  lanca(() => env.run('alternarAgendamentoRel(true)'));
  eq(env.gatilhos.map((t) => t.getHandlerFunction()), ['enviarRelatoriosAgendados']);
});
teste('desligar o relatório não desliga o passo noturno', () => {
  const env = criarAmbiente({ gatilhos: ['enviarRelatoriosAgendados', 'passoNoturno'] });
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '']]);
  env.run('alternarAgendamentoRel(false)');
  eq(env.gatilhos.map((t) => t.getHandlerFunction()), ['passoNoturno']);
});

console.log('M15: fila de avisos que não trava');
const hojeMais = (env, d) => env.run('addDias_(hoje_(), ' + d + ')');
function meta(env, id, aviso) {
  return env.linha('Metas_Lider', { ID_Meta: id, Lider_Email: 'lider@x.com', Lider_Nome: 'Lia Lima', Quantidade: 5, Inicio: hojeMais(env, -1), Fim: hojeMais(env, 10), Criada_Por: 'admin@x.com', Criada_Em: '2026-11-01 10:00:00', Status: 'Ativa', Aviso_Em: aviso });
}
const avisoDe = (env, n) => String(env.abas.Metas_Lider.linhas[n][17]);
teste('aviso enviado fica com data (não "enviando")', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [meta(env, 'M1', '')]);
  eq(env.run('reenviarAvisosMetas_()'), 1);
  eq(/^\d{4}-\d{2}-\d{2} /.test(avisoDe(env, 1)), true, 'data do envio: ' + avisoDe(env, 1));
});
teste('reserva "enviando" antiga (envio morreu no meio) é tentada de novo; recente não', () => {
  const env = gatilho();
  const velho = env.run("fmt_(new Date(Date.now() - 2 * 3600000))"), recente = env.run('agora_()');
  env.linhas('Metas_Lider', [meta(env, 'M1', 'enviando ' + velho), meta(env, 'M2', 'enviando ' + recente)]);
  eq(env.run('reenviarAvisosMetas_()'), 1);
  eq(env.enviados.length, 1);
  eq(avisoDe(env, 2), 'enviando ' + recente, 'a recente não foi mexida');
});
teste('"sem destino" é reavaliado: destinatário reativado recebe o aviso', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [meta(env, 'M1', 'sem destino')]);
  eq(env.run('reenviarAvisosMetas_()'), 1);
  eq(env.enviados.length, 1);
});
teste('destinatário inválido vira "sem destino" com data e não para a fila', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [env.linha('Metas_Lider', { ID_Meta: 'M0', Lider_Email: 'saiu@x.com', Quantidade: 1, Inicio: hojeMais(env, -1), Fim: hojeMais(env, 5), Status: 'Ativa', Aviso_Em: '' }), meta(env, 'M1', '')]);
  eq(env.run('reenviarAvisosMetas_()'), 1);
  eq(avisoDe(env, 1).indexOf('sem destino ') === 0, true);
});
teste('erro inesperado num item não derruba o resto da fila', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [meta(env, 'M1', ''), meta(env, 'M2', '')]);
  env.run("__orig = avisarMetaLider_; avisarMetaLider_ = function (row, id) { if (id === 'M1') throw new Error('boom'); return __orig.apply(null, arguments); }");
  eq(env.run('reenviarAvisosMetas_()'), 1);
});
teste('prazo vencido para a fila e registra', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [meta(env, 'M1', '')]);
  eq(env.run('reenviarAvisosMetas_(Date.now() - 1)'), 0);
  eq(Number(env.props.get('LOG_FALHAS') || 0) >= 1, true);
});

teste('"sem destino" não sobrescreve um carimbo que mudou depois da leitura (ex.: reatribuído e avisado)', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [env.linha('Metas_Lider', { ID_Meta: 'M0', Lider_Email: 'saiu@x.com', Status: 'Ativa', Inicio: hojeMais(env, -1), Fim: hojeMais(env, 5), Aviso_Em: '2026-11-24 22:01:00' })]);
  env.run("__pend = lerBruto_('Metas_Lider').map(function (r) { r.Aviso_Em = ''; return r; })"); // leitura antiga, de antes do aviso
  env.run("reenviarFila_('teste', 'Metas_Lider', 18, __pend, function (r) { return emailDe_(r.Lider_Email); }, function () { return true; }, Infinity)");
  eq(avisoDe(env, 1), '2026-11-24 22:01:00');
});
teste('a cota acaba no meio: a fila para sem reservar os itens restantes', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [meta(env, 'M1', ''), meta(env, 'M2', '')]);
  env.run('__q = 100; MailApp.getRemainingDailyQuota = function () { var v = __q; __q = 5; return v; }');
  eq(env.run('reenviarAvisosMetas_()'), 0);
  eq([avisoDe(env, 1), avisoDe(env, 2)], ['', '']);
});
teste('e-mail com caractere proibido no envio vira "sem destino" (não fica pendente para sempre)', () => {
  const env = gatilho();
  env.linhas('Cad_Usuarios', [['a,b@x.com', 'Vírgula', 'Auditor', 'Sim', '']]);
  env.linhas('Metas_Lider', [env.linha('Metas_Lider', { ID_Meta: 'M9', Lider_Email: 'a,b@x.com', Status: 'Ativa', Quantidade: 1, Inicio: hojeMais(env, -1), Fim: hojeMais(env, 5), Aviso_Em: '' })]);
  env.run('reenviarAvisosMetas_()');
  eq(avisoDe(env, 1).indexOf('sem destino ') === 0, true);
});
teste('data do envio não gravada na 1ª tentativa é gravada na seguinte', () => {
  const env = gatilho();
  env.linhas('Metas_Lider', [meta(env, 'M1', '')]);
  env.run("__n = 0; __orig = comLock_; comLock_ = function (fn) { if (++__n === 2) throw new Error('Sistema ocupado'); return __orig(fn); }"); // 1ª = reserva, 2ª = data
  eq(env.run('reenviarAvisosMetas_()'), 1);
  eq(/^\d{4}-\d{2}-\d{2} /.test(avisoDe(env, 1)), true, 'carimbo: ' + avisoDe(env, 1));
});
teste('consulta de gatilhos falhando: ligar o agendamento não cria gatilho duplicado', () => {
  const env = criarAmbiente({ gatilhos: ['enviarRelatoriosAgendados', 'passoNoturno'] });
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '']]);
  env.run("ScriptApp.getProjectTriggers = function () { throw new Error('serviço fora'); }");
  lanca(() => env.run('alternarAgendamentoRel(true)'));
  eq(env.gatilhos.length, 2);
});
teste('consulta de gatilhos falhando: o relatório não roda os passos noturnos em dobro', () => {
  const env = gatilho({ gatilhos: ['enviarRelatoriosAgendados', 'passoNoturno'] });
  const chamadas = espiar(env);
  env.run("ScriptApp.getProjectTriggers = function () { throw new Error('serviço fora'); }");
  env.run('enviarRelatoriosAgendados()');
  eq(chamadas().length, 0);
});

console.log('M16: envio do relatório não troca o contexto de Hub de quem chamou');
teste('enviarUmRel_ restaura HUB_CTX', () => {
  const env = gatilho();
  env.set('HUB_CTX', { on: true, hub: 'H1', global: false });
  env.run("enviarUmRel_({ nome: 'X', email: 'dono@x.com' }, { Email: 'ninguem@x.com', Frequencia: 'Semanal', Idioma: 'pt' }, false)");
  eq(env.run('HUB_CTX.hub'), 'H1');
});

resumo();
