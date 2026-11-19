const { T, eq, ok, nega, fim } = require('./lib.js');
const { novo } = require('./seed.js');
const A = novo();
const F = { nome: 'Maria da Silva', cargo: 'Analista', cargoOutro: '' };
const sol = (email, o) => { A.as(email); return A.call('solicitarCadastro', Object.assign({ email }, F, o || {})); };
const rows = () => A.call('lerDireto_', 'Cad_Solicitacoes');

T('migração cria Cad_Solicitacoes com 12 colunas e é idempotente', () => {
  ok(A.sheets.Cad_Solicitacoes); eq(A.sheets.Cad_Solicitacoes.d[0].length, 12); A.as('owner@x.com'); A.call('migrarV6'); eq(A.sheets.Cad_Solicitacoes.getLastRow(), 1);
});
T('bootstrap bloqueado: motivo nao_cadastrado / inativo / sem_email e nenhum dado', () => {
  A.as('novo@x.com'); let b = A.call('bootstrap'); eq([b.user.ok, b.user.motivo, b.user.solicitacao], [false, 'nao_cadastrado', '']); ok(!b.db && !b.config); ok(/script\.google\.com/.test(b.appUrl));
  A.as('off@x.com'); b = A.call('bootstrap'); eq(b.user.motivo, 'inativo');
  A.as(''); b = A.call('bootstrap'); eq(b.user.motivo, 'sem_email');
});
T('solicitar: sucesso grava Pendente, normaliza e registra no log', () => {
  eq(sol('novo@x.com', { nome: '  Maria   da  Silva ' }), { ok: true });
  const r = rows(); eq(r.length, 1); eq([r[0].Email, r[0].Nome, r[0].Cargo, r[0].Status], ['novo@x.com', 'Maria da Silva', 'Analista', 'Pendente']); ok(/^SOL-\d+-\d{4}$/.test(r[0].ID));
  ok(A.call('lerDireto_', 'Log_Permissoes').some(l => l.Acao === 'Cadastro solicitado' && l.Alvo === 'novo@x.com'));
  A.as('novo@x.com'); eq(A.call('bootstrap').user.solicitacao, 'Pendente');
});
T('solicitar: duplicada em análise é recusada', () => { eq(sol('novo@x.com').msg, 'Seu cadastro já foi enviado e está em análise.'); eq(rows().length, 1); });
T('solicitar: e-mail diferente da conta ativa é rejeitado (não cadastra outra pessoa)', () => {
  A.as('mal@x.com'); eq(A.call('solicitarCadastro', Object.assign({ email: 'outra@x.com' }, F)).erros.email, 'Use o e-mail da conta Google com a qual você entrou.');
  eq(A.call('solicitarCadastro', Object.assign({ email: 'MAL@X.COM' }, F)).ok, true, 'caixa alta é a mesma conta');
});
T('solicitar: sem e-mail ativo falha fechado', () => { A.as(''); eq(A.call('solicitarCadastro', Object.assign({ email: '' }, F)).ok, false); });
T('solicitar: validações de nome, cargo e Outros', () => {
  A.as('v@x.com'); const c = o => A.call('solicitarCadastro', Object.assign({ email: 'v@x.com' }, F, o));
  eq(c({ nome: 'ab' }).erros.nome, 'Informe o nome completo.'); eq(c({ nome: 'x'.repeat(121) }).erros.nome, 'Máximo de 120 caracteres.');
  eq(c({ cargo: 'Hacker' }).erros.cargo, 'Selecione o cargo.'); eq(c({ cargo: '' }).erros.cargo, 'Selecione o cargo.');
  eq(c({ cargo: 'Outros', cargoOutro: '' }).erros.cargoOutro, 'Digite o cargo.'); eq(c({ cargo: 'Outros', cargoOutro: 'x'.repeat(61) }).erros.cargoOutro, 'Máximo de 60 caracteres.');
  eq(c({ email: 'invalido' }).erros.email, 'E-mail inválido.');
  eq(c({ cargo: 'Outros', cargoOutro: 'Supervisor de Piso' }).ok, true);
  eq(rows().find(r => r.Email === 'v@x.com').Cargo, 'Supervisor de Piso');
  ['Líder', 'Site Leader', 'Coordenador'].forEach((cg, i) => { A.as('c' + i + '@x.com'); eq(A.call('solicitarCadastro', { email: 'c' + i + '@x.com', nome: 'Fulano Teste', cargo: cg }).ok, true); });
});
T('solicitar: injeção de fórmula neutralizada', () => {
  A.as('f@x.com'); eq(A.call('solicitarCadastro', { email: 'f@x.com', nome: '=HYPERLINK("http://x")', cargo: 'Outros', cargoOutro: '+cmd' }).ok, true);
  const r = rows().find(x => x.Email === 'f@x.com'); ok(r.Nome.startsWith(' =') && r.Cargo.startsWith(' +'));
});
T('solicitar: quem já tem cadastro (ativo ou inativo) recebe mensagem específica', () => {
  eq(sol('ana@x.com').msg, 'Este e-mail já possui cadastro. Entre com o Google.'); eq(sol('off@x.com').msg, 'Este cadastro está desativado. Fale com o administrador.');
});
T('solicitar: limite de recusas e de fila', () => {
  A.as('owner@x.com');
  for (let i = 0; i < 5; i++) { sol('rec@x.com'); A.as('owner@x.com'); const id = rows().filter(r => r.Email === 'rec@x.com' && r.Status === 'Pendente')[0].ID; eq(A.call('recusarSolicitacao', id).ok, true); }
  eq(sol('rec@x.com').msg, 'Limite de solicitações atingido. Fale com o administrador.');
});
T('recusada: bootstrap mostra Recusada para quem foi recusado e reenvio é permitido abaixo do limite', () => {
  sol('rec2@x.com'); A.as('owner@x.com'); A.call('recusarSolicitacao', rows().find(r => r.Email === 'rec2@x.com').ID);
  A.as('rec2@x.com'); eq(A.call('bootstrap').user.solicitacao, 'Recusada'); eq(A.call('solicitarCadastro', Object.assign({ email: 'rec2@x.com' }, F)).ok, true);
});
T('fila cheia (300) bloqueia novas solicitações', () => {
  const B = novo(); const pend = B.sheets.Cad_Solicitacoes;
  for (let i = 0; i < 300; i++) B.ctx.anexar_('Cad_Solicitacoes', ['SOL-' + i, 'p' + i + '@x.com', 'P', 'Analista', '2026-11-14 10:00:00', 'Pendente', '', '', '']);
  B.as('ultimo@x.com'); eq(B.call('solicitarCadastro', Object.assign({ email: 'ultimo@x.com' }, F)).msg, 'Há solicitações demais em análise no momento. Tente novamente mais tarde.');
});
T('permissões: Admin e Site Leader têm autorizar (o Site Leader, só do próprio Hub); Analista/Auditor não', () => {
  A.as('owner@x.com'); const b = A.call('bootstrap'); ok(b.user.perms.includes('autorizar') && b.user.telas.includes('autorizar'));
  A.as('sl@x.com'); { const u = A.call('bootstrap').user; ok(u.perms.includes('autorizar') && u.telas.includes('autorizar')); }
  ['ana@x.com', 'aud1@x.com'].forEach(e => { A.as(e); const u = A.call('bootstrap').user; ok(!u.perms.includes('autorizar') && !u.telas.includes('autorizar'), e); nega(() => A.ctx.listarSolicitacoes(), 'não tem permissão'); nega(() => A.ctx.contarPendentes(), 'não tem permissão'); nega(() => A.ctx.recusarSolicitacao('x'), 'não tem permissão'); });
  A.as('novo@x.com'); nega(() => A.ctx.listarSolicitacoes(), 'Acesso negado');
});
T('contagem e lista: pendentes aparecem para o Admin; bootstrap traz o número', () => {
  A.as('owner@x.com'); const n = A.call('contarPendentes'); const l = A.call('listarSolicitacoes'); eq(l.pendentes.length, n); eq(A.call('bootstrap').pendentes, n); ok(n >= 6);
  ok(l.historico.every(h => h.status !== 'Pendente')); ok(l.pendentes.every(p => p.email && p.nome && p.cargo && p.data));
});
T('recusar: marca Recusada, quem e quando; repetir informa que já foi tratada', () => {
  A.as('owner@x.com'); const id = rows().find(r => r.Email === 'c0@x.com').ID; const r = A.call('recusarSolicitacao', id); eq(r.ok, true); ok(!r.dados.pendentes.some(p => p.id === id));
  const x = rows().find(r2 => r2.ID === id); eq([x.Status, x.Decidido_Por], ['Recusada', 'owner@x.com']); ok(x.Decidido_Em);
  ok(/já foi tratada/.test(A.call('recusarSolicitacao', id).msg));
  ok(A.call('lerDireto_', 'Log_Permissoes').some(l => l.Acao === 'Cadastro recusado' && l.Alvo === 'c0@x.com'));
});
T('aprovar via salvarUsuario: usuário criado, solicitação Aprovada, e-mail enviado ao e-mail cadastrado', () => {
  A.emails.length = 0; A.as('owner@x.com');
  const r = A.call('salvarUsuario', { Email_Google: 'novo@x.com', Nome: 'Maria da Silva', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null);
  eq(r.ok, true); eq(r.email.enviado, true); ok(!('_mail' in r));
  const s = rows().find(x => x.Email === 'novo@x.com'); eq([s.Status, s.Decidido_Por, s.Perfil_Atribuido], ['Aprovada', 'owner@x.com', 'Auditor']);
  eq(A.emails.length, 1); const m = A.emails[0]; eq(m.to, 'novo@x.com'); ok(/aprovado/i.test(m.subject));
  ['Matriz de Processos', 'Formulário de Auditoria', 'Minhas metas', 'Realizar auditorias', 'Exportar', 'Cadastros', 'Acessos'].forEach(x => ok(!m.body.includes(x) && !m.htmlBody.includes(x), 'não lista permissões: ' + x));
  ok(!/Auditor\b/.test(m.body + m.htmlBody), 'não cita o nome do perfil');
  ok(!/porque|pois|motivo|devido|senha|password/i.test(m.body), 'sem explicar o porquê e sem falar de senha');
  ok(m.body.startsWith('Olá, Maria.') && m.body.includes('conta Google') && m.body.includes('script.google.com'));
  ok(m.htmlBody.includes('script.google.com') && !/<script/i.test(m.htmlBody) && m.htmlBody.includes('Cadastro aprovado') && m.htmlBody.includes('Acessar o sistema'));
  A.as('novo@x.com'); eq(A.call('bootstrap').user.ok, true);
  A.as('owner@x.com'); eq(A.call('listarSolicitacoes').pendentes.some(p => p.email === 'novo@x.com'), false);
});
T('e-mail: nome com HTML é escapado', () => {
  A.emails.length = 0; sol('xss@x.com', { nome: '<img src=x onerror=1> Fulano' }); A.as('owner@x.com');
  A.call('salvarUsuario', { Email_Google: 'xss@x.com', Nome: '<img src=x onerror=1> Fulano', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null);
  ok(!A.emails[0].htmlBody.includes('<img')); 
});
T('e-mail no idioma escolhido no cadastro (EN e ES); idioma inválido cai em português', () => {
  const cas = [['en', 'Hello, Lia.', 'Registration approved', 'Open the system', 'Your registration was approved'], ['es', 'Hola, Lia.', 'Registro aprobado', 'Abrir el sistema', 'Su registro fue aprobado'], ['xx', 'Olá, Lia.', 'Cadastro aprovado', 'Acessar o sistema', 'Seu cadastro foi aprovado'], [undefined, 'Olá, Lia.', 'Cadastro aprovado', 'Acessar o sistema', 'Seu cadastro foi aprovado']];
  cas.forEach(([id, ola, tit, bot, ass], k) => {
    const em = 'lang' + k + '@x.com'; A.emails.length = 0; sol(em, { nome: 'Lia Souza', idioma: id }); A.as('owner@x.com');
    eq(rows().find(r => r.Email === em).Idioma, ['en', 'es'].includes(id) ? id : 'pt');
    A.call('salvarUsuario', { Email_Google: em, Nome: 'Lia Souza', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null);
    const m = A.emails[0]; ok(m.body.startsWith(ola) && m.htmlBody.includes(tit) && m.htmlBody.includes(bot), id); ok(m.subject.includes('Process Check'), id);
    ok(m.htmlBody.includes(ass), id); ok(!/Matriz|Auditor\b|Exportar|Minhas metas/.test(m.htmlBody + m.body), 'sem permissões em ' + id);
  });
});
T('migração acrescenta a coluna Idioma em planilhas antigas (9 colunas)', () => {
  const B = novo(); B.sheets.Cad_Solicitacoes.d[0].length = 9; B.sheets.Cad_Solicitacoes.d[0][9] = undefined; B.as('owner@x.com'); B.call('migrarV6');
  eq(B.sheets.Cad_Solicitacoes.d[0][9], 'Idioma'); B.call('migrarV6'); eq(B.sheets.Cad_Solicitacoes.d[0].length, 12);
  B.as('nv@x.com'); eq(B.call('solicitarCadastro', { email: 'nv@x.com', nome: 'Nova Pessoa', cargo: 'Líder', idioma: 'es' }).ok, true); eq(B.call('lerDireto_', 'Cad_Solicitacoes')[0].Idioma, 'es');
});
T('falha no envio não desfaz o cadastro e informa o aviso', () => {
  sol('falha@x.com'); A.as('owner@x.com'); A.mailFalha = true;
  const r = A.call('salvarUsuario', { Email_Google: 'falha@x.com', Nome: 'Falha Um', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null); A.mailFalha = false;
  eq(r.ok, true); eq(r.email.enviado, false); ok(r.email.msg);
  eq(rows().find(x => x.Email === 'falha@x.com').Status, 'Aprovada'); A.as('falha@x.com'); eq(A.call('bootstrap').user.ok, true);
  ok(A.call('lerDireto_', 'Log_Permissoes').some(l => l.Acao === 'E-mail de aprovação não enviado'));
});
T('usuário criado sem solicitação não dispara e-mail; criado Inativo não aprova', () => {
  A.emails.length = 0; A.as('owner@x.com');
  const r = A.call('salvarUsuario', { Email_Google: 'direto@x.com', Nome: 'Direto Um', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null); eq(r.ok, true); ok(!r.email); eq(A.emails.length, 0);
  sol('ina@x.com'); A.as('owner@x.com'); const r2 = A.call('salvarUsuario', { Email_Google: 'ina@x.com', Nome: 'Ina Um', Perfil: 'Auditor', Status_Ativo: 'Não' }, null);
  ok(!r2.email); eq(A.emails.length, 0); eq(rows().find(x => x.Email === 'ina@x.com').Status, 'Pendente');
  eq(A.call('listarSolicitacoes').pendentes.some(p => p.email === 'ina@x.com'), false, 'já existe usuário: sai da fila');
});
T('Analista com usuarios aprova mas não vê a fila (sem autorizar)', () => {
  sol('an2@x.com'); A.as('ana@x.com'); nega(() => A.ctx.listarSolicitacoes(), 'não tem permissão');
  const r = A.call('salvarUsuario', { Email_Google: 'an2@x.com', Nome: 'An Dois', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null); eq(r.ok, true); eq(r.email.enviado, true);
});
T('perfis custom não ganham autorizar sem o Admin conceder; Analista não pode conceder', () => {
  A.as('ana@x.com'); nega(() => A.ctx.salvarPerfil({ nome: 'X', desc: '', perms: ['autorizar'], telas: ['matriz'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true), 'não tem permissão');
});
const P = () => A.call('lerDireto_', 'Cad_Processos_Perguntas').filter(x => x.Processo === 'Recebimento');
T('mover pergunta: sobe, desce, respeita limites do processo e permissão', () => {
  A.as('ana@x.com'); const l = P(); const [a, b] = [l[0], l[1]];
  let r = A.call('moverCadastro', 'Cad_Processos_Perguntas', b._row, b, -1); eq(r.ok, true);
  eq(P().slice(0, 2).map(x => x.Descricao_Item), [b.Descricao_Item, a.Descricao_Item]);
  r = A.call('moverCadastro', 'Cad_Processos_Perguntas', b._row - 1, P()[0], 1); eq(P().slice(0, 2).map(x => x.Descricao_Item), [a.Descricao_Item, b.Descricao_Item]);
  const ant = JSON.stringify(P()); const topo = P()[0]; A.call('moverCadastro', 'Cad_Processos_Perguntas', topo._row, topo, -1); eq(JSON.stringify(P()), ant, 'primeiro item do primeiro processo não cruza para a linha de cabeçalho');
  const ult = P().slice(-1)[0]; const prox = A.call('lerDireto_', 'Cad_Processos_Perguntas').find(x => x._row === ult._row + 1); ok(prox.Processo !== 'Recebimento');
  A.call('moverCadastro', 'Cad_Processos_Perguntas', ult._row, ult, 1); eq(JSON.stringify(P()), ant, 'não cruza para outro processo');
  eq(A.call('moverCadastro', 'Cad_Processos_Perguntas', a._row, { Processo: 'x' }, 1).ok, false, 'registro desatualizado');
  A.as('aud1@x.com'); nega(() => A.ctx.moverCadastro('Cad_Processos_Perguntas', 2, {}, 1), 'não tem permissão'); nega(() => A.ctx.restaurarCadastro('Cad_Processos_Perguntas', {}, 2), 'não tem permissão');
  A.as('ana@x.com'); nega(() => A.ctx.moverCadastro('Cad_Pessoas', 2, {}, 1), 'Aba inválida');
});
T('desfazer exclusão: item volta à posição original; duplicado é recusado', () => {
  A.as('ana@x.com'); const l = P(), alvo = l[2]; const antes = l.map(x => x.Descricao_Item);
  eq(A.call('excluirCadastro', 'Cad_Processos_Perguntas', alvo._row, alvo).ok, true); eq(P().length, antes.length - 1);
  const sem = { Processo: alvo.Processo, ID_Subprocesso: alvo.ID_Subprocesso, Descricao_Item: alvo.Descricao_Item, Requisito_Critico: alvo.Requisito_Critico };
  eq(A.call('restaurarCadastro', 'Cad_Processos_Perguntas', sem, alvo._row).ok, true); eq(P().map(x => x.Descricao_Item), antes);
  eq(A.call('restaurarCadastro', 'Cad_Processos_Perguntas', sem, alvo._row).ok, false, 'já existe');
  eq(A.call('restaurarCadastro', 'Cad_Processos_Perguntas', Object.assign({}, sem, { Descricao_Item: 'Item novo no fim' }), 99999).ok, true); eq(P().slice(-1)[0].Descricao_Item, 'Item novo no fim');
});
fim('SERVIDOR parte 3 (cadastro, autorização e e-mail)');
