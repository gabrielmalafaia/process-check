/* ---------- regras de auditoria por líder (v9) ---------- */
const lst = function (a) { return a.join(', '); };
function regraResumo(r) {
  const p = [];
  p.push(r.proprio && r.outros ? tr('Audita o próprio time e outros times') : r.proprio ? tr('Audita só o próprio time') : r.outros ? tr('Audita só outros times') : tr('Não audita ninguém'));
  if (r.outros) p.push(r.times.length ? tpl(tr('Times de: {0}'), [lst(r.times)]) : tr('Qualquer time'));
  p.push(r.turnos.length ? tpl(tr('Turnos: {0}'), [lst(r.turnos)]) : tr('Todos os turnos'));
  p.push(r.cores.length ? tpl(tr('Cores e símbolos: {0}'), [lst(r.cores)]) : tr('Todas as cores e símbolos'));
  p.push(r.processos.length ? tpl(tr('Processos: {0}'), [lst(r.processos)]) : tr('Todos os processos'));
  p.push(r.verProprio ? tr('Vê os resultados do próprio time') : tr('Não vê os resultados do próprio time'));
  p.push(r.verOutros === 'time' ? tr('Vê o histórico dos times que pode auditar') : tr('Vê só as auditorias que fez em outros times'));
  return p.join('. ') + '.';
}
const regraCopia = function (r) { return { proprio: r.proprio, outros: r.outros, times: r.times.slice(), turnos: r.turnos.slice(), cores: r.cores.slice(), processos: r.processos.slice(), verProprio: r.verProprio, verOutros: r.verOutros }; };
let rgSeq = 0;
async function drawRegras() {
  const el = $('#acBody'), n = ++rgSeq; el.innerHTML = '<div class="card">' + skel(4) + '</div>';
  try { const r = await rpc('listarRegrasLider'); if (n !== rgSeq) return; S.rg = r; } catch (e) { el.innerHTML = '<div class="card">' + esc(tr('Não foi possível carregar as regras.')) + '</div>'; return; }
  if (!naAba('regras')) return;
  S.rgEd = null; S.rgDel = false; desenharRegras();
}
function desenharRegras() {
  const R = S.rg, el = $('#acBody'), ed = S.rgEd ? R.lideres.find(function (l) { return l.email === S.rgEd; }) : null;
  const linhas = R.lideres.map(function (l) {
    const sit = !l.regra.existe ? tr('Padrão') : l.regra.ok ? tr('Exceção') : tr('Regra inválida');
    return '<tr><td>' + esc(l.nome) + '<br><small class="muted">' + esc(l.email) + '</small></td><td><span class="tag-t">' + esc(sit) + '</span></td><td>' + esc(regraResumo(l.regra)) + '</td>' +
      '<td><button type="button" class="btn sm" data-rg-ed="' + esc(l.email) + '" aria-label="' + esc(tpl(tr('Editar regra de {0}'), [l.nome])) + '">' + ic('pencil', 14) + esc(tr('Editar')) + '</button></td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">' + esc(tr('Nenhum líder com perfil de time neste Hub.')) + '</td></tr>';
  el.innerHTML = '<div class="card"><div class="hd"><b>' + esc(tr('Regras de auditoria por líder')) + '</b></div>' +
    '<p class="muted" style="margin:6px 0 10px">' + esc(tr('Defina, para cada líder, quem ele pode auditar e o que ele vê. Sem regra, o líder audita só o próprio time. Você não edita a própria regra.')) + '</p></div>' +
    (ed ? '<div id="rgEd"></div>' : '') +
    '<div class="card"><div class="scroll"><table><thead><tr><th>' + esc(tr('Líder')) + '</th><th>' + esc(tr('Situação')) + '</th><th>' + esc(tr('Regra')) + '</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div></div>';
  if (ed) desenharEditorRegra(ed);
}
function desenharEditorRegra(l) {
  const R = S.rg, f = S.rgForm; S.rgDel = false;
  const grupo = function (attr, itens, marc) {
    return '<div class="grid">' + itens.map(function (x) { return '<label class="perm"><input type="checkbox" ' + attr + '="' + esc(x) + '"' + (marc.indexOf(x) > -1 ? ' checked' : '') + '><span><b>' + esc(x) + '</b></span></label>'; }).join('') + '</div>';
  };
  $('#rgEd').innerHTML = '<div class="card"><div class="hd"><b>' + esc(tpl(tr('Regra de {0}'), [l.nome])) + '</b></div>' +
    '<div class="sect">' + esc(tr('Quem este líder pode auditar')) + '</div>' +
    '<div class="grid"><label class="perm"><input type="checkbox" data-rg="proprio"' + (f.proprio ? ' checked' : '') + '><span><b>' + esc(tr('O próprio time')) + '</b><small>' + esc(tr('Desmarque para evitar conflito de interesse.')) + '</small></span></label>' +
    '<label class="perm"><input type="checkbox" data-rg="outros"' + (f.outros ? ' checked' : '') + '><span><b>' + esc(tr('Outros times')) + '</b></span></label></div>' +
    (f.outros ? '<div class="sect">' + esc(tr('Quais times (nenhum marcado = todos)')) + '</div>' + grupo('data-rg-t', R.times, f.times) : '') +
    '<div class="sect">' + esc(tr('Turnos (nenhum marcado = todos)')) + '</div>' + grupo('data-rg-tu', R.turnos, f.turnos) +
    '<div class="sect">' + esc(tr('Cores e símbolos das docas e clusters (nenhum marcado = todos)')) + '</div>' + grupo('data-rg-c', R.cores, f.cores) +
    '<div class="sect">' + esc(tr('Processos (nenhum marcado = todos)')) + '</div>' + grupo('data-rg-p', R.processos, f.processos) +
    '<div class="sect">' + esc(tr('O que este líder vê nos relatórios')) + '</div>' +
    '<div class="grid"><label class="perm"><input type="checkbox" data-rg="verProprio"' + (f.verProprio ? ' checked' : '') + '><span><b>' + esc(tr('Resultados do próprio time')) + '</b></span></label></div>' +
    '<div class="grid"><label class="perm"><input type="radio" name="rgvo" data-rg-vo="proprias"' + (f.verOutros === 'proprias' ? ' checked' : '') + '><span><b>' + esc(tr('De outros times: só as auditorias que ele fez')) + '</b></span></label>' +
    '<label class="perm"><input type="radio" name="rgvo" data-rg-vo="time"' + (f.verOutros === 'time' ? ' checked' : '') + '><span><b>' + esc(tr('De outros times: o histórico dos times que pode auditar')) + '</b></span></label></div>' +
    '<div id="rgPrev" class="resumo" aria-live="polite"></div><div id="rgAv"></div>' +
    '<div style="margin-top:12px"><button type="button" class="btn pri" id="rgSalvar">' + esc(tr('Salvar regra')) + '</button> <button type="button" class="btn" id="rgCancel">' + esc(tr('Cancelar')) + '</button>' +
    (l.regra.existe ? ' <button type="button" class="btn bad" id="rgPadrao">' + esc(tr('Voltar ao padrão')) + '</button>' : '') + '</div></div>';
  prevRegra();
}
function prevRegra() {
  const f = S.rgForm, p = $('#rgPrev'), av = $('#rgAv'); if (!p) return;
  p.innerHTML = '<b>' + esc(tr('Resumo')) + '</b><p style="margin:4px 0 0">' + esc(regraResumo(f)) + '</p>';
  av.innerHTML = !f.proprio && !f.outros ? '<div role="alert">' + aviso(esc(tr('Com esta regra o líder não poderá auditar ninguém.'))) + '</div>' : '';
}
function lerRegraForm() {
  const f = S.rgForm, marc = function (a) { return $$('#rgEd [' + a + ']:checked').map(function (i) { return i.getAttribute(a); }); };
  $$('#rgEd [data-rg]').forEach(function (i) { f[i.dataset.rg] = i.checked; });
  if (f.outros) f.times = marc('data-rg-t'); else f.times = [];
  f.turnos = marc('data-rg-tu'); f.cores = marc('data-rg-c'); f.processos = marc('data-rg-p');
  const vo = $('#rgEd [data-rg-vo]:checked'); if (vo) f.verOutros = vo.dataset.rgVo;
}
async function salvarRegraUI() {
  if (S.busy || !S.rgEd) return;
  lerRegraForm(); S.busy = true; const b = $('#rgSalvar'); if (b) b.disabled = true;
  try {
    const r = await rpc('salvarRegraLider', Object.assign({ email: S.rgEd }, S.rgForm));
    if (!r.ok) { toast(r.msg || tr('O servidor recusou a regra.'), true); if (b) b.disabled = false; return; }
    S.rg = r.dados; S.rgEd = null; toast(tr('Regra salva')); if (naAba('regras')) desenharRegras();
  } catch (x) { if (b) b.disabled = false; } finally { S.busy = false; }
}
async function padraoRegraUI() {
  if (S.busy || !S.rgEd) return;
  if (!S.rgDel) { S.rgDel = true; $('#rgPadrao').textContent = tr('Confirmar volta ao padrão?'); setTimeout(function () { S.rgDel = false; const b = $('#rgPadrao'); if (b) b.textContent = tr('Voltar ao padrão'); }, 4000); return; }
  S.busy = true;
  try {
    const r = await rpc('excluirRegraLider', S.rgEd);
    if (!r.ok) { toast(r.msg || tr('O servidor recusou a regra.'), true); return; }
    S.rg = r.dados; S.rgEd = null; S.rgDel = false; toast(tr('Regra removida: o líder voltou ao padrão')); if (naAba('regras')) desenharRegras();
  } catch (x) { /* o aviso de erro já foi mostrado */ } finally { S.busy = false; }
}
function v9Eventos() {
  document.addEventListener('change', function (e) { if (naAba('regras') && S.rgEd && e.target && e.target.closest && e.target.closest('#rgEd')) { const antes = S.rgForm.outros; lerRegraForm(); if (antes !== S.rgForm.outros) desenharEditorRegra(S.rg.lideres.find(function (l) { return l.email === S.rgEd; })); else prevRegra(); } });
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest ? e.target.closest('button') : null; if (!t || !naAba('regras') || (S.busy && t.id !== 'rgSalvar')) return;
    if (t.dataset.rgEd !== undefined) { const l = S.rg.lideres.find(function (x) { return x.email === t.dataset.rgEd; }); if (l) { S.rgEd = l.email; S.rgForm = regraCopia(l.regra.ok ? l.regra : S.rg.padrao); S.rgDel = false; desenharRegras(); const c = $('#rgEd'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' }); } }
    else if (t.id === 'rgSalvar') salvarRegraUI();
    else if (t.id === 'rgCancel') { S.rgEd = null; desenharRegras(); }
    else if (t.id === 'rgPadrao') padraoRegraUI();
  });
}
