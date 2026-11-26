/* Lote 2 da revisão v10 (atomicidade): cada teste reproduz um achado (falha antes da correção, passa depois). */
const { criarAmbiente, teste, eq, lanca, resumo } = require('./harness');

/** Hubs desligados, um Admin logado (admin@x.com) e um usuário comum (u@x.com, Analista). */
function base() {
  const env = criarAmbiente({ ativo: 'admin@x.com', efetivo: 'dono@x.com' });
  env.linhas('Cad_Usuarios', [
    ['admin@x.com', 'Admin', 'Admin', 'Sim', ''],
    ['u@x.com', 'Usuário', 'Analista', 'Sim', ''],
  ]);
  return env;
}
const usuario = (env, n) => env.abas.Cad_Usuarios.linhas[n].slice(0, 5);
const origU = { Email_Google: 'u@x.com', Nome: 'Usuário', Perfil: 'Analista', Status_Ativo: 'Sim', Hub: '' };

console.log('H3: gestão de acesso desfaz a gravação quando o log obrigatório falha');
teste('alterar usuário: log falha, linha volta ao que era e o cache é limpo', () => {
  const env = base();
  env.quebrar('Log_Permissoes');
  env.ctx.__o = Object.assign({ _row: 3 }, origU, { Status_Ativo: 'Não' });
  env.ctx.__orig = origU;
  lanca(() => env.run('salvarUsuario(__o, __orig)'), /nada foi alterado/);
  eq(usuario(env, 2), ['u@x.com', 'Usuário', 'Analista', 'Sim', '']);
  eq(env.cache.has('aba:Cad_Usuarios'), false, 'cache de usuários limpo');
});
teste('criar usuário: log falha, nenhuma linha nova fica', () => {
  const env = base();
  env.quebrar('Log_Permissoes');
  env.ctx.__o = { Email_Google: 'novo@x.com', Nome: 'Novo', Perfil: 'Analista', Status_Ativo: 'Sim' };
  lanca(() => env.run('salvarUsuario(__o, null)'), /nada foi alterado/);
  eq(env.abas.Cad_Usuarios.linhas.length, 3);
});
teste('excluir usuário: log falha, o usuário volta na mesma posição', () => {
  const env = base();
  env.quebrar('Log_Permissoes');
  env.ctx.__orig = origU;
  lanca(() => env.run('excluirUsuario(3, __orig)'), /nada foi alterado/);
  eq(usuario(env, 2), ['u@x.com', 'Usuário', 'Analista', 'Sim', '']);
  eq(env.abas.Cad_Usuarios.linhas.length, 3);
});
teste('aprovar cadastro de líder: falha no meio desfaz usuário e solicitação, e o histórico marca Revertido', () => {
  const env = base();
  env.linhas('Cad_Solicitacoes', [env.linha('Cad_Solicitacoes', { ID: 'S1', Email: 'lider@x.com', Nome: 'Lia Lima', Cargo: 'Líder', Data: '2026-11-20', Status: 'Pendente', Idioma: 'pt', Turno: 'T1' })]);
  env.quebrar('Cad_Pessoas');
  env.ctx.__o = { Email_Google: 'lider@x.com', Nome: 'Lia Lima', Perfil: 'Analista', Status_Ativo: 'Sim' };
  lanca(() => env.run('salvarUsuario(__o, null)'), /nada foi alterado/);
  eq(env.abas.Cad_Usuarios.linhas.length, 3, 'usuário não criado');
  eq(env.abas.Cad_Solicitacoes.linhas[1][5], 'Pendente', 'solicitação volta a pendente');
  const hist = env.abas.Pessoas_Historico.linhas.slice(1).map((l) => String(l[2]));
  eq(hist.length, 2, 'linha original e marca de reversão');
  eq(hist[1].indexOf('Revertido') === 0, true, 'última linha é Revertido');
});
teste('criar perfil: log falha, nenhuma linha nova fica', () => {
  const env = base();
  env.quebrar('Log_Permissoes');
  env.run("__p = perfis_()['Analista']; __n = { nome: 'Teste', desc: '', perms: __p.perms, telas: __p.telas, escopo: __p.escopo }");
  const antes = env.abas.Cad_Perfis.linhas.length;
  lanca(() => env.run('salvarPerfil(__n, true)'), /nada foi alterado/);
  eq(env.abas.Cad_Perfis.linhas.length, antes);
});
teste('excluir perfil: log falha, o perfil continua cadastrado', () => {
  const env = base();
  env.run("__p = perfis_()['Analista']; __n = { nome: 'Teste', desc: '', perms: __p.perms, telas: __p.telas, escopo: __p.escopo }");
  eq(env.run('salvarPerfil(__n, true)').ok, true, 'criação com log funcionando');
  env.quebrar('Log_Permissoes');
  lanca(() => env.run("excluirPerfil('Teste')"), /nada foi alterado/);
  eq(env.abas.Cad_Perfis.linhas.some((l) => l[0] === 'Teste'), true);
});
teste('regressão: alterar usuário com log funcionando grava e registra', () => {
  const env = base();
  env.ctx.__o = Object.assign({ _row: 3 }, origU, { Status_Ativo: 'Não' });
  env.ctx.__orig = origU;
  eq(env.run('salvarUsuario(__o, __orig)').ok, true);
  eq(usuario(env, 2)[3], 'Não');
  eq(env.abas.Log_Permissoes.linhas.slice(1).some((l) => l[2] === 'Usuário alterado'), true);
});

