const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const OUT = require('path').join(__dirname, '..', 'src') + '/';
const COLETA = process.env.PC_COLETA ? new Set() : null;
if (COLETA) process.on('exit', () => fs.writeFileSync(process.env.PC_COLETA, JSON.stringify([...COLETA].sort())));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function montarHtml() {
  let h = fs.readFileSync(OUT + 'Index.html', 'utf8');
  h = h.replace("<?!= include('Styles'); ?>", fs.readFileSync(OUT + 'Styles.html', 'utf8'));
  h = h.replace(/<script src="https:\/\/cdn[^"]*"><\/script>/, '');
  h = h.replace("<?!= include('JS_Client'); ?>", fs.readFileSync(OUT + 'JS_Client.html', 'utf8'));
  return h;
}
/** Abre o app como `email`, ligado ao Code.gs real (A). opts.semChart remove a biblioteca de gráficos. */
async function abrir(A, email, opts) {
  opts = opts || {};
  const erros = [], chamadas = [], graficos = [], st = { pend: 0 };
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e.detail && e.detail.message || e.message)));
  vc.on('error', e => erros.push('console.error: ' + e));
  const dom = new JSDOM(montarHtml(), { runScripts: 'outside-only', url: 'https://app.test/', pretendToBeVisual: true, virtualConsole: vc });
  const win = dom.window;
  win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
  win.addEventListener('error', e => erros.push('window.error: ' + e.message));
  win.addEventListener('unhandledrejection', e => erros.push('unhandled: ' + (e.reason && e.reason.message || e.reason)));
  if (!opts.semChart) {
    win.Chart = function (el, cfg) { graficos.push({ id: el.id, cfg }); this.destroy = () => {}; };
    win.Chart.defaults = { font: {} };
  }
  const build = (ok, fail) => new Proxy({}, { get(_, name) {
    if (name === 'withSuccessHandler') return f => build(f, fail);
    if (name === 'withFailureHandler') return f => build(ok, f);
    return (...args) => {
      chamadas.push([name, JSON.parse(JSON.stringify(args))]); st.pend++;
      setTimeout(() => {
        A.as(email);
        let r, err = null;
        try { r = A.call(name, ...JSON.parse(JSON.stringify(args))); } catch (e) { err = e; }
        st.pend--;
        if (err) { if (fail) fail({ message: err.message }); } else if (ok) ok(r);
      }, 0);
    };
  } });
  win.google = { script: { run: build() } };
  const urls = []; win.URL.createObjectURL = b => { urls.push(b); return 'blob:x'; };
  const clk = win.HTMLElement.prototype.click; win.HTMLAnchorElement.prototype.click = function () { if (this.download) { win.__download = this.download; return; } return clk.call(this); };
  // executa o script do app (inclui boot)
  const doc = win.document;
  const t = { win, doc, A, email, erros, chamadas, graficos, urls, st };
  t.$ = s => doc.querySelector(s); t.$$ = s => Array.from(doc.querySelectorAll(s));
  t.coletar = () => {
    const w = doc.createTreeWalker(doc.body, 4); let n;
    while ((n = w.nextNode())) { if (/SCRIPT|STYLE|TEXTAREA/.test(n.parentNode.nodeName)) continue; const x = n.data.replace(/\s+/g, ' ').trim(); if (x) COLETA.add(x); }
    t.$$('[placeholder],[title],[aria-label],[alt]').forEach(e => ['placeholder', 'title', 'aria-label', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v) COLETA.add(v.replace(/\s+/g, ' ').trim()); }));
  };
  t.idle = async () => { let ok = 0; for (let i = 0; i < 400 && ok < 3; i++) { await sleep(8); ok = st.pend === 0 ? ok + 1 : 0; } if (COLETA) t.coletar(); };
  t.ev = (el, tipo) => el.dispatchEvent(new win.Event(tipo, { bubbles: true }));
  t.set = (sel, v, tipo) => { const el = typeof sel === 'string' ? t.$(sel) : sel; if (!el) throw new Error('sem elemento ' + sel); el.value = v; t.ev(el, tipo || 'change'); };
  t.click = async (sel) => { const el = typeof sel === 'string' ? t.$(sel) : sel; if (!el) throw new Error('sem elemento ' + sel); el.click(); await t.idle(); };
  t.nav = async (v) => { await t.click('#nav button[data-v="' + v + '"]'); };
  t.irAutorizar = async () => { await t.nav('acessos'); const b = t.$('#v-acessos .tabs [data-at="autorizar"]'); if (b && !b.classList.contains('on')) await t.click(b); };
  t.menu = () => t.$$('#nav button[data-v]').map(b => b.dataset.v);
  t.toast = () => { const e = t.$('#toast'); return e.classList.contains('hidden') ? '' : e.textContent; };
  t.texto = () => doc.body.textContent;
  // roda o script do cliente dentro da janela
  const m = fs.readFileSync(OUT + 'JS_Client.html', 'utf8');
  const js = m.replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
  win.PC_MIN_LOAD = opts.minLoad != null ? opts.minLoad : 0; win.PC_FADE = 0; win.PC_LANG = opts.lang || process.env.PC_LANG || 'pt'; if (opts.poll) win.PC_POLL = opts.poll;
  win.open = (u, alvo) => { t.aberto = [u, alvo]; return null; };
  if (opts.antes) opts.antes(win);
  win.eval(js + '\n;window.__S = S;');
  await t.idle();
  return t;
}
module.exports = { abrir, sleep };
