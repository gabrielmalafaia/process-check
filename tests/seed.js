const { criarAmbiente } = require('./mock.js');
const CODE = process.env.CODE || require('path').join(__dirname, '..', 'src', 'Code.gs');

function novo(opts) {
  opts = opts || {};
  const A = criarAmbiente(CODE);
  A.as('owner@x.com');
  A.call('setupPlanilha');
  const add = (aba, linha) => A.ctx.anexar_(aba, linha);
  // perfis custom serão criados pelos testes; usuários base
  [['ana@x.com', 'Ana Analista', 'Analista'], ['sl@x.com', 'Sandra SL', 'Site Leader'], ['aud1@x.com', 'Audi Um', 'Auditor'], ['aud2@x.com', 'Audi Dois', 'Auditor']]
    .forEach(u => add('Cad_Usuarios', [u[0], u[1], u[2], 'Sim']));
  add('Cad_Usuarios', ['off@x.com', 'Inativo', 'Admin', 'Não']);
  add('Cad_Pessoas', ['Carlos Lider', 'Líder', 'T1', 'Sim', '']);
  add('Cad_Pessoas', ['Dora Lider', 'Líder', 'T2', 'Sim', '']);
  [['Ana Souza', 'T1', 'Carlos Lider'], ['Bruno Lima', 'T1', 'Carlos Lider'], ['Carla Dias', 'T2', 'Dora Lider'], ['Davi Reis', 'T2', 'Dora Lider'], ['Eva Nunes', 'T1', 'Carlos Lider']]
    .forEach(p => add('Cad_Pessoas', [p[0], 'Colaborador', p[1], 'Sim', p[2]]));
  add('Cad_Pessoas', ['Fabio Saiu', 'Colaborador', 'T1', 'Não', 'Carlos Lider']);
  add('Cad_Estrutura', ['Doca', '36', 'Azul/Triângulo', 'Carlos Lider', 'T1']);
  add('Cad_Estrutura', ['Doca', '01', 'Verde/Bolinha', 'Carlos Lider', 'T1']);
  add('Cad_Estrutura', ['Doca', '07', 'Roxo/Losango', 'Dora Lider', 'T2']);
  add('Cad_Estrutura', ['Cluster', 'A-10', 'Laranja/Bolinha', 'Dora Lider', 'T2']);
  add('Cad_Estrutura', ['Cluster', 'B-20', 'Rosa/Estrela', 'Carlos Lider', 'T1']);
  ['Recebimento', 'Indução', 'Separação', 'Sorting', 'Compra', 'Expedição'].forEach(p => {
    for (let i = 1; i <= 10; i++) add('Cad_Processos_Perguntas', [p, i <= 5 ? 'Sub1' : 'Sub2', p + ' item ' + i, i === 1 ? 'Sim' : 'Não']);
  });
  A.call('migrarV6'); // deve ser idempotente
  A.as('ana@x.com');
  A.perg = (proc) => A.J(A.ctx.lerAba_('Cad_Processos_Perguntas').filter(x => x.Processo === proc));
  /** respostas: nConf conformes, nNC não conformes, resto N/A (total 10 itens) */
  A.resp = (proc, nConf, nNC) => A.perg(proc).map((x, i) => ({ k: x._row, ok: i < nConf ? true : (i < nConf + nNC ? false : null) }));
  A.audit = (email, proc, o) => {
    const ant = A.email; A.as(email);
    try {
      const nNC = o.nc !== undefined ? o.nc : 10 - o.conf;
      return A.call('salvarAuditoria', Object.assign({ processo: proc, respostas: A.resp(proc, o.conf, nNC), observacoes: o.obs || '' }, o.f || {}));
    } finally { A.as(ant); }
  };
  /** move uma auditoria no tempo (ID, timestamp e linhas auxiliares) */
  A.retro = (id, dias) => {
    const h = A.hist();
    for (let r = 2; r <= h.getLastRow(); r++) {
      if (String(h.d[r - 1][0]) !== id) continue;
      const ts = h.d[r - 1][1], t = ts instanceof Date ? ts : new Date(String(ts).replace(' ', 'T') + 'Z');
      const nt = new Date(t.getTime() - dias * 864e5), p2 = n => String(n).padStart(2, '0');
      const s14 = nt.getUTCFullYear() + p2(nt.getUTCMonth() + 1) + p2(nt.getUTCDate()) + p2(nt.getUTCHours()) + p2(nt.getUTCMinutes()) + p2(nt.getUTCSeconds());
      const novoId = 'AUD-' + s14 + '-' + id.slice(-3);
      h.d[r - 1][0] = novoId; h.d[r - 1][1] = nt;
      const ax = A.sheets.Auditorias_Colaboradores;
      if (ax) for (let k = 2; k <= ax.getLastRow(); k++) if (String(ax.d[k - 1][0]) === id) ax.d[k - 1][0] = novoId;
      A.run('limparCache_()');
      return novoId;
    }
    throw new Error('id não encontrado ' + id);
  };
  A.cfg = (c) => { A.as('owner@x.com'); const r = A.call('salvarConfigs', c); return r; };
  A.hojeStr = A.run('hoje_()');
  A.dia = (n) => A.run("addDias_('" + A.hojeStr + "'," + n + ')');
  A.F = (extra) => Object.assign({ de: A.dia(-30), ate: A.hojeStr }, extra || {});
  return A;
}

/** Cenário com 6 auditorias distribuídas (usado nos testes de relatório/escopo). */
function cenario() {
  const A = novo();
  const ids = {};
  ids.a1 = A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza'] } }).id;
  ids.a2 = A.audit('aud1@x.com', 'Expedição', { conf: 8, nc: 2, f: { doca: '01', colaboradores: ['Ana Souza', 'Bruno Lima'] } }).id;
  ids.a3 = A.audit('aud2@x.com', 'Expedição', { conf: 6, nc: 4, f: { doca: '07', colaboradores: ['Carla Dias', 'Davi Reis'] } }).id;
  ids.a4 = A.audit('aud2@x.com', 'Separação', { conf: 9, nc: 1, f: { doca: 'A-10', lider: 'Dora Lider', turno: 'T2' } }).id;
  ids.a5 = A.audit('aud1@x.com', 'Indução', { conf: 7, nc: 3, f: { colaboradores: ['Bruno Lima'] } }).id;
  ids.a6 = A.audit('aud2@x.com', 'Recebimento', { conf: 5, nc: 5, f: { doca: '01', colaboradores: ['Carla Dias'] } }).id;
  ids.a2 = A.retro(ids.a2, 1); ids.a3 = A.retro(ids.a3, 2); ids.a4 = A.retro(ids.a4, 2); ids.a5 = A.retro(ids.a5, 3); ids.a6 = A.retro(ids.a6, 3);
  A.ids = ids;
  return A;
}
module.exports = { novo, cenario };
