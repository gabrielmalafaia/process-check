/* ---------- v10 fase 3: feedback obrigatório ---------- */
const FB_MIN = 50;
const FB_ST = { Aberta: ['em_risco', 'Aguardando designação'], Designada: ['no_ritmo', 'Designado'], Concluida: ['atingida', 'Concluído'] };
const fbNaTela = function () { return S.v === 'feedbacks'; };
const fbVazio = function () { return { fbMeus: 0, fbMeusNovos: 0, fbMeusAtrasados: 0, fbTotalMeus: 0, fbAtrasadosHub: 0, fbAbertasHub: 0 }; };
/** A tela "Meus feedbacks" aparece pelos DADOS (há designação para a pessoa), não pelo perfil: o servidor decide o que ela vê. */
function aplicarFb(fb, user) {
  S.fb = Object.assign(fbVazio(), fb || {});
  if (!user || !user.telas) return;
  const i = user.telas.indexOf('feedbacks');
  if (S.fb.fbTotalMeus > 0 && i < 0) user.telas.push('feedbacks');
  else if (S.fb.fbTotalMeus === 0 && i > -1) user.telas.splice(i, 1);
}
function fbAuditorias(p) {
  if (!p.auditorias.length) return '';
  return '<details><summary>' + esc(tpl(tr('{0} auditoria(s) abaixo de {1}%'), [p.qtd, p.corte])) + '</summary><ul class="lista-fb">' + p.auditorias.map(function (x) { return '<li>' + esc(fmtD(x.data) + ' · ' + x.proc + ' · ' + pc(x.pct)) + '</li>'; }).join('') + '</ul></details>';
}
function fbTime(p) {
  const mudou = p.timeAtual !== p.timeEpoca || p.turnoAtual !== p.turnoEpoca;
  return '<small class="muted">' + esc(tpl(tr('Time na época: {0} ({1})'), [p.timeEpoca || '—', p.turnoEpoca || '—'])) + '</small>' + (mudou ? '<br><small class="muted">' + esc(tpl(tr('Hoje: {0} ({1})'), [p.timeAtual || '—', p.turnoAtual || '—'])) + '</small>' : '');
}
function fbSituacao(p) {
  const k = p.atrasado ? ['nao_atingida', 'Atrasado'] : FB_ST[p.status];
  return pill(k[0], tr(k[1])) + (p.status === 'Designada' ? '<br><small class="muted">' + esc(tpl(tr('Prazo {0}'), [fmtD(p.prazo)])) + '</small>' : '');
}

