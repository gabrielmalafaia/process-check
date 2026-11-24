const { T, eq, ok, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
A.as('owner@x.com');
const perm = ['ver_nomes'];
A.call('salvarPerfil', { nome: 'Líder', desc: 'teste', perms: ['ver_nomes','exportar'], telas: ['geral', 'auditorias', 'colab', 'doca', 'proc', 'tend', 'matriz', 'export'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
A.ctx.anexar_('Cad_Usuarios', ['carlos@x.com', 'Carlos Lider', 'Líder', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['dora@x.com', 'Dora Lider', 'Líder', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['sem@x.com', 'Joao Sem Cadastro', 'Líder', 'Sim']);
const R = (t, f, ex) => A.call('relatorio', t, f || A.F(), ex);
const nomes = (o) => JSON.stringify(o);

T('Líder Carlos: vê só auditorias em que é líder (sem perder as dele)', () => {
  A.as('carlos@x.com'); const r = R('auditorias');
  const ids = r.linhas.map(l => l.id);
  console.log('   total Carlos:', r.total, 'ids', ids.length);
  ok(r.total > 0);
  r.linhas.forEach(l => ok(!/Carla|Davi/.test(l.colab) && !/Dora/.test(l.lider), 'linha com dados de outra equipe: ' + l.colab + ' / ' + l.lider));
});
T('Líder Carlos: nenhuma linha mostra colaborador do time da Dora (vazamento por auditoria multi-líder)', () => {
  A.as('carlos@x.com'); const s = nomes(R('auditorias')) + nomes(R('export')) ;
  ['Carla Dias', 'Davi Reis'].forEach(n => ok(s.indexOf(n) < 0, 'vazou ' + n));
});
T('Líder Carlos: tela Colaboradores só lista o time dele (inclui sem auditoria)', () => {
  A.as('carlos@x.com'); const c = R('colab');
  const n = c.colabs.map(x => x.nome).concat(c.semAuditoria.map(x => x.nome));
  console.log('   colabs:', n.join(', '));
  n.forEach(x => ok(['Ana Souza', 'Bruno Lima', 'Eva Nunes'].includes(x), 'fora do time: ' + x));
});
T('Líder Carlos: tela Equipes só mostra o time dele', () => {
  A.as('carlos@x.com'); const c = R('colab');
  console.log('   times:', c.times.map(t => t.lider).join(', '));
  c.times.forEach(t => eq(t.lider, 'Carlos Lider'));
});
T('Líder Carlos: detalhe de colaborador/líder do outro time é negado ou vazio', () => {
  A.as('carlos@x.com');
  const d1 = R('detalhe', A.F(), { kind: 'colab', chave: 'Carla Dias' });
  const d2 = R('detalhe', A.F(), { kind: 'lider', chave: 'Dora Lider' });
  console.log('   detalhe Carla n=', d1.kpis.n, ' Dora n=', d2.kpis.n);
  eq(d1.kpis.n, 0); eq(d2.kpis.n, 0);
});
T('Líder Carlos: filtros lider/colaborador de outro time não devolvem dados de fora do escopo', () => {
  A.as('carlos@x.com'); const r = R('auditorias', A.F({ lider: 'Dora Lider' }));
  eq(r.total, 0);
  console.log('   filtro Dora ->', r.total, 'linhas', r.linhas.map(l => l.proc + '/' + l.doca + '/' + l.lider).join(' | '));
});
T('Líder Carlos: bootstrap não manda a lista de pessoas de outros times', () => {
  A.as('carlos@x.com'); const b = A.call('bootstrap');
  const s = nomes(b.db.Cad_Pessoas);
  ok(s.indexOf('Carla Dias') < 0 && s.indexOf('Dora Lider') < 0 && s.indexOf('Ana Souza') > -1 && s.indexOf('Carlos Lider') > -1);
});
T('Líder Carlos: Matriz de Indução lista todos os líderes (qualquer líder pode auditar qualquer unidade)', () => {
  A.as('carlos@x.com'); const m = A.call('getMatriz', 'Indução');
  eq(m.map(x => x.id).join(','), 'Carlos Lider,Dora Lider');
});
T('Líder Carlos: Matriz de docas (Recebimento) lista todas as docas', () => {
  A.as('carlos@x.com'); const m = A.call('getMatriz', 'Recebimento');
  eq(m.map(x => x.id).sort().join(','), '01,07,36');
});
T('Líder Carlos: Visão Geral conta só o que é dele (pendentes/esperadas ignoram escopo)', () => {
  A.as('carlos@x.com'); const g = R('geral'); A.as('sl@x.com'); const t = R('geral');
  ok(g.A.pend >= t.A.pend - 1 && g.A.pend > 0, 'pendentes contam todas as docas'); ok(g.A.total < t.A.total);
});
T('Líder sem correspondência no cadastro de pessoas vê zero (não tudo)', () => {
  A.as('sem@x.com'); const r = R('auditorias'); eq(r.total, 0);
});
T('Nome do usuário com acento/caixa diferente do cadastro de líder', () => {
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Usuarios', ['carlos2@x.com', 'CARLOS LÍDER', 'Líder', 'Sim']); A.run('limparCache_()');
  A.as('carlos2@x.com'); let t; try { t = R('auditorias').total; } catch (e) { t = 'ERRO ' + e.message; } eq(t, 3);
});
T('Escopo time + turno: combinação é AND (Carlos com limite T2 não vê nada)', () => {
  A.as('owner@x.com');
  A.call('salvarPerfil', { nome: 'LiderT2', desc: 't', perms: perm, telas: ['auditorias'], escopo: { modo: 'time', processos: [], turnos: ['T2'] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['c3@x.com', 'Carlos Lider', 'LiderT2', 'Sim']); A.run('limparCache_()');
  A.as('c3@x.com'); const r = R('auditorias'); console.log('   Carlos+T2 ->', r.total);
});
T('E-mail do líder: contém só o escopo dele', () => {
  A.as('owner@x.com');
  const m = A.run("montarEmailRel_(acessoDe_('carlos@x.com'),'pt',{de:'"+A.dia(-30)+"',ate:'"+A.hojeStr+"'})");
  const s = JSON.stringify(m);
  ok(!/Carla|Davi|Dora/.test(s));
});
T('Líder: tela Equipes sem Dora e sem Davi/Carla em nenhuma lista', () => {
  A.as('carlos@x.com'); const c = R('colab'); const s = JSON.stringify(c); ok(!/Carla|Davi|Dora/.test(s), s.slice(0, 200));
});
T('Líder com turno limitado: lista sem auditoria também respeita o turno', () => {
  A.as('owner@x.com');
  A.call('salvarPerfil', { nome: 'SoT2', desc: 't', perms: ['ver_nomes'], telas: ['colab'], escopo: { modo: 'todos', processos: [], turnos: ['T2'] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['t2@x.com', 'Teste T2', 'SoT2', 'Sim']); A.run('limparCache_()');
  A.as('t2@x.com'); const c = R('colab'); c.semAuditoria.forEach(x => eq(x.turno, 'T2'));
});
T('Acessos: usuário com perfil "time" sem líder correspondente vem marcado (semLider)', () => {
  A.as('owner@x.com'); const u = A.call('listarAcessos').usuarios;
  const por = {}; u.forEach(x => por[x.Email_Google] = x.semLider);
  eq(por['carlos@x.com'], false); eq(por['sem@x.com'], true); eq(por['carlos2@x.com'], false); eq(por['ana@x.com'], false);
});
T('Quem preenche auditoria (permissão auditar) continua recebendo o cadastro completo de pessoas', () => {
  A.as('aud1@x.com'); const b = A.call('bootstrap'); ok(JSON.stringify(b.db.Cad_Pessoas).indexOf('Carla Dias') > -1);
});
/* ===== líder que também audita ===== */
A.as('owner@x.com');
A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar', 'ver_nomes'], telas: ['matriz', 'form', 'auditorias', 'colab'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']); A.run('limparCache_()');
T('Líder que audita: formulário só traz colaboradores do time dele, docas de todos', () => {
  A.as('carlosa@x.com'); const b = A.call('bootstrap'); const s = JSON.stringify(b.db.Cad_Pessoas);
  ok(s.indexOf('Ana Souza') > -1 && s.indexOf('Carla Dias') < 0 && s.indexOf('Davi Reis') < 0);
  ok(b.db.Cad_Estrutura.some(e => e.Identificador === '07'), 'doca da Dora disponível');
});
T('Líder audita doca de outro líder com colaborador do time dele: aceita e aparece nos relatórios dele', () => {
  const r = A.audit('carlosa@x.com', 'Expedição', { conf: 9, nc: 1, f: { doca: '07', colaboradores: ['Ana Souza'] } }); eq(r.ok, true, JSON.stringify(r));
  A.run('limparCache_()'); A.as('carlosa@x.com'); ok(R('auditorias').linhas.some(l => l.id === r.id && l.doca === '07'));
  A.as('dora@x.com'); ok(!R('auditorias').linhas.some(l => l.id === r.id), 'Dora só vê o que é do time dela (Ana é do Carlos)');
});
T('Líder não consegue auditar colaborador de outro time (validado no servidor)', () => {
  const r = A.audit('carlosa@x.com', 'Expedição', { conf: 10, f: { doca: '01', colaboradores: ['Carla Dias'] } });
  eq(r.ok, false); ok(/regra de auditoria/.test(r.erros.colaborador) && !/Carla|Dora/.test(r.erros.colaborador), JSON.stringify(r));
});
T('Líder audita processo de doca sem colaborador: fica no nome dele', () => {
  const r = A.audit('carlosa@x.com', 'Recebimento', { conf: 10, f: { doca: '07', lider: 'Dora Lider', turno: 'T2' } }); eq(r.ok, true, JSON.stringify(r));
  A.run('limparCache_()'); A.as('carlosa@x.com'); const l = R('auditorias').linhas.find(x => x.id === r.id); ok(l, 'visível para quem auditou'); eq(l.lider, 'Carlos Lider');
});
fim();
