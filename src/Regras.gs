/**
 * Regras de auditoria por líder (v9). Uma linha por líder (chave = e-mail) em Cad_Regras_Lider.
 * Só vale para perfis com escopo "time". Sem linha = comportamento anterior (só o próprio time).
 * Linha ilegível, repetida ou com valor desconhecido = nega toda auditoria do líder (falha fechada).
 * Listas vazias significam "sem restrição" naquele critério; os critérios combinam com E.
 */
const VER_OUTROS = ['proprias', 'time'];
function regraPadrao_() { return { existe: false, ok: true, proprio: true, outros: false, times: [], turnos: [], cores: [], processos: [], verProprio: true, verOutros: 'proprias' }; }
function simNao_(v) { v = String(v == null ? '' : v).trim(); return v === 'Sim' ? true : v === 'Não' ? false : null; }
function listaRegra_(v) { return String(v == null ? '' : v).split('|').map(function (x) { return x.trim(); }).filter(Boolean); }
function regraDeLinha_(r) {
  const pr = simNao_(r.Proprio_Time), ou = simNao_(r.Outros_Times), vp = simNao_(r.Ver_Proprio), vo = String(r.Ver_Outros == null ? '' : r.Ver_Outros).trim();
  const times = listaRegra_(r.Times), turnos = listaRegra_(r.Turnos), cores = listaRegra_(r.Cores), procs = listaRegra_(r.Processos);
  const ok = pr !== null && ou !== null && vp !== null && VER_OUTROS.indexOf(vo) > -1
    && turnos.every(function (x) { return TURNOS.indexOf(x) > -1; }) && procs.every(function (x) { return PROCESSOS.indexOf(x) > -1; }) && cores.every(function (x) { return canonCS_(x) === x; });
  return { existe: true, ok: ok, proprio: pr, outros: ou, times: times, turnos: turnos, cores: cores, processos: procs, verProprio: vp, verOutros: vo };
}
/** Regra do líder. direto=true lê a planilha sem cache (usar no portão de gravação). */
function regraDe_(email, direto) {
  const e = emailDe_(email), lista = (direto ? lerDireto_('Cad_Regras_Lider') : lerAba_('Cad_Regras_Lider')).filter(function (r) { return emailDe_(r.Email) === e; });
  if (!lista.length) return regraPadrao_();
  const r = regraDeLinha_(lista[0]);
  if (lista.length > 1) r.ok = false;
  return r;
}
/**
 * Decide se o líder pode auditar o alvo. Devolve null (pode) ou { campo, msg } (negado).
 * alvo = { processo, turno, cs (cor/símbolo canônico da doca ou ''), colabs: [{ n, l, t }] }. Função pura: não lê planilha.
 * As mensagens nunca repetem nomes, para não permitir descobrir quem existe em outros times.
 */
