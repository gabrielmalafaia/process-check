// v10 fase 1: Pessoas_Historico (só acréscimo). Nada de time/turno é sobrescrito sem deixar rastro.
const { T, eq, ok, nega, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
A.as('owner@x.com');
const hist = () => A.sheets.Pessoas_Historico.d.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined)).map((r) => ({ nome: r[1], ev: r[2], la: r[3], ld: r[4], ta: r[5], td: r[6], por: r[7] }));
const pessoa = (n) => A.call('listarCadastro', 'Cad_Pessoas').find((p) => p.Nome === n);
const salvar = (orig, mud) => A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, orig, mud), orig);

T('migrarV10 cria a aba e registra o estado inicial de cada pessoa uma única vez (idempotente)', () => {
  const r = A.call('migrarV10'); eq(r.ok, true);
  const n = hist().filter((h) => h.ev === 'Estado inicial').length;
  eq(n, A.call('listarCadastro', 'Cad_Pessoas').length);
  const r2 = A.call('migrarV10'); eq(r2.estadoInicial, 0); eq(hist().length, n);
});
T('mudar o líder e o turno de um colaborador grava antes e depois; o cadastro muda e o histórico guarda o passado', () => {
  const o = pessoa('Ana Souza'), n0 = hist().length;
  const r = salvar(o, { Lider: 'Dora Lider', Turno: 'T2' }); eq(r.ok, true, JSON.stringify(r));
  const h = hist().slice(n0); eq(h.length, 1);
  eq([h[0].nome, h[0].ev, h[0].la, h[0].ld, h[0].ta, h[0].td], ['Ana Souza', 'Alterado', 'Carlos Lider', 'Dora Lider', 'T1', 'T2']);
  ok(/owner@x.com/.test(h[0].por), 'registra quem alterou');
  eq(pessoa('Ana Souza').Lider, 'Dora Lider');
});
T('alterar só o status (sem mudar nome, líder ou turno) não gera linha', () => {
  const o = pessoa('Bruno Lima'), n0 = hist().length;
  eq(salvar(o, { Status_Ativo: 'Não' }).ok, true); eq(hist().length, n0);
  salvar(pessoa('Bruno Lima'), { Status_Ativo: 'Sim' });
});
T('criar colaborador novo grava "Criado"', () => {
  const n0 = hist().length;
  eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Gil Novo', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }, null).ok, true);
  const h = hist().slice(n0); eq(h.length, 1); eq([h[0].ev, h[0].la, h[0].ld, h[0].td], ['Criado', '', 'Carlos Lider', 'T1']);
});
T('excluir e desfazer a exclusão ficam no histórico', () => {
  const o = pessoa('Gil Novo'), n0 = hist().length;
  eq(A.call('excluirCadastro', 'Cad_Pessoas', o._row, o).ok, true);
  eq(A.call('restaurarCadastro', 'Cad_Pessoas', o, o._row).ok, true);
  eq(hist().slice(n0).map((h) => h.ev), ['Excluído', 'Restaurado']);
});
T('renomear um líder registra a mudança do líder e uma linha "Líder renomeado" para cada colaborador dele', () => {
  const o = pessoa('Dora Lider'), n0 = hist().length;
  const filhos = A.call('listarCadastro', 'Cad_Pessoas').filter((p) => p.Lider === 'Dora Lider').length;
  ok(filhos >= 2);
  const r = salvar(o, { Nome: 'Dora Lima' }); eq(r.ok, true, JSON.stringify(r));
  const h = hist().slice(n0);
  eq(h.filter((x) => x.ev === 'Alterado').length, 1);
  eq(h.filter((x) => x.ev === 'Líder renomeado').length, filhos);
  ok(h.filter((x) => x.ev === 'Líder renomeado').every((x) => x.la === 'Dora Lider' && x.ld === 'Dora Lima'));
  salvar(pessoa('Dora Lima'), { Nome: 'Dora Lider' }); // volta ao nome original para os demais testes
});
T('renomear um colaborador deixa uma linha sob o nome antigo apontando para o novo (o passado não fica órfão)', () => {
  const o = pessoa('Eva Nunes'), n0 = hist().length;
  eq(salvar(o, { Nome: 'Eva Nunes Silva' }).ok, true);
  const h = hist().slice(n0);
  ok(h.some((x) => x.nome === 'Eva Nunes Silva' && x.ev === 'Alterado'));
  ok(h.some((x) => x.nome === 'Eva Nunes' && x.ev === 'Renomeado para Eva Nunes Silva'));
  salvar(pessoa('Eva Nunes Silva'), { Nome: 'Eva Nunes' });
});
T('falha DEPOIS do histórico (salvar, excluir): fica a marca Revertido e o cadastro não muda', () => {
  A.run('var __s = SpreadsheetApp.getActive().getSheetByName("Cad_Pessoas"), __g = __s.getRange, __d = __s.deleteRow, __h = histCadastro_, __falha = false;'
    + '__s.getRange = function () { if (__falha) throw new Error("planilha protegida"); return __g.apply(__s, arguments); };'
    + '__s.deleteRow = function () { throw new Error("planilha protegida"); };'
    + 'histCadastro_ = function () { var r = __h.apply(null, arguments); __falha = true; return r; };');
  const o = pessoa('Davi Reis');
  let n0 = hist().length;
  // desde a v10.2 o usuário vê a mensagem padrão do desfazer; o erro técnico vai para o log de atividade
  nega(() => salvar(o, { Turno: 'T1' }), 'nada foi alterado');
  A.run('__falha = false;');
  eq(hist().slice(n0).map((x) => x.ev.split(':')[0]), ['Alterado', 'Revertido']); eq(pessoa('Davi Reis').Turno, 'T2');
  n0 = hist().length;
  nega(() => A.call('excluirCadastro', 'Cad_Pessoas', o._row, o), 'planilha protegida');
  A.run('__falha = false;');
  eq(hist().slice(n0).map((x) => x.ev.split(':')[0]), ['Excluído', 'Revertido']); ok(pessoa('Davi Reis'));
  A.run('__s.getRange = __g; __s.deleteRow = __d; histCadastro_ = __h;');
});
T('carga em massa grava "Importado" para cada pessoa e nada se grava se a carga tem erro', () => {
  const n0 = hist().length;
  const bom = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nHugo Carga\tColaborador\tT1\tSim\tCarlos Lider\nIris Carga\tColaborador\tT2\tSim\tDora Lider';
  eq(A.call('importarConfirmar', 'pessoas', bom).ok, true);
  eq(hist().slice(n0).map((h) => h.ev + ':' + h.nome), ['Importado:Hugo Carga', 'Importado:Iris Carga']);
  const n1 = hist().length, ruim = 'Nome\tCargo\tTurno\tStatus_Ativo\tLider\nJoao Ok\tColaborador\tT1\tSim\tCarlos Lider\nZe Mau\tColaborador\tT9\tSim\tCarlos Lider';
  eq(A.call('importarConfirmar', 'pessoas', ruim).ok, false); eq(hist().length, n1);
});
T('se o histórico falhar, o cadastro NÃO muda (histórico vem antes e na mesma trava)', () => {
  const o = pessoa('Carla Dias');
  A.run('var __anexOrig = anexarLinhas_; anexarLinhas_ = function (aba, l) { if (aba === "Pessoas_Historico") throw new Error("falha simulada"); return __anexOrig(aba, l); };');
  nega(() => salvar(o, { Turno: 'T1' }), 'falha simulada');
  A.run('anexarLinhas_ = __anexOrig;');
  eq(pessoa('Carla Dias').Turno, 'T2');
});
T('líder com permissão de cadastro continua travado e a negação não grava histórico', () => {
  A.call('salvarPerfil', { nome: 'LiderCad', desc: 't', perms: ['cad_pessoas'], telas: ['cad'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['carlosc@x.com', 'Carlos Lider', 'LiderCad', 'Sim']); A.run('limparCache_()');
  A.as('carlosc@x.com');
  const o = A.call('listarCadastro', 'Cad_Pessoas').find((p) => p.Nome === 'Eva Nunes'), n0 = hist().length;
  const r = A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, o, { Lider: 'Dora Lider' }), o);
  eq(r.ok, false); eq(hist().length, n0);
  A.as('owner@x.com');
});
T('não existe função pública para alterar ou apagar o histórico', () => {
  const pub = A.run('Object.keys(this).filter(function(k){ return typeof this[k] === "function" && /^[a-z]/.test(k) && k.slice(-1) !== "_"; }.bind(this))');
  ok(!pub.some((k) => /hist/i.test(k)), 'nenhuma função pública de histórico: ' + pub.filter((k) => /hist/i.test(k)));
});
T('aba protegida como texto: nomes e datas não viram número ou data', () => {
  ok(hist().every((h) => typeof h.nome === 'string' && typeof h.ev === 'string'));
});
fim('v10 fase 1 (histórico de time e turno)');