teste('alterar usuário: gravação parcial da linha (grava e lança) é desfeita', () => {
  const env = base();
  env.quebrar('Cad_Usuarios', { vezes: 1, depois: true });
  env.ctx.__o = Object.assign({ _row: 3 }, origU, { Perfil: 'Auditor' });
  env.ctx.__orig = origU;
  lanca(() => env.run('salvarUsuario(__o, __orig)'), /nada foi alterado/);
  eq(usuario(env, 2), ['u@x.com', 'Usuário', 'Analista', 'Sim', '']);
});
teste('criar usuário: append que grava e lança não deixa linha', () => {
  const env = base();
  env.quebrar('Cad_Usuarios', { vezes: 1, depois: true });
  env.ctx.__o = { Email_Google: 'novo@x.com', Nome: 'Novo', Perfil: 'Analista', Status_Ativo: 'Sim' };
  lanca(() => env.run('salvarUsuario(__o, null)'), /nada foi alterado/);
  eq(env.abas.Cad_Usuarios.linhas.length, 3);
});
teste('erro antes de qualquer gravação mantém a mensagem original', () => {
  const env = base();
  lanca(() => env.run("gravarComDesfazer_({ nome: 'X', email: 'x@x.com' }, 'teste', function () { throw new Error('mensagem específica'); })"), /^mensagem específica$/);
});

