// v10.9: feedback imediato. Pergunta marcada pelo Site Leader/Admin; uma não conformidade nela gera na hora
// uma pendência a designar, destacada para o Site Leader com o motivo (o texto da pergunta). O auditor não vê nada disso.
const { T, eq, ok, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
A.as('owner@x.com'); A.call('migrarV10');
const pend = () => A.sheets.Feedback_Pendencias.d.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined));
const lista = (e) => { A.as(e || 'sl@x.com'); return A.call('listarFeedbacks'); };
const perg = (proc, desc) => { A.as('owner@x.com'); return A.call('listarCadastro', 'Cad_Processos_Perguntas').find((x) => x.Processo === proc && x.Descricao_Item === desc); };
const marcar = (email, proc, desc, v) => { const o = perg(proc, desc); A.as(email); return A.call('salvarCadastro', 'Cad_Processos_Perguntas', Object.assign({}, o, { Feedback_Imediato: v }), o); };
// conf 9 e nc 1: só o item 10 fica não conforme
const auditar = (colab, proc) => A.audit('aud1@x.com', proc || 'Recebimento', { conf: 9, nc: 1, f: { doca: '36', colaboradores: [colab] } });

T('configurar: só Site Leader e Admin marcam a pergunta como feedback imediato', () => {
  const r = marcar('ana@x.com', 'Recebimento', 'Recebimento item 10', 'Sim');
  eq(r.ok, false, 'Analista não pode marcar'); ok(r.erros && r.erros.Feedback_Imediato, JSON.stringify(r));
  eq(String(perg('Recebimento', 'Recebimento item 10').Feedback_Imediato || ''), '');
  eq(marcar('sl@x.com', 'Recebimento', 'Recebimento item 10', 'Sim').ok, true);
  eq(perg('Recebimento', 'Recebimento item 10').Feedback_Imediato, 'Sim');
  eq(marcar('sl@x.com', 'Recebimento', 'Recebimento item 9', 'Talvez').ok, false, 'valor fora de Sim/Não');
});
T('quem não pode configurar edita a pergunta sem perder a marcação (nem a vê)', () => {
  const o = perg('Recebimento', 'Recebimento item 10'); A.as('ana@x.com');
  const visto = A.call('listarCadastro', 'Cad_Processos_Perguntas').find((x) => x._row === o._row);
  ok(!('Feedback_Imediato' in visto), 'Analista não deveria receber a marcação');
  const r = A.call('salvarCadastro', 'Cad_Processos_Perguntas', Object.assign({}, visto, { Descricao_EN: 'Item ten' }), visto); eq(r.ok, true, JSON.stringify(r));
  eq(perg('Recebimento', 'Recebimento item 10').Feedback_Imediato, 'Sim', 'a marcação continua');
});
T('o auditor não vê a marcação (nem no formulário, nem na resposta ao salvar)', () => {
  A.as('aud1@x.com'); const b = A.call('bootstrap', false);
  ok(b.db.Cad_Processos_Perguntas.every((x) => !('Feedback_Imediato' in x)), 'o formulário do auditor recebeu a marcação');
  const r = auditar('Ana Souza'); eq(r.ok, true, JSON.stringify(r)); eq(Object.keys(r).sort(), ['id', 'ok', 'pct', 'status']);
});
T('uma não conformidade no item marcado gera na hora uma pendência a designar', () => {
  const n0 = pend().length; const r = auditar('Bruno Lima');
  const novas = pend().slice(n0); eq(novas.length, 1); eq(novas[0][2], 'Bruno Lima'); eq(novas[0][8], r.id); eq(novas[0][11], 'Aberta');
  ok(String(novas[0][1]).indexOf('IMED|') === 0);
});
T('item não conforme sem a marcação não gera feedback imediato', () => {
  const n0 = pend().length; eq(A.audit('aud1@x.com', 'Expedição', { conf: 9, nc: 1, f: { doca: '07', colaboradores: ['Carla Dias'] } }).ok, true); eq(pend().length, n0);
});
T('Site Leader vê o feedback imediato primeiro, marcado e com o motivo (a pergunta); Admin também', () => {
  const l = lista('sl@x.com'), p = l.pendencias.find((x) => x.colaborador === 'Bruno Lima');
  eq(p.imediato, true); eq(p.motivos.map((m) => m.desc), ['Recebimento item 10']);
  ok(l.pendencias.filter((x) => x.status === 'Aberta')[0].imediato, 'imediato deveria vir primeiro');
  ok(lista('owner@x.com').pendencias.some((x) => x.imediato));
  ok(l.pendencias.filter((x) => !x.imediato).every((x) => !(x.motivos || []).length));
});
T('a marcação vale como era na hora da auditoria (desmarcar depois não apaga o motivo)', () => {
  eq(marcar('sl@x.com', 'Recebimento', 'Recebimento item 10', 'Não').ok, true);
  const p = lista('sl@x.com').pendencias.find((x) => x.colaborador === 'Bruno Lima'); eq(p.motivos.map((m) => m.desc), ['Recebimento item 10']);
  const n0 = pend().length; auditar('Davi Reis'); eq(pend().length, n0, 'desmarcada: não gera mais');
  eq(marcar('sl@x.com', 'Recebimento', 'Recebimento item 10', 'Sim').ok, true);
});
T('designar e registrar seguem o fluxo normal; quem dá o feedback vê o motivo, mas não quem auditou', () => {
  const id = lista('sl@x.com').pendencias.find((x) => x.colaborador === 'Bruno Lima').id;
  eq(A.call('designarFeedback', id, 'aud2@x.com').ok, true);
  A.as('aud2@x.com'); const m = A.call('meusFeedbacks').find((x) => x.id === id);
  eq(m.imediato, true); eq(m.motivos.map((x) => x.desc), ['Recebimento item 10']); ok(!/aud1@x\.com|Audi Um/.test(JSON.stringify(m)), 'vazou quem auditou');
});
T('o gatilho normal continua: auditoria coberta pelo imediato não conta de novo', () => {
  A.as('owner@x.com'); const n = A.run('gerarPendenciasFeedback_()'); ok(n >= 0);
  const doBruno = pend().filter((p) => p[2] === 'Bruno Lima'); eq(doBruno.length, 1, 'não duplica a pendência do Bruno');
});
// revisão de segurança: outros caminhos do cadastro e a resposta de quem dá o feedback
const semMarca = (l) => (l || []).every((x) => !('Feedback_Imediato' in x));
T('Analista move e exclui pergunta marcada; nenhuma resposta do cadastro traz a marcação', () => {
  const visto = () => { A.as('ana@x.com'); return A.call('listarCadastro', 'Cad_Processos_Perguntas').find((x) => x.Processo === 'Recebimento' && x.Descricao_Item === 'Recebimento item 10'); };
  let o = visto(); let r = A.call('moverCadastro', 'Cad_Processos_Perguntas', o._row, o, -1);
  eq(r.ok, true, 'mover: ' + JSON.stringify(r).slice(0, 200)); ok(semMarca(r.linhas), 'mover devolveu a marcação');
  eq(perg('Recebimento', 'Recebimento item 10').Feedback_Imediato, 'Sim', 'mover não mexe na marcação');
  o = visto(); r = A.call('excluirCadastro', 'Cad_Processos_Perguntas', o._row, o);
  eq(r.ok, true, 'excluir: ' + JSON.stringify(r).slice(0, 200)); ok(semMarca(r.linhas), 'excluir devolveu a marcação');
  r = A.call('restaurarCadastro', 'Cad_Processos_Perguntas', o, o._row); eq(r.ok, true); ok(semMarca(r.linhas), 'restaurar devolveu a marcação');
  eq(marcar('sl@x.com', 'Recebimento', 'Recebimento item 10', 'Sim').ok, true); // a Analista restaura sem a marcação: o Site Leader marca de novo
});
T('quem dá o feedback recebe o motivo, mas não a etiqueta de quais itens são imediatos', () => {
  A.as('aud2@x.com'); const m = A.call('meusFeedbacks').find((x) => x.imediato);
  ok(m && m.motivos.length, 'sem o motivo'); ok(!/"imed"/.test(JSON.stringify(m.auditorias)), 'itens com a etiqueta imed');
});
fim('v10.9 feedback imediato');
