/* ============================================================
   Feedback obrigatório: gatilho, designação, registro e prova encadeada.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ============================================================
   Fase 3: feedback obrigatório (Feedback_Pendencias e Feedback_Registros).
   Gatilho: N ou mais auditorias abaixo da nota média nos últimos 30 dias, cada auditoria contando uma única vez (cobertura).
   N vem de FEEDBACK_MIN_AUDITORIAS nas Configurações (padrão FB_MIN); vale para as pendências geradas depois da mudança.
   O Site Leader (ou o Admin) designa quem dá o feedback; a pessoa designada registra o texto (mínimo de 50 caracteres).
   A prova é a aba Feedback_Registros: só de acréscimo, com hash encadeado, e-mail vindo da sessão e quem designou.
   ============================================================ */
const FB_MIN = 3;
const FB_JANELA = 30;
const FB_PRAZO_DIAS = 7;
const FB_TEXTO_MIN = 50;
const FB_TEXTO_MAX = 2000;
const FB_ORCAMENTO_MS = 200000;
const MAIL_FB = {
  pt: { assunto: 'Feedback obrigatório designado a você - Process Check', titulo: 'Você tem um feedback obrigatório', ola: 'Olá, ', corpo: 'Você foi designado(a) para dar um feedback obrigatório a um colaborador, com prazo até {d}. Abra Meus feedbacks para ver os detalhes e registrar.', botao: 'Abrir Meus feedbacks', rodape: 'Mensagem automática. Não é necessário responder.' },
  en: { assunto: 'Mandatory feedback assigned to you - Process Check', titulo: 'You have a mandatory feedback', ola: 'Hello, ', corpo: 'You were assigned to give mandatory feedback to an employee by {d}. Open My feedbacks to see the details and record it.', botao: 'Open My feedbacks', rodape: 'Automatic message. No reply is needed.' },
  es: { assunto: 'Feedback obligatorio asignado a usted - Process Check', titulo: 'Tiene un feedback obligatorio', ola: 'Hola, ', corpo: 'Usted fue designado(a) para dar un feedback obligatorio a un colaborador, con plazo hasta {d}. Abra Mis feedbacks para ver los detalles y registrarlo.', botao: 'Abrir Mis feedbacks', rodape: 'Mensaje automático. No es necesario responder.' }
};

const FB_MIN_MAX = 50;
function fbMinValido_(n) { return typeof n === 'number' && Math.floor(n) === n && n >= 1 && n <= FB_MIN_MAX; }
/** Quantidade de auditorias ruins que gera o feedback. Valor inválido na planilha volta ao padrão: nunca 0, que geraria para todos. */
function fbMinimo_(cfg) { const n = Number(cfg && cfg.FEEDBACK_MIN_AUDITORIAS); return fbMinValido_(n) ? n : FB_MIN; }