function negarAuditoria_(u, regra, alvo) {
  if (u.escopo.modo !== 'time') return null;
  if (!regra.ok) return { campo: 'colaborador', msg: 'A regra de auditoria deste usuário está inválida. Fale com o Site Leader.' };
  if (!regra.proprio && !regra.outros) return { campo: 'colaborador', msg: 'Sua regra de auditoria não permite auditar. Fale com o Site Leader.' };
  if (alvo.homonimo) return { campo: 'colaborador', msg: 'Há mais de um líder com o seu nome no cadastro de pessoas. Fale com o Site Leader para corrigir.' };
  if (regra.processos.length && regra.processos.indexOf(alvo.processo) < 0) return { campo: 'processo', msg: 'Sua regra de auditoria não permite este processo. Fale com o Site Leader.' };
  if (regra.turnos.length && (regra.turnos.indexOf(alvo.turno) < 0 || alvo.colabs.some(function (c) { return !c.t || regra.turnos.indexOf(c.t) < 0; }))) return { campo: 'turno', msg: 'Sua regra de auditoria não permite este turno. Fale com o Site Leader.' };
  if (alvo.doca && regra.cores.length && (!alvo.cs || regra.cores.indexOf(alvo.cs) < 0)) return { campo: 'doca', msg: 'Sua regra de auditoria não permite esta cor e símbolo. Fale com o Site Leader.' };
  const eu = semAcento_(u.nome), times = regra.times.map(semAcento_);
  for (let i = 0; i < alvo.colabs.length; i++) {
    const dono = semAcento_(alvo.colabs[i].l);
    const permitido = !dono ? false : dono === eu ? regra.proprio : regra.outros && (!times.length || times.indexOf(dono) > -1); // colaborador sem líder cadastrado nunca passa
    if (!permitido) return { campo: 'colaborador', msg: 'Sua regra de auditoria não permite este colaborador. Fale com o Site Leader.' };
  }
  return null;
}
/** Colaboradores que a regra do líder permite auditar (sem olhar o processo) e os líderes desses times: é o que o formulário recebe. */
function pessoasAuditaveis_(a, pessoas) {
  const regra = regraDe_(a.email);
  if (!regra.ok) return [];
  const sem = Object.assign({}, regra, { processos: [] });
  const colabs = pessoas.filter(function (p) {
    return p.Cargo === 'Colaborador' && !negarAuditoria_(a, sem, { processo: '', turno: p.Turno, cs: '', colabs: [{ n: p.Nome, l: p.Lider, t: p.Turno }] });
  });
  const lids = colabs.map(function (c) { return semAcento_(c.Lider); });
  return colabs.concat(pessoas.filter(function (p) { return p.Cargo === 'Líder' && lids.indexOf(semAcento_(p.Nome)) > -1; }));
}
/** Regra usada só para VER dados: regra ilegível nunca amplia a visão (cai no padrão). */
function regraVisao_(a) { const r = regraDe_(a.email); return r.ok ? r : regraPadrao_(); }
/**
 * O que o líder enxerga de uma auditoria: devolve os colaboradores e líderes que ele pode ver (lids vazio = auditoria oculta).
 * Time próprio: se verProprio. Outros times: o que ele mesmo auditou e, com verOutros='time', os times que a regra o deixa auditar.
 */
function visaoLider_(a, regra, r, ls) {
  const eu = semAcento_(a.nome), times = regra.times.map(semAcento_);
  const minha = r.email ? r.email === a.email : semAcento_(r.resp) === eu;
  const ve = function (l) {
    const n = semAcento_(l);
    if (n === eu) return regra.verProprio;
    return minha || (regra.verOutros === 'time' && regra.outros && (!times.length || times.indexOf(n) > -1));
  };
  return { colabs: r.colabs.filter(function (c) { return ve(c.l); }), lids: ls.filter(ve) };
}

