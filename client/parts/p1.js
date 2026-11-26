/*
Process Check - Auditoria de processos do hub
(c) 2026 Gabriel Malafaia (desenvolvimento) e Karina Ferreira (concepção dos processos e estrutura da auditoria).
Todos os direitos reservados. Versão 7.0
*/
const S = {
  u: null, cfg: {}, visual: { cores: [], simbolos: [] }, db: {}, tipos: {}, procs: [], turnos: ['T1', 'T2', 'T3'], auditores: [],
  v: '', mp: '', mx: {}, F: null, cad: '', edit: null, delIdx: -1, busy: false, ch: {}, d: {}, det: null, seqRel: 0, gopen: false, pag: 1, ac: null, acTab: '', perK: '30',
  flt: { de: '', ate: '', processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '', obs: '' }, fmais: false
};
const $ = function (s) { return document.querySelector(s); };
const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
const esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
const pad = function (n) { return String(n).padStart(2, '0'); };
const ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const vazio = function (v) { return v === undefined || v === null || String(v).trim() === ''; };
const igual = function (a, b) { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); };
const norm = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
const MAX_COLAB = 10;

/* ---------- ícones (SVG linear, desenhados aqui; sem biblioteca e sem emojis) ---------- */
const ICON = {
  'menu': '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'minus': '<path d="M5 12h14"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'refresh': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'layout-grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  'bar-chart': '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  'list': '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  'package': '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'calendar': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'pencil': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  'trash': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  'more': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  'palette': '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.48-9-10-9Z"/>',
  'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  'printer': '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'sliders': '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'
};
function ic(n, s, c) {
  const p = ICON[n]; if (!p) return '';
  return '<svg class="ic' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" width="' + (s || 16) + '" height="' + (s || 16) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>';
}
function icones(raiz) {
  Array.prototype.slice.call((raiz || document).querySelectorAll('[data-ico]')).forEach(function (el) {
    el.insertAdjacentHTML('afterbegin', ic(el.getAttribute('data-ico'), 18)); el.removeAttribute('data-ico');
  });
}

