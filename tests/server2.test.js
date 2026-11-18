const { T, eq, ok, nega, fim } = require('./lib.js');
const { novo, cenario } = require('./seed.js');

const A = cenario();
const rel = (tipo, f, ex) => A.call('relatorio', tipo, A.F(f), ex || {});

/* ===================== C. RELATÓRIOS ===================== */
A.as('ana@x.com');
T('Visão Geral: totais, média, Em observação e comparação', () => {
  const g = rel('geral'); const a = g.A;
  eq([a.total, a.media, a.conf, a.obs, a.bad], [6, 75, 2, 2, 2]);
  eq(g.B.total, 0);
  eq(a.pp['Recebimento'], { n: 2, media: 75, v: 1, o: 0, r: 1 }); eq(a.pp['Expedição'].o, 1);
  eq([a.tu.T1.n, a.tu.T1.o, a.tu.T1.r, a.tu.T2.n, a.tu.T2.r], [3, 2, 0, 3, 2]);
  ok(a.of.length > 0 && a.of[0][1] >= 1, 'ofensores via Itens_NC');
});
T('Visão Geral: insights tipados (observação destacada) e ordenados', () => {
  const g = rel('geral'), tipos = g.ins.map(i => i.t);
  ok(tipos.indexOf('bad') > -1 && tipos.indexOf('obs') > -1);
  ok(g.ins.some(i => i.t === 'obs' && /Turno T1 concentra/.test(i.txt)), 'turno com mais observação');
  ok(g.ins.some(i => i.t === 'bad' && /Turno T2/.test(i.txt)));
  const ord = { bad: 0, obs: 1, info: 2, ok: 3 }; for (let i = 1; i < g.ins.length; i++) ok(ord[g.ins[i - 1].t] <= ord[g.ins[i].t]);
  ok(g.ins.some(i => i.t === 'info' && /sem auditoria/.test(i.txt)));
});
T('Visão Geral: período anterior de mesmo tamanho e insight de alta de observação', () => {
  const g = A.call('relatorio', 'geral', { de: A.dia(-3), ate: A.hojeStr }, {});   // 4 dias; anterior = -7..-4
  eq(g.A.total, 6); eq(g.B.total, 0);
  const g2 = A.call('relatorio', 'geral', { de: A.dia(-1), ate: A.hojeStr }, {}); eq(g2.A.total, 2); eq(g2.B.total, 4);
});
T('filtros: processo, turno, líder, colaborador, auditor, faixa, doca', () => {
  eq(rel('geral', { processo: 'Expedição' }).A.total, 2);
  eq(rel('geral', { turno: 'T2' }).A.total, 3);
  eq(rel('geral', { lider: 'Carlos Lider' }).A.total, 3);
  eq(rel('geral', { colaborador: 'Bruno Lima' }).A.total, 2);
  eq(rel('geral', { auditor: 'aud1@x.com' }).A.total, 3);
  eq(rel('geral', { auditor: 'AUD2@x.com' }).A.total, 3);
  eq(rel('geral', { faixa: 'observacao' }).A.total, 2);
  eq(rel('geral', { processo: 'Recebimento', doca: '36' }).A.total, 1);
  eq(rel('geral', { processo: 'Expedição', faixa: 'verde' }).A.total, 0);
});
T('Auditorias realizadas: lista, KPIs, heatmap dia × processo, paginação', () => {
  const r = rel('auditorias');
  eq([r.total, r.paginas, r.pagina, r.linhas.length], [6, 1, 1, 6]);
  eq(r.heat.modo, 'dia'); eq(r.heat.cols.length, 31); eq(r.heat.rows.length, 6);
  eq(r.heat.rows.reduce((s, x) => s + x.v.reduce((a, b) => a + b, 0), 0), 6); ok(r.heat.max >= 1);
  ok(r.linhas[0].ts >= r.linhas[5].ts, 'mais recentes primeiro');
  eq(r.linhas.find(x => x.colab.indexOf('Carla Dias; Davi Reis') === 0).proc, 'Expedição');
  const longo = A.call('relatorio', 'auditorias', { de: A.dia(-200), ate: A.hojeStr }, {}); eq(longo.heat.modo, 'semana'); ok(longo.heat.cols.length < 40);
  eq(longo.heat.rows.reduce((s, x) => s + x.v.reduce((a, b) => a + b, 0), 0), 6);
});
T('paginação com muitas auditorias (50 por página) e página inválida', () => {
  const B = novo();
  const res57 = []; for (let i = 0; i < 57; i++) res57.push(B.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Ana Souza' } }));
  B.as('ana@x.com');
  const p1 = B.call('relatorio', 'auditorias', B.F(), { pagina: 1 }), p2 = B.call('relatorio', 'auditorias', B.F(), { pagina: 2 });
  eq([p1.total, p1.paginas, p1.linhas.length, p2.linhas.length], [57, 2, 50, 7]);
  eq(B.call('relatorio', 'auditorias', B.F(), { pagina: 99 }).pagina, 2);
  eq(B.call('relatorio', 'auditorias', B.F(), { pagina: -5 }).pagina, 1);
  eq(B.call('relatorio', 'auditorias', B.F(), { pagina: 'abc' }).pagina, 1);
  eq(new Set(p1.linhas.concat(p2.linhas).map(x => x.id)).size, 57);
});
T('itens de uma auditoria (drill-down)', () => {
  const d = A.call('relatorio', 'itensAuditoria', A.F(), { id: A.ids.a2 });
  eq([d.itens.length, d.pct, d.colab], [10, 80, 'Ana Souza; Bruno Lima']);
  eq(d.itens.filter(i => i.ok === false).length, 2);
  nega(() => A.ctx.relatorio('itensAuditoria', A.F(), { id: 'AUD-1' }), 'inválida');
  nega(() => A.ctx.relatorio('itensAuditoria', A.F(), { id: 'AUD-20200101000000-123' }), 'não encontrada');
});
T('Por colaborador: cada colaborador recebe a nota da doca; equipes e sem auditoria', () => {
  const c = rel('colab'), por = Object.fromEntries(c.colabs.map(x => [x.nome, x]));
  eq([por['Ana Souza'].n, por['Ana Souza'].media, por['Bruno Lima'].n, por['Bruno Lima'].media, por['Carla Dias'].media, por['Davi Reis'].n], [2, 90, 2, 75, 55, 1]);
  eq(c.semAuditoria.map(x => x.nome), ['Eva Nunes']);
  const t = Object.fromEntries(c.times.map(x => [x.lider, x]));
  eq([t['Carlos Lider'].n, t['Carlos Lider'].media, t['Dora Lider'].n, t['Dora Lider'].media], [3, 83.3, 3, 66.7]);
  const f = rel('colab', { colaborador: 'Ana Souza' }); eq(f.colabs.map(x => x.nome), ['Ana Souza']);
  const g = rel('colab', { lider: 'Dora Lider' }); eq(g.times.map(x => x.lider), ['Dora Lider']); ok(g.colabs.every(x => x.lider === 'Dora Lider'));
});
T('Por doca e cluster: todas as unidades, inclusive sem auditoria, com tendência', () => {
  const d = rel('doca'), k = Object.fromEntries(d.linhas.map(x => [x.proc + '|' + x.id, x]));
  eq(d.linhas.length, 12);
  eq([k['Recebimento|36'].n, k['Recebimento|36'].media, k['Recebimento|36'].faixa], [1, 100, 'verde']);
  eq([k['Recebimento|01'].media, k['Recebimento|01'].faixa], [50, 'vermelho']);
  eq([k['Expedição|01'].media, k['Expedição|01'].faixa, k['Expedição|07'].faixa], [80, 'observacao', 'vermelho']);
  eq([k['Compra|A-10'].n, k['Compra|A-10'].faixa], [0, '']);
  ok(!d.linhas.some(x => x.proc === 'Indução'));
});
T('detalhe: doca, colaborador e equipe', () => {
  const d = rel('detalhe', {}, { kind: 'doca', chave: 'Expedição|01' }); eq([d.kpis.n, d.kpis.media, d.titulo], [1, 80, '01']); eq(d.hist.length, 1);
  const c = rel('detalhe', {}, { kind: 'colab', chave: 'Ana Souza' }); eq([c.kpis.n, c.kpis.media, c.melhor, c.pior], [2, 90, 100, 80]); eq(c.porProc.length, 2);
  eq(c.serie.filter(x => x !== null).length, 2); eq(c.cols.length, 31);
  const l = rel('detalhe', {}, { kind: 'lider', chave: 'Carlos Lider' }); eq(l.kpis.n, 3);
  nega(() => A.ctx.relatorio('detalhe', A.F(), { kind: 'doca', chave: 'Inexistente' }), 'inválida');
  nega(() => A.ctx.relatorio('detalhe', A.F(), { kind: 'doca', chave: 'Indução|x' }), 'inválida');
  nega(() => A.ctx.relatorio('detalhe', A.F(), { kind: 'xyz', chave: 'a' }), 'inválido');
});
T('Auditores: ranking, ritmo, quem ainda não auditou', () => {
  const r = rel('auditores'), por = Object.fromEntries(r.linhas.map(x => [x.email, x]));
  eq([por['aud1@x.com'].n, por['aud1@x.com'].media, por['aud2@x.com'].n, por['aud2@x.com'].media], [3, 83.3, 3, 66.7]);
  eq(r.linhas[0].nome, 'Audi Dois', 'empate de quantidade: ordem alfabética'); eq(r.linhas[0].rank, 1);
  ok(por['ana@x.com'].n === 0 && por['sl@x.com'].n === 0);
  ok(!por['off@x.com'], 'inativo fora'); ok(por['aud1@x.com'].porSemana > 0 && por['aud1@x.com'].diasAtivos === 3);
  eq(r.serie.v.reduce((a, b) => a + b, 0), 6);
});
T('Por processo e Tendência', () => {
  const p = rel('proc'), k = Object.fromEntries(p.linhas.map(x => [x.proc, x]));
  eq([k['Recebimento'].n, k['Expedição'].media, k['Separação'].media, k['Sorting'].n], [2, 70, 90, 0]);
  eq(k['Recebimento'].tu.T1.n, 1); ok(k['Expedição'].of.length > 0); eq(p.cols.length, 31);
  const t = rel('tend'); eq(t.serie.reduce((s, x) => s + x.n, 0), 6); eq(t.serie[t.serie.length - 1].m, 100); eq(t.total, 6);
  ok(t.delta !== null); eq(Object.keys(t.porProc).length, 6);
});
T('Exportar: lote, colunas e total', () => {
  const e = rel('export'); eq([e.total, e.linhas.length, e.fim, e.linhas[0].length], [6, 6, true, 11]);
  eq(rel('export', {}, { offset: 4 }).linhas.length, 2); eq(rel('export', {}, { offset: 99 }).linhas.length, 0);
  ok(e.linhas.every(l => typeof l[8] === 'number'));
});
T('cache: resultado muda após nova auditoria; "Atualizar" limpa', () => {
  const antes = rel('geral').A.total;
  const B = A.audit('aud1@x.com', 'Sorting', { conf: 10, f: { doca: 'B-20', lider: 'Carlos Lider', turno: 'T1' } }); eq(B.ok, true);
  A.as('ana@x.com'); eq(rel('geral').A.total, antes + 1);
});
T('entradas inválidas nos relatórios', () => {
  const bad = (f, msg) => nega(() => A.ctx.relatorio('geral', f, {}), msg);
  bad({ de: '2026-02-30', ate: '2026-03-01' }, 'Período inválido'); bad({ de: '2026-1-1', ate: '2026-03-01' }, 'Informe as datas');
  bad({ de: A.dia(-500), ate: A.hojeStr }, 'Período máximo'); bad({ de: A.dia(-2), ate: A.dia(-5) }, 'Período inválido'); bad(null, 'Informe as datas'); bad({}, 'Informe as datas');
  bad(A.F({ processo: 'Foo' }), 'Processo inválido'); bad(A.F({ turno: 'T9' }), 'Turno inválido'); bad(A.F({ faixa: 'x' }), 'Faixa inválida');
  ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, 5].forEach(t => nega(() => A.ctx.relatorio(t, A.F(), {}), 'inválido'));
  eq(A.call('relatorio', 'geral', A.F({ doca: "'; DROP", colaborador: '<script>', lider: 'x'.repeat(500) }), null).A.total, 0);
});

