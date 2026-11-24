/* ---------- autorizações: pedidos de cadastro (aba de Acessos; tela própria só para quem não tem Acessos) ---------- */
async function loadAutorizar() {
  const el = $('#v-autorizar'); el.innerHTML = '<div class="card">' + skel(5) + '</div>';
  try { S.sol = await rpc('listarSolicitacoes'); } catch (e) { el.innerHTML = '<div class="card">Não foi possível carregar as solicitações.</div>'; return; }
  if (S.v !== 'autorizar') return;
  S.pend = S.sol.pendentes.length; renderNav(); drawAutorizar('#v-autorizar');
}
const fmtSol = function (t) { return t ? fmtD(String(t).slice(0, 10)) + ' ' + String(t).slice(11, 16) : '—'; };
function drawAutorizar(alvo) {
  const d = S.sol, aprova = pode('usuarios') && tela('acessos'), el = $(alvo); if (!el) return;
  const pend = d.pendentes.map(function (x, i) {
    return '<tr><td>' + esc(x.nome) + '</td><td>' + esc(x.cargo) + '</td><td>' + esc(x.email) + '</td><td>' + esc(fmtSol(x.data)) + '</td><td class="ta"><div class="acts">' +
      (aprova ? '<button type="button" class="btn sm pri" data-sa="' + i + '">' + ic('check', 14) + 'Aprovar</button>' : '') +
      '<button type="button" class="btn sm" data-sr="' + i + '">' + ic('x', 14) + 'Recusar</button></div></td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">Nenhuma solicitação pendente.</td></tr>';
  const hist = d.historico.map(function (x) {
    return '<tr><td>' + esc(x.nome) + '</td><td>' + esc(x.email) + '</td><td>' + esc(x.cargo) + '</td><td>' + (x.status === 'Aprovada' ? pill('verde', 'Aprovada') : pill('vermelho', 'Recusada')) + '</td><td>' + esc(x.por || '—') + '</td><td>' + esc(fmtSol(x.em)) + '</td><td>' + esc(x.perfil || '—') + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="muted">Nenhuma decisão registrada.</td></tr>';
  el.innerHTML =
    '<div class="card"><div class="hd"><b>Cadastros aguardando aprovação (' + d.pendentes.length + ')</b></div>' +
    (aprova ? aviso('Ao aprovar, você vai direto ao cadastro de usuário para escolher o perfil e as permissões. Depois de salvar, a pessoa recebe um e-mail.') : aviso('Seu perfil pode recusar pedidos, mas não pode criar usuários. Peça a quem tem acesso a Acessos para aprovar.')) +
    '<div class="scroll" style="margin-top:12px"><table><thead><tr><th>Nome</th><th>Cargo informado</th><th>E-mail</th><th>Solicitado em</th><th></th></tr></thead><tbody>' + pend + '</tbody></table></div></div>' +
    '<div class="card"><div class="hd"><b>Últimas decisões</b></div><div class="scroll"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo informado</th><th>Resultado</th><th>Decidido por</th><th>Em</th><th>Perfil atribuído</th></tr></thead><tbody>' + hist + '</tbody></table></div></div>';
}
/** Redesenha a fila onde ela estiver (aba de Acessos ou tela própria) e atualiza o selo do menu. */
function atualizarFila() {
  S.pend = S.sol.pendentes.length; renderNav();
  if (S.v === 'acessos' && S.ac) renderAcessos(); else if (S.v === 'autorizar') drawAutorizar('#v-autorizar');
}
function aprovarSolicitacao(i) {
  const x = S.sol.pendentes[i]; if (!x) return;
  if (!(pode('usuarios') && tela('acessos'))) { toast('Seu perfil não pode cadastrar usuários.', true); return; }
  S.acSol = x; S.acTab = 'usuarios'; S.acEdit = null; nav('acessos');
}
function pedirRecusa(i) {
  const x = S.sol.pendentes[i]; if (!x) return;
  S.srId = x.id;
  modal('<div class="mhd"><h2 id="modalT">Recusar cadastro</h2></div><p class="dlg-msg">Recusar o cadastro de <b>' + esc(x.nome) + '</b> (' + esc(x.email) + ')? A pessoa poderá enviar um novo pedido.</p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn pri" id="srOk">Recusar</button></div>');
  $('#modal .box').style.maxWidth = '440px';
}
async function recusarSolicitacaoUI() {
  if (S.busy) return;
  S.busy = true;
  try {
    const r = await rpc('recusarSolicitacao', S.srId); fecharModal();
    if (!r.ok) { toast(r.msg, true); await recarregarFila(); return; }
    S.sol = r.dados; atualizarFila(); toast('Cadastro recusado');
  } catch (e) { fecharModal(); } finally { S.busy = false; }
}
async function recarregarFila() {
  try { S.sol = await rpc('listarSolicitacoes'); atualizarFila(); } catch (e) { /* aviso exibido */ }
}
async function concluirAprovacao(r) {
  S.acSol = null; S.acEdit = null;
  const e = r.email;
  toast(e ? (e.enviado ? 'Usuário cadastrado. E-mail de aprovação enviado.' : 'Usuário cadastrado, mas o e-mail não foi enviado. Avise a pessoa.') : 'Usuário cadastrado', !!(e && !e.enviado));
  if (pode('autorizar')) { try { S.pend = Math.max(0, await rpc('contarPendentes')); } catch (x) { S.pend = Math.max(0, S.pend - 1); } }
  S.acTab = 'autorizar'; nav('autorizar');
}
/** Consulta silenciosa do número de pendentes (a cada 2 minutos, só com a aba visível e só para quem autoriza). */
function sondar() {
  if (!S.u || !pode('autorizar') || document.hidden) return;
  google.script.run.withSuccessHandler(function (n) {
    if (typeof n !== 'number' || n === S.pend) return;
    S.pend = n; renderNav();
    if (!S.busy && $('#modal').classList.contains('hidden') && (S.v === 'autorizar' || (S.v === 'acessos' && S.acTab === 'autorizar'))) recarregarFila();
    else if (S.v === 'acessos' && S.ac) atualizarSeloAcessos(); // só o selo: não apaga formulário nem edição em curso
  }).withFailureHandler(function () { /* silencioso: tenta de novo no próximo ciclo */ }).contarPendentes();
}

/** Consulta silenciosa de metas novas (a cada 2 minutos, só com a aba visível). */
function sondarMetas() {
  if (!S.u || !tela('minhas') || document.hidden) return;
  google.script.run.withSuccessHandler(function (n) {
    if (typeof n !== 'number' || n === S.metasNovas) return;
    S.metasNovas = n; renderNav();
    if (S.v === 'minhas' && !S.busy && $('#modal').classList.contains('hidden')) loadMinhas(); // quem já está na tela vê a meta nova na hora
  }).withFailureHandler(function () { /* silencioso: tenta de novo no próximo ciclo */ }).contarMetasNovas();
}

/* ---------- temas: automático, claro, escuro e laranja ---------- */
const TEMAS = ['auto', 'light', 'dark', 'orange'];
function temaSalvo() { try { const t = localStorage.getItem('pcTema'); return TEMAS.indexOf(t) > -1 ? t : 'light'; } catch (e) { return 'light'; } }
function escuroSistema() { try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }
function aplicarTema(n, salvar) {
  if (TEMAS.indexOf(n) < 0) n = 'light';
  S.temaSel = n;
  const real = n === 'auto' ? (escuroSistema() ? 'dark' : 'light') : n, d = document.documentElement;
  if (real === 'light') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', real);
  if (salvar) { try { localStorage.setItem('pcTema', n); } catch (x) { /* sem armazenamento */ } }
  $$('[data-tema]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tema === n)); });
  if (salvar && S.u && REL.indexOf(S.v) > -1) loadRel(S.v);
}
function menuUsuario(abrir) {
  const m = $('#userMenu'); if (!m) return;
  m.classList.toggle('hidden', !abrir); $('#userBtn').setAttribute('aria-expanded', String(abrir));
}

/* ---------- idioma ---------- */
function trocarIdioma(l) {
  aplicarIdioma(l, true);
  $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === idiomaAtual())); });
  if (S.u) { relUpd(); if (REL.indexOf(S.v) > -1) loadRel(S.v); else if (S.v === 'form' && S.F) renderForm(); }
}

/* ---------- busca global (Ctrl+K) ---------- */
function itensCmd() {
  const L = [];
  NAV.forEach(function (sec) {
    sec.itens.forEach(function (it) {
      if (it.kids) it.kids.filter(tela).forEach(function (k) { L.push({ t: TIT[k], s: it.t, ic: KID_IC[k], go: function () { nav(k); } }); });
      else if (it.id === 'autorizar' ? tela('autorizar') : tela(it.id)) L.push({ t: TIT[it.id], s: sec.sec, ic: it.ic, go: function () { nav(it.id); } });
    });
  });
  if (pode('auditar')) L.unshift({ t: 'Nova auditoria', s: 'Ação', ic: 'plus', go: function () { novoForm(); nav('form'); } });
  if (tela('matriz')) S.procs.forEach(function (p) { L.push({ t: 'Matriz: ' + p, s: 'Processo', ic: 'layout-grid', go: function () { S.mp = p; S.mFiltro = ''; nav('matriz'); } }); });
  L.push({ t: 'Atualizar dados', s: 'Ação', ic: 'refresh', go: atualizar });
  IDIOMAS.forEach(function (l) { L.push({ t: 'Idioma: ' + l[1], s: 'Preferências', ic: 'globe', go: function () { trocarIdioma(l[0]); } }); });
  [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro'], ['orange', 'Laranja']].forEach(function (x) { L.push({ t: 'Tema: ' + x[1], s: 'Preferências', ic: 'sun', go: function () { aplicarTema(x[0], true); } }); });
  return L;
}
function cmdDesenhar() {
  const q = norm($('#cmdIn').value), todos = itensCmd();
  S.cmd.lista = todos.filter(function (x) { return !q || q.split(' ').every(function (w) { return norm(tr(x.t) + ' ' + x.t + ' ' + tr(x.s)).indexOf(w) > -1; }); }).slice(0, 12);
  if (S.cmd.idx >= S.cmd.lista.length) S.cmd.idx = 0;
  $('#cmdList').innerHTML = S.cmd.lista.map(function (x, i) {
    return '<li role="option" data-ci="' + i + '" aria-selected="' + (i === S.cmd.idx) + '" class="' + (i === S.cmd.idx ? 'on' : '') + '">' + ic(x.ic, 16) + '<span class="ct">' + esc(x.t) + '</span><small>' + esc(x.s) + '</small></li>';
  }).join('') || '<li class="vazio">Nada encontrado.</li>';
}
function cmdAbrir() {
  if (!S.u) return;
  S.cmd = { lista: [], idx: 0 }; $('#cmdk').classList.remove('hidden'); $('#cmdIn').value = ''; cmdDesenhar(); $('#cmdIn').focus();
}
function cmdFechar() { $('#cmdk').classList.add('hidden'); }
function cmdIr(i) { const x = S.cmd.lista[i]; if (!x) return; cmdFechar(); x.go(); }
function atalhos() {
  modal('<div class="mhd"><h2 id="modalT">Atalhos de teclado</h2><button type="button" class="btn ico" data-fechar aria-label="Fechar">' + ic('x', 16) + '</button></div>' +
    '<table class="kbd"><tbody><tr><td><kbd>Ctrl</kbd> <kbd>K</kbd></td><td>Buscar telas e ações</td></tr><tr><td><kbd>/</kbd></td><td>Abrir a busca</td></tr><tr><td><kbd>Esc</kbd></td><td>Fechar janelas e painéis</td></tr><tr><td><kbd>Enter</kbd></td><td>Abrir o resultado selecionado</td></tr></tbody></table>');
  $('#modal .box').style.maxWidth = '460px';
}

/* ---------- tela de carregamento, login e cadastro ---------- */
function sair(el) {
  const ms = window.PC_FADE != null ? window.PC_FADE : 280;
  el.classList.add('saindo');
  setTimeout(function () { el.classList.add('hidden'); el.classList.remove('saindo'); }, ms);
}
function dialogo(titulo, html) {
  modal('<div class="mhd"><h2 id="modalT">' + esc(titulo) + '</h2></div><p class="dlg-msg">' + html + '</p><div style="display:flex;justify-content:flex-end"><button type="button" class="btn pri" data-fechar>Entendi</button></div>');
  $('#modal .box').style.maxWidth = '440px';
}
function painelLogin(id) { ['lgEntrar', 'lgCad', 'lgOk'].forEach(function (x) { $('#' + x).classList.toggle('hidden', x !== id); }); }
function avisoLogin() {
  const u = S.bl, e = '<b>' + esc(u.email) + '</b>';
  if (u.motivo === 'nao_cadastrado') {
    if (u.solicitacao === 'Pendente') dialogo('Cadastro em análise', 'O cadastro de ' + e + ' já foi enviado e aguarda aprovação. Você receberá um e-mail quando for aprovado.');
    else if (u.solicitacao === 'Recusada') dialogo('Cadastro não aprovado', 'O último cadastro de ' + e + ' não foi aprovado. Você pode enviar um novo pedido em Cadastrar-se.');
    else dialogo('Login não encontrado', 'Não existe login para ' + e + '. Use o botão Cadastrar-se para solicitar o acesso.');
  } else if (u.motivo === 'inativo') dialogo('Acesso desativado', 'O acesso de ' + e + ' está desativado. Fale com quem administra o sistema.');
  else if (u.motivo === 'sem_hub') dialogo('Hub não definido', 'O acesso de ' + e + ' ainda não está ligado a um Hub ativo. Fale com quem administra o sistema.');
  else if (u.motivo === 'perfil_invalido') dialogo('Acesso indisponível', 'O perfil de ' + e + ' não está mais disponível. Fale com quem administra o sistema.');
}
function atualizarLogin(avisar) {
  const u = S.bl, pendente = u.solicitacao === 'Pendente', cad = u.motivo === 'nao_cadastrado' || u.motivo === 'sem_email';
  $('#lgConta').classList.toggle('hidden', !u.email); $('#lgEmail').textContent = u.email || '';
  $('#lgOu').classList.toggle('hidden', !cad); $('#lgCadastrar').classList.toggle('hidden', !cad);
  $('#lgCadastrar').disabled = pendente; $('#lgCadT').textContent = pendente ? 'Cadastro em análise' : 'Cadastrar-se';
  const h = $('#lgHint');
  if (u.motivo === 'sem_email') { h.textContent = 'Não foi possível identificar a sua conta Google. Clique em Entrar com Google e escolha a conta corporativa.'; h.classList.remove('hidden'); }
  else h.classList.add('hidden');
  if (avisar) avisoLogin();
}
function mostrarLogin(b) {
  S.bl = b.user; S.appUrl = b.appUrl || '';
  $('#login').classList.remove('hidden'); icones($('#login'));
  painelLogin('lgEntrar'); atualizarLogin(true);
}
function irEscolherConta() {
  const url = 'https://accounts.google.com/AccountChooser' + (S.appUrl ? '?continue=' + encodeURIComponent(S.appUrl) : '');
  /* O app roda num iframe protegido: window.open é bloqueado, mas um link com target="_top" acionado pelo clique do usuário navega a página inteira. */
  try {
    const a = document.createElement('a'); a.href = url; a.target = '_top'; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { toast('Não foi possível abrir o seletor de contas do Google.', true); }
}
async function entrarGoogle() {
  if (!S.bl.email) { irEscolherConta(); return; }
  const b = $('#lgGoogle'), t = $('#lgGoogleT'); b.disabled = true; t.textContent = 'Verificando…';
  try {
    const r = await rpc('bootstrap', true);
    if (r.user.ok) { if (entrarApp(r)) sair($('#login')); return; }
    S.bl = r.user; S.appUrl = r.appUrl || S.appUrl; atualizarLogin(true);
  } catch (e) { /* aviso já exibido */ } finally { b.disabled = false; t.textContent = 'Entrar com Google'; }
}
function abrirCadastro() {
  if (!S.bl.email) { dialogo('Entre com o Google primeiro', 'Para solicitar o cadastro, o sistema precisa identificar a sua conta Google. Clique em Entrar com Google e escolha a conta com o seu e-mail corporativo.'); return; }
  ['cdNome', 'cdOutro'].forEach(function (id) { $('#' + id).value = ''; });
  $('#cdCargo').value = ''; $('#cdOutroW').classList.add('hidden'); $('#cdTurno').value = ''; $('#cdTurnoW').classList.add('hidden');
  const hs = S.bl.hubs || []; $('#cdHubW').classList.toggle('hidden', !hs.length);
  $('#cdHub').innerHTML = '<option value="">' + esc(tr('Selecione o Hub')) + '</option>' + hs.map(function (h) { return '<option value="' + esc(h.id) + '">' + esc(h.nome) + '</option>'; }).join('');
  $('#cdEmail').value = S.bl.email; $('#cdEmail').readOnly = true;
  $$('[data-lg-err]').forEach(function (s) { s.textContent = ''; });
  painelLogin('lgCad'); $('#cdNome').focus();
}
async function enviarCadastro() {
  if (S.busy) return;
  const o = { nome: $('#cdNome').value.replace(/\s+/g, ' ').trim(), cargo: $('#cdCargo').value, cargoOutro: $('#cdOutro').value.replace(/\s+/g, ' ').trim(), email: $('#cdEmail').value.trim().toLowerCase(), idioma: idiomaAtual(), hub: $('#cdHub').value, turno: $('#cdTurno').value }, e = {};
  $$('[data-lg-err]').forEach(function (s) { s.textContent = ''; });
  if (o.nome.length < 3) e.nome = 'Informe o nome completo.';
  if (!o.cargo) e.cargo = 'Selecione o cargo.'; else if (o.cargo === 'Outros' && o.cargoOutro.length < 2) e.cargoOutro = 'Digite o cargo.';
  if ((S.bl.hubs || []).length && !o.hub) e.hub = 'Selecione o Hub.';
  if ((S.bl.hubs || []).length && o.cargo === 'Líder' && !o.turno) e.turno = 'Selecione o turno.';
  if (!o.email) e.email = 'Campo obrigatório.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) e.email = 'E-mail inválido.';
  const mostrar = function (er) { Object.keys(er).forEach(function (k) { const s = $('[data-lg-err="' + k + '"]'); if (s) s.textContent = er[k]; }); };
  if (Object.keys(e).length) { mostrar(e); return; }
  S.busy = true; const b = $('#cdEnviar'); b.disabled = true; b.textContent = 'Enviando…';
  try {
    const r = await rpc('solicitarCadastro', o);
    if (r.ok) { $('#lgOkEmail').textContent = o.email; S.bl.solicitacao = 'Pendente'; atualizarLogin(false); painelLogin('lgOk'); return; }
    if (r.erros) mostrar(r.erros);
    if (r.msg) dialogo('Não foi possível enviar', esc(r.msg));
  } catch (x) { /* aviso já exibido */ } finally { S.busy = false; b.disabled = false; b.textContent = 'Enviar cadastro'; }
}
function falhaCarga(motivo) {
  $('#carregando').classList.add('pl-erro');
  $('#plTxt').textContent = 'Não foi possível carregar o sistema.' + (motivo ? ' (' + String(motivo).slice(0, 160) + ')' : ''); $('#carregando .pl-d').classList.add('hidden'); $('#plRetry').classList.remove('hidden');
}
function bindGlobais() {
  $('#btnPrint').addEventListener('click', imprimirRel);
  document.addEventListener('click', function (e) {
    const t = e.target; if (!t.closest) return;
    const q = function (s) { return t.closest(s); };
    let x;
    if ((x = q('[data-tema]'))) { aplicarTema(x.dataset.tema, true); return; }
    if ((x = q('[data-lang]'))) { trocarIdioma(x.dataset.lang); return; }
    if (q('#userBtn')) { menuUsuario($('#userMenu').classList.contains('hidden')); return; }
    if (q('#kbdBtn')) { menuUsuario(false); atalhos(); return; }
    if (!q('#userMenu')) menuUsuario(false);
    if (q('#busca')) { cmdAbrir(); return; }
    if ((x = q('#cmdList li[data-ci]'))) { cmdIr(Number(x.dataset.ci)); return; }
    if (t.id === 'cmdk') { cmdFechar(); return; }
    if (q('#lgGoogle')) entrarGoogle();
    else if (q('#lgCadastrar')) abrirCadastro();
    else if (q('#lgOutra')) irEscolherConta();
    else if (q('#cdEnviar')) enviarCadastro();
    else if (q('#cdVoltar') || q('#lgOkVoltar')) painelLogin('lgEntrar');
    else if (q('#plRetry')) tentarDeNovo();
    else if (q('#srOk')) recusarSolicitacaoUI();
    else if ((x = q('[data-sa]'))) aprovarSolicitacao(Number(x.dataset.sa));
    else if ((x = q('[data-sr]'))) pedirRecusa(Number(x.dataset.sr));
    else if ((x = q('.tact'))) { /* o botão do aviso trata o próprio clique */ }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { menuUsuario(false); cmdFechar(); }
    const digitando = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (S.u && ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) || (e.key === '/' && !digitando))) { e.preventDefault(); cmdAbrir(); return; }
    if (e.target && e.target.id === 'cmdIn') {
      const n = S.cmd.lista.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) { S.cmd.idx = (S.cmd.idx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; cmdDesenhar(); } }
      else if (e.key === 'Enter') { e.preventDefault(); cmdIr(S.cmd.idx); }
    }
    if (e.key === 'Enter' && e.target && e.target.closest && e.target.closest('#lgCad') && e.target.tagName !== 'SELECT') { e.preventDefault(); enviarCadastro(); }
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'cmdIn') { S.cmd.idx = 0; cmdDesenhar(); } });
  $('#cdCargo').addEventListener('change', function () { $('#cdTurnoW').classList.toggle('hidden', !((S.bl.hubs || []).length && this.value === 'Líder')); $('#cdOutroW').classList.toggle('hidden', this.value !== 'Outros'); if (this.value === 'Outros') $('#cdOutro').focus(); });
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (S.temaSel === 'auto') aplicarTema('auto', false); }); } catch (e) { /* sem matchMedia */ }
}

