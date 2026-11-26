/* ============================================================
   Auditoria: rascunhos, gravação da auditoria e Matriz.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ---------- rascunhos ---------- */
function rascunhoValido_(r) { return d_(r.Timestamp_Inicio).getTime() >= Date.now() - RASCUNHO_DIAS * 864e5; }
function getRascunho(processo, chave) {
  const u = exigirPerm_('auditar');
  if (!procPermitido_(u, processo)) throw new Error('Sem acesso a este processo.');
  const r = localizarRascunhos_(u.email, processo, chave).filter(rascunhoValido_)[0];
  if (!r) return null;
  // sem trava: a linha pode ter descido entre achar e ler (outro auditor finalizou). Lê a linha inteira e confere de quem é.
  const l = aba_('Auditorias_Rascunho').getRange(r._row, 1, 1, COL_JSON_RASCUNHO).getValues()[0];
  return String(l[0]) === r.ID_Rascunho && emailDe_(l[2]) === u.email ? jsonSeguro_(l[COL_JSON_RASCUNHO - 1]) : null;
}
const COL_JSON_RASCUNHO = 6;
/**
 * Rascunhos do auditor para processo + chave, lendo só as colunas de chave (A a E) e a do Hub: nunca o JSON das respostas,
 * que pode ter dezenas de KB por linha. Respeita o isolamento por Hub (sem Hub ativo, nada).
 */
