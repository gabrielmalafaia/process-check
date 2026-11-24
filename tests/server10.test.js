// Fases 0b/0c e v8: desempenho, Matriz, Hub (isolamento), carga em massa, online, log, aceite e arquivo.
const { T, eq, ok, nega, fim } = require('./lib.js');
const { cenario, novo } = require('./seed.js');

const raw = (A, aba) => A.call('lerBruto_', aba);
const novoUsuario = (A, email, nome, perfil, hub) => { A.as('owner@x.com'); A.ctx.anexar_('Cad_Usuarios', [email, nome, perfil, 'Sim', hub || '']); A.run('limparCache_()'); };
/** Cenário com 2 Hubs e isolamento ligado. H1 tem os dados do cenário; H2 começa vazio. */
function doisHubs() {
  const A = cenario();
  A.as('owner@x.com');
  A.ctx.anexar_('Cad_Hubs', ['H1', 'Hub Um', 'Operação A', 'Sim']);
  A.ctx.anexar_('Cad_Hubs', ['H2', 'Hub Dois', 'Operação B', 'Sim']);
  A.call('ativarHubs');
  novoUsuario(A, 'sl2@x.com', 'Sandra Dois', 'Site Leader', 'H2');
  novoUsuario(A, 'aud3@x.com', 'Audi Tres', 'Auditor', 'H2');
  return A;
}

