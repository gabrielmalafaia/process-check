
/* ---------- matriz ---------- */
const TXT_STATUS = { verde: 'Conforme', observacao: 'Em observação', vermelho: 'Inconforme', rascunho: 'Rascunho', nunca: 'Nunca auditado', vencido: 'Tempo de auditoria vencido' };
/** Linhas de pessoas no card: líder (e colaboradores) da ÚLTIMA auditoria; sem auditoria, o líder padrão do cadastro. */
function linhasPessoas(c) {
  let h = '';
  if (c.tipo !== 'Time') h += c.ultLider ? '<small>Líder: ' + esc(c.ultLider) + '</small>' : (c.lider ? '<small>Líder padrão: ' + esc(c.lider) + '</small>' : '<small>Líder: —</small>');
  if (c.ultColab) h += '<small class="un" title="' + esc(c.ultColab) + '">Colab.: ' + esc(c.ultColab) + '</small>';
  return h;
}
const diasTxt = function (d) { return d === 0 ? 'hoje' : d === 1 ? 'há 1 dia' : 'há ' + d + ' dias'; };
const ORDEM_ST = ['verde', 'observacao', 'vermelho', 'rascunho', 'nunca', 'vencido'];
function desenharMatriz(m) {
  const g = $('#mg'); if (!g) return;
  const cont = {}; m.forEach(function (c) { cont[c.status] = (cont[c.status] || 0) + 1; });
  const f = S.mFiltro && cont[S.mFiltro] ? S.mFiltro : '';
  const leg = $('#mleg');
  if (leg) leg.innerHTML = '<button type="button" class="chip ' + (f ? '' : 'on') + '" data-mf="">Todos <span class="cn">' + m.length + '</span></button> ' +
    ORDEM_ST.filter(function (k) { return cont[k]; }).map(function (k) { return '<button type="button" class="chip st-' + k + (f === k ? ' on' : '') + '" data-mf="' + k + '"><i class="dot"></i>' + TXT_STATUS[k] + ' <span class="cn">' + cont[k] + '</span></button>'; }).join(' ');
  g.innerHTML = m.filter(function (c) { return !f || c.status === f; }).map(function (c) {
    const time = c.tipo === 'Time';
    return '<button type="button" class="mc ' + c.status + '" data-id="' + esc(c.id) + '" title="' + esc(time ? 'Turno ' + (c.turno || '—') : c.tipo + (c.simbolo ? ' · ' + textoCS(c.simbolo) : '')) + '"><div class="mh">' + (time ? '' : chipCS(c.simbolo, 26)) + '<b>' + esc(time ? 'Time ' + c.id : c.id) + '</b></div>' +
      '<div class="mst">' + TXT_STATUS[c.status] + '</div><div class="mn">' + (c.nota != null ? pc(c.nota) : '—') + '</div>' +
      (c.nota != null ? '<small class="mw">' + diasTxt(c.dias) + '</small>' : '') + (time ? '<small>Turno ' + esc(c.turno || '—') + '</small>' : '') + linhasPessoas(c) + '</button>';
  }).join('') || '<div class="empty">Nenhum item cadastrado para este processo.</div>';
  $$('#mg .mc').forEach(function (c) { c.onclick = function () { if (pode('auditar')) abrirForm(S.mp, c.dataset.id); else toast('Seu perfil não pode realizar auditorias.', true); }; });
}
async function loadMatriz() {
  const el = $('#v-matriz'), proc = S.mp;
  if (!S.procs.length) { el.innerHTML = '<div class="card">' + vz('Seu perfil não tem processos liberados na Matriz.') + '</div>'; return; }
  const chips = S.procs.map(function (p) { return '<button type="button" class="chip ' + (p === proc ? 'on' : '') + '" data-p="' + esc(p) + '">' + esc(p) + '</button>'; }).join(' ');
  const nota = '<div class="legend lnotas"><span>Conforme: ' + S.cfg.NOTA_MEDIA_PCT + '% ou mais</span><span>Em observação: ' + S.cfg.NOTA_CORTE_PCT + '% até menos de ' + S.cfg.NOTA_MEDIA_PCT + '%</span><span>Inconforme: abaixo de ' + S.cfg.NOTA_CORTE_PCT + '%</span><span>Vencido: mais de ' + S.cfg.DIAS_VIDA_UTIL_AUDITORIA + ' dias</span></div>';
  el.innerHTML = '<div id="mbanner"></div><div class="card"><div class="toolbar">' + chips + '</div><div class="toolbar mfil" id="mleg"></div>' + nota +
    '<small class="muted">' + (tipoProc(proc) ? 'Cada card é ' + (tipoProc(proc) === 'Doca' ? 'uma doca' : 'um cluster') + '.' : 'Cada card é o time de um líder.') + (pode('auditar') ? ' Clique para auditar.' : '') + '</small><div id="mg" class="mgrid" style="margin-top:12px">' + skel(6, 'sk-card') + '</div></div>';
  $$('#v-matriz .toolbar:first-child .chip').forEach(function (b) { b.onclick = function () { S.mp = b.dataset.p; S.mFiltro = ''; loadMatriz(); }; });
  $('#mleg').onclick = function (e) { const b = e.target.closest('[data-mf]'); if (!b) return; S.mFiltro = b.dataset.mf; if (S.mx[S.mp]) desenharMatriz(S.mx[S.mp]); };
  if (S.mx[proc]) desenharMatriz(S.mx[proc]);
  if (tela('minhas')) bannerMetas();
  try {
    const m = await rpc('getMatriz', proc);
    S.mx[proc] = m;
    if (S.v === 'matriz' && S.mp === proc) desenharMatriz(m);
  } catch (e) { if (!S.mx[proc] && $('#mg')) $('#mg').innerHTML = '<div class="empty">Não foi possível carregar a matriz.</div>'; }
}
async function bannerMetas() {
  let ms; try { ms = await rpc('minhasMetas'); } catch (e) { return; }
  const b = $('#mbanner'); if (!b || S.v !== 'matriz') return;
  const ativas = ms.filter(function (m) { return m.status === 'no_ritmo' || m.status === 'em_risco'; });
  if (!ativas.length) { b.innerHTML = ''; return; }
  const risco = ativas.filter(function (m) { return m.status === 'em_risco'; }).length;
  b.innerHTML = '<div class="note' + (risco ? ' warn' : '') + '" style="margin-bottom:12px">' + ic('target', 16) + '<span>Você tem ' + ativas.length + ' meta(s) em andamento' + (risco ? ', ' + risco + ' em risco' : ', todas no ritmo') + '. <a href="#" data-vai="minhas">Ver minhas metas</a></span></div>';
}
async function loadMinhas() {
  const el = $('#v-minhas'); el.innerHTML = '<div class="card">' + skel(5) + '</div>';
  let ms, pg; try { const r = await Promise.all([rpc('minhasMetas'), rpc('minhasMetasLider')]); ms = r[0]; pg = r[1]; } catch (e) { el.innerHTML = '<div class="card">Não foi possível carregar suas metas.</div>'; return; }
  if (S.v !== 'minhas') return;
  ms.sort(function (a, b) { return b.ini.localeCompare(a.ini); });
  const prog = pg.slice().sort(function (a, b) { return a.fim.localeCompare(b.fim); }).map(function (m) {
    const p = Math.min(100, m.feito / m.qtd * 100), venc = m.status === 'nao_atingida';
    return '<div class="card"><div class="hd"><div><b>' + esc(m.qtd + ' ' + tr('auditoria(s)')) + '</b>' + (m.nova ? ' <span class="tag-t">' + esc(tr('Nova')) + '</span>' : '') + '<br><small class="muted">' + esc(fmtD(m.ini) + ' ' + tr('a') + ' ' + fmtD(m.fim)) + (venc ? ' · ' + esc(tr('Prazo vencido')) : '') + (m.desc ? ' · ' + esc(m.desc) : '') + '</small><br><small class="muted">' + esc(escopoMeta(m)) + '</small></div>' + pill(m.status, tr(TXT_META[m.status])) + '</div>' +
      '<div class="meta-t"><span class="nm"><b>' + m.feito + '</b> ' + esc(tr('de')) + ' ' + m.qtd + '</span>' + meter(p, m.status) + '<span class="num">' + Math.round(p) + '%</span></div></div>';
  }).join('');
  const antes = prog ? '<div class="sect">' + esc(tr('Programadas pela liderança')) + '</div>' + prog : '';
  if (S.metasNovas > 0 || pg.some(function (m) { return m.nova; })) { rpc('marcarMetasVistas').then(function () { S.metasNovas = 0; renderNav(); }).catch(function () { /* o contador volta no próximo ciclo */ }); }
  el.innerHTML = antes + (prog && ms.length ? '<div class="sect">' + esc(tr('Metas individuais')) + '</div>' : '') + ms.map(function (m) {
    const p = Math.min(100, m.feito / m.qtd * 100);
    return '<div class="card"><div class="hd"><div><b>' + m.qtd + ' auditoria(s)' + (m.processos.length ? ' em ' + esc(m.processos.join(', ')) : ' em qualquer processo') + '</b><br><small class="muted">' + fmtD(m.ini) + ' a ' + fmtD(m.fim) + (m.desc ? ' · ' + esc(m.desc) : '') + '</small></div>' + pill(m.status, TXT_META[m.status]) + '</div>' +
      '<div class="meta-t"><span class="nm"><b>' + m.feito + '</b> de ' + m.qtd + '</span>' + meter(p, m.status) + '<span class="num">' + Math.round(p) + '%</span></div></div>';
  }).join('') || (prog ? '' : '<div class="card">' + vz('Você não tem metas ativas no momento.') + '</div>');
}

