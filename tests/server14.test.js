// v10: isolamento por Hub das metas por líder (e, depois, dos feedbacks).
const { T, eq, ok, nega, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const novoUsuario = (A, email, nome, perfil, hub) => { A.as('owner@x.com'); A.ctx.anexar_('Cad_Usuarios', [email, nome, perfil, 'Sim', hub || '']); A.run('limparCache_()'); };
function doisHubs() {
  const A = cenario(); A.as('owner@x.com');
  A.ctx.anexar_('Cad_Hubs', ['H1', 'Hub Um', 'Operação A', 'Sim']); A.ctx.anexar_('Cad_Hubs', ['H2', 'Hub Dois', 'Operação B', 'Sim']);
  A.call('ativarHubs'); A.call('migrarV10');
  novoUsuario(A, 'sl2@x.com', 'Sandra Dois', 'Site Leader', 'H2'); novoUsuario(A, 'aud3@x.com', 'Audi Tres', 'Auditor', 'H2');
  return A;
}
const meta = (o) => Object.assign({ qtd: 2, ini: '', fim: '', desc: '', times: [], turnos: [], cores: [], processos: [] }, o);
const base = (A, o) => meta(Object.assign({ ini: A.hojeStr, fim: A.dia(5) }, o));
T('Admin global só programa para usuários do Hub ativo; o usuário de outro Hub não aparece na lista', () => {
  const A = doisHubs(); A.as('owner@x.com');
  const r = A.call('salvarMetaLider', base(A, { email: 'aud3@x.com' })); eq(r.ok, false);
  ok(!A.call('listarMetasLider').responsaveis.some((u) => u.email === 'aud3@x.com'));
  eq(A.call('salvarMetaLider', base(A, { email: 'aud1@x.com' })).ok, true);
});
T('Site Leader de um Hub não programa, vê nem cancela meta do outro Hub; o usuário vê só a sua', () => {
  const A = doisHubs(); A.as('sl2@x.com');
  const r = A.call('salvarMetaLider', base(A, { email: 'aud3@x.com' })); eq(r.ok, true, JSON.stringify(r));
  eq(A.call('salvarMetaLider', base(A, { email: 'aud1@x.com' })).ok, false, 'aud1 é do Hub 1');
  A.as('sl@x.com'); eq(A.call('listarMetasLider').metas.length, 0, 'Hub 1 não enxerga a meta do Hub 2');
  nega(() => { const id = (A.as('sl2@x.com'), A.call('listarMetasLider').metas[0].id); A.as('sl@x.com'); const x = A.call('cancelarMetaLider', id); if (x.ok === false) throw new Error('recusado: ' + x.msg); }, 'recusado');
  A.as('aud3@x.com'); eq(A.call('bootstrap').metasNovas, 1); eq(A.call('minhasMetasLider').length, 1);
  A.as('aud1@x.com'); eq(A.call('bootstrap').metasNovas, 0);
});
T('o passo das 22h reenvia o aviso de cada Hub sem Hub ativo no contexto (leitura bruta) e só para o Hub da linha', () => {
  const A = doisHubs(); A.as('sl2@x.com'); A.emails.length = 0; A.mailFalha = true;
  A.call('salvarMetaLider', base(A, { email: 'aud3@x.com' })); A.mailFalha = false; eq(A.emails.length, 0);
  A.run('HUB_CTX = null;'); eq(A.run('reenviarAvisosMetas_()'), 1); eq(A.emails.map((m) => m.to), ['aud3@x.com']);
});
const baixa = (A, aud, colab) => A.audit(aud, 'Expedição', { conf: 5, f: { doca: '07', colaboradores: [colab] } });
T('feedback: Site Leader de um Hub não vê, designa nem registra pendência do outro Hub; Admin global usa só o Hub ativo', () => {
  const A = doisHubs(); A.as('owner@x.com');
  for (let i = 0; i < 3; i++) baixa(A, 'aud1@x.com', 'Davi Reis');
  A.as('sl@x.com'); const l = A.call('listarFeedbacks'); eq(l.pendencias.length, 1); const id = l.pendencias[0].id;
  A.as('sl2@x.com'); eq(A.call('listarFeedbacks').pendencias.length, 0, 'Hub 2 não enxerga');
  eq(A.call('designarFeedback', id, 'aud3@x.com').ok, false);
  A.as('sl@x.com'); eq(A.call('designarFeedback', id, 'aud3@x.com').ok, false, 'designado de outro Hub');
  eq(A.call('designarFeedback', id, 'aud2@x.com').ok, true);
  A.as('aud3@x.com'); eq(A.call('meusFeedbacks'), []); eq(A.call('registrarFeedback', id, 'Conversei com o colaborador sobre as reprovações e combinamos revisar a conferência de cada doca.').ok, false);
  A.as('aud2@x.com'); eq(A.call('meusFeedbacks').length, 1);
});
T('feedback: o passo das 22h gera por Hub sem contexto e a pendência fica só no Hub de origem', () => {
  const A = doisHubs(); A.as('owner@x.com');
  for (let i = 0; i < 3; i++) baixa(A, 'aud1@x.com', 'Carla Dias');
  A.run('HUB_CTX = null;'); eq(A.run('gerarFeedbackTodosHubs_()'), 1); eq(A.run('HUB_CTX'), null);
  A.as('sl2@x.com'); eq(A.call('listarFeedbacks').pendencias.length, 0);
  A.as('sl@x.com'); eq(A.call('listarFeedbacks').pendencias.length, 1);
  const h = A.sheets.Feedback_Pendencias.d[1]; eq(h[19], 'H1');
});
fim('v10 Hub (isolamento)');