/* ---------- constantes de exibição ---------- */
const TIT = { matriz: 'Matriz de Processos', form: 'Formulário de Auditoria', minhas: 'Minhas metas', feedbacks: 'Meus feedbacks', programacao: 'Programação', geral: 'Visão Geral', auditorias: 'Auditorias realizadas', auditores: 'Auditores e metas', proc: 'Por processo', doca: 'Por doca e cluster', colab: 'Por colaborador e equipe', tend: 'Tendência', export: 'Exportar', cad: 'Cadastros', cfg: 'Configurações', acessos: 'Acessos', autorizar: 'Autorizações', log: 'Log de atividade' };
const NAV = [
  { sec: 'Operação', itens: [{ id: 'matriz', ic: 'layout-grid' }, { id: 'form', ic: 'clipboard-check' }, { id: 'minhas', ic: 'target' }, { id: 'feedbacks', ic: 'pencil' }] },
  { sec: 'Análise', itens: [{ id: 'rel', ic: 'bar-chart', t: 'Relatórios', kids: ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'] }] },
  { sec: 'Administração', itens: [{ id: 'programacao', ic: 'calendar' }, { id: 'cad', ic: 'database' }, { id: 'cfg', ic: 'settings' }, { id: 'acessos', ic: 'shield' }, { id: 'autorizar', ic: 'user-check' }, { id: 'log', ic: 'list' }] }
];
const NAV_ITENS = NAV.reduce(function (a, s) { return a.concat(s.itens); }, []);
const KID_IC = { geral: 'layout-dashboard', auditorias: 'list', auditores: 'users', proc: 'layers', doca: 'package', colab: 'user', tend: 'trending-up', export: 'download' };
const REL = ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'];
const TXT_FAIXA = { vermelho: 'Em Inconformidade', observacao: 'Em Observação', verde: 'Completo e em Conformidade' };
const TXT_FAIXA_C = { vermelho: 'Inconforme', observacao: 'Em observação', verde: 'Conforme' };
const COR = { verde: '#1E9E5A', observacao: '#F2B100', vermelho: '#D93025' };
const TXT_META = { no_ritmo: 'No ritmo', em_risco: 'Em risco', atingida: 'Atingida', nao_atingida: 'Não atingida', futura: 'Não iniciada', inativa: 'Inativa', cancelada: 'Cancelada' };
const LEIT = ['bootstrap', 'getMatriz', 'relatorio', 'minhasMetas', 'minhasMetasLider', 'listarMetasLider', 'listarFeedbacks', 'meusFeedbacks', 'contarFeedbacks', 'listarAcessos'];
const pode = function (p) { return !!S.u && S.u.perms.indexOf(p) > -1; };
const tela = function (t) { return !!S.u && S.u.telas.indexOf(t) > -1; };
/** Faixa da nota: abaixo do corte = vermelho; do corte até a média = observação (amarelo); média ou mais = verde. */
function faixa(pct) { return pct < S.cfg.NOTA_CORTE_PCT ? 'vermelho' : (pct < S.cfg.NOTA_MEDIA_PCT ? 'observacao' : 'verde'); }
const pc = function (n) { return n == null || n === '' ? '—' : String(n).replace('.', ',') + '%'; };
const fmtDt = function (t) { return t ? t.slice(8, 10) + '/' + t.slice(5, 7) + ' ' + t.slice(11, 16) : '—'; };
const fmtD = function (d) { return d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '—'; };
const pill = function (f, txt) { return '<span class="pill ' + (f || 'neutro') + '">' + esc(txt || TXT_FAIXA_C[f] || 'Sem dados') + '</span>'; };
const meter = function (v, f) { return '<div class="meter" title="' + esc(pc(v)) + '"><span class="' + (f || '') + '" style="width:' + Math.max(0, Math.min(100, Number(v) || 0)) + '%"></span></div>'; };
const stk = function (x) { const t = (x.v + x.o + x.r) || 1; return '<div class="stk" title="' + x.v + ' conforme, ' + x.o + ' em observação, ' + x.r + ' inconforme"><i class="v" style="width:' + x.v / t * 100 + '%"></i><i class="o" style="width:' + x.o / t * 100 + '%"></i><i class="r" style="width:' + x.r / t * 100 + '%"></i></div>'; };
/** Texto cadastrado com tradução opcional (EN/ES); sem tradução usa o texto original. */
const descItem = function (r) { const t = LANG === 'en' ? r.Descricao_EN : LANG === 'es' ? r.Descricao_ES : ''; return t || r.Descricao_Item; };
const nomeSub = function (proc, id) {
  if (LANG === 'pt') return id;
  const c = LANG === 'en' ? 'Subprocesso_EN' : 'Subprocesso_ES', r = ((S.db || {}).Cad_Processos_Perguntas || []).find(function (x) { return x.Processo === proc && x.ID_Subprocesso === id && x[c]; });
  return r ? r[c] : id;
};
const vz = function (m) { return '<div class="empty">' + esc(m) + '</div>'; };

/* ---------- infraestrutura ---------- */
function toast(m, err, acao) {
  const t = $('#toast'); t.textContent = m; t.className = err ? 'err' : '';
  if (acao) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tact'; b.textContent = acao.txt;
    b.onclick = function () { t.className = 'hidden'; acao.fn(); }; t.appendChild(b);
  }
  clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = 'hidden'; }, acao ? 9000 : 4500);
}
/** Debounce: só executa depois de ms sem novas chamadas, com os argumentos da última (busca que filtra a cada tecla). */
function adiar(fn, ms) {
  let t = 0;
  return function () { const a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
}
const BUSCA_MS = 200;
/** Blocos cinza animados que ocupam o lugar do conteúdo enquanto ele carrega. */
function skel(n, cls) {
  let h = ''; for (let i = 0; i < n; i++) h += '<div class="sk ' + (cls || 'sk-row') + '"></div>';
  return '<div class="skw' + (cls === 'sk-card' ? ' dc' : '') + '" aria-busy="true" aria-label="Carregando">' + h + '</div>';
}
/** Indicador global de espera: se alguma chamada ao servidor passa de ~0,3 s, mostra a barra no topo e o cursor de espera (some quando a última termina). */
const ESPERA = { n: 0, t: 0 };
function esperaIni() {
  ESPERA.n++;
  if (ESPERA.n === 1) ESPERA.t = setTimeout(function () { document.body.classList.add('espera'); }, 300);
}
function esperaFim() {
  ESPERA.n = Math.max(0, ESPERA.n - 1);
  if (!ESPERA.n) { clearTimeout(ESPERA.t); document.body.classList.remove('espera'); }
}
function rpc(fn) {
  const a = Array.prototype.slice.call(arguments, 1);
  esperaIni();
  return new Promise(function (ok, er) {
    const r = google.script.run
      .withSuccessHandler(function (x) { esperaFim(); if (LEIT.indexOf(fn) > -1) marcar(); ok(x); })
      .withFailureHandler(function (e) { esperaFim(); toast((e && e.message) || String(e), true); if (fn !== 'bootstrap' && /^Leia e aceite o aviso/.test((e && e.message) || '')) reavisar(); er(e); });
    r[fn].apply(r, a);
  });
}
function marcar() { S.upd = new Date(); relUpd(); }
/** "Atualizado agora / há 5 min / há 2 h"; o horário completo fica no tooltip. */
function relUpd() {
  const el = $('#atualizado'); if (!el || !S.upd) return;
  const n = S.upd, min = Math.floor((Date.now() - n.getTime()) / 60000);
  el.textContent = min < 1 ? 'Atualizado agora' : min < 60 ? 'Atualizado há ' + min + ' min' : 'Atualizado há ' + Math.floor(min / 60) + ' h';
  el.title = pad(n.getDate()) + '/' + pad(n.getMonth() + 1) + '/' + n.getFullYear() + ' ' + pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
}
const estr = function (tipo) { return S.db.Cad_Estrutura.filter(function (e) { return e.Tipo === tipo; }); };
const pessoasAtivas = function () { return S.db.Cad_Pessoas.filter(function (p) { return p.Status_Ativo !== 'Não'; }); };
const lideres = function () { return pessoasAtivas().filter(function (p) { return p.Cargo === 'Líder'; }); };
const colabs = function () { return pessoasAtivas().filter(function (p) { return p.Cargo === 'Colaborador'; }); };
const perg = function (proc) { return S.db.Cad_Processos_Perguntas.filter(function (p) { return p.Processo === proc; }); };
const tipoProc = function (p) { return S.tipos[p] || ''; };
const multi = function (p) { return !!(S.cfg.MULTI && S.cfg.MULTI[p]); };
const semLinha = function (o) { const c = Object.assign({}, o); delete c._row; delete c._saving; delete c.editavel; return c; };
/* <dialogo> */
/* Diálogos acessíveis (modal, busca, aviso, drawer): guarda quem abriu, leva o foco para dentro, prende o Tab, deixa o fundo
   inerte (#app e #login, quando o diálogo está fora deles) e devolve o foco ao fechar. O diálogo é localizado pelo seletor
   a cada uso, porque o drawer é redesenhado a cada render. Abrir de novo o mesmo diálogo (modal em cascata) mantém quem abriu primeiro. */
const DLG_FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const DLG_FUNDOS = ['#app', '#login'];
const dlgPilha = [];
function dlgFocaveis(el) { return Array.prototype.filter.call(el.querySelectorAll(DLG_FOCAVEIS), function (x) { return !x.disabled && x.getAttribute('aria-hidden') !== 'true'; }); }
function dlgVisivel(el) { return !el.getClientRects || el.getClientRects().length > 0; } // display:none em algum ancestral = invisível
function dlgAtualizarFundo() {
  // diálogo que sumiu do DOM sem passar por fecharDialogo (redesenho) sai da pilha: senão o fundo ficaria inerte para sempre
  for (let i = dlgPilha.length - 1; i >= 0; i--) if (!document.querySelector(dlgPilha[i].sel)) dlgPilha.splice(i, 1);
  DLG_FUNDOS.forEach(function (s) {
    const f = document.querySelector(s); if (!f) return;
    const dentro = dlgPilha.some(function (d) { const el = document.querySelector(d.sel); return el && f.contains(el); });
    if (dlgPilha.length && !dentro) f.setAttribute('inert', ''); else f.removeAttribute('inert');
  });
}
/** Abre (ou reabre) o diálogo do seletor. inicial: onde pôr o foco; volta: quem abriu (padrão: o foco atual),
    ou um seletor, quando o botão de origem será redesenhado antes do fechamento. */
function abrirDialogo(sel, inicial, volta) {
  const el = document.querySelector(sel); if (!el) return;
  if (!dlgPilha.some(function (d) { return d.sel === sel; })) dlgPilha.push({ sel: sel, volta: volta || document.activeElement });
  dlgAtualizarFundo();
  if (el.contains(document.activeElement)) return; // o foco já está dentro (ex.: o render escolheu o campo): não mexe
  const alvo = inicial || dlgFocaveis(el)[0];
  if (alvo) alvo.focus(); else { el.setAttribute('tabindex', '-1'); el.focus(); }
}
function fecharDialogo(sel) {
  let i = -1; dlgPilha.forEach(function (d, k) { if (d.sel === sel) i = k; });
  if (i < 0) return;
  const d = dlgPilha.splice(i, 1)[0];
  dlgAtualizarFundo();
  const v = typeof d.volta === 'string' ? document.querySelector(d.volta) : d.volta;
  if (v && v.focus && document.contains(v)) v.focus();
}
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab' || !dlgPilha.length) return;
  const el = document.querySelector(dlgPilha[dlgPilha.length - 1].sel); if (!el || !dlgVisivel(el)) return;
  const f = dlgFocaveis(el); if (!f.length) { e.preventDefault(); return; }
  const at = document.activeElement, pri = f[0], ult = f[f.length - 1];
  if (e.shiftKey ? (at === pri || !el.contains(at)) : (at === ult || !el.contains(at))) { e.preventDefault(); (e.shiftKey ? ult : pri).focus(); }
});
/* </dialogo> */
function modal(html) {
  const m = $('#modal');
  m.innerHTML = '<div class="box">' + html + '</div>'; m.classList.remove('hidden');
  abrirDialogo('#modal', m.querySelector('[data-fechar]'));
}
function fecharModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; fecharDialogo('#modal'); }

