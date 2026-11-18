
/* ---------- relatórios (tela única por tipo; todos usam S.flt) ---------- */
function filtrosAtuais() { return Object.assign({}, S.flt); }
function aviso(txt) { return '<div class="note">' + ic('info', 16) + '<span>' + txt + '</span></div>'; }
async function loadRel(v) {
  const el = $('#v-' + v), meu = ++S.seqRel;
  destruirGraficos();
  el.innerHTML = '<div class="card">' + skel(5) + '</div>';
  if (v === 'export') { renderExport(); return; }
  if (S.det && v !== 'auditorias' && v !== 'auditores') { await loadDetalhe(v); return; }
  let d;
  try { d = await rpc('relatorio', v, filtrosAtuais(), { pagina: S.pag }); }
  catch (e) { if (meu === S.seqRel) el.innerHTML = '<div class="card">Não foi possível carregar este relatório. Tente atualizar.</div>'; return; }
  if (meu !== S.seqRel || S.v !== v) return;
  S.d[v] = d;
  const R = { geral: drawGeral, auditorias: drawAuditorias, auditores: drawAuditores, proc: drawProc, doca: drawDoca, colab: drawColab, tend: drawTend }[v];
  R(el, d);
  tabelaInterativa(el);
}
const linkAud = function (id, txt) { return '<button type="button" class="btn sm" data-aud="' + esc(id) + '">' + esc(txt || 'Itens') + '</button>'; };