/* ---- Site Leader / Admin: aba Feedbacks em Programação ---- */
async function loadFeedbacksSL(n) {
  const painel = $('#pgPainel'); painel.innerHTML = '<div class="card">' + skel(5) + '</div>';
  try { const r = await rpc('listarFeedbacks'); if (n !== pgSeq) return; S.fbl = r; } catch (e) { painel.innerHTML = '<div class="card">' + esc(tr('Não foi possível carregar os feedbacks.')) + '</div>'; return; }
  if (!pgNaTela() || (S.pgTab || 'metas') !== 'feedbacks') return;
  desenharFeedbacksSL();
}
function desenharFeedbacksSL() {
  const R = S.fbl, el = $('#pgPainel'); if (!el) return;
  const opts = function (p) {
    return '<option value="">' + esc(tr('Escolha quem dará o feedback')) + '</option>' + R.responsaveis.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (u) {
      return '<option value="' + esc(u.email) + '"' + (p.designadoEmail === u.email ? ' selected' : '') + '>' + esc(u.nome + ' (' + u.perfil + ')') + '</option>';
    }).join('');
  };
  const linha = function (p) {
    const acao = p.status === 'Concluida'
      ? (p.registro ? '<details><summary>' + esc(tr('Ver feedback registrado')) + '</summary><p style="margin:6px 0 2px;white-space:pre-wrap">' + esc(p.registro.texto) + '</p><small class="muted">' + esc(tpl(tr('Registrado por {0} em {1}'), [p.registro.autor, fmtDt(p.registro.registradoEm)])) + '</small></details>' : '')
      : '<label class="fld" style="margin:0"><span class="sr-only">' + esc(tpl(tr('Quem dará o feedback a {0}'), [p.colaborador])) + '</span><select data-fb-sel="' + esc(p.id) + '">' + opts(p) + '</select></label>' +
        '<button type="button" class="btn sm pri" style="margin-top:6px" data-fb-des="' + esc(p.id) + '" aria-label="' + esc(tpl(tr(p.status === 'Designada' ? 'Reatribuir o feedback de {0}' : 'Designar o feedback de {0}'), [p.colaborador])) + '">' + esc(tr(p.status === 'Designada' ? 'Reatribuir' : 'Designar')) + '</button><div class="muted" role="status" data-fb-av="' + esc(p.id) + '"></div>';
    return '<tr><td>' + esc(p.colaborador) + '<br>' + fbTime(p) + '</td><td>' + fbAuditorias(p) + '</td><td>' + fbSituacao(p) + (p.status !== 'Aberta' && p.designadoNome ? '<br><small class="muted">' + esc(p.designadoNome) + '</small>' : '') + (p.status === 'Designada' && p.avisoPendente ? '<br><small class="muted">' + esc(tr('Aviso por e-mail pendente')) + '</small>' : '') + '</td><td>' + acao + '</td></tr>';
  };
  const ord = R.pendencias.slice().sort(function (a, b) { const k = { Aberta: 0, Designada: 1, Concluida: 2 }; return k[a.status] - k[b.status] || String(a.prazo).localeCompare(String(b.prazo)); });
  el.innerHTML = '<div class="card"><div class="hd"><b>' + esc(tr('Feedbacks obrigatórios')) + '</b></div>' +
    '<p class="muted" style="margin:6px 0 10px">' + esc(tpl(tr('Quando um colaborador tem {0} ou mais auditorias abaixo da nota média em {1} dias, o feedback passa a ser obrigatório. Escolha quem vai conversar com ele: o líder tem {2} dias para registrar o que foi falado (mínimo de {3} caracteres).'), [R.minimo, R.janela, R.prazoDias, FB_MIN])) + '</p>' +
    '<div id="fbErr" role="alert"></div>' +
    (ord.length ? '<div class="scroll" role="region" tabindex="0" aria-label="' + esc(tr('Feedbacks obrigatórios')) + '"><table><caption class="sr-only">' + esc(tr('Feedbacks obrigatórios')) + '</caption><thead><tr><th scope="col">' + esc(tr('Colaborador')) + '</th><th scope="col">' + esc(tr('Auditorias')) + '</th><th scope="col">' + esc(tr('Situação')) + '</th><th scope="col">' + esc(tr('Quem dá o feedback')) + '</th></tr></thead><tbody>' + ord.map(linha).join('') + '</tbody></table></div>' : vz(tr('Nenhum feedback obrigatório no momento.'))) + '</div>';
}
/** Aviso (não bloqueio): a pessoa escolhida fez alguma das auditorias que geraram o feedback. */
function avisoAuditorFb(sel) {
  const p = S.fbl && S.fbl.pendencias.find(function (x) { return x.id === sel.dataset.fbSel; }), av = $('#pgPainel [data-fb-av="' + sel.dataset.fbSel + '"]'); if (!p || !av) return;
  av.textContent = sel.value && p.auditores.indexOf(sel.value) > -1 ? tr('Atenção: esta pessoa fez uma ou mais das auditorias que geraram o feedback. Você pode designá-la mesmo assim.') : '';
}
async function designarFbUI(id) {
  if (S.busy) return;
  const sel = $('#pgPainel [data-fb-sel="' + id + '"]'), err = $('#fbErr'); if (!sel) return;
  err.innerHTML = '';
  if (!sel.value) { err.innerHTML = aviso(esc(tr('Escolha quem dará o feedback.'))); sel.focus(); return; }
  S.busy = true;
  try {
    const r = await rpc('designarFeedback', id, sel.value);
    if (!r.ok) { err.innerHTML = aviso(esc(r.msg ? tr(r.msg) : tr('O servidor recusou a designação.'))); return; }
    toast(r.emailEnviado ? tr('Feedback designado. O aviso foi enviado por e-mail.') : tr('Feedback designado, mas o e-mail não foi enviado. O aviso será reenviado às 22h.'), !r.emailEnviado);
    if (r.recarregar) await loadProgramacao(); else { S.fbl = r; if (pgNaTela() && (S.pgTab || 'metas') === 'feedbacks') desenharFeedbacksSL(); }
    sondarFb();
  } catch (x) { /* o aviso de erro já foi exibido */ } finally { S.busy = false; }
}