/* ===================== D. METAS ===================== */
T('statusMeta_: futura, no ritmo, em risco, atingida, não atingida', () => {
  const s = (f, q, i, e, h) => A.run(`statusMeta_(${f},${q},'${i}','${e}','${h}')`);
  eq(s(0, 10, '2026-06-10', '2026-06-20', '2026-06-01'), 'futura'); eq(s(10, 10, '2026-06-10', '2026-06-20', '2026-06-01'), 'atingida');
  eq(s(5, 10, '2026-06-10', '2026-06-20', '2026-06-15'), 'no_ritmo'); eq(s(1, 10, '2026-06-10', '2026-06-20', '2026-06-15'), 'em_risco');
  eq(s(5, 10, '2026-06-10', '2026-06-20', '2026-06-21'), 'nao_atingida'); eq(s(0, 10, '2026-06-10', '2026-06-20', '2026-06-20'), 'em_risco');
});
let metaId;
T('criar meta para pessoa e para perfil; progresso só com auditorias FINALIZADAS', () => {
  A.as('ana@x.com');
  const r1 = A.call('salvarMeta', { tipo: 'Pessoa', alvo: 'AUD1@x.com', qtd: 5, processos: [], ini: A.dia(-9), fim: A.dia(5), desc: 'Meta de teste' });
  eq(r1.ok, true, JSON.stringify(r1));
  const m1 = r1.metas.find(m => m.tipo === 'Pessoa'); metaId = m1.id;
  eq([m1.alvos.length, m1.alvos[0].feito, m1.alvos[0].status, m1.alvos[0].nome], [1, 4, 'no_ritmo', 'Audi Um']);
  const r2 = A.call('salvarMeta', { tipo: 'Perfil', alvo: 'Auditor', qtd: 4, processos: ['Expedição'], ini: A.dia(-9), fim: A.dia(5) });
  const m2 = r2.metas.find(m => m.tipo === 'Perfil'); eq(m2.alvos.map(x => [x.nome, x.feito, x.status]), [['Audi Um', 1, 'em_risco'], ['Audi Dois', 1, 'em_risco']]);
  A.as('aud1@x.com'); A.call('salvarRascunho', { processo: 'Recebimento', chave: '36', estado: { resp: {} } });
  A.as('ana@x.com'); eq(A.call('salvarMeta', { tipo: 'Pessoa', alvo: 'aud2@x.com', qtd: 3, processos: [], ini: A.dia(-9), fim: A.dia(5) }).metas.find(m => m.tipo === 'Pessoa' && m.alvo === 'aud2@x.com').alvos[0].status, 'atingida');
  const lm = rel('auditores').metas; eq(lm.find(m => m.id === metaId).alvos[0].feito, 4, 'rascunho não conta');
});
T('meta: validações', () => {
  const v = (o) => A.call('salvarMeta', Object.assign({ tipo: 'Pessoa', alvo: 'aud1@x.com', qtd: 5, processos: [], ini: A.dia(-1), fim: A.dia(5) }, o)).erros || {};
  eq(v({ qtd: 0 }).qtd, 'Informe um número inteiro entre 1 e 9999.'); eq(v({ qtd: 2.5 }).qtd, 'Informe um número inteiro entre 1 e 9999.'); eq(v({ qtd: '' }).qtd, 'Informe um número inteiro entre 1 e 9999.');
  eq(v({ ini: A.dia(3), fim: A.dia(1) }).fim, 'A data final deve ser igual ou posterior à inicial.'); eq(v({ ini: 'x' }).ini, 'Informe a data inicial.');
  eq(v({ alvo: 'ghost@x.com' }).alvo, 'Usuário ativo com permissão de auditar não encontrado.'); eq(v({ alvo: 'off@x.com' }).alvo, 'Usuário ativo com permissão de auditar não encontrado.');
  eq(v({ tipo: 'Perfil', alvo: 'Inexistente' }).alvo, 'Perfil inexistente ou sem permissão de auditar.'); eq(v({ tipo: 'X' }).tipo, 'Escolha pessoa ou perfil.');
  eq(v({ processos: ['Foo'] }).processos, 'Processo inválido.'); eq(v({ desc: 'x'.repeat(201) }).desc, 'Máximo de 200 caracteres.');
});
T('editar, desativar e excluir meta; descrição com fórmula neutralizada', () => {
  const e = A.call('salvarMeta', { id: metaId, tipo: 'Pessoa', alvo: 'aud1@x.com', qtd: 2, processos: [], ini: A.dia(-9), fim: A.dia(5), desc: '=1+1', ativa: false });
  eq(e.ok, true); const m = e.metas.find(x => x.id === metaId); eq([m.qtd, m.ativa, m.alvos[0].status, m.desc], [2, false, 'inativa', ' =1+1']);
  eq(A.call('salvarMeta', { id: 'MET-0', tipo: 'Pessoa', alvo: 'aud1@x.com', qtd: 2, processos: [], ini: A.dia(-9), fim: A.dia(5) }).ok, false);
  eq(A.call('excluirMeta', metaId).ok, true); eq(A.call('excluirMeta', metaId).ok, false);
});
T('Minhas metas: auditor vê só as suas, com progresso', () => {
  A.as('aud1@x.com'); const m = A.call('minhasMetas');
  eq(m.length, 1, 'perfil Auditor com Expedição'); eq([m[0].tipo, m[0].feito], ['Perfil', 1]);
  A.as('ana@x.com'); A.call('salvarMeta', { tipo: 'Pessoa', alvo: 'aud1@x.com', qtd: 3, processos: [], ini: A.dia(-9), fim: A.dia(5) });
  A.as('aud1@x.com'); eq(A.call('minhasMetas').map(x => x.feito).sort(), [1, 4]);
  A.as('aud2@x.com'); eq(A.call('minhasMetas').length, 2, 'meta de perfil + meta pessoal');
});

