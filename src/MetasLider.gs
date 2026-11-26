/* ============================================================
   Metas de auditoria por líder (programar, cancelar, progresso, Minhas metas).
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ============================================================
   Fase 2: metas de auditoria por líder (Metas_Lider).
   Site Leader e Admin (permissão "obrigacoes", dados de todos os times) programam quais auditorias cada pessoa deve fazer e até quando.
   O progresso vem das auditorias finalizadas reais; cancelar nunca apaga a linha. O líder vê só as próprias metas.
   ============================================================ */
const META_LIDER_MAX_DESC = 200;
const META_LIDER_MAX_DIAS = 366;
const META_LIDER_JANELA = 400; // o prazo fica a até 400 dias de hoje (e o prazo vence hoje ou depois, com no máx. 366 dias de duração): o progresso nunca precisa cortar o período
const MAIL_RESERVA = 10;

/** Programar auditorias e feedbacks exige a permissão e dados completos: um perfil limitado a um turno não programa o que não enxerga. */
function exigirObrig_() {
  const a = exigirPerm_('obrigacoes');
  if (a.escopo.modo !== 'todos' || a.escopo.turnos.length || a.escopo.processos.length) throw new Error('Seu perfil não pode programar auditorias: ele enxerga só parte dos dados.');
  return a;
}
/** Quem pode receber meta: usuário ativo do Hub do ator, com permissão de auditar, que não seja o próprio ator. */
function responsaveisMeta_(a) {
  const pf = perfis_();
  return usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).filter(function (u) {
    const p = pf[String(u.Perfil).trim()];
    return usuarioAtivo_(u) && p && p.perms.indexOf('auditar') > -1 && emailDe_(u.Email_Google) !== a.email && (!a.hubOn || String(u.Hub || '').trim() === a.hub); // o Admin global também só programa para o Hub ativo
  });
}
function metaLiderOut_(r) {
  return { id: String(r.ID_Meta), email: emailDe_(r.Lider_Email), nome: String(r.Lider_Nome), times: listaRegra_(r.Times), turnos: listaRegra_(r.Turnos), cores: listaRegra_(r.Cores), processos: listaRegra_(r.Processos),
    qtd: Number(r.Quantidade), ini: String(r.Inicio), fim: String(r.Fim), desc: String(r.Descricao || ''), criadaPor: String(r.Criada_Por), criadaEm: String(r.Criada_Em),
    cancelada: String(r.Status) === 'Cancelada', canceladaPor: String(r.Cancelada_Por || ''), visto: String(r.Visto_Em || '') !== '', avisoPendente: avisoPendente_(r.Aviso_Em) && String(r.Status) === 'Ativa' };
}
/** Auditorias finalizadas do responsável que casam com o escopo da meta: período, processo, turno, cor/símbolo da doca e time (líder dono do colaborador). */
function progressoMetasLider_(metas, hoje) {
  const out = {};
  if (!metas.length) return out;
  let de = metas.reduce(function (x, m) { return m.ini < x ? m.ini : x; }, metas[0].ini), ate = metas.reduce(function (x, m) { return m.fim > x ? m.fim : x; }, hoje);
  if (difDias_(de, ate) > MAX_PERIODO_DIAS * 2) de = addDias_(ate, -MAX_PERIODO_DIAS * 2);
  const rows = lerHist_(de, ate, false), colabs = lerColabs_(de, ate), corDe = {};
  lerAba_('Cad_Estrutura').forEach(function (e) { corDe[String(e.Identificador)] = canonCS_(e.Cor_Simbolo); });
  metas.forEach(function (m) {
    const nome = semAcento_(m.nome), times = m.times.map(semAcento_);
    out[m.id] = rows.filter(function (r) {
      const d = r.ts.slice(0, 10);
      if (d < m.ini || d > m.fim) return false;
      if (!(r.email ? r.email === m.email : semAcento_(r.resp) === nome)) return false;
      if (m.processos.length && m.processos.indexOf(r.proc) < 0) return false;
      if (m.turnos.length && m.turnos.indexOf(r.turno) < 0) return false;
      if (m.cores.length && m.cores.indexOf(corDe[r.doca] || '') < 0) return false;
      if (times.length) {
        const ls = (colabs[r.id] || []).map(function (c) { return c.l; }).concat(String(r.lider).split(';')).map(semAcento_).filter(Boolean);
        if (!ls.some(function (l) { return times.indexOf(l) > -1; })) return false;
      }
      return true;
    }).length;
  });
  return out;
}
function metaLiderStatus_(m, feito, hoje) { return m.cancelada ? 'cancelada' : statusMeta_(feito, m.qtd, m.ini, m.fim, hoje); }
function metasLiderComProgresso_(linhas, hoje) {
  const metas = linhas.map(metaLiderOut_), prog = progressoMetasLider_(metas.filter(function (m) { return !m.cancelada; }), hoje);
  return metas.map(function (m) { m.feito = prog[m.id] || 0; m.status = metaLiderStatus_(m, m.feito, hoje); return m; });
}
function listarMetasLider() {
  const a = exigirObrig_(), hoje = hoje_(), cores = {};
  lerAba_('Cad_Estrutura').forEach(function (e) { const c = canonCS_(e.Cor_Simbolo); if (c) cores[c] = 1; });
  const linhas = lerDireto_('Metas_Lider').filter(function (r) { return String(r.Fim) >= addDias_(hoje, -90); });
  return {
    ok: true, hoje: hoje, metas: metasLiderComProgresso_(linhas, hoje),
    responsaveis: responsaveisMeta_(a).map(function (u) { return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil) }; }),
    times: lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return String(p.Nome); }),
    turnos: TURNOS, processos: PROCESSOS, cores: Object.keys(cores).sort()
  };
}
function salvarMetaLider(obj) {
  const a = exigirObrig_(), o = obj || {}, erros = {};
  const email = emailDe_(o.email), qtd = (typeof o.qtd === 'number' || /^\d{1,4}$/.test(String(o.qtd).trim())) ? Number(o.qtd) : NaN, desc = String(o.desc == null ? '' : o.desc).trim();
  const cores = {}; lerAba_('Cad_Estrutura').forEach(function (e) { const c = canonCS_(e.Cor_Simbolo); if (c) cores[c] = 1; });
  const lids = lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return String(p.Nome); });
  const times = listaTexto_(o.times, lids, 100), turnos = listaTexto_(o.turnos, TURNOS, TURNOS.length), cs = listaTexto_(o.cores, Object.keys(cores), 200), procs = listaTexto_(o.processos, PROCESSOS, PROCESSOS.length);
  if (times === null) erros.times = 'Time inválido.';
  if (turnos === null) erros.turnos = 'Turno inválido.';
  if (cs === null) erros.cores = 'Cor ou símbolo inválido.';
  if (procs === null) erros.processos = 'Processo inválido.';
  if (vazio_(o.qtd) || isNaN(qtd) || qtd < 1 || qtd > 9999 || Math.floor(qtd) !== qtd) erros.qtd = 'Informe um número inteiro entre 1 e 9999.';
  const dataOk = function (x) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x))) return false; const d = new Date(x + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === x; };
  const hoje = hoje_();
  if (!dataOk(o.ini)) erros.ini = 'Informe a data inicial.';
  if (!dataOk(o.fim)) erros.fim = 'Informe a data final.';
  if (!erros.ini && !erros.fim) {
    if (String(o.ini) > String(o.fim)) erros.fim = 'A data final deve ser igual ou posterior à inicial.';
    else if (String(o.fim) < hoje) erros.fim = 'O prazo não pode estar no passado.';
    else if (difDias_(o.ini, o.fim) > META_LIDER_MAX_DIAS) erros.fim = 'Prazo máximo de ' + META_LIDER_MAX_DIAS + ' dias.';
    else if (String(o.fim) > addDias_(hoje, META_LIDER_JANELA)) erros.fim = 'O prazo está longe demais. Confira o ano.';
  }
  if (desc.length > META_LIDER_MAX_DESC) erros.desc = 'Máximo de ' + META_LIDER_MAX_DESC + ' caracteres.';
  if (/^[=+\-@]/.test(desc) || /[<>]/.test(desc)) erros.desc = 'Não use < > nem iniciar com = + - @.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  let linhaN = 0, linha;
  const r = comLock_(function () {
    const resp = responsaveisMeta_(a).find(function (u) { return emailDe_(u.Email_Google) === email; });
    if (!resp) return { ok: false, erros: { email: 'Usuário ativo com permissão de auditar não encontrado neste Hub (e não pode ser você).' } };
    const pf = perfis_()[String(resp.Perfil).trim()];
    if (pf && pf.escopo.modo === 'time') {
      const regra = regraDe_(email, true);
      if (!regra.ok || (!regra.proprio && !regra.outros)) return { ok: false, erros: { email: 'A regra de auditoria deste líder não permite que ele audite. Ajuste a regra antes de programar a meta.' } };
    }
    const dup = lerDireto_('Metas_Lider').some(function (m) { return String(m.Status) === 'Ativa' && emailDe_(m.Lider_Email) === email && String(m.Inicio) === o.ini && String(m.Fim) === o.fim && Number(m.Quantidade) === qtd && String(m.Times) === (times || []).join('|') && String(m.Turnos) === (turnos || []).join('|') && String(m.Cores) === (cs || []).join('|') && String(m.Processos) === (procs || []).join('|'); });
    if (dup) return { ok: false, erros: { email: 'Já existe uma meta ativa idêntica para esta pessoa.' } };
    linha = ['MTL-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000), email, limpar_(String(resp.Nome)), (times || []).join('|'), (turnos || []).join('|'), (cs || []).join('|'), (procs || []).join('|'), qtd, o.ini, o.fim, limpar_(desc), limpar_(a.email), agora_(), 'Ativa', '', '', '', ''];
    linhaN = anexar_('Metas_Lider', linha);
    try { registrar_(a, 'Meta de auditoria programada', email, qtd + ' auditoria(s) até ' + o.fim + (linha[6] ? ' em ' + linha[6] : '')); } catch (e) { falhaLog_('programar meta', e); desfazer_(function () { aba_('Metas_Lider').deleteRow(linhaN); }); throw new Error('Não foi possível registrar a meta no log; nada foi salvo. Tente de novo.'); }
    limparCache_();
    return { ok: true };
  });
  if (!r.ok) return r;
  const env = avisarMetaLider_(linhaN, linha[0], email, linha[8], linha[9], qtd);
  // a meta já está gravada: se a releitura da lista falhar, o cliente recarrega sozinho (nunca pede para repetir a operação)
  try { return Object.assign(listarMetasLider(), { ok: true, id: linha[0], emailEnviado: env }); } catch (e) { falhaLog_('listar após programar', e); return { ok: true, id: linha[0], emailEnviado: env, recarregar: true }; }
}
function cancelarMetaLider(id) {
  const a = exigirObrig_();
  const r = comLock_(function () {
    const ex = lerDireto_('Metas_Lider').find(function (r) { return String(r.ID_Meta) === String(id); });
    if (!ex || String(ex.Status) !== 'Ativa') return { ok: false, msg: 'Meta não encontrada ou já cancelada. Atualize a tela.' };
    const s = aba_('Metas_Lider'), antes = s.getRange(ex._row, 14, 1, 3).getValues();
    s.getRange(ex._row, 14, 1, 3).setValues([['Cancelada', limpar_(a.email), agora_()]]);
    try { registrar_(a, 'Meta de auditoria cancelada', emailDe_(ex.Lider_Email), String(ex.ID_Meta)); } catch (e) { falhaLog_('cancelar meta', e); desfazer_(function () { s.getRange(ex._row, 14, 1, 3).setValues(antes); }); throw new Error('Não foi possível registrar o cancelamento no log; nada foi alterado. Tente de novo.'); }
    limparCache_();
    return { ok: true };
  });
  if (!r.ok) return r;
  try { return Object.assign(listarMetasLider(), { ok: true }); } catch (e) { falhaLog_('listar após cancelar', e); return { ok: true, recarregar: true }; } // leitura pesada fora do lock
}
/** A causa nunca se perde: vai para o console e para o contador de falhas da tela de Log. */
function falhaLog_(onde, e) { console.error('Falha em ' + onde + ': ' + (e && e.message || e)); contarFalhaLog_(); }
/** Reversão protegida: se ela mesma falhar, fica registrado (e o cache nunca guarda linha fantasma). */
function desfazer_(fn) { for (let i = 0; i < 2; i++) { try { fn(); break; } catch (e) { falhaLog_('reversão (tentativa ' + (i + 1) + ')', e); } } limparCache_(); }