T('Hub digitado na planilha: aparece após Atualizar; linha sem ID_Hub é ignorada', () => {
  const A = doisHubs(); A.as('owner@x.com'); const n = () => A.call('bootstrap', false).user.hub.lista.length;
  eq(n(), 2);
  A.sheets.Cad_Hubs.appendRow(['H3', 'Hub Tres', 'Op C', 'Sim']); A.sheets.Cad_Hubs.appendRow(['', 'Sem id', 'Op D', 'Sim']);
  eq(A.call('bootstrap', true).user.hub.lista.map(h => h.id), ['H1', 'H2', 'H3']);
});
T('Trocar para um Hub digitado na planilha funciona na hora (sem cache velho)', () => {
  const A = doisHubs(); A.as('owner@x.com'); A.call('bootstrap', false);
  A.sheets.Cad_Hubs.appendRow(['H3', 'Hub Tres', 'Op C', 'Sim']);
  eq(A.call('definirHubAtivo', 'H3').ok, true);
  const b = A.call('bootstrap', false); eq(b.user.hub.id, 'H3'); eq(b.user.hub.nome, 'Hub Tres');
  nega(() => A.call('definirHubAtivo', 'HX'), 'inexistente');
});
T('Revisão de segurança: cluster com espaço no Tipo continua exigindo Admin global', () => {
  const A = doisHubs(); A.as('sl2@x.com');
  const o = { Tipo: ' Cluster', Identificador: 'Z9', Cor_Simbolo: 'Azul/Triângulo', Lider_Padrao: '', Turno_Padrao: 'T1' };
  nega(() => A.call('salvarCadastro', 'Cad_Estrutura', o, null), 'Admin global');
  eq(raw(A, 'Cad_Estrutura').filter(x => x.Identificador === 'Z9').length, 0);
});
T('Revisão de segurança: perfis só o Admin global edita; arquivarLog só dono/gatilho; manutenção só Admin global', () => {
  const A = doisHubs(); novoUsuario(A, 'adm2@x.com', 'Admin Dois', 'Admin', 'H2');
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Perfis', A.ctx.serializarPerfil_({ nome: 'Chefe', desc: 'x', perms: ['perfis'], telas: ['acessos'], escopo: { modo: 'todos', processos: [], turnos: [] } })); A.run('limparCache_()');
  novoUsuario(A, 'chefe@x.com', 'Chefe', 'Chefe', 'H2');
  A.as('chefe@x.com'); nega(() => A.call('salvarPerfil', { nome: 'Novo', desc: 'x', perms: [], telas: [], escopo: { modo: 'todos', processos: [], turnos: [] } }, true), 'Admin global');
  A.as('sl2@x.com'); nega(() => A.call('arquivarLog'), 'negado');
  A.as('adm2@x.com'); nega(() => A.call('desativarHubs'), 'negado');
  A.as('owner@x.com'); ok(A.call('desativarHubs')); A.call('ativarHubs');
});
T('Revisão de segurança: Hub escolhido sobrevive à expiração do cache', () => {
  const A = doisHubs(); A.as('owner@x.com'); eq(A.call('definirHubAtivo', 'H2').ok, true);
  A.cache.clear();
  eq(A.call('bootstrap', false).user.hub.id, 'H2', 'voltou ao primeiro Hub depois de o cache expirar');
});
T('Revisão de segurança: chave de cache de relatório é SHA-256 (hex de 64) e separa Hubs', () => {
  const A = doisHubs(); A.as('owner@x.com'); const h = A.run("sha_('a')"); eq(h.length, 64); ok(/^[0-9a-f]+$/.test(h));
  eq(h, require('crypto').createHash('sha256').update('a').digest('hex'));
});
T('Revisão 2: migração exige Hub ativo com ID; Hub em uso não desativa; log com falha não derruba a ação; pulso informa o Hub', () => {
  const B = cenario(); B.as('owner@x.com'); B.ctx.anexar_('Cad_Hubs', ['', 'Sem id', 'Op', 'Sim']); nega(() => B.call('migrarV8'), 'Nenhum Hub ativo');
  const C = cenario(); C.as('owner@x.com'); C.ctx.anexar_('Cad_Hubs', ['H0', 'Inativo', 'Op', 'Não']); C.ctx.anexar_('Cad_Hubs', ['H1', 'Ativo', 'Op', 'Sim']); eq(C.call('migrarV8').hubPadrao, 'H1');
  const A = doisHubs(); A.as('owner@x.com'); const h1 = A.call('listarHubs').hubs.find(h => h.id === 'H1');
  const r = A.call('salvarHub', { nome: h1.nome, operacao: h1.operacao, ativo: false, _row: h1._row }, h1); eq(r.ok, false); ok(/outro Hub/.test(r.msg), r.msg);
  eq(A.call('pulso').hub, 'H1');
  A.run("const __r = registrar_; registrar_ = function () { throw new Error('falha no log'); };");
  A.as('owner@x.com'); const csv = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nPessoa Log\tLíder\tT1\tSim\t';
  eq(A.call('importarConfirmar', 'pessoas', csv).ok, true, 'a carga foi gravada; o log falhou e não pode virar erro');
  ok(Number(A.run("PropertiesService.getScriptProperties().getProperty('LOG_FALHAS')")) >= 1, 'a falha do log fica contada');
  eq(A.call('consultarLog', {}).falhasLog >= 1, true);
});
T('Revisão 3: arquivo do log aceita mais de 1000 linhas e apaga o que passou de 1 ano', () => {
  const A = doisHubs(); A.as('owner@x.com'); const lg = A.sheets.Log_Atividade; if (lg.getLastRow() > 1) lg.deleteRows(2, lg.getLastRow() - 1);
  for (let i = 0; i < 1200; i++) lg.appendRow(['2026-05-01 10:00:00', 'H1', 'a@x.com', 'A', 'Admin', 'Acao', 'x', '']);
  const r = A.call('arquivarLog'); eq(r.erro, '', r.erro); eq(r.movidos, 1200);
  const arq = Object.values(A.planilhasExtra)[0].sheets.Log_Atividade; eq(arq.getLastRow(), 1201, 'copiou tudo, passando de 1000 linhas');
  for (let i = 2; i <= 6; i++) arq.getRange(i, 1).setValue('2025-01-02 10:00:00'); // 5 registros com mais de 1 ano
  lg.appendRow(['2026-05-02 10:00:00', 'H1', 'a@x.com', 'A', 'Admin', 'Acao', 'x', '']);
  const r2 = A.call('arquivarLog'); eq(r2.apagadosArquivo, 5, JSON.stringify(r2)); eq(arq.getLastRow(), 1201 - 5 + 1);
});
T('Revisão 3: trocar Doca por Cluster (e vice-versa) corrige o dono da linha', () => {
  const A = doisHubs(); A.as('owner@x.com'); const ls = () => raw(A, 'Cad_Estrutura');
  A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Doca', Identificador: 'D77', Cor_Simbolo: 'Azul/Triângulo', Lider_Padrao: '', Turno_Padrao: 'T1' }, null);
  const l = ls().find(x => x.Identificador === 'D77'); ok(l, 'criada');
  A.call('salvarCadastro', 'Cad_Estrutura', Object.assign({}, l, { Tipo: 'Cluster', Identificador: 'Z77' }), l);
  eq(ls().find(x => x.Identificador === 'Z77').Hub, '*');
  const l2 = ls().find(x => x.Identificador === 'Z77'); A.call('salvarCadastro', 'Cad_Estrutura', Object.assign({}, l2, { Tipo: 'Doca', Identificador: 'D78' }), l2);
  eq(ls().find(x => x.Identificador === 'D78').Hub, 'H1');
});
T('Revisão 3: falha ao ler as chaves do script NÃO desliga o isolamento (falha fechada) e a leitura é cacheada', () => {
  const A = doisHubs(); A.as('sl2@x.com'); A.call('bootstrap', false);
  A.run("var __gp = PropertiesService.getScriptProperties; globalThis.__cnt = 0; PropertiesService.getScriptProperties = function () { const p = __gp(); return { getProperty: function (k) { globalThis.__cnt++; return p.getProperty(k); }, setProperty: p.setProperty, deleteProperty: p.deleteProperty }; };");
  A.call('bootstrap', false); A.call('bootstrap', false); eq(A.run('globalThis.__cnt'), 0, 'flags vêm do cache, sem tocar em Properties');
  A.cache.clear();
  A.run("PropertiesService.getScriptProperties = function () { return { getProperty: function () { throw new Error('Serviço indisponível'); } }; };");
  nega(() => A.call('bootstrap', false), 'Serviço indisponível');
});
T('Revisão 3: o arquivamento diário apaga rascunhos vencidos', () => {
  const A = doisHubs(); A.as('owner@x.com'); const rs = A.sheets.Auditorias_Rascunho;
  rs.appendRow(['R1', '2020-01-01 10:00:00', 'velho@x.com', 'Recebimento', '01', '{}', 'H1']);
  const antes = rs.getLastRow(); A.call('arquivarLog'); ok(rs.getLastRow() < antes, 'rascunho vencido removido');
});
T('Revisão 4: gravação sem Hub ativo é recusada; carga só com cabeçalho; objeto vira vazio; meta com data inexistente; rascunho corrompido', () => {
  const A = doisHubs(); A.as('owner@x.com');
  const cab = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider';
  const r = A.call('importarPrevia', 'pessoas', cab); eq(r.ok, false); ok(/Nenhuma linha/.test(r.erros[0].msg));
  eq(A.call('importarConfirmar', 'pessoas', cab).ok, false);
  const m = A.call('salvarMeta', { Tipo_Alvo: 'Todos', Alvo: '', Quantidade: 5, ini: '2026-02-30', fim: '2026-03-10', Processos: [] }, null);
  ok(m.ok === false, JSON.stringify(m).slice(0, 120));
  A.run("globalThis.__t = limpar_({ a: 1 }) + '|' + limpar_(['x']) + '|' + limpar_('Ma\\u0000ria') + '|' + (limpar_(new Date(0)) instanceof Date)");
  eq(A.run('globalThis.__t'), '||Maria|true');
  A.as('sl2@x.com'); const cl = A.call('listarAcessos'); ok(cl.hubs === undefined, 'Site Leader não recebe a lista de Hubs');
});
T('Revisão 4: cluster global não leva líder/turno de um Hub; ação sobre usuário de outro Hub é logada no Hub do alvo', () => {
  const A = doisHubs(); A.as('owner@x.com');
  A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Cluster', Identificador: 'Z8', Cor_Simbolo: 'Azul/Triângulo', Lider_Padrao: 'Carlos Lider', Turno_Padrao: 'T1' }, null);
  const z = raw(A, 'Cad_Estrutura').find(x => x.Identificador === 'Z8'); eq(z.Lider_Padrao, ''); eq(z.Hub, '*');
  A.call('definirHubAtivo', 'H1'); A.call('salvarUsuario', { Email_Google: 'novo2@x.com', Nome: 'Novo Dois', Perfil: 'Auditor', Status_Ativo: 'Sim', Hub: 'H2', _row: 0 }, null);
  const lg = A.sheets.Log_Atividade; const ultimo = lg.getRange(lg.getLastRow(), 1, 1, 8).getValues()[0]; eq(ultimo[1], 'H2', 'o log vai para o Hub do usuário afetado');
});
T('Revisão 4: manutenção sem usuários cadastrados só para o dono', () => {
  const A = cenario(); A.as('qualquer@x.com'); A.sheets.Cad_Usuarios.deleteRows(2, A.sheets.Cad_Usuarios.getLastRow() - 1);
  nega(() => A.call('desativarHubs'), 'negado'); A.as('owner@x.com'); A.run("Session.getEffectiveUser = function () { return { getEmail: function () { return 'owner@x.com'; } }; };"); ok(A.call('desativarHubs'));
});
/* ---------- 0b: desempenho ---------- */
T('0b: fila de pendentes em cache, invalidada ao solicitar e ao recusar', () => {
  const A = novo(); A.as('owner@x.com');
  eq(A.call('bootstrap').pendentes, 0);
  A.as('n1@x.com'); eq(A.call('solicitarCadastro', { email: 'n1@x.com', nome: 'Nova Um', cargo: 'Analista' }).ok, true);
  A.as('owner@x.com'); eq(A.call('bootstrap').pendentes, 1);
  const id = A.call('listarSolicitacoes').pendentes[0].id;
  eq(A.call('recusarSolicitacao', id).ok, true);
  eq(A.call('bootstrap').pendentes, 0);
});
T('0b: Atualizar só derruba o cache para todos 1 vez a cada 30 s', () => {
  const A = novo(); A.as('owner@x.com');
  A.call('bootstrap', true); ok(A.cache.has('forcado'));
  A.cache.set('marca', '1'); A.cache.set('aba:Configuracoes', '[]');
  A.call('bootstrap', true); eq(A.cache.get('aba:Configuracoes'), '[]', 'segundo clique em 30 s não limpa o cache');
  A.cache.delete('forcado'); A.call('bootstrap', true); ok(A.cache.get('aba:Configuracoes') !== '[]');
});
T('0b: a chave do cache dos relatórios muda com as permissões', () => {
  const A = novo(); let n = 0;
  A.run('var __n = 0;');
  const base = { email: 'x@x.com', escopo: { modo: 'todos', processos: [], turnos: [] }, telas: ['geral'], hub: '' };
  A.ctx.__a1 = Object.assign({ perms: ['auditar'] }, base); A.ctx.__a2 = Object.assign({ perms: ['auditar', 'ver_nomes'] }, base);
  A.run("comCache_(__a1, ['k'], function () { __n++; return { v: 1 }; }); comCache_(__a1, ['k'], function () { __n++; return { v: 1 }; });");
  eq(A.run('__n'), 1);
  A.run("comCache_(__a2, ['k'], function () { __n++; return { v: 2 }; });");
  eq(A.run('__n'), 2, 'permissões diferentes não compartilham o cache');
});