/* ===================== E. LINHAS ANTIGAS (v5: 12 colunas, sem e-mail, sem aba auxiliar) ===================== */
T('histórico legado é lido, filtrado, e conta por nome do auditor', () => {
  const B = novo(); const h = B.hist();
  // simula planilha v5: remove as 2 colunas novas e grava uma linha como a v5 gravava
  h.d.forEach(r => { r.length = 12; }); h.maxC = 12;
  const hoje = B.hojeStr + ' 09:00:00';
  h.appendRow(['AUD-OLD-1', hoje, 'Recebimento', '36', 'Ana Souza', 'Carlos Lider', 'T1', 'Audi Um', 60, 'Em Inconformidade', '', JSON.stringify([{ id: 'Sub1', ok: false }, { id: 'Sub2', ok: true }])]);
  B.as('ana@x.com');
  const g = B.call('relatorio', 'geral', B.F(), {}); eq(g.A.total, 1); eq(g.A.of[0], ['Recebimento › Sub1', 1], 'ofensor via JSON antigo');
  eq(B.call('relatorio', 'colab', B.F(), {}).colabs[0].nome, 'Ana Souza');
  eq(B.call('relatorio', 'geral', B.F({ auditor: 'aud1@x.com' }), {}).A.total, 1, 'filtro por auditor casa pelo nome');
  eq(B.call('getMatriz', 'Recebimento').find(x => x.id === '36').nota, 60);
  const r = B.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Ana Souza' } }); eq(r.ok, true, 'grava com colunas novas numa planilha v5 (prepararHist_)');
  eq(B.hist().d[0].length >= 14, true); eq(B.call('relatorio', 'geral', B.F(), {}).A.total, 2);
});