/* ---- quem foi designado: tela Meus feedbacks ---- */
let fbSeq = 0;
const fbRascunhos = function () { const m = {}; $$('#v-feedbacks [data-fb-txt]').forEach(function (t) { if (t.value) m[t.dataset.fbTxt] = t.value; }); return m; };
async function loadFeedbacksMeus() {
  const el = $('#v-feedbacks'), n = ++fbSeq;
  if (!Object.keys(fbRascunhos()).length) el.innerHTML = '<div class="card">' + skel(4) + '</div>'; // com texto em digitação, a tela não é apagada: o texto volta ao redesenhar
  try { const r = await rpc('meusFeedbacks'); if (n !== fbSeq) return; S.fbm = r; } catch (e) { el.innerHTML = '<div class="card">' + esc(tr('Não foi possível carregar os feedbacks.')) + '</div>'; return; }
  if (!fbNaTela()) return;
  desenharFeedbacksMeus();
  if (S.fbm.some(function (p) { return p.status === 'Designada' && !p.visto; })) rpc('marcarFeedbacksVistos').then(function () { S.fb.fbMeusNovos = 0; renderNav(); }).catch(function () { /* o selo volta no próximo ciclo */ });
}
function desenharFeedbacksMeus() {
  const L = S.fbm, el = $('#v-feedbacks'); if (!el) return;
  const rasc = fbRascunhos();
  const feitos = L.filter(function (p) { return p.status === 'Concluida'; }), abertos = L.filter(function (p) { return p.status === 'Designada'; }).sort(function (a, b) { return String(a.prazo).localeCompare(String(b.prazo)); });
  const card = function (p) {
    const c = '<div class="card"><div class="hd"><b role="heading" aria-level="3">' + esc(p.colaborador) + '</b>' + fbSituacao(p) + '</div><p style="margin:4px 0">' + fbTime(p) + '</p>' + fbAuditorias(p);
    if (p.status === 'Concluida') return c + (p.registro ? '<p style="margin:10px 0 2px;white-space:pre-wrap">' + esc(p.registro.texto) + '</p><small class="muted">' + esc(tpl(tr('Registrado em {0}'), [fmtDt(p.registro.registradoEm)])) + '</small>' : '') + '</div>';
    return c + '<label class="fld" style="margin-top:10px"><span>' + esc(tr('O que foi conversado com o colaborador')) + '<span class="sr-only"> — ' + esc(p.colaborador) + '</span></span><textarea data-fb-txt="' + esc(p.id) + '" rows="5" maxlength="2000" aria-describedby="fbc-' + esc(p.id) + '" required aria-required="true"></textarea></label>' +
      '<div class="muted" id="fbc-' + esc(p.id) + '" data-fb-cont="' + esc(p.id) + '">' + esc(tpl(tr('0 de {0} caracteres no mínimo'), [FB_MIN])) + '</div><div class="sr-only" role="status" data-fb-live="' + esc(p.id) + '"></div>' +
      '<div data-fb-err="' + esc(p.id) + '" role="alert"></div>' +
      '<div style="margin-top:10px"><button type="button" class="btn pri" data-fb-reg="' + esc(p.id) + '" disabled aria-label="' + esc(tpl(tr('Registrar feedback de {0}'), [p.colaborador])) + '">' + esc(tr('Registrar feedback')) + '</button></div></div>';
  };
  el.innerHTML = '<div class="sr-only" id="fbLive" role="status"></div><div class="card"><p class="muted" id="fbIntro" tabindex="-1" style="margin:0">' + esc(tpl(tr('Você foi designado(a) para dar estes feedbacks. Registre o que foi conversado, com pelo menos {0} caracteres. O texto fica visível para você, para o Site Leader do Hub e para o Admin, e é guardado por 12 meses.'), [FB_MIN])) + '</p></div>' +
    (abertos.length ? abertos.map(card).join('') : '<div class="card">' + vz(tr('Nenhum feedback a registrar.')) + '</div>') +
    (feitos.length ? '<div class="card"><div class="hd"><b>' + esc(tr('Registrados recentemente')) + '</b></div></div>' + feitos.map(card).join('') : '');
  Object.keys(rasc).forEach(function (id) { const t = $('[data-fb-txt="' + id + '"]'); if (t) { t.value = rasc[id]; contarFbTxt(t); } });
}
function contarFbTxt(ta) {
  const id = ta.dataset.fbTxt, n = ta.value.replace(/\s+/g, ' ').trim().length, c = $('[data-fb-cont="' + id + '"]'), b = $('[data-fb-reg="' + id + '"]'), lv = $('[data-fb-live="' + id + '"]');
  const pronto = n >= FB_MIN;
  if (c) c.textContent = pronto ? tpl(tr('{0} caracteres'), [n]) : tpl(tr('{0} de {1} caracteres no mínimo'), [n, FB_MIN]);
  if (b) b.disabled = !pronto;
  if (lv && ta.dataset.fbOk !== String(pronto)) { ta.dataset.fbOk = String(pronto); lv.textContent = pronto ? tr('Tamanho mínimo atingido.') : ''; }
}
async function registrarFbUI(id) {
  if (S.busy) return;
  const ta = $('[data-fb-txt="' + id + '"]'), err = $('[data-fb-err="' + id + '"]'), b = $('[data-fb-reg="' + id + '"]'); if (!ta) return;
  err.innerHTML = ''; S.busy = true; b.disabled = true;
  try {
    const r = await rpc('registrarFeedback', id, ta.value);
    if (!r.ok) { err.innerHTML = aviso(esc(r.msg ? tr(r.msg) : tr('O servidor recusou o feedback.'))); b.disabled = false; ta.focus(); return; }
    toast(tr('Feedback registrado'));
    if (r.recarregar) { await loadFeedbacksMeus(); await sondarFb(); const lv = $('#fbLive'); if (lv) lv.textContent = tr('Feedback registrado'); return; }
    S.fbm = r.feedbacks; await sondarFb();
    if (fbNaTela()) { desenharFeedbacksMeus(); const lv = $('#fbLive'), ip = $('#fbIntro'); if (lv) lv.textContent = tr('Feedback registrado'); if (ip) ip.focus(); }
  } catch (x) { b.disabled = false; } finally { S.busy = false; }
}