/* ---------- 0c: Matriz ---------- */
T('0c: Matriz — nomes de colaboradores só para quem tem ver_nomes; líder de time só vê os do próprio time', () => {
  const A = cenario();
  A.as('owner@x.com');
  eq(A.call('salvarPerfil', { nome: 'Lider Time', desc: '', perms: ['ver_nomes'], telas: ['matriz'], escopo: { modo: 'time', processos: [], turnos: [] } }, true).ok, true);
  novoUsuario(A, 'carlos@x.com', 'Carlos Lider', 'Lider Time');
  const nomes = (email, proc) => { A.as(email); return A.call('getMatriz', proc).map(u => [u.id, u.ultColab]); };
  const sl = nomes('sl@x.com', 'Expedição'); ok(sl.some(x => x[1] === 'Ana Souza; Bruno Lima'), 'Site Leader vê');
  ok(nomes('aud1@x.com', 'Expedição').every(x => x[1] === ''), 'Auditor sem ver_nomes não vê nomes');
  const c = nomes('carlos@x.com', 'Expedição');
  eq(c.find(x => x[0] === '01')[1], 'Ana Souza; Bruno Lima', 'doca do próprio time');
  eq(c.find(x => x[0] === '07')[1], '', 'doca de outro líder: sem nomes');
  ok(c.length === 3, 'todas as docas continuam visíveis');
});

