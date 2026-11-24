
/* ---------- acessos: usuários, perfis, histórico, segurança ---------- */
const MODO_TXT = { todos: 'Todos os dados', time: 'Somente o time dele', proprias: 'Somente as auditorias que ele mesmo fez' };
function normPerf(p) {
  const A = S.ac, perms = A.perms.map(function (x) { return x.id; }).filter(function (x) { return p.perms.indexOf(x) > -1; });
  let telas = A.telas.map(function (x) { return x.id; }).filter(function (x) { return p.telas.indexOf(x) > -1; });
  perms.forEach(function (x) { const t = A.permTela[x]; if (t && telas.indexOf(t) < 0) telas.push(t); });
  telas = A.telas.map(function (x) { return x.id; }).filter(function (t) {
    if (telas.indexOf(t) < 0) return false;
    const r = A.reqTela[t]; return !r || r.some(function (x) { return perms.indexOf(x) > -1; });
  });
  return { nome: p.nome, desc: p.desc, perms: perms, telas: telas, escopo: p.escopo };
}
function resumoPerf(p) {
  const A = S.ac, nm = function (lista, ids) { return ids.map(function (id) { return (lista.find(function (x) { return x.id === id; }) || { nome: id }).nome; }); };
  const e = p.escopo;
  const dados = [MODO_TXT[e.modo] || '—'];
  dados.push(e.processos.length ? 'Processos: ' + e.processos.join(', ') : 'Todos os processos');
  dados.push(e.turnos.length ? 'Turnos: ' + e.turnos.join(', ') : 'Todos os turnos');
  return '<div class="resumo"><b>Resumo em linguagem simples</b><ul>' +
    '<li>Pode: ' + (p.perms.length ? esc(nm(A.perms, p.perms).join('; ')) : 'apenas consultar') + '.</li>' +
    '<li>Vê as telas: ' + (p.telas.length ? esc(nm(A.telas, p.telas).join(', ')) : 'nenhuma') + '.</li>' +
    '<li>Dados: ' + esc(dados.join(' · ')) + '.</li></ul></div>';
}
async function loadAcessos() {
  const el = $('#v-acessos'); el.innerHTML = '<div class="card">' + skel(5) + '</div>';
  try {
    const par = await Promise.all([rpc('listarAcessos'), pode('autorizar') ? rpc('listarSolicitacoes') : Promise.resolve(null)]);
    S.ac = par[0];
    if (par[1]) { S.sol = par[1]; S.pend = S.sol.pendentes.length; renderNav(); }
  } catch (e) { el.innerHTML = '<div class="card">Não foi possível carregar os acessos.</div>'; return; }
  if (S.v !== 'acessos') return;
  const abas = abasAc();
  if (abas.indexOf(S.acTab) < 0) S.acTab = abas.filter(function (a) { return a !== 'autorizar'; })[0] || abas[0];
  S.acSel = null;
  if (S.acSol && S.ac.pode.usuarios) { S.acTab = 'usuarios'; S.acEdit = null; renderAcessos(); return; }
  S.acSol = null; renderAcessos();
}
function abasAc() {
  const a = [];
  if (pode('autorizar') && tela('autorizar')) a.push('autorizar');
  if (S.ac.pode.usuarios) a.push('usuarios');
  if (S.ac.pode.perfis) a.push('perfis');
  if (S.ac.pode.regras) a.push('regras');
  a.push('log');
  if (S.ac.pode.perfis) a.push('seg');
  if (hubsAba()) a.push('hubs');
  return a;
}
const AC_NOME = { autorizar: 'Autorizações', usuarios: 'Usuários', perfis: 'Perfis', regras: 'Regras de auditoria', log: 'Histórico de alterações', seg: 'Segurança', hubs: 'Hubs' };
function renderAcessos() {
  const el = $('#v-acessos'), abas = abasAc();
  const tabs = '<div class="tabs">' + abas.map(function (k) { return '<button type="button" class="' + (k === S.acTab ? 'on' : '') + '" data-at="' + k + '">' + AC_NOME[k] + (k === 'autorizar' && S.pend > 0 ? '<span class="badge-n">' + S.pend + '</span>' : '') + '</button>'; }).join('') + '</div>';
  el.innerHTML = tabs + '<div id="acBody"></div>';
  if (S.acTab === 'usuarios' && S.acSol) drawUsuarios({ vals: { Email_Google: S.acSol.email, Nome: S.acSol.nome, Status_Ativo: 'Sim', Hub: S.acSol.hub || '' }, edit: null, erros: {} });
  else if (S.acTab === 'autorizar') drawAutorizar('#acBody');
  else ({ usuarios: drawUsuarios, perfis: drawPerfis, regras: drawRegras, log: drawLog, seg: drawSeg, hubs: drawHubs })[S.acTab]();
}
/** Atualiza só o número de pendentes na aba Autorizar, sem redesenhar a tela. */
function atualizarSeloAcessos() {
  const b = $('#v-acessos .tabs button[data-at="autorizar"]'); if (!b) return;
  const s = b.querySelector('.badge-n');
  if (S.pend > 0) { if (s) s.textContent = S.pend; else b.insertAdjacentHTML('beforeend', '<span class="badge-n">' + S.pend + '</span>'); } else if (s) s.remove();
}
const naAba = function (a) { return S.v === 'acessos' && S.acTab === a; };
function perfisAtrib() { return S.ac.perfis.filter(function (p) { return p.atribuivel; }); }
function drawUsuarios(preset) {
  const A = S.ac, ed = preset ? preset.edit : S.acEdit, v = preset ? preset.vals : (ed || {}), u = A.usuarios || [], sol = ed ? null : S.acSol;
  S.acEdit = ed || null;
  const perfs = perfisAtrib().map(function (p) { return p.nome; });
  if (v.Perfil && perfs.indexOf(v.Perfil) < 0) perfs.push(v.Perfil);
  const sel = function (n, arr, cur) { return '<select data-u="' + n + '"><option value="">Selecione…</option>' + arr.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
  const rows = u.map(function (r, i) {
    const pf = A.perfis.find(function (p) { return p.nome === r.Perfil; });
    return '<tr><td>' + esc(r.Email_Google) + '</td><td>' + esc(r.Nome) + v8TagHub(r) + (r.semLider ? ' <span class="tag-t" title="' + esc(tr('Este perfil enxerga só o time do líder, mas não há líder ativo com este nome no cadastro de pessoas. A pessoa não verá nenhum dado.')) + '">' + esc(tr('líder não encontrado')) + '</span>' : '') + '</td><td>' + esc(r.Perfil) + (pf && pf.atribuivel ? '' : ' <span class="tag-t">acima do seu</span>') + '</td><td>' + (r.Status_Ativo === 'Não' ? pill('', 'Inativo') : pill('verde', 'Ativo')) + '</td><td>' +
      (r.editavel ? '<button type="button" class="btn sm" data-ue="' + i + '">' + ic('pencil', 14) + 'Editar</button> <button type="button" class="btn sm bad" data-ux="' + i + '">' + ic('trash', 14) + (S.acDel === i ? 'Confirmar exclusão?' : 'Excluir') + '</button>' : '<span class="muted">somente leitura</span>') + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">Nenhum usuário.</td></tr>';
  $('#acBody').innerHTML = '<div class="card"><div class="hd"><b>' + (ed ? 'Editar usuário' : (sol ? 'Cadastro aprovado: definir perfil' : 'Novo usuário')) + '</b></div>' + (sol ? aviso('Solicitação de <b>' + esc(sol.nome) + '</b>. Cargo informado: <b>' + esc(sol.cargo) + '</b>. Escolha o perfil e confirme para liberar o acesso. A pessoa será avisada por e-mail.') : '') + aviso('Você só pode atribuir perfis com permissões, telas e dados iguais ou menores que os seus, e não pode alterar o seu próprio acesso.') +
    '<div class="grid" style="margin-top:12px"><label>E-mail Google <span class="req">*</span><input data-u="Email_Google" value="' + esc(v.Email_Google || '') + '" maxlength="120"' + (sol ? ' readonly class="ro"' : '') + '><span class="err" data-ue-err="Email_Google"></span></label>' +
    '<label>Nome <span class="req">*</span><input data-u="Nome" value="' + esc(v.Nome || '') + '" maxlength="120"><span class="err" data-ue-err="Nome"></span></label>' +
    '<label>Perfil <span class="req">*</span>' + sel('Perfil', perfs, v.Perfil) + '<span class="err" data-ue-err="Perfil"></span></label>' +
    v8HubCampo(v) + '<label>Ativo <span class="req">*</span>' + sel('Status_Ativo', ['Sim', 'Não'], v.Status_Ativo || (ed ? '' : 'Sim')) + '<span class="err" data-ue-err="Status_Ativo"></span></label></div>' +
    '<div style="margin-top:12px"><button type="button" class="btn pri" id="uSalvar">' + (ed ? 'Salvar alteração' : (sol ? 'Aprovar e cadastrar' : 'Adicionar usuário')) + '</button> <button type="button" class="btn ' + (ed || sol ? '' : 'hidden') + '" id="uCancel">' + (sol ? 'Voltar às autorizações' : 'Cancelar edição') + '</button></div></div>' +
    '<div class="card"><div class="toolbar"><input type="search" data-busca placeholder="Buscar usuário…" aria-label="Buscar usuário"></div><div class="scroll"><table data-sort><thead><tr><th data-s="t">E-mail</th><th data-s="t">Nome</th><th data-s="t">Perfil</th><th>Situação</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  tabelaInterativa($('#acBody'));
  if (preset && preset.erros) Object.keys(preset.erros).forEach(function (k) { const s = $('#acBody [data-ue-err="' + k + '"]'); if (s) s.textContent = preset.erros[k]; });
}
function lerUsuario() { const o = {}; $$('#acBody [data-u]').forEach(function (i) { o[i.dataset.u] = i.value.trim(); }); return o; }
async function salvarUsuarioUI() {
  if (S.busy) return;
  const o = lerUsuario(), ed = S.acEdit, e = {};
  $$('#acBody [data-ue-err]').forEach(function (s) { s.textContent = ''; });
  if (!o.Email_Google) e.Email_Google = 'Campo obrigatório.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.Email_Google)) e.Email_Google = 'E-mail inválido.';
  if (hubGlobal() && !o.Hub) e.Hub = 'Selecione o Hub do usuário.'; if (!o.Nome) e.Nome = 'Campo obrigatório.'; if (!o.Perfil) e.Perfil = 'Campo obrigatório.'; if (!o.Status_Ativo) e.Status_Ativo = 'Campo obrigatório.';
  if (Object.keys(e).length) { Object.keys(e).forEach(function (k) { $('#acBody [data-ue-err="' + k + '"]').textContent = e[k]; }); toast('Há campos obrigatórios ou inválidos.', true); return; }
  S.busy = true; const b = $('#uSalvar'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    const r = await rpc('salvarUsuario', Object.assign({ _row: ed ? ed._row : 0 }, o), ed ? semLinha(ed) : null);
    if (!r.ok) { S.busy = false; if (naAba('usuarios')) drawUsuarios({ vals: o, edit: ed, erros: r.erros || {} }); toast(r.msg || 'O servidor recusou o cadastro.', true); return; }
    S.ac.usuarios = r.usuarios; S.acEdit = null;
    if (S.acSol) { concluirAprovacao(r); return; }
    if (naAba('usuarios')) drawUsuarios(); toast('Usuário salvo');
  } catch (x) { b.disabled = false; b.textContent = ed ? 'Salvar alteração' : (S.acSol ? 'Aprovar e cadastrar' : 'Adicionar usuário'); } finally { S.busy = false; }
}
async function excluirUsuarioUI(i) {
  if (S.busy) return;
  // armar e confirmar só mexem no botão da linha: o formulário que está sendo preenchido não é redesenhado
  if (S.acDel !== i) {
    if (S.acDel > -1) rotuloExcluir(S.acDel, false);
    S.acDel = i; S.acDelT = Date.now(); rotuloExcluir(i, true);
    setTimeout(function () { if (S.acDel === i) { S.acDel = -1; rotuloExcluir(i, false); } }, 4000); return;
  }
  if (Date.now() - (S.acDelT || 0) < 500) return; // duplo clique rápido não confirma a exclusão
  S.acDel = -1; S.busy = true;
  const form0 = lerUsuario();
  const r0 = S.ac.usuarios[i];
  try {
    const r = await rpc('excluirUsuario', r0._row, semLinha(r0));
    if (!r.ok) toast(r.msg, true); else { S.ac.usuarios = r.usuarios; toast('Usuário excluído'); }
  } catch (e) { /* aviso exibido */ } finally {
    S.busy = false;
    if (naAba('usuarios')) { drawUsuarios(); Object.keys(form0).forEach(function (k) { const c = $('#acBody [data-u="' + k + '"]'); if (c && form0[k]) c.value = form0[k]; }); }
  }
}
function rotuloExcluir(i, confirmar) { const b = $('#acBody [data-ux="' + i + '"]'); if (b) b.innerHTML = ic('trash', 14) + (confirmar ? 'Confirmar exclusão?' : 'Excluir'); }

/* ----- perfis ----- */
function novoPerfilVazio() { return { nome: '', desc: '', perms: [], telas: ['matriz'], escopo: { modo: 'proprias', processos: [], turnos: [] }, sistema: false, novo: true }; }
function drawPerfis() {
  const A = S.ac, sel = S.acSel, ordem = ['Admin', 'Analista', 'Site Leader', 'Auditor'], lista = A.perfis.slice().sort(function (a, b) { const x = ordem.indexOf(a.nome), y = ordem.indexOf(b.nome); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a.nome.localeCompare(b.nome, 'pt-BR'); });
  const cards = lista.map(function (p) {
    return '<button type="button" class="pf' + (sel && !sel.novo && sel.nome === p.nome ? ' on' : '') + '" data-pf="' + esc(p.nome) + '"><b>' + esc(p.nome) + '</b>' + (p.sistema ? ' <span class="tag-t">padrão</span>' : '') + '<small>' + esc(p.desc || '') + '</small><small>' + p.usuarios + ' usuário(s)</small></button>';
  }).join('');
  $('#acBody').innerHTML = '<div class="toolbar"><button type="button" class="btn pri" id="pfNovo">' + ic('plus', 14) + 'Novo perfil</button><span class="muted">Perfis definem o que cada pessoa vê e pode fazer.</span></div><div class="perfs">' + cards + '</div><div id="pfEd"></div>';
  if (sel) drawEditorPerfil();
}
function bloqueioPerfil(p) {
  if (p.novo) return '';
  if (p.protegido) return 'O perfil Admin é protegido e não pode ser editado.';
  if (p.nome === S.ac.meuPerfil) return 'Você não pode editar o perfil que está usando.';
  if (!p.atribuivel) return 'Este perfil tem permissões acima das suas. Você só pode consultá-lo.';
  return '';
}
function drawEditorPerfil() {
  const A = S.ac, p = S.acSel, bloq = bloqueioPerfil(p), ro = !!bloq, me = S.u, meEsc = me.escopo;
  const dis = function (c) { return ro || c ? ' disabled' : ''; };
  const grupos = []; A.perms.forEach(function (x) { if (grupos.indexOf(x.grupo) < 0) grupos.push(x.grupo); });
  const permsH = grupos.map(function (g) {
    return '<div class="sect">' + esc(g) + '</div><div class="grid">' + A.perms.filter(function (x) { return x.grupo === g; }).map(function (x) {
      const tem = me.perms.indexOf(x.id) > -1;
      return '<label class="perm' + (ro || !tem ? ' dis' : '') + '"><input type="checkbox" data-pp="' + x.id + '"' + (p.perms.indexOf(x.id) > -1 ? ' checked' : '') + dis(!tem) + '><span><b>' + esc(x.nome) + '</b><small>' + esc(x.desc) + (tem ? '' : ' (você não tem esta permissão)') + '</small></span></label>';
    }).join('') + '</div>';
  }).join('');
  const telasH = '<div class="grid">' + A.telas.map(function (t) {
    const tem = me.telas.indexOf(t.id) > -1, forca = p.perms.some(function (x) { return A.permTela[x] === t.id; }), bloqueada = !!(A.reqTela[t.id] && !A.reqTela[t.id].some(function (x) { return p.perms.indexOf(x) > -1; }));
    return '<label class="perm' + (ro || !tem || bloqueada ? ' dis' : '') + '"><input type="checkbox" data-pt="' + t.id + '"' + (p.telas.indexOf(t.id) > -1 ? ' checked' : '') + dis(!tem || forca || bloqueada) + '><span><b>' + esc(t.nome) + '</b>' + (bloqueada ? '<small>Precisa de uma permissão que este perfil não tem.</small>' : forca ? '<small>Obrigatória pelas permissões escolhidas.</small>' : '') + '</span></label>';
  }).join('') + '</div>';
  const modos = ['todos', 'time', 'proprias'].map(function (m) {
    const ok = meEsc.modo === 'todos' || meEsc.modo === m;
    return '<label class="perm' + (ro || !ok ? ' dis' : '') + '"><input type="radio" name="pmodo" data-pm="' + m + '"' + (p.escopo.modo === m ? ' checked' : '') + dis(!ok) + '><span><b>' + esc(MODO_TXT[m]) + '</b></span></label>';
  }).join('');
  const chkLista = function (attr, itens, atual, meus) {
    return '<div class="grid">' + itens.map(function (x) {
      const ok = !meus.length || meus.indexOf(x) > -1;
      return '<label class="perm' + (ro || !ok ? ' dis' : '') + '"><input type="checkbox" ' + attr + '="' + esc(x) + '"' + (atual.indexOf(x) > -1 ? ' checked' : '') + dis(!ok) + '><span><b>' + esc(x) + '</b></span></label>';
    }).join('') + '</div>';
  };
  $('#pfEd').innerHTML = '<div class="card"><div class="hd"><b>' + (p.novo ? 'Novo perfil' : 'Perfil: ' + esc(p.nome)) + '</b>' + (p.novo ? '' : '<span class="muted">' + (p.usuarios || 0) + ' usuário(s)</span>') + '</div>' +
    (bloq ? aviso(esc(bloq)) : '') +
    '<div class="grid" style="margin-top:12px"><label>Nome do perfil <span class="req">*</span><input id="pf-nome" maxlength="40" value="' + esc(p.nome) + '"' + (p.novo && !ro ? '' : ' disabled') + '><span class="err" data-pe="nome"></span></label>' +
    '<label>Descrição<input id="pf-desc" maxlength="200" value="' + esc(p.desc) + '"' + (ro ? ' disabled' : '') + '><span class="err" data-pe="desc"></span></label></div>' +
    '<div class="sect">O que este perfil pode fazer</div>' + permsH + '<span class="err" data-pe="perms"></span>' +
    '<div class="sect">Quais telas aparecem no menu</div>' + telasH + '<span class="err" data-pe="telas"></span>' +
    '<div class="sect">Quais dados enxerga</div><div class="grid">' + modos + '</div>' +
    '<p class="muted" style="margin:6px 0 0">' + esc(tr('"Somente o time dele" identifica o líder pelo nome do usuário, que deve ser igual ao do líder no cadastro de pessoas (acento e maiúsculas não importam). Vale para relatórios, Matriz e listas. O limite por turno é opcional e soma-se a este.')) + '</p>' +
    '<div class="sect">Limitar por processo (nenhum marcado = todos)</div>' + chkLista('data-pp2', S.ac.processos, p.escopo.processos, meEsc.processos) +
    '<div class="sect">Limitar por turno (nenhum marcado = todos)</div>' + chkLista('data-pt2', S.ac.turnos, p.escopo.turnos, meEsc.turnos) + '<span class="err" data-pe="escopo"></span>' +
    '<div style="margin-top:16px" id="pfResumo">' + resumoPerf(p) + '</div>' +
    (ro ? '' : '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn pri" id="pfSalvar">' + (p.novo ? 'Criar perfil' : 'Salvar perfil') + '</button>' + (p.novo || p.sistema ? '' : '<button type="button" class="btn bad" id="pfExcluir">' + ic('trash', 14) + 'Excluir perfil</button>') + '</div>') + '</div>';
}
function lerEditorPerfil() {
  const p = S.acSel;
  p.perms = $$('#pfEd [data-pp]:checked').map(function (i) { return i.dataset.pp; });
  p.telas = $$('#pfEd [data-pt]:checked').map(function (i) { return i.dataset.pt; });
  const m = $('#pfEd [data-pm]:checked');
  p.escopo = { modo: m ? m.dataset.pm : 'proprias', processos: $$('#pfEd [data-pp2]:checked').map(function (i) { return i.getAttribute('data-pp2'); }), turnos: $$('#pfEd [data-pt2]:checked').map(function (i) { return i.getAttribute('data-pt2'); }) };
  if (p.novo) p.nome = $('#pf-nome').value.trim();
  p.desc = $('#pf-desc').value.trim();
}
function atualizarEditorPerfil() {
  lerEditorPerfil();
  const n = normPerf(S.acSel); S.acSel.perms = n.perms; S.acSel.telas = n.telas;
  const nome = $('#pf-nome') ? $('#pf-nome').value : S.acSel.nome, desc = $('#pf-desc') ? $('#pf-desc').value : S.acSel.desc;
  const top = window.scrollY; drawEditorPerfil(); window.scrollTo(0, top);
  if ($('#pf-nome') && S.acSel.novo) $('#pf-nome').value = nome; if ($('#pf-desc')) $('#pf-desc').value = desc;
}
async function salvarPerfilUI() {
  if (S.busy) return;
  lerEditorPerfil();
  const p = S.acSel, e = {};
  $$('#pfEd [data-pe]').forEach(function (s) { s.textContent = ''; });
  if (!p.nome) e.nome = 'Campo obrigatório.'; else if (p.nome.length < 2) e.nome = 'Use de 2 a 40 letras, números, espaço ou hífen.';
  const n = normPerf(p);
  if (!n.telas.length) e.telas = 'Selecione ao menos uma tela.';
  if (Object.keys(e).length) { Object.keys(e).forEach(function (k) { $('#pfEd [data-pe="' + k + '"]').textContent = e[k]; }); toast('Corrija os campos destacados.', true); return; }
  S.busy = true; const b = $('#pfSalvar'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    const r = await rpc('salvarPerfil', { nome: p.nome, desc: p.desc, perms: n.perms, telas: n.telas, escopo: p.escopo }, !!p.novo);
    if (!r.ok) {
      if (r.erros) Object.keys(r.erros).forEach(function (k) { const s = $('#pfEd [data-pe="' + k + '"]'); if (s) s.textContent = r.erros[k]; });
      toast(r.msg || 'O servidor recusou o perfil. Veja os destaques.', true); b.disabled = false; b.textContent = p.novo ? 'Criar perfil' : 'Salvar perfil'; return;
    }
    S.ac = await rpc('listarAcessos'); if (naAba('perfis')) { S.acSel = null; drawPerfis(); } toast('Perfil salvo');
  } catch (x) { b.disabled = false; b.textContent = p.novo ? 'Criar perfil' : 'Salvar perfil'; } finally { S.busy = false; }
}
async function excluirPerfilUI() {
  if (S.busy) return;
  const p = S.acSel; if (!p || p.novo) return;
  modal('<div class="mhd"><h2 id="modalT">Excluir perfil</h2></div><p>Excluir o perfil <b>' + esc(p.nome) + '</b>? Só é possível se nenhum usuário o estiver usando.</p><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn pri" id="px-ok">Excluir</button></div>');
  $('#px-ok').onclick = async function () {
    $('#px-ok').disabled = true; S.busy = true;
    try {
      const r = await rpc('excluirPerfil', p.nome);
      fecharModal();
      if (!r.ok) { toast(r.msg, true); return; }
      S.ac = await rpc('listarAcessos'); if (naAba('perfis')) { S.acSel = null; drawPerfis(); } toast('Perfil excluído');
    } catch (e) { fecharModal(); } finally { S.busy = false; }
  };
}
function drawLog() {
  const rows = (S.ac.log || []).map(function (l) {
    return '<tr><td>' + esc(fmtDt(String(l.Timestamp))) + '</td><td>' + esc(l.Responsavel) + '</td><td>' + esc(l.Acao) + '</td><td>' + esc(l.Alvo) + '</td><td>' + esc(l.Detalhe) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">Nenhuma alteração registrada.</td></tr>';
  $('#acBody').innerHTML = '<div class="card"><div class="hd"><b>Quem alterou o quê, e quando</b><span class="muted">Últimas 200 alterações de usuários e perfis</span></div><div class="toolbar"><input type="search" data-busca placeholder="Buscar no histórico…" aria-label="Buscar"></div><div class="scroll"><table data-sort><thead><tr><th data-s="t">Quando</th><th data-s="t">Quem</th><th data-s="t">Ação</th><th data-s="t">Alvo</th><th>Detalhe</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  tabelaInterativa($('#acBody'));
}
function drawSeg() {
  const it = (S.ac.seguranca || []).map(function (i) {
    return '<div class="sec-i ' + i.nivel + '">' + ic(i.nivel === 'ok' ? 'shield' : i.nivel === 'alerta' ? 'alert' : 'info', 18) + '<span>' + esc(i.txt) + '</span></div>';
  }).join('') || '<div class="muted">Sem verificações disponíveis.</div>';
  $('#acBody').innerHTML = '<div class="card"><div class="hd"><b>Verificações de segurança</b></div>' + it + '</div>';
}
document.addEventListener('click', function (e) {
  const t = e.target; if (!t.closest || !t.closest('#v-acessos')) return;
  const q = function (s) { return t.closest(s); };
  let x;
  if ((x = q('[data-at]'))) { S.acSol = null; S.acTab = x.dataset.at; S.acSel = null; S.acEdit = null; S.acDel = -1; renderAcessos(); }
  else if ((x = q('[data-ue]'))) { S.acSol = null; S.acEdit = S.ac.usuarios[Number(x.dataset.ue)]; S.acDel = -1; drawUsuarios(); window.scrollTo(0, 0); }
  else if ((x = q('[data-ux]'))) excluirUsuarioUI(Number(x.dataset.ux));
  else if (q('#uSalvar')) salvarUsuarioUI();
  else if (q('#uCancel')) { if (S.acSol) { S.acSol = null; nav('autorizar'); return; } S.acEdit = null; drawUsuarios(); }
  else if ((x = q('[data-pf]'))) { const p = S.ac.perfis.find(function (f) { return f.nome === x.dataset.pf; }); S.acSel = JSON.parse(JSON.stringify(p)); drawPerfis(); const ed = $('#pfEd'); if (ed && ed.scrollIntoView) ed.scrollIntoView({ block: 'start' }); }
  else if (q('#pfNovo')) { S.acSel = novoPerfilVazio(); drawPerfis(); }
  else if (q('#pfSalvar')) salvarPerfilUI();
  else if (q('#pfExcluir')) excluirPerfilUI();
});
document.addEventListener('change', function (e) {
  const t = e.target; if (!t.closest || !t.closest('#pfEd') || !S.acSel) return;
  if (t.matches('[data-pp],[data-pt],[data-pm],[data-pp2],[data-pt2]')) atualizarEditorPerfil();
});