console.log('H4: auditoria não duplica quando o cliente tenta de novo');
function comAuditoria() {
  const env = base();
  env.linhas('Cad_Estrutura', [env.linha('Cad_Estrutura', { Tipo: 'Doca', Identificador: '01', Cor_Simbolo: 'Azul/Triângulo' })]);
  env.linhas('Cad_Processos_Perguntas', [
    env.linha('Cad_Processos_Perguntas', { Processo: 'Recebimento', ID_Subprocesso: 'R1', Descricao_Item: 'Item 1', Requisito_Critico: 'Não' }),
    env.linha('Cad_Processos_Perguntas', { Processo: 'Recebimento', ID_Subprocesso: 'R2', Descricao_Item: 'Item 2', Requisito_Critico: 'Não' }),
  ]);
  return env;
}
const payload = (cid) => ({ processo: 'Recebimento', doca: '01', colaboradores: [], lider: '', turno: 'T1', observacoes: '', respostas: [{ k: 2, ok: true }, { k: 3, ok: false }], clientId: cid });
const auditorias = (env) => env.abas.Auditorias_Historico.linhas.length - 1;
teste('mesmo clientId duas vezes grava uma auditoria só e devolve o mesmo id', () => {
  const env = comAuditoria();
  env.ctx.__p = payload('c-teste-0001');
  const r1 = env.run('salvarAuditoria(__p)'), r2 = env.run('salvarAuditoria(__p)');
  eq(r1.ok && r2.ok, true);
  eq(auditorias(env), 1);
  eq(r2.id, r1.id);
});
teste('mesmo clientId com conteúdo diferente grava a nova auditoria', () => {
  const env = comAuditoria();
  env.ctx.__p = payload('c-teste-0001'); const r1 = env.run('salvarAuditoria(__p)');
  const p2 = payload('c-teste-0001'); p2.respostas = [{ k: 2, ok: true }, { k: 3, ok: true }];
  env.ctx.__p = p2; const r2 = env.run('salvarAuditoria(__p)');
  eq(auditorias(env), 2);
  eq(r2.id !== r1.id && r2.pct === 100, true, 'devolve a auditoria nova');
});
teste('clientIds diferentes gravam duas auditorias', () => {
  const env = comAuditoria();
  env.ctx.__p = payload('c-teste-0001'); env.run('salvarAuditoria(__p)');
  env.ctx.__p = payload('c-teste-0002'); env.run('salvarAuditoria(__p)');
  eq(auditorias(env), 2);
});
teste('falha ao apagar o rascunho depois de gravar não vira erro para o usuário', () => {
  const env = comAuditoria();
  env.linhas('Auditorias_Rascunho', [env.linha('Auditorias_Rascunho', { ID_Rascunho: 'RAS-1', Timestamp_Inicio: '2026-11-24 10:00:00', Auditor_Email: 'admin@x.com', Processo: 'Recebimento', Doca_Cluster: '01', Json_Respostas_Parciais: '{}' })]);
  env.quebrar('Auditorias_Rascunho');
  env.ctx.__p = payload('c-teste-0003');
  const r = env.run('salvarAuditoria(__p)');
  eq(r.ok, true);
  eq(auditorias(env), 1);
});

console.log('H5: renomear líder em cascata volta tudo se um passo falhar');
function comLider() {
  const env = base();
  env.linhas('Cad_Pessoas', [
    ['João Silva', 'Líder', 'T1', 'Sim', '', ''],
    ['Ana Costa', 'Colaborador', 'T1', 'Sim', 'João Silva', ''],
  ]);
  env.linhas('Cad_Estrutura', [env.linha('Cad_Estrutura', { Tipo: 'Doca', Identificador: '01', Cor_Simbolo: 'Azul/Triângulo', Lider_Padrao: 'João Silva', Turno_Padrao: 'T1' })]);
  env.linhas('Cad_Regras_Lider', [env.linha('Cad_Regras_Lider', { Email: 'outro@x.com', Proprio_Time: 'Sim', Outros_Times: 'Sim', Times: 'João Silva', Ver_Proprio: 'Sim', Ver_Outros: 'proprias' })]);
  env.ctx.__orig = { Nome: 'João Silva', Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim', Lider: '' };
  env.ctx.__o = { _row: 2, Nome: 'João Souza', Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim', Lider: '' };
  return env;
}
teste('falha nas regras: líder, colaborador e doca voltam ao nome antigo e o histórico marca Revertido', () => {
  const env = comLider();
  env.quebrar('Cad_Regras_Lider');
  lanca(() => env.run("salvarCadastro('Cad_Pessoas', __o, __orig)"), /nada foi alterado/);
  eq(env.abas.Cad_Pessoas.linhas[1][0], 'João Silva', 'nome do líder');
  eq(env.abas.Cad_Pessoas.linhas[2][4], 'João Silva', 'líder do colaborador');
  eq(env.abas.Cad_Estrutura.linhas[1][3], 'João Silva', 'líder padrão da doca');
  const ev = env.abas.Pessoas_Historico.linhas.slice(1).map((l) => String(l[2]));
  eq(ev.filter((x) => x.indexOf('Revertido') === 0).length, ev.length / 2, 'cada linha do histórico tem a sua reversão');
});
teste('regressão: renomear com tudo funcionando atualiza as três abas', () => {
  const env = comLider();
  eq(env.run("salvarCadastro('Cad_Pessoas', __o, __orig)").ok, true);
  eq(env.abas.Cad_Pessoas.linhas[1][0], 'João Souza');
  eq(env.abas.Cad_Pessoas.linhas[2][4], 'João Souza');
  eq(env.abas.Cad_Estrutura.linhas[1][3], 'João Souza');
  eq(env.abas.Cad_Regras_Lider.linhas[1][3], 'João Souza');
});

resumo();
