/* ============================================================
   Metas gerais por perfil e progresso.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ---------- metas ---------- */
function statusMeta_(feito, qtd, ini, fim, hoje) {
  if (feito >= qtd) return 'atingida';
  if (hoje < ini) return 'futura';
  if (hoje > fim) return 'nao_atingida';
  const total = difDias_(ini, fim) + 1, dec = difDias_(ini, hoje) + 1, esperado = qtd * dec / total;
  return feito >= esperado * 0.8 ? 'no_ritmo' : 'em_risco';
}
function metaOut_(m) {
  return { id: m.ID_Meta, tipo: m.Tipo_Alvo, alvo: m.Alvo, qtd: Number(m.Quantidade), processos: String(m.Processos || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean), ini: String(m.Inicio), fim: String(m.Fim), desc: m.Descricao, criadaPor: m.Criada_Por, criadaEm: m.Criada_Em, ativa: String(m.Ativa) !== 'Não' };
}
/** Só auditorias FINALIZADAS contam (rascunho não está no histórico). Conta por auditor, no período e nos processos da meta. */
function contarMeta_(rows, m, user) {
  const nome = semAcento_(user.nome);
  return rows.filter(function (r) {
    const d = r.ts.slice(0, 10);
    if (d < m.ini || d > m.fim) return false;
    if (m.processos.length && m.processos.indexOf(r.proc) < 0) return false;
    return r.email ? r.email === user.email : semAcento_(r.resp) === nome;
  }).length;
}
function alvosMeta_(m, users) {
  return users.filter(function (u) { return m.tipo === 'Pessoa' ? String(u.Email_Google).trim().toLowerCase() === String(m.alvo).trim().toLowerCase() : u.Perfil === m.alvo; })
    .map(function (u) { return { email: String(u.Email_Google).trim().toLowerCase(), nome: String(u.Nome) }; });
}
function metasProgresso_(a, hoje, users) {
  const metas = lerDireto_('Metas').map(metaOut_).filter(function (m) { return m.fim >= addDias_(hoje, -90); });
  if (!metas.length) return [];
  const de = metas.reduce(function (x, m) { return m.ini < x ? m.ini : x; }, metas[0].ini), ate = metas.reduce(function (x, m) { return m.fim > x ? m.fim : x; }, metas[0].fim);
  const lim = { de: de, ate: ate > hoje ? ate : hoje, processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '' };
  if ((difDias_(lim.de, lim.ate)) > MAX_PERIODO_DIAS * 2) lim.de = addDias_(lim.ate, -MAX_PERIODO_DIAS * 2);
  const rows = auditorias_(a, lim, false);
  return metas.map(function (m) {
    m.alvos = alvosMeta_(m, users).map(function (u) { const feito = contarMeta_(rows, m, { email: u.email, nome: u.nome }); return { email: u.email, nome: u.nome, feito: feito, status: m.ativa ? statusMeta_(feito, m.qtd, m.ini, m.fim, hoje) : 'inativa' }; });
    return m;
  });
}
function minhasMetas() {
  const a = exigirTela_('minhas'), hoje = hoje_(), proprio = Object.assign({}, a, { escopo: { modo: 'proprias', processos: [], turnos: [] } });
  const metas = lerDireto_('Metas').map(metaOut_).filter(function (m) {
    return m.ativa && m.fim >= addDias_(hoje, -30) && ((m.tipo === 'Pessoa' && String(m.alvo).trim().toLowerCase() === a.email) || (m.tipo === 'Perfil' && m.alvo === a.perfil));
  });
  if (!metas.length) return [];
  const de = metas.reduce(function (x, m) { return m.ini < x ? m.ini : x; }, metas[0].ini);
  const rows = auditorias_(proprio, { de: de, ate: hoje > metas[0].fim ? hoje : metas.reduce(function (x, m) { return m.fim > x ? m.fim : x; }, hoje), processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '' }, false);
  return metas.map(function (m) { const feito = contarMeta_(rows, m, a); m.feito = feito; m.status = statusMeta_(feito, m.qtd, m.ini, m.fim, hoje); return m; });
}
function salvarMeta(obj) {
  const a = exigirPerm_('metas'), erros = {}, o = obj || {};
  const pf = perfis_(), users = usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).filter(ativo_);
  const tipo = String(o.tipo || '').trim(), alvo = String(o.alvo || '').trim().toLowerCase() === '' ? '' : String(o.alvo).trim();
  const qtd = Number(o.qtd);
  if (['Pessoa', 'Perfil'].indexOf(tipo) < 0) erros.tipo = 'Escolha pessoa ou perfil.';
  else if (!alvo) erros.alvo = 'Selecione para quem é a meta.';
  else if (tipo === 'Pessoa' && !users.some(function (u) { return String(u.Email_Google).trim().toLowerCase() === alvo.toLowerCase() && pf[u.Perfil] && tem_({ perms: pf[u.Perfil].perms }, 'auditar'); })) erros.alvo = 'Usuário ativo com permissão de auditar não encontrado.';
  else if (tipo === 'Perfil' && !(pf[alvo] && pf[alvo].perms.indexOf('auditar') > -1)) erros.alvo = 'Perfil inexistente ou sem permissão de auditar.';
  if (vazio_(o.qtd) || isNaN(qtd) || qtd < 1 || qtd > 9999 || Math.floor(qtd) !== qtd) erros.qtd = 'Informe um número inteiro entre 1 e 9999.';
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const dataOk = function (x) { if (!re.test(String(x))) return false; const d = new Date(x + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === x; };
  if (!dataOk(o.ini)) erros.ini = 'Informe a data inicial.';
  if (!dataOk(o.fim)) erros.fim = 'Informe a data final.';
  if (!erros.ini && !erros.fim && String(o.ini) > String(o.fim)) erros.fim = 'A data final deve ser igual ou posterior à inicial.';
  const procs = (Array.isArray(o.processos) ? o.processos : []).map(String);
  if (procs.some(function (p) { return PROCESSOS.indexOf(p) < 0; })) erros.processos = 'Processo inválido.';
  const desc = String(o.desc || '').trim();
  if (desc.length > 200) erros.desc = 'Máximo de 200 caracteres.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  return comLock_(function () {
    const s = aba_('Metas'), linha = [null, tipo, tipo === 'Pessoa' ? alvo.toLowerCase() : alvo, qtd, procs.join(','), o.ini, o.fim, limpar_(desc), limpar_(a.nome), agora_(), o.ativa === false ? 'Não' : 'Sim'];
    if (o.id) {
      const ex = lerDireto_('Metas').find(function (m) { return m.ID_Meta === String(o.id); });
      if (!ex) return { ok: false, msg: 'Meta não encontrada. Atualize a tela.' };
      linha[0] = ex.ID_Meta; linha[8] = ex.Criada_Por; linha[9] = ex.Criada_Em;
      (TEXTO_COLS.Metas || []).forEach(function (c) { s.getRange(ex._row, c).setNumberFormat('@'); });
      s.getRange(ex._row, 1, 1, linha.length).setValues([linha]);
    } else { linha[0] = 'MET-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000); anexar_('Metas', linha); }
    logAtiv_(a, o.id ? 'Meta alterada' : 'Meta criada', linha[0], tipo + ' ' + linha[2] + ': ' + qtd);
    bumpHv_();
    return { ok: true, metas: metasProgresso_(a, hoje_(), usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).filter(ativo_)) };
  });
}
function excluirMeta(id) {
  const a = exigirPerm_('metas');
  return comLock_(function () {
    const ex = lerDireto_('Metas').find(function (m) { return m.ID_Meta === String(id); });
    if (!ex) return { ok: false, msg: 'Meta não encontrada. Atualize a tela.' };
    aba_('Metas').deleteRow(ex._row);
    logAtiv_(a, 'Meta excluída', ex.ID_Meta, '');
    bumpHv_();
    return { ok: true, metas: metasProgresso_(a, hoje_(), usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).filter(ativo_)) };
  });
}
