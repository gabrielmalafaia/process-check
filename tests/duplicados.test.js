// Falha se um const/let/var/function de nivel superior aparecer em mais de um .gs
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src');
const vistos = {}; let erros = 0;
fs.readdirSync(dir).filter(f => f.endsWith('.gs')).forEach(f => {
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => {
    const m = /^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/.exec(l);
    if (!m) return;
    if (vistos[m[1]]) { erros++; console.log('FALH duplicado: ' + m[1] + ' em ' + vistos[m[1]] + ' e ' + f + ':' + (i + 1)); }
    else vistos[m[1]] = f + ':' + (i + 1);
  });
});
console.log(erros ? 'FALH: ' + erros + ' duplicado(s)' : 'ok: sem declaracoes duplicadas entre .gs');
process.exit(erros ? 1 : 0);
