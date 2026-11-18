/* ---------- idiomas: português (base), inglês e espanhol ----------
   O texto-fonte do sistema é o português. Cada texto exibido é traduzido por dicionário (DICT em i18n.js),
   no próprio navegador, em telas, menus, janelas, avisos, tabelas e dicas. Textos sem tradução ficam em português. */
const IDIOMAS = [['pt', 'Português'], ['en', 'English'], ['es', 'Español']];
const HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es' };
const ATRS_TR = ['placeholder', 'title', 'aria-label', 'alt'];
let LANG = 'pt';
let TAB_EX = null, TAB_PAD = null;
const origNo = new WeakMap(), ultNo = new WeakMap(), origAt = new WeakMap(), ultAt = new WeakMap();
let obsIdioma = null, traduzindo = false;
const idiomaAtual = function () { return LANG; };
const idiomaValido = function (l) { return IDIOMAS.some(function (x) { return x[0] === l; }); };

/** Monta as tabelas de busca (textos exatos e modelos com {0}, {1}) a partir de DICT. */
function prepararDict() {
  if (TAB_EX) return;
  TAB_EX = { en: {}, es: {} }; TAB_PAD = { en: [], es: [] };
  const norm1 = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  (typeof DICT === 'undefined' ? [] : DICT).forEach(function (d) {
    ['en', 'es'].forEach(function (l, i) {
      const pt = norm1(d[0]), alvo = d[i + 1];
      if (alvo == null || alvo === '') return;
      if (/\{\d\}/.test(pt)) {
        const ord = [], re = new RegExp('^' + pt.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, function (m) { ord.push(Number(m.charAt(1))); return '(.+?)'; }) + '$', 's');
        TAB_PAD[l].push({ re: re, ord: ord, out: alvo, n: pt.length });
      } else TAB_EX[l][pt] = alvo;
    });
  });
  ['en', 'es'].forEach(function (l) { TAB_PAD[l].sort(function (a, b) { return b.n - a.n; }); });
}
function buscarTr(k, l, prof) {
  const e = TAB_EX[l][k]; if (e !== undefined) return e;
  if (prof > 3) return null;
  const P = TAB_PAD[l];
  for (let i = 0; i < P.length; i++) {
    const m = P[i].re.exec(k); if (!m) continue;
    return P[i].out.replace(/\{(\d)\}/g, function (x, d) {
      const g = m[P[i].ord.indexOf(Number(d)) + 1]; if (g == null) return x;
      const t = buscarTr(g.trim(), l, prof + 1); return t == null ? g : t;
    });
  }
  if (prof < 2) {
    /* listas separadas por "; " ou ", " (permissões, telas): traduz cada item que existir no dicionário */
    const sep = k.indexOf('; ') > -1 ? '; ' : (k.indexOf(', ') > -1 ? ', ' : '');
    if (sep) {
      const partes = k.split(sep); let achou = false;
      const out = partes.map(function (x) { const t = buscarTr(x, l, 3); if (t != null) achou = true; return t == null ? x : t; });
      if (achou) return out.join(sep);
    }
  }
  return null;
}
/** Traduz um texto para o idioma atual (devolve o próprio texto se não houver tradução). */
function tr(s) {
  if (LANG === 'pt' || s == null) return s;
  prepararDict();
  const str = String(s), k = str.replace(/\s+/g, ' ').trim(); if (!k) return str;
  const t = buscarTr(k, LANG, 0); if (t == null) return str;
  return str.slice(0, str.length - str.trimStart().length) + t + str.slice(str.trimEnd().length);
}

function traduzirNo(n) {
  const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return;
  const atual = n.data; let o = origNo.get(n);
  if (o === undefined || ultNo.get(n) !== atual) { o = atual; origNo.set(n, o); }
  if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', p.textContent === atual ? o : p.value);
  const t = LANG === 'pt' ? o : tr(o);
  if (t !== atual) n.data = t;
  ultNo.set(n, t);
}
function traduzirAtributos(el) {
  ATRS_TR.forEach(function (a) {
    if (!el.hasAttribute || !el.hasAttribute(a)) return;
    let m = origAt.get(el), u = ultAt.get(el);
    if (!m) { m = {}; u = {}; origAt.set(el, m); ultAt.set(el, u); }
    const atual = el.getAttribute(a); if (m[a] === undefined || u[a] !== atual) m[a] = atual;
    const t = LANG === 'pt' ? m[a] : tr(m[a]);
    if (t !== atual) el.setAttribute(a, t);
    u[a] = t;
  });
}
function traduzirArvore(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 3) { traduzirNo(raiz); return; }
  if (raiz.nodeType !== 1) return;
  const w = document.createTreeWalker(raiz, 4);
  let n; const nos = []; while ((n = w.nextNode())) nos.push(n);
  nos.forEach(traduzirNo);
  traduzirAtributos(raiz);
  Array.prototype.forEach.call(raiz.querySelectorAll('[placeholder],[title],[aria-label],[alt]'), traduzirAtributos);
}
function iniciarObservador() {
  if (obsIdioma || typeof MutationObserver === 'undefined') return;
  obsIdioma = new MutationObserver(function (regs) {
    if (traduzindo) return;
    traduzindo = true;
    try {
      regs.forEach(function (r) {
        if (r.type === 'characterData') traduzirNo(r.target);
        else if (r.type === 'attributes') traduzirAtributos(r.target);
        else r.addedNodes.forEach(traduzirArvore);
      });
    } finally { obsIdioma.takeRecords(); traduzindo = false; }
  });
  obsIdioma.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRS_TR });
}
function aplicarIdioma(l, salvar) {
  if (!idiomaValido(l)) l = 'pt';
  LANG = l;
  document.documentElement.setAttribute('lang', HTML_LANG[l]);
  if (salvar) { try { localStorage.setItem('pcLang', l); } catch (e) { /* sem armazenamento */ } }
  traduzindo = true;
  try { traduzirArvore(document.body); } finally { if (obsIdioma) obsIdioma.takeRecords(); traduzindo = false; }
}
/** Idioma inicial: escolha salva; senão o idioma do navegador (pt, en ou es); senão português. */
function iniciarIdioma() {
  let l = null;
  try { l = localStorage.getItem('pcLang'); } catch (e) { l = null; }
  if (!idiomaValido(l)) l = String(window.PC_LANG || (navigator.language || 'pt')).slice(0, 2).toLowerCase();
  if (!idiomaValido(l)) l = 'pt';
  iniciarObservador();
  aplicarIdioma(l, false);
}
