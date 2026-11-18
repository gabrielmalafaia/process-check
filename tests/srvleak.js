// Verifica se textos devolvidos pelo servidor (mensagens, insights, rótulos) têm tradução no dicionário.
const fs = require('fs'), vm = require('vm');
const src = fs.readdirSync(require('path').join(__dirname, '..', 'client', 'parts')).filter(f => /^i18n_\d+\.js$/.test(f)).sort().map(f => fs.readFileSync(require('path').join(__dirname, '..', 'client', 'parts', f), 'utf8')).join('\n') + '\n' + fs.readFileSync(require('path').join(__dirname, '..', 'client', 'parts', 'p0.js'), 'utf8').split('function traduzirNo')[0] + '\n;globalThis.__tr=(l,s)=>{LANG=l;return tr(s)}';
const ctx = vm.createContext({ document: {}, localStorage: {}, console }); vm.runInContext(src, ctx);
const set = new Set(); process.argv.slice(2).forEach(f => JSON.parse(fs.readFileSync(f, 'utf8')).forEach(x => set.add(x)));
const PT = /[ãõçáéíóúâêôà]|\b(não|você|seu|sua|uma|está|com|em|ou|sem|nenhum[a]?|ao|para|por|dos|das|pela|pelo|ainda|apenas|pode|são|foi|ser|de|do|da|os|as|no|na|um)\b/i;
const IGN = /^[\w .@:+\-\/|,;()%·—'"\[\]{}#=<>*?!&$]*$/, DAD = /@x\.com|Recebimento|Expedição|Indução|Separação|Compra|Sorting|Sub\d|Lider|Souza|Lima|Reis|Nunes|Fabio|Joana|Zeca|Chefe/i;
const falta = [];
for (const s of [...set]) {
  if (!PT.test(s) || DAD.test(s)) continue;
  const en = ctx.__tr('en', s), es = ctx.__tr('es', s);
  if (en === s) falta.push(s);
}
console.log(set.size, 'textos do servidor;', falta.length, 'sem tradução');
falta.slice(0, 150).forEach(x => console.log('  ' + x.slice(0, 220)));
