/* ============================================================
   Relatórios: camada de leitura do histórico (escopo do perfil) e cálculos dos relatórios.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ---------- camada de dados (histórico) ---------- */
/** Memória só da execução atual (cada chamada do navegador é uma execução nova). A chave inclui a versão do histórico e o nº de linhas. */
var MEMO_ = {};
function memo_(nome, n, fn) {
  const k = hv_() + ':' + n, m = MEMO_[nome];
  if (m && m.k === k) return m.v;
  const v = fn();
  MEMO_[nome] = { k: k, v: v };
  return v;
}
/** Lê só o necessário: coluna de datas inteira + o trecho de linhas do período, nas colunas pedidas. Auditorias_Historico nunca é lida inteira por relatório. */
function lerHist_(de, ate, comNC) {
  const s = aba_('Auditorias_Historico'), n = s.getLastRow() - 1;
  if (n < 1) return [];
  const lo = de + ' 00:00:00', hi = ate + ' 23:59:59';
  const ts = memo_('hts', n, function () { return s.getRange(2, 2, n, 1).getValues().map(function (r) { return tsStr_(r[0]); }); });
  let a = -1, b = -1;
  for (let i = 0; i < n; i++) { const t = ts[i]; if (t >= lo && t <= hi) { if (a < 0) a = i; b = i; } }
  if (a < 0) return [];
  const span = b - a + 1, r0 = a + 2, nc = s.getLastColumn();
  const v = s.getRange(r0, 1, span, 11).getValues();
  const em = nc >= 13 ? s.getRange(r0, 13, span, 1).getValues() : null;
  const ncv = comNC && nc >= 14 ? s.getRange(r0, 14, span, 1).getValues() : null;
  const crv = comNC && nc >= 15 ? s.getRange(r0, 15, span, 1).getValues() : null;
  const isolar = hubsAtivos_(), hub = hubAtual_(), hbv = isolar && nc >= HUB_ABAS.Auditorias_Historico ? s.getRange(r0, HUB_ABAS.Auditorias_Historico, span, 1).getValues() : null;
  const out = [];
  for (let i = 0; i < span; i++) {
    const x = v[i], t = tsStr_(x[1]), pct = Number(x[8]);
    if (t < lo || t > hi || !x[0] || isNaN(pct) || String(x[8]).trim() === '') continue;
    if (isolar && (!hub || !hbv || String(hbv[i][0]).trim() !== hub)) continue; // isolamento por Hub (falha fechada)
    out.push({
      _i: i, _r: r0 + i, id: String(x[0]), ts: t, proc: String(x[2]), doca: String(x[3]), colab: String(x[4]), lider: String(x[5]), turno: String(x[6]), resp: String(x[7]),
      pct: pct, status: String(x[9]), obs: String(x[10]), email: em ? String(em[i][0]).trim().toLowerCase() : '',
      ncs: comNC ? (ncv && String(ncv[i][0]) !== '' ? String(ncv[i][0]).split('|') : null) : [],
      // item crítico reprovado: 'S'/'N' gravado pela v7; vazio = auditoria antiga (lida do JSON abaixo)
      crit: comNC ? (crv && (String(crv[i][0]) === 'S' || String(crv[i][0]) === 'N') ? String(crv[i][0]) === 'S' : (x[8] === 100 || Number(x[8]) >= 100 ? false : null)) : false
    });
  }
  if (comNC) {
    const leg = out.filter(function (r) { return (r.ncs === null || r.crit === null) && r.pct < 100; });
    if (leg.length && leg.length <= LEGADO_MAX) {
      const js = s.getRange(r0, 12, span, 1).getValues();
      leg.forEach(function (r) {
        let det = [];
        try { det = JSON.parse(js[r._i][0]); } catch (e) { det = []; }
        if (r.ncs === null) r.ncs = det.filter(function (d) { return d.ok === false; }).map(function (d) { return String(d.id); });
        if (r.crit === null) r.crit = det.some(function (d) { return d.ok === false && d.critico === true; });
      });
    }
    out.forEach(function (r) { if (!r.ncs) r.ncs = []; r.crit = r.crit === true; });
  }
  return out;
}
function lerColabs_(de, ate) {
  const s = aba_('Auditorias_Colaboradores'), n = s.getLastRow() - 1, m = {};
  if (n < 1) return m;
  const d0 = de.replace(/-/g, ''), d1 = ate.replace(/-/g, '');
  const ids = memo_('cids', n, function () { return s.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }); });
  let a = -1, b = -1;
  for (let i = 0; i < n; i++) { const d = ids[i].substr(4, 8); if (d >= d0 && d <= d1) { if (a < 0) a = i; b = i; } }
  if (a < 0) return m;
  s.getRange(a + 2, 1, b - a + 1, 4).getValues().forEach(function (r) {
    const id = String(r[0]);
    if (id) (m[id] = m[id] || []).push({ n: String(r[1]), l: String(r[2]), t: String(r[3]) });
  });
  return m;
}
/** Última auditoria de cada doca/cluster/time (para a Matriz). Cache curto; é limpo ao salvar auditoria. */
function ultimas_() {
  const iso = hubsAtivos_(), ck = iso ? 'ult:h' : 'ult:s', c = CacheService.getScriptCache(), k = c.get(ck);
  if (k) return JSON.parse(k);
  const s = aba_('Auditorias_Historico'), n = s.getLastRow() - 1, m = {};
  if (n >= 1) {
    const hv = iso && s.getLastColumn() >= HUB_ABAS.Auditorias_Historico ? s.getRange(2, HUB_ABAS.Auditorias_Historico, n, 1).getValues() : null;
    s.getRange(2, 2, n, 8).getValues().forEach(function (r, i) {
      const ts = tsStr_(r[0]), p = String(r[1]);
      if (!ts || PROCESSOS.indexOf(p) < 0 || isNaN(Number(r[7]))) return;
      const key = (iso ? (hv ? String(hv[i][0]).trim() : '') : '') + '|' + p + '|' + (TIPO_PROC[p] ? String(r[2]) : String(r[4]));
      const o = m[key];
      if (!o || ts >= o.ts) m[key] = { ts: ts, pct: Number(r[7]), lider: String(r[4]), colab: String(r[3]) };
    });
  }
  try { c.put(ck, JSON.stringify(m), 600); } catch (e) { /* sem cache */ }
  return m;
}
function filtros_(f) {
  f = f || {};
  const s = function (v) { return String(v == null ? '' : v).trim().slice(0, 120); };
  const per = periodo_(f.de, f.ate);
  if ((per.b - per.a) / 864e5 > MAX_PERIODO_DIAS) throw new Error('Período máximo: ' + MAX_PERIODO_DIAS + ' dias.');
  const o = { de: f.de, ate: f.ate, processo: s(f.processo), doca: s(f.doca), turno: s(f.turno), lider: s(f.lider), colaborador: s(f.colaborador), auditor: s(f.auditor).toLowerCase(), faixa: s(f.faixa), obs: s(f.obs) };
  if (o.processo && PROCESSOS.indexOf(o.processo) < 0) throw new Error('Processo inválido.');
  if (o.turno && TURNOS.indexOf(o.turno) < 0) throw new Error('Turno inválido.');
  if (o.faixa && ['verde', 'observacao', 'vermelho'].indexOf(o.faixa) < 0) throw new Error('Faixa inválida.');
  return o;
}
/**
 * PORTÃO ÚNICO: devolve as auditorias do período que o usuário PODE ver (escopo do perfil) e que casam com os filtros.
 * Nenhum relatório lê o histórico por outro caminho.
 */
