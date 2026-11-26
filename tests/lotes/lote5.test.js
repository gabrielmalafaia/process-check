/* Lote 5 da revisão v10 (acessibilidade): contraste calculado do próprio Styles.html, helper de diálogo com DOM simulado e marcação dos erros. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { teste, eq, resumo } = require('./harness');

const raiz = path.join(__dirname, '..', '..', 'src');
const css = fs.readFileSync(path.join(raiz, 'Styles.html'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); // sem comentários: o seletor fica exato
const cliente = fs.readFileSync(path.join(raiz, 'JS_Client.html'), 'utf8');
const index = fs.readFileSync(path.join(raiz, 'Index.html'), 'utf8');

/* ---------- contraste WCAG ---------- */
const tokens = {};
(css.match(/:root\{([^}]*)\}/) || ['', ''])[1].split(';').forEach((d) => { const m = d.match(/(--[\w-]+)\s*:\s*(.+)/); if (m) tokens[m[1]] = m[2].trim(); });
const resolver = (v) => { let x = String(v).trim(), n = 0; while (/var\(/.test(x) && n++ < 5) x = x.replace(/var\((--[\w-]+)\)/, (_, t) => tokens[t]); return x; };
function cor(v) {
  v = resolver(v);
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = v.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
  if (/^#fff$/i.test(v)) return [255, 255, 255, 1];
  throw new Error('cor não entendida: ' + v);
}
const sobre = (c, fundo) => [0, 1, 2].map((i) => c[i] * c[3] + fundo[i] * (1 - c[3])).concat([1]);
const lum = (c) => { const f = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Última regra do tema claro para o seletor exato (as de [data-theme=...] ficam de fora). */
function regra(sel) {
  const re = /([^{}]+)\{([^}]*)\}/g, props = {}; let m;
  while ((m = re.exec(css))) {
    if (!m[1].split(',').some((s) => s.trim() === sel)) continue; // seletor exato; regras de [data-theme=...] têm outro texto
    m[2].split(';').forEach((d) => { const p = d.split(':'); if (p.length >= 2) props[p[0].trim()] = p.slice(1).join(':').trim(); });
  }
  return props;
}
function contraste(sel) {
  const r = regra(sel), card = cor('var(--card)');
  const fundo = sobre(cor(r.background), card);
  return razao(sobre(cor(r.color || '#fff'), fundo), fundo);
}

console.log('H11: contraste de status (tema claro, texto pequeno, mínimo 4,5:1)');
['.pill.verde', '.pill.vermelho', '.pill.observacao'].forEach((s) => {
  teste(s + ' tem contraste suficiente', () => { const c = contraste(s); eq(c >= 4.5, true, s + ' = ' + c.toFixed(2) + ':1'); });
});
teste('.mc.verde (texto branco) tem contraste suficiente', () => { const c = contraste('.mc.verde'); eq(c >= 4.5, true, '.mc.verde = ' + c.toFixed(2) + ':1'); });
teste('.mc.vermelho continua passando', () => { const c = contraste('.mc.vermelho'); eq(c >= 4.5, true, c.toFixed(2)); });

/* ---------- helper de diálogo com DOM mínimo ---------- */
function domFalso() {
  let ativo = null;
  const todos = [];
  const el = (id, op = {}) => {
    const e = { id, attrs: {}, filhos: [], pai: null, disabled: false, cls: op.cls || '',
      focus() { ativo = e; }, setAttribute(k, v) { e.attrs[k] = String(v); }, removeAttribute(k) { delete e.attrs[k]; }, getAttribute(k) { return k in e.attrs ? e.attrs[k] : null; },
      contains(x) { for (let y = x; y; y = y.pai) if (y === e) return true; return false; },
      querySelectorAll() { const out = []; const ir = (n) => n.filhos.forEach((f) => { if (f.focavel && !f.disabled) out.push(f); ir(f); }); ir(e); return out; },
      add(f) { f.pai = e; e.filhos.push(f); return f; } };
    e.focavel = !!op.focavel; todos.push(e); return e;
  };
  const corpo = el('body');
  const doc = {
    get activeElement() { return ativo; },
    contains: (x) => corpo.contains(x),
    // seletor simplificado: vale a última parte ("#id" ou ".classe.classe")
    querySelector: (sel) => { const u = sel.split(' ').pop(); return todos.find((e) => (u[0] === '#' ? e.id === u.slice(1) : u.split('.').filter(Boolean).every((c) => e.cls.split(' ').indexOf(c) > -1)) && corpo.contains(e)) || null; },
    ouvintes: [], addEventListener(t, f) { this.ouvintes.push(f); },
  };
  return { doc, el, corpo };
}
function carregarDialogo(doc) {
  const m = cliente.match(/\/\* <dialogo> \*\/([\s\S]*?)\/\* <\/dialogo> \*\//);
  if (!m) throw new Error('bloco <dialogo> não encontrado no cliente');
  const ctx = { document: doc, Array };
  vm.createContext(ctx); vm.runInContext(m[1], ctx);
  return ctx;
}
function cenario() {
  const { doc, el, corpo } = domFalso();
  const app = corpo.add(el('app')), gatilho = app.add(el('gatilho', { focavel: true }));
  const modal = corpo.add(el('modal')), b1 = modal.add(el('b1', { focavel: true })), b2 = modal.add(el('b2', { focavel: true }));
  const login = corpo.add(el('login'));
  gatilho.focus();
  return { doc, el, corpo, app, gatilho, modal, b1, b2, login, ctx: carregarDialogo(doc) };
}
const tab = (ctx, doc, shift) => { let parou = false; doc.ouvintes.forEach((f) => f({ key: 'Tab', shiftKey: !!shift, preventDefault() { parou = true; } })); return parou; };

console.log('H10: diálogos com foco preso, fundo inerte e foco devolvido');
teste('abrir move o foco para dentro e deixa o fundo inerte', () => {
  const c = cenario();
  c.ctx.abrirDialogo('#modal');
  eq(c.doc.activeElement.id, 'b1');
  eq(c.app.getAttribute('inert') !== null && c.login.getAttribute('inert') !== null, true, 'fundo inerte');
});
teste('Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último', () => {
  const c = cenario();
  c.ctx.abrirDialogo('#modal');
  c.b2.focus(); eq(tab(c.ctx, c.doc), true); eq(c.doc.activeElement.id, 'b1');
  eq(tab(c.ctx, c.doc, true), true); eq(c.doc.activeElement.id, 'b2');
});
teste('fechar devolve o foco a quem abriu e libera o fundo', () => {
  const c = cenario();
  c.ctx.abrirDialogo('#modal');
  c.ctx.fecharDialogo('#modal');
  eq(c.doc.activeElement.id, 'gatilho');
  eq(c.app.getAttribute('inert'), null);
});
teste('abrir de novo o mesmo diálogo (modal em cascata) não perde quem abriu primeiro', () => {
  const c = cenario();
  c.ctx.abrirDialogo('#modal');
  c.b2.focus(); c.ctx.abrirDialogo('#modal');
  c.ctx.fecharDialogo('#modal');
  eq(c.doc.activeElement.id, 'gatilho');
});
teste('diálogo dentro do #app (drawer) prende o foco sem deixar a própria página inerte', () => {
  const c = cenario();
  const dr = c.app.add(c.el('dr', { cls: 'drawer open' })), d1 = dr.add(c.el('d1', { focavel: true }));
  c.ctx.abrirDialogo('#v-cad .drawer.open');
  eq(c.doc.activeElement.id, 'd1');
  eq(c.app.getAttribute('inert'), null, '#app não pode ficar inerte');
  c.ctx.fecharDialogo('#v-cad .drawer.open');
  eq(c.doc.activeElement.id, 'gatilho');
});
teste('foco já dentro do diálogo não é movido ao abrir', () => {
  const c = cenario();
  c.b2.focus();
  c.ctx.abrirDialogo('#modal');
  eq(c.doc.activeElement.id, 'b2');
});
teste('diálogo que sumiu da tela sem fechar (drawer salvo) não deixa o #app inerte para sempre', () => {
  const c = cenario();
  const dr = c.app.add(c.el('dr', { cls: 'drawer open' })); dr.add(c.el('d1', { focavel: true }));
  c.ctx.abrirDialogo('#v-cad .drawer.open');
  c.app.filhos.splice(c.app.filhos.indexOf(dr), 1); dr.pai = null; // renderCad redesenhou sem o drawer
  c.ctx.abrirDialogo('#modal'); c.ctx.fecharDialogo('#modal');
  eq(c.app.getAttribute('inert'), null);
});
teste('foco volta por seletor quando o botão de origem foi redesenhado', () => {
  const c = cenario();
  c.ctx.abrirDialogo('#modal', null, '#gatilho');
  c.app.filhos.splice(c.app.filhos.indexOf(c.gatilho), 1); c.gatilho.pai = null;
  const novo = c.app.add(c.el('gatilho', { focavel: true }));
  c.ctx.fecharDialogo('#modal');
  eq(c.doc.activeElement === novo, true);
});
teste('o drawer segue o estado no renderCad (abre e fecha o diálogo por qualquer caminho)', () => {
  const f = cliente.slice(cliente.indexOf('function renderCad('), cliente.indexOf('function abrirDrawer('));
  eq(f.indexOf("abrirDialogo('#v-cad .drawer.open'") > -1 && f.indexOf("fecharDialogo('#v-cad .drawer.open')") > -1, true);
});
teste('nenhum $(...).forEach no cliente ($ devolve um elemento só; lista é $$)', () => {
  const ruins = cliente.match(/[^$]\$\([^()]*\)\.forEach/g) || [];
  eq(ruins, []);
});
teste('o cliente usa o helper no modal, na busca, no aviso e no drawer', () => {
  ['abrirDialogo(\'#modal\'', 'abrirDialogo(\'#cmdk\'', 'abrirDialogo(\'#avisoTela\''].forEach((t) => eq(cliente.indexOf(t) > -1, true, t));
  eq(/S\.lastFocus/.test(cliente), false, 'S.lastFocus não é mais usado');
});

console.log('H12: erros do cadastro fora do rótulo, ligados ao campo');
teste('nenhum span de erro dentro de <label> no cadastro', () => {
  const cad = index.slice(index.indexOf('id="lgCad"'), index.indexOf('id="lgOk"'));
  const labels = cad.match(/<label[\s\S]*?<\/label>/g) || [];
  eq(labels.some((l) => /data-lg-err/.test(l)), false);
});
teste('cada campo aponta para o seu erro (aria-describedby)', () => {
  ['cdNome', 'cdCargo', 'cdOutro', 'cdHub', 'cdTurno', 'cdEmail'].forEach((id) => {
    const m = index.match(new RegExp('id="' + id + '"[^>]*aria-describedby="([^"]+)"'));
    eq(!!m, true, id + ' sem aria-describedby');
    eq(index.indexOf('id="' + m[1].split(' ')[0] + '"') > -1, true, 'alvo ' + m[1] + ' não existe');
  });
});
teste('mostrar erros marca aria-invalid e leva o foco ao primeiro campo', () => {
  const f = cliente.slice(cliente.indexOf('async function enviarCadastro'), cliente.indexOf('function falhaCarga'));
  eq(/aria-invalid/.test(f) && /\.focus\(\)/.test(f), true);
});

resumo();