/* ---------- tela e gravação das regras (Site Leader e Admin) ---------- */
/** Líderes que o ator pode configurar: usuários ativos do Hub dele, com perfil de escopo "time". */
function lideresConfiguraveis_(a) {
  const pf = perfis_();
  return usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).filter(function (u) {
    const p = pf[String(u.Perfil).trim()];
    return ativo_(u) && p && p.escopo.modo === 'time' && p.perms.indexOf('regras_lider') < 0 && (!a.hubOn || !a.hubGlobal || String(u.Hub || '').trim() === a.hub);
  });
}
function regraOut_(r) { return { existe: r.existe, ok: r.ok, proprio: r.proprio, outros: r.outros, times: r.times, turnos: r.turnos, cores: r.cores, processos: r.processos, verProprio: r.verProprio, verOutros: r.verOutros }; }
/** Quem define regras precisa ter dados de todos os times, sem limite de turno ou processo: ninguém concede acesso maior que o próprio. */
function exigirRegras_() {
  const a = exigirPerm_('regras_lider');
  if (a.escopo.modo !== 'todos' || a.escopo.turnos.length || a.escopo.processos.length) throw new Error('Seu perfil não pode definir regras de auditoria: ele enxerga só parte dos dados.');
  return a;
}
function listarRegrasLider() {
  const a = exigirRegras_();
  const cores = {}; lerAba_('Cad_Estrutura').forEach(function (e) { const c = canonCS_(e.Cor_Simbolo); if (c) cores[c] = 1; });
  const linhas = lerDireto_('Cad_Regras_Lider'), por = {};
  linhas.forEach(function (r) { const e = emailDe_(r.Email); (por[e] = por[e] || []).push(r); });
  return {
    ok: true,
    lideres: lideresConfiguraveis_(a).filter(function (u) { return emailDe_(u.Email_Google) !== a.email; }).map(function (u) {
      const l = por[emailDe_(u.Email_Google)] || [], r = l.length ? regraDeLinha_(l[0]) : regraPadrao_();
      if (l.length > 1) r.ok = false;
      return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil), regra: regraOut_(r) };
    }),
    times: lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return String(p.Nome); }),
    turnos: TURNOS, processos: PROCESSOS, cores: Object.keys(cores).sort(), padrao: regraOut_(regraPadrao_())
  };
}
function listaTexto_(v, validos, max) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max) return null;
  const l = v.map(function (x) { return String(x == null ? '' : x).trim(); });
  if (l.some(function (x) { return !x || /[|;=<>]/.test(x) || /^[+\-@]/.test(x) || x.length > 80 || (validos && validos.indexOf(x) < 0); }) || l.some(function (x, i) { return l.indexOf(x) !== i; })) return null;
  return l;
}
function linhaRegra_(email) {
  const l = lerDireto_('Cad_Regras_Lider').filter(function (r) { return emailDe_(r.Email) === email; });
  return l.length ? l : [];
}
function salvarRegraLider(obj) {
  const a = exigirRegras_();
  obj = obj || {};
  const email = emailDe_(obj.email);
  if (email === a.email) return { ok: false, msg: 'Ninguém edita a própria regra. Peça a outra pessoa com esta permissão.' };
  const cores = {}; lerAba_('Cad_Estrutura').forEach(function (e) { const c = canonCS_(e.Cor_Simbolo); if (c) cores[c] = 1; });
  const lids = lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return String(p.Nome); });
  const o = { proprio: obj.proprio === true, outros: obj.outros === true, verProprio: obj.verProprio === true, verOutros: String(obj.verOutros || ''),
    times: listaTexto_(obj.times, lids, 100), turnos: listaTexto_(obj.turnos, TURNOS, TURNOS.length), cores: listaTexto_(obj.cores, Object.keys(cores), 200), processos: listaTexto_(obj.processos, PROCESSOS, PROCESSOS.length) };
  if (typeof obj.proprio !== 'boolean' || typeof obj.outros !== 'boolean' || typeof obj.verProprio !== 'boolean' || VER_OUTROS.indexOf(o.verOutros) < 0 || o.times === null || o.turnos === null || o.cores === null || o.processos === null) return { ok: false, msg: 'Regra inválida. Confira os campos e tente de novo.' };
  if (!o.outros) o.times = [];
  return comLock_(function () {
    const alvo = lideresConfiguraveis_(a).find(function (u) { return emailDe_(u.Email_Google) === email; });
    if (!alvo) return { ok: false, msg: 'Líder não encontrado neste Hub, ou o perfil dele não permite regra individual.' };
    const antes = linhaRegra_(email), linha = [email, o.proprio ? 'Sim' : 'Não', o.outros ? 'Sim' : 'Não', o.times.join('|'), o.turnos.join('|'), o.cores.join('|'), o.processos.join('|'), o.verProprio ? 'Sim' : 'Não', o.verOutros, limpar_(a.email), agora_()];
    const resumo = 'Próprio: ' + linha[1] + '; Outros: ' + linha[2] + '; Times: ' + (linha[3] || 'todos') + '; Turnos: ' + (linha[4] || 'todos') + '; Cores: ' + (linha[5] || 'todas') + '; Processos: ' + (linha[6] || 'todos') + '; Ver próprio: ' + linha[7] + '; Ver outros: ' + linha[8];
    const s = aba_('Cad_Regras_Lider');
    let row = antes.length ? antes[0]._row : 0;
    if (row) { (TEXTO_COLS.Cad_Regras_Lider || []).forEach(function (c) { s.getRange(row, c).setNumberFormat('@'); }); s.getRange(row, 1, 1, linha.length).setValues([linha]); }
    else { anexar_('Cad_Regras_Lider', linha); row = s.getLastRow(); }
    try { registrar_(a, 'Regra de auditoria alterada', email, resumo); }
    catch (e) { // o log é obrigatório nesta mudança: sem registro, a regra volta ao que era
      try {
        if (antes.length) s.getRange(row, 1, 1, 11).setValues([ABAS.Cad_Regras_Lider.map(function (c) { return antes[0][c] === undefined ? '' : antes[0][c]; })]); else s.deleteRow(row);
      } finally { limparCache_(); }
      return { ok: false, msg: 'Não foi possível registrar a mudança no log; a regra não foi alterada.' };
    }
    // linhas repetidas só saem depois que a mudança foi registrada (assim o desfazer acima não precisa recriá-las)
    for (let i = antes.length - 1; i > 0; i--) s.deleteRow(antes[i]._row);
    limparCache_();
    return { ok: true, dados: listarRegrasLider() };
  });
}
/** Volta o líder ao padrão da unidade (sem linha de regra). */
function excluirRegraLider(email) {
  const a = exigirRegras_();
  email = emailDe_(email);
  if (email === a.email) return { ok: false, msg: 'Ninguém edita a própria regra. Peça a outra pessoa com esta permissão.' };
  return comLock_(function () {
    const alvo = lideresConfiguraveis_(a).find(function (u) { return emailDe_(u.Email_Google) === email; });
    if (!alvo) return { ok: false, msg: 'Líder não encontrado neste Hub, ou o perfil dele não permite regra individual.' };
    const linhas = linhaRegra_(email), guardadas = linhas.map(function (r) { return ABAS.Cad_Regras_Lider.map(function (c) { return r[c] === undefined ? '' : r[c]; }); });
    for (let i = linhas.length - 1; i >= 0; i--) aba_('Cad_Regras_Lider').deleteRow(linhas[i]._row);
    try { registrar_(a, 'Regra de auditoria removida (volta ao padrão)', email, ''); }
    catch (e) { // log obrigatório: sem registro, a regra é devolvida
      try { guardadas.forEach(function (g) { anexar_('Cad_Regras_Lider', g); }); } finally { limparCache_(); }
      return { ok: false, msg: 'Não foi possível registrar a mudança no log; a regra não foi alterada.' };
    }
    limparCache_();
    return { ok: true, dados: listarRegrasLider() };
  });
}
/** Atualização para a v9: cria a aba de regras e dá a permissão ao perfil Site Leader. Segura para rodar mais de uma vez. */
function migrarV9() {
  manutencao_();
  garantirAba_('Cad_Regras_Lider'); formatarTexto_(SpreadsheetApp.getActive().getSheetByName('Cad_Regras_Lider'), 'Cad_Regras_Lider');
  const pf = aba_('Cad_Perfis'); let n = 0;
  lerBruto_('Cad_Perfis').forEach(function (r) {
    if (r.Perfil !== 'Site Leader') return;
    const p = String(r.Permissoes || '').split(',').filter(Boolean);
    if (p.indexOf('regras_lider') < 0) { pf.getRange(r._row, 3).setNumberFormat('@').setValue(p.concat(['regras_lider']).join(',')); n++; }
  });
  limparCache_();
  return { ok: true, abaCriada: 'Cad_Regras_Lider', perfilSiteLeaderAtualizado: n > 0 };
}
/** Líder renomeado no cadastro: acompanha o novo nome nas listas de Times das regras (comparação exata, sem acento ignorado). */
function renomearTimeRegras_(antigo, novo) {
  const s = aba_('Cad_Regras_Lider');
  lerDireto_('Cad_Regras_Lider').forEach(function (r) {
    const l = listaRegra_(r.Times);
    if (l.indexOf(antigo) > -1) s.getRange(r._row, 4).setNumberFormat('@').setValue(l.map(function (x) { return x === antigo ? novo : x; }).join('|'));
  });
}