/* ===================== F. PERFIS SIMULADOS E SEGURANÇA ===================== */
A.as('owner@x.com');
const perfil = (nome, perms, telas, escopo) => A.call('salvarPerfil', { nome, desc: 'teste', perms, telas, escopo: Object.assign({ modo: 'todos', processos: [], turnos: [] }, escopo) }, true);
T('Admin cria perfis personalizados e usuários', () => {
  eq(perfil('Gerente Expedicao', ['ver_nomes'], ['geral', 'auditorias', 'doca', 'colab', 'tend', 'proc'], { processos: ['Expedição'], turnos: ['T1'] }).ok, true);
  eq(perfil('Lider de Time', [], ['matriz', 'geral', 'colab'], { modo: 'time' }).ok, true);
  eq(perfil('Auditor Analitico', ['auditar', 'exportar'], ['matriz', 'form', 'auditorias', 'export', 'minhas'], { modo: 'proprias' }).ok, true);
  eq(perfil('Auditor Recebimento', ['auditar'], ['matriz', 'form'], { processos: ['Recebimento'] }).ok, true);
  eq(perfil('Gestor Acessos', ['usuarios', 'perfis', 'auditar'], ['matriz'], { processos: ['Recebimento'] }).ok, true);
  const us = (e, n, p) => A.call('salvarUsuario', { Email_Google: e, Nome: n, Perfil: p, Status_Ativo: 'Sim' }, null);
  [['ger@x.com', 'Gerente G', 'Gerente Expedicao'], ['lid@x.com', 'Carlos Lider', 'Lider de Time'], ['anal@x.com', 'Audi Analitico', 'Auditor Analitico'], ['audr@x.com', 'Audi Rec', 'Auditor Recebimento'], ['gest@x.com', 'Gestor G', 'Gestor Acessos'], ['sem@x.com', 'Sem Time', 'Lider de Time']]
    .forEach(x => eq(us(...x).ok, true, x[0]));
  const p = A.call('listarAcessos').perfis.find(x => x.nome === 'Gerente Expedicao'); eq(p.telas.indexOf('cad'), -1); eq(p.escopo.processos, ['Expedição']);
});
T('perfil normaliza: permissão obriga tela; tela sem permissão é descartada', () => {
  const r = perfil('Teste Norm', ['exportar', 'cad_pessoas'], ['geral', 'cfg', 'form'], {});
  eq(r.perfil.telas.sort(), ['cad', 'export', 'geral'].sort(), 'cfg e form descartadas, cad/export adicionadas');
  eq(A.call('excluirPerfil', 'Teste Norm').ok, true);
  eq(perfil('Vazio', [], [], {}).erros.telas, 'Selecione ao menos uma tela.');
});

/* --- escopo de dados: o mesmo relatório para cada perfil --- */
T('Gerente (Expedição + T1): só enxerga a Expedição do T1 em TODOS os relatórios', () => {
  A.as('ger@x.com');
  eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 1); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 1);
  eq(A.call('relatorio', 'colab', A.F(), {}).colabs.map(x => x.nome).sort(), ['Ana Souza', 'Bruno Lima']);
  const d = A.call('relatorio', 'doca', A.F(), {}); ok(d.linhas.every(x => x.proc === 'Expedição')); eq(d.linhas.find(x => x.id === '07').n, 0, 'a3 (T2) escondida');
  eq(A.call('relatorio', 'proc', A.F(), {}).linhas.map(x => x.proc), ['Expedição']);
  eq(A.call('relatorio', 'tend', A.F(), {}).total, 1); eq(A.call('relatorio', 'auditorias', A.F(), {}).heat.rows.map(r => r.proc), ['Expedição']);
  nega(() => A.ctx.relatorio('auditores', A.F(), {}), 'não tem acesso'); nega(() => A.ctx.relatorio('export', A.F(), {}), 'não tem acesso');
});
T('Gerente: filtros e IDs NÃO ampliam o escopo', () => {
  A.as('ger@x.com');
  eq(A.call('relatorio', 'auditorias', A.F({ processo: 'Recebimento' }), {}).total, 0); eq(A.call('relatorio', 'auditorias', A.F({ turno: 'T2' }), {}).total, 0);
  eq(A.call('relatorio', 'auditorias', A.F({ auditor: 'aud2@x.com' }), {}).total, 0);
  nega(() => A.ctx.relatorio('itensAuditoria', A.F(), { id: A.ids.a3 }), 'fora do seu escopo'); nega(() => A.ctx.relatorio('itensAuditoria', A.F(), { id: A.ids.a1 }), 'fora do seu escopo');
  eq(A.call('relatorio', 'itensAuditoria', A.F(), { id: A.ids.a2 }).itens.length, 10);
  nega(() => A.ctx.relatorio('detalhe', A.F(), { kind: 'doca', chave: 'Recebimento|36' }), 'Sem acesso a este processo');
  eq(A.call('relatorio', 'detalhe', A.F(), { kind: 'doca', chave: 'Expedição|07' }).kpis.n, 0);
  eq(A.call('relatorio', 'detalhe', A.F(), { kind: 'colab', chave: 'Carla Dias' }).kpis.n, 0);
  nega(() => A.ctx.getMatriz('Expedição'), 'não tem acesso');
});
T('cache não vaza dados entre perfis (mesmos filtros)', () => {
  A.as('ana@x.com'); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 7);
  A.as('ger@x.com'); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 1);
  A.as('ana@x.com'); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 7);
});
T('Líder de time: só auditorias do próprio time; nome sem time cadastrado não vê nada', () => {
  A.as('lid@x.com'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 4, 'a1,a2,a5 + Sorting do Carlos');
  eq(A.call('relatorio', 'colab', A.F(), {}).times.map(x => x.lider), ['Carlos Lider']);
  eq(A.call('getMatriz', 'Recebimento').length, 3);
  A.as('sem@x.com'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 0);
});
T('Auditor Analítico (só as próprias): vê apenas o que ele mesmo auditou, inclusive linhas antigas sem e-mail', () => {
  A.audit('anal@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Ana Souza' } });
  A.audit('anal@x.com', 'Expedição', { conf: 5, nc: 5, f: { doca: '01', colaboradores: ['Ana Souza'] } });
  A.as('anal@x.com'); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 2);
  eq(A.call('relatorio', 'auditorias', A.F({ auditor: 'aud1@x.com' }), {}).total, 0, 'trocar o filtro de auditor não mostra os dos outros');
  eq(A.call('relatorio', 'export', A.F(), {}).total, 2);
  // linha legada: sem e-mail, responsável = nome (como a v5 gravava)
  const h = A.hist(); h.appendRow(['AUD-LEG', A.hojeStr + ' 08:00:00', 'Recebimento', '36', '', 'Carlos Lider', 'T1', 'Audi Analitico', 80, 'Em Observação', '', '[]', '', '']);
  A.run('limparCache_()'); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 3);
  A.as('ger@x.com'); eq(A.call('relatorio', 'auditorias', A.F(), {}).total, 2, 'a2 + a auditoria de Expedição T1 do Analítico');
});
T('Auditor Recebimento: restrito a 1 processo no formulário, rascunho e matriz', () => {
  A.as('audr@x.com'); eq(A.call('bootstrap').processos, ['Recebimento']);
  eq(A.audit('audr@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Ana Souza' } }).ok, true);
  eq(A.audit('audr@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza'] } }).erros.processo, 'Seu perfil não pode auditar este processo.');
  nega(() => A.ctx.salvarRascunho({ processo: 'Expedição', chave: '36', estado: {} }), 'Sem acesso a este processo');
  nega(() => A.ctx.getRascunho('Expedição', '36'), 'Sem acesso'); nega(() => A.ctx.getMatriz('Expedição'), 'Sem acesso a este processo');
  eq(A.call('getMatriz', 'Recebimento').length >= 3, true);
});
T('Sem tela de relatório: Auditor padrão não acessa NENHUM relatório', () => {
  A.as('aud1@x.com');
  ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export', 'detalhe', 'itensAuditoria'].forEach(t => nega(() => A.ctx.relatorio(t, A.F(), { kind: 'colab', chave: 'x', id: A.ids.a1 }), 'não tem acesso', t));
});