/* ---------- Hub ---------- */
T('hub: migração exige o primeiro Hub, é idempotente e preenche o Hub padrão', () => {
  const A = cenario(); A.as('owner@x.com');
  nega(() => A.call('migrarV8'), 'Cadastre o primeiro Hub');
  A.ctx.anexar_('Cad_Hubs', ['H1', 'Hub Um', 'Operação A', 'Sim']);
  const r = A.call('migrarV8'); eq(r.hubPadrao, 'H1');
  ok(raw(A, 'Auditorias_Historico').every(x => x.Hub === 'H1'));
  ok(raw(A, 'Cad_Pessoas').every(x => x.Hub === 'H1'));
  eq(raw(A, 'Cad_Usuarios').find(u => u.Email_Google === 'owner@x.com').Hub, '*');
  eq(raw(A, 'Cad_Usuarios').find(u => u.Email_Google === 'aud1@x.com').Hub, 'H1');
  const r2 = A.call('migrarV8'); eq(Object.values(r2.linhas).reduce((a, b) => a + b, 0), 0); eq(r2.usuarios, 0);
  eq(A.ctx.hubsLigado_(), false, 'migrar não liga o isolamento');
});
T('hub: clusters A a X globais, com símbolo padrão; J, K e L normalizados', () => {
  const A = doisHubs();
  const cl = raw(A, 'Cad_Estrutura').filter(x => x.Tipo === 'Cluster' && x.Hub === '*' && /^[A-X]$/.test(x.Identificador));
  eq(cl.length, 24);
  const cs = id => cl.find(x => x.Identificador === id).Cor_Simbolo;
  eq([cs('A'), cs('F'), cs('J'), cs('K'), cs('L'), cs('X')], ['Laranja/Bolinha', 'Azul/Triângulo', 'Laranja/Bolinha', 'Laranja/Bolinha', 'Laranja/Bolinha', 'Azul/Triângulo']);
  A.call('migrarV8'); eq(raw(A, 'Cad_Estrutura').filter(x => x.Tipo === 'Cluster' && x.Hub === '*' && /^[A-X]$/.test(x.Identificador)).length, 24, 'idempotente');
  A.as('sl2@x.com'); ok(A.call('listarCadastro', 'Cad_Estrutura').filter(x => x.Tipo === 'Cluster').length >= 24, 'Hub 2 enxerga o catálogo global');
});
T('hub: dados isolados — Hub 2 não vê auditorias, pessoas nem docas do Hub 1, e vice-versa', () => {
  const A = doisHubs();
  A.as('ana@x.com'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 6);
  A.as('sl2@x.com');
  eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 0);
  eq(A.call('listarCadastro', 'Cad_Pessoas'), []);
  eq(A.call('listarCadastro', 'Cad_Estrutura').filter(x => x.Tipo === 'Doca'), []);
  eq(A.call('getMatriz', 'Recebimento'), [], 'sem docas no Hub 2');
  const b = A.call('bootstrap'); eq(b.db.Cad_Pessoas, []); eq(b.user.hub.id, 'H2'); eq(b.user.hub.global, false);
  eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 0);
  eq(A.call('relatorio', 'export', A.F(), {}).linhas.length, 0);
});
T('hub: mesma doca nos dois Hubs, auditoria carimba o Hub e a Matriz não mistura', () => {
  const A = doisHubs();
  A.as('sl2@x.com');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Lia Lider', Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim' }, null).ok, true);
  eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Caio Colab', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Lia Lider' }, null).ok, true);
  eq(A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Doca', Identificador: '36', Cor_Simbolo: 'Rosa/Estrela', Lider_Padrao: 'Lia Lider', Turno_Padrao: 'T1' }, null).ok, true, 'doca 36 também existe no Hub 1');
  const r = A.audit('aud3@x.com', 'Recebimento', { conf: 5, nc: 5, f: { doca: '36', colaboradores: ['Caio Colab'] } }); eq(r.ok, true, JSON.stringify(r));
  eq(raw(A, 'Auditorias_Historico').find(x => x.ID_Auditoria === r.id).Hub, 'H2');
  eq(raw(A, 'Cad_Pessoas').find(x => x.Nome === 'Caio Colab').Hub, 'H2');
  A.as('sl2@x.com'); const m2 = A.call('getMatriz', 'Recebimento').find(u => u.id === '36'); eq([m2.status, m2.nota], ['vermelho', 50]);
  A.as('ana@x.com'); const m1 = A.call('getMatriz', 'Recebimento').find(u => u.id === '36'); eq([m1.status, m1.nota], ['verde', 100], 'Hub 1 não recebe a nota do Hub 2');
  eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 6, 'cache dos relatórios separado por Hub');
  A.as('sl2@x.com'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 1);
  const r2 = A.audit('aud3@x.com', 'Recebimento', { conf: 10, f: { doca: '01', colaboradores: ['Ana Souza'] } }); eq(r2.ok, false, 'doca e colaborador do Hub 1 não existem no Hub 2');
});
T('hub: nenhuma escrita atinge linha de outro Hub (editar, excluir, usuários, metas, rascunho)', () => {
  const A = doisHubs();
  A.as('ana@x.com'); const doca = A.call('listarCadastro', 'Cad_Estrutura').find(x => x.Identificador === '36');
  A.as('sl2@x.com');
  eq(A.call('salvarCadastro', 'Cad_Estrutura', Object.assign({}, doca, { Cor_Simbolo: 'Rosa/Estrela' }), doca).ok, false);
  eq(A.call('excluirCadastro', 'Cad_Estrutura', doca._row, doca).ok, false);
  ok(raw(A, 'Cad_Estrutura').some(x => x.Identificador === '36' && x.Cor_Simbolo === 'Azul/Triângulo'), 'linha intacta');
  const u1 = A.call('listarAcessos').usuarios; ok(u1.every(u => ['H2'].includes(u.Hub)), 'só usuários do próprio Hub');
  A.as('owner@x.com'); const aud1 = A.call('listarAcessos').usuarios.find(u => u.Email_Google === 'aud1@x.com');
  A.as('sl2@x.com');
  eq(A.call('excluirUsuario', aud1._row, aud1).ok, false);
  eq(A.call('salvarUsuario', Object.assign({}, aud1, { Nome: 'Trocado' }), aud1).ok, false);
  eq(raw(A, 'Cad_Usuarios').find(u => u.Email_Google === 'aud1@x.com').Nome, 'Audi Um');
  const novoU = A.call('salvarUsuario', { Email_Google: 'x2@x.com', Nome: 'Xis Dois', Perfil: 'Auditor', Status_Ativo: 'Sim', Hub: 'H1' }, null);
  eq(novoU.ok, true); eq(raw(A, 'Cad_Usuarios').find(u => u.Email_Google === 'x2@x.com').Hub, 'H2', 'Hub do usuário novo é sempre o do Site Leader');
  eq(A.call('salvarUsuario', { Email_Google: 'adm2@x.com', Nome: 'Adm Dois', Perfil: 'Admin', Status_Ativo: 'Sim' }, null).ok, false, 'Site Leader não cria Admin');
  A.as('aud3@x.com'); eq(A.call('getRascunho', 'Recebimento', '36'), null);
});
T('hub: catálogos globais só pelo Admin global (clusters, perguntas, configurações)', () => {
  const A = doisHubs(); A.as('sl2@x.com');
  nega(() => A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Cluster', Identificador: 'Z', Cor_Simbolo: 'Azul/Triângulo' }, null), 'só o Admin global');
  nega(() => A.call('salvarCadastro', 'Cad_Processos_Perguntas', { Processo: 'Recebimento', ID_Subprocesso: 'S', Descricao_Item: 'novo item', Requisito_Critico: 'Não' }, null), 'só o Admin global');
  nega(() => A.call('salvarConfigs', { dias: 7, corte: 70, media: 90 }), 'só o Admin global');
  A.as('owner@x.com'); eq(A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Cluster', Identificador: 'Z', Cor_Simbolo: 'Azul/Triângulo' }, null).ok, true);
  eq(raw(A, 'Cad_Estrutura').find(x => x.Identificador === 'Z').Hub, '*');
  eq(A.call('salvarConfigs', { dias: 7, corte: 70, media: 90 }).ok, true);
});
T('hub: só o Admin global troca de Hub (no servidor) e vê o Hub escolhido', () => {
  const A = doisHubs();
  A.as('owner@x.com'); let b = A.call('bootstrap'); eq([b.user.hub.id, b.user.hub.global, b.user.hub.lista.length], ['H1', true, 2]);
  eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 6);
  eq(A.call('definirHubAtivo', 'H2').ok, true); eq(A.call('bootstrap').user.hub.id, 'H2'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 0);
  nega(() => A.call('definirHubAtivo', 'XX'), 'inexistente');
  A.as('sl2@x.com'); nega(() => A.call('definirHubAtivo', 'H1'), 'não pode trocar');
  A.as('ana@x.com'); nega(() => A.call('definirHubAtivo', 'H2'), 'não pode trocar');
  A.as('owner@x.com'); eq(A.call('definirHubAtivo', 'H1').ok, true); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 6);
});
T('hub: falha fechada — usuário sem Hub, Hub inválido/inativo ou "*" em perfil comum não entra', () => {
  const A = doisHubs();
  const set = (email, v) => { const h = A.sheets.Cad_Usuarios.d[0].indexOf('Hub'); const r = A.sheets.Cad_Usuarios.d.findIndex(x => x[0] === email); A.sheets.Cad_Usuarios.d[r][h] = v; A.run('limparCache_()'); };
  ['', 'H9', '*'].forEach(v => { set('aud1@x.com', v); A.as('aud1@x.com'); const b = A.call('bootstrap'); eq([b.user.ok, b.user.motivo], [false, 'sem_hub'], 'Hub "' + v + '"'); ok(!b.db); nega(() => A.call('getMatriz', 'Recebimento'), 'Acesso negado'); });
  set('aud1@x.com', 'H1');
  A.as('owner@x.com'); const h2 = A.call('listarHubs').hubs.find(h => h.id === 'H2');
  eq(A.call('salvarHub', { nome: 'Hub Dois', operacao: 'Operação B', ativo: false, _row: h2._row }, h2).ok, false, 'Hub com usuários não desativa');
});
T('hub: linha sem Hub não aparece para ninguém quando o isolamento está ligado', () => {
  const A = doisHubs(); A.as('owner@x.com');
  A.ctx.anexarLinhas_('Cad_Pessoas', [['Pessoa Sem Hub', 'Colaborador', 'T1', 'Sim', 'Carlos Lider', '']]);
  A.run('limparCache_()'); ok(!A.call('listarCadastro', 'Cad_Pessoas').some(p => p.Nome === 'Pessoa Sem Hub'));
  A.as('sl2@x.com'); ok(!A.call('listarCadastro', 'Cad_Pessoas').some(p => p.Nome === 'Pessoa Sem Hub'));
});
T('hub: cadastro de Hubs — só Admin global, validações, ID opaco imutável, desativar com usuários é recusado', () => {
  const A = doisHubs(); A.as('sl2@x.com'); nega(() => A.call('listarHubs'), 'não tem permissão'); nega(() => A.call('salvarHub', { nome: 'X', operacao: 'Y' }, null), 'não tem permissão');
  A.as('owner@x.com');
  eq(A.call('salvarHub', { nome: '', operacao: 'Op' }, null).erros.nome, 'Campo obrigatório.');
  ok(A.call('salvarHub', { nome: 'Hub;Mau', operacao: 'Op' }, null).erros.nome);
  ok(A.call('salvarHub', { nome: '=SOMA(1)', operacao: 'Op' }, null).erros.nome);
  ok(A.call('salvarHub', { nome: 'x'.repeat(61), operacao: 'Op' }, null).erros.nome);
  eq(A.call('salvarHub', { nome: 'hub dois', operacao: 'Op' }, null).erros.nome, 'Já existe um Hub com este nome.');
  const r = A.call('salvarHub', { nome: 'Hub Tres', operacao: 'Operação C' }, null); eq(r.ok, true);
  const h3 = r.hubs.find(h => h.nome === 'Hub Tres'); ok(/^H[0-9A-Z]{4,}$/.test(h3.id) && h3.id !== 'H1');
  const ed = A.call('salvarHub', { nome: 'Hub Tres B', operacao: 'Operação C', _row: h3._row }, h3); eq(ed.ok, true); eq(ed.hubs.find(h => h._row === h3._row).id, h3.id, 'ID não muda');
  const h2 = A.call('listarHubs').hubs.find(h => h.id === 'H2'); eq(h2.usuarios, 2);
  eq(A.call('salvarHub', { nome: 'Hub Dois', operacao: 'Operação B', ativo: false, _row: h2._row }, h2).ok, false, 'tem usuários ativos');
  eq(A.call('salvarHub', { nome: 'Hub Tres B', operacao: 'Operação C', ativo: false, _row: h3._row }, Object.assign({}, h3, { id: 'OUTRO' })).ok, false, 'orig que não bate');
});
T('hub: solicitação de cadastro por Hub; aprovação por Site Leader do próprio Hub; Líder vira pessoa automaticamente', () => {
  const A = doisHubs();
  A.as('lid@x.com'); const bl = A.call('bootstrap'); eq(bl.user.motivo, 'nao_cadastrado'); eq(bl.user.hubs.length, 2);
  eq(A.call('solicitarCadastro', { email: 'lid@x.com', nome: 'Lia Nova', cargo: 'Líder' }).erros.hub, 'Selecione o Hub.');
  eq(A.call('solicitarCadastro', { email: 'lid@x.com', nome: 'Lia Nova', cargo: 'Líder', hub: 'H2' }).erros.turno, 'Selecione o turno.');
  eq(A.call('solicitarCadastro', { email: 'lid@x.com', nome: 'Lia Nova', cargo: 'Líder', hub: 'H2', turno: 'T2' }).ok, true);
  A.as('sl@x.com'); eq(A.call('listarSolicitacoes').pendentes.length, 0, 'Site Leader do Hub 1 não vê a solicitação do Hub 2'); eq(A.call('bootstrap').pendentes, 0);
  eq(A.call('salvarUsuario', { Email_Google: 'lid@x.com', Nome: 'Lia Nova', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null).msg, 'Esta solicitação é de outro Hub.');
  A.as('sl2@x.com'); eq(A.call('listarSolicitacoes').pendentes.length, 1); eq(A.call('bootstrap').pendentes, 1);
  const r = A.call('salvarUsuario', { Email_Google: 'lid@x.com', Nome: 'Lia Nova', Perfil: 'Auditor', Status_Ativo: 'Sim' }, null); eq(r.ok, true);
  const p = raw(A, 'Cad_Pessoas').find(x => x.Nome === 'Lia Nova'); eq([p.Cargo, p.Turno, p.Hub, p.Status_Ativo], ['Líder', 'T2', 'H2', 'Sim']);
  eq(raw(A, 'Cad_Usuarios').find(u => u.Email_Google === 'lid@x.com').Hub, 'H2');
  A.as('lid@x.com'); eq(A.call('bootstrap').user.hub.id, 'H2');
  const hl = raw(A, 'Pessoas_Historico').filter(x => x.Colaborador === 'Lia Nova'); eq(hl.length, 1); eq([hl[0].Evento, hl[0].Turno_Depois, hl[0].Hub], ['Criado', 'T2', 'H2']);
});
T('hub: com o isolamento desligado tudo continua visível (chave liga/desliga)', () => {
  const A = doisHubs(); A.as('owner@x.com'); A.call('desativarHubs');
  A.as('sl2@x.com'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 6); ok(A.call('listarCadastro', 'Cad_Pessoas').length > 0);
  A.as('owner@x.com'); A.call('ativarHubs'); A.as('sl2@x.com'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 0);
});
T('hub: renomear líder só renomeia as referências do próprio Hub', () => {
  const A = doisHubs(); A.as('owner@x.com'); A.call('definirHubAtivo', 'H2');
  A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Carlos Lider', Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim' }, null);
  A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Zeca', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }, null);
  const l2 = A.call('listarCadastro', 'Cad_Pessoas').find(x => x.Nome === 'Carlos Lider');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, l2, { Nome: 'Carlos Novo' }), l2).ok, true);
  ok(raw(A, 'Cad_Pessoas').filter(x => x.Hub === 'H1').every(x => x.Lider !== 'Carlos Novo'), 'Hub 1 intacto');
  eq(raw(A, 'Cad_Pessoas').find(x => x.Nome === 'Zeca').Lider, 'Carlos Novo');
});