function normalizarTextoFb_(t) {
  return String(t == null ? '' : t).normalize('NFKC').replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '').replace(/\s+/g, ' ').trim();
}
/** Piso de qualidade: tamanho, palavras, variedade e não repetir uma palavra. A qualidade de verdade é de revisão humana. Devolve '' se válido. */
function validarTextoFb_(txt) {
  if (txt.length < FB_TEXTO_MIN) return 'O feedback precisa ter pelo menos 50 caracteres.';
  if (txt.length > FB_TEXTO_MAX) return 'O feedback pode ter no máximo 2000 caracteres.';
  if (/^[=+\-@]/.test(txt)) return 'O texto não pode começar com = + - @.';
  const pal = txt.toLowerCase().split(' '), cont = {};
  let maior = 0;
  pal.forEach(function (w) { cont[w] = (cont[w] || 0) + 1; if (cont[w] > maior) maior = cont[w]; });
  const distintos = {}; txt.toLowerCase().replace(/\s/g, '').split('').forEach(function (c) { distintos[c] = 1; });
  if (pal.length < 8 || Object.keys(distintos).length < 12 || maior / pal.length > 0.4) return 'Descreva o que foi conversado com o colaborador, com pelo menos 8 palavras, sem repetir sempre as mesmas.';
  return '';
}
function hashRegistroFb_(prev, l) { return sha_(String(prev) + '|' + JSON.stringify([l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], l[8], l[10], sha_(String(l[9]))])); }
/** Âncora fora da planilha (quantidade e último hash): apagar as últimas linhas ou reescrever a cadeia deixa de passar despercebido. */
function ancoraFb_(novo) {
  const pr = PropertiesService.getScriptProperties();
  if (novo === undefined) { const v = String(pr.getProperty('fbAncora') || '').split(':'); return v.length === 2 && Number(v[0]) > 0 ? { n: Number(v[0]), h: v[1] } : null; }
  if (novo === null) pr.deleteProperty('fbAncora'); else pr.setProperty('fbAncora', novo.n + ':' + novo.h);
}
/** A cadeia inteira (todos os Hubs): cada linha aponta para a anterior e a âncora confere o fim. Devolve a primeira linha adulterada, ou 0. */
function verificarCadeiaFb_() {
  const rs = lerBruto_('Feedback_Registros'), anc = ancoraFb_();
  let prev = '';
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i], l = [r.ID_Reg, r.ID_Pend, r.Colaborador, r.Time_Snap, r.Turno_Snap, r.Autor_Email, r.Autor_Nome, r.Designado_Por, r.Designado_Em, r.Texto, r.Registrado_Em];
    if (String(r.Hash_Anterior) !== prev || String(r.Hash) !== hashRegistroFb_(prev, l)) return { total: rs.length, falha: r._row };
    prev = String(r.Hash);
  }
  if (anc && (rs.length < anc.n || String(rs[anc.n - 1].Hash) !== anc.h)) return { total: rs.length, falha: anc.n + 1 };
  return { total: rs.length, falha: 0 };
}
function verificarProvaFeedback() {
  const a = exigirObrig_(), v = verificarCadeiaFb_(), r = { ok: v.falha === 0 };
  if (!a.hubOn || a.hubGlobal) { r.total = v.total; r.linhaAdulterada = v.falha; } // a cadeia é de todos os Hubs: o detalhe só vai para quem vê todos
  return r;
}