/* --- tabela geral: cada função pública × cada perfil --- */
const NEG = /Acesso negado|não tem permissão|não tem acesso/;
const acoes = {
  bootstrap: [() => A.ctx.bootstrap(false), ['*']],
  getMatriz: [() => A.ctx.getMatriz('Recebimento'), ['owner', 'ana', 'sl', 'aud1', 'lid', 'sem', 'anal', 'audr', 'gest']],
  getRascunho: [() => A.ctx.getRascunho('Recebimento', '36'), ['owner', 'ana', 'sl', 'aud1', 'anal', 'audr', 'gest']],
  salvarRascunho: [() => A.ctx.salvarRascunho({ processo: 'Recebimento', chave: '07', estado: {} }), ['owner', 'ana', 'sl', 'aud1', 'anal', 'audr', 'gest']],
  descartarRascunho: [() => A.ctx.descartarRascunho('Recebimento', '07'), ['owner', 'ana', 'sl', 'aud1', 'anal', 'audr', 'gest']],
  salvarAuditoria: [() => A.ctx.salvarAuditoria({ processo: 'Recebimento', respostas: [] }), ['owner', 'ana', 'sl', 'aud1', 'anal', 'audr', 'gest']],
  rel_geral: [() => A.ctx.relatorio('geral', A.F(), {}), ['owner', 'ana', 'sl', 'ger', 'lid', 'sem']],
  rel_auditorias: [() => A.ctx.relatorio('auditorias', A.F(), {}), ['owner', 'ana', 'sl', 'ger', 'anal']],
  rel_auditores: [() => A.ctx.relatorio('auditores', A.F(), {}), ['owner', 'ana', 'sl']],
  rel_proc: [() => A.ctx.relatorio('proc', A.F(), {}), ['owner', 'ana', 'sl', 'ger']],
  rel_doca: [() => A.ctx.relatorio('doca', A.F(), {}), ['owner', 'ana', 'sl', 'ger']],
  rel_colab: [() => A.ctx.relatorio('colab', A.F(), {}), ['owner', 'ana', 'sl', 'ger', 'lid', 'sem']],
  rel_tend: [() => A.ctx.relatorio('tend', A.F(), {}), ['owner', 'ana', 'sl', 'ger']],
  rel_export: [() => A.ctx.relatorio('export', A.F(), {}), ['owner', 'ana', 'sl', 'anal']],
  minhasMetas: [() => A.ctx.minhasMetas(), ['owner', 'ana', 'sl', 'aud1', 'anal']],
  salvarMeta: [() => A.ctx.salvarMeta({}), ['owner', 'ana', 'sl']],
  excluirMeta: [() => A.ctx.excluirMeta('x'), ['owner', 'ana', 'sl']],
  listarCad_estrutura: [() => A.ctx.listarCadastro('Cad_Estrutura'), ['owner', 'ana', 'sl']],
  salvarCad_pessoas: [() => A.ctx.salvarCadastro('Cad_Pessoas', {}, null), ['owner', 'ana', 'sl']],
  excluirCad_perguntas: [() => A.ctx.excluirCadastro('Cad_Processos_Perguntas', 9999, {}), ['owner', 'ana', 'sl']],
  salvarConfigs: [() => A.ctx.salvarConfigs({}), ['owner', 'ana', 'sl']],
  listarAcessos: [() => A.ctx.listarAcessos(), ['owner', 'ana', 'sl', 'gest']],
  salvarUsuario: [() => A.ctx.salvarUsuario({}, null), ['owner', 'ana', 'sl', 'gest']],
  excluirUsuario: [() => A.ctx.excluirUsuario(9999, {}), ['owner', 'ana', 'sl', 'gest']],
  salvarPerfil: [() => A.ctx.salvarPerfil({}, true), ['owner', 'gest']],
  excluirPerfil: [() => A.ctx.excluirPerfil('x'), ['owner', 'gest']],
  listarSolicitacoes: [() => A.ctx.listarSolicitacoes(), ['owner']],
  contarPendentes: [() => A.ctx.contarPendentes(), ['owner']],
  recusarSolicitacao: [() => A.ctx.recusarSolicitacao('x'), ['owner']],
  setupPlanilha: [() => A.ctx.setupPlanilha(), ['owner']],
  migrarV6: [() => A.ctx.migrarV6(), ['owner']],
  migrarV4: [() => A.ctx.migrarV4(), ['owner']],
  migrarV3: [() => A.ctx.migrarV3(), ['owner']],
  migrarV2: [() => A.ctx.migrarV2(), ['owner']]
};
const pessoas = ['owner', 'ana', 'sl', 'aud1', 'ger', 'lid', 'anal', 'audr', 'gest', 'ghost', 'off', 'sem'];
const mapaEmail = { ghost: 'ghost@x.com', off: 'off@x.com' };
pessoas.forEach(p => {
  Object.keys(acoes).forEach(nome => {
    T('matriz de acesso: ' + p + ' × ' + nome, () => {
      A.as(mapaEmail[p] || p + '@x.com');
      const [fn, permitidos] = acoes[nome];
      let negado = false, msg = '', res;
      try { res = fn(); } catch (e) { msg = e.message; negado = NEG.test(e.message); }
      if (nome === 'bootstrap') { const b = JSON.parse(JSON.stringify(res)); eq(b.user.ok, !(p === 'ghost' || p === 'off')); if (!b.user.ok) { ok(!b.db && !b.config && !b.auditores, 'bloqueado não recebe dados'); } return; }
      const deve = permitidos.indexOf('*') > -1 ? !(p === 'ghost' || p === 'off') : permitidos.indexOf(p) > -1;
      if (p === 'ghost' || p === 'off') ok(negado, 'não cadastrado/inativo deveria ser negado, veio: ' + msg);
      else if (deve) ok(!negado, 'deveria permitir, mas negou: ' + msg);
      else ok(negado, 'deveria NEGAR, mas permitiu (msg: ' + msg + ')');
    });
  });
});
T('include() só serve Styles e JS_Client', () => { nega(() => A.ctx.include('Code'), 'inválido'); nega(() => A.ctx.include('../x'), 'inválido'); eq(A.ctx.include('Styles'), '<Styles>'); });