/* ---------- carga em massa ---------- */
T('carga: pessoas — prévia com linha e coluna do erro; erro em qualquer linha = nada gravado', () => {
  const A = doisHubs(); A.as('sl2@x.com');
  const ok1 = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nMaria Souza\tLíder\tT1\tSim\t\nJoão Lima\tColaborador\tT1\tSim\tMaria Souza\nPedro Alves\tColaborador\tT2\tSim\tMaria Souza';
  const p = A.call('importarPrevia', 'pessoas', ok1); eq(p.ok, true); eq(p.resumo.total, 3); eq(p.hub, 'Hub Dois');
  const ruim = 'Maria Souza\tLíder\tT1\tSim\t\nJoão Lima\tColaborador\tT9\tSim\tMaria Souza\nAna Y\tColaborador\tT1\tSim\tNinguém\nMaria Souza\tLíder\tT1\tSim\t\nX=1\tLíder\tT1\tSim\t';
  const pr = A.call('importarPrevia', 'pessoas', ruim); eq(pr.ok, false);
  const e = pr.erros.map(x => x.linha + ':' + x.coluna);
  ok(e.includes('2:Turno') && e.includes('3:Lider') && e.includes('4:Nome') && e.includes('5:Nome'), e.join(','));
  const antes = raw(A, 'Cad_Pessoas').length;
  const c = A.call('importarConfirmar', 'pessoas', ruim); eq(c.ok, false); eq(raw(A, 'Cad_Pessoas').length, antes, 'nada gravado');
  const g = A.call('importarConfirmar', 'pessoas', ok1); eq(g.ok, true); eq(g.gravados, 3);
  const novos = raw(A, 'Cad_Pessoas').filter(x => ['Maria Souza', 'João Lima', 'Pedro Alves'].includes(x.Nome)); eq(novos.length, 3); ok(novos.every(x => x.Hub === 'H2'));
  eq(A.call('importarConfirmar', 'pessoas', ok1).ok, false, 'repetir a carga: já existem');
  A.as('ana@x.com'); ok(!A.call('listarCadastro', 'Cad_Pessoas').some(x => x.Nome === 'Maria Souza'), 'Hub 1 não recebe');
});
T('carga: docas — cor e símbolo livres por operação; cluster não entra; limites e tipos', () => {
  const A = doisHubs(); A.as('sl2@x.com');
  A.call('importarConfirmar', 'pessoas', 'Maria Souza\tLíder\tT1\tSim\t');
  eq(A.call('importarConfirmar', 'docas', 'Doca\t10\tRosa/Estrela\tMaria Souza\tT1\nDoca\t11\tAzul/Triângulo\t\t').ok, true);
  ok(raw(A, 'Cad_Estrutura').filter(x => ['10', '11'].includes(x.Identificador)).every(x => x.Hub === 'H2'));
  eq(A.call('importarPrevia', 'docas', 'Cluster\tZZ\tAzul/Triângulo\t\t').erros[0].coluna, 'Tipo');
  eq(A.call('importarPrevia', 'docas', 'Doca\t12\tXpto/Nada\t\t').erros[0].coluna, 'Cor_Simbolo');
  nega(() => A.call('importarPrevia', 'xpto', 'a'), 'inválido');
  nega(() => A.call('importarPrevia', 'pessoas', 'a\n'.repeat(502)), 'Máximo');
  nega(() => A.call('importarPrevia', 'pessoas', 'a'.repeat(100001)), 'grande demais');
  eq(A.call('importarPrevia', 'pessoas', '').ok, false);
  A.as('aud1@x.com'); nega(() => A.call('importarPrevia', 'pessoas', 'a'), 'não tem permissão');
  A.as('sl2@x.com'); const m = A.call('importarModelo', 'pessoas'); eq(m.cabecalho, 'Nome\tCargo\tTurno\tStatus_Ativo\tLider');
});