function auditorias_(a, f, comNC) {
  const cfg = config_(), esc = a.escopo, colabs = lerColabs_(f.de, f.ate);
  const users = usuariosVisiveis_(a, lerAba_('Cad_Usuarios')), nomeDoFiltro = f.auditor ? semAcento_((users.find(function (u) { return String(u.Email_Google).trim().toLowerCase() === f.auditor; }) || {}).Nome) : '';
  const meuNome = semAcento_(a.nome), soTime = esc.modo === 'time', regraV = soTime ? regraVisao_(a) : null;
  return lerHist_(f.de, f.ate, comNC).map(function (r) {
    r.colabs = colabs[r.id] || (r.colab ? [{ n: r.colab, l: r.lider, t: r.turno }] : []);
    const ls = r.colabs.map(function (c) { return c.l; }).concat(String(r.lider).split(';').map(function (x) { return x.trim(); })).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
    r.lids = ls;
    // escopo "time": o líder só enxerga o que a regra dele permite (time próprio, auditorias que ele fez em outros times e, se liberado, o histórico dos times que ele audita); o resto é recortado aqui, antes de qualquer relatório
    if (soTime) {
      const v = visaoLider_(a, regraV, r, ls);
      r.colabs = v.colabs; r.colab = v.colabs.map(function (c) { return c.n; }).join('; '); r.lids = v.lids; r.lider = v.lids.join('; '); r.oculta = !v.lids.length;
    }
    r.faixa = faixa_(r.pct, cfg);
    return r;
  }).filter(function (r) {
    if (esc.processos.length && esc.processos.indexOf(r.proc) < 0) return false;
    if (esc.turnos.length && esc.turnos.indexOf(r.turno) < 0) return false;
    if (esc.modo === 'proprias' && !(r.email ? r.email === a.email : semAcento_(r.resp) === meuNome)) return false;
    if (soTime && r.oculta) return false;
    if (f.processo && r.proc !== f.processo) return false;
    if (f.doca && r.doca !== f.doca) return false;
    if (f.turno && r.turno !== f.turno) return false;
    if (f.lider && r.lids.indexOf(f.lider) < 0) return false;
    if (f.colaborador && !r.colabs.some(function (c) { return c.n === f.colaborador; })) return false;
    if (f.auditor && !(r.email ? r.email === f.auditor : semAcento_(r.resp) === nomeDoFiltro)) return false;
    if (f.faixa && r.faixa !== f.faixa) return false;
    if (f.obs && semAcento_(r.obs).toLowerCase().indexOf(semAcento_(f.obs).toLowerCase()) < 0) return false;
    return true;
  });
}

