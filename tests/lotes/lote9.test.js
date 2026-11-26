/* Lote 9 (desempenho percebido): Chart.js sob demanda, debounce nas buscas, ordenação otimista,
   menu sem redesenho inútil e medição das operações lentas no servidor. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { criarAmbiente, teste, eq, lanca, resumo } = require('./harness');

const RAIZ = path.join(__dirname, '..', '..', 'src');
const JS = fs.readFileSync(path.join(RAIZ, 'JS_Client.html'), 'utf8');
const INDEX = fs.readFileSync(path.join(RAIZ, 'Index.html'), 'utf8');
function funcao(nome) {
  const i = JS.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('função ' + nome + ' não encontrada');
  let n = 0, j = JS.indexOf('{', i);
  for (; j < JS.length; j++) { if (JS[j] === '{') n++; else if (JS[j] === '}' && --n === 0) break; }
  return JS.slice(i, j + 1);
}

console.log('Servidor: operações lentas medidas');
function comAvisos() {
  const env = criarAmbiente();
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '']]);
  const avisos = [];
  env.ctx.console.warn = (m) => avisos.push(String(m));
  return { env, avisos };
}
teste('operação acima do limite gera um aviso estruturado (operação, duração), sem dado pessoal', () => {
  const { env, avisos } = comAvisos();
  env.run('var __t = 0; Date.now = function () { return (__t += 5000); }');
  env.run("medir_('relatorio', function () { return 1; }, [])");
  eq(avisos.length, 1);
  const o = JSON.parse(avisos[0]);
  eq([o.evento, o.op, o.ms >= env.run('LENTO_MS')], ['operacao_lenta', 'relatorio', true]);
  eq(avisos[0].indexOf('admin@x.com'), -1, 'sem e-mail no aviso');
});
teste('operação rápida não gera aviso', () => {
  const { env, avisos } = comAvisos();
  env.run("medir_('relatorio', function () { return 1; }, [])");
  eq(avisos.length, 0);
});
teste('erro dentro da operação é relançado e a duração é registrada mesmo assim', () => {
  const { env, avisos } = comAvisos();
  env.run('var __t = 0; Date.now = function () { return (__t += 5000); }');
  lanca(() => env.run("medir_('x', function () { throw new Error('boom'); }, [])"), /boom/);
  eq(JSON.parse(avisos[0]).erro, true);
});
teste('as funções públicas pesadas passam pela medição e mantêm o resultado', () => {
  const src = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.gs')).map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
  ['bootstrap', 'relatorio', 'getMatriz', 'salvarAuditoria', 'listarFeedbacks', 'meusFeedbacks', 'pulso'].forEach((n) => {
    const re = new RegExp('function ' + n + '\\(([^)]*)\\) \\{ return medir_\\(\'' + n + '\', ' + n + 'Core_, arguments\\); \\}');
    eq(re.test(src), true, n);
  });
  const { env } = comAvisos();
  eq(Array.isArray(env.run('meusFeedbacks()')), true);
});

console.log('Cliente: Chart.js sob demanda');
teste('o Index não carrega mais o Chart.js na abertura', () => {
  eq(/chart\.umd\.js/.test(INDEX), false);
});
function ambienteChart() {
  const criados = [];
  const ctx = { window: {}, document: { head: { appendChild: (s) => { criados.push(s); } }, createElement: () => ({}) }, Promise };
  vm.createContext(ctx);
  vm.runInContext(JS.match(/const CHART_SRC[^\n]*\n/)[0] + JS.match(/const CHART_SRI[^\n]*\n/)[0] + funcao('carregarChart'), ctx);
  return { ctx, criados };
}
teste('carregarChart: um script só, mesmo hash SRI do original, crossorigin anônimo', () => {
  const { ctx, criados } = ambienteChart();
  ctx.carregarChart(); ctx.carregarChart();
  eq(criados.length, 1);
  eq([criados[0].src, criados[0].integrity, criados[0].crossOrigin, criados[0].async], ['https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js', 'sha256-dEAdc43T4D7l37O2hBIQ/ixOrYqWDEARykugt4qf2PM=', 'anonymous', true]);
});
teste('carregarChart: falha no CDN permite tentar de novo depois', () => {
  const { ctx, criados } = ambienteChart();
  ctx.carregarChart().catch(() => {}); criados[0].onerror();
  ctx.carregarChart().catch(() => {});
  eq(criados.length, 2);
});
teste('mkChart pede a biblioteca quando ela ainda não está carregada', () => {
  eq(/carregarChart\(\)\.then/.test(funcao('mkChart')), true);
});

console.log('Cliente: debounce nas buscas');
teste('adiar: várias chamadas seguidas executam uma vez, com o último valor', () => {
  const timers = [], vistos = [];
  const ctx = { __v: vistos, setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: (i) => { timers[i - 1] = null; } };
  vm.createContext(ctx);
  vm.runInContext(funcao('adiar'), ctx);
  vm.runInContext("var f = adiar(function (x) { __v.push(x); }, 200); f('a'); f('ab'); f('abc')", ctx);
  timers.filter(Boolean).forEach((t) => t());
  eq(vistos, ['abc']);
});
teste('a busca das tabelas e a busca de cadastros usam o debounce', () => {
  eq(/data-busca[\s\S]{0,400}adiar\(/.test(JS), true, 'busca das tabelas');
  eq(/cBusca[^\n]*listaCadAdiada\(\)/.test(JS) && /const listaCadAdiada = adiar\(/.test(JS), true, 'busca de cadastros');
});

console.log('Cliente: ordenação otimista');
function troca(linhas, row, dir) {
  const ctx = { __l: linhas }; vm.createContext(ctx);
  vm.runInContext(funcao('trocarVizinho'), ctx);
  return vm.runInContext('trocarVizinho(__l, ' + row + ', ' + dir + ')', ctx);
}
const L = [{ _row: 2, Processo: 'A', ID: 'a1' }, { _row: 3, Processo: 'A', ID: 'a2' }, { _row: 4, Processo: 'B', ID: 'b1' }];
teste('troca com o vizinho do mesmo processo, sem mexer na lista original', () => {
  const r = troca(L, 2, 1);
  eq(r.map((x) => [x._row, x.ID]), [[2, 'a2'], [3, 'a1'], [4, 'b1']]);
  eq(L.map((x) => x.ID), ['a1', 'a2', 'b1'], 'original intacta');
});
teste('não troca com item de outro processo nem além do início (devolve null)', () => {
  eq(troca(L, 3, 1), null);
  eq(troca(L, 2, -1), null);
});
teste('moverCad desenha antes de o servidor responder e volta atrás se ele recusar', () => {
  const f = funcao('moverCad');
  eq(/trocarVizinho\(/.test(f), true, 'troca local');
  eq(f.indexOf('renderCad()') < f.indexOf("rpc('moverCadastro'"), true, 'desenha antes da chamada');
  eq(/S\.db\[aba\] = antes/.test(f), true, 'desfaz na recusa ou erro');
});

console.log('Cliente: menu sem redesenho inútil');
teste('renderNav só troca o HTML do menu quando ele mudou', () => {
  eq(/if \(h !== S\.navHtml\) \{ S\.navHtml = h; \$\('#nav'\)\.innerHTML = h; \}/.test(funcao('renderNav')), true);
});

resumo();
