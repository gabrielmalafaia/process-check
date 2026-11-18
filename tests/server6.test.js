const { T, eq, ok, fim } = require('./lib.js');
const { novo } = require('./seed.js');
const A = novo();
const PROC = A.run('PROCESSOS'), TIPO = A.run('TIPO_PROC');
A.as('owner@x.com');
A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar', 'ver_nomes', 'exportar'], telas: ['matriz', 'form', 'auditorias', 'colab', 'geral', 'proc', 'doca', 'tend', 'export'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
A.ctx.anexar_('Cad_Usuarios', ['carlos@x.com', 'Carlos Lider', 'LiderAud', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['dora@x.com', 'Dora Lider', 'LiderAud', 'Sim']); A.run('limparCache_()');
const R = (t, f, ex) => A.call('relatorio', t, f || A.F(), ex);
const unidade = (p, lider) => TIPO[p] === 'Doca' ? (lider === 'Carlos' ? '36' : '07') : TIPO[p] === 'Cluster' ? (lider === 'Carlos' ? 'B-20' : 'A-10') : '';
const ids = { aud: {}, carlos: {}, dora: {} };

T('cada processo aceita auditoria de auditor, de líder (Carlos) e de líder (Dora)', () => {
  PROC.forEach(p => {
    let r = A.audit('aud1@x.com', p, { conf: 8, nc: 2, f: Object.assign({ colaboradores: ['Ana Souza'], doca: unidade(p, 'Carlos') }, TIPO[p] ? {} : {}) });
    eq(r.ok, true, p + ' auditor: ' + JSON.stringify(r)); ids.aud[p] = r.id;
    r = A.audit('carlos@x.com', p, { conf: 9, nc: 1, f: { colaboradores: ['Bruno Lima'], doca: unidade(p, 'Dora') } });
    eq(r.ok, true, p + ' Carlos: ' + JSON.stringify(r)); ids.carlos[p] = r.id;
    r = A.audit('dora@x.com', p, { conf: 7, nc: 3, f: { colaboradores: ['Carla Dias'], doca: unidade(p, 'Dora') } });
    eq(r.ok, true, p + ' Dora: ' + JSON.stringify(r)); ids.dora[p] = r.id;
  });
  A.run('limparCache_()');
});
const todos = () => [].concat(Object.values(ids.aud), Object.values(ids.carlos), Object.values(ids.dora));

['owner@x.com', 'sl@x.com', 'ana@x.com'].forEach(u => {
  T('relatórios de ' + u + ': todas as ' + 18 + ' auditorias de todos os processos', () => {
    A.as(u);
    const au = R('auditorias'); eq(au.total, 18); const lid = au.linhas.map(l => l.id);
    todos().forEach(id => ok(lid.indexOf(id) > -1, 'falta em Auditorias ' + id));
    eq(R('export').total, 18);
    const g = R('geral'); eq(g.A.total, 18); PROC.forEach(p => eq(g.A.pp[p].n, 3, 'geral ' + p));
    const pr = R('proc'); eq(JSON.stringify(pr).length > 10, true);
    PROC.forEach(p => { const d = R('auditorias', A.F({ processo: p })); eq(d.total, 3, 'filtro ' + p); });
    ok(R('tend') && R('doca'), 'tend/doca respondem');
  });
});
T('perfil Auditor (só auditar) não tem telas de relatório: acesso negado, e as auditorias dele existem para quem tem acesso', () => {
  A.as('aud1@x.com'); let msg = ''; try { R('auditorias'); } catch (e) { msg = e.message; } ok(/não tem acesso/.test(msg), msg);
  A.as('sl@x.com'); eq(R('auditorias', A.F({ auditor: 'aud1@x.com' })).total, 6);
});
T('Carlos (líder, perfil time): vê as dele, as do time dele e as que ele fez; nada da Dora', () => {
  A.as('carlos@x.com'); const au = R('auditorias'); const lid = au.linhas.map(l => l.id);
  console.log('   Carlos vê', au.total, 'de 18');
  PROC.forEach(p => {
    ok(lid.indexOf(ids.carlos[p]) > -1, 'auditoria feita pelo Carlos some em ' + p + ' (' + ids.carlos[p] + ')');
    ok(lid.indexOf(ids.aud[p]) > -1, 'auditoria do time dele (Ana) some em ' + p);
    ok(lid.indexOf(ids.dora[p]) < 0, 'auditoria da Dora aparece para o Carlos em ' + p);
  });
  eq(R('export').total, au.total); eq(R('geral').A.total, au.total);
});
T('Dora (líder): idem, espelhado', () => {
  A.as('dora@x.com'); const au = R('auditorias'); const lid = au.linhas.map(l => l.id);
  console.log('   Dora vê', au.total, 'de 18');
  PROC.forEach(p => { ok(lid.indexOf(ids.dora[p]) > -1, 'feita pela Dora some em ' + p); ok(lid.indexOf(ids.aud[p]) < 0); });
});
fim();