/* ---------- identidade visual: cor + símbolo (docas e clusters) ---------- */
const HEX = { Azul: '#1E6FD9', Verde: '#2E9E5B', Vermelho: '#D93025', Laranja: '#F57C00', Amarelo: '#F5C400', Roxo: '#7B3FA0', Rosa: '#E85DA0', Marrom: '#7A4B2A', Preto: '#222222', Branco: '#FFFFFF', Cinza: '#9E9E9E' };
const FORMA = {
  'Triângulo': '<polygon points="12,3 22,21 2,21"/>',
  'Bolinha': '<circle cx="12" cy="12" r="9"/>',
  'Quadrado': '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  'Losango': '<polygon points="12,2 22,12 12,22 2,12"/>',
  'Estrela': '<polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/>',
  'Cruz': '<polygon points="9,2 15,2 15,9 22,9 22,15 15,15 15,22 9,22 9,15 2,15 2,9 9,9"/>',
  'Hexágono': '<polygon points="7,3 17,3 22,12 17,21 7,21 2,12"/>'
};
const ALIAS_SIMB = { circulo: 'Bolinha', bola: 'Bolinha', retangulo: 'Quadrado' };
/** "Azul/Triângulo" -> { cor, simbolo } (aceita variações de acento/maiúsculas) ou null. */
function parseCS(v) {
  const t = String(v == null ? '' : v).split(/[\/\-–·\s]+/).map(norm).filter(Boolean);
  if (t.length !== 2) return null;
  const cor = function (x) { return S.visual.cores.find(function (c) { return norm(c) === x; }); };
  const simb = function (x) { return S.visual.simbolos.find(function (m) { return norm(m) === x; }) || (Object.prototype.hasOwnProperty.call(ALIAS_SIMB, x) ? ALIAS_SIMB[x] : null); };
  let c = cor(t[0]), m = simb(t[1]);
  if (!(c && m)) { c = cor(t[1]); m = simb(t[0]); }
  return c && m && FORMA[m] ? { cor: c, simbolo: m } : null;
}
function chipCS(v, tam) {
  const p = parseCS(v); if (!p) return '';
  const t = tam || 22;
  return '<span class="cs" role="img" aria-label="' + esc(p.cor + ' · ' + p.simbolo) + '" title="' + esc(p.cor + ' · ' + p.simbolo) + '" style="width:' + t + 'px;height:' + t + 'px">' +
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="' + (HEX[p.cor] || '#9E9E9E') + '" stroke="#222222" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">' + FORMA[p.simbolo] + '</svg></span>';
}
function textoCS(v) { const p = parseCS(v); return p ? p.cor + ' · ' + p.simbolo : String(v == null ? '' : v); }
function igualCS(a, b) { const x = parseCS(a), y = parseCS(b); return !!(x && y && x.cor === y.cor && x.simbolo === y.simbolo); }
function chipEst(proc, id) {
  const t = tipoProc(proc); if (!t || !id) return '';
  const e = estr(t).find(function (x) { return x.Identificador === id; });
  return e ? chipCS(e.Cor_Simbolo, 18) : '';
}

