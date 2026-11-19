// Simulador mínimo de Google Apps Script + Sheets, para rodar o Code.gs REAL em Node.
process.env.TZ = 'UTC';
const vm = require('vm'), fs = require('fs');
const pad = (n, l = 2) => String(n).padStart(l, '0');

function criarSheet(nome) {
  const S = { nome, d: [[]], fmt: {}, maxC: 26, maxR: 1000 };
  const conv = (v, r, c) => {
    if (S.fmt[r + ',' + c] === '@') return v;
    if (typeof v === 'string') {
      if (/^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);                       // "36" vira 36, "01" vira 1
      if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(v.trim())) return new Date(v.trim().replace(' ', 'T') + (v.length === 10 ? 'T00:00:00' : '') + 'Z');
    }
    return v;
  };
  const get = (r, c) => (S.d[r - 1] && S.d[r - 1][c - 1] !== undefined ? S.d[r - 1][c - 1] : '');
  const set = (r, c, v) => {
    if (r > S.maxR || c > S.maxC) throw new Error('Range fora dos limites da planilha: ' + r + ',' + c);
    while (S.d.length < r) S.d.push([]);
    S.d[r - 1][c - 1] = v;
  };
  S.getName = () => nome;
  S.getLastRow = () => { let l = 0; S.d.forEach((row, i) => { if (row.some(x => x !== '' && x !== undefined)) l = i + 1; }); return l; };
  S.getLastColumn = () => { let l = 0; S.d.forEach(row => row.forEach((x, j) => { if (x !== '' && x !== undefined && j + 1 > l) l = j + 1; })); return l; };
  S.getMaxRows = () => S.maxR; S.getMaxColumns = () => S.maxC;
  S.insertRowsAfter = (_, n) => { S.maxR += n; }; S.insertColumnsAfter = (_, n) => { S.maxC += n; };
  S.setFrozenRows = () => S;
  S.appendRow = (arr) => { const r = S.getLastRow() + 1; if (r > S.maxR) S.maxR = r; arr.forEach((v, j) => set(r, j + 1, conv(v, r, j + 1))); };
  S.deleteRow = (r) => { S.d.splice(r - 1, 1); };
  S.deleteRows = (r, n) => { S.d.splice(r - 1, n); };
  S.insertRowBefore = (r) => { S.d.splice(r - 1, 0, []); S.maxR++; };
  S.getRange = (r, c, nr = 1, nc = 1) => {
    if (r < 1 || c < 1 || r + nr - 1 > S.maxR || c + nc - 1 > S.maxC) throw new Error('Coordenadas inválidas: ' + [r, c, nr, nc]);
    const R = {
      getValues: () => { global.__cells = (global.__cells || 0) + nr * nc; const o = []; for (let i = 0; i < nr; i++) { const l = []; for (let j = 0; j < nc; j++) l.push(get(r + i, c + j)); o.push(l); } return o; },
      setValues: (vs) => { if (vs.length !== nr || vs[0].length !== nc) throw new Error('Dimensões não conferem'); vs.forEach((row, i) => row.forEach((v, j) => set(r + i, c + j, conv(v, r + i, c + j)))); return R; },
      getValue: () => get(r, c),
      setValue: (v) => { set(r, c, conv(v, r, c)); return R; },
      setNumberFormat: (f) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) S.fmt[(r + i) + ',' + (c + j)] = f; return R; },
      setFontWeight: () => R, setBackground: () => R, setFontColor: () => R
    };
    return R;
  };
  S.getDataRange = () => S.getRange(1, 1, Math.max(S.getLastRow(), 1), Math.max(S.getLastColumn(), 1));
  return S;
}