/* ---- lado do líder (e de qualquer pessoa que audita): só as próprias metas ---- */
/** Metas ativas ainda não abertas e dentro da janela que Minhas metas exibe (a mesma regra nas duas pontas: o selo nunca fica preso). */
function metasNaoVistas_(a, hoje) {
  const lim = addDias_(hoje, -30);
  return lerDireto_('Metas_Lider').filter(function (r) { return emailDe_(r.Lider_Email) === a.email && String(r.Status) === 'Ativa' && String(r.Visto_Em || '') === '' && String(r.Fim) >= lim; });
}
/** Contadores do menu ficam 10 min em cache: a chave tem a versão dos dados (toda gravação troca), então não ficam velhos depois de uma mudança. */
const CONTADOR_SEG = 600;
/** Contador por usuário: chave com a versão dos dados (limparCache_ troca a versão), para não reler a planilha a cada consulta. */
function contarMetasNovas_(a) {
  const c = CacheService.getScriptCache(), k = 'mn:' + hv_() + ':' + (a.hub || '') + ':' + a.email, v = c.get(k);
  if (v !== null && v !== undefined) return Number(v);
  const n = metasNaoVistas_(a, hoje_()).length;
  try { c.put(k, String(n), CONTADOR_SEG); } catch (e) { /* sem cache */ }
  return n;
}
/** Zera só os contadores em cache do próprio usuário (marcar como visto não muda dado que outros leiam). */
function limparContadores_(a) {
  try { const c = CacheService.getScriptCache(), b = ':' + hv_() + ':' + (a.hub || '') + ':' + a.email; c.remove('mn' + b); c.remove('fb' + b); } catch (e) { /* expira em 120 s */ }
}
function contarMetasNovas() { return contarMetasNovas_(exigirTela_('minhas')); }
function minhasMetasLider() {
  const a = exigirTela_('minhas'), hoje = hoje_();
  const linhas = lerDireto_('Metas_Lider').filter(function (r) { return emailDe_(r.Lider_Email) === a.email && String(r.Status) === 'Ativa' && String(r.Fim) >= addDias_(hoje, -30); });
  return metasLiderComProgresso_(linhas, hoje).map(function (m) { return { id: m.id, qtd: m.qtd, ini: m.ini, fim: m.fim, desc: m.desc, times: m.times, turnos: m.turnos, cores: m.cores, processos: m.processos, criadaPor: m.criadaPor, feito: m.feito, status: m.status, nova: !m.visto }; });
}
/** Zera o contador: marca como vistas só as metas do próprio usuário (nenhum id vem do navegador). */
function marcarMetasVistas() {
  const a = exigirTela_('minhas');
  return comLock_(function () {
    const s = aba_('Metas_Lider'), novas = metasNaoVistas_(a, hoje_());
    novas.forEach(function (r) { s.getRange(r._row, 17).setNumberFormat('@').setValue(agora_()); });
    if (novas.length) limparContadores_(a);
    return { ok: true, vistas: novas.length };
  });
}
