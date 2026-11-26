/* ============================================================
   Cadastros (pessoas, estrutura, perguntas) e configurações.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ---------- cadastros e configurações ---------- */
function validarCadastro_(aba, o, extra) {
  const e = {}, campos = ABAS[aba];
  OBRIG[aba].forEach(function (c) { if (vazio_(o[c])) e[c] = 'Campo obrigatório.'; });
  campos.forEach(function (c) {
    if (!e[c] && ENUMS[c] && !vazio_(o[c]) && ENUMS[c].indexOf(String(o[c]).trim()) < 0) e[c] = 'Valor inválido.';
    if (!e[c] && String(o[c] == null ? '' : o[c]).length > (MAXLEN[c] || 120)) e[c] = 'Máximo de ' + (MAXLEN[c] || 120) + ' caracteres.';
  });
  ['Identificador', 'Nome', 'ID_Subprocesso'].forEach(function (c) { if (!e[c] && /^(__proto__|constructor|prototype)$/i.test(String(o[c] == null ? '' : o[c]).trim())) e[c] = 'Nome reservado pelo sistema.'; });
  const todos = (extra && extra.todos ? extra.todos : lerDireto_(aba)).filter(function (x) { return x._row !== o._row; });
  const lideres = extra && extra.lideres ? extra.lideres : lerDireto_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return p.Nome; });
  const igual = function (x, y) { return semAcento_(String(x).trim()).replace(/\s+/g, ' ') === semAcento_(String(y).trim()).replace(/\s+/g, ' '); }; // sem acento, caixa nem espaço duplo: é como o sistema liga líder e time
  if (aba === 'Cad_Estrutura') {
    if (!e.Cor_Simbolo) {
      const cs = canonCS_(o.Cor_Simbolo);
      if (!cs) e.Cor_Simbolo = 'Escolha a cor e o símbolo da lista.'; else o.Cor_Simbolo = cs;
    }
    if (!e.Identificador && todos.some(function (x) { return x.Tipo === o.Tipo && igual(x.Identificador, o.Identificador); })) e.Identificador = 'Já existe ' + (o.Tipo === 'Doca' ? 'uma doca' : 'um cluster') + ' com este identificador.';
    if (!vazio_(o.Lider_Padrao) && lideres.indexOf(o.Lider_Padrao) < 0) e.Lider_Padrao = 'Líder não cadastrado ou inativo.';
  }
  if (aba === 'Cad_Pessoas') {
    if (!e.Nome && /[;|]/.test(o.Nome)) e.Nome = 'O nome não pode conter ; ou |.';
    if (!e.Nome && todos.some(function (x) { return igual(x.Nome, o.Nome); })) e.Nome = 'Já existe uma pessoa com este nome.';
    if (o.Cargo === 'Colaborador') {
      if (vazio_(o.Lider)) e.Lider = 'Informe o líder do colaborador.';
      else if (lideres.indexOf(o.Lider) < 0) e.Lider = 'Líder não cadastrado ou inativo.';
    }
  }
  if (aba === 'Cad_Processos_Perguntas' && !e.Descricao_Item && !e.Processo &&
    todos.some(function (x) { return x.Processo === o.Processo && igual(x.Descricao_Item, o.Descricao_Item); })) e.Descricao_Item = 'Este item já existe neste processo.';
  return e;
}
/** Colunas que o navegador enxerga e edita (sem a coluna Hub das abas por Hub, que só o servidor grava). */
function colsDados_(aba) { return HUB_ABAS[aba] ? ABAS[aba].filter(function (c) { return c !== 'Hub'; }) : ABAS[aba]; }
function confere_(aba, row, orig) {
  if (!orig) return false;
  const s = aba_(aba), cols = colsDados_(aba);
  if (row < 2 || row > s.getLastRow()) return false;
  const v = s.getRange(row, 1, 1, cols.length).getValues()[0];
  if (HUB_ABAS[aba] && hubsAtivos_()) {
    const cel = String(s.getRange(row, HUB_ABAS[aba]).getValue()).trim(), h = hubAtual_();
    if (!h || !(cel === h || (aba === 'Cad_Estrutura' && String(v[0]) === 'Cluster' && cel === HUB_GLOBAL))) return false; // linha de outro Hub (ou sem Hub): nunca confere
  }
  return cols.every(function (c, i) { return String(v[i]) === String(orig[c] === undefined ? '' : orig[c]); });
}
/** Com o isolamento ligado, catálogos globais (perguntas, configurações, clusters) só mudam pelo Admin global. */
function exigirGlobal_(a, o) {
  if (a.hubOn && !a.hubGlobal) throw new Error('Este cadastro é padrão para todos os Hubs e só o Admin global pode alterá-lo.' + (o ? ' ' + o : ''));
}
function ehCluster_(aba, o) { return aba === 'Cad_Estrutura' && !!o && String(o.Tipo == null ? '' : o.Tipo).trim() === 'Cluster'; }
/** Troca a referência na coluna (só no Hub atual). Devolve a função que desfaz a troca (para gravarComDesfazer_). */
function renomearRef_(aba, coluna, de, para) {
  const s = aba_(aba), nada = function () {};
  if (s.getLastRow() < 2) return nada;
  const n = s.getLastRow() - 1, r = s.getRange(2, coluna, n, 1), v = r.getValues(), antes = v.map(function (l) { return [l[0]]; });
  const iso = HUB_ABAS[aba] && hubsAtivos_(), hv = iso ? s.getRange(2, HUB_ABAS[aba], n, 1).getValues() : null;
  let mudou = false;
  v.forEach(function (l, i) { if (l[0] === de && (!iso || String(hv[i][0]).trim() === hubAtual_())) { l[0] = para; mudou = true; } }); // só no Hub atual
  if (!mudou) return nada;
  r.setValues(v);
  return function () { s.getRange(2, coluna, n, 1).setValues(antes); };
}
/** Feedback imediato: só quem tem "obrigacoes" (Site Leader e Admin) vê e define a marcação da pergunta. Os outros recebem a pergunta sem ela. */
function podeImediato_(a) { return tem_(a, 'obrigacoes'); }
function perguntasVisiveis_(a, linhas) {
  if (podeImediato_(a)) return linhas;
  return linhas.map(function (x) { const o = Object.assign({}, x); delete o.Feedback_Imediato; return o; });
}
function cadastroVisivel_(a, aba, linhas) { return aba === 'Cad_Processos_Perguntas' ? perguntasVisiveis_(a, linhas) : linhas; }
/** Quem não recebe a marcação manda um "orig" sem ela: completa com o valor da planilha para a conferência de versão (que compara todas as colunas).
    Chamar dentro da trava. Sem isso a pessoa não consegue salvar, mover nem excluir uma pergunta marcada (e a falha revelaria quais são). */