/* ---------- formulário de auditoria (1 a N colaboradores) ---------- */
let tmr, pend = Promise.resolve(), seq = 0;
const chaveF = function (F) { return tipoProc(F.processo) ? F.doca : (F.colaboradores[0] || ''); };
const infoColab = function (nome) { return colabs().find(function (x) { return x.Nome === nome; }); };
/** Líder(es) e turno derivados dos colaboradores escolhidos. */
function derivar(F) {
  const ps = F.colaboradores.map(infoColab).filter(Boolean);
  const ls = [], ts = [];
  ps.forEach(function (p) { if (p.Lider && ls.indexOf(p.Lider) < 0) ls.push(p.Lider); if (p.Turno && ts.indexOf(p.Turno) < 0) ts.push(p.Turno); });
  return { lideres: ls, turnos: ts };
}
function aplicarDoca(F, id) {
  F.doca = id;
  if (!F.colaboradores.length) {
    const e = estr(tipoProc(F.processo)).find(function (x) { return x.Identificador === id; });
    if (e) { F.lider = e.Lider_Padrao || F.lider; F.turno = e.Turno_Padrao || F.turno; }
  }
}
function aplicarLider(F, nome) {
  F.lider = nome;
  const l = lideres().find(function (x) { return x.Nome === nome; });
  if (l) F.turno = l.Turno || F.turno;
  if (!tipoProc(F.processo)) F.colaboradores = F.colaboradores.filter(function (n) { const c = infoColab(n); return c && c.Lider === nome; });
}
function sincDerivados(F) {
  const d = derivar(F);
  if (d.lideres.length) F.lider = d.lideres.join('; ');
  if (d.turnos.length === 1) { F.turno = d.turnos[0]; F.turnoEsc = false; }
  else if (d.turnos.length > 1 && !(F.turnoEsc && d.turnos.indexOf(F.turno) > -1)) { F.turno = ''; F.turnoEsc = false; }
}
function adicionarColab(F, nome) {
  if (!nome) return;
  if (!multi(F.processo)) F.colaboradores = [nome];
  else if (F.colaboradores.indexOf(nome) < 0 && F.colaboradores.length < MAX_COLAB) F.colaboradores = F.colaboradores.concat([nome]);
  if (!tipoProc(F.processo) && !multi(F.processo)) { const c = infoColab(nome); if (c && c.Lider) F.lider = c.Lider; }
  sincDerivados(F);
}
function removerColab(F, nome) {
  F.colaboradores = F.colaboradores.filter(function (n) { return n !== nome; });
  if (F.colaboradores.length) sincDerivados(F);
}
function novoForm(p, chave) {
  const F = { processo: p || S.procs[0] || '', doca: '', colaboradores: [], lider: '', turno: '', obs: '', resp: {}, k: '', err: {}, faltam: [], busy: false };
  if (chave) { if (tipoProc(F.processo)) aplicarDoca(F, chave); else aplicarLider(F, chave); }
  S.F = F;
}
/** Aceita rascunhos antigos (campo colaborador) e novos (colaboradores). Descarta o que não for válido. */
function aplicarEstado(F, r) {
  const cols = Array.isArray(r.colaboradores) ? r.colaboradores : (r.colaborador ? [r.colaborador] : []);
  F.colaboradores = cols.map(String).filter(function (n, i, a) { return a.indexOf(n) === i && infoColab(n); }).slice(0, multi(F.processo) ? MAX_COLAB : 1);
  F.lider = typeof r.lider === 'string' ? r.lider : F.lider; F.turno = typeof r.turno === 'string' ? r.turno : F.turno;
  F.obs = typeof r.obs === 'string' ? r.obs : ''; F.resp = r.resp && typeof r.resp === 'object' ? r.resp : {};
}
const temResp = function (F) { return Object.keys(F.resp).length > 0 || !!F.obs; };
async function sincronizarChave() {
  const F = S.F, nk = chaveF(F);
  if (nk === F.k) return false;
  // trocar doca, cluster ou colaborador não apaga o que a pessoa já respondeu: as respostas passam para a nova chave
  const manter = temResp(F), rev0 = F.rev || 0;
  F.k = nk; F.faltam = []; F.noAuto = '';
  if (!nk) { F.sync = false; seq++; return true; }
  const meu = ++seq;
  let r = null;
  F.sync = true;
  try { r = await rpc('getRascunho', F.processo, nk); }
  catch (e) { if (S.F === F && F.k === nk) { F.sync = false; F.noAuto = nk; const s = $('#sv'); if (s) s.textContent = 'Rascunho não carregado: salvamento automático pausado'; } return true; }
  if (meu !== seq || S.F !== F || F.k !== nk) return false;
  F.sync = false;
  if (r && (manter || (F.rev || 0) !== rev0)) { toast('Já existia um rascunho desta chave. Suas respostas atuais foram mantidas e vão substituí-lo ao salvar.'); return false; }
  if (r) { aplicarEstado(F, r); F.k = nk; }
  return true;
}
async function abrirForm(p, chave) {
  novoForm(p, chave);
  const F0 = S.F;
  if (!tipoProc(p)) {
    let r = null, falhou = false;
    try { r = await rpc('getRascunhoLider', chave); } catch (e) { r = null; falhou = true; }
    if (S.F !== F0) return; // outro card foi aberto enquanto esta resposta vinha
    if (r) { aplicarEstado(F0, r.estado); F0.k = r.chave; }
    else if (falhou) F0.noAuto = chaveF(F0);
    nav('form'); return;
  }
  nav('form');
  if (await sincronizarChave()) renderForm();
}
function opts(arr, v, ph) {
  arr = arr.slice(); if (v && arr.indexOf(v) < 0) arr.push(v);
  return '<option value="">' + (ph || 'Selecione…') + '</option>' + arr.map(function (x) { return '<option ' + (x === v ? 'selected' : '') + '>' + esc(x) + '</option>'; }).join('');
}
function optsEst(tipo, sel) {
  const lista = estr(tipo);
  return '<option value="">Selecione…</option>' + lista.map(function (e) {
    const t = e.Cor_Simbolo ? textoCS(e.Cor_Simbolo) : '';
    return '<option value="' + esc(e.Identificador) + '" ' + (e.Identificador === sel ? 'selected' : '') + '>' + esc(e.Identificador + (t ? ' — ' + t : '')) + '</option>';
  }).join('') + (sel && !lista.some(function (e) { return e.Identificador === sel; }) ? '<option value="' + esc(sel) + '" selected>' + esc(sel) + '</option>' : '');
}
function renderForm(rolar) {
  const F = S.F; if (!F) return;
  if (!S.procs.length) { $('#v-form').innerHTML = '<div class="card">' + vz('Seu perfil não tem processos liberados para auditoria.') + '</div>'; return; }
  const tipo = tipoProc(F.processo), itens = perg(F.processo), E = F.err || {}, mu = multi(F.processo);
  const inv = function (c) { return E[c] ? 'invalid' : ''; };
  const em = function (c) { return '<span class="err" data-ferr="' + c + '">' + esc(E[c] || '') + '</span>'; };
  const star = ' <span class="req">*</span>';
  const est = tipo ? estr(tipo).find(function (e) { return e.Identificador === F.doca; }) : null;
  const disp = colabs().filter(function (p) { return (tipo || mu || !F.lider || p.Lider === F.lider) && F.colaboradores.indexOf(p.Nome) < 0; });
  const g = {}; itens.forEach(function (i) { (g[i.ID_Subprocesso] = g[i.ID_Subprocesso] || []).push(i); });
  const procF = F.processo;
  const rb = function (i, v, t) {
    const cur = F.resp[i._row], on = (v === '1' && cur === true) || (v === '0' && cur === false) || (v === 'na' && cur === 'na');
    return '<label><input type="radio" name="q' + i._row + '" data-q="' + i._row + '" value="' + v + '" ' + (on ? 'checked' : '') + '><span>' + t + '</span></label>';
  };
  const d = derivar(F), nErr = Object.keys(E).length;
  const tags = F.colaboradores.map(function (n) { return '<span class="tagc">' + esc(n) + '<button type="button" data-rmc="' + esc(n) + '" aria-label="Remover ' + esc(n) + '">' + ic('x', 12) + '</button></span>'; }).join('');
  const ph = (mu ? 'Adicionar colaborador (até ' + MAX_COLAB + ')… ' : 'Buscar ') + 'entre ' + disp.length + ' ativos';
  const labCol = mu ? 'Colaboradores' + (tipo ? ' (opcional, ' + F.colaboradores.length + '/' + MAX_COLAB + ')' : star) : 'Colaborador' + (tipo ? ' (opcional)' : star);
  const liderCampo = F.colaboradores.length && (tipo || mu) ?
    '<div class="lab">Líder' + (d.lideres.length > 1 ? 'es' : '') + '<div class="ro">' + esc(d.lideres.join('; ') || '—') + '</div></div>' :
    '<label>Líder' + (tipo ? '' : ' (do time)') + '<select data-f="lider" class="' + inv('lider') + '">' + opts(lideres().map(function (p) { return p.Nome; }), F.lider) + '</select>' + em('lider') + '</label>';
  const turnoNota = d.turnos.length > 1 ? '<small class="muted">Colaboradores de turnos diferentes: escolha o turno desta auditoria.</small>' : '';
  $('#v-form').innerHTML = (nErr ? '<div class="alert" id="falerta">' + ic('alert', 16) + '<span>Há campos obrigatórios pendentes. Corrija os itens destacados em vermelho.</span></div>' : '') +
    '<div class="card grid">' +
    '<label>Processo' + star + '<select data-f="processo" class="' + inv('processo') + '">' + opts(S.procs, F.processo) + '</select>' + em('processo') + '</label>' +
    (tipo ? '<label>' + (tipo === 'Doca' ? 'Doca' : 'Cluster') + star + '<select data-f="doca" class="' + inv('doca') + '">' + optsEst(tipo, F.doca) + '</select>' + em('doca') + '</label>' : '') +
    '<div class="lab" style="grid-column:span 2;min-width:260px">' + labCol + (tags ? '<div class="tags">' + tags + '</div>' : '') +
    (mu || !F.colaboradores.length ? '<div class="cb"><input type="text" id="cbIn" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="cbList" class="' + inv('colaborador') + '" placeholder="' + esc(ph) + '">' +
      '<ul id="cbList" class="cbl hidden" role="listbox"></ul></div>' : '') + em('colaborador') + '</div>' +
    liderCampo +
    '<label>Turno' + star + '<select data-f="turno" class="' + inv('turno') + '">' + opts(S.turnos, F.turno) + '</select>' + em('turno') + turnoNota + '</label>' +
    '<div>' + (est ? '<span class="badge">' + chipCS(est.Cor_Simbolo, 22) + ' ' + esc(est.Tipo) + (est.Cor_Simbolo ? ' · ' + esc(textoCS(est.Cor_Simbolo)) : '') + '</span>' : '') + '</div></div>' +
    (mu && F.colaboradores.length > 1 ? aviso('A nota desta auditoria vale para ' + F.colaboradores.length + ' colaboradores: ela será registrada para cada um deles.') : '') +
    '<div class="card">' + (E.itens ? '<div class="alert">' + ic('alert', 16) + '<span>' + esc(E.itens) + '</span></div>' : '') +
    (Object.keys(g).map(function (k) {
      return '<div class="sub">' + esc(nomeSub(procF, k)) + '</div>' + g[k].map(function (i) {
        return '<div class="item ' + (F.faltam.indexOf(i._row) > -1 ? 'miss' : '') + '" data-item="' + i._row + '"><span>' + esc(descItem(i)) + (i.Requisito_Critico === 'Sim' ? '<span class="crit">CRÍTICO</span>' : '') + '</span><div class="rb">' + rb(i, '1', 'Conforme') + rb(i, '0', 'Não conforme') + rb(i, 'na', 'N/A') + '</div></div>';
      }).join('');
    }).join('') || '<p>Nenhum item cadastrado para este processo.</p>') +
    '<label style="margin-top:12px">Observações (máx. 500)<textarea data-f="obs" rows="3" class="' + inv('obs') + '">' + esc(F.obs) + '</textarea>' + em('obs') + '</label></div>' +
    '<div class="bar"><div class="sc" id="sc"></div><div class="pg"><small id="pgt"></small><div class="prog"><i id="pgi"></i></div></div><small id="sv">' + (F.noAuto && F.noAuto === chaveF(F) ? 'Rascunho não carregado: salvamento automático pausado' : '') + '</small>' +
    '<button type="button" class="btn bad" id="bDesc">' + ic('trash', 14) + 'Descartar rascunho</button><button type="button" class="btn" id="bRasc">' + ic('save', 14) + 'Salvar rascunho</button><button type="button" class="btn pri" id="bFin">' + ic('check', 14) + 'Finalizar auditoria</button></div>';
  $('#bFin').onclick = finalizar;
  if (F.busy) { $('#bFin').disabled = true; $('#bFin').textContent = 'Salvando…'; }
  $('#bRasc').onclick = function () { salvarRasc(true); };
  $('#bDesc').onclick = descartar;
  score();
  if (rolar && nErr) { const p = $('#v-form .invalid, #v-form .miss, #v-form .alert'); if (p && p.scrollIntoView) p.scrollIntoView({ block: 'center' }); }
}
function score() {
  const F = S.F, itens = perg(F.processo);
  let av = 0, ok = 0;
  itens.forEach(function (i) { const r = F.resp[i._row]; if (r === true) { av++; ok++; } else if (r === false) av++; });
  const pct = av ? Math.round(ok / av * 1000) / 10 : 0, el = $('#sc');
  if (!el) return;
  const fx = faixa(pct), cls = { verde: 'ok', observacao: 'obs', vermelho: 'bad' };
  el.className = 'sc ' + (av ? cls[fx] : '');
  el.textContent = av ? String(pct).replace('.', ',') + '% (' + ok + '/' + av + ') — ' + TXT_FAIXA[fx] : 'Sem itens avaliados';
  const feitos = itens.filter(function (i) { return F.resp[i._row] !== undefined; }).length, pt = $('#pgt'), pi = $('#pgi');
  if (pt) pt.textContent = feitos + ' de ' + itens.length + ' itens';
  if (pi) pi.style.width = (itens.length ? Math.round(feitos / itens.length * 100) : 0) + '%';
}
function limparErroCampo(t) {
  t.classList.remove('invalid');
  const s = $('#v-form [data-ferr="' + t.dataset.f + '"]'); if (s) s.textContent = '';
  if (S.F && S.F.err) delete S.F.err[t.dataset.f];
}
function auto() {
  clearTimeout(tmr);
  const F = S.F; if (!F || !chaveF(F) || F.busy || F.sync || F.noAuto === chaveF(F)) return;
  const s = $('#sv'); if (s) s.textContent = 'Salvando…';
  tmr = setTimeout(function () { salvarRasc(false); }, 1200);
}
const estadoRasc = function (F) { return { colaboradores: F.colaboradores, lider: F.lider, turno: F.turno, obs: F.obs, resp: F.resp }; };
async function salvarRasc(manual) {
  const F = S.F; if (!F || F.busy || (!manual && (F.sync || F.noAuto === chaveF(F)))) return;
  const chave = chaveF(F);
  if (!chave) { if (manual) toast(tipoProc(F.processo) ? 'Selecione ' + (tipoProc(F.processo) === 'Doca' ? 'a doca' : 'o cluster') + ' antes de salvar o rascunho.' : 'Selecione o colaborador antes de salvar o rascunho.', true); return; }
  pend = rpc('salvarRascunho', { processo: F.processo, chave: chave, estado: estadoRasc(F) });
  try { await pend; } catch (e) { const sf = $('#sv'); if (sf) sf.textContent = 'Falha ao salvar o rascunho'; return; }
  const s = $('#sv'); if (s) s.textContent = 'Rascunho salvo ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
  if (manual) toast('Rascunho salvo');
}
async function descartar() {
  const F = S.F, chave = chaveF(F);
  if (!chave) { S.F = null; novoForm(); renderForm(); return; }
  clearTimeout(tmr); F.busy = true;
  try { await pend.catch(function () {}); await rpc('descartarRascunho', F.processo, chave); S.F = null; S.mx = {}; toast('Rascunho descartado'); nav('matriz'); } catch (e) { F.busy = false; }
}
async function finalizar() {
  const F = S.F; if (F.busy) return;
  const tipo = tipoProc(F.processo), itens = perg(F.processo), err = {}, faltam = [], mu = multi(F.processo);
  if (tipo && !F.doca) err.doca = 'Selecione ' + (tipo === 'Doca' ? 'a doca' : 'o cluster') + '.';
  if (!tipo && !F.colaboradores.length) err.colaborador = 'Selecione o colaborador.';
  if (F.colaboradores.length > 1 && !mu) err.colaborador = 'Este processo permite apenas um colaborador por auditoria.';
  if (F.colaboradores.length > MAX_COLAB) err.colaborador = 'No máximo ' + MAX_COLAB + ' colaboradores por auditoria.';
  if (!err.colaborador && F.colaboradores.some(function (n) { return !infoColab(n); })) err.colaborador = 'Há colaborador inativo ou não cadastrado na lista. Remova-o.';
  if (!tipo && !err.colaborador && !derivar(F).lideres.length && !F.lider) err.lider = 'Líder não identificado. Cadastre o líder deste colaborador.';
  if (!F.turno) err.turno = derivar(F).turnos.length > 1 ? 'Os colaboradores são de turnos diferentes. Selecione o turno da auditoria.' : 'Selecione o turno.';
  if (String(F.obs || '').length > 500) err.obs = 'Máximo de 500 caracteres.';
  itens.forEach(function (i) { if (F.resp[i._row] === undefined) faltam.push(i._row); });
  if (!itens.length) err.itens = 'Não há itens cadastrados para este processo.';
  else if (faltam.length) err.itens = 'Responda todos os itens (' + faltam.length + ' pendente' + (faltam.length > 1 ? 's' : '') + ').';
  else if (itens.every(function (i) { return F.resp[i._row] === 'na'; })) err.itens = 'Avalie ao menos um item (nem tudo pode ser N/A).';
  if (Object.keys(err).length) { F.err = err; F.faltam = faltam; renderForm(true); toast('Há campos obrigatórios pendentes. Veja os destaques em vermelho.', true); return; }
  F.busy = true; clearTimeout(tmr);
  const bf = $('#bFin'); if (bf) { bf.disabled = true; bf.textContent = 'Salvando…'; }
  try {
    await pend.catch(function () {});
    const respostas = itens.map(function (i) { const r = F.resp[i._row]; return { k: i._row, ok: r === 'na' ? null : r }; });
    const r = await rpc('salvarAuditoria', { processo: F.processo, doca: F.doca, colaboradores: F.colaboradores, lider: F.lider, turno: F.turno, observacoes: F.obs, respostas: respostas });
    if (!r.ok) { F.busy = false; F.err = r.erros || {}; F.faltam = r.faltam || []; renderForm(true); toast('O servidor recusou a auditoria. Corrija os campos destacados.', true); return; }
    toast('Auditoria salva: ' + String(r.pct).replace('.', ',') + '% — ' + r.status); S.F = null; S.mx = {}; nav('matriz');
  } catch (e) { F.busy = false; if (bf) { bf.disabled = false; bf.textContent = 'Finalizar auditoria'; } }
}
async function aplicarMudanca() {
  const F = S.F;
  clearTimeout(tmr);
  ['doca', 'colaborador', 'lider', 'turno'].forEach(function (c) { delete F.err[c]; });
  renderForm();
  if (await sincronizarChave()) renderForm();
  auto();
}
document.addEventListener('change', async function (e) {
  const t = e.target;
  if (!t.closest || !t.closest('#v-form') || !S.F) return;
  const F = S.F;
  if (t.dataset.q) {
    F.resp[t.dataset.q] = t.value === '1' ? true : t.value === '0' ? false : 'na'; F.rev = (F.rev || 0) + 1;
    if (F.err) delete F.err.itens;
    const se = $('#v-form [data-ferr="itens"]'); if (se) se.textContent = '';
    const al = $('#falerta'); if (al && !Object.keys(F.err || {}).length) al.remove();
    const it = t.closest('.item'); if (it) it.classList.remove('miss');
    F.faltam = F.faltam.filter(function (x) { return String(x) !== t.dataset.q; });
    score(); auto(); return;
  }
  const f = t.dataset.f; if (!f) return;
  if (f === 'obs' || f === 'turno' || (f === 'lider' && tipoProc(F.processo))) { F[f] = t.value; if (f === 'obs') F.rev = (F.rev || 0) + 1; if (f === 'turno') F.turnoEsc = true; limparErroCampo(t); auto(); return; }
  if (f === 'processo') {
    F.processo = t.value; F.doca = ''; F.resp = {}; F.k = ''; F.faltam = []; F.err = {}; F.obs = '';
    if (!multi(F.processo)) F.colaboradores = F.colaboradores.slice(0, 1);
    F.lider = ''; F.turno = ''; F.turnoEsc = false; sincDerivados(F);
    renderForm(); if (await sincronizarChave()) renderForm(); return;
  }
  if (f === 'doca') aplicarDoca(F, t.value);
  else if (f === 'lider') aplicarLider(F, t.value);
  await aplicarMudanca();
});
document.addEventListener('click', async function (e) {
  const b = e.target.closest && e.target.closest('[data-rmc]');
  if (!b || !S.F || S.v !== 'form') return;
  removerColab(S.F, b.dataset.rmc); await aplicarMudanca();
});

