/* ---------- v8: Hub, usuários online, log de atividade, aviso de transparência e carga em massa ---------- */
function hubOn() { return !!(S.u && S.u.hub && S.u.hub.on); }
function hubGlobal() { return hubOn() && !!S.u.hub.global; }
/** Aplica o bootstrap com segurança: aviso pendente ou usuário sem acesso nunca deixam o estado do cliente pela metade. */
/** Esquece tudo o que é do Hub anterior (formulários abertos, filtros, listas, gráficos). */
function resetEstadoHub() {
  S.mx = {}; S.edit = null; S.delIdx = -1; S.ac = null; S.d = {}; S.det = null; S.F = null; S.pag = 1; S.lg = null; S.online = null; S.hubs = null; S.rg = null; S.rgEd = null; S.cadQ = ''; S.cadF = '';
  ['processo', 'doca', 'turno', 'lider', 'colaborador', 'auditor', 'faixa', 'obs'].forEach(function (k) { S.flt[k] = ''; });
  S.lgSeq = (S.lgSeq || 0) + 1; if ($('#v-log')) $('#v-log').innerHTML = '';
  destruirGraficos();
}
function aplicarBootstrap(b) {
  if (b && b.bloqueado) { S.reentrar = true; mostrarAviso(b); return false; }
  if (!b || !b.user || !b.user.ok) { S.reentrar = true; $('#app').classList.add('hidden'); mostrarLogin(b || { user: { ok: false } }); return false; }
  const idAntes = S.u && S.u.hub ? S.u.hub.id : null;
  S.u = b.user; aplicarBase(b);
  if (idAntes !== null && b.user.hub && b.user.hub.id !== idAntes) resetEstadoHub(); // Hub mudou (outra aba): nada do anterior pode sobrar
  v8Cabecalho(); return true;
}
/** O servidor passou a exigir o aceite no meio da sessão: leva a pessoa à tela de aceite. */
async function reavisar() {
  if ($('#avisoTela')) return;
  try { const b = await rpc('bootstrap', false); if (b && b.bloqueado) { S.reentrar = true; mostrarAviso(b); } } catch (e) { /* o aviso de erro já foi exibido */ }
}
function hubNomeDe(id) {
  if (id === '*') return tr('Admin global');
  const l = (S.u && S.u.hub && S.u.hub.lista) || S.hubs || (S.ac && S.ac.hubs) || [];
  const h = l.find(function (x) { return x.id === id; });
  return h ? h.nome : String(id || '');
}
/** Cabeçalho: Hub e Operação ativos; o Admin global escolhe o Hub (a escolha vale no servidor, por usuário). */
function v8Cabecalho() {
  const el = $('#hubChip'); if (!el) return;
  const h = S.u.hub;
  if (!hubOn() || !h.nome) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (h.global && h.lista && h.lista.length > 1) {
    el.innerHTML = '<label class="hl" for="hubSel">' + ic('globe', 14) + esc(tr('Hub ativo')) + '</label><select id="hubSel" title="' + esc(tr('Trocar de Hub')) + '">' + h.lista.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === h.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</select><span class="op">' + esc(h.operacao) + '</span>';
  } else el.innerHTML = ic('globe', 14) + '<b>' + esc(h.nome) + '</b><span class="op">' + esc(h.operacao) + '</span>';
}
/** Troca o Hub sem recarregar a página (recarregar o iframe do Apps Script deixa a tela em branco). */
async function trocarHub(id) {
  const sel = $('#hubSel'), antes = S.u.hub.id;
  if (S.busy || (S.F && S.F.busy)) { v8Cabecalho(); toast(tr('Aguarde terminar a operação em andamento para trocar de Hub.'), true); return; }
  S.busy = true; if (sel) sel.disabled = true;
  let trocou = false;
  try {
    await rpc('definirHubAtivo', id); trocou = true;
    const b = await rpc('bootstrap', false); // o servidor já separa o cache por Hub: não precisa limpar o de todos
    if (!aplicarBootstrap(b)) return;
    resetEstadoHub(); fbarFill(); renderNav(); nav(S.v);
    v8OnlineN(); toast(tpl('Hub ativo: {0}', [S.u.hub.nome]));
  } catch (e) {
    if (trocou) { try { await rpc('definirHubAtivo', antes); } catch (e2) { /* sem como desfazer agora */ } toast(tr('O Hub não foi trocado. Tente de novo.'), true); }
    S.u.hub.id = antes; v8Cabecalho();
  } finally { S.busy = false; const s2 = $('#hubSel'); if (s2) s2.focus(); }
}
/* ----- online ----- */
function v8Pulso() {
  if (typeof google === 'undefined' || document.hidden) return;
  if (S.u && S.u.email) marcarSessao(S.u.email); // renova a sessão enquanto a pessoa usa o sistema
  try { google.script.run.withSuccessHandler(function (r) { if (r && r.hub && hubOn() && S.u.hub.id && r.hub !== S.u.hub.id && !S.busy) { toast(tr('O Hub ativo foi alterado em outra aba. Atualizando.'), true); atualizar(); } }).withFailureHandler(function () { /* silencioso */ }).pulso(); } catch (e) { /* sem conexão */ }
}
async function v8OnlineN() {
  if (document.hidden) return;
  try {
    const r = await new Promise(function (ok, er) { google.script.run.withSuccessHandler(ok).withFailureHandler(er).listarOnline(); });
    const n = $('#onlineN'); if (n) n.textContent = r.total;
    S.online = r;
  } catch (e) { /* silencioso */ }
}
async function abrirOnline() {
  let r; try { r = await rpc('listarOnline'); } catch (e) { return; }
  S.online = r; const n = $('#onlineN'); if (n) n.textContent = r.total;
  const rows = r.usuarios.map(function (u) { return '<tr><td>' + esc(u.nome) + '</td><td>' + esc(u.perfil) + '</td>' + (hubGlobal() ? '<td>' + esc(u.hub === '*' ? tr('Admin global') : u.hubNome) + '</td>' : '') + '<td>' + (u.segundos < 60 ? esc(tr('agora')) : esc(tpl('há {0} min', [Math.floor(u.segundos / 60)]))) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">' + esc(tr('Ninguém online no momento.')) + '</td></tr>';
  modal('<div class="mhd"><h2 id="modalT">' + esc(tr('Usuários online')) + ' (' + r.total + ')</h2><button type="button" class="btn ico" data-fechar aria-label="' + esc(tr('Fechar')) + '">' + ic('x', 16) + '</button></div>' +
    '<div class="scroll"><table><thead><tr><th>' + esc(tr('Nome')) + '</th><th>' + esc(tr('Perfil')) + '</th>' + (hubGlobal() ? '<th>Hub</th>' : '') + '<th>' + esc(tr('Última atividade')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="muted" style="margin-top:8px">' + esc(tpl('Considera online quem usou o sistema nos últimos {0} minutos.', [r.janelaMin])) + '</p>');
  $('#modal .box').style.maxWidth = '560px';
}
/* ----- log de atividade ----- */
function loadLog() { S.lg = S.lg || { pagina: 1, f: {} }; return desenharLog(); }
async function desenharLog() {
  const el = $('#v-log'), L = S.lg;
  if (!$('#lgForm')) el.innerHTML = '<div class="card"><div class="hd"><b>' + esc(tr('Log de atividade')) + '</b></div><form id="lgForm" class="grid" autocomplete="off">' +
    '<label>' + esc(tr('De')) + '<input type="date" data-lf="de"></label><label>' + esc(tr('Até')) + '<input type="date" data-lf="ate"></label>' +
    '<label>' + esc(tr('Usuário')) + '<input data-lf="email" maxlength="120" placeholder="' + esc(tr('Nome ou e-mail')) + '"></label><label>' + esc(tr('Ação')) + '<input data-lf="acao" maxlength="120" placeholder="' + esc(tr('Texto da ação')) + '"></label>' +
    (hubGlobal() ? '<label>Hub<select data-lf="hub"><option value="">' + esc(tr('Todos')) + '</option>' + S.u.hub.lista.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nome) + '</option>'; }).join('') + '</select></label>' : '') +
    '</form><div style="margin-top:10px"><button type="button" class="btn pri" id="lgBuscar">' + esc(tr('Filtrar')) + '</button> <button type="button" class="btn" id="lgLimpar">' + esc(tr('Limpar filtros')) + '</button></div></div><div class="card" id="lgRes">' + skel(5) + '</div>';
  const f = Object.assign({}, L.f, { pagina: L.pagina }), seq = S.lgSeq = (S.lgSeq || 0) + 1;
  let r; try { r = await rpc('consultarLog', f); } catch (e) { if (seq === S.lgSeq && $('#lgRes')) $('#lgRes').innerHTML = esc(tr('Não foi possível carregar o log.')); return; }
  if (S.v !== 'log' || seq !== S.lgSeq || !$('#lgRes')) return;
  const pag = Math.max(1, Math.ceil(r.total / r.porPagina));
  $('#lgRes').innerHTML = '<div class="scroll"><table><thead><tr><th>' + esc(tr('Quando')) + '</th>' + (hubGlobal() ? '<th>Hub</th>' : '') + '<th>' + esc(tr('Usuário')) + '</th><th>' + esc(tr('Perfil')) + '</th><th>' + esc(tr('Ação')) + '</th><th>' + esc(tr('Alvo')) + '</th><th>' + esc(tr('Detalhe')) + '</th></tr></thead><tbody>' +
    (r.linhas.map(function (x) { return '<tr><td>' + esc(fmtDt(x.ts)) + '</td>' + (hubGlobal() ? '<td>' + esc(x.hubNome) + '</td>' : '') + '<td>' + esc(x.nome) + '<br><small class="muted">' + esc(x.email) + '</small></td><td>' + esc(x.perfil) + '</td><td>' + esc(x.acao) + '</td><td>' + esc(x.alvo) + '</td><td>' + esc(x.detalhe) + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="muted">' + esc(tr('Nenhum registro encontrado.')) + '</td></tr>') +
    '</tbody></table></div><div class="toolbar" style="margin-top:10px"><button type="button" class="btn" id="lgAnt"' + (L.pagina <= 1 ? ' disabled' : '') + '>' + esc(tr('Anterior')) + '</button><span class="muted">' + esc(tpl('Página {0} de {1}', [L.pagina, pag])) + ' · ' + esc(tpl('{0} registros', [r.total])) + '</span><button type="button" class="btn" id="lgProx"' + (L.pagina >= pag ? ' disabled' : '') + '>' + esc(tr('Próxima')) + '</button></div>' +
    (r.truncado ? '<div class="note bad">' + ic('alert', 16) + '<span>' + esc(tr('O log é grande: só os registros mais recentes foram lidos. Use filtros de data para ver os mais antigos.')) + '</span></div>' : '') +
    (r.falhasLog ? '<div class="note bad">' + ic('alert', 16) + '<span>' + esc(tpl('{0} ação(ões) foram concluídas mas não puderam ser registradas no log (veja os registros de execução do Apps Script).', [r.falhasLog])) + '</span></div>' : '') +
    '<p class="muted">' + esc(tpl('Mostra as ações dos últimos {0} dias; registros mais antigos ficam na planilha de arquivo, por até 1 ano.', [r.vivoDias])) + '</p>';
}
function lerFiltroLog() { const f = {}; $$('#lgForm [data-lf]').forEach(function (i) { if (i.value.trim()) f[i.dataset.lf] = i.value.trim(); }); return f; }
/* ----- aba Hubs (Admin global) ----- */
function hubsAba() { return hubGlobal() && pode('hubs'); }
async function drawHubs(preset) {
  const el = $('#acBody'); el.innerHTML = '<div class="card">' + skel(4) + '</div>';
  let r; try { r = await rpc('listarHubs'); } catch (e) { el.innerHTML = '<div class="card">' + esc(tr('Não foi possível carregar os Hubs.')) + '</div>'; return; }
  S.hubs = r.hubs; const ed = preset && preset.edit, v = (preset && preset.vals) || ed || {};
  el.innerHTML = '<div class="card"><div class="hd"><b>' + esc(ed ? tr('Editar Hub') : tr('Novo Hub')) + '</b></div><div class="grid" style="margin-top:12px">' +
    '<label>' + esc(tr('Nome do Hub')) + ' <span class="req">*</span><input data-h="nome" maxlength="60" value="' + esc(v.nome || '') + '"><span class="err" data-he="nome"></span></label>' +
    '<label>' + esc(tr('Operação')) + ' <span class="req">*</span><input data-h="operacao" maxlength="60" value="' + esc(v.operacao || '') + '"><span class="err" data-he="operacao"></span></label>' +
    '<label>' + esc(tr('Ativo')) + '<select data-h="ativo"><option value="Sim"' + (v.ativo === false ? '' : ' selected') + '>' + esc(tr('Sim')) + '</option><option value="Não"' + (v.ativo === false ? ' selected' : '') + '>' + esc(tr('Não')) + '</option></select></label></div>' +
    '<div style="margin-top:12px"><button type="button" class="btn pri" id="hbSalvar">' + esc(ed ? tr('Salvar alteração') : tr('Adicionar Hub')) + '</button> <button type="button" class="btn ' + (ed ? '' : 'hidden') + '" id="hbCancel">' + esc(tr('Cancelar')) + '</button></div></div>' +
    '<div class="card"><div class="scroll"><table><thead><tr><th>' + esc(tr('Nome do Hub')) + '</th><th>' + esc(tr('Operação')) + '</th><th>' + esc(tr('Ativo')) + '</th><th>' + esc(tr('Usuários')) + '</th><th></th></tr></thead><tbody>' +
    S.hubs.map(function (h, i) { return '<tr><td>' + esc(h.nome) + '</td><td>' + esc(h.operacao) + '</td><td>' + esc(h.ativo ? tr('Sim') : tr('Não')) + '</td><td>' + h.usuarios + '</td><td><button type="button" class="btn sm" data-he-ed="' + i + '">' + ic('pencil', 14) + esc(tr('Editar')) + '</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
  S.hubEd = ed || null;
}
async function salvarHubUI() {
  if (S.busy) return;
  const o = {}; $$('#acBody [data-h]').forEach(function (i) { o[i.dataset.h] = i.value.trim(); });
  $$('#acBody [data-he]').forEach(function (s) { s.textContent = ''; });
  S.busy = true;
  try {
    const r = await rpc('salvarHub', Object.assign({ _row: S.hubEd ? S.hubEd._row : 0 }, o, { ativo: o.ativo !== 'Não' }), S.hubEd);
    if (!r.ok) { if (r.erros) Object.keys(r.erros).forEach(function (k) { const s = $('#acBody [data-he="' + k + '"]'); if (s) s.textContent = r.erros[k]; }); toast(r.msg || tr('Há campos obrigatórios ou inválidos.'), true); return; }
    S.hubEd = null; toast(tr('Hub salvo')); await drawHubs();
    S.u.hub.lista = r.hubs.filter(function (h) { return h.ativo; }); v8Cabecalho();
  } catch (e) { /* aviso exibido */ } finally { S.busy = false; }
}
/** Campo Hub do formulário de usuário (só para o Admin global; os demais criam sempre no próprio Hub). */
function v8HubCampo(v) {
  if (!hubGlobal()) return '';
  const lista = S.u.hub.lista || [];
  return '<label>Hub <span class="req">*</span><select data-u="Hub"><option value="">' + esc(tr('Selecione…')) + '</option><option value="*"' + (v.Hub === '*' ? ' selected' : '') + '>' + esc(tr('Admin global (todos os Hubs)')) + '</option>' + lista.map(function (h) { return '<option value="' + esc(h.id) + '"' + (v.Hub === h.id ? ' selected' : '') + '>' + esc(h.nome) + '</option>'; }).join('') + '</select><span class="err" data-ue-err="Hub"></span></label>';
}
function v8TagHub(r) { return hubGlobal() && r.Hub ? ' <span class="tag-t">' + esc(hubNomeDe(r.Hub)) + '</span>' : ''; }
/* ----- carga em massa ----- */
function v8CargaBtn(aba) {
  const tipo = aba === 'Cad_Pessoas' ? 'pessoas' : (aba === 'Cad_Estrutura' ? 'docas' : '');
  const bar = $('#v-cad .cbar'); if (!bar || !tipo || $('#btnCarga')) return;
  if (!pode(tipo === 'pessoas' ? 'cad_pessoas' : 'cad_estrutura')) return;
  bar.insertAdjacentHTML('beforeend', '<button type="button" class="btn" id="btnCarga" data-ct="' + tipo + '">' + ic('download', 14) + esc(tr('Carga em massa')) + '</button>');
}
function abrirCarga(tipo) {
  S.carga = { tipo: tipo, ok: false };
  modal('<div class="mhd"><h2 id="modalT">' + esc(tipo === 'pessoas' ? tr('Carga em massa: pessoas') : tr('Carga em massa: docas')) + '</h2><button type="button" class="btn ico" data-fechar aria-label="' + esc(tr('Fechar')) + '">' + ic('x', 16) + '</button></div>' +
    '<p class="muted">' + esc(tr('Cole a tabela do Excel (com cabeçalho). Se qualquer linha tiver erro, nada é gravado e o sistema mostra a linha e a coluna.')) + '</p>' +
    '<div style="margin:8px 0"><button type="button" class="btn sm" id="cgModelo">' + esc(tr('Copiar modelo')) + '</button></div>' +
    '<textarea id="cgTexto" rows="10" style="width:100%" spellcheck="false" aria-label="' + esc(tr('Tabela colada do Excel')) + '"></textarea>' +
    '<div id="cgRes" style="margin-top:10px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button type="button" class="btn" id="cgValidar">' + esc(tr('Validar')) + '</button><button type="button" class="btn pri hidden" id="cgGravar">' + esc(tr('Gravar')) + '</button></div>');
  $('#modal .box').style.maxWidth = '720px';
}
async function cargaModelo() {
  let m; try { m = await rpc('importarModelo', S.carga.tipo); } catch (e) { return; }
  const t = m.cabecalho + '\n' + m.exemplo;
  try { await navigator.clipboard.writeText(t); toast(tr('Modelo copiado')); } catch (e) { const a = $('#cgTexto'); a.value = t; a.select(); toast(tr('Modelo colocado na caixa; copie e cole no Excel')); }
}
function cargaErros(r) {
  return '<div class="note bad">' + ic('alert', 16) + '<span><b>' + esc(tr('Nada foi gravado.')) + '</b> ' + esc(tpl('{0} erro(s) encontrado(s):', [r.totalErros])) + '</span></div><ul class="cg-err">' +
    r.erros.map(function (e) { return '<li>' + (e.linha ? esc(tpl('Linha {0}', [e.linha])) : '') + (e.coluna ? ', ' + esc(tr('coluna')) + ' <b>' + esc(e.coluna) + '</b>' : '') + ': <span>' + esc(tr(e.msg)) + '</span></li>'; }).join('') + '</ul>';
}
async function cargaValidar() {
  if (!$('#cgTexto')) return;
  const txt = $('#cgTexto').value; if (!txt.trim()) { $('#cgRes').innerHTML = '<div class="note">' + esc(tr('Cole a tabela do Excel na caixa.')) + '</div>'; return; }
  let r; try { r = await rpc('importarPrevia', S.carga.tipo, txt); } catch (e) { return; }
  S.carga.ok = r.ok; $('#cgGravar').classList.toggle('hidden', !r.ok);
  if (!r.ok) { $('#cgRes').innerHTML = cargaErros(r); return; }
  $('#cgRes').innerHTML = '<div class="note">' + ic('info', 16) + '<span>' + esc(tpl('{0} linhas prontas para gravar', [r.resumo.total])) + (r.hub ? ' ' + esc(tr('no Hub')) + ' <b>' + esc(r.hub) + '</b>' : '') + '.</span></div><div class="scroll"><table><thead><tr>' + r.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + r.previa.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' + (r.resumo.total > r.previa.length ? '<p class="muted">' + esc(tpl('Mostrando as primeiras {0} linhas.', [r.previa.length])) + '</p>' : '');
}
async function cargaGravar() {
  if (S.busy || !S.carga || !S.carga.ok) return;
  S.busy = true;
  try {
    const r = await rpc('importarConfirmar', S.carga.tipo, $('#cgTexto').value);
    if (!r.ok) { S.carga.ok = false; $('#cgGravar').classList.add('hidden'); $('#cgRes').innerHTML = cargaErros(r); return; }
    fecharModal(); toast(tpl('{0} linhas gravadas', [r.gravados])); await atualizar();
  } catch (e) { /* aviso exibido */ } finally { S.busy = false; }
}
/* ----- aviso de transparência (aceite) ----- */
function mostrarAviso(b) {
  S.avisoB = b;
  let el = $('#avisoTela'); if (el) el.remove();
  const idi = idiomaAtual(), texto = b.aviso.texto[idi] || b.aviso.texto.pt;
  document.body.insertAdjacentHTML('beforeend', '<div id="avisoTela" class="aviso-tela" role="dialog" aria-modal="true" aria-labelledby="avT"><div class="box"><h2 id="avT">' + esc(tr('Aviso de transparência')) + '</h2><p>' + esc(texto) + '</p><p class="muted">' + esc(tr('Você precisa aceitar para continuar. Um novo aceite é pedido sempre que este texto mudar.')) + '</p><button type="button" class="btn pri" id="avAceitar">' + esc(tr('Li e aceito')) + '</button></div></div>');
  $('#carregando') && $('#carregando').classList.add('hidden');
  const l = $('#login'); if (l) l.classList.add('hidden');
  $('#avAceitar').focus();
}
async function aceitarAvisoUI() {
  if (S.busy) return; S.busy = true;
  try {
    const r = await rpc('aceitarAviso', S.avisoB.aviso.versao);
    if (!r.ok) { toast(r.msg, true); const b = await rpc('bootstrap', false); mostrarAviso(b); return; }
    const b = await rpc('bootstrap', false); const e = $('#avisoTela'); if (e) e.remove();
    entrarApp(b);
  } catch (e) { /* aviso exibido */ } finally { S.busy = false; }
}
/** Entrada única no app: com aceite pendente mostra o aviso; senão inicia. */
function entrarApp(b) { if (b.bloqueado) { mostrarAviso(b); return false; } iniciarApp(b); return true; }
function v8Init() {
  v8Cabecalho();
  if (pode('ver_online')) { $('#onlineBtn').classList.remove('hidden'); v8OnlineN(); setInterval(v8OnlineN, window.PC_POLL || 120000); }
  v8Pulso(); setInterval(v8Pulso, window.PC_POLL || 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) v8Pulso(); });
}
function v8Eventos() {
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'cgTexto' && S.carga) { S.carga.ok = false; const g = $('#cgGravar'); if (g) g.classList.add('hidden'); } });
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'hubSel') trocarHub(e.target.value); });
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest ? e.target.closest('button') : null; if (!t) return;
    if (t.id === 'onlineBtn') abrirOnline();
    else if (t.id === 'lgBuscar') { S.lg.f = lerFiltroLog(); S.lg.pagina = 1; desenharLog(); }
    else if (t.id === 'lgLimpar') { S.lg.f = {}; S.lg.pagina = 1; $$('#lgForm [data-lf]').forEach(function (i) { i.value = ''; }); desenharLog(); }
    else if (t.id === 'lgAnt') { S.lg.pagina = Math.max(1, S.lg.pagina - 1); desenharLog(); }
    else if (t.id === 'lgProx') { S.lg.pagina++; desenharLog(); }
    else if (t.id === 'hbSalvar') salvarHubUI();
    else if (t.id === 'hbCancel') drawHubs();
    else if (t.dataset && t.dataset.heEd !== undefined) drawHubs({ edit: S.hubs[Number(t.dataset.heEd)] });
    else if (t.id === 'btnCarga') abrirCarga(t.dataset.ct);
    else if (t.id === 'cgModelo') cargaModelo();
    else if (t.id === 'cgValidar') cargaValidar();
    else if (t.id === 'cgGravar') cargaGravar();
    else if (t.id === 'avAceitar') aceitarAvisoUI();
  });
}
