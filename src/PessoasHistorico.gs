/* ============================================================
   v10: histórico de time/turno, metas de auditoria por líder e feedback obrigatório.
   Fase 1 (este bloco): Pessoas_Historico, aba só de acréscimo.
   Cada criação, mudança de líder/turno/nome, exclusão, restauração, carga em massa e renomeação de líder gera uma linha.
   Nada é sobrescrito: o time e o turno da época continuam consultáveis depois que a pessoa muda.
   ============================================================ */

/** Colaborador de uma linha de cadastro, só com o que o histórico guarda. */
function histPessoa_(p) {
  return p ? { nome: String(p.Nome || ''), lider: String(p.Cargo === 'Líder' ? '' : (p.Lider || '')), turno: String(p.Turno || '') } : null;
}
/** Linha do histórico (sem a coluna Hub, que o carimbo central preenche). */
function histLinha_(a, evento, antes, depois) {
  const x = histPessoa_(antes), y = histPessoa_(depois), nome = (y || x).nome;
  return [agora_(), limpar_(nome), limpar_(evento), limpar_(x ? x.lider : ''), limpar_(y ? y.lider : ''), limpar_(x ? x.turno : ''), limpar_(y ? y.turno : ''), limpar_(a.nome + ' <' + a.email + '>')];
}
/** Mudança relevante para o histórico: nome, líder ou turno. Alterar só o status ou o cargo não gera linha. */
function histMudou_(antes, depois) {
  const x = histPessoa_(antes), y = histPessoa_(depois);
  return x.nome !== y.nome || x.lider !== y.lider || x.turno !== y.turno;
}
/**
 * Registra um evento do cadastro de pessoas. Chamado DENTRO do lock, antes de gravar o cadastro: se o histórico falhar, o cadastro não muda.
 * renomeadoDe: nome antigo do líder; os colaboradores dele ganham uma linha "Líder renomeado".
 */
function histCadastro_(a, evento, antes, depois, renomeadoDe) {
  const linhas = [];
  if (evento !== 'Alterado' || histMudou_(antes, depois)) linhas.push(histLinha_(a, evento, antes, depois));
  // pessoa renomeada: o nome antigo também ganha uma linha apontando para o novo, para o passado continuar ligado
  if (evento === 'Alterado' && antes.Nome !== depois.Nome) linhas.push(histLinha_(a, 'Renomeado para ' + depois.Nome, antes, antes));
  if (renomeadoDe) {
    lerDireto_('Cad_Pessoas').forEach(function (p) {
      if (p.Cargo === 'Colaborador' && p.Lider === renomeadoDe) linhas.push(histLinha_(a, 'Líder renomeado', p, { Nome: p.Nome, Cargo: p.Cargo, Turno: p.Turno, Lider: depois.Nome }));
    });
  }
  if (linhas.length) anexarLinhas_('Pessoas_Historico', linhas);
  return linhas;
}
/** A gravação do cadastro falhou depois do histórico: deixa uma marca "Revertido" para a linha anterior não parecer uma mudança que aconteceu. Best-effort. */
function histRevertido_(a, linhas, erro) {
  try {
    if (!linhas || !linhas.length) return;
    const motivo = String(erro && erro.message || erro).slice(0, 60);
    anexarLinhas_('Pessoas_Historico', linhas.map(function (l) { return [agora_(), l[1], limpar_('Revertido: ' + motivo), l[3], l[4], l[5], l[6], l[7]]; }));
  } catch (e) { console.error('Histórico não marcou a reversão: ' + e.message); contarFalhaLog_(); }
}
/** Carga em massa: toda pessoa nova entra no histórico como "Importado". */
function histLote_(a, objs) {
  const linhas = objs.map(function (o) { return histLinha_(a, 'Importado', null, o); });
  if (linhas.length) anexarLinhas_('Pessoas_Historico', linhas);
  return linhas;
}
/** Atualização para a v10 (idempotente): cria as abas novas, dá a permissão ao Site Leader e registra o estado atual das pessoas como ponto de partida do histórico. */
function migrarV10() {
  manutencao_();
  const ss = SpreadsheetApp.getActive(), rel = { abas: [] };
  ['Pessoas_Historico', 'Metas_Lider', 'Feedback_Pendencias', 'Feedback_Registros'].forEach(function (n) { garantirAba_(n); formatarTexto_(ss.getSheetByName(n), n); rel.abas.push(n); });
  const pf = aba_('Cad_Perfis'); rel.perfilSiteLeaderAtualizado = false;
  lerBruto_('Cad_Perfis').forEach(function (r) {
    if (r.Perfil !== 'Site Leader') return;
    const p = String(r.Permissoes || '').split(',').filter(Boolean);
    if (p.indexOf('obrigacoes') < 0) { pf.getRange(r._row, 3).setNumberFormat('@').setValue(p.concat(['obrigacoes']).join(',')); rel.perfilSiteLeaderAtualizado = true; }
  });
  comLock_(function () {
    const tem = {};
    lerBruto_('Pessoas_Historico').forEach(function (r) { tem[String(r.Hub) + '|' + r.Colaborador] = 1; });
    const novas = [], eu = { nome: 'Migração v10', email: 'sistema' };
    lerBruto_('Cad_Pessoas').forEach(function (p) {
      if (!String(p.Nome).trim() || tem[String(p.Hub === undefined ? '' : p.Hub) + '|' + p.Nome]) return;
      const l = histLinha_(eu, 'Estado inicial', null, p);
      novas.push(l.concat([String(p.Hub === undefined ? '' : p.Hub)]));
    });
    if (novas.length) {
      const s = aba_('Pessoas_Historico'), r = s.getLastRow() + 1;
      if (r + novas.length - 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + novas.length - 1 - s.getMaxRows());
      (TEXTO_COLS.Pessoas_Historico || []).forEach(function (c) { s.getRange(r, c, novas.length, 1).setNumberFormat('@'); });
      s.getRange(r, 1, novas.length, novas[0].length).setValues(novas);
    }
    rel.estadoInicial = novas.length;
  });
  limparCache_();
  return Object.assign({ ok: true }, rel);
}