function localizarRascunhos_(email, processo, chave) {
  const s = aba_('Auditorias_Rascunho'), n = s.getLastRow() - 1, iso = hubsAtivos_(), h = hubAtual_();
  if (n < 1 || (iso && !h)) return [];
  const v = s.getRange(2, 1, n, 5).getValues(), hv = iso ? s.getRange(2, HUB_ABAS.Auditorias_Rascunho, n, 1).getValues() : null, out = [];
  v.forEach(function (l, i) {
    if (emailDe_(l[2]) === emailDe_(email) && String(l[3]) === String(processo) && String(l[4]) === String(chave) && (!iso || String(hv[i][0]).trim() === h)) {
      out.push({ _row: i + 2, ID_Rascunho: String(l[0]), Timestamp_Inicio: tsStr_(l[1]) });
    }
  });
  return out;
}
/** Rascunho com JSON corrompido vira "sem rascunho" em vez de erro técnico. */
function jsonSeguro_(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function getRascunhoLider(lider) {
  const u = exigirPerm_('auditar');
  if (!procPermitido_(u, 'Indução')) return null;
  const r = lerDireto_('Auditorias_Rascunho').filter(function (x) {
    return String(x.Auditor_Email).toLowerCase() === u.email && x.Processo === 'Indução' && rascunhoValido_(x) && liderDoRascunho_(x) === lider;
  }).sort(function (x, y) { return String(y.Timestamp_Inicio).localeCompare(String(x.Timestamp_Inicio)); })[0];
  const est = r ? jsonSeguro_(r.Json_Respostas_Parciais) : null;
  return est ? { chave: r.Doca_Cluster, estado: est } : null;
}
function salvarRascunho(p) {
  const u = exigirPerm_('auditar');
  if (!p || PROCESSOS.indexOf(p.processo) < 0 || vazio_(p.chave) || String(p.chave).length > 120) throw new Error('Rascunho inválido.');
  if (!procPermitido_(u, p.processo)) throw new Error('Sem acesso a este processo.');
  const json = JSON.stringify(p.estado == null ? {} : p.estado);
  if (json.length > 40000) throw new Error('Rascunho grande demais.');
  const chave = limpar_(String(p.chave));
  return comLock_(function () {
    const s = aba_('Auditorias_Rascunho'), ex = localizarRascunhos_(u.email, p.processo, chave)[0];
    if (ex) {
      if (!rascunhoValido_(ex)) s.getRange(ex._row, 2).setValue(agora_());
      s.getRange(ex._row, COL_JSON_RASCUNHO).setValue(json);
      return ex.ID_Rascunho;
    }
    const id = 'RAS-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
    anexar_('Auditorias_Rascunho', [id, agora_(), u.email, p.processo, chave, json]);
    return id;
  });
}
function descartarRascunho(processo, chave) {
  const u = exigirPerm_('auditar');
  comLock_(function () { removerRascunhos_(u.email, processo, chave); });
  return true;
}
function removerRascunhos_(email, processo, chave) {
  const s = aba_('Auditorias_Rascunho');
  localizarRascunhos_(email, processo, chave).map(function (x) { return x._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { s.deleteRow(r); });
}

/* ---------- auditoria ---------- */
/** Por quanto tempo o servidor lembra de um formulário já gravado (máximo do CacheService: 6 h). */
const AUD_REENVIO_SEG = 21600;
const MSG_ITENS_MUDARAM = 'Os itens deste processo mudaram desde que o formulário foi aberto. Atualize a tela e responda de novo.';
/** A auditoria passou da vida útil? Compara o tempo exato (antes arredondava para baixo e dava quase um dia a mais). */
function vencida_(ts, agoraMs, dias) { return (agoraMs - d_(ts).getTime()) / 864e5 > dias; }
function salvarAuditoria(p) { return medir_('salvarAuditoria', salvarAuditoriaCore_, arguments); }
function salvarAuditoriaCore_(p) {
  const u = exigirPerm_('auditar'), cfg = config_(), erros = {};
  if (!p || PROCESSOS.indexOf(p.processo) < 0) return { ok: false, erros: { processo: 'Selecione o processo.' } };
  if (!procPermitido_(u, p.processo)) return { ok: false, erros: { processo: 'Seu perfil não pode auditar este processo.' } };
  const tipo = TIPO_PROC[p.processo], multi = !!cfg.MULTI[p.processo];
  let docaCS = '';
  let doca = String(p.doca || '').trim(), lider = String(p.lider || '').trim(), turno = String(p.turno || '').trim();
  let nomes = Array.isArray(p.colaboradores) ? p.colaboradores : (vazio_(p.colaborador) ? [] : [p.colaborador]);
  nomes = nomes.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
  const pessoas = lerAba_('Cad_Pessoas').filter(ativo_);
  if (tipo) {
    if (!doca) erros.doca = 'Selecione ' + (tipo === 'Doca' ? 'a doca' : 'o cluster') + '.';
    else {
      const est = lerAba_('Cad_Estrutura').find(function (e) { return e.Tipo === tipo && String(e.Identificador) === doca; });
      if (!est) erros.doca = (tipo === 'Doca' ? 'Doca não cadastrada.' : 'Cluster não cadastrado.');
      else docaCS = canonCS_(est.Cor_Simbolo);
    }
  } else doca = '';
  const unicos = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
  if (unicos.length !== nomes.length) erros.colaborador = 'Colaborador repetido na lista.';
  else if (nomes.length > 1 && !multi) erros.colaborador = 'Este processo permite apenas um colaborador por auditoria.';
  else if (nomes.length > MAX_COLAB) erros.colaborador = 'No máximo ' + MAX_COLAB + ' colaboradores por auditoria.';
  const linhasColab = [];
  if (!erros.colaborador) {
    nomes.forEach(function (n) {
      const pe = pessoas.find(function (x) { return x.Cargo === 'Colaborador' && x.Nome === n; });
      if (!pe) { erros.colaborador = 'Colaborador não cadastrado ou inativo: ' + n + '.'; return; }
      linhasColab.push({ n: pe.Nome, l: String(pe.Lider || ''), t: String(pe.Turno || '') });
    });
  }
  if (u.escopo.modo === 'time') {
    // sem colaborador (doca/cluster), a auditoria fica no nome do líder; quem ele pode auditar é decidido pela regra dele (negarAuditoria_, mais abaixo)
    const eu = semAcento_(u.nome);
    if (!linhasColab.length) { const ld = pessoas.find(function (x) { return x.Cargo === 'Líder' && semAcento_(x.Nome) === eu; }); lider = ld ? ld.Nome : u.nome; }
  }
  if (!linhasColab.length && lider && !erros.lider) {
    const ldc = pessoas.find(function (x) { return x.Cargo === 'Líder' && semAcento_(x.Nome) === semAcento_(lider); });
    if (ldc) lider = ldc.Nome; else erros.lider = 'Líder não cadastrado ou inativo: ' + lider.slice(0, 60) + '.';
  }
  if (!erros.colaborador && !tipo && !linhasColab.length) erros.colaborador = 'Selecione o colaborador.';
  if (!erros.colaborador && linhasColab.length) {
    const ls = linhasColab.map(function (c) { return c.l; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    const ts = linhasColab.map(function (c) { return c.t; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (ls.length) lider = ls.join('; ');
    if (ts.length === 1) turno = ts[0];
    else if (ts.length > 1 && TURNOS.indexOf(turno) < 0) erros.turno = 'Os colaboradores são de turnos diferentes. Selecione o turno da auditoria.';
  }
  if (!tipo && !erros.colaborador && !lider) erros.lider = 'Líder não identificado. Cadastre o líder deste colaborador.';
  if (!erros.turno && TURNOS.indexOf(turno) < 0) erros.turno = 'Selecione o turno.';
  if (!erros.turno && u.escopo.turnos.length && u.escopo.turnos.indexOf(turno) < 0) erros.turno = 'Seu perfil só pode auditar o(s) turno(s): ' + u.escopo.turnos.join(', ') + '.';
  const homonimo = pessoas.filter(function (x) { return x.Cargo === 'Líder' && semAcento_(x.Nome) === semAcento_(u.nome); }).length > 1;
  const alvoRegra = { processo: p.processo, turno: turno, cs: docaCS, doca: !!doca, homonimo: homonimo, colabs: linhasColab.map(function (c) { return { n: c.n, l: c.l, t: c.t }; }) };
  if (u.escopo.modo === 'time' && !erros.colaborador && !erros.turno && !erros.doca) {
    const neg = negarAuditoria_(u, regraDe_(u.email, true), alvoRegra);
    if (neg) erros[neg.campo] = neg.msg;
  }
  const obs = String(p.observacoes || '').trim();
  if (obs.length > 500) erros.obs = 'Máximo de 500 caracteres.';
  const perg = lerAba_('Cad_Processos_Perguntas').filter(function (x) { return x.Processo === p.processo; });
  const mapa = {}, idResp = {};
  (Array.isArray(p.respostas) ? p.respostas : []).forEach(function (r) { if (r) { mapa[String(r.k)] = r.ok; if (r.id !== undefined && r.id !== null) idResp[String(r.k)] = String(r.id); } });
  // a resposta vem pela linha do item: se o item foi movido, restaurado ou excluído depois de abrir o formulário, a linha é de outro item
  if (perg.some(function (x) { const k = String(x._row); return k in idResp && idResp[k] !== String(x.ID_Subprocesso); })) erros.itens = MSG_ITENS_MUDARAM;
  const faltam = perg.filter(function (x) { const k = String(x._row); return !(k in mapa) || [true, false, null].indexOf(mapa[k]) < 0; });
  if (!perg.length) erros.itens = 'Não há itens cadastrados para este processo.';
  else if (faltam.length) erros.itens = 'Responda todos os itens (' + faltam.length + ' pendente' + (faltam.length > 1 ? 's' : '') + ').';
  // imed: a marcação de feedback imediato como era na hora (só aparece nos itens marcados)
  const detalhes = perg.map(function (x) { const d = { k: x._row, id: x.ID_Subprocesso, desc: x.Descricao_Item, critico: x.Requisito_Critico === 'Sim', ok: mapa[String(x._row)] }; if (String(x.Feedback_Imediato).trim() === 'Sim') d.imed = true; return d; });
  const av = detalhes.filter(function (r) { return r.ok === true || r.ok === false; });
  if (!erros.itens && !av.length) erros.itens = 'Avalie ao menos um item (nem tudo pode ser N/A).';
  if (Object.keys(erros).length) return { ok: false, erros: erros, faltam: faltam.map(function (x) { return x._row; }) };
  const conf = av.filter(function (r) { return r.ok; }).length;
  const pct = Math.round(conf / av.length * 1000) / 10;
  const status = STATUS_TXT[faixa_(pct, cfg)];
  const agora = new Date();
  const novoId = function () { return 'AUD-' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 90000 + 10000); };
  let id = novoId();
  const nc = av.filter(function (r) { return !r.ok; }).map(function (r) { return String(r.id).replace(/\|/g, '/'); }).join('|');
  const resumoColab = linhasColab.map(function (c) { return c.n; }).join('; ');
  const cid = typeof p.clientId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(p.clientId) ? p.clientId : '';
  const chaveCid = cid ? 'audcid:' + u.email + ':' + cid : '';
  // impressão do conteúdo: o mesmo formulário reenviado com outra doca, colaborador ou respostas é uma auditoria nova, não repetição
  const impressao = cid ? sha_(JSON.stringify([p.processo, doca, nomes, lider, turno, obs, Object.keys(mapa).sort().map(function (k) { return [k, mapa[k]]; })])) : '';
  let negadoNoLock = null, repetida = null;
  comLock_(function () {
    // reenvio do mesmo formulário (rede caiu, erro depois de gravar): devolve a auditoria já gravada em vez de duplicar
    if (chaveCid) { const ja = jsonSeguro_(CacheService.getScriptCache().get(chaveCid)); if (ja && ja.imp === impressao) { repetida = ja; return; } }
    // a regra pode ter mudado entre a validação e a gravação: confere de novo, já com a trava
    negadoNoLock = u.escopo.modo === 'time' ? negarAuditoria_(u, regraDe_(u.email, true), alvoRegra) : null;
    // os itens foram lidos do cache (até 2 min): confere com a planilha, já com a trava, que cada linha ainda é o mesmo item
    if (!negadoNoLock) {
      const idAgora = {}; lerDireto_('Cad_Processos_Perguntas').forEach(function (x) { idAgora[x._row] = String(x.ID_Subprocesso); });
      if (detalhes.some(function (d) { return idAgora[d.k] !== String(d.id); })) negadoNoLock = { campo: 'itens', msg: MSG_ITENS_MUDARAM };
    }
    if (negadoNoLock) return;
    prepararHist_();
    // garante ID único: confere as últimas linhas (mesmo segundo) antes de gravar
    const sh = aba_('Auditorias_Historico'), nh = sh.getLastRow() - 1;
    if (nh > 0) { const ini = Math.max(2, nh + 2 - 199), rec = sh.getRange(ini, 1, nh + 2 - ini, 1).getValues().map(function (r) { return String(r[0]); }); for (let t = 0; rec.indexOf(id) > -1 && t < 20; t++) id = novoId(); }
    // colaboradores primeiro: se falhar no meio, não fica auditoria sem a lista de colaboradores
    if (linhasColab.length) anexarLinhas_('Auditorias_Colaboradores', linhasColab.map(function (c) { return [id, limpar_(c.n), limpar_(c.l), c.t]; }));
    anexar_('Auditorias_Historico', [id, fmt_(agora), p.processo, doca, limpar_(resumoColab), limpar_(lider), turno, limpar_(u.nome), pct, status, limpar_(obs), JSON.stringify(detalhes), u.email, limpar_(nc), av.some(function (r) { return !r.ok && r.critico; }) ? 'S' : 'N']);
    if (chaveCid) { try { CacheService.getScriptCache().put(chaveCid, JSON.stringify({ id: id, pct: pct, status: status, imp: impressao }), AUD_REENVIO_SEG); } catch (e) { falhaLog_('guardar chave de reenvio da auditoria', e); } }
    // a auditoria já está gravada: nada daqui para baixo pode virar erro para o usuário (ele tentaria de novo e duplicaria)
    try { CacheService.getScriptCache().removeAll(['ult:h', 'ult:s']); bumpHv_(); } catch (e) { falhaLog_('cache após auditoria', e); }
    try { removerRascunhos_(u.email, p.processo, chaveRascunho_(p.processo, doca, tipo ? '' : nomes[0])); } catch (e) { falhaLog_('apagar rascunho após auditoria', e); }
  });
  if (repetida) return { ok: true, id: repetida.id, pct: repetida.pct, status: repetida.status, repetida: true };
  if (negadoNoLock) { const er = {}; er[negadoNoLock.campo] = negadoNoLock.msg; return { ok: false, erros: er, faltam: [] }; }
  // registro de atividade fora da trava principal: os outros auditores não esperam por ele (o log tem a sua própria trava curta)
  logAtiv_(u, 'Auditoria registrada', id, p.processo + (doca ? ' ' + doca : '') + ' - ' + pct + '%');
  // feedback imediato: item marcado e não conforme gera na hora a pendência para o Site Leader designar.
  // A auditoria já está gravada: falha aqui vai para o log e não vira erro (o auditor não fica sabendo de nada; a resposta não muda).
  if (linhasColab.length && detalhes.some(function (d) { return d.ok === false && d.imed; })) {
    try { gerarFbImediato_(id, linhasColab, Number(cfg.NOTA_MEDIA_PCT)); } catch (e) { falhaLog_('feedback imediato da auditoria ' + id, e); }
  }
  return { ok: true, id: id, pct: pct, status: status };
}

/* ---------- matriz ---------- */
function getMatriz(processo) { return medir_('getMatriz', getMatrizCore_, arguments); }
function getMatrizCore_(processo) {
  const a = exigirTela_('matriz');
  if (PROCESSOS.indexOf(processo) < 0) throw new Error('Processo inválido.');
  if (!procPermitido_(a, processo)) throw new Error('Sem acesso a este processo.');
  const cfg = config_(), agora = new Date(), tipo = TIPO_PROC[processo], ult = ultimas_();
  const rasc = lerDireto_('Auditorias_Rascunho').filter(function (r) { return r.Processo === processo && rascunhoValido_(r); });
  const unidades = tipo
    ? lerAba_('Cad_Estrutura').filter(function (e) { return e.Tipo === tipo; }).map(function (e) { return { id: e.Identificador, tipo: e.Tipo, simbolo: e.Cor_Simbolo, lider: e.Lider_Padrao, turno: e.Turno_Padrao }; })
    : lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return { id: p.Nome, tipo: 'Time', simbolo: '', lider: p.Nome, turno: p.Turno }; });
  return unidades.map(function (un) {
    const u = ult[(hubsAtivos_() ? hubAtual_() : '') + '|' + processo + '|' + un.id];
    let status = 'nunca', dias = null, nota = null;
    if (u) {
      dias = Math.floor((agora - d_(u.ts)) / 864e5);
      nota = u.pct;
      status = vencida_(u.ts, +agora, cfg.DIAS_VIDA_UTIL_AUDITORIA) ? 'vencido' : faixa_(nota, cfg);
    }
    if (rasc.some(function (r) { return tipo ? r.Doca_Cluster === un.id : liderDoRascunho_(r) === un.id; })) status = 'rascunho';
    un.status = status; un.dias = dias; un.nota = nota;
    un.ultLider = u ? u.lider : '';
    // nome de colaborador: só com a permissão ver_nomes e, no escopo "time", só do próprio time
    un.ultColab = u && tem_(a, 'ver_nomes') && unidadeNoEscopo_(a, u.lider) ? u.colab : '';
    return un;
  });
}
