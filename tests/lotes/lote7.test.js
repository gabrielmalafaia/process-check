/* Lote 7 (pendências médias da revisão v10): cada teste reproduz um achado. */
const fs = require('fs');
const path = require('path');
const { criarAmbiente, teste, eq, lanca, resumo } = require('./harness');

function base(op) {
  const env = criarAmbiente(op);
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', ''], ['lider@x.com', 'Ana Lima', 'Auditor', 'Sim', '']]);
  return env;
}

console.log('M3: escopo "time" não pode ter dois usuários com o mesmo nome no Hub');
teste('criar usuário de perfil "time" com o nome de outro usuário é recusado', () => {
  const env = base();
  env.run("__p = perfis_()['Auditor']; __t = { nome: 'Lider', desc: '', perms: __p.perms, telas: __p.telas, escopo: { modo: 'time', processos: [], turnos: [] } }; salvarPerfil(__t, true)");
  env.ctx.__o = { Email_Google: 'outra@x.com', Nome: 'ana  LIMA', Perfil: 'Lider', Status_Ativo: 'Sim' };
  const r = env.run('salvarUsuario(__o, null)');
  eq(r.ok, false);
  eq(!!(r.erros && r.erros.Nome), true, JSON.stringify(r));
});

teste('homônimos que já existiam: dá para inativar um deles (a regra só barra quando a gravação cria o conflito)', () => {
  const env = base();
  env.run("__p = perfis_()['Auditor']; __t = { nome: 'Lider', desc: '', perms: __p.perms, telas: __p.telas, escopo: { modo: 'time', processos: [], turnos: [] } }; salvarPerfil(__t, true)");
  env.linhas('Cad_Usuarios', [['dup@x.com', 'Ana Lima', 'Lider', 'Sim', '']]); // legado: já existia com o mesmo nome
  env.ctx.__orig = { Email_Google: 'dup@x.com', Nome: 'Ana Lima', Perfil: 'Lider', Status_Ativo: 'Sim', Hub: '' };
  env.ctx.__o = Object.assign({ _row: 4 }, env.ctx.__orig, { Status_Ativo: 'Não' });
  eq(env.run('salvarUsuario(__o, __orig)').ok, true);
});

console.log('M5: regra ilegível nunca amplia a visão');
teste('regra inválida: o líder vê só as próprias auditorias (nem o próprio time)', () => {
  const env = base();
  env.linhas('Cad_Regras_Lider', [env.linha('Cad_Regras_Lider', { Email: 'lider@x.com', Proprio_Time: 'Nao', Outros_Times: 'Não', Ver_Proprio: 'Não', Ver_Outros: 'proprias' })]);
  const r = env.run("regraVisao_({ email: 'lider@x.com' })");
  eq([r.verProprio, r.outros], [false, false]);
});
teste('sem regra, o padrão continua (vê o próprio time)', () => {
  const env = base();
  eq(env.run("regraVisao_({ email: 'lider@x.com' }).verProprio"), true);
});