function origComMarcacao_(a, aba, row, orig) {
  if (aba !== 'Cad_Processos_Perguntas' || podeImediato_(a) || !orig) return orig;
  const s = aba_(aba); if (!(row >= 2 && row <= s.getLastRow())) return orig;
  const v = linhaAtual_(aba, row)[ABAS[aba].indexOf('Feedback_Imediato')];
  return Object.assign({}, orig, { Feedback_Imediato: v == null ? '' : String(v) });
}
function listarCadastro(aba) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  const a = exigirPerm_(PERM_CAD[aba]);
  return cadastroVisivel_(a, aba, lerDireto_(aba));
}
function salvarCadastro(aba, obj, orig) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  const ag = exigirPerm_(PERM_CAD[aba]);
  if (aba === 'Cad_Processos_Perguntas' || ehCluster_(aba, obj) || ehCluster_(aba, orig)) exigirGlobal_(ag);
  if (COLS_NOVAS[aba]) garantirAba_(aba); // planilha ainda sem as colunas de tradução: completa o cabeçalho antes de gravar
  obj = obj || {};
  const o = { _row: obj._row ? Number(obj._row) : 0 };
  colsDados_(aba).forEach(function (c) { o[c] = obj[c] === undefined || obj[c] === null ? '' : (typeof obj[c] === 'string' ? obj[c].trim() : obj[c]); });
  if (aba === 'Cad_Pessoas' && o.Cargo === 'Líder') o.Lider = '';
  if (aba === 'Cad_Pessoas') { const m = travaLiderPessoas_(ag, o._row ? orig : null, o); if (m) return { ok: false, erros: { Lider: m } }; }
  if (hubsAtivos_() && ehCluster_(aba, o)) { o.Lider_Padrao = ''; o.Turno_Padrao = ''; } // cluster é global: não carrega o líder ou turno de um Hub
  // feedback imediato: quem não pode definir não muda a marcação (o valor da planilha é mantido, lido dentro da trava)
  const imedOculto = aba === 'Cad_Processos_Perguntas' && !podeImediato_(ag);
  if (imedOculto && obj.Feedback_Imediato !== undefined && String(obj.Feedback_Imediato == null ? '' : obj.Feedback_Imediato).trim() !== String(orig && orig.Feedback_Imediato != null ? orig.Feedback_Imediato : '').trim()) {
    return { ok: false, erros: { Feedback_Imediato: 'Só o Site Leader ou o Admin define o feedback imediato.' } };
  }
  return comLock_(function () {
    if (imedOculto) { orig = origComMarcacao_(ag, aba, o._row, orig); o.Feedback_Imediato = o._row && orig && orig.Feedback_Imediato != null ? orig.Feedback_Imediato : ''; }
    const erros = validarCadastro_(aba, o);
    if (Object.keys(erros).length) return { ok: false, erros: erros };
    if (o._row && !confere_(aba, o._row, orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    const linha = colsDados_(aba).map(function (c) { return limpar_(o[c]); });
    const s = aba_(aba);
    // renomear um líder grava em até 4 abas: se qualquer passo falhar, todos os anteriores são desfeitos
    gravarComDesfazer_(ag, 'salvar cadastro', function (desfaz) {
      const hl = aba === 'Cad_Pessoas' ? histCadastro_(ag, o._row ? 'Alterado' : 'Criado', o._row ? orig : null, o, o._row && orig.Cargo === 'Líder' && orig.Nome !== linha[0] ? orig.Nome : '') : [];
      // "Revertido" só entra no histórico se a reversão inteira deu certo (o histórico nunca afirma o que não aconteceu)
      if (hl.length) desfaz(function (ok) { if (ok) histRevertido_(ag, hl, new Error('alteração desfeita')); });
      if (!o._row) { anexarDesfazivel_(desfaz, aba, linha); return; }
      const linhaAntes = linhaAtual_(aba, o._row);
      desfaz(function () { restaurarLinha_(aba, o._row, linhaAntes); });
      (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(o._row, c).setNumberFormat('@'); });
      s.getRange(o._row, 1, 1, linha.length).setValues([linha]);
      // trocar o Tipo (Doca/Cluster) muda o dono da linha: cluster é global, doca é do Hub atual
      if (HUB_ABAS[aba] && hubsAtivos_()) s.getRange(o._row, HUB_ABAS[aba]).setNumberFormat('@').setValue(ehCluster_(aba, o) ? HUB_GLOBAL : hubAtual_());
      if (aba === 'Cad_Pessoas' && orig.Cargo === 'Líder' && orig.Nome !== linha[0]) {
        desfaz(renomearRef_('Cad_Pessoas', 5, orig.Nome, linha[0]));
        desfaz(renomearRef_('Cad_Estrutura', 4, orig.Nome, linha[0]));
        desfaz(renomearTimeRegras_(orig.Nome, linha[0]));
      }
    });
    logAtiv_(ag, o._row ? 'Cadastro alterado' : 'Cadastro criado', aba, String(linha[0]) + ' ' + String(linha[1] === undefined ? '' : linha[1]));
    limparCache_();
    return { ok: true, linhas: cadastroVisivel_(ag, aba, lerDireto_(aba)) };
  });
}
/** Líder com permissão de cadastro só mexe em colaboradores do próprio time e nunca muda time, turno nem cargo (isso é do Site Leader/Admin). Vale para salvar, restaurar e excluir. */
function travaLiderPessoas_(ag, orig, novo) {
  if (ag.escopo.modo !== 'time') return '';
  const eu = semAcento_(ag.nome), MSG = 'Seu perfil só altera colaboradores do seu próprio time e não muda time, turno nem cargo. Fale com o Site Leader.';
  const proprio = function (x) { return x.Cargo === 'Colaborador' && semAcento_(x.Lider) === eu; };
  if ((orig && !proprio(orig)) || (novo && !proprio(novo)) || (orig && novo && orig.Turno !== novo.Turno)) return MSG;
  return '';
}
function excluirCadastro(aba, row, orig) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  const ag = exigirPerm_(PERM_CAD[aba]);
  if (aba === 'Cad_Processos_Perguntas' || ehCluster_(aba, orig)) exigirGlobal_(ag);
  return comLock_(function () {
    orig = origComMarcacao_(ag, aba, Number(row), orig);
    if (!confere_(aba, Number(row), orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    if (aba === 'Cad_Pessoas') { const m = travaLiderPessoas_(ag, orig, null); if (m) return { ok: false, msg: m }; }
    if (aba === 'Cad_Pessoas' && orig.Cargo === 'Líder') {
      const n = lerDireto_('Cad_Pessoas').filter(function (p) { return p.Lider === orig.Nome; }).length;
      if (n) return { ok: false, msg: 'Não é possível excluir: ' + n + ' colaborador(es) vinculado(s) a este líder. Reatribua-os antes.' };
    }
    const hl = aba === 'Cad_Pessoas' ? histCadastro_(ag, 'Excluído', orig, null, '') : 0;
    try { aba_(aba).deleteRow(Number(row)); } catch (e) { histRevertido_(ag, hl, e); throw e; }
    logAtiv_(ag, 'Cadastro excluído', aba, String(orig[ABAS[aba][0]]) + ' ' + String(orig[ABAS[aba][1]] === undefined ? '' : orig[ABAS[aba][1]]));
    limparCache_();
    return { ok: true, linhas: cadastroVisivel_(ag, aba, lerDireto_(aba)) };
  });
}
/** Troca de lugar com o item vizinho do mesmo processo (ordem do formulário). dir: -1 sobe, +1 desce. */
function moverCadastro(aba, row, orig, dir) {
  if (aba !== 'Cad_Processos_Perguntas') throw new Error('Aba inválida.');
  const ag = exigirPerm_(PERM_CAD[aba]);
  exigirGlobal_(ag);
  const r = Number(row), d = Number(dir) < 0 ? -1 : 1;
  return comLock_(function () {
    orig = origComMarcacao_(ag, aba, r, orig);
    if (!confere_(aba, r, orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    const todos = lerDireto_(aba), a = todos.find(function (x) { return x._row === r; }), b = todos.find(function (x) { return x._row === r + d; });
    if (!b || b.Processo !== a.Processo) return { ok: true, linhas: cadastroVisivel_(ag, aba, todos) };
    const s = aba_(aba), n = colsDados_(aba).length, topo = Math.min(r, r + d);
    const lin = function (x) { return colsDados_(aba).map(function (c) { return limpar_(x[c]); }); };
    // as duas linhas vizinhas numa gravação só: nunca fica uma duplicada e a outra perdida
    gravarComDesfazer_(ag, 'mover item', function (desfaz) {
      const antes = s.getRange(topo, 1, 2, n).getValues();
      desfaz(function () { s.getRange(topo, 1, 2, n).setValues(antes); });
      (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(topo, c, 2, 1).setNumberFormat('@'); });
      s.getRange(topo, 1, 2, n).setValues(d > 0 ? [lin(b), lin(a)] : [lin(a), lin(b)]);
    });
    logAtiv_(ag, 'Item movido', aba, String(a.ID_Subprocesso) + (d < 0 ? ' para cima' : ' para baixo'));
    limparCache_();
    return { ok: true, linhas: cadastroVisivel_(ag, aba, lerDireto_(aba)) };
  });
}
/** Desfazer exclusão: recoloca o item na posição original (ou no fim, se a planilha mudou). */
function restaurarCadastro(aba, obj, pos) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  const ar = exigirPerm_(PERM_CAD[aba]);
  if (aba === 'Cad_Processos_Perguntas' || ehCluster_(aba, obj)) exigirGlobal_(ar);
  const o = { _row: 0 };
  colsDados_(aba).forEach(function (c) { o[c] = obj && obj[c] !== undefined && obj[c] !== null ? (typeof obj[c] === 'string' ? obj[c].trim() : obj[c]) : ''; });
  if (aba === 'Cad_Processos_Perguntas' && !podeImediato_(ar)) o.Feedback_Imediato = ''; // quem não define a marcação não a cria ao desfazer
  if (aba === 'Cad_Pessoas') { const m = travaLiderPessoas_(ar, null, o); if (m) return { ok: false, msg: m }; }
  return comLock_(function () {
    const erros = validarCadastro_(aba, o);
    if (Object.keys(erros).length) return { ok: false, erros: erros, msg: 'Não foi possível desfazer: o item já existe ou os dados mudaram.' };
    const s = aba_(aba), linha = colsDados_(aba).map(function (c) { return limpar_(o[c]); }), p = Number(pos);
    gravarComDesfazer_(ar, 'restaurar cadastro', function (desfaz) {
      const hl = aba === 'Cad_Pessoas' ? histCadastro_(ar, 'Restaurado', null, o, '') : [];
      if (hl.length) desfaz(function (ok) { if (ok) histRevertido_(ar, hl, new Error('restauração desfeita')); });
      if (p < 2 || p > s.getLastRow()) { anexarDesfazivel_(desfaz, aba, linha); return; }
      let inserida = false; // a linha em branco inserida sai junto se a gravação falhar
      desfaz(function () { if (inserida) s.deleteRow(p); });
      s.insertRowBefore(p); inserida = true;
      (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(p, c).setNumberFormat('@'); });
      s.getRange(p, 1, 1, linha.length).setValues([linha]);
      if (HUB_ABAS[aba]) s.getRange(p, HUB_ABAS[aba]).setNumberFormat('@').setValue(ehCluster_(aba, o) ? HUB_GLOBAL : hubAtual_());
    });
    logAtiv_(ar, 'Cadastro restaurado', aba, String(linha[0]) + ' ' + String(linha[1] === undefined ? '' : linha[1]));
    limparCache_();
    return { ok: true, linhas: cadastroVisivel_(ar, aba, lerDireto_(aba)) };
  });
}
function gravarConfig_(param, valor) {
  const s = aba_('Configuracoes'), r = lerDireto_('Configuracoes').find(function (x) { return x.Parametro === param; });
  if (r) s.getRange(r._row, 2).setValue(valor); else s.appendRow([param, valor]);
}
/** Salva vida útil, nota de corte, nota média e a regra "vários colaboradores" por processo (valida: 0 <= corte < média <= 100). */
function salvarConfigs(p) {
  const ac = exigirPerm_('config');
  exigirGlobal_(ac);
  p = p || {};
  const dias = Number(p.dias), corte = Number(p.corte), media = Number(p.media), erros = {};
  if (vazio_(p.dias) || isNaN(dias) || dias < 1 || Math.floor(dias) !== dias) erros.dias = 'Informe um número inteiro de dias, 1 ou mais.';
  if (vazio_(p.corte) || isNaN(corte) || corte < 0 || corte > 100) erros.corte = 'Informe um valor entre 0 e 100.';
  if (vazio_(p.media) || isNaN(media) || media > 100 || media < 0) erros.media = 'Informe um valor entre 0 e 100.';
  else if (!erros.corte && media <= corte) erros.media = 'A nota média deve ser maior que a nota de corte.';
  const poucas = vazio_(p.poucas) ? null : Number(p.poucas);
  if (poucas !== null && (isNaN(poucas) || poucas < 1 || poucas > 50 || Math.floor(poucas) !== poucas)) erros.poucas = 'Informe um número inteiro entre 1 e 50.';
  const fbMin = vazio_(p.fbMin) ? null : Number(p.fbMin); // cliente antigo não manda o campo: a quantidade atual fica
  if (fbMin !== null && !fbMinValido_(fbMin)) erros.fbMin = 'Informe um número inteiro entre 1 e 50.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  comLock_(function () {
    // tudo ou nada: corte novo com média antiga quebraria a regra "corte < média"
    const s = aba_('Configuracoes'), n0 = s.getLastRow(), antes = n0 >= 1 ? s.getRange(1, 1, n0, 2).getValues() : [];
    gravarComDesfazer_(ac, 'salvar configurações', function (desfaz) {
      desfaz(function () { for (let i = s.getLastRow(); i > n0; i--) s.deleteRow(i); if (n0 >= 1) s.getRange(1, 1, n0, 2).setValues(antes); });
      if (poucas !== null) gravarConfig_('POUCAS_AUDITORIAS', poucas);
      if (fbMin !== null) gravarConfig_('FEEDBACK_MIN_AUDITORIAS', fbMin);
      gravarConfig_('DIAS_VIDA_UTIL_AUDITORIA', dias);
      gravarConfig_('NOTA_CORTE_PCT', corte);
      gravarConfig_('NOTA_MEDIA_PCT', media);
      if (p.multi && typeof p.multi === 'object') PROCESSOS.forEach(function (pr) { if (pr in p.multi) gravarConfig_('MULTI_COLAB_' + pr, p.multi[pr] === true ? 'Sim' : 'Não'); });
    });
    logAtiv_(ac, 'Configurações alteradas', '', 'Vida útil ' + dias + ' dias; corte ' + corte + '; média ' + media + (fbMin !== null ? '; feedback com ' + fbMin + ' auditorias' : ''));
    limparCache_();
  });
  return { ok: true, config: config_() };
}