/* ---------- relatórios ---------- */
function relatorio(tipo, filtros, extra) { return medir_('relatorio', relatorioCore_, arguments); }
function relatorioCore_(tipo, filtros, extra) {
  // só texto: um array ['export'] passaria no hasOwnProperty e falharia nos === 'export' (pulando permissão, máscara e log)
  if (typeof tipo !== 'string') throw new Error('Relatório inválido.');
  const tipoOk = Object.prototype.hasOwnProperty.call(REL_TELA, tipo) || tipo === 'detalhe' || tipo === 'itensAuditoria';
  const tela = !tipoOk ? '' : (REL_TELA[tipo] || (tipo === 'detalhe' ? ((extra || {}).kind === 'doca' ? 'doca' : 'colab') : (tipo === 'itensAuditoria' ? 'auditorias' : '')));
  if (!tela) throw new Error('Relatório inválido.');
  const a = exigirTela_(tela);
  if (tipo === 'export') exigirPerm_('exportar');
  const f = filtros_(filtros);
  extra = extra || {};
  const cfg = config_();
  if (tipo === 'itensAuditoria') return itensAuditoria_(a, f, String(extra.id || ''));
  const ex = { pagina: Math.max(1, Math.floor(Number(extra.pagina)) || 1), offset: Math.max(0, Math.floor(Number(extra.offset)) || 0), kind: String(extra.kind || ''), chave: String(extra.chave || '').slice(0, 200) };
  const chExp = 'exp:' + a.email, scExp = CacheService.getScriptCache();
  if (tipo === 'export' && (ex.offset === 0 || !scExp.get(chExp))) { scExp.put(chExp, '1', 600); registrar_(a, 'Exportação de dados', 'CSV', 'Período: ' + f.de + ' a ' + f.ate + '; Filtros: ' + (['processo', 'doca', 'turno', 'lider', 'colaborador', 'auditor', 'faixa'].map(function (k) { return f[k] ? k + '=' + f[k] : ''; }).filter(Boolean).join(', ') || 'nenhum')); }
  return comCache_(a, [tipo, f, ex], function () {
    const R = { geral: relGeral_, auditorias: relAuditorias_, auditores: relAuditores_, proc: relProc_, doca: relDoca_, colab: relColab_, tend: relTend_, export: relExport_, detalhe: relDetalhe_ }[tipo];
    const out = R(a, f, cfg, ex);
    out.corte = cfg.NOTA_CORTE_PCT; out.media = cfg.NOTA_MEDIA_PCT; out.pouco = cfg.POUCAS_AUDITORIAS;
    return mascarar_(a, tipo, out, ex);
  });
}
/** Sem a permissão "ver nomes", nenhum relatório devolve nome de colaborador (a máscara roda no servidor, depois do cálculo e antes da resposta). */
function mascarar_(a, tipo, out, ex) {
  if (tem_(a, 'ver_nomes')) return out;
  out.semNomes = true;
  const ocultar = function (l) { if (l && l.colab) l.colab = ''; };
  if (tipo === 'auditorias') out.linhas.forEach(ocultar);
  if (tipo === 'export') out.linhas.forEach(function (l) { l[4] = ''; });
  if (tipo === 'colab') { out.colabs = []; out.semAuditoria = []; out.totalSem = 0; }
  if (tipo === 'detalhe') {
    if (ex.kind === 'colab') throw new Error('Seu perfil não pode ver relatórios por colaborador.');
    (out.hist || []).forEach(ocultar);
  }
  return out;
}
function stat_(rows, cfg) {
  let s = 0, v = 0, o = 0, r = 0;
  rows.forEach(function (x) { s += x.pct; if (x.faixa === 'verde') v++; else if (x.faixa === 'observacao') o++; else r++; });
  return { n: rows.length, media: rows.length ? round1_(s / rows.length) : 0, v: v, o: o, r: r };
}
function agrupar_(rows, fn) { const m = Object.create(null); rows.forEach(function (r) { const k = fn(r); (m[k] = m[k] || []).push(r); }); return m; }
function unidade_(r) { return TIPO_PROC[r.proc] ? r.doca : r.lider; }
function rotulo_(r) { return TIPO_PROC[r.proc] ? r.doca : 'Time ' + r.lider; }
function top_(rows, n) {
  const of = Object.create(null);
  rows.forEach(function (r) { r.ncs.forEach(function (id) { const k = r.proc + ' › ' + id; of[k] = (of[k] || 0) + 1; }); });
  return Object.keys(of).map(function (k) { return [k, of[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, n);
}
function esperadas_(a, f) {
  const estr = lerAba_('Cad_Estrutura'), lids = lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }), keys = {};
  PROCESSOS.forEach(function (pr) {
    if (!procPermitido_(a, pr) || (f.processo && f.processo !== pr)) return;
    const t = TIPO_PROC[pr];
    if (t) estr.filter(function (e) { return e.Tipo === t && (!f.doca || e.Identificador === f.doca); }).forEach(function (e) { keys[pr + '|' + e.Identificador] = 1; });
    else if (!f.doca) lids.filter(function (l) { return (!f.lider || l.Nome === f.lider) && unidadeNoEscopo_(a, l.Nome); }).forEach(function (l) { keys[pr + '|' + l.Nome] = 1; });
  });
  return keys;
}
/** Visão Geral: período atual x período anterior de mesmo tamanho. Inclui "Em observação" em todos os recortes. */
function relGeral_(a, f, cfg) {
  const dias = difDias_(f.de, f.ate) + 1, fB = Object.assign({}, f, { de: addDias_(f.de, -dias), ate: addDias_(f.de, -1) });
  const esp = esperadas_(a, f), nEsp = Object.keys(esp).length;
  const res = function (rows, comOf) {
    const pp = {}, tu = {}, dc = {}, uniq = {};
    rows.forEach(function (r) { if (esp[r.proc + '|' + unidade_(r)]) uniq[r.proc + '|' + unidade_(r)] = 1; });
    const gp = agrupar_(rows, function (r) { return r.proc; });
    Object.keys(gp).forEach(function (k) { pp[k] = stat_(gp[k], cfg); });
    const gt = agrupar_(rows, function (r) { return r.turno || 'N/I'; });
    Object.keys(gt).forEach(function (k) { tu[k] = stat_(gt[k], cfg); });
    const gd = agrupar_(rows, function (r) { return r.proc + ' · ' + rotulo_(r); });
    Object.keys(gd).forEach(function (k) { dc[k] = stat_(gd[k], cfg); });
    const st = stat_(rows, cfg);
    return { total: st.n, media: st.media, conf: st.v, obs: st.o, bad: st.r, pend: Math.max(nEsp - Object.keys(uniq).length, 0), pp: pp, tu: tu, dc: dc, of: comOf ? top_(rows, 10) : [] };
  };
  const rowsA = auditorias_(a, f, true), rowsB = auditorias_(a, fB, true), A = res(rowsA, true), B = res(rowsB, false);
  const ofd = ofensores_(rowsA, rowsB), semanas = serieSemanal_(f, rowsA, cfg);
  A.crit = rowsA.filter(function (r) { return r.crit; }).length;
  B.crit = rowsB.filter(function (r) { return r.crit; }).length;
  const ins = [], pct = function (n, t) { return t ? round1_(n / t * 100) : 0; };
  // vermelho: inconformidade; amarelo: observação; verde: bom
  const tb = Object.keys(A.tu).map(function (k) { return [k, pct(A.tu[k].r, A.tu[k].n), A.tu[k].n]; }).sort(function (x, y) { return y[1] - x[1]; })[0];
  if (tb && tb[1] > 0) ins.push({ t: 'bad', txt: 'Turno ' + tb[0] + ' tem a maior taxa de inconformidade: ' + tb[1] + '% das auditorias.', go: { turno: tb[0], faixa: 'vermelho' } });
  const to = Object.keys(A.tu).map(function (k) { return [k, pct(A.tu[k].o, A.tu[k].n)]; }).sort(function (x, y) { return y[1] - x[1]; })[0];
  if (to && to[1] > 0) ins.push({ t: 'obs', txt: 'Turno ' + to[0] + ' concentra mais auditorias em observação: ' + to[1] + '%.', go: { turno: to[0], faixa: 'observacao' } });
  const oA = pct(A.obs, A.total), oB = pct(B.obs, B.total);
  if (A.total && B.total && oA - oB >= 5) ins.push({ t: 'obs', txt: 'Auditorias em observação subiram de ' + oB + '% para ' + oA + '% em relação ao período anterior.' });
  Object.keys(A.dc).map(function (k) { return [k, A.dc[k].media, A.dc[k].n]; }).sort(function (x, y) { return x[1] - y[1]; }).slice(0, 3)
    .filter(function (x) { return x[1] < cfg.NOTA_MEDIA_PCT; })
    .forEach(function (x) { ins.push({ t: x[1] < cfg.NOTA_CORTE_PCT ? 'bad' : 'obs', txt: 'Prioridade de verificação: ' + x[0] + ' (média ' + x[1].toFixed(1) + '%).', go: { processo: x[0].split(' · ')[0] } }); });
  Object.keys(A.pp).forEach(function (k) {
    const m = A.pp[k].media;
    if (m < cfg.NOTA_CORTE_PCT) ins.push({ t: 'bad', txt: 'Ação corretiva: ' + k + ' abaixo da nota de corte (' + m.toFixed(1) + '%).', go: { processo: k } });
    else if (m < cfg.NOTA_MEDIA_PCT) ins.push({ t: 'obs', txt: 'Atenção: ' + k + ' em observação, abaixo da nota média (' + m.toFixed(1) + '%).', go: { processo: k } });
  });
  if (A.of[0]) ins.push({ t: 'bad', txt: 'Maior ofensor: ' + A.of[0][0] + ' (' + A.of[0][1] + ' não conformidades).', go: { processo: A.of[0][0].split(' › ')[0] } });
  if (A.pend > 0) ins.push({ t: 'info', txt: A.pend + ' doca(s)/cluster(s)/time(s) sem auditoria no período.' });
  if (A.total && !ins.some(function (i) { return i.t === 'bad' || i.t === 'obs'; })) ins.push({ t: 'ok', txt: 'Todos os processos estão em conformidade no período.' });
  const ord = { bad: 0, obs: 1, info: 2, ok: 3 };
  ins.sort(function (x, y) { return ord[x.t] - ord[y.t]; });
  return { A: A, B: B, ins: ins, ofd: ofd, sem: semanas, tem_b: B.total > 0 };
}
/** Ofensores: taxa de falha = auditorias com a não conformidade / auditorias do processo, comparada ao período anterior, com a unidade (doca/cluster/time) mais frequente. */
function ofensores_(rowsA, rowsB) {
  const calc = function (rows) {
    const aud = Object.create(null), nc = Object.create(null), un = Object.create(null);
    rows.forEach(function (r) {
      aud[r.proc] = (aud[r.proc] || 0) + 1;
      r.ncs.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).forEach(function (id) {
        const k = r.proc + '|' + id;
        nc[k] = (nc[k] || 0) + 1;
        const u = (un[k] = un[k] || Object.create(null)), rt = rotulo_(r);
        u[rt] = (u[rt] || 0) + 1;
      });
    });
    return { aud: aud, nc: nc, un: un };
  };
  const A = calc(rowsA), B = calc(rowsB);
  return Object.keys(A.nc).map(function (k) {
    const i = k.indexOf('|'), proc = k.slice(0, i), id = k.slice(i + 1), tA = round1_(A.nc[k] / A.aud[proc] * 100);
    const tB = B.aud[proc] ? round1_((B.nc[k] || 0) / B.aud[proc] * 100) : null;
    const us = Object.keys(A.un[k]).sort(function (x, y) { return A.un[k][y] - A.un[k][x]; });
    return { proc: proc, id: id, nc: A.nc[k], aud: A.aud[proc], taxa: tA, taxaB: tB, dif: tB === null ? null : round1_(tA - tB), un: us[0] || '', uns: us.length };
  }).sort(function (x, y) { return y.taxa - x.taxa || y.nc - x.nc; }).slice(0, 8);
}
/** Série semanal da nota média (sempre por semana, qualquer que seja o período). */
function serieSemanal_(f, rows, cfg) {
  const chaves = []; let k = segunda_(f.de);
  while (k <= f.ate) { chaves.push(k); k = addDias_(k, 7); }
  const g = agrupar_(rows, function (r) { return segunda_(r.ts.slice(0, 10)); });
  return chaves.map(function (c) { const st = stat_(g[c] || [], cfg); return { k: c, n: st.n, m: st.n ? st.media : null, v: st.v, o: st.o, r: st.r }; });
}
function baldes_(f) {
  const dias = difDias_(f.de, f.ate) + 1, modo = dias <= 62 ? 'dia' : 'semana', chaves = [];
  if (modo === 'dia') for (let i = 0; i < dias; i++) chaves.push(addDias_(f.de, i));
  else { let k = segunda_(f.de); while (k <= f.ate) { chaves.push(k); k = addDias_(k, 7); } }
  return { modo: modo, chaves: chaves, de: function (r) { const d = r.ts.slice(0, 10); return modo === 'dia' ? d : segunda_(d); } };
}
function relAuditorias_(a, f, cfg, ex) {
  const rows = auditorias_(a, f, false).sort(function (x, y) { return y.ts.localeCompare(x.ts) || y.id.localeCompare(x.id); });
  const st = stat_(rows, cfg), total = rows.length, paginas = Math.max(1, Math.ceil(total / PAGINA)), pg = Math.min(ex.pagina, paginas);
  const b = baldes_(f), procs = PROCESSOS.filter(function (p) { return procPermitido_(a, p) && (!f.processo || f.processo === p); }), idx = {}, mat = {};
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  procs.forEach(function (p) { mat[p] = b.chaves.map(function () { return 0; }); });
  rows.forEach(function (r) { if (mat[r.proc] && idx[b.de(r)] !== undefined) mat[r.proc][idx[b.de(r)]]++; });
  let max = 0; procs.forEach(function (p) { mat[p].forEach(function (x) { if (x > max) max = x; }); });
  return {
    kpis: st, total: total, pagina: pg, paginas: paginas,
    linhas: rows.slice((pg - 1) * PAGINA, pg * PAGINA).map(function (r) { return { id: r.id, ts: r.ts, proc: r.proc, doca: r.doca, colab: r.colab, lider: r.lider, turno: r.turno, resp: r.resp, pct: r.pct, faixa: r.faixa, obs: r.obs.slice(0, 300) }; }),
    obsRec: rows.filter(function (r) { return r.faixa !== 'verde' && String(r.obs).trim(); }).slice(0, 6).map(function (r) { return { id: r.id, ts: r.ts, proc: r.proc, un: rotulo_(r), pct: r.pct, faixa: r.faixa, obs: r.obs.slice(0, 300) }; }),
    heat: { modo: b.modo, cols: b.chaves, rows: procs.map(function (p) { return { proc: p, v: mat[p] }; }), max: max }
  };
}
/** Traduções opcionais cadastradas (EN/ES) do subprocesso e da descrição de cada item do processo. Vazio = usa o texto original. */
function traducoesItens_(proc) {
  const m = Object.create(null);
  lerAba_('Cad_Processos_Perguntas').forEach(function (x) {
    if (x.Processo !== proc) return;
    if ((x.Subprocesso_EN || x.Subprocesso_ES) && !m[x.ID_Subprocesso]) m[x.ID_Subprocesso] = { en: String(x.Subprocesso_EN || ''), es: String(x.Subprocesso_ES || '') };
    if (x.Descricao_EN || x.Descricao_ES) m[x.ID_Subprocesso + '|' + x.Descricao_Item] = { en: String(x.Descricao_EN || ''), es: String(x.Descricao_ES || '') };
  });
  return m;
}
function itensAuditoria_(a, f, id) {
  if (!/^AUD-\d{14}-\d{3,5}$/.test(id)) throw new Error('Auditoria inválida.');
  const dia = id.substr(4, 4) + '-' + id.substr(8, 2) + '-' + id.substr(10, 2), g = Object.assign({}, f, { de: addDias_(dia, -1), ate: addDias_(dia, 1), processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '' });
  const r = auditorias_(a, g, false).find(function (x) { return x.id === id; });
  if (!r) throw new Error('Auditoria não encontrada ou fora do seu escopo de dados.');
  const s = aba_('Auditorias_Historico'), n = s.getLastRow() - 1, ids = s.getRange(2, 1, n, 1).getValues();
  let linha = -1;
  for (let i = n - 1; i >= 0; i--) if (String(ids[i][0]) === id) { linha = i + 2; break; }
  let det = [];
  try { det = JSON.parse(s.getRange(linha, 12, 1, 1).getValues()[0][0]); } catch (e) { det = []; }
  const trad = traducoesItens_(r.proc);
  return { id: id, proc: r.proc, doca: r.doca, colab: tem_(a, 'ver_nomes') ? r.colab : '', lider: r.lider, turno: r.turno, resp: r.resp, pct: r.pct, faixa: r.faixa, obs: r.obs, ts: r.ts, itens: det.map(function (d) { const t = trad[d.id + '|' + d.desc] || {}; return { id: d.id, desc: d.desc, critico: !!d.critico, ok: d.ok, id_en: (trad[d.id] || {}).en || '', id_es: (trad[d.id] || {}).es || '', desc_en: t.en || '', desc_es: t.es || '' }; }) };
}
function relAuditores_(a, f, cfg) {
  const rows = auditorias_(a, f, false), hoje = hoje_(), pf = perfis_();
  const users = usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).filter(function (u) { return usuarioAtivo_(u) && pf[u.Perfil] && pf[u.Perfil].perms.indexOf('auditar') > -1; });
  const semanas = Math.max((difDias_(f.de, f.ate) + 1) / 7, 1 / 7);
  const por = agrupar_(rows, function (r) { return r.email || 'nome:' + semAcento_(r.resp); });
  const linhas = users.map(function (u) {
    const em = String(u.Email_Google).trim().toLowerCase(), mine = (por[em] || []).concat(por['nome:' + semAcento_(u.Nome)] || []);
    const st = stat_(mine, cfg), dias = {}, procs = {};
    mine.forEach(function (r) { dias[r.ts.slice(0, 10)] = 1; procs[r.proc] = (procs[r.proc] || 0) + 1; });
    const ult = mine.map(function (r) { return r.ts; }).sort().pop() || '';
    return { email: em, nome: u.Nome, perfil: u.Perfil, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, porSemana: round1_(st.n / semanas), diasAtivos: Object.keys(dias).length, ultima: ult, procs: procs };
  }).sort(function (x, y) { return y.n - x.n || x.nome.localeCompare(y.nome, 'pt-BR'); });
  linhas.forEach(function (l, i) { l.rank = i + 1; });
  const b = baldes_(f), idx = {}, serie = b.chaves.map(function () { return 0; });
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  rows.forEach(function (r) { if (idx[b.de(r)] !== undefined) serie[idx[b.de(r)]]++; });
  const out = { linhas: linhas, total: rows.length, serie: { modo: b.modo, cols: b.chaves, v: serie }, metas: metasProgresso_(a, hoje, users), podeMetas: tem_(a, 'metas'), limitado: a.escopo.modo !== 'todos' || a.escopo.processos.length > 0 || a.escopo.turnos.length > 0 };
  out.users = users.map(function (u) { return { email: String(u.Email_Google).trim().toLowerCase(), nome: u.Nome, perfil: u.Perfil }; });
  return out;
}
function relProc_(a, f, cfg) {
  const rows = auditorias_(a, f, true), g = agrupar_(rows, function (r) { return r.proc; }), b = baldes_(f), idx = {};
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  const linhas = PROCESSOS.filter(function (p) { return procPermitido_(a, p) && (!f.processo || f.processo === p); }).map(function (p) {
    const l = g[p] || [], st = stat_(l, cfg), tu = {}, gt = agrupar_(l, function (r) { return r.turno; });
    Object.keys(gt).forEach(function (t) { tu[t] = stat_(gt[t], cfg); });
    const soma = b.chaves.map(function () { return 0; }), cnt = b.chaves.map(function () { return 0; });
    l.forEach(function (r) { const i = idx[b.de(r)]; if (i !== undefined) { soma[i] += r.pct; cnt[i]++; } });
    return { proc: p, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, tu: tu, of: top_(l, 5), serie: soma.map(function (s, i) { return cnt[i] ? round1_(s / cnt[i]) : null; }) };
  });
  return { linhas: linhas, cols: b.chaves, modo: b.modo };
}
function relDoca_(a, f, cfg) {
  const rows = auditorias_(a, f, false), g = agrupar_(rows, function (r) { return r.proc + '|' + r.doca; }), meio = addDias_(f.de, Math.floor((difDias_(f.de, f.ate) + 1) / 2)), linhas = [];
  PROCESSOS.forEach(function (p) {
    const t = TIPO_PROC[p];
    if (!t || !procPermitido_(a, p) || (f.processo && f.processo !== p)) return;
    lerAba_('Cad_Estrutura').filter(function (e) { return e.Tipo === t && (!f.doca || e.Identificador === f.doca); }).forEach(function (e) {
      const l = g[p + '|' + e.Identificador] || [], st = stat_(l, cfg);
      const h1 = l.filter(function (r) { return r.ts.slice(0, 10) < meio; }), h2 = l.filter(function (r) { return r.ts.slice(0, 10) >= meio; });
      const ult = l.slice().sort(function (x, y) { return y.ts.localeCompare(x.ts); })[0];
      linhas.push({
        proc: p, id: e.Identificador, simbolo: e.Cor_Simbolo, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r,
        faixa: st.n ? faixa_(st.media, cfg) : '', ult: ult ? ult.ts : '', tend: h1.length && h2.length ? round1_(stat_(h2, cfg).media - stat_(h1, cfg).media) : null
      });
    });
  });
  return { linhas: linhas };
}
function relColab_(a, f, cfg) {
  const rows = auditorias_(a, f, false), linhasC = {}, times = {};
  rows.forEach(function (r) {
    r.colabs.forEach(function (c) {
      if (f.colaborador && c.n !== f.colaborador) return;
      if (f.lider && c.l !== f.lider) return;
      const o = linhasC[c.n] = linhasC[c.n] || { nome: c.n, lider: c.l, turno: c.t, rs: [], ult: '' };
      o.rs.push(r); if (r.ts >= o.ult) { o.ult = r.ts; o.lider = c.l; o.turno = c.t; }
    });
    r.lids.forEach(function (l) { if (f.lider && l !== f.lider) return; (times[l] = times[l] || []).push(r); });
  });
  const wk = serieSemanal_(f, [], cfg).map(function (x) { return x.k; }).slice(-8), poucas = cfg.POUCAS_AUDITORIAS;
  const colabs = Object.keys(linhasC).map(function (k) {
    const o = linhasC[k], st = stat_(o.rs, cfg), gw = agrupar_(o.rs, function (r) { return segunda_(r.ts.slice(0, 10)); });
    const serie = wk.map(function (c) { return gw[c] ? stat_(gw[c], cfg).media : null; });
    return { nome: o.nome, lider: o.lider, turno: o.turno, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, ult: o.ult, serie: serie, pouca: st.n < poucas };
  }).sort(function (x, y) {
    // pior nota entre quem tem auditorias suficientes; quem tem poucas auditorias vem depois, com menos auditorias primeiro
    if (x.pouca !== y.pouca) return x.pouca ? 1 : -1;
    return (x.pouca ? x.n - y.n : x.media - y.media) || x.nome.localeCompare(y.nome, 'pt-BR');
  });
  const sem = [];
  if (!f.colaborador && !f.processo && !f.doca && !f.auditor && !f.faixa) {
    lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Colaborador' && ativo_(p) && !linhasC[p.Nome] && (!f.lider || p.Lider === f.lider) && (!f.turno || p.Turno === f.turno) && pessoaNoEscopo_(a, p); })
      .forEach(function (p) { sem.push({ nome: p.Nome, lider: p.Lider, turno: p.Turno }); });
  }
  const eq = Object.keys(times).map(function (k) {
    const st = stat_(times[k], cfg), nomes = {};
    times[k].forEach(function (r) { r.colabs.forEach(function (c) { if (c.l === k) nomes[c.n] = 1; }); });
    return { lider: k, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, colabs: Object.keys(nomes).length };
  }).sort(function (x, y) { return y.n - x.n; });
  return { colabs: colabs, semAuditoria: sem.slice(0, 300), totalSem: sem.length, times: eq };
}
function relTend_(a, f, cfg) {
  const rows = auditorias_(a, f, false), b = baldes_(f), idx = {}, g = agrupar_(rows, function (r) { return b.de(r); });
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  const serie = b.chaves.map(function (k) { const st = stat_(g[k] || [], cfg); return { k: k, n: st.n, m: st.n ? st.media : null, v: st.v, o: st.o, r: st.r }; });
  const porProc = {};
  PROCESSOS.filter(function (p) { return procPermitido_(a, p) && (!f.processo || f.processo === p); }).forEach(function (p) {
    const soma = b.chaves.map(function () { return 0; }), cnt = b.chaves.map(function () { return 0; });
    rows.filter(function (r) { return r.proc === p; }).forEach(function (r) { const i = idx[b.de(r)]; if (i !== undefined) { soma[i] += r.pct; cnt[i]++; } });
    porProc[p] = soma.map(function (s, i) { return cnt[i] ? round1_(s / cnt[i]) : null; });
  });
  const dias = difDias_(f.de, f.ate) + 1, metade = Math.floor(rows.length / 2), ord = rows.slice().sort(function (x, y) { return x.ts.localeCompare(y.ts); });
  const m1 = stat_(ord.slice(0, metade), cfg).media, m2 = stat_(ord.slice(metade), cfg).media;
  return { modo: b.modo, cols: b.chaves, serie: serie, porProc: porProc, dias: dias, delta: rows.length >= 4 ? round1_(m2 - m1) : null, total: rows.length };
}
function relDetalhe_(a, f, cfg, ex) {
  let g = Object.assign({}, f), titulo = '', sub = '';
  if (ex.kind === 'doca') {
    const p = ex.chave.split('|');
    if (p.length !== 2 || PROCESSOS.indexOf(p[0]) < 0 || !TIPO_PROC[p[0]]) throw new Error('Unidade inválida.');
    if (!procPermitido_(a, p[0])) throw new Error('Sem acesso a este processo.');
    g.processo = p[0]; g.doca = p[1]; titulo = p[1]; sub = p[0] + ' · ' + TIPO_PROC[p[0]];
  } else if (ex.kind === 'colab') { g.colaborador = ex.chave; titulo = ex.chave; sub = 'Colaborador'; }
  else if (ex.kind === 'lider') { g.lider = ex.chave; titulo = 'Time ' + ex.chave; sub = 'Equipe'; }
  else throw new Error('Tipo inválido.');
  const rows = auditorias_(a, g, true).sort(function (x, y) { return y.ts.localeCompare(x.ts); }), st = stat_(rows, cfg), b = baldes_(g), idx = {};
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  const soma = b.chaves.map(function () { return 0; }), cnt = b.chaves.map(function () { return 0; });
  rows.forEach(function (r) { const i = idx[b.de(r)]; if (i !== undefined) { soma[i] += r.pct; cnt[i]++; } });
  const pp = agrupar_(rows, function (r) { return r.proc; });
  return {
    titulo: titulo, sub: sub, kind: ex.kind, chave: ex.chave, kpis: st, ultima: rows[0] ? rows[0].ts : '',
    melhor: rows.length ? Math.max.apply(null, rows.map(function (r) { return r.pct; })) : null, pior: rows.length ? Math.min.apply(null, rows.map(function (r) { return r.pct; })) : null,
    modo: b.modo, cols: b.chaves, serie: soma.map(function (s, i) { return cnt[i] ? round1_(s / cnt[i]) : null; }),
    porProc: Object.keys(pp).map(function (k) { const s = stat_(pp[k], cfg); return { proc: k, n: s.n, media: s.media }; }),
    of: top_(rows, 8),
    hist: rows.slice(0, 40).map(function (r) { return { id: r.id, ts: r.ts, proc: r.proc, doca: r.doca, colab: r.colab, turno: r.turno, pct: r.pct, faixa: r.faixa }; })
  };
}
function relExport_(a, f, cfg, ex) {
  const rows = auditorias_(a, f, false).sort(function (x, y) { return y.ts.localeCompare(x.ts) || y.id.localeCompare(x.id); });
  const part = rows.slice(ex.offset, ex.offset + EXPORT_LOTE);
  return {
    total: rows.length, offset: ex.offset, fim: ex.offset + part.length >= rows.length,
    linhas: part.map(function (r) { return [r.id, r.ts, r.proc, r.doca, r.colab, r.lider, r.turno, r.resp, r.pct, r.status, r.obs]; })
  };
}