/* --- escalada de privilégio --- */
T('Analista NÃO cria/edita Admin nem promove ninguém além do seu nível', () => {
  A.as('ana@x.com');
  const us = (o, orig) => A.call('salvarUsuario', Object.assign({ Status_Ativo: 'Sim' }, o), orig || null);
  eq(us({ Email_Google: 'novoadm@x.com', Nome: 'N', Perfil: 'Admin' }).erros.Perfil, 'Você só pode atribuir perfis com permissões iguais ou menores que as suas.');
  eq(us({ Email_Google: 'g2@x.com', Nome: 'G', Perfil: 'Gestor Acessos' }).erros.Perfil, 'Você só pode atribuir perfis com permissões iguais ou menores que as suas.');
  eq(us({ Email_Google: 'novoaud@x.com', Nome: 'Novo Aud', Perfil: 'Auditor' }).ok, true);
  eq(us({ Email_Google: 'outroana@x.com', Nome: 'Outra Ana', Perfil: 'Analista' }).ok, true, 'perfil igual ao seu é permitido');
  const u = A.call('listarAcessos').usuarios; const aud1 = u.find(x => x.Email_Google === 'aud1@x.com');
  eq(us({ _row: aud1._row, Email_Google: 'aud1@x.com', Nome: 'Audi Um', Perfil: 'Admin' }, aud1).erros.Perfil.slice(0, 18), 'Você só pode atrib', 'promover Auditor a Admin');
  const dono = u.find(x => x.Email_Google === 'owner@x.com');
  eq(us({ _row: dono._row, Email_Google: 'owner@x.com', Nome: 'Dono', Perfil: 'Auditor' }, dono).msg, 'Você não pode alterar um usuário com perfil acima do seu.');
  eq(A.call('excluirUsuario', dono._row, dono).msg, 'Você não pode excluir um usuário com perfil acima do seu.');
  const eu = u.find(x => x.Email_Google === 'ana@x.com'); eq(eu.editavel, false);
  eq(us({ _row: eu._row, Email_Google: 'ana@x.com', Nome: 'Ana', Perfil: 'Admin' }, eu).ok, false, 'auto-promoção');
  eq(A.call('excluirUsuario', eu._row, eu).msg, 'Você não pode excluir o seu próprio acesso.');
  eq(A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'owner@x.com').editavel, false);
  eq(A.call('listarAcessos').perfis.find(x => x.nome === 'Admin').atribuivel, false); eq(A.call('listarAcessos').perfis.find(x => x.nome === 'Auditor').atribuivel, true);
  ok(!A.call('listarAcessos').seguranca, 'diagnóstico só para quem edita perfis');
});
T('usuário: e-mail inválido/duplicado, nome longo, fórmula, perfil inexistente', () => {
  A.as('ana@x.com'); const us = (o) => A.call('salvarUsuario', Object.assign({ Email_Google: 'k@x.com', Nome: 'K', Perfil: 'Auditor', Status_Ativo: 'Sim' }, o), null);
  eq(us({ Email_Google: 'sem-arroba' }).erros.Email_Google, 'E-mail inválido.'); eq(us({ Email_Google: 'AUD1@x.com' }).erros.Email_Google, 'E-mail já cadastrado.');
  eq(us({ Nome: 'x'.repeat(121) }).erros.Nome, 'Máximo de 120 caracteres.'); eq(us({ Perfil: 'Foo' }).erros.Perfil, 'Perfil inexistente.'); eq(us({ Status_Ativo: 'Talvez' }).erros.Status_Ativo, 'Valor inválido.');
  eq(us({ Email_Google: 'f@x.com', Nome: '=cmd|calc' }).ok, true); const l = A.sheets.Cad_Usuarios; eq(l.d[l.getLastRow() - 1][1], ' =cmd|calc');
  eq(us({ Perfil: '__proto__' }).erros.Perfil, 'Perfil inexistente.'); eq(us({ Perfil: 'constructor' }).erros.Perfil, 'Perfil inexistente.');
});
T('desativar usuário bloqueia NA HORA (cache limpo) e perfil alterado vale na hora', () => {
  A.as('ana@x.com'); const aud2 = A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'aud2@x.com');
  A.as('aud2@x.com'); eq(A.call('bootstrap').user.ok, true);
  A.as('ana@x.com'); eq(A.call('salvarUsuario', { _row: aud2._row, Email_Google: 'aud2@x.com', Nome: 'Audi Dois', Perfil: 'Auditor', Status_Ativo: 'Não' }, aud2).ok, true);
  A.as('aud2@x.com'); eq(A.call('bootstrap').user.ok, false); nega(() => A.ctx.salvarAuditoria({ processo: 'Recebimento' }), 'Acesso negado');
  A.as('ana@x.com'); const novo2 = A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'aud2@x.com');
  A.call('salvarUsuario', { _row: novo2._row, Email_Google: 'aud2@x.com', Nome: 'Audi Dois', Perfil: 'Auditor', Status_Ativo: 'Sim' }, novo2);
  A.as('aud2@x.com'); eq(A.call('bootstrap').user.ok, true);
});
T('Gestor de Acessos (perfil parcial) não concede nada além do que tem', () => {
  A.as('gest@x.com');
  const pf = (n, perms, telas, escopo) => A.call('salvarPerfil', { nome: n, desc: '', perms, telas, escopo }, true);
  const todos = { modo: 'todos', processos: [], turnos: [] }, rec = { modo: 'todos', processos: ['Recebimento'], turnos: [] };
  eq(pf('Escala1', ['config'], ['cfg'], rec).msg, 'Você não pode conceder permissões, telas ou dados que o seu próprio perfil não tem.');
  eq(pf('Escala2', ['auditar'], ['form'], todos).msg, 'Você não pode conceder permissões, telas ou dados que o seu próprio perfil não tem.', 'escopo mais amplo');
  eq(pf('Escala3', ['auditar'], ['form'], { modo: 'todos', processos: ['Expedição'], turnos: [] }).msg.slice(0, 20), 'Você não pode conced');
  eq(pf('Escala4', ['auditar'], ['form'], { modo: 'proprias', processos: ['Recebimento'], turnos: [] }).ok, true, 'mais restrito que o dele é permitido');
  eq(pf('Filho', ['auditar'], ['matriz', 'form'], rec).ok, true);
  eq(pf('Filho2', ['usuarios'], ['acessos'], rec).ok, true);
  const us = (e, p) => A.call('salvarUsuario', { Email_Google: e, Nome: 'X', Perfil: p, Status_Ativo: 'Sim' }, null);
  eq(us('c1@x.com', 'Analista').erros.Perfil.slice(0, 12), 'Você só pode'); eq(us('c2@x.com', 'Admin').erros.Perfil.slice(0, 12), 'Você só pode'); eq(us('c3@x.com', 'Auditor').erros.Perfil.slice(0, 12), 'Você só pode', 'Auditor tem escopo mais amplo');
  eq(us('c4@x.com', 'Filho').ok, true);
  eq(A.call('salvarPerfil', { nome: 'Gestor Acessos', desc: '', perms: ['usuarios', 'perfis', 'auditar', 'config'], telas: ['matriz'], escopo: rec }, false).msg, 'Você não pode editar o perfil que está usando.');
  eq(A.call('excluirPerfil', 'Gestor Acessos').msg, 'Você não pode excluir o perfil que está usando.');
  A.as('owner@x.com'); eq(A.call('excluirPerfil', 'Gestor Acessos').msg.slice(0, 22), 'Não é possível excluir');
});
T('Admin é protegido: não edita, não exclui, nome reservado; perfis padrão não excluem', () => {
  A.as('owner@x.com');
  eq(A.call('salvarPerfil', { nome: 'Admin', desc: '', perms: [], telas: ['matriz'], escopo: { modo: 'todos', processos: [], turnos: [] } }, false).msg, 'O perfil Admin é protegido e não pode ser editado.');
  eq(A.call('salvarPerfil', { nome: 'admin', desc: '', perms: [], telas: ['matriz'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true).erros.nome, 'Este nome é reservado.');
  eq(A.call('salvarPerfil', { nome: 'ADMİN', desc: '', perms: [], telas: ['matriz'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true).ok === true, false);
  ['Admin', 'Analista', 'Site Leader', 'Auditor'].forEach(n => eq(A.call('excluirPerfil', n).msg.slice(0, 15), n === 'Admin' || true ? 'Perfis padrão d' : ''));
  eq(A.call('excluirPerfil', 'Inexistente').ok, false);
});
T('Admin vem do código: adulterar a linha do Admin na planilha não tira nem dá poder', () => {
  const sh = A.sheets.Cad_Perfis; const row = sh.d.findIndex(r => r[0] === 'Admin');
  sh.d[row][2] = ''; sh.d[row][3] = 'matriz'; sh.d[row][4] = '{"modo":"proprias"}'; A.run('limparCache_()');
  A.as('owner@x.com'); const u = A.call('bootstrap').user; eq(u.perms.length, 12); eq(u.escopo.modo, 'todos'); ok(u.telas.indexOf('acessos') > -1);
});
T('adulteração da planilha falha FECHADA: escopo ilegível = só as próprias; lista inválida ≠ "todos"', () => {
  const sh = A.sheets.Cad_Perfis; const row = sh.d.findIndex(r => r[0] === 'Gerente Expedicao');
  const original = sh.d[row][4];
  sh.d[row][4] = '{nao é json'; A.run('limparCache_()'); A.as('ger@x.com');
  eq(A.call('bootstrap').user.escopo.modo, 'proprias'); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 0);
  sh.d[row][4] = JSON.stringify({ modo: 'todos', processos: ['Xpto'], turnos: [] }); A.run('limparCache_()');
  eq(A.call('bootstrap').user.escopo.processos, ['__nenhum__']); eq(A.call('relatorio', 'geral', A.F(), {}).A.total, 0, 'processo inválido não vira "todos"');
  sh.d[row][4] = original; A.run('limparCache_()');
  const r2 = sh.d.findIndex(r => r[0] === 'Auditor Recebimento'); const o2 = sh.d[r2][2]; sh.d[r2][2] = 'auditar,perm_falsa,config'; A.run('limparCache_()'); A.as('audr@x.com');
  eq(A.call('bootstrap').user.perms, ['auditar', 'config'].filter(x => x === 'auditar').concat(['config']).sort((a, b) => ['auditar', 'config'].indexOf(a) - ['auditar', 'config'].indexOf(b)), 'permissão real via planilha vale (dono da planilha manda); inválida some');
  sh.d[r2][2] = o2; A.run('limparCache_()');
});
T('usuário com perfil inexistente na planilha é bloqueado', () => {
  const us = A.sheets.Cad_Usuarios; const row = us.d.findIndex(r => r[0] === 'audr@x.com'); const o = us.d[row][2];
  us.d[row][2] = 'Fantasma'; A.run('limparCache_()'); A.as('audr@x.com'); const b = A.call('bootstrap'); eq([b.user.ok, b.user.motivo], [false, 'perfil_invalido']);
  us.d[row][2] = '__proto__'; A.run('limparCache_()'); eq(A.call('bootstrap').user.ok, false);
  us.d[row][2] = o; A.run('limparCache_()');
});
T('excluir perfil em uso é bloqueado; sem uso funciona; log registra tudo', () => {
  A.as('owner@x.com');
  eq(A.call('excluirPerfil', 'Lider de Time').msg.slice(0, 22), 'Não é possível excluir');
  eq(perfil('Temporario', ['auditar'], ['form'], {}).ok, true); eq(A.call('excluirPerfil', 'Temporario').ok, true);
  const log = A.call('listarAcessos').log; ok(log.length > 10);
  const l0 = log.find(x => x.Acao === 'Perfil excluído' && x.Alvo === 'Temporario'); ok(l0 && /owner@x.com/.test(l0.Responsavel) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(l0.Timestamp), JSON.stringify(l0));
  ok(log.some(x => x.Acao === 'Perfil criado' && x.Alvo === 'Gerente Expedicao' && /Expedição/.test(x.Detalhe)));
  ok(log.some(x => x.Acao === 'Usuário alterado' && /Ativo: Sim → Não/.test(x.Detalhe)), 'desativação registrada com antes → depois');
  ok(log.some(x => x.Acao === 'Usuário criado' && x.Alvo === 'ger@x.com'));
  // alteração de permissão registra o diff
  const p = A.call('listarAcessos').perfis.find(x => x.nome === 'Auditor Recebimento');
  eq(A.call('salvarPerfil', { nome: 'Auditor Recebimento', desc: p.desc, perms: ['auditar', 'metas'], telas: p.telas, escopo: p.escopo }, false).ok, true);
  ok(A.call('listarAcessos').log.some(x => x.Acao === 'Perfil alterado' && /Permissões: \+metas/.test(x.Detalhe)), 'diff de permissão');
  A.call('salvarPerfil', { nome: 'Auditor Recebimento', desc: p.desc, perms: ['auditar'], telas: p.telas, escopo: p.escopo }, false);
});
T('perfil: nome/descrição/escopo inválidos; fórmula na descrição', () => {
  A.as('owner@x.com'); const pf = (o) => A.call('salvarPerfil', Object.assign({ nome: 'Novo Perfil', desc: '', perms: ['auditar'], telas: ['form'], escopo: { modo: 'todos', processos: [], turnos: [] } }, o), true);
  eq(pf({ nome: '' }).erros.nome, 'Campo obrigatório.'); eq(pf({ nome: '=x' }).erros.nome, 'Use de 2 a 40 letras, números, espaço ou hífen.'); eq(pf({ nome: 'x' }).erros.nome, 'Use de 2 a 40 letras, números, espaço ou hífen.');
  eq(pf({ nome: 'Auditor' }).erros.nome, 'Já existe um perfil com este nome.'); eq(pf({ desc: 'x'.repeat(201) }).erros.desc, 'Máximo de 200 caracteres.');
  eq(pf({ perms: ['hackear'] }).erros.perms, 'Permissão inválida.'); eq(pf({ telas: ['segredo'] }).erros.telas, 'Tela inválida.');
  eq(pf({ escopo: { modo: 'tudo' } }).erros.escopo, 'Escolha quais dados o perfil enxerga.'); eq(pf({ escopo: { modo: 'todos', processos: ['Foo'] } }).erros.escopo, 'Processo ou turno inválido.');
  eq(pf({ nome: 'Com Formula', desc: '=1+1' }).ok, true); const sh = A.sheets.Cad_Perfis; eq(sh.d[sh.getLastRow() - 1][1], ' =1+1');
  eq(A.call('excluirPerfil', 'Com Formula').ok, true);
});
T('segurança da planilha: diagnóstico detecta compartilhamento perigoso', () => {
  A.as('owner@x.com'); let s = A.call('listarAcessos').seguranca; ok(s.some(x => x.nivel === 'ok'));
  ok(s.some(x => x.nivel === 'info' && /link/.test(x.txt)), 'avisa que o compartilhamento por link não é visível ao app');
  A.compart.acc = 'PRIVATE'; A.compart.editors = ['aud1@x.com']; s = A.call('listarAcessos').seguranca; ok(s.some(x => x.nivel === 'alerta' && /aud1@x.com/.test(x.txt)));
  A.compart.editors = []; A.compart.viewers = ['audr@x.com'];  s = A.call('listarAcessos').seguranca; ok(s.some(x => x.nivel === 'alerta' && /audr@x.com/.test(x.txt)));
  A.compart.viewers = [];
});
T('último Admin ativo é protegido', () => {
  eq(A.run("restaAdmin_([{Perfil:'Admin',Status_Ativo:'Não'},{Perfil:'Analista',Status_Ativo:'Sim'}])"), false);
  eq(A.run("restaAdmin_([{Perfil:'Admin',Status_Ativo:'sim'}])"), true);
  A.as('owner@x.com');
  const dono = A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'owner@x.com');
  eq(A.call('salvarUsuario', { _row: dono._row, Email_Google: 'owner@x.com', Nome: 'Dono', Perfil: 'Auditor', Status_Ativo: 'Sim' }, dono).msg, 'Você não pode alterar o seu próprio acesso.');
  eq(A.call('salvarUsuario', { Email_Google: 'adm2@x.com', Nome: 'Adm2', Perfil: 'Admin', Status_Ativo: 'Sim' }, null).ok, true);
  A.as('adm2@x.com'); const d2 = A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'owner@x.com');
  eq(A.call('salvarUsuario', { _row: d2._row, Email_Google: 'owner@x.com', Nome: 'Dono', Perfil: 'Admin', Status_Ativo: 'Não' }, d2).ok, true, 'com outro Admin ativo pode desativar');
  A.as('owner@x.com'); eq(A.call('bootstrap').user.ok, false);
  A.as('adm2@x.com'); const d3 = A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'owner@x.com'); A.call('salvarUsuario', { _row: d3._row, Email_Google: 'owner@x.com', Nome: 'Dono', Perfil: 'Admin', Status_Ativo: 'Sim' }, d3);
});
T('edição concorrente de usuário/perfil é detectada', () => {
  A.as('ana@x.com'); const u = A.call('listarAcessos').usuarios.find(x => x.Email_Google === 'novoaud@x.com');
  const velho = Object.assign({}, u, { Nome: 'Nome Velho' });
  ok(/alterado ou removido/.test(A.call('salvarUsuario', { _row: u._row, Email_Google: 'novoaud@x.com', Nome: 'Z', Perfil: 'Auditor', Status_Ativo: 'Sim' }, velho).msg));
  ok(/alterado ou removido/.test(A.call('excluirUsuario', u._row, velho).msg));
});