function criarAmbiente(codePath) {
  const A = { email: 'owner@x.com', efetivo: 'owner@x.com', sheets: {}, cache: new Map(), emails: [], mailFalha: false, compart: { acc: 'PRIVATE', editors: [], viewers: [] } };
  const ss = {
    getSheetByName: n => A.sheets[n] || null,
    insertSheet: n => (A.sheets[n] = criarSheet(n)),
    getId: () => 'ID',
    getOwner: () => ({ getEmail: () => 'owner@x.com' }),
    getEditors: () => A.compart.editors.map(e => ({ getEmail: () => e })),
    getViewers: () => A.compart.viewers.map(e => ({ getEmail: () => e }))
  };
  const fmtData = (d, p) => p.replace('yyyy', d.getUTCFullYear()).replace('MM', pad(d.getUTCMonth() + 1)).replace('dd', pad(d.getUTCDate())).replace('HH', pad(d.getUTCHours())).replace('mm', pad(d.getUTCMinutes())).replace('ss', pad(d.getUTCSeconds()));
  const ctx = {
    console, Date, JSON, Math, Object, Array, String, Number, Error, RegExp, isNaN, parseInt, parseFloat,
    SpreadsheetApp: { getActive: () => ss,
      create: (nome) => { const id = 'ARQ' + (A.planilhasExtra = A.planilhasExtra || {}, Object.keys(A.planilhasExtra).length + 1); if (A.arquivoFalha) throw new Error('Sem autorização do Google'); A.planilhasExtra[id] = { sheets: {}, getId: () => id, getSheetByName: n => A.planilhasExtra[id].sheets[n] || null, insertSheet: n => (A.planilhasExtra[id].sheets[n] = criarSheet(n)) }; return A.planilhasExtra[id]; },
      openById: (id) => { if (!A.planilhasExtra || !A.planilhasExtra[id]) throw new Error('Planilha não encontrada'); return A.planilhasExtra[id]; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (A.props = A.props || {})[k] || null, setProperty: (k, v) => { (A.props = A.props || {})[k] = v; }, deleteProperty: k => { delete (A.props = A.props || {})[k]; } }) },
    Utilities: { formatDate: (d, tz, p) => fmtData(d, p) },
    Session: { getActiveUser: () => ({ getEmail: () => A.email }), getEffectiveUser: () => ({ getEmail: () => A.efetivo }), getScriptTimeZone: () => 'UTC' },
    CacheService: { getScriptCache: () => ({
      get: k => (A.cache.has(k) ? A.cache.get(k) : null),
      put: (k, v) => { if (String(v).length > 100000) throw new Error('Argument too large'); A.cache.set(k, String(v)); },
      remove: k => A.cache.delete(k), removeAll: ks => ks.forEach(k => A.cache.delete(k)),
      getAll: ks => { const o = {}; ks.forEach(k => { if (A.cache.has(k)) o[k] = A.cache.get(k); }); return o; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    HtmlService: { createTemplateFromFile: () => ({ evaluate: () => ({ setTitle() { return this; }, setXFrameOptionsMode() { return this; }, addMetaTag() { return this; } }) }), createHtmlOutputFromFile: n => ({ getContent: () => '<' + n + '>' }), XFrameOptionsMode: { ALLOWALL: 1 } },
    Logger: { log() {} },
    MailApp: { sendEmail: (m) => { if (A.mailFalha) throw new Error('Quota excedida'); if (A.mailFalhaPara && A.mailFalhaPara === m.to) throw new Error('Endereço recusado'); A.emails.push(JSON.parse(JSON.stringify(m))); }, getRemainingDailyQuota: () => (A.cota === undefined ? 100 : A.cota) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/a/macros/x.com/s/ABC/exec' }),
      getProjectTriggers: () => (A.triggers = A.triggers || []).slice(),
      deleteTrigger: t => { A.triggers = (A.triggers || []).filter(x => x !== t); },
      newTrigger: fn => ({ timeBased() { return this; }, everyDays() { return this; }, atHour() { return this; }, create() { const t = { getHandlerFunction: () => fn }; (A.triggers = A.triggers || []).push(t); return t; } }) },
    DriveApp: { getFileById: () => ({
      getOwner: () => ({ getEmail: () => 'owner@x.com' }),
      getEditors: () => A.compart.editors.map(e => ({ getEmail: () => e })),
      getViewers: () => A.compart.viewers.map(e => ({ getEmail: () => e })),
      getSharingAccess: () => A.compart.acc }) }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx, { filename: 'Code.gs' });
  // demais arquivos .gs do projeto (Hubs, Log, Online...): no Apps Script todos compartilham o mesmo escopo global
  const dir = require('path').dirname(codePath);
  fs.readdirSync(dir).filter(f => /\.gs$/.test(f) && f !== 'Code.gs').sort().forEach(f => vm.runInContext(fs.readFileSync(require('path').join(dir, f), 'utf8'), ctx, { filename: f }));
  A.ctx = ctx;
  A.run = (src) => vm.runInContext(src, ctx);
  A.as = (email) => { A.email = email; };
  A.J = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
  A.call = (fn, ...args) => {
    if (!process.env.PC_SRV) return A.J(ctx[fn](...args));
    const SRV = (global.__SRV = global.__SRV || new Set());
    if (!global.__SRVSAVE) { global.__SRVSAVE = 1; process.on('exit', () => require('fs').writeFileSync(process.env.PC_SRV, JSON.stringify([...global.__SRV].sort()))); }
    const walk = (v) => { if (typeof v === 'string') { if (v.length > 2 && v.length < 600) SRV.add(v); } else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k])); };
    try { const r = A.J(ctx[fn](...args)); walk(r); return r; } catch (e) { walk(String(e.message)); throw e; }
  };
  A.hist = () => A.sheets.Auditorias_Historico;
  return A;
}
module.exports = { criarAmbiente };
