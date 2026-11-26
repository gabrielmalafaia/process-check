/* Simulador mínimo do Apps Script para testar o servidor em Node: planilha em memória, cache, lock, propriedades e sessão. */
// No Apps Script, formatar e ler datas seguem o fuso do script; aqui os dois seguem UTC (o formatDate simulado usa UTC)
process.env.TZ = 'UTC';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// todos os .gs da pasta do projeto (Code.gs primeiro, como no Apps Script); orig/ e antes-da-divisao/ ficam de fora
const ARQUIVOS = fs.readdirSync(path.join(__dirname, '..', '..', 'src')).filter((f) => /\.gs$/.test(f)).sort((a, b) => (a === 'Code.gs' ? -1 : b === 'Code.gs' ? 1 : a.localeCompare(b)));

function planilhaFalsa(nome, dados) {
  const linhas = dados; // matriz: linha 0 = cabeçalho
  const largura = () => Math.max(1, ...linhas.map((l) => l.length));
  // custo: quantas chamadas à planilha cada operação faz (e quantas células lê)
  const stats = { getRange: 0, getDataRange: 0, getRangeList: 0, setNumberFormat: 0, celulasLidas: 0 };
  const celula = (r, c) => (linhas[r - 1] && linhas[r - 1][c - 1] !== undefined ? linhas[r - 1][c - 1] : '');
  const faixa = (r, c, nr = 1, nc = 1) => ({
    getValues: () => (stats.celulasLidas += nr * nc, 0) || Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => celula(r + i, c + j))),
    getValue: () => celula(r, c),
    setValues: (v) => { v.forEach((l, i) => { linhas[r - 1 + i] = linhas[r - 1 + i] || []; l.forEach((x, j) => { linhas[r - 1 + i][c - 1 + j] = x; }); }); return faixa(r, c, nr, nc); },
    setValue: (x) => faixa(r, c).setValues([[x]]),
    setNumberFormat: () => { stats.setNumberFormat++; return faixa(r, c, nr, nc); },
    setFontWeight: () => faixa(r, c, nr, nc), setBackground: () => faixa(r, c, nr, nc), setFontColor: () => faixa(r, c, nr, nc),
  });
  return {
    nome,
    linhas,
    stats,
    getName: () => nome,
    getLastRow: () => linhas.length,
    getLastColumn: () => largura(),
    getMaxColumns: () => Math.max(26, largura()),
    getMaxRows: () => Math.max(1000, linhas.length),
    getRange: (...a) => { stats.getRange++; return faixa(...a); },
    getDataRange: () => { stats.getDataRange++; return faixa(1, 1, linhas.length, largura()); },
    getRangeList: (a1s) => { stats.getRangeList++; return { setNumberFormat: () => { stats.setNumberFormat++; } }; },
    deleteRow: (r) => { linhas.splice(r - 1, 1); },
    insertRowsAfter: () => {},
    insertRowBefore: (r) => { linhas.splice(r - 1, 0, []); },
    appendRow: (l) => { linhas.push(l.slice()); },
    setFrozenRows: () => {},
    insertColumnsAfter: () => {},
  };
}