console.log('M6: cache de aba não volta velho depois de uma gravação');
teste('gravação tardia de um leitor (chave antiga) não é lida depois de limparCache_', () => {
  const env = base();
  env.linhas('Cad_Pessoas', [['Ana Lima', 'Líder', 'T1', 'Sim', '', '']]);
  const k0 = env.run("chaveAba_('Cad_Pessoas')");
  env.run('limparCache_()');
  env.cache.set(k0, JSON.stringify([{ _row: 2, Nome: 'VELHO', Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim', Lider: '' }]));
  eq(env.run("lerAba_('Cad_Pessoas')[0].Nome"), 'Ana Lima');
});
teste('fila de solicitações: gravação tardia com chave antiga não volta depois de limparSol_', () => {
  const env = base();
  const k0 = env.run("chaveAba_('Cad_Solicitacoes')");
  env.run('limparSol_()');
  env.cache.set(k0, JSON.stringify([{ _row: 2, ID: 'VELHA', Email: 'x@x.com', Status: 'Pendente' }]));
  eq(env.run("lerAba_('Cad_Solicitacoes').length"), 0);
});
teste('a mesma aba lida duas vezes na execução é buscada no cache uma vez só', () => {
  const env = base();
  env.run("lerAba_('Cad_Pessoas')");
  env.run("__g = 0; __c = CacheService.getScriptCache; CacheService.getScriptCache = function () { var c = __c(); var g = c.get; c.get = function (k) { if (/Cad_Pessoas/.test(k)) __g++; return g(k); }; return c; }");
  env.run("lerAba_('Cad_Pessoas'); lerAba_('Cad_Pessoas')");
  eq(env.run('__g') <= 1, true, 'leituras do cache: ' + env.run('__g'));
});

teste('quem mexe no que lerAba_ devolveu não contamina a próxima leitura na mesma execução', () => {
  const env = base();
  env.run("var l = lerAba_('Cad_Usuarios'); l[0].editavel = true; l.splice(0, 1)");
  eq(env.run("lerAba_('Cad_Usuarios')[0].editavel"), undefined);
  eq(env.run("lerAba_('Cad_Usuarios').length"), 2);
});

console.log('M10: respostas ligadas ao item certo mesmo se a ordem mudou');
function comAuditoria() {
  const env = base();
  env.linhas('Cad_Estrutura', [env.linha('Cad_Estrutura', { Tipo: 'Doca', Identificador: '01', Cor_Simbolo: 'Azul/Triângulo' })]);
  env.linhas('Cad_Processos_Perguntas', [
    env.linha('Cad_Processos_Perguntas', { Processo: 'Recebimento', ID_Subprocesso: 'R1', Descricao_Item: 'Item 1', Requisito_Critico: 'Não' }),
    env.linha('Cad_Processos_Perguntas', { Processo: 'Recebimento', ID_Subprocesso: 'R2', Descricao_Item: 'Item 2', Requisito_Critico: 'Não' }),
  ]);
  return env;
}
teste('item trocado de lugar depois de abrir o formulário: recusa em vez de gravar no item errado', () => {
  const env = comAuditoria();
  env.ctx.__p = { processo: 'Recebimento', doca: '01', turno: 'T1', respostas: [{ k: 2, id: 'R2', ok: true }, { k: 3, id: 'R1', ok: false }] };
  const r = env.run('salvarAuditoria(__p)');
  eq(r.ok, false);
  eq(/mudaram/.test(r.erros && r.erros.itens), true, JSON.stringify(r.erros));
  eq(env.abas.Auditorias_Historico.linhas.length, 1);
});
teste('formulário antigo (sem id nas respostas) continua funcionando', () => {
  const env = comAuditoria();
  env.ctx.__p = { processo: 'Recebimento', doca: '01', turno: 'T1', respostas: [{ k: 2, ok: true }, { k: 3, ok: false }] };
  eq(env.run('salvarAuditoria(__p)').ok, true);
});
teste('o cliente manda o id do item junto com a resposta', () => {
  const cli = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'JS_Client.html'), 'utf8');
  eq(/return \{ k: i\._row, id: i\.ID_Subprocesso,/.test(cli), true);
});

console.log('M11: vencimento da Matriz sem um dia a mais');
teste('7,9 dias com vida útil de 7 já está vencida; 7,0 ainda não', () => {
  const env = base();
  const agora = Date.parse('2026-11-24T12:00:00Z');
  eq(env.run("vencida_('2026-11-16 14:24:00', " + agora + ', 7)'), true);
  eq(env.run("vencida_('2026-11-17 12:00:00', " + agora + ', 7)'), false);
});

console.log('M12: registrar feedback desfaz tudo se o log falhar');
const TEXTO = 'Conversamos sobre a organização da doca, revisamos o checklist e combinamos ajustes na conferência diária com o colaborador.';
function comPendencia() {
  const env = base();
  env.linhas('Feedback_Pendencias', [env.linha('Feedback_Pendencias', { ID_Pend: 'FBK-1', Colaborador: 'Bia', Status: 'Designada', Designado_Email: 'admin@x.com', Designado_Nome: 'Admin', Designado_Por: 'sl@x.com', Designado_Em: '2026-11-20 10:00:00', Prazo: '2026-11-27' })]);
  return env;
}
teste('log falha: nenhum registro novo, pendência continua Designada e a âncora não muda', () => {
  const env = comPendencia();
  env.quebrar('Log_Permissoes');
  env.ctx.__t = TEXTO;
  lanca(() => env.run("registrarFeedback('FBK-1', __t)"));
  eq(env.abas.Feedback_Registros.linhas.length, 1, 'registros');
  eq(env.abas.Feedback_Pendencias.linhas[1][11], 'Designada');
  eq(env.props.get('fbAncora') || '', '');
});
teste('regressão: com log funcionando, registra e conclui', () => {
  const env = comPendencia();
  env.ctx.__t = TEXTO;
  eq(env.run("registrarFeedback('FBK-1', __t)").ok, true);
  eq(env.abas.Feedback_Pendencias.linhas[1][11], 'Concluida');
  eq(env.abas.Feedback_Registros.linhas.length, 2);
});

console.log('M13: mover e restaurar cadastro sem deixar linha quebrada');
const origR1 = { Processo: 'Recebimento', ID_Subprocesso: 'R1', Descricao_Item: 'Item 1', Requisito_Critico: 'Não', Subprocesso_EN: '', Subprocesso_ES: '', Descricao_EN: '', Descricao_ES: '' };
teste('mover item: gravação parcial é desfeita (nada duplicado)', () => {
  const env = comAuditoria();
  env.quebrar('Cad_Processos_Perguntas', { vezes: 1, depois: true });
  env.ctx.__orig = origR1;
  lanca(() => env.run("moverCadastro('Cad_Processos_Perguntas', 2, __orig, 1)"));
  eq(env.abas.Cad_Processos_Perguntas.linhas.slice(1).map((l) => l[1]), ['R1', 'R2']);
});
teste('mover item registra no log de atividade', () => {
  const env = comAuditoria();
  env.ctx.__orig = origR1;
  eq(env.run("moverCadastro('Cad_Processos_Perguntas', 2, __orig, 1)").ok, true);
  eq(env.abas.Cad_Processos_Perguntas.linhas.slice(1).map((l) => l[1]), ['R2', 'R1']);
  eq(env.abas.Log_Atividade.linhas.slice(1).some((l) => /movido/i.test(l[5])), true);
});
teste('restaurar: falha ao gravar não deixa linha em branco inserida', () => {
  const env = comAuditoria();
  env.quebrar('Cad_Estrutura', { vezes: 1 });
  env.ctx.__o = { Tipo: 'Doca', Identificador: '02', Cor_Simbolo: 'Verde/Bolinha', Lider_Padrao: '', Turno_Padrao: '' };
  lanca(() => env.run("restaurarCadastro('Cad_Estrutura', __o, 2)"));
  eq(env.abas.Cad_Estrutura.linhas.length, 2);
});

console.log('M14: configurações tudo ou nada');
teste('falha no meio da gravação volta todas as configurações', () => {
  const env = base();
  env.linhas('Configuracoes', [['DIAS_VIDA_UTIL_AUDITORIA', 7], ['NOTA_CORTE_PCT', 70], ['NOTA_MEDIA_PCT', 90]]);
  // a 1ª gravação de valor passa, a 2ª falha
  env.run("__s = aba_('Configuracoes'); __orig = __s.getRange; __n = 0; __s.getRange = function () { var f = __orig.apply(null, arguments), sv = f.setValue; f.setValue = function (v) { if (++__n === 2) throw new Error('falha simulada'); return sv(v); }; return f; }");
  lanca(() => env.run('salvarConfigs({ dias: 5, corte: 60, media: 80 })'));
  eq(env.abas.Configuracoes.linhas.slice(1).map((l) => l[1]), [7, 70, 90]);
});

console.log('--mut: texto secundário legível nos fundos cinza');
teste('--mut tem 4,5:1 ou mais sobre --bg e --hov (tema claro)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'Styles.html'), 'utf8');
  const tok = (t) => css.match(new RegExp(t + ':(#[0-9A-Fa-f]{6})'))[1];
  const lum = (h) => { const c = h.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const r = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mut = tok('--mut');
  ['--bg', '--hov'].forEach((f) => eq(r(mut, tok(f)) >= 4.5, true, f + ': ' + r(mut, tok(f)).toFixed(2)));
});

resumo();