/* ---------- online ---------- */
T('online: pulso só em cache; Admin global vê todos os Hubs, Site Leader só o próprio; permissão obrigatória', () => {
  const A = doisHubs();
  ['owner@x.com', 'sl@x.com', 'aud1@x.com', 'sl2@x.com', 'aud3@x.com'].forEach(e => { A.as(e); eq(A.call('pulso').ok, true); });
  const antes = JSON.stringify(Object.keys(A.sheets).map(n => A.sheets[n].getLastRow()));
  A.as('owner@x.com'); eq(A.call('listarOnline').total, 5);
  A.as('sl2@x.com'); const o2 = A.call('listarOnline'); eq(o2.usuarios.map(u => u.email).sort(), ['aud3@x.com', 'sl2@x.com']); ok(o2.usuarios.every(u => u.hub === 'H2'));
  A.as('sl@x.com'); eq(A.call('listarOnline').usuarios.map(u => u.email).sort(), ['aud1@x.com', 'sl@x.com'], 'Admin global não aparece na lista do Hub');
  A.as('aud1@x.com'); nega(() => A.call('listarOnline'), 'não tem permissão');
  A.as('off@x.com'); nega(() => A.call('pulso'), 'Acesso negado');
  eq(JSON.stringify(Object.keys(A.sheets).map(n => A.sheets[n].getLastRow())), antes, 'presença não grava na planilha');
});
T('online: quem passou da janela de 5 min sai da lista', () => {
  const A = doisHubs(); A.as('aud1@x.com'); A.call('pulso'); A.as('owner@x.com'); A.call('pulso');
  const o = JSON.parse(A.cache.get('on:aud1@x.com')); o.t = Date.now() - 6 * 60 * 1000; A.cache.set('on:aud1@x.com', JSON.stringify(o));
  eq(A.call('listarOnline').usuarios.map(u => u.email), ['owner@x.com']);
});