/* ---- contadores (selos do menu) ---- */
function sondarFb() {
  if (!S.u || document.hidden) return Promise.resolve();
  return new Promise(function (ok) {
    google.script.run.withSuccessHandler(function (fb) {
      if (fb && JSON.stringify(fb) !== JSON.stringify(S.fb)) {
        aplicarFb(fb, S.u); renderNav();
        const ab = $('#pgTab-feedbacks'); if (ab && pgNaTela()) ab.innerHTML = pgRotuloAba('feedbacks', tr('Feedbacks obrigatórios'), pgNAcao());
        if (!tela('feedbacks') && fbNaTela()) nav(['matriz', 'form', 'minhas', 'geral'].filter(tela)[0] || S.u.telas[0]);
        else if (fbNaTela() && !S.busy && $('#modal').classList.contains('hidden') && !$$('#v-feedbacks textarea').some(function (t) { return t.value; })) loadFeedbacksMeus(); // nunca apaga um texto em digitação
      }
      ok();
    }).withFailureHandler(function () { ok(); }).contarFeedbacks();
  });
}
function fbEventos() {
  document.addEventListener('input', function (e) { const t = e.target; if (fbNaTela() && t && t.dataset && t.dataset.fbTxt !== undefined) contarFbTxt(t); });
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest ? e.target.closest('button') : null; if (!t || !fbNaTela()) return;
    if (t.dataset.fbReg !== undefined) registrarFbUI(t.dataset.fbReg);
  });
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest ? e.target.closest('button') : null; if (t && pgNaTela() && t.dataset.fbDes !== undefined) designarFbUI(t.dataset.fbDes);
  });
}
