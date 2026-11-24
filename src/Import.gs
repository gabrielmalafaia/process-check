/* ============================================================
   Carga em massa (v8): colar a tabela do Excel numa caixa.
   Tudo ou nada: se qualquer linha tiver erro, NADA é gravado e o sistema informa a linha e a coluna.
   Pessoas e docas entram sempre no Hub do acesso (Hub ativo do Admin global, ou o Hub do Site Leader).
   Clusters são do catálogo global e não entram por aqui.
   ============================================================ */
const IMP_MAX_LINHAS = 500;
const IMP_MAX_CHARS = 100000;
const IMP_TIPOS = {
  pessoas: { aba: 'Cad_Pessoas', perm: 'cad_pessoas', cols: ['Nome', 'Cargo', 'Turno', 'Status_Ativo', 'Lider'], exemplo: [['Maria Souza', 'Líder', 'T1', 'Sim', ''], ['João Lima', 'Colaborador', 'T1', 'Sim', 'Maria Souza']] },
  docas: { aba: 'Cad_Estrutura', perm: 'cad_estrutura', cols: ['Tipo', 'Identificador', 'Cor_Simbolo', 'Lider_Padrao', 'Turno_Padrao'], exemplo: [['Doca', '01', 'Verde/Bolinha', 'Maria Souza', 'T1'], ['Doca', '02', 'Azul/Triângulo', '', '']] }
};
function impTipo_(tipo) {
  if (!Object.prototype.hasOwnProperty.call(IMP_TIPOS, tipo)) throw new Error('Tipo de carga inválido.');
  return IMP_TIPOS[tipo];
}
/** Modelo para o usuário copiar: cabeçalho e linhas de exemplo, separados por tabulação (cola direto no Excel). */
function importarModelo(tipo) {
  const t = impTipo_(String(tipo)), a = exigirPerm_(t.perm);
  return { cabecalho: t.cols.join('\t'), exemplo: t.exemplo.map(function (l) { return l.join('\t'); }).join('\n'), colunas: t.cols, hub: a.hubNome || '' };
}
function impLinhas_(texto) {
  const bruto = String(texto == null ? '' : texto);
  if (bruto.length > IMP_MAX_CHARS) throw new Error('Texto grande demais (máximo ' + IMP_MAX_CHARS + ' caracteres).');
  const ls = bruto.replace(/\r/g, '').split('\n').map(function (l, i) { return { n: i + 1, c: l.split('\t') }; }).filter(function (l) { return l.c.some(function (x) { return String(x).trim() !== ''; }); });
  if (ls.length > IMP_MAX_LINHAS + 1) throw new Error('Máximo de ' + IMP_MAX_LINHAS + ' linhas por carga.');
  return ls;
}
/** Valida a carga inteira sem gravar. Devolve { erros:[{linha,coluna,msg}], linhas:[objetos], resumo }. */
function impValidar_(tipo, texto, ator) {
  const t = impTipo_(tipo), ls = impLinhas_(texto), erros = [], out = [];
  if (!ls.length) return { erros: [{ linha: 0, coluna: '', msg: 'Cole a tabela do Excel na caixa.' }], linhas: [], resumo: {} };
  const cab = ls[0].c.map(function (x) { return String(x).trim(); });
  const temCab = cab.length >= 1 && cab[0].toLowerCase() === t.cols[0].toLowerCase();
  if (temCab && cab.join('|').toLowerCase().indexOf(t.cols.slice(0, cab.length).join('|').toLowerCase()) !== 0) erros.push({ linha: ls[0].n, coluna: '', msg: 'Cabeçalho diferente do modelo: ' + t.cols.join(', ') + '.' });
  const dados = temCab ? ls.slice(1) : ls;
  if (!dados.length) return { erros: [{ linha: ls[0].n, coluna: '', msg: 'Nenhuma linha de dados abaixo do cabeçalho.' }], linhas: [], resumo: {} };
  const existentes = lerDireto_(t.aba);
  const lideresExist = lerDireto_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return p.Nome; });
  const lideresLote = [];
  const objs = dados.map(function (l, idx) {
    const o = { _row: -(idx + 1) }, linhaN = l.n; // _row negativo e único: cada linha da carga é distinta das existentes
    if (l.c.length > t.cols.length) erros.push({ linha: linhaN, coluna: '', msg: 'Colunas demais: esperado ' + t.cols.length + ' (' + t.cols.join(', ') + ').' });
    t.cols.forEach(function (c, i) { const v = l.c[i] === undefined ? '' : String(l.c[i]).replace(/\s+/g, ' ').trim(); o[c] = v; });
    if (tipo === 'pessoas' && o.Cargo === 'Líder' && o.Status_Ativo !== 'Não' && o.Nome) lideresLote.push(o.Nome);
    o._n = linhaN;
    return o;
  });
  const lideres = lideresExist.concat(lideresLote);
  const aceitos = existentes.slice();
  objs.forEach(function (o) {
    if (tipo === 'docas') {
      if (o.Tipo === 'Cluster') { erros.push({ linha: o._n, coluna: 'Tipo', msg: 'Clusters são padrão para todos os Hubs e não entram por carga.' }); return; }
      if (!o.Tipo) o.Tipo = 'Doca';
    }
    if (tipo === 'pessoas' && o.Cargo === 'Líder') o.Lider = '';
    t.cols.forEach(function (c) {
      const v = o[c];
      if (v && (/[|;=<>]/.test(v) && c !== 'Cor_Simbolo' || /^[+\-@]/.test(v))) erros.push({ linha: o._n, coluna: c, msg: 'Não use os caracteres | ; = < > nem iniciar com + - @.' });
    });
    const e = validarCadastro_(t.aba, o, { todos: aceitos, lideres: lideres });
    // líder só inclui colaboradores do próprio time: mover pessoas entre times é com o Site Leader ou o Admin
    if (ator && tipo === 'pessoas' && ator.escopo.modo === 'time' && (o.Cargo !== 'Colaborador' || semAcento_(o.Lider) !== semAcento_(ator.nome))) e.Lider = 'Seu perfil só inclui colaboradores do seu próprio time.';
    Object.keys(e).forEach(function (c) { erros.push({ linha: o._n, coluna: c, msg: e[c] }); });
    if (!Object.keys(e).length) aceitos.push(o);
  });
  const resumo = { total: objs.length, novos: objs.length };
  return { erros: erros, linhas: objs, resumo: resumo, cols: t.cols, aba: t.aba };
}
function importarPrevia(tipo, texto) {
  const t = impTipo_(String(tipo)), a = exigirPerm_(t.perm);
  if (a.hubOn && !a.hub) throw new Error('Nenhum Hub ativo. Cadastre um Hub antes da carga.');
  const r = impValidar_(String(tipo), texto, a);
  return { ok: !r.erros.length, erros: r.erros.slice(0, 100), totalErros: r.erros.length, resumo: r.resumo, hub: a.hubNome || '', previa: r.linhas.slice(0, 20).map(function (o) { return r.cols.map(function (c) { return o[c]; }); }), cols: r.cols };
}
function importarConfirmar(tipo, texto) {
  const t = impTipo_(String(tipo)), a = exigirPerm_(t.perm);
  if (a.hubOn && !a.hub) throw new Error('Nenhum Hub ativo. Cadastre um Hub antes da carga.');
  return comLock_(function () {
    const r = impValidar_(String(tipo), texto, a);
    if (r.erros.length) return { ok: false, erros: r.erros.slice(0, 100), totalErros: r.erros.length, msg: 'Nada foi gravado. Corrija os erros indicados.' };
    const linhas = r.linhas.map(function (o) { return t.cols.map(function (c) { return limpar_(o[c]); }); });
    const hl = tipo === 'pessoas' ? histLote_(a, r.linhas) : 0;
    try { anexarLinhas_(t.aba, linhas); } catch (e) { histRevertido_(a, hl, e); throw e; }
    regSeguro_(a, 'Carga em massa', t.aba, linhas.length + ' linhas' + (a.hubNome ? ' no Hub ' + a.hubNome : ''));
    limparCache_();
    return { ok: true, gravados: linhas.length };
  });
}