/* ---------- busca de colaborador (combobox) ---------- */
const CB_MAX = 50;
const cbEst = { aberto: false, idx: 0, q: '', lista: [] };
function cbBuscar(q) {
  const F = S.F, toks = norm(q).split(/\s+/).filter(Boolean), r = [], mu = multi(F.processo);
  colabs().filter(function (p) { return (tipoProc(F.processo) || mu || !F.lider || p.Lider === F.lider) && F.colaboradores.indexOf(p.Nome) < 0; }).forEach(function (p) {
    const n = norm(p.Nome);
    if (!toks.every(function (t) { return n.indexOf(t) > -1; })) return;
    const rank = toks.length && n.indexOf(toks[0]) === 0 ? 0 : (toks.length && n.split(/\s+/).some(function (w) { return w.indexOf(toks[0]) === 0; }) ? 1 : 2);
    r.push([rank, p]);
  });
  r.sort(function (a, b) { return a[0] - b[0] || a[1].Nome.localeCompare(b[1].Nome, 'pt-BR'); });
  return { total: r.length, lista: r.slice(0, CB_MAX).map(function (x) { return x[1]; }) };
}
function cbDesenhar() {
  const ul = $('#cbList'), inp = $('#cbIn'); if (!ul || !S.F) return;
  const b = cbBuscar(cbEst.q); cbEst.lista = b.lista;
  if (cbEst.idx >= b.lista.length) cbEst.idx = Math.max(b.lista.length - 1, 0);
  ul.innerHTML = b.lista.map(function (p, i) {
    return '<li role="option" data-n="' + esc(p.Nome) + '" class="' + (i === cbEst.idx ? 'act' : '') + '"><b>' + esc(p.Nome) + '</b><small>' + esc((p.Lider ? 'Líder ' + p.Lider : '') + (p.Turno ? ' · ' + p.Turno : '')) + '</small></li>';
  }).join('') +
    (b.total > CB_MAX ? '<li class="cbi">Mostrando ' + CB_MAX + ' de ' + b.total + '. Continue digitando para refinar.</li>' : '') +
    (b.total === 0 ? '<li class="cbi">Nenhum colaborador ativo encontrado' + (S.F.lider && !tipoProc(S.F.processo) && !multi(S.F.processo) ? ' para o líder ' + esc(S.F.lider) : '') + '.</li>' : '');
  ul.classList.remove('hidden'); inp.setAttribute('aria-expanded', 'true'); cbEst.aberto = true;
  const a = ul.querySelector('li.act'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
}
function cbFechar() {
  const ul = $('#cbList'), inp = $('#cbIn'); cbEst.aberto = false;
  if (ul) ul.classList.add('hidden');
  if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.value = ''; }
}
async function cbEscolher(nome) {
  cbFechar(); adicionarColab(S.F, nome); await aplicarMudanca();
  if (multi(S.F.processo) && S.F.colaboradores.length < MAX_COLAB) { const i = $('#cbIn'); if (i) i.focus(); }
}
document.addEventListener('focusin', function (e) {
  if (e.target.id !== 'cbIn') return;
  cbEst.q = ''; cbEst.idx = 0; cbDesenhar();
});
document.addEventListener('focusout', function (e) { if (e.target.id === 'cbIn') cbFechar(); });
document.addEventListener('input', function (e) {
  if (e.target.id !== 'cbIn') return;
  cbEst.q = e.target.value; cbEst.idx = 0; e.target.classList.remove('invalid');
  const s = $('#v-form [data-ferr="colaborador"]'); if (s) s.textContent = '';
  cbDesenhar();
});
document.addEventListener('keydown', function (e) {
  if (e.target.id !== 'cbIn' || !S.F) return;
  const k = e.key;
  if (k === 'ArrowDown' || k === 'ArrowUp') {
    e.preventDefault();
    if (!cbEst.aberto) { cbEst.q = ''; cbEst.idx = 0; cbDesenhar(); return; }
    const n = cbEst.lista.length; if (!n) return;
    cbEst.idx = (cbEst.idx + (k === 'ArrowDown' ? 1 : -1) + n) % n; cbDesenhar();
  } else if (k === 'Enter') {
    if (cbEst.aberto) { e.preventDefault(); const p = cbEst.lista[cbEst.idx]; if (p) cbEscolher(p.Nome); }
  } else if (k === 'Escape' || k === 'Tab') cbFechar();
  else if (k === 'Backspace' && !e.target.value && S.F.colaboradores.length && multi(S.F.processo)) { removerColab(S.F, S.F.colaboradores[S.F.colaboradores.length - 1]); aplicarMudanca(); }
});
document.addEventListener('mousedown', function (e) {
  const li = e.target.closest && e.target.closest('#cbList li');
  if (li) { e.preventDefault(); if (li.dataset.n) cbEscolher(li.dataset.n); }
});
document.addEventListener('input', function (e) {
  const t = e.target;
  if (t.dataset && t.dataset.f === 'obs' && t.closest('#v-form') && S.F) { S.F.obs = t.value; S.F.rev = (S.F.rev || 0) + 1; limparErroCampo(t); auto(); }
});