/* ---- gatilho ---- */
/** Candidatos por colaborador ativo: auditorias abaixo da nota média nos últimos 30 dias. Leitura pesada, feita FORA do lock. */
function candidatosFb_(corte) {
  const hoje = hoje_(), de = addDias_(hoje, -(FB_JANELA - 1)), ativos = {}, por = {};
  lerDireto_('Cad_Pessoas').forEach(function (p) { if (p.Cargo === 'Colaborador' && ativo_(p)) ativos[String(p.Nome)] = 1; });
  const rows = lerHist_(de, hoje, false), colabs = lerColabs_(de, hoje);
  rows.forEach(function (r) {
    if (!(r.pct < corte)) return;
    (colabs[r.id] || (r.colab ? [{ n: r.colab, l: r.lider, t: r.turno }] : [])).forEach(function (c) {
      if (ativos[c.n]) (por[c.n] = por[c.n] || []).push({ id: r.id, d: r.ts.slice(0, 10), l: c.l, t: c.t });
    });
  });
  return por;
}
/** Cria as pendências do Hub atual. Idempotente: auditoria já coberta por qualquer pendência nunca conta de novo. Devolve quantas criou. */
function gerarPendenciasFeedback_() {
  const cfg = config_(), corte = Number(cfg.NOTA_MEDIA_PCT), minimo = fbMinimo_(cfg);
  if (!isFinite(corte) || corte <= 0 || corte > 100) throw new Error('Nota média inválida na configuração: o feedback obrigatório não foi gerado.');
  const cand = candidatosFb_(corte);
  return comLock_(function () {
    const pend = lerDireto_('Feedback_Pendencias'), cobertas = {}, abertas = {}, novas = [];
    pend.forEach(function (p) { String(p.IDs_Auditorias).split('|').forEach(function (id) { if (id) cobertas[id] = 1; }); if (String(p.Status) !== 'Concluida') abertas[String(p.Colaborador)] = 1; });
    Object.keys(cand).forEach(function (nome) {
      if (abertas[nome]) return;
      const l = cand[nome].filter(function (x) { return !cobertas[x.id]; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      if (l.length < minimo) return;
      const ult = l[l.length - 1], ids = l.map(function (x) { return x.id; });
      novas.push(['FBK-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000) + '-' + novas.length, limpar_(nome + '|' + ids[0] + '|' + ids[ids.length - 1]), limpar_(nome), limpar_(ult.l), limpar_(ult.t), l[0].d, ult.d, l.length, ids.join('|'), corte, agora_(), 'Aberta', '', '', '', '', '', '', '']);
    });
    if (novas.length) { anexarLinhas_('Feedback_Pendencias', novas); limparCache_(); regSeguro_({ nome: 'Sistema', email: 'sistema', perfil: 'Sistema', hub: hubAtual_() }, 'Feedback obrigatório gerado', novas.length + ' colaborador(es)', 'Nota de corte ' + corte); }
    return novas.length;
  });
}
/** Feedback imediato: uma pendência por colaborador da auditoria que teve item marcado não conforme. Idempotente pela Chave (IMED|auditoria|colaborador).
    A auditoria entra em IDs_Auditorias: o gatilho normal a considera coberta e não a conta de novo. */
const FB_IMED = 'IMED|';
function gerarFbImediato_(idAud, colabs, corte) {
  const dia = hoje_();
  return comLock_(function () {
    // só a coluna Chave (a trava fica presa o mínimo); a Chave leva o id da auditoria, então não cruza Hubs
    const s = aba_('Feedback_Pendencias'), n = s ? s.getLastRow() - 1 : 0, ja = {};
    if (n > 0) s.getRange(2, 2, n, 1).getValues().forEach(function (r) { ja[String(r[0])] = 1; });
    const novas = [];
    colabs.forEach(function (c) {
      const chave = limpar_(FB_IMED + idAud + '|' + c.n);
      if (!c.n || ja[chave]) return; ja[chave] = 1;
      novas.push(['FBK-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000) + '-' + novas.length, chave, limpar_(c.n), limpar_(c.l), limpar_(c.t), dia, dia, 1, idAud, corte, agora_(), 'Aberta', '', '', '', '', '', '', '']);
    });
    // pendências não ficam no cache de abas: basta trocar a versão (contadores e relatórios em cache)
    if (novas.length) { anexarLinhas_('Feedback_Pendencias', novas); bumpHv_(); regSeguro_({ nome: 'Sistema', email: 'sistema', perfil: 'Sistema', hub: hubAtual_() }, 'Feedback imediato gerado', novas.length + ' colaborador(es)', idAud); }
    return novas.length;
  });
}
/** Motivo do feedback imediato: as perguntas marcadas que ficaram não conformes, com o texto da época. */
function motivosImed_(auds) {
  const out = [];
  (auds || []).forEach(function (x) { (x.nc || []).forEach(function (i) { if (i.imed) out.push({ desc: i.desc, desc_en: i.desc_en, desc_es: i.desc_es }); }); });
  return out;
}
/** Cópia da auditoria sem a etiqueta "imed" nos itens (nc/conf ilegíveis continuam null). */
function semImed_(x) {
  const tira = function (l) { return l ? l.map(function (i) { const c = Object.assign({}, i); delete c.imed; return c; }) : l; };
  return Object.assign({}, x, { nc: tira(x.nc), conf: tira(x.conf) });
}
/** Passo das 22h: roda o gatilho em cada Hub ativo (ou uma vez, com Hubs desligados). Restaura o contexto ao final. */
function gerarFeedbackTodosHubs_(prazo) {
  const antes = HUB_CTX, ini = Date.now(), limite = Math.min(ini + FB_ORCAMENTO_MS, prazo || Infinity); let n = 0; // o prazo do passo noturno vale também aqui
  const um = function (ctx) { HUB_CTX = ctx; try { n += gerarPendenciasFeedback_(); } catch (e) { falhaLog_('gatilho de feedback (Hub ' + (ctx.hub || '-') + ')', e); } };
  try {
    if (hubsLigado_()) {
      const hubs = lerBruto_('Cad_Hubs').filter(hubAtivoHub_), off = hubs.length ? Math.floor(Date.now() / 864e5) % hubs.length : 0; // rodízio diário: um Hub lento não deixa os últimos sem gerar
      for (let i = 0; i < hubs.length; i++) { if (Date.now() > limite) { falhaLog_('gatilho de feedback', new Error('Tempo esgotado; os Hubs restantes ficam para a próxima execução.')); break; } um({ on: true, hub: String(hubs[(i + off) % hubs.length].ID_Hub), global: false }); }
    } else um({ on: false, hub: '', global: false });
  } finally { HUB_CTX = antes; }
  return n;
}

/* ---- leitura ---- */
function pendOut_(p, hoje, pessoas) {
  const atual = pessoas[String(p.Colaborador)] || null, prazo = String(p.Prazo || '');
  return { id: String(p.ID_Pend), colaborador: String(p.Colaborador), timeEpoca: String(p.Time_Snap), turnoEpoca: String(p.Turno_Snap), timeAtual: atual ? String(atual.Lider) : '', turnoAtual: atual ? String(atual.Turno) : '',
    ini: String(p.Janela_Ini), fim: String(p.Janela_Fim), qtd: Number(p.Qtd), corte: Number(p.Nota_Corte), status: String(p.Status), geradaEm: String(p.Gerada_Em),
    designadoEmail: emailDe_(p.Designado_Email), designadoNome: String(p.Designado_Nome || ''), designadoPor: String(p.Designado_Por || ''), designadoEm: String(p.Designado_Em || ''),
    prazo: prazo, atrasado: String(p.Status) === 'Designada' && prazo !== '' && prazo < hoje, visto: String(p.Visto_Em || '') !== '', avisoPendente: String(p.Status) === 'Designada' && avisoPendente_(p.Aviso_Em),
    imediato: String(p.Chave || '').indexOf(FB_IMED) === 0 };
}
/** Itens avaliados de uma auditoria, do JSON gravado na época (descrição de então). N/A fica de fora. Ilegível: null, sem quebrar a tela.
    Não usa itensAuditoria_ (Relatorios): aquela aplica o escopo de quem consulta, e quem dá o feedback pode não ter o time no escopo. */
function itensFb_(s, row, trad) {
  let det;
  try { det = JSON.parse(s.getRange(row, 12).getValue()); } catch (e) { return null; }
  if (!Array.isArray(det)) return null;
  const item = function (d) { const desc = String(d.desc == null ? d.id : d.desc), t = trad[d.id + '|' + d.desc] || {}; return { desc: desc, desc_en: t.en || '', desc_es: t.es || '', critico: d.critico === true, imed: d.imed === true }; };
  return { nc: det.filter(function (d) { return d && d.ok === false; }).map(item), conf: det.filter(function (d) { return d && d.ok === true; }).map(item) };
}
/** comItens: lê o detalhe de cada auditoria pedida (uma célula por auditoria, só as das pendências). */
function auditoriasDasPend_(pends, comAuditor, comItens) {
  const out = {};
  if (!pends.length) return out;
  const de = pends.reduce(function (x, p) { return p.ini < x ? p.ini : x; }, pends[0].ini), ate = pends.reduce(function (x, p) { return p.fim > x ? p.fim : x; }, pends[0].fim);
  // comItens: true (todas) ou { idPend: 1 } (só estas pendências leem o detalhe, uma célula por auditoria)
  const querItens = function (idPend) { return comItens === true || !!(comItens && comItens[idPend]); };
  const rows = lerHist_(de, ate, false), porId = {}, sh = comItens ? aba_('Auditorias_Historico') : null, trads = {}; rows.forEach(function (r) { porId[r.id] = r; });
  const trad = function (proc) { return trads[proc] || (trads[proc] = traducoesItens_(proc)); };
  pends.forEach(function (p) {
    out[p.id] = String(p.ids).split('|').filter(Boolean).map(function (id) {
      const r = porId[id]; if (!r) return null;
      const o = { data: r.ts.slice(0, 10), proc: r.proc, pct: r.pct };
      if (comAuditor) { o.aud = r.email; o.audNome = r.resp; }
      if (querItens(p.id)) { const it = itensFb_(sh, r._r, trad(r.proc)); o.nc = it ? it.nc : null; o.conf = it ? it.conf : null; }
      return o;
    }).filter(Boolean);
  });
  return out;
}
function designaveisFb_(a) {
  return usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).filter(function (u) { return usuarioAtivo_(u) && (!a.hubOn || String(u.Hub || '').trim() === a.hub); });
}
/** Textos já registrados, indexados por pendência (uma leitura só, e só das pendências pedidas). */
function registrosDe_(ids) {
  const m = {}; if (!ids.length) return m;
  const q = {}; ids.forEach(function (i) { q[i] = 1; });
  const sh = aba_('Feedback_Registros'), n = Math.max(0, sh.getLastRow() - 1);
  if (!n) return m;
  const col = sh.getRange(2, 2, n, 1).getValues();
  for (let i = 0; i < n; i++) { // lê só a coluna do ID e depois apenas as linhas pedidas (nunca a aba inteira com os textos)
    const id = String(col[i][0]); if (!q[id] || m[id]) continue;
    const x = sh.getRange(i + 2, 1, 1, 11).getValues()[0];
    m[id] = { texto: String(x[9]), registradoEm: tsStr_(x[10]), autor: String(x[6]), autorEmail: emailDe_(x[5]) };
  }
  return m;
}
function listarFeedbacks() { return medir_('listarFeedbacks', listarFeedbacksCore_, arguments); }
function listarFeedbacksCore_() {
  const a = exigirObrig_(), hoje = hoje_(), c = CacheService.getScriptCache(), kg = 'fbgen:' + (a.hub || '-');
  if (!c.get(kg)) { try { gerarPendenciasFeedback_(); } catch (e) { falhaLog_('gatilho de feedback', e); } c.put(kg, '1', 300); }
  const pessoas = {}; lerDireto_('Cad_Pessoas').forEach(function (p) { pessoas[String(p.Nome)] = p; });
  const lim = addDias_(hoje, -90);
  const brutas = lerDireto_('Feedback_Pendencias').filter(function (p) { return String(p.Status) !== 'Concluida' || String(p.Gerada_Em).slice(0, 10) >= lim; });
  // quem auditou é sigiloso: só recebe quem tem "ver_auditor" (o Admin tem por padrão e decide quais perfis também têm)
  const verAud = tem_(a, 'ver_auditor');
  // feedback imediato primeiro (a ordem é estável: o resto mantém a ordem da planilha)
  const ps = brutas.map(function (p) { const o = pendOut_(p, hoje, pessoas); o.ids = String(p.IDs_Auditorias); return o; }).sort(function (x, y) { return (y.imediato ? 1 : 0) - (x.imediato ? 1 : 0); });
  // o motivo vem do detalhe da auditoria: só as pendências imediatas leem esse detalhe
  const imeds = {}; ps.forEach(function (o) { if (o.imediato) imeds[o.id] = 1; });
  const aud = auditoriasDasPend_(ps, verAud, imeds), regs = registrosDe_(ps.filter(function (o) { return o.status === 'Concluida'; }).map(function (o) { return o.id; }));
  return { ok: true, hoje: hoje, prazoDias: FB_PRAZO_DIAS, minimo: fbMinimo_(config_()), janela: FB_JANELA,
    pendencias: ps.map(function (o) { delete o.ids; const l = aud[o.id] || []; o.auditores = l.map(function (x) { return x.aud; }).filter(function (x, i, v) { return x && v.indexOf(x) === i; }); o.auditorias = l.map(function (x) { const y = { data: x.data, proc: x.proc, pct: x.pct }; if (verAud) { y.aud = x.aud; y.audNome = x.audNome; } return y; }); o.motivos = o.imediato ? motivosImed_(l) : []; o.registro = regs[o.id] || null; return o; }),
    responsaveis: designaveisFb_(a).map(function (u) { return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil) }; }) };
}
function meusFeedbacks() { return medir_('meusFeedbacks', meusFeedbacksCore_, arguments); }
function meusFeedbacksCore_() {
  const a = exigirAcesso_(), hoje = hoje_(), lim = addDias_(hoje, -60), pessoas = {};
  lerDireto_('Cad_Pessoas').forEach(function (p) { pessoas[String(p.Nome)] = p; });
  const brutas = lerDireto_('Feedback_Pendencias').filter(function (p) { return emailDe_(p.Designado_Email) === a.email && (String(p.Status) === 'Designada' || (String(p.Status) === 'Concluida' && String(p.Designado_Em).slice(0, 10) >= lim)); });
  const ps = brutas.map(function (p) { const o = pendOut_(p, hoje, pessoas); o.ids = String(p.IDs_Auditorias); return o; }), aud = auditoriasDasPend_(ps, tem_(a, 'ver_auditor'), true), regs = registrosDe_(ps.filter(function (o) { return o.status === 'Concluida'; }).map(function (o) { return o.id; }));
  return ps.map(function (o) {
    // o motivo vai pronto; a etiqueta "imed" dos itens não sai (quem dá o feedback não descobre quais perguntas são marcadas)
    const l = aud[o.id] || [];
    delete o.ids; delete o.designadoEmail; o.motivos = o.imediato ? motivosImed_(l) : []; o.auditorias = l.map(semImed_); o.registro = regs[o.id] || null; return o;
  });
}
function marcarFeedbacksVistos() {
  const a = exigirAcesso_();
  return comLock_(function () {
    const s = aba_('Feedback_Pendencias'), novas = lerDireto_('Feedback_Pendencias').filter(function (p) { return emailDe_(p.Designado_Email) === a.email && String(p.Status) === 'Designada' && String(p.Visto_Em || '') === ''; });
    novas.forEach(function (p) { s.getRange(p._row, 18).setNumberFormat('@').setValue(agora_()); });
    if (novas.length) limparContadores_(a);
    return { ok: true, vistos: novas.length };
  });
}
/** Contadores do menu (um só cálculo por usuário, em cache por versão dos dados). */
function resumoFb_(a) {
  const c = CacheService.getScriptCache(), k = 'fb:' + hv_() + ':' + (a.hub || '') + ':' + a.email, v = c.get(k);
  if (v) return JSON.parse(v);
  const hoje = hoje_(), r = { fbMeus: 0, fbMeusNovos: 0, fbMeusAtrasados: 0, fbTotalMeus: 0, fbAtrasadosHub: 0, fbAbertasHub: 0 };
  const lim = addDias_(hoje, -60);
  lerDireto_('Feedback_Pendencias').forEach(function (p) {
    const meu = emailDe_(p.Designado_Email) === a.email, des = String(p.Status) === 'Designada', atras = des && String(p.Prazo) !== '' && String(p.Prazo) < hoje;
    if (meu && (des || (String(p.Status) === 'Concluida' && String(p.Designado_Em).slice(0, 10) >= lim))) r.fbTotalMeus++;
    if (meu && des) { r.fbMeus++; if (String(p.Visto_Em || '') === '') r.fbMeusNovos++; if (atras) r.fbMeusAtrasados++; }
    if (tem_(a, 'obrigacoes')) { if (atras) r.fbAtrasadosHub++; if (String(p.Status) === 'Aberta') r.fbAbertasHub++; }
  });
  try { c.put(k, JSON.stringify(r), CONTADOR_SEG); } catch (e) { /* sem cache */ }
  return r;
}
/** O login nunca pode falhar por causa dos contadores de feedback. */
function resumoFbSeguro_(a) { try { return resumoFb_(a); } catch (e) { falhaLog_('contadores de feedback', e); return { fbMeus: 0, fbMeusNovos: 0, fbMeusAtrasados: 0, fbTotalMeus: 0, fbAtrasadosHub: 0, fbAbertasHub: 0 }; } }
function contarFeedbacks() { return resumoFb_(exigirAcesso_()); }

/* ---- designar e registrar ---- */
function designarFeedback(id, email) {
  const a = exigirObrig_(), alvo = emailDe_(email);
  let linhaN = 0, nova = null;
  const r = comLock_(function () {
    const p = lerDireto_('Feedback_Pendencias').find(function (x) { return String(x.ID_Pend) === String(id); });
    if (!p || String(p.Status) === 'Concluida') return { ok: false, msg: 'Pendência não encontrada ou já concluída. Atualize a tela.' };
    const u = designaveisFb_(a).find(function (x) { return emailDe_(x.Email_Google) === alvo; });
    if (!u) return { ok: false, msg: 'Pessoa não encontrada ou inativa neste Hub.' };
    const s = aba_('Feedback_Pendencias'), antes = s.getRange(p._row, 12, 1, 8).getValues(), prazo = addDias_(hoje_(), FB_PRAZO_DIAS);
    s.getRange(p._row, 12, 1, 8).setNumberFormat('@').setValues([['Designada', alvo, limpar_(String(u.Nome)), limpar_(a.email), agora_(), prazo, '', '']]);
    try { registrar_(a, String(p.Status) === 'Designada' ? 'Feedback reatribuído' : 'Feedback designado', alvo, 'Pendência ' + p.ID_Pend + '; prazo ' + prazo); } catch (e) { falhaLog_('designar feedback', e); desfazer_(function () { s.getRange(p._row, 12, 1, 8).setValues(antes); }); throw new Error('Não foi possível registrar a designação no log; nada foi alterado. Tente de novo.'); }
    limparCache_(); linhaN = p._row; nova = { id: String(p.ID_Pend), prazo: prazo };
    return { ok: true };
  });
  if (!r.ok) return r;
  const env = avisarFeedback_(linhaN, nova.id, alvo, nova.prazo);
  try { return Object.assign(listarFeedbacks(), { ok: true, emailEnviado: env }); } catch (e) { falhaLog_('listar após designar', e); return { ok: true, emailEnviado: env, recarregar: true }; }
}
function registrarFeedback(id, texto) {
  const a = exigirAcesso_(), txt = normalizarTextoFb_(texto), erro = validarTextoFb_(txt);
  if (erro) return { ok: false, msg: erro };
  const r = comLock_(function () {
    const MSG = 'Feedback não encontrado ou não designado a você. Atualize a tela.';
    const p = lerDireto_('Feedback_Pendencias').find(function (x) { return String(x.ID_Pend) === String(id); });
    if (!p || String(p.Status) !== 'Designada' || emailDe_(p.Designado_Email) !== a.email) return { ok: false, msg: MSG };
    const sr = aba_('Feedback_Registros'), n = Math.max(0, sr.getLastRow() - 1);
    if (n && sr.getRange(2, 2, n, 1).getValues().some(function (x) { return String(x[0]) === String(p.ID_Pend); })) { aba_('Feedback_Pendencias').getRange(p._row, 12).setValue('Concluida'); limparCache_(); return { ok: false, msg: 'Este feedback já foi registrado.' }; }
    const ini = Math.max(2, n + 2 - 500), cnt = n + 2 - ini; // texto repetido: confere os últimos 500 registros (qualquer Hub)
    if (n && sr.getRange(ini, 6, cnt, 5).getValues().some(function (x) { return emailDe_(x[0]) === a.email && normalizarTextoFb_(x[4]) === txt; })) return { ok: false, msg: 'Este texto é igual a um feedback que você já registrou. Escreva o que foi conversado com este colaborador.' };
    const prev = n ? String(sr.getRange(n + 1, 13).getValue()) : '', ancAntes = ancoraFb_();
    const linha = ['FBR-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000), String(p.ID_Pend), String(p.Colaborador), String(p.Time_Snap), String(p.Turno_Snap), a.email, limpar_(a.nome), String(p.Designado_Por), String(p.Designado_Em), txt, agora_(), prev, ''];
    linha[12] = hashRegistroFb_(prev, linha);
    const s = aba_('Feedback_Pendencias');
    // cada passo com o seu desfazer, registrado antes de gravar e executado uma vez só (repetir um deleteRow apagaria outra linha)
    gravarComDesfazer_(a, 'registrar feedback', function (desfaz) {
      anexarDesfazivel_(desfaz, 'Feedback_Registros', linha);
      desfaz(function () { s.getRange(p._row, 12).setValue('Designada'); });
      s.getRange(p._row, 12).setValue('Concluida');
      desfaz(function () { ancoraFb_(ancAntes); });
      ancoraFb_({ n: n + 1, h: linha[12] });
      registrar_(a, 'Feedback registrado', String(p.Colaborador), 'Pendência ' + p.ID_Pend + '; prova ' + linha[12].slice(0, 16));
    });
    limparCache_();
    return { ok: true };
  });
  if (!r.ok) return r;
  try { return { ok: true, feedbacks: meusFeedbacks() }; } catch (e) { falhaLog_('listar após registrar', e); return { ok: true, recarregar: true }; }
}

/* ---- e-mail do feedback (sem nome do colaborador, nota ou texto livre) ---- */
function avisarFeedback_(row, id, email, prazo) {
  return avisarComReserva_('aviso de feedback', 'Feedback_Pendencias', row, id, 12, 'Designada', 19, email, function () {
    const sol = lerAba_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === email; }).pop(), m = MAIL_FB[idiomaOk_(sol && sol.Idioma)];
    enviarAviso_(email, m, m.corpo.replace('{d}', dataBr_(prazo)));
  });
}
function reenviarAvisosFeedback_(prazo) {
  const agora = Date.now();
  const pend = lerBruto_('Feedback_Pendencias').filter(function (r) { return String(r.Status) === 'Designada' && avisoAReenviar_(r.Aviso_Em, agora); });
  return reenviarFila_('reenvio de avisos de feedback', 'Feedback_Pendencias', 19, pend, function (r) { return emailDe_(r.Designado_Email); },
    function (r, email) { return avisarFeedback_(r._row, String(r.ID_Pend), email, String(r.Prazo)); }, prazo || Infinity);
}