/* ----- Visão Geral ----- */
/** Frase-resumo para quem decide: nota, meta, comparação, principal ofensor e pontos de atenção. Cada frase é um trecho separado (traduzível). */
function resumoExec(d) {
  const A = d.A, B = d.B, f = [];
  if (!A.total) return f;
  const dm = Math.round((A.media - d.media) * 10) / 10, n = String(Math.abs(dm)).replace('.', ',');
  f.push(dm < 0 ? tpl('Nota média de {0} em {1} auditoria(s), {2} p.p. abaixo da meta de {3}%.', [pc(A.media), A.total, n, d.media])
    : dm > 0 ? tpl('Nota média de {0} em {1} auditoria(s), {2} p.p. acima da meta de {3}%.', [pc(A.media), A.total, n, d.media])
      : tpl('Nota média de {0} em {1} auditoria(s), exatamente na meta de {2}%.', [pc(A.media), A.total, d.media]));
  if (d.tem_b) {
    const df = Math.round((A.media - B.media) * 10) / 10, m = String(Math.abs(df)).replace('.', ',');
    f.push(df > 0 ? tpl('A nota média subiu {0} p.p. em relação ao período anterior.', [m]) : df < 0 ? tpl('A nota média caiu {0} p.p. em relação ao período anterior.', [m]) : 'A nota média ficou estável em relação ao período anterior.');
  } else f.push('Sem base de comparação com o período anterior.');
  if (d.ofd && d.ofd[0]) f.push(tpl('Principal ofensor: {0} › {1} (falha em {2}% das auditorias do processo).', [d.ofd[0].proc, nomeSub(d.ofd[0].proc, d.ofd[0].id), String(d.ofd[0].taxa).replace('.', ',')]));
  if (A.crit) f.push(tpl('Item crítico reprovado em {0} auditoria(s).', [A.crit]));
  if (A.pend) f.push(tpl('Unidades sem auditoria no período: {0}.', [A.pend]));
  return f;
}
function drawGeral(el, d) {
  const A = d.A, B = d.B, pctDe = function (x, n) { return x.total ? Math.round(n / x.total * 1000) / 10 : 0; };
  const confA = pctDe(A, A.conf), confB = pctDe(B, B.conf), obsA = pctDe(A, A.obs), obsB = pctDe(B, B.obs), badA = pctDe(A, A.bad), badB = pctDe(B, B.bad);
  const sb = ['Sem base de comparação', ''], dl = function (v, pv, sfx, inv) { return d.tem_b ? delta(v, pv, sfx, inv) : sb; };
  const ir = !!tela('auditorias'), go = function (o) { return ir && o ? ' data-go="' + esc(JSON.stringify(o)) + '" role="button" tabindex="0"' : ''; };
  const tom = A.total ? (faixa(A.media) === 'verde' ? 'ok' : faixa(A.media) === 'observacao' ? 'obs' : 'bad') : '';
  const dm = Math.round((A.media - d.media) * 10) / 10;
  const dist = !A.total ? '' : dm < 0 ? '<span class="pill vermelho">' + esc(tpl('Faltam {0} p.p. para a meta', [String(Math.abs(dm)).replace('.', ',')])) + '</span>' : dm > 0 ? '<span class="pill verde">' + esc(tpl('{0} p.p. acima da meta', [String(dm).replace('.', ',')])) + '</span>' : '<span class="pill verde">' + esc('Meta atingida') + '</span>';
  const cmp = !A.total ? '' : (function () { const x = d.tem_b ? delta(A.media, B.media, ' p.p.', false) : sb; return '<em class="' + (x[1] || '') + '">' + x[0] + '</em>'; })();
  const resumo = resumoExec(d).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join(' ');
  const k = [
    kpi('Auditorias realizadas', A.total, dl(A.total, B.total, '', false)),
    kpi('Unidades sem auditoria no período', A.pend, dl(A.pend, B.pend, '', true), A.pend ? 'obs' : 'ok'),
    kpi('Em conformidade (≥ ' + d.media + '%)', pc(confA), dl(confA, confB, '%', false), 'ok'),
    kpi('Em observação (' + d.corte + '% a ' + d.media + '%)', pc(obsA), dl(obsA, obsB, '%', true), 'obs'),
    kpi('Em inconformidade (< ' + d.corte + '%)', pc(badA), dl(badA, badB, '%', true), 'bad'),
    kpi('Auditorias com item crítico reprovado', A.crit, dl(A.crit, B.crit, '', true), A.crit ? 'bad' : 'ok')
  ].join('');
  const tag = { bad: 'Crítico', obs: 'Atenção', ok: 'Ok', info: 'Info' };
  const ins = d.ins.map(function (i) { return '<li class="' + i.t + (i.go && ir ? ' clk' : '') + '"' + go(i.go) + '><span class="tag-t">' + tag[i.t] + '</span><span>' + esc(i.txt) + '</span></li>'; }).join('') || '<li class="info"><span class="tag-t">Info</span><span>Sem alertas no período.</span></li>';
  const dif = function (o) {
    if (o.dif == null) return '<span class="muted" title="Sem base de comparação">—</span>';
    const c = o.dif > 0 ? 'it-no' : o.dif < 0 ? 'it-ok' : '';
    return '<span class="' + c + '">' + (o.dif > 0 ? ic('arrow-up', 12) : o.dif < 0 ? ic('arrow-down', 12) : ic('minus', 12)) + ' ' + String(Math.abs(o.dif)).replace('.', ',') + ' p.p.</span>';
  };
  const of = d.ofd.map(function (o) {
    return '<tr' + (ir ? ' class="clk"' : '') + go({ processo: o.proc }) + '><td>' + esc(nomeSub(o.proc, o.id)) + '<br><small class="muted">' + esc(o.proc) + '</small></td><td class="num" data-v="' + o.taxa + '"><b>' + pc(o.taxa) + '</b><br><small class="muted">' + o.nc + ' / ' + o.aud + '</small></td><td class="num">' + dif(o) + '</td><td>' + esc(o.un || '—') + (o.uns > 1 ? ' <small class="muted">+' + (o.uns - 1) + '</small>' : '') + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">Sem não conformidades no período.</td></tr>';
  el.innerHTML = (A.total ? '<div class="resumo card" aria-label="Resumo">' + resumo + '</div>' : aviso('Nenhuma auditoria finalizada no período com estes filtros.')) +
    '<div class="card hero"><div class="hero-l"><small>Nota média</small><b class="' + tom + '">' + pc(A.total ? A.media : null) + '</b><div class="hero-m"><span class="muted">' + esc(tpl('Meta de {0}%', [d.media])) + '</span>' + dist + '</div>' + cmp + '</div>' +
    '<div class="hero-r"><div class="hd"><b>Evolução semanal da nota média</b><span class="muted">linhas: corte ' + d.corte + '% e média ' + d.media + '%</span></div><div class="chartbox sm"><canvas id="g0"></canvas></div></div></div>' +
    '<div class="kpis k6">' + k + '</div>' +
    '<div class="cols"><div class="card"><div class="hd"><b>Situação por processo</b><span class="muted">100% = auditorias do processo (n no rótulo)</span></div><div class="chartbox"><canvas id="g1"></canvas></div></div>' +
    '<div class="card"><div class="hd"><b>Situação por turno</b><span class="muted">100% = auditorias do turno (n no rótulo)</span></div><div class="chartbox"><canvas id="g2"></canvas></div></div></div>' +
    '<div class="cols"><div class="card"><div class="hd"><b>Auditorias por semana e situação</b></div><div class="chartbox"><canvas id="g3"></canvas></div></div>' +
    '<div class="card"><div class="hd"><b>Nota média por processo</b><span class="muted">linhas: corte ' + d.corte + '% e média ' + d.media + '%</span></div><div class="chartbox"><canvas id="g4"></canvas></div></div></div>' +
    '<div class="cols"><div class="card"><div class="hd"><b>Maiores ofensores</b><span class="muted">taxa de falha = auditorias com a falha / auditorias do processo</span></div><div class="scroll"><table data-sort><thead><tr><th data-s="t">Sub-processo</th><th class="num" data-s="n">Taxa de falha</th><th class="num">Variação</th><th>Onde mais ocorre</th></tr></thead><tbody>' + of + '</tbody></table></div></div>' +
    '<div class="card"><div class="hd"><b>Insights</b>' + (ir ? '<span class="muted">clique para ver as auditorias</span>' : '') + '</div><ul class="ins">' + ins + '</ul></div></div>';
  const pct100 = function (id, labels, X, nomeDe) {
    const tot = labels.map(function (l) { return X[l] ? X[l].n : 0; }), cont = [labels.map(function (l) { return X[l] ? X[l].v : 0; }), labels.map(function (l) { return X[l] ? X[l].o : 0; }), labels.map(function (l) { return X[l] ? X[l].r : 0; })];
    const p = function (a) { return a.map(function (v, i) { return tot[i] ? Math.round(v / tot[i] * 1000) / 10 : 0; }); };
    const nm = ['Conforme', 'Em observação', 'Inconforme'], cor = [COR.verde, COR.observacao, COR.vermelho];
    mkChart(id, { type: 'bar', data: { labels: labels.map(function (l, i) { return [nomeDe ? nomeDe(l) : l, 'n=' + tot[i]]; }), datasets: cont.map(function (c, j) { return { label: nm[j], backgroundColor: cor[j], data: p(c), stack: 's', counts: c }; }) },
      options: { scales: { x: { stacked: true }, y: { stacked: true, min: 0, max: 100, ticks: { callback: function (v) { return v + '%'; } } } },
        plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + c.dataset.counts[c.dataIndex] + ' (' + String(c.parsed.y).replace('.', ',') + '%)'; } } } } } });
  };
  const procs = S.procs.filter(function (p) { return A.pp[p]; });
  pct100('g1', procs, A.pp);
  const tur = Object.keys(A.tu).sort();
  pct100('g2', tur, A.tu);
  const lbl = d.sem.map(function (x) { return x.k.slice(8, 10) + '/' + x.k.slice(5, 7); });
  mkChart('g0', { type: 'line', data: { labels: lbl, datasets: [{ label: 'Nota média', data: d.sem.map(function (x) { return x.m; }), borderColor: ink(), backgroundColor: ink(), tension: .25, spanGaps: true, pointRadius: 3 }] },
    options: { plugins: { legend: { display: false }, linhasCorte: { corte: d.corte, media: d.media } }, scales: { y: { min: 0, max: 100 } } }, plugins: [linhasCorte] });
  mkChart('g3', { type: 'bar', data: { labels: lbl, datasets: [
    { label: 'Conforme', backgroundColor: COR.verde, data: d.sem.map(function (x) { return x.v; }), stack: 's' },
    { label: 'Em observação', backgroundColor: COR.observacao, data: d.sem.map(function (x) { return x.o; }), stack: 's' },
    { label: 'Inconforme', backgroundColor: COR.vermelho, data: d.sem.map(function (x) { return x.r; }), stack: 's' }] },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
  mkChart('g4', { type: 'bar', data: { labels: procs, datasets: [{ label: 'Nota média atual', backgroundColor: ink(), data: procs.map(function (p) { return A.pp[p].media; }) }, { label: 'Período anterior', backgroundColor: cinza(), data: procs.map(function (p) { return B.pp[p] ? B.pp[p].media : 0; }) }] },
    options: { scales: { y: { min: 0, max: 100 } }, plugins: { linhasCorte: { corte: d.corte, media: d.media } } }, plugins: [linhasCorte] });
}
const ink = function () { return tema() ? '#C9D1D9' : '#2F3640'; };

/* ----- Auditorias realizadas ----- */
function heatHtml(h) {
  if (!h.rows.length) return vz('Sem processos no escopo.');
  const th = h.cols.map(function (c) { return '<th class="colh">' + (h.modo === 'dia' ? c.slice(8, 10) : c.slice(8, 10) + '/' + c.slice(5, 7)) + '</th>'; }).join('');
  const body = h.rows.map(function (r) {
    return '<tr><th class="rowh">' + esc(r.proc) + '</th>' + r.v.map(function (n, i) {
      const a = n && h.max ? Math.max(0.18, n / h.max) : 0;
      return '<td><i title="' + esc(r.proc + ' · ' + h.cols[i] + ': ' + n) + '"' + (n ? ' style="background:rgba(var(--hm),' + a.toFixed(2) + ');color:' + (a > 0.5 ? 'var(--card)' : 'var(--tx)') + '"' : '') + '>' + (n && h.cols.length <= 31 ? n : '') + '</i></td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="heat"><table><thead><tr><th></th>' + th + '</tr></thead><tbody>' + body + '</tbody></table></div><div class="hleg"><span>Menos</span><i style="background:rgba(var(--hm),.18)"></i><i style="background:rgba(var(--hm),.5)"></i><i style="background:rgba(var(--hm),1)"></i><span>Mais auditorias · cada célula é um ' + (h.modo === 'dia' ? 'dia' : 'semana') + '</span></div>';
}
function drawAuditorias(el, d) {
  const k = d.kpis, nomes = !d.semNomes, nc = nomes ? 7 : 6;
  const rows = d.linhas.map(function (r) {
    return '<tr class="exp" data-x="' + esc(r.id) + '" tabindex="0" aria-expanded="false"><td>' + fmtDt(r.ts) + '</td><td>' + esc(r.proc) + '</td><td>' + chipEst(r.proc, r.doca) + esc(r.doca || '—') + '</td>' + (nomes ? '<td>' + esc(r.colab || '—') + '</td>' : '') + '<td class="num">' + pc(r.pct) + '</td><td>' + pill(r.faixa) + '</td><td class="xc">' + ic('chevron-down', 14) + '</td></tr>' +
      '<tr class="xd hidden"><td colspan="' + nc + '"><div class="xg"><span><small>Líder</small>' + esc(r.lider || '—') + '</span><span><small>Turno</small>' + esc(r.turno || '—') + '</span><span><small>Auditor</small>' + esc(r.resp) + '</span>' +
      '<span class="xo"><small>Observações</small>' + (r.obs ? esc(r.obs) : '<em class="muted">Sem observações</em>') + '</span><span>' + linkAud(r.id) + '</span></div></td></tr>';
  }).join('') || '<tr><td colspan="' + nc + '" class="muted">Nenhuma auditoria finalizada com estes filtros.</td></tr>';
  const rec = d.obsRec && d.obsRec.length ? '<div class="card"><div class="hd"><b>Observações recentes de auditorias não conformes</b><span class="muted">últimas ' + d.obsRec.length + ' com texto</span></div><ul class="obsl">' +
    d.obsRec.map(function (o) { return '<li><div>' + pill(o.faixa) + ' <b>' + esc(o.proc) + '</b> · ' + esc(o.un) + ' <span class="muted">' + fmtDt(o.ts) + ' · ' + pc(o.pct) + '</span></div><p>' + esc(o.obs) + '</p></li>'; }).join('') + '</ul></div>' : '';
  el.innerHTML = '<div class="kpis">' + kpi('Auditorias finalizadas', d.total) + kpi('Nota média', pc(k.media), null, k.n ? (faixa(k.media) === 'verde' ? 'ok' : faixa(k.media) === 'observacao' ? 'obs' : 'bad') : '') +
    kpi('Conforme', k.v, null, 'ok') + kpi('Em observação', k.o, null, 'obs') + kpi('Inconforme', k.r, null, 'bad') + '</div>' + rec +
    '<div class="card"><div class="hd"><b>Cobertura por dia e processo</b></div>' + heatHtml(d.heat) + '</div>' +
    '<div class="card"><div class="hd"><b>Auditorias</b><span class="muted">Clique em uma linha para ver líder, turno, auditor e observações · Página ' + d.pagina + ' de ' + d.paginas + '</span></div><div class="scroll"><table class="tbx"><thead><tr><th>Data</th><th>Processo</th><th>Doca / cluster</th>' + (nomes ? '<th>Colaboradores</th>' : '') + '<th class="num">Nota</th><th>Situação</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="pager"><button type="button" class="btn sm" data-pg="-1"' + (d.pagina <= 1 ? ' disabled' : '') + '>' + ic('chevron-left', 14) + 'Anterior</button><button type="button" class="btn sm" data-pg="1"' + (d.pagina >= d.paginas ? ' disabled' : '') + '>Próxima' + ic('chevron-right', 14) + '</button></div></div>';
}
async function abrirItens(id) {
  let d;
  try { d = await rpc('relatorio', 'itensAuditoria', filtrosAtuais(), { id: id }); } catch (e) { return; }
  const itens = d.itens.map(function (i) {
    const t = i.ok === true ? '<span class="it-ok">Conforme</span>' : i.ok === false ? '<span class="it-no">Não conforme</span>' : '<span class="it-na">N/A</span>';
    const idT = (LANG === 'en' ? i.id_en : LANG === 'es' ? i.id_es : '') || i.id, dT = (LANG === 'en' ? i.desc_en : LANG === 'es' ? i.desc_es : '') || i.desc;
    return '<tr><td>' + esc(idT) + '</td><td>' + esc(dT) + (i.critico ? '<span class="crit">CRÍTICO</span>' : '') + '</td><td>' + t + '</td></tr>';
  }).join('') || '<tr><td colspan="3" class="muted">Sem itens registrados.</td></tr>';
  modal('<div class="mhd"><div><h2 id="modalT">' + esc(d.proc) + ' · ' + esc(d.doca || 'Time ' + d.lider) + '</h2><span class="muted">' + fmtDt(d.ts) + ' · ' + esc(d.resp) + ' · turno ' + esc(d.turno || '—') + '</span></div><button type="button" class="btn ico" data-fechar aria-label="Fechar">' + ic('x', 16) + '</button></div>' +
    '<div class="mb" style="margin-bottom:12px">' + pill(d.faixa) + '<b>' + pc(d.pct) + '</b><span>Colaboradores: ' + esc(d.colab || '—') + '</span><span>Líder: ' + esc(d.lider || '—') + '</span></div>' +
    '<div class="scroll"><table><thead><tr><th>Sub-processo</th><th>Item</th><th>Resultado</th></tr></thead><tbody>' + itens + '</tbody></table></div>' + (d.obs ? '<p style="margin-top:12px"><b>Observações:</b> ' + esc(d.obs) + '</p>' : ''));
}

/* ----- Auditores e metas ----- */
function drawAuditores(el, d) {
  const ranking = d.linhas.map(function (l) {
    return '<tr><td class="num">' + l.rank + '</td><td>' + esc(l.nome) + '<br><small class="muted">' + esc(l.perfil) + '</small></td><td class="num" data-v="' + l.n + '">' + l.n + '</td><td class="num" data-v="' + l.porSemana + '">' + String(l.porSemana).replace('.', ',') + '</td><td class="num">' + l.diasAtivos + '</td><td class="num">' + (l.n ? pc(l.media) : '—') + '</td><td>' + (l.n ? stk(l) : '') + '</td><td>' + fmtDt(l.ultima) + '</td></tr>';
  }).join('') || '<tr><td colspan="8" class="muted">Nenhum auditor no escopo.</td></tr>';
  el.innerHTML = (d.limitado ? aviso('Os números consideram apenas as auditorias dentro dos dados que o seu perfil enxerga.') : '') +
    '<div class="cols"><div class="card"><div class="hd"><b>Ritmo de auditorias</b></div><div class="chartbox sm"><canvas id="a1"></canvas></div></div>' +
    '<div class="card"><div class="hd"><b>Auditorias por auditor</b></div><div class="chartbox sm"><canvas id="a2"></canvas></div></div></div>' +
    '<div class="card"><div class="hd"><b>Ranking de auditores</b><span class="muted">' + d.total + ' auditoria(s) no período</span></div><div class="scroll"><table data-sort><thead><tr><th class="num">#</th><th data-s="t">Auditor</th><th class="num" data-s="n">Auditorias</th><th class="num" data-s="n">Por semana</th><th class="num" data-s="n">Dias ativos</th><th class="num" data-s="n">Nota média</th><th>Resultado</th><th data-s="t">Última</th></tr></thead><tbody>' + ranking + '</tbody></table></div></div>' +
    '<div id="metasBox"></div>';
  mkChart('a1', { type: 'bar', data: { labels: d.serie.cols.map(function (c) { return c.slice(8, 10) + '/' + c.slice(5, 7); }), datasets: [{ label: 'Auditorias', backgroundColor: ink(), data: d.serie.v }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  const top = d.linhas.filter(function (l) { return l.n > 0; }).slice(0, 10);
  mkChart('a2', { type: 'bar', data: { labels: top.map(function (l) { return l.nome; }), datasets: [{ label: 'Auditorias', backgroundColor: ink(), data: top.map(function (l) { return l.n; }) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
  S.metas = d.metas; S.metaUsers = d.users; S.podeMetas = d.podeMetas;
  desenharMetas();
}
function resumoAlvos(m) {
  const c = { no_ritmo: 0, em_risco: 0, atingida: 0, nao_atingida: 0, futura: 0, inativa: 0 };
  m.alvos.forEach(function (a) { c[a.status]++; });
  return c;
}
function desenharMetas() {
  const box = $('#metasBox'); if (!box) return;
  const ms = (S.metas || []).slice().sort(function (a, b) { return b.ini.localeCompare(a.ini); });
  const lista = ms.map(function (m) {
    const c = resumoAlvos(m), alvo = m.tipo === 'Pessoa' ? ((S.metaUsers.find(function (u) { return u.email === String(m.alvo).toLowerCase(); }) || {}).nome || m.alvo) : 'Perfil ' + m.alvo;
    const linhas = m.alvos.map(function (a) {
      const p = Math.min(100, a.feito / m.qtd * 100);
      return '<div class="meta-t"><span class="nm">' + esc(a.nome) + '</span>' + meter(p, a.status) + '<span class="num">' + a.feito + ' / ' + m.qtd + '</span>' + pill(a.status, TXT_META[a.status]) + '</div>';
    }).join('') || '<div class="muted">Nenhum usuário ativo atende a esta meta.</div>';
    return '<div class="card"><div class="hd"><div><b>' + esc(alvo) + '</b> · ' + m.qtd + ' auditoria(s)' + (m.processos.length ? ' em ' + esc(m.processos.join(', ')) : ' em qualquer processo') + '<br><small class="muted">' + fmtD(m.ini) + ' a ' + fmtD(m.fim) + (m.desc ? ' · ' + esc(m.desc) : '') + (m.ativa ? '' : ' · inativa') + '</small></div>' +
      (S.podeMetas ? '<div><button type="button" class="btn sm" data-meta-e="' + esc(m.id) + '">' + ic('pencil', 14) + 'Editar</button> <button type="button" class="btn sm bad" data-meta-x="' + esc(m.id) + '">' + ic('trash', 14) + 'Excluir</button></div>' : '') + '</div>' +
      '<div class="muted" style="margin-bottom:6px"><span>No ritmo: ' + c.no_ritmo + '</span> · <span>Em risco: ' + c.em_risco + '</span> · <span>Atingidas: ' + c.atingida + '</span> · <span>Não atingidas: ' + c.nao_atingida + '</span></div>' + linhas + '</div>';
  }).join('') || '<div class="card">' + vz('Nenhuma meta cadastrada.') + '</div>';
  box.innerHTML = '<div class="toolbar" style="margin-top:8px"><b style="font-size:15px">Metas</b>' + (S.podeMetas ? '<button type="button" class="btn pri" data-meta-n="1">' + ic('plus', 14) + 'Nova meta</button>' : '') + '<span class="muted">Só auditorias finalizadas contam para a meta.</span></div>' + lista;
}
function abrirMeta(id) {
  const m = id ? (S.metas || []).find(function (x) { return x.id === id; }) : null;
  const hoje = ymd(new Date()), fim = new Date(); fim.setDate(fim.getDate() + 29);
  const v = m || { tipo: 'Pessoa', alvo: '', qtd: 10, processos: [], ini: hoje, fim: ymd(fim), desc: '', ativa: true };
  const perfis = []; (S.metaUsers || []).forEach(function (u) { if (perfis.indexOf(u.perfil) < 0) perfis.push(u.perfil); });
  S.metaEd = { id: id || '' };
  modal('<div class="mhd"><h2 id="modalT">' + (m ? 'Editar meta' : 'Nova meta') + '</h2><button type="button" class="btn ico" data-fechar aria-label="Fechar">' + ic('x', 16) + '</button></div>' +
    '<div class="grid"><label>Meta para<select id="mt-tipo"><option value="Pessoa"' + (v.tipo === 'Pessoa' ? ' selected' : '') + '>Uma pessoa</option><option value="Perfil"' + (v.tipo === 'Perfil' ? ' selected' : '') + '>Todos de um perfil</option></select></label>' +
    '<label><span id="mt-alvoL">Auditor</span> <span class="req">*</span><select id="mt-alvo"></select><span class="err" data-me="alvo"></span></label>' +
    '<label>Quantidade de auditorias <span class="req">*</span><input type="number" id="mt-qtd" min="1" max="9999" step="1" value="' + esc(v.qtd) + '"><span class="err" data-me="qtd"></span></label>' +
    '<label>Início <span class="req">*</span><input type="date" id="mt-ini" value="' + esc(v.ini) + '"><span class="err" data-me="ini"></span></label>' +
    '<label>Fim <span class="req">*</span><input type="date" id="mt-fim" value="' + esc(v.fim) + '"><span class="err" data-me="fim"></span></label>' +
    '<label>Descrição (opcional)<input id="mt-desc" maxlength="200" value="' + esc(v.desc) + '"><span class="err" data-me="desc"></span></label></div>' +
    '<div class="sect">Processos (vazio = qualquer processo)</div><div class="grid" id="mt-procs">' + S.procs.map(function (p) {
      return '<label class="perm"><input type="checkbox" value="' + esc(p) + '"' + (v.processos.indexOf(p) > -1 ? ' checked' : '') + '><span><b>' + esc(p) + '</b></span></label>';
    }).join('') + '</div><span class="err" data-me="processos"></span>' +
    '<label class="perm" style="margin-top:12px"><input type="checkbox" id="mt-ativa"' + (v.ativa ? ' checked' : '') + '><span><b>Meta ativa</b><small>Metas inativas deixam de aparecer para o auditor.</small></span></label>' +
    '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn pri" id="mt-ok">Salvar meta</button></div>');
  const alvos = function () {
    const t = $('#mt-tipo').value, sel = $('#mt-alvo'), lista = t === 'Pessoa' ? (S.metaUsers || []).map(function (u) { return [u.email, u.nome]; }) : perfis.map(function (p) { return [p, p]; });
    $('#mt-alvoL').textContent = t === 'Pessoa' ? 'Auditor' : 'Perfil';
    sel.innerHTML = '<option value="">Selecione…</option>' + lista.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(v.alvo).toLowerCase() === String(x[0]).toLowerCase() && v.tipo === t ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  };
  alvos(); $('#mt-tipo').onchange = alvos;
  $('#mt-ok').onclick = salvarMetaUI;
}
async function salvarMetaUI() {
  $$('#modal [data-me]').forEach(function (s) { s.textContent = ''; });
  const o = { id: S.metaEd.id, tipo: $('#mt-tipo').value, alvo: $('#mt-alvo').value, qtd: $('#mt-qtd').value, ini: $('#mt-ini').value, fim: $('#mt-fim').value, desc: $('#mt-desc').value, ativa: $('#mt-ativa').checked, processos: $$('#mt-procs input:checked').map(function (i) { return i.value; }) };
  const e = {};
  if (!o.alvo) e.alvo = 'Selecione para quem é a meta.';
  if (vazio(o.qtd) || !(Number(o.qtd) >= 1) || Math.floor(Number(o.qtd)) !== Number(o.qtd) || Number(o.qtd) > 9999) e.qtd = 'Informe um número inteiro entre 1 e 9999.';
  if (!o.ini) e.ini = 'Informe a data inicial.'; if (!o.fim) e.fim = 'Informe a data final.';
  if (o.ini && o.fim && o.ini > o.fim) e.fim = 'A data final deve ser igual ou posterior à inicial.';
  const mostra = function (er) { Object.keys(er).forEach(function (k) { const s = $('#modal [data-me="' + k + '"]'); if (s) s.textContent = er[k]; }); };
  if (Object.keys(e).length) { mostra(e); toast('Corrija os campos destacados.', true); return; }
  const b = $('#mt-ok'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    const r = await rpc('salvarMeta', o);
    if (!r.ok) { if (r.erros) mostra(r.erros); toast(r.msg || 'O servidor recusou a meta.', true); b.disabled = false; b.textContent = 'Salvar meta'; return; }
    S.metas = r.metas; fecharModal(); desenharMetas(); toast('Meta salva');
  } catch (x) { b.disabled = false; b.textContent = 'Salvar meta'; }
}
async function excluirMetaUI(id) {
  const m = (S.metas || []).find(function (x) { return x.id === id; }); if (!m) return;
  modal('<div class="mhd"><h2 id="modalT">Excluir meta</h2></div><p>Excluir esta meta de ' + m.qtd + ' auditoria(s)? O histórico de auditorias não é afetado.</p><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn pri" id="mx-ok">Excluir</button></div>');
  $('#mx-ok').onclick = async function () {
    $('#mx-ok').disabled = true;
    try {
      const r = await rpc('excluirMeta', id);
      if (!r.ok) { toast(r.msg, true); fecharModal(); return; }
      S.metas = r.metas; fecharModal(); desenharMetas(); toast('Meta excluída');
    } catch (e) { $('#mx-ok').disabled = false; }
  };
}

/* ----- Por processo ----- */
function drawProc(el, d) {
  const cards = d.linhas.map(function (l, i) {
    const tu = Object.keys(l.tu).sort().map(function (t) { return '<tr><td>' + esc(t) + '</td><td class="num">' + l.tu[t].n + '</td><td class="num">' + pc(l.tu[t].media) + '</td><td>' + stk(l.tu[t]) + '</td></tr>'; }).join('');
    const of = l.of.map(function (o) { return '<tr><td>' + esc(nomeSub(l.proc, o[0].replace(l.proc + ' › ', ''))) + '</td><td class="num">' + o[1] + '</td></tr>'; }).join('');
    return '<div class="card"><div class="hd"><div><b style="font-size:15px">' + esc(l.proc) + '</b> ' + (l.n ? pill(faixa(l.media), pc(l.media) + ' · ' + TXT_FAIXA_C[faixa(l.media)]) : pill('', 'Sem auditorias')) + '</div><span class="muted">' + l.n + ' auditoria(s)</span></div>' +
      (l.n ? '<div class="cols"><div><div class="chartbox sm"><canvas id="p' + i + '"></canvas></div></div><div>' +
        '<div class="scroll"><table><thead><tr><th>Turno</th><th class="num">Auditorias</th><th class="num">Nota</th><th>Resultado</th></tr></thead><tbody>' + (tu || '<tr><td colspan="4" class="muted">—</td></tr>') + '</tbody></table></div>' +
        '<div class="sect">Principais ofensores</div><div class="scroll"><table><tbody>' + (of || '<tr><td class="muted">Sem não conformidades.</td></tr>') + '</tbody></table></div></div></div>' : vz('Nenhuma auditoria finalizada neste processo com estes filtros.')) + '</div>';
  }).join('') || vz('Nenhum processo disponível.');
  el.innerHTML = cards;
  d.linhas.forEach(function (l, i) {
    if (!l.n) return;
    mkChart('p' + i, { type: 'line', data: { labels: d.cols.map(function (c) { return c.slice(8, 10) + '/' + c.slice(5, 7); }), datasets: [{ label: 'Nota média', data: l.serie, borderColor: ink(), backgroundColor: ink(), tension: .25, spanGaps: true, pointRadius: 3 }] },
      options: { plugins: { legend: { display: false }, linhasCorte: { corte: d.corte, media: d.media } }, scales: { y: { min: 0, max: 100 } } }, plugins: [linhasCorte] });
  });
}

/* ----- Por doca e cluster ----- */
function drawDoca(el, d) {
  const rows = d.linhas.map(function (l) {
    const tend = l.tend == null ? '<span class="muted">—</span>' : '<span class="' + (l.tend > 0 ? 'it-ok' : l.tend < 0 ? 'it-no' : '') + '">' + (l.tend > 0 ? ic('arrow-up', 12) : l.tend < 0 ? ic('arrow-down', 12) : ic('minus', 12)) + ' ' + String(Math.abs(l.tend)).replace('.', ',') + ' p.p.</span>';
    return '<tr class="clk" data-det="doca" data-chave="' + esc(l.proc + '|' + l.id) + '"><td>' + esc(l.proc) + '</td><td>' + chipCS(l.simbolo, 18) + esc(l.id) + '</td><td class="num" data-v="' + l.n + '">' + l.n + '</td><td class="num" data-v="' + (l.n ? l.media : -1) + '">' + (l.n ? pc(l.media) : '—') + '</td><td>' + (l.n ? pill(l.faixa) : pill('', 'Sem auditoria')) + '</td><td>' + (l.n ? stk(l) : '') + '</td><td data-v="' + esc(l.ult) + '">' + fmtDt(l.ult) + '</td><td data-v="' + (l.tend == null ? -999 : l.tend) + '">' + tend + '</td></tr>';
  }).join('') || '<tr><td colspan="8" class="muted">Nenhuma doca ou cluster com estes filtros.</td></tr>';
  el.innerHTML = '<div class="card"><div class="toolbar"><input type="search" data-busca placeholder="Buscar doca ou cluster…" aria-label="Buscar"><span class="muted">Clique em uma linha para ver o detalhe. Ordene pelos títulos.</span></div><div class="scroll"><table data-sort><thead><tr><th data-s="t">Processo</th><th data-s="t">Doca / cluster</th><th class="num" data-s="n">Auditorias</th><th class="num" data-s="n">Nota média</th><th>Situação</th><th>Resultado</th><th data-s="t">Última</th><th data-s="n">Evolução</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

/* ----- Por colaborador e equipe ----- */
function drawColab(el, d) {
  const ir = !!tela('auditorias');
  const rows = d.colabs.map(function (c) {
    return '<tr class="clk" data-det="colab" data-chave="' + esc(c.nome) + '"><td>' + esc(c.nome) + (c.pouca ? ' <span class="pill neutro" title="' + esc(tpl('Menos de {0} auditorias: a nota média ainda não é confiável.', [d.pouco])) + '">Poucas auditorias</span>' : '') + '</td><td>' + esc(c.lider || '—') + '</td><td>' + esc(c.turno || '—') + '</td><td class="num" data-v="' + c.n + '">' + c.n + '</td><td class="num" data-v="' + c.media + '">' + pc(c.media) + '</td><td>' + stk(c) + '</td><td class="tnd" data-v="' + (c.serie.filter(function (v) { return v != null; }).pop() || 0) + '" title="Nota média por semana (últimas ' + c.serie.length + ')">' + sparkSvg(c.serie) + '</td><td data-v="' + esc(c.ult) + '">' + fmtDt(c.ult) + '</td>' +
      '<td>' + (ir ? '<button type="button" class="btn sm" data-go="' + esc(JSON.stringify({ colaborador: c.nome })) + '">Ver auditorias</button>' : '') + '</td></tr>';
  }).join('') || '<tr><td colspan="9" class="muted">Nenhum colaborador auditado com estes filtros.</td></tr>';
  const eq = d.times.map(function (t) {
    return '<tr class="clk" data-det="lider" data-chave="' + esc(t.lider) + '"><td>Time ' + esc(t.lider) + '</td><td class="num">' + t.colabs + '</td><td class="num" data-v="' + t.n + '">' + t.n + '</td><td class="num" data-v="' + t.media + '">' + pc(t.media) + '</td><td>' + stk(t) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">Nenhuma equipe com auditorias.</td></tr>';
  const sem = d.semAuditoria.length ? '<div class="card"><div class="hd"><b>Sem auditoria no período</b><span class="muted">' + d.totalSem + ' colaborador(es) ativo(s)' + (d.totalSem > d.semAuditoria.length ? ' (mostrando ' + d.semAuditoria.length + ')' : '') + '</span></div><div class="scroll"><table><thead><tr><th>Colaborador</th><th>Líder</th><th>Turno</th></tr></thead><tbody>' +
    d.semAuditoria.map(function (s) { return '<tr><td>' + esc(s.nome) + '</td><td>' + esc(s.lider || '—') + '</td><td>' + esc(s.turno || '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '';
  const colabs = d.semNomes ? aviso('Seu perfil não exibe nomes de colaboradores. As equipes continuam disponíveis.') :
    '<div class="card"><div class="toolbar"><b>Colaboradores</b><input type="search" data-busca placeholder="Buscar colaborador…" aria-label="Buscar colaborador"><span class="muted">' + esc(tpl('Ordem: pior nota entre quem tem {0} ou mais auditorias; quem tem menos vem depois.', [d.pouco])) + '</span></div><div class="scroll"><table data-sort><thead><tr><th data-s="t">Colaborador</th><th data-s="t">Líder</th><th data-s="t">Turno</th><th class="num" data-s="n">Auditorias</th><th class="num" data-s="n">Nota média</th><th>Resultado</th><th data-s="n">Tendência</th><th data-s="t">Última auditoria</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' + sem;
  el.innerHTML = '<div class="card"><div class="hd"><b>Equipes</b></div><div class="scroll"><table data-sort><thead><tr><th data-s="t">Time</th><th class="num" data-s="n">Colaboradores auditados</th><th class="num" data-s="n">Auditorias</th><th class="num" data-s="n">Nota média</th><th>Resultado</th></tr></thead><tbody>' + eq + '</tbody></table></div></div>' + colabs;
}

/* ----- Tendência ----- */
function drawTend(el, d) {
  const lbl = d.cols.map(function (c) { return c.slice(8, 10) + '/' + c.slice(5, 7); });
  const dl = d.delta == null ? kpi('Variação no período', '—', ['Poucas auditorias para comparar', '']) : kpi('Variação no período', (d.delta > 0 ? '+' : '') + String(d.delta).replace('.', ',') + ' p.p.', ['Segunda metade vs. primeira metade', d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : ''], d.delta > 0 ? 'ok' : d.delta < 0 ? 'bad' : '');
  el.innerHTML = '<div class="kpis">' + kpi('Auditorias no período', d.total) + kpi('Dias no período', d.dias) + dl + '</div>' +
    '<div class="card"><div class="hd"><b>Nota média ' + (d.modo === 'dia' ? 'por dia' : 'por semana') + '</b><span class="muted">linhas: corte ' + d.corte + '% e média ' + d.media + '%</span></div><div class="chartbox"><canvas id="t1"></canvas></div></div>' +
    '<div class="cols"><div class="card"><div class="hd"><b>Situação das auditorias</b></div><div class="chartbox"><canvas id="t2"></canvas></div></div>' +
    '<div class="card"><div class="hd"><b>Nota média por processo</b></div><div class="chartbox"><canvas id="t3"></canvas></div></div></div>';
  mkChart('t1', { type: 'line', data: { labels: lbl, datasets: [{ label: 'Nota média', data: d.serie.map(function (s) { return s.m; }), borderColor: ink(), backgroundColor: ink(), tension: .25, spanGaps: true, pointRadius: 3 }] }, options: { plugins: { legend: { display: false }, linhasCorte: { corte: d.corte, media: d.media } }, scales: { y: { min: 0, max: 100 } } }, plugins: [linhasCorte] });
  mkChart('t2', { type: 'bar', data: { labels: lbl, datasets: [
    { label: 'Conforme', backgroundColor: COR.verde, data: d.serie.map(function (s) { return s.v; }), stack: 's' },
    { label: 'Em observação', backgroundColor: COR.observacao, data: d.serie.map(function (s) { return s.o; }), stack: 's' },
    { label: 'Inconforme', backgroundColor: COR.vermelho, data: d.serie.map(function (s) { return s.r; }), stack: 's' }] }, options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
  const tons = [ink(), cinza(), '#6B7280', '#8E97A3', '#B3BAC4', '#4B5563'];
  mkChart('t3', { type: 'line', data: { labels: lbl, datasets: Object.keys(d.porProc).map(function (p, i) { return { label: p, data: d.porProc[p], borderColor: tons[i % tons.length], backgroundColor: tons[i % tons.length], borderDash: i > 2 ? [4, 3] : [], tension: .25, spanGaps: true, pointRadius: 2 }; }) }, options: { scales: { y: { min: 0, max: 100 } } } });
}

/* ----- Detalhe (doca/cluster, colaborador, equipe) ----- */
async function loadDetalhe(v) {
  const el = $('#v-' + v), meu = ++S.seqRel; destruirGraficos();
  el.innerHTML = '<div class="card">' + skel(5) + '</div>';
  let d;
  try { d = await rpc('relatorio', 'detalhe', filtrosAtuais(), { kind: S.det.kind, chave: S.det.chave }); }
  catch (e) { S.det = null; if (meu === S.seqRel) loadRel(v); return; }
  if (meu !== S.seqRel || S.v !== v || !S.det) return;
  const k = d.kpis, tx = k.n ? faixa(k.media) : '';
  const hist = d.hist.map(function (h) {
    return '<tr><td>' + fmtDt(h.ts) + '</td><td>' + esc(h.proc) + '</td><td>' + chipEst(h.proc, h.doca) + esc(h.doca || '—') + '</td><td>' + esc(h.colab || '—') + '</td><td>' + esc(h.turno || '—') + '</td><td class="num">' + pc(h.pct) + '</td><td>' + pill(h.faixa) + '</td><td>' + linkAud(h.id) + '</td></tr>';
  }).join('') || '<tr><td colspan="8" class="muted">Sem auditorias no período.</td></tr>';
  const pp = d.porProc.map(function (p) { return '<tr><td>' + esc(p.proc) + '</td><td class="num">' + p.n + '</td><td class="num">' + pc(p.media) + '</td></tr>'; }).join('');
  const of = d.of.map(function (o) { return '<tr><td>' + esc(o[0]) + '</td><td class="num">' + o[1] + '</td></tr>'; }).join('') || '<tr><td colspan="2" class="muted">Sem não conformidades.</td></tr>';
  const cs = d.kind === 'doca' ? chipEst(d.chave.split('|')[0], d.chave.split('|')[1]) : '';
  el.innerHTML = '<div class="toolbar"><button type="button" class="btn" id="det-voltar">' + ic('arrow-left', 14) + 'Voltar</button></div>' +
    '<div class="card"><div class="hd"><div><h2 style="margin:0">' + cs + esc(d.titulo) + '</h2><span class="muted">' + esc(d.sub) + '</span></div>' + (tx ? pill(tx, pc(k.media) + ' · ' + TXT_FAIXA_C[tx]) : '') + '</div></div>' +
    '<div class="kpis">' + kpi('Auditorias', k.n) + kpi('Nota média', pc(k.n ? k.media : null), null, tx === 'verde' ? 'ok' : tx === 'observacao' ? 'obs' : tx === 'vermelho' ? 'bad' : '') + kpi('Melhor nota', pc(d.melhor)) + kpi('Pior nota', pc(d.pior)) + kpi('Última auditoria', fmtDt(d.ultima)) + '</div>' +
    '<div class="cols"><div class="card"><div class="hd"><b>Evolução da nota</b></div><div class="chartbox sm"><canvas id="d1"></canvas></div></div>' +
    '<div class="card"><div class="hd"><b>Resultado</b></div><div class="chartbox sm"><canvas id="d2"></canvas></div></div></div>' +
    '<div class="cols"><div class="card"><div class="hd"><b>Por processo</b></div><div class="scroll"><table><thead><tr><th>Processo</th><th class="num">Auditorias</th><th class="num">Nota</th></tr></thead><tbody>' + (pp || '<tr><td colspan="3" class="muted">—</td></tr>') + '</tbody></table></div></div>' +
    '<div class="card"><div class="hd"><b>Principais ofensores</b></div><div class="scroll"><table><tbody>' + of + '</tbody></table></div></div></div>' +
    '<div class="card"><div class="hd"><b>Últimas auditorias</b></div><div class="scroll"><table><thead><tr><th>Data</th><th>Processo</th><th>Doca / cluster</th><th>Colaboradores</th><th>Turno</th><th class="num">Nota</th><th>Situação</th><th></th></tr></thead><tbody>' + hist + '</tbody></table></div></div>';
  mkChart('d1', { type: 'line', data: { labels: d.cols.map(function (c) { return c.slice(8, 10) + '/' + c.slice(5, 7); }), datasets: [{ label: 'Nota média', data: d.serie, borderColor: ink(), backgroundColor: ink(), tension: .25, spanGaps: true, pointRadius: 3 }] }, options: { plugins: { legend: { display: false }, linhasCorte: { corte: d.corte, media: d.media } }, scales: { y: { min: 0, max: 100 } } }, plugins: [linhasCorte] });
  mkChart('d2', { type: 'doughnut', data: { labels: ['Conforme', 'Em observação', 'Inconforme'], datasets: [{ data: [k.v, k.o, k.r], backgroundColor: [COR.verde, COR.observacao, COR.vermelho], borderWidth: 0 }] }, options: { cutout: '62%' } });
  $('#det-voltar').onclick = function () { S.det = null; loadRel(v); };
}

/* ----- Exportar (CSV em lotes, com proteção contra fórmulas) ----- */
const CSV_COLS = ['ID_Auditoria', 'Data_Hora', 'Processo', 'Doca_Cluster', 'Colaboradores', 'Lideres', 'Turno', 'Auditor', 'Nota_Pct', 'Situacao', 'Observacoes'];
function csvCel(v) { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
function renderExport() {
  const el = $('#v-export');
  el.innerHTML = '<div class="card" style="max-width:760px"><div class="hd"><b>Exportar auditorias</b></div>' +
    '<p>O arquivo respeita o período e os filtros da barra acima e os dados que o seu perfil enxerga. Formato CSV (separador ponto e vírgula), pronto para abrir no Excel ou no Google Planilhas.</p>' +
    '<div class="toolbar"><button type="button" class="btn pri" id="exp-go"' + (S.expBusy ? ' disabled' : '') + '>' + ic('download', 14) + 'Baixar CSV</button><span id="exp-st" class="muted"></span></div>' +
    '<div class="meter" id="exp-bar" style="margin-top:8px;display:' + (S.expBusy ? '' : 'none') + '"><span style="width:0"></span></div></div>';
  $('#exp-go').onclick = exportar;
}
async function exportar() {
  if (S.expBusy) return; // uma exportação por vez, mesmo que a tela seja redesenhada
  S.expBusy = true;
  const per = { de: S.flt.de, ate: S.flt.ate }; // o nome do arquivo usa o período pedido, não o que estiver na barra no fim
  const say = function (t) { const s = $('#exp-st'); if (s) s.textContent = t; };
  const progresso = function (p) { const br = $('#exp-bar'); if (br && br.firstElementChild) br.firstElementChild.style.width = p + '%'; };
  const b0 = $('#exp-go'), bar0 = $('#exp-bar'); if (b0) b0.disabled = true; if (bar0) bar0.style.display = '';
  const linhas = [CSV_COLS.join(';')], f = filtrosAtuais(); let off = 0, total = 0, guarda = 0;
  try {
    for (;;) {
      say('Preparando… ' + off + (total ? ' de ' + total : ''));
      const r = await rpc('relatorio', 'export', f, { offset: off });
      total = r.total; r.linhas.forEach(function (l) { linhas.push(l.map(csvCel).join(';')); });
      off += r.linhas.length; progresso(total ? Math.min(100, off / total * 100) : 100);
      if (r.fim || !r.linhas.length || ++guarda > 200) break;
    }
    if (!total) { say('Nenhuma auditoria com estes filtros.'); return; }
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'auditorias_' + per.de + '_' + per.ate + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    say(total + ' auditoria(s) exportada(s).'); toast('Exportação concluída');
  } catch (e) { say('Falha na exportação.'); } finally { S.expBusy = false; const b = $('#exp-go'); if (b) b.disabled = false; }
}

/* ----- eventos dos relatórios ----- */
document.addEventListener('click', function (e) {
  const t = e.target; if (!t.closest) return;
  const aud = t.closest('[data-aud]'); if (aud) { abrirItens(aud.dataset.aud); return; }
  const gox = t.closest('[data-go]'); if (gox) { try { irFiltrado(JSON.parse(gox.dataset.go)); } catch (e2) { /* atalho inválido */ } return; }
  const ex = t.closest('tr.exp'); if (ex) { alternarLinha(ex); return; }
  const pg = t.closest('[data-pg]'); if (pg && S.v === 'auditorias') { S.pag = Math.max(1, S.pag + Number(pg.dataset.pg)); loadRel('auditorias'); return; }
  const det = t.closest('tr[data-det]'); if (det && REL.indexOf(S.v) > -1) { S.det = { kind: det.dataset.det, chave: det.dataset.chave }; loadRel(S.v); return; }
  if (t.closest('[data-meta-n]')) { abrirMeta(''); return; }
  const me = t.closest('[data-meta-e]'); if (me) { abrirMeta(me.dataset.metaE); return; }
  const mx = t.closest('[data-meta-x]'); if (mx) { excluirMetaUI(mx.dataset.metaX); return; }
  if (t.closest('[data-fechar]')) { fecharModal(); return; }
  if (t.id === 'modal') fecharModal();
});
function alternarLinha(tr) {
  const d = tr.nextElementSibling; if (!d || !d.classList.contains('xd')) return;
  const abre = d.classList.contains('hidden'); d.classList.toggle('hidden', !abre); tr.classList.toggle('open', abre); tr.setAttribute('aria-expanded', String(abre));
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) fecharModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest) {
    const x = e.target.closest('tr.exp'), g = e.target.closest('[data-go][role="button"]');
    if (x) { e.preventDefault(); alternarLinha(x); } else if (g) { e.preventDefault(); g.click(); }
  }
});