function criarAmbiente(opcoes = {}) {
  const abas = {};
  const cache = new Map();
  const props = new Map(Object.entries(opcoes.props || {}));
  const sessao = { ativo: opcoes.ativo !== undefined ? opcoes.ativo : 'admin@x.com', efetivo: opcoes.efetivo || opcoes.ativo || 'admin@x.com' };
  const enviados = [], eventos = [], gatilhos = (opcoes.gatilhos || []).map((h) => ({ getHandlerFunction: () => h }));
  const ss = {
    getSheetByName: (n) => abas[n] || null,
    insertSheet: (n) => (abas[n] = planilhaFalsa(n, [])),
    getId: () => 'ss1',
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    SpreadsheetApp: { getActive: () => ss, getActiveSpreadsheet: () => ss },
    CacheService: { getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => { cache.set(k, v); },
      remove: (k) => { cache.delete(k); },
      removeAll: (ks) => ks.forEach((k) => cache.delete(k)),
      getAll: (ks) => Object.fromEntries(ks.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])),
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => { props.set(k, String(v)); },
      deleteProperty: (k) => { props.delete(k); },
    }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => sessao.ativo }),
      getEffectiveUser: () => ({ getEmail: () => sessao.efetivo }),
      getScriptTimeZone: () => 'UTC',
    },
    Utilities: {
      sleep: () => {},
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(String(s), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      formatDate: (d, tz, f) => {
        const i = d.toISOString();
        if (f === 'H') return String(opcoes.hora !== undefined ? opcoes.hora : d.getUTCHours());
        return f === 'yyyy-MM-dd' ? i.slice(0, 10) : i.slice(0, 10) + ' ' + i.slice(11, 19);
      },
    },
    HtmlService: {},
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (m) => { enviados.push(m); if (opcoes.mailFalha && opcoes.mailFalha(m)) throw new Error('e-mail recusado'); } },
    ScriptApp: {
      // gatilhos simulados: lista viva, criação e exclusão registradas em ordem
      getProjectTriggers: () => gatilhos.slice(),
      deleteTrigger: (t) => { eventos.push('apaga:' + t.getHandlerFunction()); gatilhos.splice(gatilhos.indexOf(t), 1); },
      newTrigger: (h) => {
        const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => {
          if (opcoes.gatilhoFalha) throw new Error('limite de gatilhos');
          const t = { getHandlerFunction: () => h }; gatilhos.push(t); eventos.push('cria:' + h); return t;
        } };
        return b;
      },
    },
  };
  vm.createContext(ctx);
  const raiz = path.join(__dirname, '..', '..', 'src');
  const codigo = ARQUIVOS.map((f) => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n;\n');
  vm.runInContext(codigo, ctx, { filename: 'servidor.gs' });
  const run = (expr) => vm.runInContext(expr, ctx);
  // cria todas as abas do esquema com o cabeçalho de ABAS
  const cab = run('ABAS');
  Object.keys(cab).forEach((n) => { abas[n] = planilhaFalsa(n, [cab[n].slice()]); });
  return {
    ctx, run, abas, cache, props, sessao, enviados, eventos, gatilhos,
    linhas: (n, ls) => { ls.forEach((l) => abas[n].linhas.push(l)); },
    set: (nome, valor) => { ctx.__v = valor; vm.runInContext(nome + ' = __v', ctx); },
    /** Simula falha de gravação na aba (ex.: log indisponível): qualquer escrita lança erro; leituras seguem. */
    quebrar: (n, op = {}) => {
      // op.vezes: só as N primeiras escritas de valores falham (depois volta ao normal); op.depois: grava e então lança (falha parcial)
      const s = abas[n], orig = s.getRange;
      let restam = op.vezes || Infinity;
      const falha = () => { throw new Error('falha simulada em ' + n); };
      const talvez = (fn) => (...a) => { if (restam <= 0) return fn(...a); restam--; if (op.depois) fn(...a); falha(); };
      s.getRange = (...a) => { const f = orig(...a); return Object.assign({}, f, { setValues: talvez(f.setValues), setValue: talvez(f.setValue), setNumberFormat: op.vezes ? f.setNumberFormat : falha }); };
      if (!op.vezes) { s.deleteRow = falha; s.insertRowBefore = falha; s.appendRow = falha; }
    },
    /** Monta uma linha na ordem do cabeçalho da aba a partir de um objeto. */
    linha: (n, o) => run('ABAS')[n].map((c) => (o[c] === undefined ? '' : o[c])),
  };
}

let falhas = 0, total = 0;
function teste(nome, fn) {
  total++;
  try { fn(); console.log('  ok   ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + '\n        ' + (e && e.message)); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'diferente') + ': esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }
function lanca(fn, re) {
  try { fn(); } catch (e) { if (re && !re.test(String(e && e.message))) throw new Error('erro inesperado: ' + e.message); return; }
  throw new Error('deveria lançar erro');
}
function resumo() { console.log('\n' + (total - falhas) + '/' + total + ' passaram'); process.exitCode = falhas ? 1 : 0; }

module.exports = { criarAmbiente, teste, eq, lanca, resumo };