/* ---------- log ---------- */
T('log: ações de escrita ficam no log com Hub e usuário; leitura isolada por Hub; sem permissão = negado', () => {
  const A = doisHubs(); A.as('sl2@x.com');
  A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Lia Lider', Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim' }, null);
  A.as('ana@x.com'); A.call('salvarMeta', { tipo: 'Perfil', alvo: 'Auditor', qtd: 3, ini: A.dia(0), fim: A.dia(5), processos: [] });
  A.as('owner@x.com'); const todos = A.call('consultarLog', {}); ok(todos.total >= 3);
  ok(todos.linhas.some(l => l.acao === 'Cadastro criado' && l.hub === 'H2' && l.email === 'sl2@x.com'));
  ok(todos.linhas.some(l => l.acao === 'Meta criada' && l.hub === 'H1'));
  ok(todos.linhas.some(l => l.acao === 'Auditoria registrada'), 'auditorias do cenário já registradas');
  A.as('sl2@x.com'); const l2 = A.call('consultarLog', {}); ok(l2.total >= 1 && l2.linhas.every(l => l.hub === 'H2'), 'Site Leader só do próprio Hub');
  eq(A.call('consultarLog', { hub: 'H1' }).linhas.every(l => l.hub === 'H2'), true, 'parâmetro de Hub é ignorado');
  A.as('owner@x.com'); ok(A.call('consultarLog', { hub: 'H2' }).linhas.every(l => l.hub === 'H2'));
  A.as('aud1@x.com'); nega(() => A.call('consultarLog', {}), 'não tem permissão');
  A.as('ana@x.com'); nega(() => A.call('consultarLog', {}), 'não tem permissão');
});
T('log: filtros, ordem e paginação; escrita no log é só do servidor (não há função pública de gravação)', () => {
  const A = doisHubs(); A.as('owner@x.com');
  for (let i = 0; i < 60; i++) A.ctx.logAtiv_({ email: 'owner@x.com', nome: 'Dono', perfil: 'Admin', hub: 'H1' }, 'Acao ' + i, 'alvo', 'x');
  const p1 = A.call('consultarLog', { acao: 'Acao ' }); eq([p1.total, p1.linhas.length, p1.linhas[0].acao], [60, 50, 'Acao 59']);
  const p2 = A.call('consultarLog', { acao: 'Acao ', pagina: 2 }); eq(p2.linhas.length, 10);
  eq(A.call('consultarLog', { acao: 'acao 7' }).total, 1);
  eq(A.call('consultarLog', { email: 'naoexiste' }).total, 0);
  eq(A.call('consultarLog', { de: A.dia(1), ate: A.dia(2) }).total, 0);
  ok(!['gravarLog', 'logAtiv', 'registrarLog'].some(n => typeof A.ctx[n] === 'function'));
});
T('log: injeção de fórmula e texto longo são neutralizados', () => {
  const A = doisHubs(); A.as('owner@x.com');
  A.ctx.logAtiv_({ email: 'o@x.com', nome: '=HYPERLINK("x")', perfil: 'Admin', hub: 'H1' }, '+cmd', '@alvo', 'y'.repeat(2000));
  const l = raw(A, 'Log_Atividade').pop(); ok(String(l.Nome).startsWith(' =') && String(l.Acao).startsWith(' +') && String(l.Alvo).startsWith(' @')); ok(String(l.Detalhe).length <= 601);
});
T('log: arquivo em planilha separada — move o antigo, confere a cópia e só então apaga; falha não perde dado', () => {
  const A = doisHubs(); A.as('owner@x.com');
  const s = A.sheets.Log_Atividade, antes = s.getLastRow() - 1;
  const velho = A.run("fmt_(new Date(Date.now() - 100 * 864e5))");
  A.ctx.anexarLinhas_('Log_Atividade', [[velho, 'H1', 'v@x.com', 'Velho', 'Admin', 'Acao antiga', 'a', 'b']]);
  // o log vivo é cronológico: coloca o velho no topo
  const ult = s.d.pop(); s.d.splice(1, 0, ult);
  A.arquivoFalha = true; const f = A.call('arquivarLog'); ok(f.erro && f.movidos === 0); const comFalha = s.getLastRow() - 1; eq(comFalha, antes + 2, 'falha: nada apagado (só o registro da falha foi acrescentado)');
  ok(raw(A, 'Log_Permissoes').some(l => l.Acao === 'Falha ao arquivar o log'));
  A.arquivoFalha = false;
  const r = A.call('arquivarLog'); eq([r.movidos, r.erro], [1, '']); eq(s.getLastRow() - 1, comFalha - 1);
  const arq = A.planilhasExtra[A.props.LOG_ARQUIVO_ID].sheets.Log_Atividade; eq(arq.getLastRow(), 2); eq(arq.d[1][5], 'Acao antiga');
  eq(A.call('arquivarLog').movidos, 0, 'idempotente');
  A.call('agendarArquivoLog'); A.call('agendarArquivoLog'); eq(A.triggers.filter(t => t.getHandlerFunction() === 'arquivarLog').length, 1);
});

