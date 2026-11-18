/* ---------- relatório por e-mail (v7): destinatários, frequência, idioma e envio ---------- */
const FREQ_TXT = { Diario: 'Diário', Semanal: 'Semanal', Mensal: 'Mensal' };
const IDIOMA_TXT = { pt: 'Português', en: 'English', es: 'Español' };
const MOTIVO_ENVIO = { sem_acesso: 'usuário inativo ou sem acesso', sem_tela: 'perfil sem acesso à Visão Geral', cota: 'cota diária de e-mails esgotada', erro: 'falha no envio' };
async function carregarEmailRel() {
  const el = $('#emailRel'); if (!el) return;
  el.innerHTML = '<div class="card" style="max-width:760px">' + skel(3) + '</div>';
  try { S.er = await rpc('listarEmailRel'); } catch (e) { el.innerHTML = '<div class="card" style="max-width:760px">Não foi possível carregar o envio de relatórios. Tente atualizar.</div>'; return; }
  desenharEmailRel();
}
function desenharEmailRel() {
  const el = $('#emailRel'); if (!el || !S.er) return;
  const d = S.er, opt = function (m, v) { return Object.keys(m).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(m[k]) + '</option>'; }).join(''); };
  const linhas = d.linhas.map(function (l) {
    return '<tr data-em="' + esc(l.email) + '"><td>' + esc(l.nome || l.email) + '<br><small class="muted">' + esc(l.email) + (l.perfil ? ' · ' + esc(l.perfil) : '') + '</small>' + (l.elegivel ? '' : '<br><small class="it-no">Sem acesso à Visão Geral ou inativo: não receberá</small>') + '</td>' +
      '<td><select data-ef="freq" aria-label="Frequência">' + opt(FREQ_TXT, l.freq) + '</select></td><td><select data-ef="idioma" aria-label="Idioma">' + opt(IDIOMA_TXT, l.idioma) + '</select></td>' +
      '<td><label class="perm" style="padding:0"><input type="checkbox" data-ef="ativo"' + (l.ativo ? ' checked' : '') + '><span>Ativo</span></label></td><td class="muted">' + (l.ultimo ? fmtDt(l.ultimo) : '—') + '</td>' +
      '<td class="acoes"><button type="button" class="btn sm" data-eagora="' + esc(l.email) + '">' + ic('mail', 14) + 'Enviar agora</button> <button type="button" class="btn sm bad" data-ex="' + esc(l.email) + '">' + ic('trash', 14) + 'Remover</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">Nenhum destinatário. Adicione quem deve receber o relatório.</td></tr>';
  el.innerHTML = '<div class="card" style="max-width:980px"><div class="hd"><div><b>Relatório por e-mail</b><br><small class="muted">Cada pessoa recebe somente o que o próprio perfil autoriza (um líder vê só o time dele; o Site Leader vê tudo). O e-mail traz as notas, a situação das auditorias, os itens críticos e os principais ofensores.</small></div>' +
    '<div><button type="button" class="btn' + (d.agendado ? '' : ' pri') + '" id="erAgenda">' + (d.agendado ? 'Desligar envio agendado' : 'Ligar envio agendado') + '</button> <button type="button" class="btn" id="erTodos">' + ic('mail', 14) + 'Enviar agora para todos</button></div></div>' +
    '<p class="muted" style="margin:6px 0 10px">' + '<span>' + (d.agendado ? 'Envio agendado ligado: todo dia às 7h, cada pessoa recebe conforme a frequência escolhida (diário: o dia anterior; semanal: segunda-feira, últimos 7 dias; mensal: dia 1, últimos 30 dias).' : 'Envio agendado desligado: os relatórios só saem quando você clicar em "Enviar agora".') + '</span>' + (d.cota != null ? ' <span>' + esc(tpl('Cota diária de e-mails restante: {0}.', [d.cota])) + '</span>' : '') + '</p>' +
    '<div class="scroll"><table><thead><tr><th>Destinatário</th><th>Frequência</th><th>Idioma</th><th></th><th>Último envio</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '<div class="sect">Adicionar destinatário</div><div class="grid" style="align-items:end"><label>Pessoa<select id="erPessoa"><option value="">Selecione…</option>' + d.candidatos.map(function (c) { return '<option value="' + esc(c.email) + '">' + esc(c.nome + ' · ' + c.perfil) + '</option>'; }).join('') + '</select></label>' +
    '<label>Frequência<select id="erFreq">' + opt(FREQ_TXT, 'Semanal') + '</select></label><label>Idioma<select id="erIdioma">' + opt(IDIOMA_TXT, idiomaAtual()) + '</select></label>' +
    '<div><button type="button" class="btn pri" id="erAdd">' + ic('plus', 14) + 'Adicionar</button></div></div>' +
    (d.candidatos.length ? '' : '<p class="muted">Todas as pessoas com acesso à Visão Geral já estão na lista.</p>') + '</div>';
}
function erResumo(r) {
  if (!r.ok) { toast(r.msg || 'Não foi possível enviar.', true); return; }
  const f = (r.falhas || []).map(function (x) { return x.email + ' (' + tr(MOTIVO_ENVIO[x.motivo] || 'falha no envio') + ')'; });
  toast(tpl('Relatórios enviados: {0}.', [r.enviados]) + (f.length ? ' ' + tpl('Não enviados: {0}.', [f.join('; ')]) : ''), f.length > 0);
  if (r.dados) { S.er = r.dados; desenharEmailRel(); }
}
async function erAcao(fn, ...args) {
  try { const r = await rpc(fn, ...args); if (r && r.ok === false) { toast(r.msg || 'O servidor recusou a ação.', true); return null; } return r; } catch (e) { return null; }
}
document.addEventListener('click', async function (e) {
  const t = e.target; if (!t.closest || !t.closest('#emailRel')) return;
  const b = t.closest('button'); if (!b || b.disabled) return;
  const rotulo0 = b.innerHTML; b.disabled = true;
  try {
    if (b.id === 'erAdd') {
      const p = $('#erPessoa').value; if (!p) { toast('Selecione a pessoa que vai receber o relatório.', true); return; }
      const r = await erAcao('salvarEmailRel', { email: p, freq: $('#erFreq').value, idioma: $('#erIdioma').value, ativo: true });
      if (r) { S.er = r; desenharEmailRel(); toast('Destinatário adicionado'); }
    } else if (b.id === 'erAgenda') {
      const r = await erAcao('alternarAgendamentoRel', !S.er.agendado); if (r) { S.er = r; desenharEmailRel(); toast(r.agendado ? 'Envio agendado ligado' : 'Envio agendado desligado'); }
    } else if (b.id === 'erTodos') { b.textContent = tr('Enviando…'); erResumo(await rpc('enviarRelatorioAgora', '')); }
    else if (b.dataset.eagora) { b.textContent = tr('Enviando…'); erResumo(await rpc('enviarRelatorioAgora', b.dataset.eagora)); }
    else if (b.dataset.ex) { const r = await erAcao('excluirEmailRel', b.dataset.ex); if (r) { S.er = r; desenharEmailRel(); toast('Destinatário removido'); } }
  } catch (x) { /* aviso exibido pelo rpc */ } finally { b.disabled = false; if (b.isConnected) b.innerHTML = rotulo0; } // falhou ou nada foi redesenhado: devolve o rótulo original
});
let erSeq = 0;
document.addEventListener('change', async function (e) {
  const t = e.target; if (!t.dataset || !t.dataset.ef || !t.closest('#emailRel')) return;
  const tr0 = t.closest('tr[data-em]'), l = S.er.linhas.find(function (x) { return x.email === tr0.dataset.em; }); if (!l) return;
  // o valor vem da linha na tela (não do último retorno do servidor), para duas alterações seguidas não reverterem uma à outra
  const campo = function (n) { return tr0.querySelector('[data-ef="' + n + '"]'); };
  const o = { email: l.email, freq: campo('freq').value, idioma: campo('idioma').value, ativo: campo('ativo').checked };
  const meu = ++erSeq, r = await erAcao('salvarEmailRel', o);
  if (meu !== erSeq) return; // chegou uma alteração mais nova: só a última resposta vale
  if (r) { S.er = r; toast('Alteração salva'); } desenharEmailRel();
});
