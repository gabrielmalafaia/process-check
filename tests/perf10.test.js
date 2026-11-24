// v10: desempenho do feedback obrigatório com volume (células lidas por chamada e tempo no simulador).
const { T, eq, ok, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario(); A.as('owner@x.com'); A.call('migrarV10');
const N_REG = 3000, N_PEND = 600;
// histórico grande de registros (cadeia válida) e pendências concluídas
let prev = '';
const reg = A.sheets.Feedback_Registros, pe = A.sheets.Feedback_Pendencias;
for (let i = 0; i < N_REG; i++) {
  const l = ['FBR-' + i, 'FBK-old-' + (i % N_PEND), 'Colab ' + i, 'Time', 'T1', 'x' + (i % 50) + '@x.com', 'Autor', 'sl@x.com', '2026-01-01 10:00:00', 'Texto de feedback número ' + i + ' ' + 'conversamos sobre os itens reprovados e combinamos revisar. '.repeat(8), '2026-01-02 10:00:00', prev, ''];
  l[12] = A.run('hashRegistroFb_')(prev, l); prev = l[12]; reg.d.push(l.concat(['']));
}
for (let i = 0; i < N_PEND; i++) pe.d.push(['FBK-old-' + i, 'k' + i, 'Colab ' + i, 'Time', 'T1', '2026-01-01', '2026-01-05', 3, 'AUD-1|AUD-2|AUD-3', 90, '2026-01-06 10:00:00', 'Concluida', 'x@x.com', 'X', 'sl@x.com', '2026-01-06 10:00:00', '2026-01-13', '', '', '']);
A.sheets.Feedback_Registros.maxR = Math.max(reg.maxR, reg.d.length + 5); A.sheets.Feedback_Pendencias.maxR = Math.max(pe.maxR, pe.d.length + 5);
const TXT = 'Conversei com o colaborador sobre os itens reprovados nas últimas auditorias e combinamos reforçar a conferência antes de liberar a doca.';
const medir = (f) => { global.__cells = 0; const t = Date.now(); const r = f(); return { r, cells: global.__cells, ms: Date.now() - t }; };
for (let i = 0; i < 3; i++) A.audit('aud1@x.com', 'Expedição', { conf: 5, f: { doca: '07', colaboradores: ['Carla Dias'] } });
T('registrar com 3000 registros e 600 pendências lê só o necessário (não a aba inteira com textos)', () => {
  A.run('gerarPendenciasFeedback_()'); A.as('sl@x.com'); const id = A.call('listarFeedbacks').pendencias.find((p) => p.status === 'Aberta').id; A.call('designarFeedback', id, 'aud2@x.com');
  A.as('aud2@x.com'); const m = medir(() => A.call('registrarFeedback', id, TXT)); eq(m.r.ok, true, JSON.stringify(m.r).slice(0, 200));
  console.log('   registrar: ' + m.cells + ' células, ' + m.ms + ' ms'); ok(m.cells < 12 * N_REG + 20 * N_PEND + 2000, 'células demais: ' + m.cells);
  A.as('sl@x.com'); eq(A.call('verificarProvaFeedback').ok, true);
});
T('lista do Site Leader e bootstrap com histórico grande ficam dentro do orçamento', () => {
  A.as('sl@x.com'); const l = medir(() => A.call('listarFeedbacks')); console.log('   listar: ' + l.cells + ' células, ' + l.ms + ' ms'); ok(l.ms < 5000, 'lento: ' + l.ms);
  const b = medir(() => A.call('bootstrap')); console.log('   bootstrap: ' + b.cells + ' células, ' + b.ms + ' ms'); ok(b.ms < 5000);
  const b2 = medir(() => A.call('bootstrap')); ok(b2.cells <= b.cells, 'segunda chamada não lê mais que a primeira');
});
T('a cadeia verifica 3000 registros em tempo razoável', () => { A.as('owner@x.com'); const v = medir(() => A.call('verificarProvaFeedback')); console.log('   verificar: ' + v.ms + ' ms'); eq(v.r.ok, true); ok(v.ms < 8000, 'lento: ' + v.ms); });
fim('v10 desempenho');