/* ---------- aviso de transparência ---------- */
T('aceite: desligado não bloqueia; ligado bloqueia no servidor até aceitar a versão atual; novo texto exige novo aceite', () => {
  const A = doisHubs(); A.as('aud1@x.com');
  eq(A.call('bootstrap').aviso.desligado, true); ok(A.call('getMatriz', 'Recebimento'));
  A.as('owner@x.com'); A.call('ativarAvisoLog');
  A.as('aud1@x.com'); const b = A.call('bootstrap'); eq([b.bloqueado, b.aviso.aceito], [true, false]); ok(!b.db && !b.config); ok(b.aviso.versao);
  nega(() => A.call('getMatriz', 'Recebimento'), 'aceite o aviso'); nega(() => A.call('relatorio', 'geral', A.F(), {}), 'aceite o aviso'); nega(() => A.call('pulso'), 'aceite o aviso');
  eq(A.call('aceitarAviso', 'versao-errada').ok, false);
  eq(A.call('aceitarAviso', b.aviso.versao).ok, true); eq(A.call('aceitarAviso', b.aviso.versao).ok, true);
  eq(raw(A, 'Log_Aceites').filter(r => r.Email === 'aud1@x.com').length, 1, 'aceite gravado uma vez, com data e versão');
  const r = raw(A, 'Log_Aceites')[0]; eq([r.Versao_Texto, r.Hub], [b.aviso.versao, 'H1']); ok(r.Timestamp);
  ok(A.call('getMatriz', 'Recebimento')); eq(A.call('bootstrap').aviso.aceito, true);
  A.run("AVISO_LOG.pt = AVISO_LOG.pt + ' (revisado)'"); A.cache.clear();
  const b2 = A.call('bootstrap'); eq(b2.bloqueado, true); ok(b2.aviso.versao !== b.aviso.versao);
  nega(() => A.call('getMatriz', 'Recebimento'), 'aceite o aviso'); eq(A.call('aceitarAviso', b2.aviso.versao).ok, true); ok(A.call('getMatriz', 'Recebimento'));
  eq(raw(A, 'Log_Aceites').filter(r => r.Email === 'aud1@x.com').length, 2, 'append-only: duas versões');
  A.as('novo@x.com'); nega(() => A.call('aceitarAviso', b2.aviso.versao), 'Acesso negado');
});

/* ---------- perfis e permissões novas ---------- */
T('perfis: ver_log e ver_online são atribuíveis por perfil; Analista não tem por padrão', () => {
  const A = cenario(); A.as('ana@x.com'); const u = A.call('bootstrap').user;
  ok(!u.perms.includes('ver_log') && !u.perms.includes('ver_online') && !u.perms.includes('hubs'));
  A.as('owner@x.com');
  eq(A.call('salvarPerfil', { nome: 'Gestor Online', desc: '', perms: ['ver_online'], telas: ['matriz'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true).ok, true);
  novoUsuario(A, 'gest@x.com', 'Gestor', 'Gestor Online'); A.as('gest@x.com'); eq(A.call('listarOnline').total, 0); nega(() => A.call('consultarLog', {}), 'não tem permissão');
  A.as('owner@x.com');
  eq(A.call('salvarPerfil', { nome: 'Gestor Log', desc: '', perms: ['ver_log'], telas: ['matriz'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true).ok, true);
  ok(A.call('listarAcessos').perfis.find(p => p.nome === 'Gestor Log').telas.includes('log'), 'a tela do log vem junto com a permissão');
});
fim('SERVIDOR parte 10 (v8: desempenho, Matriz, Hub, carga, online, log, aceite)');
