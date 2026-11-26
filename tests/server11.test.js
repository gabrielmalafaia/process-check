const { T, eq, ok, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
A.as('owner@x.com');
A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar', 'ver_nomes'], telas: ['matriz', 'form', 'auditorias', 'colab'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
A.call('salvarPerfil', { nome: 'LiderT1', desc: 't', perms: ['auditar'], telas: ['matriz', 'form'], escopo: { modo: 'time', processos: [], turnos: ['T1'] } }, true);
A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['dora@x.com', 'Dora Lider', 'LiderAud', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['dorat1@x.com', 'Dora Lider', 'LiderT1', 'Sim']);
A.run('limparCache_()');
const regra = (email, o) => {
  const d = Object.assign({ p: 'Sim', o: 'Não', t: '', tu: '', c: '', pr: '', vp: 'Sim', vo: 'proprias' }, o || {});
  const aba = A.sheets.Cad_Regras_Lider; for (let i = aba.d.length - 1; i > 0; i--) if (aba.d[i][0] === email) aba.d.splice(i, 1);
  A.ctx.anexar_('Cad_Regras_Lider', [email, d.p, d.o, d.t, d.tu, d.c, d.pr, d.vp, d.vo, 'teste', '']); A.run('limparCache_()');
};
const limpa = (email) => { const aba = A.sheets.Cad_Regras_Lider; for (let i = aba.d.length - 1; i > 0; i--) if (aba.d[i][0] === email) aba.d.splice(i, 1); A.run('limparCache_()'); };
const exp = (email, colabs, o) => A.audit(email, 'Expedição', { conf: 10, f: Object.assign({ doca: '01', colaboradores: colabs }, o || {}) });
const nHist = () => A.sheets.Auditorias_Historico.d.length;

T('sem regra: o líder audita só o próprio time (comportamento anterior)', () => {
  limpa('carlosa@x.com'); eq(exp('carlosa@x.com', ['Ana Souza']).ok, true);
  const r = exp('carlosa@x.com', ['Carla Dias']); eq(r.ok, false); ok(/regra de auditoria/.test(r.erros.colaborador));
});
T('próprio time bloqueado: o líder não audita os colaboradores dele, mas audita outros times', () => {
  regra('carlosa@x.com', { p: 'Não', o: 'Sim' });
  eq(exp('carlosa@x.com', ['Ana Souza']).ok, false); eq(exp('carlosa@x.com', ['Carla Dias']).ok, true);
});
T('outros times: sem lista libera todos; com lista só os líderes listados; Não bloqueia', () => {
  regra('carlosa@x.com', { o: 'Sim' }); eq(exp('carlosa@x.com', ['Carla Dias']).ok, true);
  regra('carlosa@x.com', { o: 'Sim', t: 'Outro Lider' }); eq(exp('carlosa@x.com', ['Carla Dias']).ok, false); eq(exp('carlosa@x.com', ['Ana Souza']).ok, true);
  regra('carlosa@x.com', { o: 'Sim', t: 'dora lider' }); eq(exp('carlosa@x.com', ['Carla Dias']).ok, true, 'comparação sem acento e sem caixa');
  regra('carlosa@x.com', { o: 'Não' }); eq(exp('carlosa@x.com', ['Carla Dias']).ok, false);
});
T('filtro de turno: vale para o turno da auditoria e para o turno de cada colaborador', () => {
  regra('carlosa@x.com', { o: 'Sim', tu: 'T1' });
  eq(exp('carlosa@x.com', ['Ana Souza']).ok, true); const r = exp('carlosa@x.com', ['Carla Dias']); eq(r.ok, false);
  regra('carlosa@x.com', { o: 'Sim', tu: 'T2' }); eq(exp('carlosa@x.com', ['Ana Souza']).ok, false); eq(exp('carlosa@x.com', ['Carla Dias']).ok, true);
});
T('filtro de cor e símbolo: vale para a doca escolhida', () => {
  regra('carlosa@x.com', { o: 'Sim', c: 'Roxo/Losango' });
  eq(exp('carlosa@x.com', ['Ana Souza'], { doca: '36' }).ok, false); eq(exp('carlosa@x.com', ['Ana Souza'], { doca: '07' }).ok, true);
  const r = A.audit('carlosa@x.com', 'Recebimento', { conf: 10, f: { doca: '36', lider: 'Carlos Lider', turno: 'T1' } }); eq(r.ok, false); ok(/cor e símbolo/.test(r.erros.doca));
});
T('filtro de processo', () => {
  regra('carlosa@x.com', { pr: 'Recebimento' });
  eq(exp('carlosa@x.com', ['Ana Souza']).ok, false);
  eq(A.audit('carlosa@x.com', 'Recebimento', { conf: 10, f: { doca: '01', lider: 'Carlos Lider', turno: 'T1' } }).ok, true);
});
T('todos os critérios combinam com E', () => {
  regra('carlosa@x.com', { o: 'Sim', t: 'Dora Lider', tu: 'T2', c: 'Verde/Bolinha', pr: 'Expedição' });
  eq(exp('carlosa@x.com', ['Carla Dias']).ok, true);
  eq(exp('carlosa@x.com', ['Carla Dias'], { doca: '07' }).ok, false, 'cor errada');
  eq(exp('carlosa@x.com', ['Ana Souza']).ok, false, 'time e turno errados');
});
T('lote: um colaborador fora da regra derruba a auditoria inteira e nada é gravado', () => {
  regra('carlosa@x.com', { o: 'Não' }); const n = nHist();
  const r = exp('carlosa@x.com', ['Ana Souza', 'Carla Dias']); eq(r.ok, false); eq(nHist(), n);
});
T('falha fechada: regra ilegível, repetida ou com valor desconhecido nega tudo', () => {
  [{ p: 'talvez' }, { vo: 'todos' }, { tu: 'T9' }, { pr: 'Inexistente' }, { c: 'Azul' }, { o: '' }].forEach(o => {
    regra('carlosa@x.com', o); const r = exp('carlosa@x.com', ['Ana Souza']); eq(r.ok, false, JSON.stringify(o)); ok(/inválida/.test(r.erros.colaborador), JSON.stringify(o));
  });
  regra('carlosa@x.com', {}); A.ctx.anexar_('Cad_Regras_Lider', ['carlosa@x.com', 'Sim', 'Sim', '', '', '', '', 'Sim', 'proprias', 'x', '']); eq(exp('carlosa@x.com', ['Ana Souza']).ok, false, 'linha repetida');
});
T('a regra da pessoa só restringe: o perfil continua valendo (turno do perfil)', () => {
  regra('dorat1@x.com', { o: 'Sim' });
  eq(exp('dorat1@x.com', ['Ana Souza']).ok, true, 'T1 permitido pelo perfil e pela regra');
  const r = exp('dorat1@x.com', ['Carla Dias']); eq(r.ok, false, 'T2 barrado pelo perfil mesmo com a regra liberando');
  limpa('dorat1@x.com');
});
T('quem não é líder (escopo todos) ignora a regra', () => {
  regra('aud1@x.com', { p: 'Não', o: 'Não' }); eq(exp('aud1@x.com', ['Carla Dias']).ok, true); limpa('aud1@x.com');
});
T('mensagens de negação não repetem nomes de pessoas', () => {
  regra('carlosa@x.com', { o: 'Não' }); const r = exp('carlosa@x.com', ['Carla Dias']);
  ok(!/Carla|Dora|Davi/.test(JSON.stringify(r)), JSON.stringify(r));
});
T('regra relida dentro da trava: se mudar entre validar e gravar, nada é gravado', () => {
  regra('carlosa@x.com', { o: 'Sim' }); const orig = A.ctx.regraDe_; let n = 0, antes = nHist();
  A.ctx.regraDe_ = (e, d) => { n++; return n === 1 ? orig(e, d) : Object.assign(orig(e, d), { outros: false }); };
  let r; try { r = exp('carlosa@x.com', ['Carla Dias']); } finally { A.ctx.regraDe_ = orig; }
  eq(r.ok, false); eq(nHist(), antes); ok(n >= 2, 'consultou duas vezes');
});
T('regra presente não vaza para o cliente do líder', () => {
  regra('carlosa@x.com', { o: 'Sim' }); A.as('carlosa@x.com'); ok(!/Cad_Regras_Lider|Atualizado_Por/.test(JSON.stringify(A.call('bootstrap'))));
});
T('formulário: o líder só recebe os colaboradores e líderes que a regra permite auditar', () => {
  const nomes = () => { A.as('carlosa@x.com'); return A.call('bootstrap').db.Cad_Pessoas.map(p => p.Nome); };
  limpa('carlosa@x.com'); let n = nomes(); ok(n.includes('Ana Souza') && n.includes('Carlos Lider') && !n.includes('Carla Dias') && !n.includes('Dora Lider'), 'padrão = como antes');
  regra('carlosa@x.com', { o: 'Sim' }); n = nomes(); ok(n.includes('Ana Souza') && n.includes('Carla Dias') && n.includes('Dora Lider'));
  regra('carlosa@x.com', { p: 'Não', o: 'Sim' }); n = nomes(); ok(!n.includes('Ana Souza') && !n.includes('Carlos Lider') && n.includes('Carla Dias'), 'próprio time fora da lista');
  regra('carlosa@x.com', { o: 'Sim', tu: 'T2' }); n = nomes(); ok(!n.includes('Ana Souza') && n.includes('Carla Dias'), 'turno filtra a lista');
  regra('carlosa@x.com', { p: 'Talvez' }); eq(nomes(), [], 'regra inválida: lista vazia');
});
T('formulário: perfil que não é líder continua recebendo todas as pessoas', () => {
  A.as('aud1@x.com'); ok(A.call('bootstrap').db.Cad_Pessoas.some(p => p.Nome === 'Carla Dias'));
});
T('cadastro: líder com permissão de cadastro não muda time, turno nem cargo, e só inclui colaborador no próprio time', () => {
  A.as('owner@x.com');
  A.call('salvarPerfil', { nome: 'LiderCad', desc: 't', perms: ['cad_pessoas'], telas: ['cad'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['carloscad@x.com', 'Carlos Lider', 'LiderCad', 'Sim']); A.run('limparCache_()');
  A.as('carloscad@x.com');
  const linhas = () => A.call('lerDireto_', 'Cad_Pessoas'); const ana = linhas().find(p => p.Nome === 'Ana Souza');
  const mexe = (o) => A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, ana, o), ana);
  eq(mexe({ Lider: 'Dora Lider' }).ok, false); eq(mexe({ Turno: 'T2' }).ok, false); eq(mexe({ Cargo: 'Líder' }).ok, false);
  eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Novo Dora', Cargo: 'Colaborador', Turno: 'T2', Status_Ativo: 'Sim', Lider: 'Dora Lider' }).ok, false, 'incluir no time de outro líder');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Novo Carlos', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }).ok, true, 'incluir no próprio time');
  const p = A.call('importarPrevia', 'pessoas', 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nZe Um\tColaborador\tT2\tSim\tDora Lider'); eq(p.ok, false);
  A.as('sl@x.com'); const mov = A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, ana, { Lider: 'Dora Lider', Turno: 'T2' }), ana); eq(mov.ok, true, 'Site Leader pode mover');
  const ana2 = A.call('lerDireto_', 'Cad_Pessoas').find(p => p.Nome === 'Ana Souza'); eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, ana2, { Lider: 'Carlos Lider', Turno: 'T1' }), ana2).ok, true, 'volta ao time original');
});
T('visão: padrão = só o time próprio; auditoria feita pelo líder em outro time aparece para ele; regra decide o resto', () => {
  A.as('owner@x.com'); const vis = (email) => { A.run('limparCache_()'); A.as(email); return A.call('relatorio', 'auditorias', A.F()).linhas.map(l => l.id); };
  regra('carlosa@x.com', { o: 'Sim' }); const feita = exp('carlosa@x.com', ['Carla Dias']); eq(feita.ok, true); const propria = exp('carlosa@x.com', ['Ana Souza']); eq(propria.ok, true);
  const dora = A.audit('dora@x.com', 'Expedição', { conf: 9, nc: 1, f: { doca: '07', colaboradores: ['Davi Reis'] } }); eq(dora.ok, true, JSON.stringify(dora));
  let v = vis('carlosa@x.com'); ok(v.includes(feita.id) && v.includes(propria.id), 'vê o que fez e o próprio time'); ok(!v.includes(dora.id), 'não vê o histórico do time da Dora (verOutros=proprias)');
  regra('carlosa@x.com', { o: 'Sim', vo: 'time' }); v = vis('carlosa@x.com'); ok(v.includes(dora.id), 'verOutros=time: vê o histórico dos times que audita');
  regra('carlosa@x.com', { o: 'Sim', vo: 'time', t: 'Outro Lider' }); v = vis('carlosa@x.com'); ok(!v.includes(dora.id), 'só dos times que a regra deixa auditar');
  regra('carlosa@x.com', { o: 'Sim', vp: 'Não' }); v = vis('carlosa@x.com'); ok(!v.includes(propria.id) && v.includes(feita.id), 'ver o próprio time desligado');
  regra('carlosa@x.com', { o: 'Sim', vp: 'Talvez', vo: 'time' }); v = vis('carlosa@x.com'); ok(v.includes(feita.id) && !v.includes(propria.id) && !v.includes(dora.id), 'regra inválida nunca amplia a visão (desde a v10.5: só o que o líder auditou)');
});
T('visão: dados em cache não passam de um líder com outra regra para outro (mesmo filtro)', () => {
  A.as('owner@x.com'); regra('carlosa@x.com', { o: 'Sim', vo: 'time' }); A.run('limparCache_()');
  A.as('carlosa@x.com'); const n1 = A.call('relatorio', 'auditorias', A.F()).linhas.length;
  regra('carlosa@x.com', { o: 'Sim', vo: 'proprias' }); A.as('carlosa@x.com'); const n2 = A.call('relatorio', 'auditorias', A.F()).linhas.length; ok(n2 < n1, n1 + ' -> ' + n2);
});
T('cadastro: restaurar, excluir e editar fora do próprio time também são barrados para o líder (revisão adversarial)', () => {
  A.as('carloscad@x.com'); const pes = () => A.call('lerDireto_', 'Cad_Pessoas'); const carla = pes().find(p => p.Nome === 'Carla Dias'), ana = pes().find(p => p.Nome === 'Ana Souza');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, carla, { Status_Ativo: 'Não' }), carla).ok, false, 'desativar colaborador de outro time');
  eq(A.call('excluirCadastro', 'Cad_Pessoas', carla._row, carla).ok, false, 'excluir colaborador de outro time'); ok(pes().some(p => p.Nome === 'Carla Dias'));
  eq(A.call('restaurarCadastro', 'Cad_Pessoas', { Nome: 'Intruso', Cargo: 'Colaborador', Turno: 'T2', Status_Ativo: 'Sim', Lider: 'Dora Lider' }, 3).ok, false, 'restaurar no time de outro líder');
  eq(A.call('restaurarCadastro', 'Cad_Pessoas', { Nome: 'Novo Lider X', Cargo: 'Líder', Turno: 'T2', Status_Ativo: 'Sim' }, 3).ok, false, 'criar líder');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, ana, { Status_Ativo: 'Não' }), ana).ok, true, 'desativar colaborador do próprio time pode');
  const ana2 = pes().find(p => p.Nome === 'Ana Souza'); eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, ana2, { Status_Ativo: 'Sim' }), ana2).ok, true);
  const bruno = pes().find(p => p.Nome === 'Bruno Lima'); eq(A.call('excluirCadastro', 'Cad_Pessoas', bruno._row, bruno).ok, true, 'excluir do próprio time pode');
});
T('líderes com nome igual sem acento: cadastro barra o segundo e a auditoria nega se já existirem dois', () => {
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Pessoas', ['José Souza', 'Líder', 'T1', 'Sim', '']); A.run('limparCache_()');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Jose Souza', Cargo: 'Líder', Turno: 'T2', Status_Ativo: 'Sim' }).ok, false, 'validação sem acento');
  A.ctx.anexar_('Cad_Pessoas', ['Jose Souza', 'Líder', 'T2', 'Sim', '']); A.ctx.anexar_('Cad_Pessoas', ['Col Do Jose', 'Colaborador', 'T1', 'Sim', 'Jose Souza']);
  A.ctx.anexar_('Cad_Usuarios', ['josel@x.com', 'José Souza', 'LiderAud', 'Sim']); A.run('limparCache_()'); regra('josel@x.com', {});
  const r = exp('josel@x.com', ['Col Do Jose']); eq(r.ok, false); ok(/mais de um líder/.test(r.erros.colaborador), JSON.stringify(r));
});
T('regra de turno: colaborador sem turno cadastrado não passa', () => {
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Pessoas', ['Sem Turno', 'Colaborador', '', 'Sim', 'Dora Lider']); A.run('limparCache_()');
  regra('carlosa@x.com', { o: 'Sim', tu: 'T1' }); eq(exp('carlosa@x.com', ['Sem Turno'], { turno: 'T1' }).ok, false);
});
/* ===== fase 5: edição das regras (permissão, escalonamento, log) ===== */
const base = { email: 'carlosa@x.com', proprio: true, outros: true, verProprio: true, verOutros: 'proprias', times: [], turnos: [], cores: [], processos: [] };
const logs = () => A.call('lerDireto_', 'Log_Permissoes');
T('edição: Site Leader e Admin salvam a regra e o log registra quem mudou o quê', () => {
  A.as('sl@x.com'); limpa('carlosa@x.com');
  const r = A.call('salvarRegraLider', Object.assign({}, base, { proprio: false, turnos: ['T2'], times: ['Dora Lider'] })); eq(r.ok, true, JSON.stringify(r));
  const reg = r.dados.lideres.find(l => l.email === 'carlosa@x.com').regra; eq([reg.proprio, reg.outros, reg.turnos, reg.times], [false, true, ['T2'], ['Dora Lider']]);
  ok(logs().some(l => l.Acao === 'Regra de auditoria alterada' && l.Alvo === 'carlosa@x.com' && /Próprio: Não/.test(l.Detalhe)));
  A.as('owner@x.com'); eq(A.call('salvarRegraLider', base).ok, true);
  eq(A.call('excluirRegraLider', 'carlosa@x.com').ok, true); eq(A.sheets.Cad_Regras_Lider.d.filter(x => x[0] === 'carlosa@x.com').length, 0);
});
T('edição: quem não tem a permissão (líder, auditor, analista) não lê nem grava', () => {
  ['carlosa@x.com', 'aud1@x.com', 'ana@x.com'].forEach(e => {
    A.as(e); ['listarRegrasLider'].forEach(f => { let m = ''; try { A.call(f); } catch (x) { m = String(x.message || x); } ok(m, e + ' ' + f); });
    let m2 = ''; try { A.call('salvarRegraLider', base); } catch (x) { m2 = String(x.message || x); } ok(m2, e + ' salvar');
  });
});
T('edição: ninguém edita a própria regra; não edita quem não é líder nem outro Site Leader', () => {
  A.as('sl@x.com'); eq(A.call('salvarRegraLider', Object.assign({}, base, { email: 'sl@x.com' })).ok, false);
  eq(A.call('salvarRegraLider', Object.assign({}, base, { email: 'aud1@x.com' })).ok, false, 'perfil Auditor não é líder');
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Usuarios', ['sl2@x.com', 'Segundo SL', 'Site Leader', 'Sim']); A.run('limparCache_()');
  A.call('salvarPerfil', { nome: 'SLTime', desc: 't', perms: ['auditar', 'usuarios', 'regras_lider'], telas: ['form', 'acessos'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['sltime@x.com', 'SL Time', 'SLTime', 'Sim']); A.run('limparCache_()');
  A.as('sl@x.com'); eq(A.call('salvarRegraLider', Object.assign({}, base, { email: 'sltime@x.com' })).ok, false, 'quem tem a permissão de regras também não é editável por outro');
  A.as('sltime@x.com'); let mm = ''; try { A.call('salvarRegraLider', Object.assign({}, base, { email: 'carlosa@x.com' })); } catch (x) { mm = String(x.message || x); } ok(/só parte dos dados/.test(mm), 'perfil de time com a permissão não define regras');
});
T('edição: valores inválidos são recusados e nada é gravado', () => {
  A.as('sl@x.com'); limpa('carlosa@x.com'); const n = A.sheets.Cad_Regras_Lider.d.length;
  [{ turnos: ['T9'] }, { processos: ['Inexistente'] }, { cores: ['Azul'] }, { times: ['Fulano Qualquer'] }, { times: ['a|b'] }, { turnos: 'T1' }, { turnos: ['T1', 'T1'] }, { verOutros: 'todos' }, { proprio: 'Sim' }, { times: Array(101).fill('x') }, { turnos: [''] }]
    .forEach(o => { const r = A.call('salvarRegraLider', Object.assign({}, base, o)); eq(r.ok, false, JSON.stringify(o).slice(0, 60)); });
  eq(A.sheets.Cad_Regras_Lider.d.length, n);
});
T('edição: se o log falhar a regra não muda (log obrigatório)', () => {
  A.as('sl@x.com'); regra('carlosa@x.com', { o: 'Não' }); const orig = A.ctx.registrar_;
  A.ctx.registrar_ = () => { throw new Error('log fora do ar'); };
  let r; try { r = A.call('salvarRegraLider', Object.assign({}, base, { outros: true })); } finally { A.ctx.registrar_ = orig; }
  eq(r.ok, false); eq(A.sheets.Cad_Regras_Lider.d.filter(x => x[0] === 'carlosa@x.com').map(x => x[2]), ['Não']);
});
T('edição: Site Leader de um Hub não vê nem edita líder de outro Hub', () => {
  const B = cenario(); B.as('owner@x.com');
  B.ctx.anexar_('Cad_Hubs', ['H1', 'Hub Um', 'Operação A', 'Sim']); B.ctx.anexar_('Cad_Hubs', ['H2', 'Hub Dois', 'Operação B', 'Sim']); B.call('ativarHubs');
  B.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar'], telas: ['form'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
  B.ctx.anexar_('Cad_Usuarios', ['lh2@x.com', 'Lider H2', 'LiderAud', 'Sim', 'H2']); B.ctx.anexar_('Cad_Usuarios', ['lh1@x.com', 'Lider H1', 'LiderAud', 'Sim', 'H1']); B.ctx.anexar_('Cad_Usuarios', ['sl2@x.com', 'Sandra Dois', 'Site Leader', 'Sim', 'H2']); B.run('limparCache_()');
  B.as('sl2@x.com'); const l = B.call('listarRegrasLider'); ok(l.lideres.some(x => x.email === 'lh2@x.com') && !l.lideres.some(x => x.email === 'lh1@x.com'), JSON.stringify(l.lideres.map(x => x.email)));
  eq(B.call('salvarRegraLider', Object.assign({}, base, { email: 'lh1@x.com' })).ok, false, 'líder do outro Hub'); eq(B.call('salvarRegraLider', Object.assign({}, base, { email: 'lh2@x.com' })).ok, true);
});
T('migração v9: cria a aba, dá a permissão ao Site Leader e pode rodar de novo; só o dono ou Admin roda', () => {
  A.as('owner@x.com'); const r = A.call('migrarV9'); eq(r.ok, true); const r2 = A.call('migrarV9'); eq(r2.perfilSiteLeaderAtualizado, false, 'idempotente');
  A.as('carlosa@x.com'); let m = ''; try { A.call('migrarV9'); } catch (x) { m = String(x.message || x); } ok(m, 'líder não roda a migração');
  A.as('sl@x.com'); ok(A.call('bootstrap').user.perms.includes('regras_lider'));
  A.as('ana@x.com'); ok(!A.call('bootstrap').user.perms.includes('regras_lider'), 'Analista não recebe a permissão');
});
T('revisão: doca sem colaborador respeita "não audita ninguém"; colaborador sem líder e doca de cor não padronizada nunca passam', () => {
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Pessoas', ['Orfao Sem Lider', 'Colaborador', 'T1', 'Sim', '']); A.ctx.anexar_('Cad_Estrutura', ['Doca', '99', 'cor invalida', 'Carlos Lider', 'T1']); A.run('limparCache_()');
  regra('carlosa@x.com', { p: 'Não', o: 'Não' }); eq(A.audit('carlosa@x.com', 'Recebimento', { conf: 10, f: { doca: '01', lider: 'Carlos Lider', turno: 'T1' } }).ok, false);
  regra('carlosa@x.com', { o: 'Sim' }); eq(exp('carlosa@x.com', ['Orfao Sem Lider'], { lider: 'Dora Lider' }).ok, false, 'colaborador sem líder');
  regra('carlosa@x.com', { c: 'Verde/Bolinha' }); eq(A.audit('carlosa@x.com', 'Recebimento', { conf: 10, f: { doca: '99', lider: 'Carlos Lider', turno: 'T1' } }).ok, false, 'cor não padronizada com regra de cor');
});
T('revisão: quem tem a permissão mas vê só parte dos dados não define regras', () => {
  A.as('sltime@x.com'); let m = ''; try { A.call('listarRegrasLider'); } catch (x) { m = String(x.message || x); } ok(/só parte dos dados/.test(m), m);
});
T('revisão: renomear o líder atualiza as listas de Times das regras; só quem gere usuários/perfis recebe o log de permissões', () => {
  A.as('owner@x.com'); regra('carlosa@x.com', { o: 'Sim', t: 'Dora Lider' }); const dora = A.call('lerDireto_', 'Cad_Pessoas').find(p => p.Nome === 'Dora Lider');
  eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, dora, { Nome: 'Dora Nova' }), dora).ok, true);
  eq(A.sheets.Cad_Regras_Lider.d.filter(x => x[0] === 'carlosa@x.com')[0][3], 'Dora Nova');
  const d2 = A.call('lerDireto_', 'Cad_Pessoas').find(p => p.Nome === 'Dora Nova'); eq(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, d2, { Nome: 'Dora Lider' }), d2).ok, true);
});
T('revisão: se o log falhar ao voltar ao padrão, a regra é devolvida', () => {
  A.as('sl@x.com'); regra('carlosa@x.com', { o: 'Sim', t: 'Dora Lider' }); const orig = A.ctx.registrar_; A.ctx.registrar_ = () => { throw new Error('log fora'); };
  let r; try { r = A.call('excluirRegraLider', 'carlosa@x.com'); } finally { A.ctx.registrar_ = orig; }
  eq(r.ok, false); eq(A.sheets.Cad_Regras_Lider.d.filter(x => x[0] === 'carlosa@x.com').length, 1); eq(A.call('regraDe_', 'carlosa@x.com', true).outros, true);
});
fim();
