/* ---------- v10: programar auditorias por líder (Site Leader e Admin) ---------- */
let pgSeq = 0;
const pgNaTela = function () { return S.v === 'programacao'; };
const pgMetas = function () { return pgNaTela() && (S.pgTab || 'metas') === 'metas'; };
function escopoMeta(m) {
  const p = [];
  p.push(m.processos.length ? tpl(tr('Processos: {0}'), [lst(m.processos)]) : tr('Todos os processos'));
  p.push(m.turnos.length ? tpl(tr('Turnos: {0}'), [lst(m.turnos)]) : tr('Todos os turnos'));
  p.push(m.cores.length ? tpl(tr('Cores e símbolos: {0}'), [lst(m.cores)]) : tr('Todas as cores e símbolos'));
  p.push(m.times.length ? tpl(tr('Times de: {0}'), [lst(m.times)]) : tr('Qualquer time'));
  return p.join('. ') + '.';
}
const pgNAcao = function () { return S.fb ? (S.fb.fbAbertasHub || 0) + (S.fb.fbAtrasadosHub || 0) : 0; };
function pgRotuloAba(id, txt, n) { return esc(txt) + (n ? '<span class="badge-n" aria-hidden="true">' + n + '</span><span class="sr-only"> (' + esc(tpl(tr('{0} precisam de ação'), [n])) + ')</span>' : ''); }
function pgCasca() {
  const el = $('#v-programacao'), t = S.pgTab || 'metas', af = document.activeElement, tinhaFoco = !!(af && af.dataset && af.dataset.pgtab && el.contains(af));
  const aba = function (id, txt, n) { return '<button type="button" role="tab" id="pgTab-' + id + '" data-pgtab="' + id + '" aria-selected="' + (t === id) + '" tabindex="' + (t === id ? '0' : '-1') + '" aria-controls="pgPainel" class="' + (t === id ? 'on' : '') + '">' + pgRotuloAba(id, txt, n) + '</button>'; };
  el.innerHTML = '<div class="tabs" role="tablist" aria-label="' + esc(tr('Programação')) + '">' + aba('metas', tr('Metas por líder')) + aba('feedbacks', tr('Feedbacks obrigatórios'), pgNAcao()) + '</div><div id="pgPainel" role="tabpanel" aria-labelledby="pgTab-' + t + '" tabindex="-1"></div>';
  if (tinhaFoco) $('#pgTab-' + t).focus(); // o foco acompanha a aba escolhida, sem esperar o servidor
  return $('#pgPainel');
}
async function loadProgramacao() {
  const n = ++pgSeq, painel = pgCasca();
  if ((S.pgTab || 'metas') === 'feedbacks') { loadFeedbacksSL(n); return; }
  painel.innerHTML = '<div class="card">' + skel(5) + '</div>';
  try { const r = await rpc('listarMetasLider'); if (n !== pgSeq) return; S.pg = r; } catch (e) { painel.innerHTML = '<div class="card">' + esc(tr('Não foi possível carregar a programação.')) + '</div>'; return; }
  if (!pgNaTela()) return;
  S.pgForm = S.pgForm || novoPgForm(); S.pgCancel = ''; desenharProgramacao();
}
function novoPgForm() {
  const d = new Date(), f = new Date(); f.setDate(d.getDate() + 7);
  const iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  return { email: '', qtd: 1, ini: iso(d), fim: iso(f), desc: '', times: [], turnos: [], cores: [], processos: [] };
}
function desenharProgramacao() {
  const R = S.pg, f = S.pgForm, el = $('#pgPainel');
  const opts = '<option value="">' + esc(tr('Escolha a pessoa')) + '</option>' + R.responsaveis.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (u) {
    return '<option value="' + esc(u.email) + '"' + (f.email === u.email ? ' selected' : '') + '>' + esc(u.nome + ' (' + u.perfil + ')') + '</option>';
  }).join('');
  const grupo = function (attr, itens, marc, leg) {
    return '<fieldset class="grp-f"><legend class="sect">' + esc(leg) + '</legend><div class="grid">' + itens.map(function (x) { return '<label class="perm"><input type="checkbox" ' + attr + '="' + esc(x) + '"' + (marc.indexOf(x) > -1 ? ' checked' : '') + '><span><b>' + esc(x) + '</b></span></label>'; }).join('') + '</div></fieldset>';
  };
  el.innerHTML = '<div class="card"><div class="hd"><b>' + esc(tr('Programar auditorias')) + '</b></div>' +
    '<p class="muted" style="margin:6px 0 10px">' + esc(tr('Defina quantas auditorias a pessoa deve fazer e até quando. Ela recebe um aviso por e-mail e vê a meta em Minhas metas. A meta só conta auditorias que a regra de auditoria dela permite.')) + '</p>' +
    '<div class="grid"><label class="fld"><span>' + esc(tr('Responsável')) + '</span><select id="pgEmail" required aria-required="true">' + opts + '</select></label>' +
    '<label class="fld"><span>' + esc(tr('Quantidade de auditorias')) + '</span><input id="pgQtd" type="number" min="1" max="9999" step="1" required aria-required="true" value="' + esc(f.qtd) + '"></label>' +
    '<label class="fld"><span>' + esc(tr('Início')) + '</span><input id="pgIni" type="date" value="' + esc(f.ini) + '"></label>' +
    '<label class="fld"><span>' + esc(tr('Prazo final')) + '</span><input id="pgFim" type="date" value="' + esc(f.fim) + '"></label></div>' +
    '<label class="fld"><span>' + esc(tr('Observação (opcional)')) + '</span><input id="pgDesc" type="text" maxlength="200" value="' + esc(f.desc) + '"></label>' +
    '<details style="margin-top:8px"><summary>' + esc(tr('Limitar a processos, turnos, cores ou times (opcional)')) + '</summary>' +
    grupo('data-pg-p', R.processos, f.processos, tr('Processos (nenhum marcado = todos)')) +
    grupo('data-pg-tu', R.turnos, f.turnos, tr('Turnos (nenhum marcado = todos)')) +
    grupo('data-pg-c', R.cores, f.cores, tr('Cores e símbolos das docas e clusters (nenhum marcado = todos)')) +
    grupo('data-pg-t', R.times, f.times, tr('Quais times (nenhum marcado = todos)')) + '</details>' +
    '<div id="pgPrev" class="resumo"></div><div id="pgErr" role="alert"></div><div id="pgLive" class="sr-only" role="status"></div>' +
    '<div style="margin-top:12px"><button type="button" class="btn pri" id="pgSalvar">' + esc(tr('Programar meta')) + '</button></div></div>' +
    '<div class="card"><div class="hd"><b>' + esc(tr('Metas programadas')) + '</b></div>' + (R.metas.length ? plCasca('metas') : vz(tr('Nenhuma meta ativa. Programe a primeira acima.'))) + '</div>';
  plDesenhar('metas');
  prevPg();
}
/** Ativas primeiro, pelo prazo; depois as canceladas, da mais recente. */
function pgMetasOrdenadas() {
  if (!S.pg) return null;
  return S.pg.metas.slice().sort(function (a, b) { return (a.cancelada ? 1 : 0) - (b.cancelada ? 1 : 0) || (a.cancelada ? b.criadaEm.localeCompare(a.criadaEm) : a.fim.localeCompare(b.fim)); });
}
function pgTabelaMetas(l) {
  const linha = function (m) {
    const p = Math.min(100, m.feito / m.qtd * 100), venc = !m.cancelada && m.status === 'nao_atingida';
    return '<tr><td>' + esc(m.nome) + '<br><small class="muted">' + esc(m.email) + '</small></td><td>' + esc(m.qtd + ' ' + tr('auditoria(s)')) + '<br><small class="muted">' + esc(escopoMeta(m)) + (m.desc ? ' ' + esc(m.desc) : '') + '</small></td>' +
      '<td>' + esc(fmtD(m.ini) + ' ' + tr('a') + ' ' + fmtD(m.fim)) + (venc ? '<br><small class="muted">' + esc(tr('Prazo vencido')) + '</small>' : '') + '</td>' +
      '<td>' + (m.cancelada ? '—' : '<div class="meta-t"><span class="nm"><b>' + m.feito + '</b> ' + esc(tr('de')) + ' ' + m.qtd + '</span>' + meter(p, m.status) + '</div>') + '</td>' +
      '<td>' + pill(m.cancelada ? 'inativa' : m.status, m.cancelada ? tr('Cancelada') : tr(TXT_META[m.status])) + (m.cancelada ? '' : (m.avisoPendente ? '<br><small class="muted">' + esc(tr('Aviso por e-mail pendente')) + '</small>' : '') + (m.visto ? '' : '<br><small class="muted">' + esc(tr('Ainda não aberta pelo líder')) + '</small>')) + '</td>' +
      '<td>' + (m.cancelada ? '' : '<button type="button" class="btn sm" data-pg-cancel="' + esc(m.id) + '" data-pg-nome="' + esc(m.nome) + '" aria-label="' + esc(tpl(tr('Cancelar a meta de {0}'), [m.nome])) + '">' + esc(tr('Cancelar')) + '</button>') + '</td></tr>';
  };
  return '<div class="scroll" role="region" tabindex="0" aria-label="' + esc(tr('Metas programadas')) + '"><table><caption class="sr-only">' + esc(tr('Metas programadas')) + '</caption><thead><tr><th scope="col">' + esc(tr('Responsável')) + '</th><th scope="col">' + esc(tr('O que fazer')) + '</th><th scope="col">' + esc(tr('Prazo')) + '</th><th scope="col">' + esc(tr('Progresso')) + '</th><th scope="col">' + esc(tr('Situação')) + '</th><th scope="col"><span class="sr-only">' + esc(tr('Ações')) + '</span></th></tr></thead><tbody>' + l.map(linha).join('') + '</tbody></table></div>';
}
function prevPg() {
  const f = S.pgForm, p = $('#pgPrev'); if (!p) return;
  const u = S.pg.responsaveis.find(function (x) { return x.email === f.email; });
  p.innerHTML = u ? '<b>' + esc(tr('Resumo')) + '</b><p style="margin:4px 0 0">' + esc(tpl(tr('{0} deve fazer {1} auditoria(s) de {2} a {3}.'), [u.nome, f.qtd, fmtD(f.ini), fmtD(f.fim)]) + ' ' + escopoMeta(f)) + '</p>' : '';
}
function lerPgForm() {
  const f = S.pgForm, marc = function (a) { return $$('#v-programacao [' + a + ']:checked').map(function (i) { return i.getAttribute(a); }); };
  f.email = $('#pgEmail').value; f.qtd = $('#pgQtd').value; f.ini = $('#pgIni').value; f.fim = $('#pgFim').value; f.desc = $('#pgDesc').value;
  f.processos = marc('data-pg-p'); f.turnos = marc('data-pg-tu'); f.cores = marc('data-pg-c'); f.times = marc('data-pg-t');
}
async function salvarPgUI() {
  if (S.busy) return;
  lerPgForm(); S.busy = true; const b = $('#pgSalvar'); if (b) b.disabled = true; $('#pgErr').innerHTML = '';
  try {
    const r = await rpc('salvarMetaLider', S.pgForm);
    if (!r.ok) {
      const msgs = r.erros ? Object.keys(r.erros).map(function (k) { return r.erros[k]; }) : [r.msg || tr('O servidor recusou a meta.')];
      $('#pgErr').innerHTML = aviso(msgs.map(esc).join(' ')); if (b) b.disabled = false;
      const campo = r.erros && { email: '#pgEmail', qtd: '#pgQtd', ini: '#pgIni', fim: '#pgFim', desc: '#pgDesc' }[Object.keys(r.erros)[0]];
      if (campo && $(campo)) { $(campo).setAttribute('aria-invalid', 'true'); $(campo).focus(); }
      return;
    }
    S.pgForm = novoPgForm(); S.pgCancel = '';
    if (r.recarregar) { toast(r.emailEnviado ? tr('Meta programada. O aviso foi enviado por e-mail.') : tr('Meta programada, mas o e-mail não foi enviado. O aviso será reenviado às 22h.'), !r.emailEnviado); await loadProgramacao(); return; }
    S.pg = r;
    toast(r.emailEnviado ? tr('Meta programada. O aviso foi enviado por e-mail.') : tr('Meta programada, mas o e-mail não foi enviado. O aviso será reenviado às 22h.'), !r.emailEnviado);
    if (pgNaTela()) desenharProgramacao();
  } catch (x) { if (b) b.disabled = false; } finally { S.busy = false; }
}
/** Confirmação em dois cliques sem redesenhar a tela: o foco fica no botão, o nome acessível acompanha o texto e a mudança é anunciada. */
function rotuloCancelar(btn, confirmando) {
  const nome = btn.dataset.pgNome || '';
  btn.textContent = confirmando ? tr('Confirmar cancelamento?') : tr('Cancelar');
  btn.setAttribute('aria-label', tpl(confirmando ? tr('Confirmar o cancelamento da meta de {0}') : tr('Cancelar a meta de {0}'), [nome]));
}
function zerarCancelar() {
  if (!S.pgCancel) return;
  S.pgCancel = ''; $$('#v-programacao [data-pg-cancel]').forEach(function (b) { rotuloCancelar(b, false); });
}
async function cancelarPgUI(id, btn) {
  if (S.busy) return;
  if (S.pgCancel !== id) { zerarCancelar(); S.pgCancel = id; rotuloCancelar(btn, true); const lv = $('#pgLive'); if (lv) lv.textContent = tr('Clique de novo para confirmar o cancelamento.'); return; }
  S.busy = true;
  try {
    const r = await rpc('cancelarMetaLider', id);
    S.pgCancel = '';
    if (!r.ok) { toast(r.msg || tr('O servidor recusou o cancelamento.'), true); await loadProgramacao(); return; }
    toast(tr('Meta cancelada'));
    if (r.recarregar) await loadProgramacao(); else { S.pg = r; if (pgNaTela()) { desenharProgramacao(); plFocoFiltro('metas'); } }
  } catch (x) { S.pgCancel = ''; if (pgNaTela()) await loadProgramacao(); } finally { S.busy = false; }
}
function v10Eventos() {
  document.addEventListener('change', function (e) { if (pgMetas() && e.target && e.target.closest && e.target.closest('#v-programacao')) { lerPgForm(); prevPg(); } });
  document.addEventListener('input', function (e) { if (pgMetas() && e.target && e.target.closest && e.target.closest('#v-programacao') && !(e.target.dataset && e.target.dataset.plQ)) { lerPgForm(); prevPg(); } });
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest ? e.target.closest('button') : null; if (!t || !pgNaTela()) return;
    if (t.dataset.pgtab) { if (t.dataset.pgtab !== (S.pgTab || 'metas')) { S.pgTab = t.dataset.pgtab; loadProgramacao(); } }
    else if (t.id === 'pgSalvar') salvarPgUI();
    else if (t.dataset.pgCancel !== undefined) cancelarPgUI(t.dataset.pgCancel, t);
    else zerarCancelar();
  });
  document.addEventListener('focusout', function (e) { if (pgNaTela() && !S.busy && e.target && e.target.dataset && e.target.dataset.pgCancel !== undefined) zerarCancelar(); });
  document.addEventListener('keydown', function (e) {
    if (!pgNaTela()) return;
    if (e.key === 'Escape') zerarCancelar();
    const t = e.target && e.target.dataset && e.target.dataset.pgtab;
    if (t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); S.pgTab = t === 'metas' ? 'feedbacks' : 'metas'; loadProgramacao(); }
  });
  document.addEventListener('change', function (e) { if (pgNaTela() && e.target && e.target.dataset && e.target.dataset.fbSel !== undefined) avisoAuditorFb(e.target); });
  fbEventos();
  plEventos();
}