/* ---------- cadastros (estrutura, pessoas, perguntas) ---------- */
const SCH = {
  Cad_Estrutura: [['Tipo', ['Doca', 'Cluster'], 1, 'Tipo'], ['Identificador', 'text', 1, 'Identificador (ex: A-10)'], ['Cor', 'COR', 1, 'Cor'], ['Simbolo', 'SIMB', 1, 'Símbolo'], ['Lider_Padrao', 'LIDER', 0, 'Líder padrão'], ['Turno_Padrao', 'TURNO', 0, 'Turno padrão']],
  Cad_Pessoas: [['Nome', 'text', 1, 'Nome'], ['Cargo', ['Líder', 'Colaborador'], 1, 'Cargo'], ['Turno', 'TURNO', 1, 'Turno'], ['Lider', 'LIDER', 0, 'Líder (obrigatório p/ colaborador)'], ['Status_Ativo', ['Sim', 'Não'], 1, 'Ativo']],
  Cad_Processos_Perguntas: [['Processo', 'PROC', 1, 'Processo'], ['ID_Subprocesso', 'text', 1, 'Sub-processo'], ['Descricao_Item', 'text', 1, 'Descrição do item'], ['Requisito_Critico', ['Sim', 'Não'], 1, 'Crítico'], ['Subprocesso_EN', 'text', 0, 'Sub-processo em inglês (opcional)'], ['Subprocesso_ES', 'text', 0, 'Sub-processo em espanhol (opcional)'], ['Descricao_EN', 'text', 0, 'Descrição em inglês (opcional)'], ['Descricao_ES', 'text', 0, 'Descrição em espanhol (opcional)']]
};
const ABA_NOME = { Cad_Estrutura: 'Docas e clusters', Cad_Pessoas: 'Pessoas', Cad_Processos_Perguntas: 'Perguntas' };
const ABA_NOVO = { Cad_Estrutura: 'Nova doca ou cluster', Cad_Pessoas: 'Nova pessoa', Cad_Processos_Perguntas: 'Nova pergunta' };
const ABA_EDIT = { Cad_Estrutura: 'Editar doca ou cluster', Cad_Pessoas: 'Editar pessoa', Cad_Processos_Perguntas: 'Editar pergunta' };
const ABA_PERM = { Cad_Estrutura: 'cad_estrutura', Cad_Pessoas: 'cad_pessoas', Cad_Processos_Perguntas: 'cad_perguntas' };
const abasCad = function () { return Object.keys(SCH).filter(function (k) { return pode(ABA_PERM[k]); }); };
function campoCad(c, val) {
  const n = c[0], t = c[1], v = val == null ? '' : val;
  let h;
  if (t === 'text') h = '<input data-c="' + n + '" value="' + esc(v) + '" maxlength="120">';
  else if (t === 'COR' || t === 'SIMB') {
    const arr = t === 'COR' ? S.visual.cores : S.visual.simbolos;
    h = '<select data-c="' + n + '"><option value="">Selecione…</option>' + arr.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
  } else {
    let arr = t === 'PROC' ? S.procs : t === 'LIDER' ? lideres().map(function (p) { return p.Nome; }) : t === 'TURNO' ? S.turnos : t;
    if (v && arr.indexOf(v) < 0) arr = arr.concat([v]);
    h = '<select data-c="' + n + '"><option value="">Selecione…</option>' + arr.map(function (x) { return '<option ' + (x === v ? 'selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
  }
  return '<label>' + esc(c[3]) + (c[2] ? ' <span class="req">*</span>' : '') + h + '<span class="err" data-err="' + n + '"></span></label>';
}
function ajustarLiderCad() {
  if (S.cad !== 'Cad_Pessoas') return;
  const cargo = $('#v-cad [data-c="Cargo"]'), lid = $('#v-cad [data-c="Lider"]');
  if (!cargo || !lid) return;
  const ehLider = cargo.value === 'Líder';
  lid.disabled = ehLider; if (ehLider) lid.value = '';
}
const FILTROS_CAD = {
  Cad_Estrutura: [['', 'Todos'], ['Doca', 'Docas'], ['Cluster', 'Clusters']],
  Cad_Pessoas: [['', 'Todos'], ['Líder', 'Líderes'], ['Colaborador', 'Colaboradores'], ['inativo', 'Inativos']]
};
/** Linhas visíveis da aba atual (com o índice original, usado pelas ações). */
function linhasCad() {
  const aba = S.cad, q = norm(S.cadQ || ''), f = S.cadF || '';
  return (S.db[aba] || []).map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
    const r = x.r;
    if (aba === 'Cad_Estrutura' && f && r.Tipo !== f) return false;
    if (aba === 'Cad_Pessoas' && f && (f === 'inativo' ? r.Status_Ativo !== 'Não' : r.Cargo !== f)) return false;
    if (aba === 'Cad_Processos_Perguntas' && S.cadProc && r.Processo !== S.cadProc) return false;
    return !q || norm(Object.keys(r).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return r[k]; }).join(' ')).indexOf(q) > -1;
  });
}
function menuLinha(x) {
  const aba = S.cad, perg = aba === 'Cad_Processos_Perguntas';
  return '<div class="rm" role="menu">' +
    (perg ? '<button type="button" role="menuitem" data-dup="' + x.i + '">' + ic('layers', 14) + 'Duplicar</button><button type="button" role="menuitem" data-mv="-1" data-i="' + x.i + '">' + ic('arrow-up', 14) + 'Mover para cima</button><button type="button" role="menuitem" data-mv="1" data-i="' + x.i + '">' + ic('arrow-down', 14) + 'Mover para baixo</button>' : '') +
    '<button type="button" role="menuitem" class="dg" data-x="' + x.i + '">' + ic('trash', 14) + 'Excluir</button></div>';
}
function acoesLinha(x) {
  if (x.r._saving) return '<span class="muted">Salvando…</span>';
  return '<div class="acts"><button type="button" class="btn sm" data-e="' + x.i + '">' + ic('pencil', 14) + 'Editar</button><span class="rmw"><button type="button" class="btn sm ico" data-m="' + x.i + '" aria-label="Mais ações" aria-haspopup="menu" aria-expanded="' + (S.cadMenu === x.i) + '">' + ic('more', 16) + '</button>' + (S.cadMenu === x.i ? menuLinha(x) : '') + '</span></div>';
}
function listaCad() {
  const aba = S.cad, L = linhasCad(), el = $('#cList'); if (!el) return;
  const n = $('#cCount'); if (n) n.textContent = L.length + (L.length === 1 ? ' registro' : ' registros');
  if (aba === 'Cad_Processos_Perguntas') {
    const g = {}, ordem = [];
    L.forEach(function (x) { const k = x.r.ID_Subprocesso; if (!g[k]) { g[k] = []; ordem.push(k); } g[k].push(x); });
    el.innerHTML = ordem.map(function (k) {
      return '<details class="grupo" open><summary><span class="gt">' + esc(k) + '</span><span class="gn">' + g[k].length + '</span><button type="button" class="btn sm" data-addsub="' + esc(k) + '">' + ic('plus', 14) + 'Item</button></summary>' +
        g[k].map(function (x) {
          return '<div class="lin' + (x.r._saving ? ' saving' : '') + '"><div class="ld">' + esc(x.r.Descricao_Item) + (x.r.Requisito_Critico === 'Sim' ? ' <span class="crit">CRÍTICO</span>' : '') + '</div>' + acoesLinha(x) + '</div>';
        }).join('') + '</details>';
    }).join('') || '<div class="empty">' + (S.cadQ ? 'Nada encontrado para esta busca.' : 'Nenhuma pergunta neste processo. Use Nova pergunta para criar a primeira.') + '</div>';
    return;
  }
  const cols = SCH[aba].filter(function (c) { return c[0] !== 'Simbolo'; });
  el.innerHTML = '<div class="scroll"><table data-sort><thead><tr>' + cols.map(function (c) { return '<th data-s="t">' + esc(c[0] === 'Cor' ? 'Cor / Símbolo' : c[3].split(' (')[0]) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
    L.map(function (x) {
      const r = x.r;
      return '<tr class="' + (r._saving ? 'saving' : '') + '">' + cols.map(function (c) { return '<td>' + (c[0] === 'Cor' ? chipCS(r.Cor_Simbolo, 22) + esc(textoCS(r.Cor_Simbolo)) : esc(r[c[0]])) + '</td>'; }).join('') + '<td class="ta">' + acoesLinha(x) + '</td></tr>';
    }).join('') + (L.length ? '' : '<tr><td colspan="' + (cols.length + 1) + '" class="muted">' + (S.cadQ || S.cadF ? 'Nada encontrado para este filtro.' : 'Nenhum registro.') + '</td></tr>') + '</tbody></table></div>';
  tabelaInterativa(el);
}
function renderCad(preset) {
  const abas = abasCad();
  if (!abas.length) { $('#v-cad').innerHTML = '<div class="card">' + vz('Seu perfil não tem permissão de cadastro.') + '</div>'; return; }
  if (abas.indexOf(S.cad) < 0) { S.cad = abas[0]; S.edit = null; S.cadOpen = false; }
  const aba = S.cad, sch = SCH[aba], ed = preset ? preset.edit : S.edit;
  if (preset) S.cadOpen = true;
  S.edit = ed || null;
  if (aba === 'Cad_Processos_Perguntas' && S.procs.indexOf(S.cadProc) < 0) S.cadProc = S.procs[0] || '';
  const tabs = abas.map(function (k) { return '<button type="button" class="' + (k === aba ? 'on' : '') + '" data-t="' + k + '">' + ABA_NOME[k] + '</button>'; }).join('');
  const vals0 = preset ? preset.vals : (ed || S.cadPre || {}), pcs = aba === 'Cad_Estrutura' ? parseCS(vals0.Cor_Simbolo) : null;
  const vals = pcs ? Object.assign({ Cor: pcs.cor, Simbolo: pcs.simbolo }, vals0) : vals0;
  const chips = aba === 'Cad_Processos_Perguntas' ? S.procs.map(function (p) { return '<button type="button" class="chip ' + (p === S.cadProc ? 'on' : '') + '" data-cp="' + esc(p) + '">' + esc(p) + '</button>'; }).join('') :
    (FILTROS_CAD[aba] || []).map(function (f) { return '<button type="button" class="chip ' + ((S.cadF || '') === f[0] ? 'on' : '') + '" data-cf="' + esc(f[0]) + '">' + esc(f[1]) + '</button>'; }).join('');
  const titulo = ed ? ABA_EDIT[aba] : ABA_NOVO[aba];
  $('#v-cad').innerHTML = '<div class="tabs">' + tabs + '</div>' +
    '<div class="card"><div class="toolbar cbar"><input type="search" id="cBusca" value="' + esc(S.cadQ || '') + '" placeholder="Buscar nesta lista…" aria-label="Buscar"><div class="chips">' + chips + '</div><span class="muted" id="cCount"></span><button type="button" class="btn pri" id="cNovo">' + ic('plus', 16) + ABA_NOVO[aba] + '</button></div><div id="cList"></div></div>' +
    '<div class="dr-ov' + (S.cadOpen ? '' : ' hidden') + '" data-dr-close></div>' +
    '<aside class="drawer' + (S.cadOpen ? ' open' : ' hidden') + '" role="dialog" aria-modal="true" aria-labelledby="drT"><div class="dr-hd"><h2 id="drT">' + titulo + '</h2><button type="button" class="btn ico" data-dr-close aria-label="Fechar">' + ic('x', 16) + '</button></div>' +
    '<div class="dr-bd"><div class="grid1">' + sch.map(function (c) { return campoCad(c, vals[c[0]]); }).join('') + (aba === 'Cad_Estrutura' ? '<div class="lab">Visual<div id="csPrev" class="csprev"></div></div>' : '') + '</div></div>' +
    '<div class="dr-ft"><small class="muted">Campos com <span class="req">*</span> são obrigatórios.</small><span class="sp"></span><button type="button" class="btn" id="cCancel">Cancelar</button><button type="button" class="btn pri" id="cSalvar">' + (ed ? 'Salvar alteração' : 'Adicionar') + '</button></div></aside>';
  listaCad();
  ajustarLiderCad();
  v8CargaBtn(aba);
  atualizarPrevCS();
  if (preset && preset.erros) mostrarErrosCad(preset.erros);
  if (S.cadOpen && !preset) { const f = $('#v-cad .drawer [data-c]'); if (f && f.focus) f.focus(); }
}
function abrirDrawer(ed, pre) { S.edit = ed || null; S.cadPre = pre || null; S.cadOpen = true; renderCad(); }
function fecharDrawer() { if (!S.cadOpen) return; S.cadOpen = false; S.edit = null; S.cadPre = null; renderCad(); }
function atualizarPrevCS() {
  const el = $('#csPrev'); if (!el) return;
  const g = function (n) { const i = $('#v-cad [data-c="' + n + '"]'); return i ? i.value : ''; };
  const cor = g('Cor'), simb = g('Simbolo'), tipo = g('Tipo');
  if (!cor || !simb) { el.innerHTML = '<small class="muted">Escolha cor e símbolo para ver o desenho.</small>'; return; }
  const v = cor + '/' + simb, ed = S.edit;
  const dup = S.db.Cad_Estrutura.filter(function (x) { return (!ed || x._row !== ed._row) && x.Tipo === tipo && igualCS(x.Cor_Simbolo, v); }).map(function (x) { return x.Identificador; });
  el.innerHTML = chipCS(v, 34) + '<span>' + esc(cor + ' · ' + simb) + '</span>' + (dup.length ? '<small class="warn">Atenção: esta combinação já é usada por ' + esc(dup.join(', ')) + '.</small>' : '');
}
function mostrarErrosCad(erros) {
  Object.keys(erros).forEach(function (k0) {
    const k = k0 === 'Cor_Simbolo' ? 'Cor' : k0;
    const i = $('#v-cad [data-c="' + k + '"]'), s = $('#v-cad [data-err="' + k + '"]');
    if (i) i.classList.add('invalid'); if (s) s.textContent = erros[k0];
  });
}
function lerFormCad() {
  const o = {};
  $$('#v-cad [data-c]').forEach(function (i) { o[i.dataset.c] = i.value.trim(); });
  if (S.cad === 'Cad_Pessoas' && o.Cargo === 'Líder') o.Lider = '';
  if (S.cad === 'Cad_Estrutura') o.Cor_Simbolo = o.Cor && o.Simbolo ? o.Cor + '/' + o.Simbolo : '';
  return o;
}
function validarCad(aba, o, row) {
  const e = {}, outros = S.db[aba].filter(function (x) { return !row || x._row !== row._row; });
  SCH[aba].forEach(function (c) {
    if (c[2] && vazio(o[c[0]])) e[c[0]] = 'Campo obrigatório.';
    else if (Array.isArray(c[1]) && !vazio(o[c[0]]) && c[1].indexOf(o[c[0]]) < 0) e[c[0]] = 'Valor inválido.';
  });
  if (aba === 'Cad_Estrutura') {
    if (!e.Cor && S.visual.cores.indexOf(o.Cor) < 0) e.Cor = 'Valor inválido.';
    if (!e.Simbolo && S.visual.simbolos.indexOf(o.Simbolo) < 0) e.Simbolo = 'Valor inválido.';
    if (!e.Identificador && !e.Tipo && outros.some(function (x) { return x.Tipo === o.Tipo && igual(x.Identificador, o.Identificador); })) e.Identificador = 'Já existe ' + (o.Tipo === 'Doca' ? 'uma doca' : 'um cluster') + ' com este identificador.';
  }
  if (aba === 'Cad_Pessoas') {
    if (!e.Nome && outros.some(function (x) { return igual(x.Nome, o.Nome); })) e.Nome = 'Já existe uma pessoa com este nome.';
    if (o.Cargo === 'Colaborador' && vazio(o.Lider)) e.Lider = 'Informe o líder do colaborador.';
  }
  if (aba === 'Cad_Processos_Perguntas' && !e.Descricao_Item && !e.Processo && outros.some(function (x) { return x.Processo === o.Processo && igual(x.Descricao_Item, o.Descricao_Item); })) e.Descricao_Item = 'Este item já existe neste processo.';
  return e;
}
async function salvarCad() {
  if (S.busy) return;
  const aba = S.cad, o = lerFormCad(), ed = S.edit;
  $$('#v-cad .invalid').forEach(function (i) { i.classList.remove('invalid'); });
  $$('#v-cad [data-err]').forEach(function (s) { s.textContent = ''; });
  const e = validarCad(aba, o, ed);
  if (Object.keys(e).length) { mostrarErrosCad(e); toast('Há campos obrigatórios ou inválidos. Veja os destaques em vermelho.', true); return; }
  S.busy = true;
  const antes = S.db[aba].slice(), orig = ed ? semLinha(ed) : null;
  const otim = Object.assign({}, o, { _row: ed ? ed._row : -1, _saving: 1 });
  S.db[aba] = ed ? antes.map(function (x) { return x === ed ? otim : x; }) : antes.concat([otim]);
  S.edit = null; S.cadOpen = false; S.cadPre = null; renderCad();
  try {
    const r = await rpc('salvarCadastro', aba, Object.assign({ _row: ed ? ed._row : 0 }, o), orig);
    if (!r.ok) {
      S.db[aba] = antes;
      renderCad({ vals: o, edit: ed, erros: r.erros });
      toast(r.msg || 'O servidor recusou o cadastro. Corrija os campos destacados.', true);
    } else { S.db[aba] = r.linhas; S.mx = {}; fbarFill(); renderCad(); toast('Cadastro salvo'); }
  } catch (x) { S.db[aba] = antes; renderCad({ vals: o, edit: ed }); } finally { S.busy = false; }
}
/** Exclui na hora e oferece Desfazer por alguns segundos (o item volta à mesma posição). */
async function excluirCad(i) {
  if (S.busy) return;
  const aba = S.cad, r = S.db[aba][i]; if (!r) return;
  S.cadMenu = -1; S.busy = true;
  const antes = S.db[aba].slice();
  S.db[aba] = antes.filter(function (x) { return x !== r; }); renderCad();
  try {
    const x = await rpc('excluirCadastro', aba, r._row, semLinha(r));
    if (!x.ok) { S.db[aba] = antes; renderCad(); toast(x.msg, true); }
    else {
      S.db[aba] = x.linhas; S.mx = {}; fbarFill(); renderCad();
      toast('Registro excluído', false, { txt: 'Desfazer', fn: function () { desfazerExclusao(aba, r); } });
    }
  } catch (e) { S.db[aba] = antes; renderCad(); } finally { S.busy = false; }
}
async function desfazerExclusao(aba, r) {
  if (S.busy) return;
  S.busy = true;
  try {
    const o = semLinha(r), x = await rpc('restaurarCadastro', aba, o, r._row);
    if (!x.ok) { toast(x.msg || 'Não foi possível desfazer.', true); return; }
    S.db[aba] = x.linhas; S.mx = {}; fbarFill(); if (S.v === 'cad') renderCad(); toast('Registro restaurado');
  } catch (e) { /* aviso exibido */ } finally { S.busy = false; }
}
async function moverCad(i, dir) {
  if (S.busy) return;
  const aba = S.cad, r = S.db[aba][i]; if (!r) return;
  S.cadMenu = -1; S.busy = true;
  try {
    const x = await rpc('moverCadastro', aba, r._row, semLinha(r), dir);
    if (!x.ok) toast(x.msg, true); else { S.db[aba] = x.linhas; S.mx = {}; }
  } catch (e) { /* aviso exibido */ } finally { S.busy = false; renderCad(); }
}
document.addEventListener('click', function (e) {
  const t = e.target;
  if (!t.closest || !t.closest('#v-cad')) return;
  if (!t.closest('.rmw') && S.cadMenu !== undefined && S.cadMenu > -1) { S.cadMenu = -1; listaCad(); }
  if (t.closest('[data-dr-close]')) { if (!S.busy) fecharDrawer(); return; }
  const b = t.closest('button'); if (!b) return;
  if (b.dataset.t) { if (S.busy) return; S.cad = b.dataset.t; S.edit = null; S.cadOpen = false; S.cadF = ''; S.cadQ = ''; S.cadMenu = -1; renderCad(); }
  else if (b.dataset.cp !== undefined) { S.cadProc = b.dataset.cp; renderCad(); }
  else if (b.dataset.cf !== undefined) { S.cadF = b.dataset.cf; renderCad(); }
  else if (b.id === 'cNovo') { if (!S.busy) abrirDrawer(null, S.cad === 'Cad_Processos_Perguntas' ? { Processo: S.cadProc } : null); }
  else if (b.dataset.addsub !== undefined) { e.preventDefault(); if (!S.busy) abrirDrawer(null, { Processo: S.cadProc, ID_Subprocesso: b.dataset.addsub }); }
  else if (b.dataset.e !== undefined) { if (S.busy) return; abrirDrawer(S.db[S.cad][Number(b.dataset.e)]); }
  else if (b.dataset.m !== undefined) { const i = Number(b.dataset.m); S.cadMenu = S.cadMenu === i ? -1 : i; listaCad(); }
  else if (b.dataset.dup !== undefined) { const r = S.db[S.cad][Number(b.dataset.dup)]; S.cadMenu = -1; abrirDrawer(null, Object.assign(semLinha(r), { Descricao_Item: r.Descricao_Item + ' (cópia)' })); }
  else if (b.dataset.mv !== undefined) moverCad(Number(b.dataset.i), Number(b.dataset.mv));
  else if (b.dataset.x !== undefined) excluirCad(Number(b.dataset.x));
  else if (b.id === 'cSalvar') salvarCad();
  else if (b.id === 'cCancel') { if (!S.busy) fecharDrawer(); }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && S.v === 'cad') { if (S.cadMenu > -1) { S.cadMenu = -1; listaCad(); } else if (S.cadOpen && !S.busy) fecharDrawer(); }
});
document.addEventListener('change', function (e) {
  const t = e.target;
  if (!t.closest || !t.closest('#v-cad') || !t.dataset.c) return;
  t.classList.remove('invalid');
  const s = $('#v-cad [data-err="' + t.dataset.c + '"]'); if (s) s.textContent = '';
  if (t.dataset.c === 'Cargo') ajustarLiderCad();
  if (['Cor', 'Simbolo', 'Tipo'].indexOf(t.dataset.c) > -1) atualizarPrevCS();
});
document.addEventListener('input', function (e) {
  const t = e.target;
  if (!t.closest || !t.closest('#v-cad')) return;
  if (t.id === 'cBusca') { S.cadQ = t.value; S.cadMenu = -1; listaCad(); return; }
  if (!t.dataset.c) return;
  t.classList.remove('invalid');
  const s = $('#v-cad [data-err="' + t.dataset.c + '"]'); if (s) s.textContent = '';
});

/* ---------- configurações ---------- */
function loadCfg() {
  $('#v-cfg').innerHTML = '<div id="cfgBase"></div><div id="emailRel"></div>';
  if (pode('config')) loadCfgBase();
  if (pode('email_rel')) carregarEmailRel();
}
function loadCfgBase() {
  $('#cfgBase').innerHTML = '<div class="card grid" style="max-width:760px">' +
    '<label>Vida útil da auditoria (dias) <span class="req">*</span><input type="number" min="1" step="1" id="k1" value="' + esc(S.cfg.DIAS_VIDA_UTIL_AUDITORIA) + '"><span class="err" id="e1"></span></label>' +
    '<label>Nota de corte (%) <span class="req">*</span><input type="number" min="0" max="100" step="any" id="k2" value="' + esc(S.cfg.NOTA_CORTE_PCT) + '"><span class="err" id="e2"></span></label>' +
    '<label>Nota média (%) <span class="req">*</span><input type="number" min="0" max="100" step="any" id="k3" value="' + esc(S.cfg.NOTA_MEDIA_PCT) + '"><span class="err" id="e3"></span></label>' +
    '<label>Poucas auditorias: abaixo de <span class="req">*</span><input type="number" min="1" max="50" step="1" id="k4" value="' + esc(S.cfg.POUCAS_AUDITORIAS == null ? 3 : S.cfg.POUCAS_AUDITORIAS) + '"><small class="muted">Quem tem menos auditorias que isso aparece com o aviso "Poucas auditorias", porque a nota média ainda não é confiável.</small><span class="err" id="e4"></span></label></div>' +
    '<div class="card" style="max-width:760px"><b>Como as cores são definidas</b><div id="kFaixas" class="legend" style="flex-direction:column;gap:6px"></div></div>' +
    '<div class="card" style="max-width:760px"><b>Vários colaboradores por auditoria</b><p class="muted">Marque os processos em que uma mesma auditoria pode valer para mais de um colaborador (até ' + MAX_COLAB + '). A nota é única e vale para todos.</p>' +
    '<div class="grid" id="kMulti">' + S.procs.map(function (p) { return '<label class="perm"><input type="checkbox" value="' + esc(p) + '"' + (multi(p) ? ' checked' : '') + '><span><b>' + esc(p) + '</b></span></label>'; }).join('') + '</div></div>' +
    '<div class="savebar hidden" id="cfgBar" role="status"><span>Alterações não salvas</span><span class="sp"></span><button type="button" class="btn" id="kDesc">Descartar</button><button type="button" class="btn pri" id="kSalvar">Salvar configurações</button></div>';
  const foto = function () { return [$('#k1').value, $('#k2').value, $('#k3').value, $('#k4').value].concat($$('#kMulti input').map(function (i) { return i.checked ? '1' : '0'; })).join('|'); };
  let base = foto();
  const sujo = function () { $('#cfgBar').classList.toggle('hidden', foto() === base); };
  $('#v-cfg').oninput = $('#v-cfg').onchange = sujo;
  $('#kDesc').onclick = function () { loadCfgBase(); };
  const faixas = function () {
    const c = Number($('#k2').value), m = Number($('#k3').value), ok = !isNaN(c) && !isNaN(m) && c < m;
    $('#kFaixas').innerHTML = ok ?
      '<span><i class="dot" style="background:var(--bad)"></i>Vermelho · Inconforme: nota abaixo de ' + c + '%</span>' +
      '<span><i class="dot" style="background:var(--warn)"></i>Amarelo · Em observação: de ' + c + '% até menos de ' + m + '%</span>' +
      '<span><i class="dot" style="background:var(--ok)"></i>Verde · Conforme: ' + m + '% ou mais</span>' : '<span>Informe valores válidos (corte menor que a média).</span>';
  };
  faixas(); $('#k2').oninput = $('#k3').oninput = faixas;
  $('#kSalvar').onclick = async function () {
    ['e1', 'e2', 'e3', 'e4'].forEach(function (id) { $('#' + id).textContent = ''; });
    const v1 = $('#k1').value, v2 = $('#k2').value, v3 = $('#k3').value, v4 = $('#k4').value, c = Number(v2), m = Number(v3);
    if (vazio(v4) || !(Number(v4) >= 1) || Number(v4) > 50 || Math.floor(Number(v4)) !== Number(v4)) $('#e4').textContent = 'Informe um número inteiro entre 1 e 50.';
    if (vazio(v1) || !(Number(v1) >= 1) || Math.floor(Number(v1)) !== Number(v1)) $('#e1').textContent = 'Informe um número inteiro de dias, 1 ou mais.';
    if (vazio(v2) || isNaN(c) || c < 0 || c > 100) $('#e2').textContent = 'Informe um valor entre 0 e 100.';
    if (vazio(v3) || isNaN(m) || m < 0 || m > 100) $('#e3').textContent = 'Informe um valor entre 0 e 100.';
    else if (!$('#e2').textContent && m <= c) $('#e3').textContent = 'A nota média deve ser maior que a nota de corte.';
    if ($('#e1').textContent || $('#e2').textContent || $('#e3').textContent || $('#e4').textContent) { toast('Corrija os campos destacados.', true); return; }
    const mu = {}; $$('#kMulti input').forEach(function (i) { mu[i.value] = i.checked; });
    const b = $('#kSalvar'); b.disabled = true; b.textContent = 'Salvando…';
    try {
      const r = await rpc('salvarConfigs', { dias: v1, corte: v2, media: v3, poucas: v4, multi: mu });
      if (!r.ok) { if (r.erros.dias) $('#e1').textContent = r.erros.dias; if (r.erros.corte) $('#e2').textContent = r.erros.corte; if (r.erros.media) $('#e3').textContent = r.erros.media; if (r.erros.poucas) $('#e4').textContent = r.erros.poucas; toast('O servidor recusou os valores.', true); }
      else { S.cfg = r.config; S.mx = {}; base = foto(); sujo(); toast('Configurações salvas'); }
    } catch (e) { /* aviso exibido */ } finally { b.disabled = false; b.textContent = 'Salvar configurações'; }
  };
}