/* ---------- inicialização ---------- */
let appIniciado = false;
/* Sessão do navegador: lembra que ESTA conta já confirmou o login, em todas as abas, por 8 h sem uso (renovada a cada pulso enquanto a aba está visível).
   Guarda só o e-mail e a hora; quem muda de conta Google ou fica 8 h parado vê a tela de login de novo. */
const SESSAO_MIN = 480;
function pcLer() { try { return localStorage.getItem('pc_sess'); } catch (e) { return (window.__pcMem || {}).pc_sess || null; } }
function pcGravar(v) { try { localStorage.setItem('pc_sess', v); } catch (e) { (window.__pcMem = window.__pcMem || {}).pc_sess = v; } }
function sessaoAtiva(email) {
  try { const s = JSON.parse(pcLer() || 'null'); return !!(s && email && s.e === String(email).toLowerCase() && Date.now() - s.t < SESSAO_MIN * 60000 && s.t <= Date.now() + 60000); } catch (e) { return false; }
}
function marcarSessao(email) { if (email) pcGravar(JSON.stringify({ e: String(email).toLowerCase(), t: Date.now() })); }
function iniciarApp(b) {
  if (appIniciado) {
    if (S.reentrar) { S.reentrar = false; S.u = b.user; aplicarBase(b); $('#app').classList.remove('hidden'); v8Cabecalho(); renderNav(); nav(S.v || S.u.telas[0]); }
    return;
  }
  marcarSessao(b.user && b.user.email);
  appIniciado = true;
  aplicarBase(b); S.u = b.user;
  $('#whoN').textContent = S.u.nome; $('#whoP').textContent = S.u.perfil;
  $('#av').textContent = String(S.u.nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  $('#app').classList.remove('hidden');
  icones(document);
  $('#nav').addEventListener('click', function (e) {
    const g = e.target.closest('button[data-g]');
    if (g) { S.gopen = !(g.getAttribute('aria-expanded') === 'true'); renderNav(); return; }
    const v = e.target.closest('button[data-v]'); if (v) { if (v.dataset.v === S.v) S.det = null; nav(v.dataset.v); }
  });
  document.addEventListener('click', function (e) { const a = e.target.closest && e.target.closest('[data-vai]'); if (a) { e.preventDefault(); nav(a.dataset.vai); } });
  $('#burger').onclick = function () { $('#side').classList.toggle('open'); };
  $('#refresh').onclick = atualizar;
  marcar();
  $('#brand').onclick = function () { document.body.classList.toggle('col'); };
  fbarInit();
  v8Init();
  nav(['matriz', 'form', 'minhas', 'geral'].filter(tela)[0] || S.u.telas[0]);
  setInterval(relUpd, 30000);
  if (pode('autorizar')) setInterval(sondar, window.PC_POLL || 120000);
  if (tela('minhas')) setInterval(sondarMetas, window.PC_POLL || 120000);
  setInterval(sondarFb, window.PC_POLL || 120000);
}
let bootLigado = false;
function tentarDeNovo() {
  $('#carregando').classList.remove('pl-erro'); $('#plTxt').textContent = 'Carregando o sistema'; $('#carregando .pl-d').classList.remove('hidden'); $('#plRetry').classList.add('hidden');
  boot();
}
async function boot() {
  if (!bootLigado) {
    iniciarIdioma(); aplicarTema(temaSalvo(), false); icones(document);
    $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === idiomaAtual())); });
    bindGlobais(); v8Eventos(); v9Eventos(); v10Eventos(); bootLigado = true;
  }
  const ini = Date.now(), min = window.PC_MIN_LOAD != null ? window.PC_MIN_LOAD : 700;
  let b, fim = false;
  const vigia = setTimeout(function () { if (!fim) falhaCarga('o servidor não respondeu em 60 s'); }, 60000);
  try { b = await rpc('bootstrap', false); } catch (e) { fim = true; clearTimeout(vigia); falhaCarga(e && e.message); return; }
  const resto = min - (Date.now() - ini);
  if (resto > 0) await new Promise(function (r) { setTimeout(r, resto); });
  try {
    if (b.user.ok && window.PC_GATE !== false && !sessaoAtiva(b.user.email)) { mostrarLogin(b); }
    else if (b.user.ok) { if (!entrarApp(b)) { fim = true; clearTimeout(vigia); sair($('#carregando')); return; } } else { mostrarLogin(b); }
  } catch (e) { fim = true; clearTimeout(vigia); falhaCarga(e && e.message); return; }
  fim = true; clearTimeout(vigia);
  sair($('#carregando'));
}
boot();