/* ---------- carga, menu e navegação ---------- */
function aplicarBase(b) {
  S.cfg = b.config; S.procs = b.processos; S.tipos = b.tipos; S.db = b.db; S.visual = b.visual || { cores: [], simbolos: [] };
  S.turnos = b.turnos || S.turnos; S.auditores = b.auditores || []; S.pend = b.pendentes || 0; S.metasNovas = b.metasNovas || 0; aplicarFb(b.fb, b.user);
  if (!S.mp || S.procs.indexOf(S.mp) < 0) S.mp = S.procs[0] || '';
}
/** O item "Autorizações" só aparece sozinho quando a pessoa não tem a tela Acessos (nela, vira uma aba). */
const autorizarSolo = function () { return tela('autorizar') && !tela('acessos'); };
function renderNav() {
  const btn = function (id, t, cls) {
    const al = (id === 'acessos' || id === 'autorizar') && pode('autorizar') && S.pend > 0, nm = id === 'minhas' && S.metasNovas > 0, fb = S.fb || {}, nf = id === 'feedbacks' && fb.fbMeus > 0, np = id === 'programacao' && pode('obrigacoes') && ((fb.fbAbertasHub | 0) + (fb.fbAtrasadosHub | 0)) > 0;
    const n = nm ? S.metasNovas : nf ? fb.fbMeus : np ? (fb.fbAbertasHub | 0) + (fb.fbAtrasadosHub | 0) : S.pend, tot = al || nm || nf || np, rot = nm ? '{0}: {1} nova(s)' : nf ? '{0}: {1} a registrar' : np ? '{0}: {1} precisam de ação' : '{0}: {1} pendente(s)';
    return '<button type="button" data-v="' + id + '" class="' + (cls || '') + (tot ? ' alerta' : '') + '"' + (S.v === id ? ' aria-current="page"' : '') + (tot ? ' aria-label="' + esc(tpl(tr(rot), [t, n])) + '"' : '') + '>' + ic(KID_IC[id] || (NAV_ITENS.find(function (x) { return x.id === id; }) || {}).ic, 18) + '<span class="t">' + esc(t) + '</span>' + (tot ? '<span class="badge-n">' + n + '</span>' : '') + '</button>';
  };
  let h = '';
  NAV.forEach(function (sec) {
    let sh = '';
    sec.itens.forEach(function (it) {
      if (it.kids) {
        const kids = it.kids.filter(tela); if (!kids.length) return;
        const aberto = S.gopen || kids.indexOf(S.v) > -1;
        sh += '<button type="button" class="grp" data-g="' + it.id + '" aria-expanded="' + aberto + '">' + ic(it.ic, 18) + '<span class="t">' + esc(it.t) + '</span>' + ic('chevron-down', 16, 'chev') + '</button>' +
          '<div class="kids' + (aberto ? '' : ' hidden') + '">' + kids.map(function (k) { return btn(k, TIT[k]); }).join('') + '</div>';
      } else if (it.id === 'autorizar' ? autorizarSolo() : tela(it.id)) sh += btn(it.id, TIT[it.id]);
    });
    if (sh) h += '<div class="nsec">' + esc(sec.sec) + '</div>' + sh;
  });
  // o pulso chama isto a cada poucos minutos: sem mudança, o menu não é recriado (mantém foco e hover, sem trabalho de layout)
  if (h !== S.navHtml) { S.navHtml = h; $('#nav').innerHTML = h; }
  $$('#nav button[data-v]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === S.v || (b.dataset.v === 'acessos' && S.v === 'acessos')); });
}
const LOAD = {
  matriz: function () { return loadMatriz(); }, form: function () { if (!S.F) novoForm(); renderForm(); }, minhas: function () { return loadMinhas(); }, programacao: function () { return loadProgramacao(); }, feedbacks: function () { return loadFeedbacksMeus(); },
  cad: function () { renderCad(); }, cfg: function () { loadCfg(); }, acessos: function () { return loadAcessos(); }, autorizar: function () { return loadAutorizar(); }, log: function () { return loadLog(); }
};
function nav(v) {
  if (v === 'autorizar' && tela('acessos')) { S.acTab = 'autorizar'; v = 'acessos'; }
  if (!tela(v)) { v = ['matriz', 'form', 'minhas', 'geral'].filter(tela)[0] || S.u.telas[0]; if (!v) return; }
  const antes = S.v; S.v = v;
  if (v !== 'acessos') S.acSol = null;
  if (antes !== v) S.det = null;
  $$('.view').forEach(function (e) { e.classList.toggle('hidden', e.id !== 'v-' + v); });
  $('#fbar').classList.toggle('hidden', REL.indexOf(v) < 0);
  $('#btnPrint').classList.toggle('hidden', REL.indexOf(v) < 0 || v === 'export');
  $('#titulo').textContent = TIT[v];
  $('#side').classList.remove('open');
  renderNav();
  if (REL.indexOf(v) > -1) loadRel(v); else LOAD[v]();
}
async function atualizar() {
  const b = $('#refresh'), t = $('#refresh .t'); b.disabled = true; t.textContent = 'Atualizando…';
  try { const nb = await rpc('bootstrap', true); if (!aplicarBootstrap(nb)) return; S.mx = {}; S.edit = null; S.delIdx = -1; S.ac = null; fbarFill(); nav(S.v); } catch (e) { /* o aviso já foi exibido */ } finally { b.disabled = false; t.textContent = 'Atualizar'; }
}

/* ---------- filtros globais dos relatórios ---------- */
function setPer(k) {
  const t = new Date(), f = new Date(); f.setDate(t.getDate() - (Number(k) - 1));
  S.flt.de = ymd(f); S.flt.ate = ymd(t); S.perK = String(k);
}
function opcoes(lista, atual, todos) {
  return '<option value="">' + esc(todos || 'Todos') + '</option>' + lista.map(function (x) {
    const v = typeof x === 'string' ? x : x[0], t = typeof x === 'string' ? x : x[1];
    return '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(t) + '</option>';
  }).join('');
}
function fbarFill() {
  const F = S.flt;
  $('#f-processo').innerHTML = opcoes(S.procs, F.processo);
  const tipos = F.processo ? [tipoProc(F.processo)].filter(Boolean) : ['Doca', 'Cluster'], docas = [];
  tipos.forEach(function (t) { estr(t).forEach(function (e) { if (docas.indexOf(e.Identificador) < 0) docas.push(e.Identificador); }); });
  if (F.doca && docas.indexOf(F.doca) < 0) F.doca = '';
  $('#f-doca').innerHTML = opcoes(docas, F.doca);
  $('#f-turno').innerHTML = opcoes(S.turnos, F.turno);
  $('#f-lider').innerHTML = opcoes(S.db.Cad_Pessoas.filter(function (p) { return p.Cargo === 'Líder'; }).map(function (p) { return p.Nome; }), F.lider);
  $('#dl-colab').innerHTML = S.db.Cad_Pessoas.filter(function (p) { return p.Cargo === 'Colaborador'; }).map(function (p) { return '<option value="' + esc(p.Nome) + '"></option>'; }).join('');
  $('#f-auditor').innerHTML = opcoes(S.auditores.map(function (a) { return [a.email, a.nome + (a.ativo ? '' : ' (inativo)')]; }), F.auditor);
  $('#f-faixa').innerHTML = opcoes([['verde', 'Conforme'], ['observacao', 'Em observação'], ['vermelho', 'Inconforme']], F.faixa);
  $('#f-auditor').parentNode.classList.toggle('hidden', !S.auditores.length);
  $('#f-colaborador').parentNode.classList.toggle('hidden', !pode('ver_nomes'));
  fbarSync();
}
/** "Mais filtros": a barra mostra o essencial; o resto abre sob demanda, com a contagem dos filtros ativos. */
function contarMais() { return ['doca', 'lider', 'colaborador', 'auditor', 'faixa', 'obs'].filter(function (k) { return !!S.flt[k]; }).length; }
function fmaisSync() {
  const n = contarMais(), aberto = S.fmais || n > 0;
  $('#fmais').classList.toggle('hidden', !aberto); $('#f-mais').setAttribute('aria-expanded', String(aberto));
  const b = $('#f-mais-n'); b.textContent = n || ''; b.classList.toggle('hidden', !n);
}
function fbarSync() {
  const F = S.flt;
  $('#f-de').value = F.de; $('#f-ate').value = F.ate; $('#f-colaborador').value = F.colaborador; $('#f-obs').value = F.obs;
  fmaisSync();
  $$('#fper button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === S.perK); });
}
function fbarInit() {
  setPer('30'); fbarFill();
  $('#fper').addEventListener('click', function (e) { const b = e.target.closest('button'); if (!b) return; setPer(b.dataset.k); fbarSync(); recarregar(); });
  const per = function () {
    const de = $('#f-de').value, ate = $('#f-ate').value;
    if (!de || !ate) { fbarSync(); toast('Informe as datas De e Até.', true); return; }
    if (de > ate) { fbarSync(); toast('A data inicial deve ser anterior à final.', true); return; }
    S.flt.de = de; S.flt.ate = ate; S.perK = 'cal'; fbarSync(); recarregar();
  };
  $('#f-de').addEventListener('change', per); $('#f-ate').addEventListener('change', per);
  [['processo', '#f-processo'], ['doca', '#f-doca'], ['turno', '#f-turno'], ['lider', '#f-lider'], ['auditor', '#f-auditor'], ['faixa', '#f-faixa']].forEach(function (x) {
    $(x[1]).addEventListener('change', function (e) { S.flt[x[0]] = e.target.value; if (x[0] === 'processo') fbarFill(); fmaisSync(); recarregar(); });
  });
  $('#f-mais').addEventListener('click', function () { S.fmais = !(S.fmais || contarMais() > 0); fmaisSync(); });
  $('#f-obs').addEventListener('change', function (e) { S.flt.obs = e.target.value.trim(); fmaisSync(); recarregar(); });
  $('#f-colaborador').addEventListener('change', function (e) {
    const v = e.target.value.trim();
    if (!v) { S.flt.colaborador = ''; recarregar(); return; }
    const p = S.db.Cad_Pessoas.find(function (x) { return x.Cargo === 'Colaborador' && norm(x.Nome) === norm(v); });
    if (!p) { toast('Colaborador não encontrado. Escolha um nome da lista.', true); e.target.value = S.flt.colaborador; return; }
    S.flt.colaborador = p.Nome; e.target.value = p.Nome; recarregar();
  });
  $('#f-limpar').addEventListener('click', function () {
    ['processo', 'doca', 'turno', 'lider', 'colaborador', 'auditor', 'faixa', 'obs'].forEach(function (k) { S.flt[k] = ''; });
    fbarFill(); recarregar();
  });
}
/** Abre as Auditorias já filtradas (insights, ofensores e listas clicáveis). */
function irFiltrado(go) {
  if (!tela('auditorias')) return;
  ['processo', 'doca', 'turno', 'lider', 'colaborador', 'auditor', 'faixa', 'obs'].forEach(function (k) { S.flt[k] = (go && go[k]) || ''; });
  S.pag = 1; S.det = null; fbarFill(); nav('auditorias');
}
function imprimirRel() {
  const f = S.flt, ativos = ['processo', 'doca', 'turno', 'lider', 'colaborador', 'faixa', 'obs'].filter(function (k) { return f[k]; }).map(function (k) { return f[k]; });
  const agora = new Date(), dt = pad(agora.getDate()) + '/' + pad(agora.getMonth() + 1) + '/' + agora.getFullYear() + ' ' + pad(agora.getHours()) + ':' + pad(agora.getMinutes());
  $('#printHd').innerHTML = '<div class="ph-t">Process Check</div><div class="ph-s">' + esc(TIT[S.v]) + '</div><div class="ph-m"><span>' + esc(tpl('Período: {0} a {1}', [fmtD(f.de), fmtD(f.ate)])) + '</span>' +
    (ativos.length ? '<span>' + esc(tpl('Filtros: {0}', [ativos.join(', ')])) + '</span>' : '') + '<span>' + esc(tpl('Gerado em {0} por {1}', [dt, S.u.nome])) + '</span></div>';
  window.print();
}
const tpl = function (t, a) { return t.replace(/\{(\d)\}/g, function (x, i) { return a[Number(i)]; }); };
window.addEventListener('beforeprint', function () { Object.keys(S.ch).forEach(function (k) { try { S.ch[k].resize(); } catch (e) { /* gráfico já removido */ } }); });
function recarregar() { if (REL.indexOf(S.v) > -1) { S.det = null; S.pag = 1; loadRel(S.v); } }

/* ---------- gráficos e tabelas (utilitários) ---------- */
const tema = function () { return document.documentElement.getAttribute('data-theme') === 'dark'; };
const cinza = function () { return tema() ? '#5B6571' : '#A7AFB8'; };
function destruirGraficos() { Object.keys(S.ch).forEach(function (k) { try { S.ch[k].destroy(); } catch (e) { /* já destruído */ } }); S.ch = {}; }
const linhasCorte = {
  id: 'linhasCorte',
  afterDraw: function (ch, a, o) {
    if (!o || o.corte == null || !ch.scales.y) return;
    const y = ch.scales.y, c = ch.ctx;
    [[o.corte, COR.vermelho], [o.media, COR.observacao]].forEach(function (x) {
      const py = y.getPixelForValue(x[0]); c.save(); c.strokeStyle = x[1]; c.setLineDash([5, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(ch.chartArea.left, py); c.lineTo(ch.chartArea.right, py); c.stroke(); c.restore();
    });
  }
};
/* Chart.js sob demanda: a abertura do app não espera a biblioteca (~200 KB); ela vem na primeira tela com gráfico.
   Arquivo original do pacote (já minificado na 4.4.1) com hash fixo: se o CDN entregar outro conteúdo, o navegador não executa. */
const CHART_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
const CHART_SRI = 'sha256-dEAdc43T4D7l37O2hBIQ/ixOrYqWDEARykugt4qf2PM=';
/** Um único carregamento em andamento; se o CDN falhar, a próxima tela com gráfico tenta de novo. */
function carregarChart() {
  if (carregarChart.p) return carregarChart.p;
  carregarChart.p = new Promise(function (ok, er) {
    const s = document.createElement('script');
    s.src = CHART_SRC; s.integrity = CHART_SRI; s.crossOrigin = 'anonymous'; s.async = true;
    s.onload = function () { ok(); };
    s.onerror = function () { carregarChart.p = null; er(new Error('Chart.js não carregou')); };
    document.head.appendChild(s);
  });
  return carregarChart.p;
}
function mkChart(id, cfg) {
  const el = document.getElementById(id); if (!el) return;
  if (typeof Chart === 'undefined') {
    // desenha quando a biblioteca chegar, se o gráfico ainda estiver na tela (o usuário pode ter trocado de tela)
    carregarChart().then(function () { if (document.getElementById(id) === el && typeof Chart !== 'undefined') mkChart(id, cfg); })
      .catch(function () { if (el.parentNode) el.parentNode.innerHTML = vz('Gráfico indisponível (biblioteca não carregou). Os dados estão nas tabelas.'); });
    return;
  }
  Chart.defaults.color = tema() ? '#98A1AB' : '#6B7280'; Chart.defaults.borderColor = tema() ? '#323840' : '#E4E7EB'; Chart.defaults.font.family = '-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
  cfg.options = Object.assign({ maintainAspectRatio: false, responsive: true }, cfg.options || {});
  cfg.options.plugins = Object.assign({ legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } } }, cfg.options.plugins || {});
  if (LANG !== 'pt' && cfg.data) {
    if (cfg.data.labels) cfg.data.labels = cfg.data.labels.map(function (l) { return typeof l === 'string' ? tr(l) : Array.isArray(l) ? l.map(function (x) { return typeof x === 'string' ? tr(x) : x; }) : l; });
    (cfg.data.datasets || []).forEach(function (d) { if (d.label) d.label = tr(d.label); });
  }
  S.ch[id] = new Chart(el, cfg);
}
/** Mini gráfico de tendência (SVG, sem biblioteca): valores de 0 a 100, null = semana sem auditoria. */
function sparkSvg(serie, w, h) {
  w = w || 72; h = h || 20;
  const pts = serie.map(function (v, i) { return v == null ? null : [serie.length > 1 ? i * (w - 4) / (serie.length - 1) + 2 : w / 2, h - 2 - Math.max(0, Math.min(100, v)) / 100 * (h - 4)]; });
  const lin = []; let seg = [];
  pts.forEach(function (p) { if (p) seg.push(p); else { if (seg.length) lin.push(seg); seg = []; } }); if (seg.length) lin.push(seg);
  if (!pts.some(Boolean)) return '<span class="muted">—</span>';
  const ult = pts.filter(Boolean).pop();
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + lin.map(function (sg) { return sg.length > 1 ? '<polyline fill="none" stroke="currentColor" stroke-width="1.6" points="' + sg.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>' : ''; }).join('') + '<circle cx="' + ult[0].toFixed(1) + '" cy="' + ult[1].toFixed(1) + '" r="2.2" fill="currentColor"/></svg>';
}
function kpi(t, v, sub, tone) { return '<div class="kpi"><small>' + esc(t) + '</small><b class="' + (tone || '') + '">' + v + '</b>' + (sub ? '<em class="' + (sub[1] || '') + '">' + sub[0] + '</em>' : '') + '</div>'; }
function delta(v, pv, sfx, inv) {
  const df = Math.round((v - pv) * 10) / 10, cls = df === 0 ? '' : ((df > 0) !== !!inv ? 'up' : 'down');
  return [(df > 0 ? ic('arrow-up', 12) : df < 0 ? ic('arrow-down', 12) : ic('minus', 12)) + ' ' + String(Math.abs(df)).replace('.', ',') + sfx + ' vs. período anterior (' + String(pv).replace('.', ',') + sfx + ')', cls];
}
/** Ordenação e busca no navegador para tabelas pequenas/médias. Células usam data-v para valor de ordenação. */
function tabelaInterativa(raiz) {
  Array.prototype.slice.call(raiz.querySelectorAll('table[data-sort]')).forEach(function (t) {
    t.addEventListener('click', function (e) {
      const th = e.target.closest('th[data-s]'); if (!th) return;
      const idx = Array.prototype.indexOf.call(th.parentNode.children, th), dir = th.dataset.dir === 'asc' ? 'desc' : 'asc', tb = t.tBodies[0];
      Array.prototype.slice.call(th.parentNode.children).forEach(function (x) { delete x.dataset.dir; x.removeAttribute('aria-sort'); });
      th.dataset.dir = dir; th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
      const val = function (tr) { const c = tr.children[idx], v = c.getAttribute('data-v'); return v !== null ? v : c.textContent; };
      const rows = Array.prototype.slice.call(tb.rows).sort(function (a, b) {
        const x = val(a), y = val(b), nx = parseFloat(x), ny = parseFloat(y);
        const r = !isNaN(nx) && !isNaN(ny) && th.dataset.s === 'n' ? nx - ny : String(x).localeCompare(String(y), 'pt-BR');
        return dir === 'asc' ? r : -r;
      });
      rows.forEach(function (r) { tb.appendChild(r); });
    });
  });
  Array.prototype.slice.call(raiz.querySelectorAll('input[data-busca]')).forEach(function (i) {
    i.addEventListener('input', adiar(function () {
      const q = norm(i.value);
      const alvo = i.closest('.card') || raiz; // a busca age só na tabela do próprio cartão
      Array.prototype.slice.call(alvo.querySelectorAll('table[data-sort] tbody tr')).forEach(function (tr) { tr.classList.toggle('hidden', !!q && norm(tr.textContent).indexOf(q) < 0); });
    }, BUSCA_MS));
  });
}