/* ===================== G. DESEMPENHO: histórico grande (36 mil linhas) ===================== */
T('desempenho: 36 mil linhas — relatório de 7 dias lê só uma fração das células', () => {
  const B = novo(); const h = B.hist(); h.maxR = 60000; B.sheets.Auditorias_Colaboradores.maxR = 60000;
  const N = 36000, base = Date.now();
  for (let i = 0; i < N; i++) {
    const t = new Date(base - (N - i) * 864e5 * 365 / N), p = ['Recebimento', 'Expedição', 'Separação'][i % 3], doca = p === 'Separação' ? 'A-10' : '36';
    const ts = t.toISOString().slice(0, 19).replace('T', ' '), id = 'AUD-' + ts.replace(/[-: ]/g, '') + '-' + String(100 + i % 900);
    h.d.push([id, new Date(ts.replace(' ', 'T') + 'Z'), p, doca, 'Ana Souza', 'Carlos Lider', 'T1', 'Audi Um', 70 + (i % 31), 'x', '', '[]', 'aud1@x.com', i % 3 ? 'Sub1' : '']);
    B.sheets.Auditorias_Colaboradores.d.push([id, 'Ana Souza', 'Carlos Lider', 'T1']);
  }
  B.as('ana@x.com'); B.run('limparCache_()');
  const total = N * 14; global.__cells = 0; let t0 = Date.now();
  const g = B.call('relatorio', 'geral', { de: B.dia(-6), ate: B.hojeStr }, {});
  const lidas = global.__cells, ms = Date.now() - t0;
  ok(g.A.total >= 560 && g.A.total <= 720, 'total 7 dias ~690, veio ' + g.A.total);
  ok(lidas < total * 0.35, 'células lidas: ' + lidas + ' de ' + total + ' (sem a leitura da planilha inteira)');
  global.__cells = 0; t0 = Date.now(); B.call('relatorio', 'geral', { de: B.dia(-6), ate: B.hojeStr }, {}); eq(global.__cells, 0, 'segunda chamada vem do cache');
  global.__cells = 0; const a = B.call('relatorio', 'auditorias', { de: B.dia(-364), ate: B.hojeStr }, {}); ok(a.total > 30000, 'ano inteiro: ' + a.total); ok(a.linhas.length === 50);
  global.__cells = 0; B.call('getMatriz', 'Recebimento'); const mx = global.__cells; ok(mx < N * 8 + 100, 'matriz lê 8 colunas uma vez: ' + mx);
  global.__cells = 0; B.call('getMatriz', 'Expedição'); eq(global.__cells < 2000, true, 'matriz seguinte usa cache da última auditoria: ' + global.__cells);
  const e = B.call('relatorio', 'export', { de: B.dia(-364), ate: B.hojeStr }, { offset: 0 }); eq(e.linhas.length, 5000); eq(e.fim, false);
  console.log('   (36k linhas: geral 7d lidas=' + lidas + ' células, matriz=' + mx + ')');
});

fim('SERVIDOR parte 2 (relatórios, metas, perfis, segurança, desempenho)');
