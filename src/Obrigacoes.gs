/* ============================================================
   v10: histórico de time/turno, metas de auditoria por líder e feedback obrigatório.
   Fase 1 (este bloco): Pessoas_Historico, aba só de acréscimo.
   Cada criação, mudança de líder/turno/nome, exclusão, restauração, carga em massa e renomeação de líder gera uma linha.
   Nada é sobrescrito: o time e o turno da época continuam consultáveis depois que a pessoa muda.
   ============================================================ */

/** Colaborador de uma linha de cadastro, só com o que o histórico guarda. */
function histPessoa_(p) {
  return p ? { nome: String(p.Nome || ''), lider: String(p.Cargo === 'Líder' ? '' : (p.Lider || '')), turno: String(p.Turno || '') } : null;
}
/** Linha do histórico (sem a coluna Hub, que o carimbo central preenche). */
function histLinha_(a, evento, antes, depois) {
  const x = histPessoa_(antes), y = histPessoa_(depois), nome = (y || x).nome;
  return [agora_(), limpar_(nome), limpar_(evento), limpar_(x ? x.lider : ''), limpar_(y ? y.lider : ''), limpar_(x ? x.turno : ''), limpar_(y ? y.turno : ''), limpar_(a.nome + ' <' + a.email + '>')];
}
/** Mudança relevante para o histórico: nome, líder ou turno. Alterar só o status ou o cargo não gera linha. */
function histMudou_(antes, depois) {
  const x = histPessoa_(antes), y = histPessoa_(depois);
  return x.nome !== y.nome || x.lider !== y.lider || x.turno !== y.turno;
}
/**
 * Registra um evento do cadastro de pessoas. Chamado DENTRO do lock, antes de gravar o cadastro: se o histórico falhar, o cadastro não muda.
 * renomeadoDe: nome antigo do líder; os colaboradores dele ganham uma linha "Líder renomeado".
 */
function histCadastro_(a, evento, antes, depois, renomeadoDe) {
  const linhas = [];
  if (evento !== 'Alterado' || histMudou_(antes, depois)) linhas.push(histLinha_(a, evento, antes, depois));
  // pessoa renomeada: o nome antigo também ganha uma linha apontando para o novo, para o passado continuar ligado
  if (evento === 'Alterado' && antes.Nome !== depois.Nome) linhas.push(histLinha_(a, 'Renomeado para ' + depois.Nome, antes, antes));
  if (renomeadoDe) {
    lerDireto_('Cad_Pessoas').forEach(function (p) {
      if (p.Cargo === 'Colaborador' && p.Lider === renomeadoDe) linhas.push(histLinha_(a, 'Líder renomeado', p, { Nome: p.Nome, Cargo: p.Cargo, Turno: p.Turno, Lider: depois.Nome }));
    });
  }
  if (linhas.length) anexarLinhas_('Pessoas_Historico', linhas);
  return linhas;
}
/** A gravação do cadastro falhou depois do histórico: deixa uma marca "Revertido" para a linha anterior não parecer uma mudança que aconteceu. Best-effort. */
function histRevertido_(a, linhas, erro) {
  try {
    if (!linhas || !linhas.length) return;
    const motivo = String(erro && erro.message || erro).slice(0, 60);
    anexarLinhas_('Pessoas_Historico', linhas.map(function (l) { return [agora_(), l[1], limpar_('Revertido: ' + motivo), l[3], l[4], l[5], l[6], l[7]]; }));
  } catch (e) { console.error('Histórico não marcou a reversão: ' + e.message); contarFalhaLog_(); }
}
/** Carga em massa: toda pessoa nova entra no histórico como "Importado". */
function histLote_(a, objs) {
  const linhas = objs.map(function (o) { return histLinha_(a, 'Importado', null, o); });
  if (linhas.length) anexarLinhas_('Pessoas_Historico', linhas);
  return linhas;
}
/** Atualização para a v10 (idempotente): cria as abas novas, dá a permissão ao Site Leader e registra o estado atual das pessoas como ponto de partida do histórico. */
function migrarV10() {
  manutencao_();
  const ss = SpreadsheetApp.getActive(), rel = { abas: [] };
  ['Pessoas_Historico', 'Metas_Lider', 'Feedback_Pendencias', 'Feedback_Registros'].forEach(function (n) { garantirAba_(n); formatarTexto_(ss.getSheetByName(n), n); rel.abas.push(n); });
  const pf = aba_('Cad_Perfis'); rel.perfilSiteLeaderAtualizado = false;
  lerBruto_('Cad_Perfis').forEach(function (r) {
    if (r.Perfil !== 'Site Leader') return;
    const p = String(r.Permissoes || '').split(',').filter(Boolean);
    if (p.indexOf('obrigacoes') < 0) { pf.getRange(r._row, 3).setNumberFormat('@').setValue(p.concat(['obrigacoes']).join(',')); rel.perfilSiteLeaderAtualizado = true; }
  });
  comLock_(function () {
    const tem = {};
    lerBruto_('Pessoas_Historico').forEach(function (r) { tem[String(r.Hub) + '|' + r.Colaborador] = 1; });
    const novas = [], eu = { nome: 'Migração v10', email: 'sistema' };
    lerBruto_('Cad_Pessoas').forEach(function (p) {
      if (!String(p.Nome).trim() || tem[String(p.Hub === undefined ? '' : p.Hub) + '|' + p.Nome]) return;
      const l = histLinha_(eu, 'Estado inicial', null, p);
      novas.push(l.concat([String(p.Hub === undefined ? '' : p.Hub)]));
    });
    if (novas.length) {
      const s = aba_('Pessoas_Historico'), r = s.getLastRow() + 1;
      if (r + novas.length - 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + novas.length - 1 - s.getMaxRows());
      (TEXTO_COLS.Pessoas_Historico || []).forEach(function (c) { s.getRange(r, c, novas.length, 1).setNumberFormat('@'); });
      s.getRange(r, 1, novas.length, novas[0].length).setValues(novas);
    }
    rel.estadoInicial = novas.length;
  });
  limparCache_();
  return Object.assign({ ok: true }, rel);
}

/* ============================================================
   Fase 2: metas de auditoria por líder (Metas_Lider).
   Site Leader e Admin (permissão "obrigacoes", dados de todos os times) programam quais auditorias cada pessoa deve fazer e até quando.
   O progresso vem das auditorias finalizadas reais; cancelar nunca apaga a linha. O líder vê só as próprias metas.
   ============================================================ */
const META_LIDER_MAX_DESC = 200;
const META_LIDER_MAX_DIAS = 366;
const META_LIDER_JANELA = 400; // o prazo fica a até 400 dias de hoje (e o prazo vence hoje ou depois, com no máx. 366 dias de duração): o progresso nunca precisa cortar o período
const MAIL_RESERVA = 10;

/** Programar auditorias e feedbacks exige a permissão e dados completos: um perfil limitado a um turno não programa o que não enxerga. */
function exigirObrig_() {
  const a = exigirPerm_('obrigacoes');
  if (a.escopo.modo !== 'todos' || a.escopo.turnos.length || a.escopo.processos.length) throw new Error('Seu perfil não pode programar auditorias: ele enxerga só parte dos dados.');
  return a;
}
/** Quem pode receber meta: usuário ativo do Hub do ator, com permissão de auditar, que não seja o próprio ator. */
function responsaveisMeta_(a) {
  const pf = perfis_();
  return usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).filter(function (u) {
    const p = pf[String(u.Perfil).trim()];
    return ativo_(u) && p && p.perms.indexOf('auditar') > -1 && emailDe_(u.Email_Google) !== a.email && (!a.hubOn || String(u.Hub || '').trim() === a.hub); // o Admin global também só programa para o Hub ativo
  });
}
function metaLiderOut_(r) {
  return { id: String(r.ID_Meta), email: emailDe_(r.Lider_Email), nome: String(r.Lider_Nome), times: listaRegra_(r.Times), turnos: listaRegra_(r.Turnos), cores: listaRegra_(r.Cores), processos: listaRegra_(r.Processos),
    qtd: Number(r.Quantidade), ini: String(r.Inicio), fim: String(r.Fim), desc: String(r.Descricao || ''), criadaPor: String(r.Criada_Por), criadaEm: String(r.Criada_Em),
    cancelada: String(r.Status) === 'Cancelada', canceladaPor: String(r.Cancelada_Por || ''), visto: String(r.Visto_Em || '') !== '', avisoPendente: String(r.Aviso_Em || '') === '' && String(r.Status) === 'Ativa' };
}
/** Auditorias finalizadas do responsável que casam com o escopo da meta: período, processo, turno, cor/símbolo da doca e time (líder dono do colaborador). */
function progressoMetasLider_(metas, hoje) {
  const out = {};
  if (!metas.length) return out;
  let de = metas.reduce(function (x, m) { return m.ini < x ? m.ini : x; }, metas[0].ini), ate = metas.reduce(function (x, m) { return m.fim > x ? m.fim : x; }, hoje);
  if (difDias_(de, ate) > MAX_PERIODO_DIAS * 2) de = addDias_(ate, -MAX_PERIODO_DIAS * 2);
  const rows = lerHist_(de, ate, false), colabs = lerColabs_(de, ate), corDe = {};
  lerAba_('Cad_Estrutura').forEach(function (e) { corDe[String(e.Identificador)] = canonCS_(e.Cor_Simbolo); });
  metas.forEach(function (m) {
    const nome = semAcento_(m.nome), times = m.times.map(semAcento_);
    out[m.id] = rows.filter(function (r) {
      const d = r.ts.slice(0, 10);
      if (d < m.ini || d > m.fim) return false;
      if (!(r.email ? r.email === m.email : semAcento_(r.resp) === nome)) return false;
      if (m.processos.length && m.processos.indexOf(r.proc) < 0) return false;
      if (m.turnos.length && m.turnos.indexOf(r.turno) < 0) return false;
      if (m.cores.length && m.cores.indexOf(corDe[r.doca] || '') < 0) return false;
      if (times.length) {
        const ls = (colabs[r.id] || []).map(function (c) { return c.l; }).concat(String(r.lider).split(';')).map(semAcento_).filter(Boolean);
        if (!ls.some(function (l) { return times.indexOf(l) > -1; })) return false;
      }
      return true;
    }).length;
  });
  return out;
}
function metaLiderStatus_(m, feito, hoje) { return m.cancelada ? 'cancelada' : statusMeta_(feito, m.qtd, m.ini, m.fim, hoje); }
function metasLiderComProgresso_(linhas, hoje) {
  const metas = linhas.map(metaLiderOut_), prog = progressoMetasLider_(metas.filter(function (m) { return !m.cancelada; }), hoje);
  return metas.map(function (m) { m.feito = prog[m.id] || 0; m.status = metaLiderStatus_(m, m.feito, hoje); return m; });
}
function listarMetasLider() {
  const a = exigirObrig_(), hoje = hoje_(), cores = {};
  lerAba_('Cad_Estrutura').forEach(function (e) { const c = canonCS_(e.Cor_Simbolo); if (c) cores[c] = 1; });
  const linhas = lerDireto_('Metas_Lider').filter(function (r) { return String(r.Fim) >= addDias_(hoje, -90); });
  return {
    ok: true, hoje: hoje, metas: metasLiderComProgresso_(linhas, hoje),
    responsaveis: responsaveisMeta_(a).map(function (u) { return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil) }; }),
    times: lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return String(p.Nome); }),
    turnos: TURNOS, processos: PROCESSOS, cores: Object.keys(cores).sort()
  };
}
function salvarMetaLider(obj) {
  const a = exigirObrig_(), o = obj || {}, erros = {};
  const email = emailDe_(o.email), qtd = (typeof o.qtd === 'number' || /^\d{1,4}$/.test(String(o.qtd).trim())) ? Number(o.qtd) : NaN, desc = String(o.desc == null ? '' : o.desc).trim();
  const cores = {}; lerAba_('Cad_Estrutura').forEach(function (e) { const c = canonCS_(e.Cor_Simbolo); if (c) cores[c] = 1; });
  const lids = lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return String(p.Nome); });
  const times = listaTexto_(o.times, lids, 100), turnos = listaTexto_(o.turnos, TURNOS, TURNOS.length), cs = listaTexto_(o.cores, Object.keys(cores), 200), procs = listaTexto_(o.processos, PROCESSOS, PROCESSOS.length);
  if (times === null) erros.times = 'Time inválido.';
  if (turnos === null) erros.turnos = 'Turno inválido.';
  if (cs === null) erros.cores = 'Cor ou símbolo inválido.';
  if (procs === null) erros.processos = 'Processo inválido.';
  if (vazio_(o.qtd) || isNaN(qtd) || qtd < 1 || qtd > 9999 || Math.floor(qtd) !== qtd) erros.qtd = 'Informe um número inteiro entre 1 e 9999.';
  const dataOk = function (x) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x))) return false; const d = new Date(x + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === x; };
  const hoje = hoje_();
  if (!dataOk(o.ini)) erros.ini = 'Informe a data inicial.';
  if (!dataOk(o.fim)) erros.fim = 'Informe a data final.';
  if (!erros.ini && !erros.fim) {
    if (String(o.ini) > String(o.fim)) erros.fim = 'A data final deve ser igual ou posterior à inicial.';
    else if (String(o.fim) < hoje) erros.fim = 'O prazo não pode estar no passado.';
    else if (difDias_(o.ini, o.fim) > META_LIDER_MAX_DIAS) erros.fim = 'Prazo máximo de ' + META_LIDER_MAX_DIAS + ' dias.';
    else if (String(o.fim) > addDias_(hoje, META_LIDER_JANELA)) erros.fim = 'O prazo está longe demais. Confira o ano.';
  }
  if (desc.length > META_LIDER_MAX_DESC) erros.desc = 'Máximo de ' + META_LIDER_MAX_DESC + ' caracteres.';
  if (/^[=+\-@]/.test(desc) || /[<>]/.test(desc)) erros.desc = 'Não use < > nem iniciar com = + - @.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  let linhaN = 0, linha;
  const r = comLock_(function () {
    const resp = responsaveisMeta_(a).find(function (u) { return emailDe_(u.Email_Google) === email; });
    if (!resp) return { ok: false, erros: { email: 'Usuário ativo com permissão de auditar não encontrado neste Hub (e não pode ser você).' } };
    const pf = perfis_()[String(resp.Perfil).trim()];
    if (pf && pf.escopo.modo === 'time') {
      const regra = regraDe_(email, true);
      if (!regra.ok || (!regra.proprio && !regra.outros)) return { ok: false, erros: { email: 'A regra de auditoria deste líder não permite que ele audite. Ajuste a regra antes de programar a meta.' } };
    }
    const dup = lerDireto_('Metas_Lider').some(function (m) { return String(m.Status) === 'Ativa' && emailDe_(m.Lider_Email) === email && String(m.Inicio) === o.ini && String(m.Fim) === o.fim && Number(m.Quantidade) === qtd && String(m.Times) === (times || []).join('|') && String(m.Turnos) === (turnos || []).join('|') && String(m.Cores) === (cs || []).join('|') && String(m.Processos) === (procs || []).join('|'); });
    if (dup) return { ok: false, erros: { email: 'Já existe uma meta ativa idêntica para esta pessoa.' } };
    linha = ['MTL-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000), email, limpar_(String(resp.Nome)), (times || []).join('|'), (turnos || []).join('|'), (cs || []).join('|'), (procs || []).join('|'), qtd, o.ini, o.fim, limpar_(desc), limpar_(a.email), agora_(), 'Ativa', '', '', '', ''];
    linhaN = anexar_('Metas_Lider', linha);
    try { registrar_(a, 'Meta de auditoria programada', email, qtd + ' auditoria(s) até ' + o.fim + (linha[6] ? ' em ' + linha[6] : '')); } catch (e) { falhaLog_('programar meta', e); desfazer_(function () { aba_('Metas_Lider').deleteRow(linhaN); }); throw new Error('Não foi possível registrar a meta no log; nada foi salvo. Tente de novo.'); }
    limparCache_();
    return { ok: true };
  });
  if (!r.ok) return r;
  const env = avisarMetaLider_(linhaN, linha[0], email, linha[8], linha[9], qtd);
  // a meta já está gravada: se a releitura da lista falhar, o cliente recarrega sozinho (nunca pede para repetir a operação)
  try { return Object.assign(listarMetasLider(), { ok: true, id: linha[0], emailEnviado: env }); } catch (e) { falhaLog_('listar após programar', e); return { ok: true, id: linha[0], emailEnviado: env, recarregar: true }; }
}
function cancelarMetaLider(id) {
  const a = exigirObrig_();
  const r = comLock_(function () {
    const ex = lerDireto_('Metas_Lider').find(function (r) { return String(r.ID_Meta) === String(id); });
    if (!ex || String(ex.Status) !== 'Ativa') return { ok: false, msg: 'Meta não encontrada ou já cancelada. Atualize a tela.' };
    const s = aba_('Metas_Lider'), antes = s.getRange(ex._row, 14, 1, 3).getValues();
    s.getRange(ex._row, 14, 1, 3).setValues([['Cancelada', limpar_(a.email), agora_()]]);
    try { registrar_(a, 'Meta de auditoria cancelada', emailDe_(ex.Lider_Email), String(ex.ID_Meta)); } catch (e) { falhaLog_('cancelar meta', e); desfazer_(function () { s.getRange(ex._row, 14, 1, 3).setValues(antes); }); throw new Error('Não foi possível registrar o cancelamento no log; nada foi alterado. Tente de novo.'); }
    limparCache_();
    return { ok: true };
  });
  if (!r.ok) return r;
  try { return Object.assign(listarMetasLider(), { ok: true }); } catch (e) { falhaLog_('listar após cancelar', e); return { ok: true, recarregar: true }; } // leitura pesada fora do lock
}
/** A causa nunca se perde: vai para o console e para o contador de falhas da tela de Log. */
function falhaLog_(onde, e) { console.error('Falha em ' + onde + ': ' + (e && e.message || e)); contarFalhaLog_(); }
/** Reversão protegida: se ela mesma falhar, fica registrado (e o cache nunca guarda linha fantasma). */
function desfazer_(fn) { for (let i = 0; i < 2; i++) { try { fn(); break; } catch (e) { falhaLog_('reversão (tentativa ' + (i + 1) + ')', e); } } limparCache_(); }

/* ---- lado do líder (e de qualquer pessoa que audita): só as próprias metas ---- */
/** Metas ativas ainda não abertas e dentro da janela que Minhas metas exibe (a mesma regra nas duas pontas: o selo nunca fica preso). */
function metasNaoVistas_(a, hoje) {
  const lim = addDias_(hoje, -30);
  return lerDireto_('Metas_Lider').filter(function (r) { return emailDe_(r.Lider_Email) === a.email && String(r.Status) === 'Ativa' && String(r.Visto_Em || '') === '' && String(r.Fim) >= lim; });
}
/** Contador por usuário: chave com a versão dos dados (limparCache_ troca a versão), para não reler a planilha a cada consulta. */
function contarMetasNovas_(a) {
  const c = CacheService.getScriptCache(), k = 'mn:' + hv_() + ':' + (a.hub || '') + ':' + a.email, v = c.get(k);
  if (v !== null && v !== undefined) return Number(v);
  const n = metasNaoVistas_(a, hoje_()).length;
  try { c.put(k, String(n), 120); } catch (e) { /* sem cache */ }
  return n;
}
/** Zera só os contadores em cache do próprio usuário (marcar como visto não muda dado que outros leiam). */
function limparContadores_(a) {
  try { const c = CacheService.getScriptCache(), b = ':' + hv_() + ':' + (a.hub || '') + ':' + a.email; c.remove('mn' + b); c.remove('fb' + b); } catch (e) { /* expira em 120 s */ }
}
function contarMetasNovas() { return contarMetasNovas_(exigirTela_('minhas')); }
function minhasMetasLider() {
  const a = exigirTela_('minhas'), hoje = hoje_();
  const linhas = lerDireto_('Metas_Lider').filter(function (r) { return emailDe_(r.Lider_Email) === a.email && String(r.Status) === 'Ativa' && String(r.Fim) >= addDias_(hoje, -30); });
  return metasLiderComProgresso_(linhas, hoje).map(function (m) { return { id: m.id, qtd: m.qtd, ini: m.ini, fim: m.fim, desc: m.desc, times: m.times, turnos: m.turnos, cores: m.cores, processos: m.processos, criadaPor: m.criadaPor, feito: m.feito, status: m.status, nova: !m.visto }; });
}
/** Zera o contador: marca como vistas só as metas do próprio usuário (nenhum id vem do navegador). */
function marcarMetasVistas() {
  const a = exigirTela_('minhas');
  return comLock_(function () {
    const s = aba_('Metas_Lider'), novas = metasNaoVistas_(a, hoje_());
    novas.forEach(function (r) { s.getRange(r._row, 17).setNumberFormat('@').setValue(agora_()); });
    if (novas.length) limparContadores_(a);
    return { ok: true, vistas: novas.length };
  });
}

/* ---- e-mail de aviso: só diz que há meta nova, com prazo e quantidade (sem nomes, notas ou texto livre) ---- */
const MAIL_META = {
  pt: { assunto: 'Nova meta de auditoria - Process Check', titulo: 'Você tem uma nova meta de auditoria', ola: 'Olá, ', corpo: 'Foi programada uma meta para você: {q} auditoria(s) até {d}. Veja os detalhes na aba Minhas metas.', botao: 'Abrir Minhas metas', rodape: 'Mensagem automática. Não é necessário responder.' },
  en: { assunto: 'New audit goal - Process Check', titulo: 'You have a new audit goal', ola: 'Hello, ', corpo: 'A goal was set for you: {q} audit(s) by {d}. See the details in My goals.', botao: 'Open My goals', rodape: 'Automatic message. No reply is needed.' },
  es: { assunto: 'Nueva meta de auditoría - Process Check', titulo: 'Tiene una nueva meta de auditoría', ola: 'Hola, ', corpo: 'Se programó una meta para usted: {q} auditoría(s) hasta {d}. Vea los detalles en Mis metas.', botao: 'Abrir Mis metas', rodape: 'Mensaje automático. No es necesario responder.' }
};
function dataBr_(ymd) { return String(ymd).slice(8, 10) + '/' + String(ymd).slice(5, 7) + '/' + String(ymd).slice(0, 4); }
/**
 * Envia o aviso uma única vez: dentro de um lock curto confere que a linha é a mesma e ainda sem aviso e carimba Aviso_Em ANTES de enviar
 * (duas execuções nunca enviam o mesmo aviso). Se o envio falhar, o carimbo é desfeito e o passo das 22h tenta de novo.
 */
/** E-mail de aviso padrão (HTML + texto): m = textos do idioma, corpo = frase já montada. Não leva nome de colaborador nem nota. */
function enviarAviso_(email, m, corpo) {
  const url = urlApp_();
  const txt = m.ola.trim() + '\n\n' + corpo + '\n\n' + (url ? m.botao + ': ' + url + '\n\n' : '') + m.rodape;
  const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F5F7;padding:24px 0"><tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #E4E7EB;border-radius:10px;font-family:Arial,Helvetica,sans-serif;color:#1F2328">'
    + '<tr><td style="background:#D9441A;padding:18px 28px;color:#FFFFFF;font-size:15px;font-weight:bold">Process Check</td></tr>'
    + '<tr><td style="padding:30px 28px 8px;font-size:22px;font-weight:bold;line-height:1.3">' + esc_(m.titulo) + '</td></tr>'
    + '<tr><td style="padding:8px 28px 4px;font-size:15px;line-height:1.6">' + esc_(corpo) + '</td></tr>'
    + (url ? '<tr><td style="padding:20px 28px 6px"><a href="' + esc_(url) + '" style="display:inline-block;padding:12px 24px;background:#D9441A;border-radius:6px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none">' + esc_(m.botao) + '</a></td></tr>' : '')
    + '<tr><td style="padding:22px 28px 26px;font-size:11px;color:#9AA3AD;border-top:1px solid #EEF0F2">' + esc_(m.rodape) + '</td></tr></table></td></tr></table>';
  MailApp.sendEmail({ to: email, subject: m.assunto, body: txt, htmlBody: html, name: 'Process Check' });
}
function avisarMetaLider_(row, id, email, ini, fim, qtd) {
  if (!emailValido_(email) || /[,;<>"\r\n]/.test(email)) return false;
  const reservou = comLock_(function () {
    const c = aba_('Metas_Lider').getRange(row, 1, 1, 18).getValues()[0];
    if (String(c[0]) !== String(id) || String(c[13]) !== 'Ativa' || String(c[17]) !== '') return false;
    aba_('Metas_Lider').getRange(row, 18).setNumberFormat('@').setValue(agora_());
    return true;
  });
  if (!reservou) return false;
  try {
    if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) throw new Error('Cota diária de e-mail quase esgotada.');
    const sol = lerAba_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === email; }).pop(), m = MAIL_META[idiomaOk_(sol && sol.Idioma)];
    enviarAviso_(email, m, m.corpo.replace('{q}', String(qtd)).replace('{d}', dataBr_(fim)));
  } catch (e) {
    falhaLog_('aviso de meta', e);
    desfazer_(function () { comLock_(function () { aba_('Metas_Lider').getRange(row, 18).setValue(''); }); });
    return false;
  }
  return true; // o carimbo Aviso_Em não está em cache: não derruba o cache de todos
}
/** Passo das 22h: reenvia os avisos que falharam (e-mail fora do ar ou cota). Destinatário inativo, de outro Hub ou inválido sai da fila (marcador), para não travar as metas novas. */
function reenviarAvisosMetas_() {
  if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) return 0; // sem cota: não gasta o orçamento de tempo do passo das 22h
  const hoje = hoje_(), us = lerBruto_('Cad_Usuarios'), pf = perfis_();
  const pend = lerBruto_('Metas_Lider').filter(function (r) { return String(r.Status) === 'Ativa' && String(r.Aviso_Em || '') === '' && String(r.Fim) >= hoje; }).slice(0, 50);
  let n = 0;
  pend.forEach(function (r) {
    const email = emailDe_(r.Lider_Email), u = us.find(function (x) { return emailDe_(x.Email_Google) === email; });
    const valido = emailValido_(email) && u && ativo_(u) && pf[String(u.Perfil).trim()] && String(u.Hub || '').trim() === String(r.Hub || '').trim();
    if (!valido) { comLock_(function () { aba_('Metas_Lider').getRange(r._row, 18).setNumberFormat('@').setValue('sem destino'); }); return; }
    if (avisarMetaLider_(r._row, String(r.ID_Meta), email, String(r.Inicio), String(r.Fim), Number(r.Quantidade))) n++;
  });
  return n;
}

/* ============================================================
   Fase 3: feedback obrigatório (Feedback_Pendencias e Feedback_Registros).
   Gatilho: 3 ou mais auditorias abaixo da nota média nos últimos 30 dias, cada auditoria contando uma única vez (cobertura).
   O Site Leader (ou o Admin) designa quem dá o feedback; a pessoa designada registra o texto (mínimo de 50 caracteres).
   A prova é a aba Feedback_Registros: só de acréscimo, com hash encadeado, e-mail vindo da sessão e quem designou.
   ============================================================ */
const FB_MIN = 3;
const FB_JANELA = 30;
const FB_PRAZO_DIAS = 7;
const FB_TEXTO_MIN = 50;
const FB_TEXTO_MAX = 2000;
const FB_ORCAMENTO_MS = 200000;
const MAIL_FB = {
  pt: { assunto: 'Feedback obrigatório designado a você - Process Check', titulo: 'Você tem um feedback obrigatório', ola: 'Olá, ', corpo: 'Você foi designado(a) para dar um feedback obrigatório a um colaborador, com prazo até {d}. Abra Meus feedbacks para ver os detalhes e registrar.', botao: 'Abrir Meus feedbacks', rodape: 'Mensagem automática. Não é necessário responder.' },
  en: { assunto: 'Mandatory feedback assigned to you - Process Check', titulo: 'You have a mandatory feedback', ola: 'Hello, ', corpo: 'You were assigned to give mandatory feedback to an employee by {d}. Open My feedbacks to see the details and record it.', botao: 'Open My feedbacks', rodape: 'Automatic message. No reply is needed.' },
  es: { assunto: 'Feedback obligatorio asignado a usted - Process Check', titulo: 'Tiene un feedback obligatorio', ola: 'Hola, ', corpo: 'Usted fue designado(a) para dar un feedback obligatorio a un colaborador, con plazo hasta {d}. Abra Mis feedbacks para ver los detalles y registrarlo.', botao: 'Abrir Mis feedbacks', rodape: 'Mensaje automático. No es necesario responder.' }
};

function normalizarTextoFb_(t) {
  return String(t == null ? '' : t).normalize('NFKC').replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '').replace(/\s+/g, ' ').trim();
}
/** Piso de qualidade: tamanho, palavras, variedade e não repetir uma palavra. A qualidade de verdade é de revisão humana. Devolve '' se válido. */
function validarTextoFb_(txt) {
  if (txt.length < FB_TEXTO_MIN) return 'O feedback precisa ter pelo menos 50 caracteres.';
  if (txt.length > FB_TEXTO_MAX) return 'O feedback pode ter no máximo 2000 caracteres.';
  if (/^[=+\-@]/.test(txt)) return 'O texto não pode começar com = + - @.';
  const pal = txt.toLowerCase().split(' '), cont = {};
  let maior = 0;
  pal.forEach(function (w) { cont[w] = (cont[w] || 0) + 1; if (cont[w] > maior) maior = cont[w]; });
  const distintos = {}; txt.toLowerCase().replace(/\s/g, '').split('').forEach(function (c) { distintos[c] = 1; });
  if (pal.length < 8 || Object.keys(distintos).length < 12 || maior / pal.length > 0.4) return 'Descreva o que foi conversado com o colaborador, com pelo menos 8 palavras, sem repetir sempre as mesmas.';
  return '';
}
function hashRegistroFb_(prev, l) { return sha_(String(prev) + '|' + JSON.stringify([l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], l[8], l[10], sha_(String(l[9]))])); }
/** Âncora fora da planilha (quantidade e último hash): apagar as últimas linhas ou reescrever a cadeia deixa de passar despercebido. */
function ancoraFb_(novo) {
  const pr = PropertiesService.getScriptProperties();
  if (novo === undefined) { const v = String(pr.getProperty('fbAncora') || '').split(':'); return v.length === 2 && Number(v[0]) > 0 ? { n: Number(v[0]), h: v[1] } : null; }
  if (novo === null) pr.deleteProperty('fbAncora'); else pr.setProperty('fbAncora', novo.n + ':' + novo.h);
}
/** A cadeia inteira (todos os Hubs): cada linha aponta para a anterior e a âncora confere o fim. Devolve a primeira linha adulterada, ou 0. */
function verificarCadeiaFb_() {
  const rs = lerBruto_('Feedback_Registros'), anc = ancoraFb_();
  let prev = '';
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i], l = [r.ID_Reg, r.ID_Pend, r.Colaborador, r.Time_Snap, r.Turno_Snap, r.Autor_Email, r.Autor_Nome, r.Designado_Por, r.Designado_Em, r.Texto, r.Registrado_Em];
    if (String(r.Hash_Anterior) !== prev || String(r.Hash) !== hashRegistroFb_(prev, l)) return { total: rs.length, falha: r._row };
    prev = String(r.Hash);
  }
  if (anc && (rs.length < anc.n || String(rs[anc.n - 1].Hash) !== anc.h)) return { total: rs.length, falha: anc.n + 1 };
  return { total: rs.length, falha: 0 };
}
function verificarProvaFeedback() {
  const a = exigirObrig_(), v = verificarCadeiaFb_(), r = { ok: v.falha === 0 };
  if (!a.hubOn || a.hubGlobal) { r.total = v.total; r.linhaAdulterada = v.falha; } // a cadeia é de todos os Hubs: o detalhe só vai para quem vê todos
  return r;
}

/* ---- gatilho ---- */
/** Candidatos por colaborador ativo: auditorias abaixo da nota média nos últimos 30 dias. Leitura pesada, feita FORA do lock. */
function candidatosFb_(corte) {
  const hoje = hoje_(), de = addDias_(hoje, -(FB_JANELA - 1)), ativos = {}, por = {};
  lerDireto_('Cad_Pessoas').forEach(function (p) { if (p.Cargo === 'Colaborador' && ativo_(p)) ativos[String(p.Nome)] = 1; });
  const rows = lerHist_(de, hoje, false), colabs = lerColabs_(de, hoje);
  rows.forEach(function (r) {
    if (!(r.pct < corte)) return;
    (colabs[r.id] || (r.colab ? [{ n: r.colab, l: r.lider, t: r.turno }] : [])).forEach(function (c) {
      if (ativos[c.n]) (por[c.n] = por[c.n] || []).push({ id: r.id, d: r.ts.slice(0, 10), l: c.l, t: c.t });
    });
  });
  return por;
}
/** Cria as pendências do Hub atual. Idempotente: auditoria já coberta por qualquer pendência nunca conta de novo. Devolve quantas criou. */
function gerarPendenciasFeedback_() {
  const corte = Number(config_().NOTA_MEDIA_PCT);
  if (!isFinite(corte) || corte <= 0 || corte > 100) throw new Error('Nota média inválida na configuração: o feedback obrigatório não foi gerado.');
  const cand = candidatosFb_(corte);
  return comLock_(function () {
    const pend = lerDireto_('Feedback_Pendencias'), cobertas = {}, abertas = {}, novas = [];
    pend.forEach(function (p) { String(p.IDs_Auditorias).split('|').forEach(function (id) { if (id) cobertas[id] = 1; }); if (String(p.Status) !== 'Concluida') abertas[String(p.Colaborador)] = 1; });
    Object.keys(cand).forEach(function (nome) {
      if (abertas[nome]) return;
      const l = cand[nome].filter(function (x) { return !cobertas[x.id]; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      if (l.length < FB_MIN) return;
      const ult = l[l.length - 1], ids = l.map(function (x) { return x.id; });
      novas.push(['FBK-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000) + '-' + novas.length, limpar_(nome + '|' + ids[0] + '|' + ids[ids.length - 1]), limpar_(nome), limpar_(ult.l), limpar_(ult.t), l[0].d, ult.d, l.length, ids.join('|'), corte, agora_(), 'Aberta', '', '', '', '', '', '', '']);
    });
    if (novas.length) { anexarLinhas_('Feedback_Pendencias', novas); limparCache_(); regSeguro_({ nome: 'Sistema', email: 'sistema', perfil: 'Sistema', hub: hubAtual_() }, 'Feedback obrigatório gerado', novas.length + ' colaborador(es)', 'Nota de corte ' + corte); }
    return novas.length;
  });
}
/** Passo das 22h: roda o gatilho em cada Hub ativo (ou uma vez, com Hubs desligados). Restaura o contexto ao final. */
function gerarFeedbackTodosHubs_() {
  const antes = HUB_CTX, ini = Date.now(); let n = 0;
  const um = function (ctx) { HUB_CTX = ctx; try { n += gerarPendenciasFeedback_(); } catch (e) { falhaLog_('gatilho de feedback (Hub ' + (ctx.hub || '-') + ')', e); } };
  try {
    if (hubsLigado_()) {
      const hubs = lerBruto_('Cad_Hubs').filter(hubAtivoHub_), off = hubs.length ? Math.floor(Date.now() / 864e5) % hubs.length : 0; // rodízio diário: um Hub lento não deixa os últimos sem gerar
      for (let i = 0; i < hubs.length; i++) { if (Date.now() - ini > FB_ORCAMENTO_MS) { falhaLog_('gatilho de feedback', new Error('Tempo esgotado; os Hubs restantes ficam para a próxima execução.')); break; } um({ on: true, hub: String(hubs[(i + off) % hubs.length].ID_Hub), global: false }); }
    } else um({ on: false, hub: '', global: false });
  } finally { HUB_CTX = antes; }
  return n;
}

/* ---- leitura ---- */
function pendOut_(p, hoje, pessoas) {
  const atual = pessoas[String(p.Colaborador)] || null, prazo = String(p.Prazo || '');
  return { id: String(p.ID_Pend), colaborador: String(p.Colaborador), timeEpoca: String(p.Time_Snap), turnoEpoca: String(p.Turno_Snap), timeAtual: atual ? String(atual.Lider) : '', turnoAtual: atual ? String(atual.Turno) : '',
    ini: String(p.Janela_Ini), fim: String(p.Janela_Fim), qtd: Number(p.Qtd), corte: Number(p.Nota_Corte), status: String(p.Status), geradaEm: String(p.Gerada_Em),
    designadoEmail: emailDe_(p.Designado_Email), designadoNome: String(p.Designado_Nome || ''), designadoPor: String(p.Designado_Por || ''), designadoEm: String(p.Designado_Em || ''),
    prazo: prazo, atrasado: String(p.Status) === 'Designada' && prazo !== '' && prazo < hoje, visto: String(p.Visto_Em || '') !== '', avisoPendente: String(p.Status) === 'Designada' && String(p.Aviso_Em || '') === '' };
}
function auditoriasDasPend_(pends, comAuditor) {
  const out = {};
  if (!pends.length) return out;
  const de = pends.reduce(function (x, p) { return p.ini < x ? p.ini : x; }, pends[0].ini), ate = pends.reduce(function (x, p) { return p.fim > x ? p.fim : x; }, pends[0].fim);
  const rows = lerHist_(de, ate, false), porId = {}; rows.forEach(function (r) { porId[r.id] = r; });
  pends.forEach(function (p) {
    out[p.id] = String(p.ids).split('|').filter(Boolean).map(function (id) { const r = porId[id]; return r ? (comAuditor ? { data: r.ts.slice(0, 10), proc: r.proc, pct: r.pct, aud: r.email } : { data: r.ts.slice(0, 10), proc: r.proc, pct: r.pct }) : null; }).filter(Boolean);
  });
  return out;
}
function designaveisFb_(a) {
  return usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).filter(function (u) { return ativo_(u) && (!a.hubOn || String(u.Hub || '').trim() === a.hub); });
}
/** Textos já registrados, indexados por pendência (uma leitura só, e só das pendências pedidas). */
function registrosDe_(ids) {
  const m = {}; if (!ids.length) return m;
  const q = {}; ids.forEach(function (i) { q[i] = 1; });
  const sh = aba_('Feedback_Registros'), n = Math.max(0, sh.getLastRow() - 1);
  if (!n) return m;
  const col = sh.getRange(2, 2, n, 1).getValues();
  for (let i = 0; i < n; i++) { // lê só a coluna do ID e depois apenas as linhas pedidas (nunca a aba inteira com os textos)
    const id = String(col[i][0]); if (!q[id] || m[id]) continue;
    const x = sh.getRange(i + 2, 1, 1, 11).getValues()[0];
    m[id] = { texto: String(x[9]), registradoEm: tsStr_(x[10]), autor: String(x[6]), autorEmail: emailDe_(x[5]) };
  }
  return m;
}
function listarFeedbacks() {
  const a = exigirObrig_(), hoje = hoje_(), c = CacheService.getScriptCache(), kg = 'fbgen:' + (a.hub || '-');
  if (!c.get(kg)) { try { gerarPendenciasFeedback_(); } catch (e) { falhaLog_('gatilho de feedback', e); } c.put(kg, '1', 300); }
  const pessoas = {}; lerDireto_('Cad_Pessoas').forEach(function (p) { pessoas[String(p.Nome)] = p; });
  const lim = addDias_(hoje, -90);
  const brutas = lerDireto_('Feedback_Pendencias').filter(function (p) { return String(p.Status) !== 'Concluida' || String(p.Gerada_Em).slice(0, 10) >= lim; });
  const ps = brutas.map(function (p) { const o = pendOut_(p, hoje, pessoas); o.ids = String(p.IDs_Auditorias); return o; }), aud = auditoriasDasPend_(ps, true), regs = registrosDe_(ps.filter(function (o) { return o.status === 'Concluida'; }).map(function (o) { return o.id; }));
  return { ok: true, hoje: hoje, prazoDias: FB_PRAZO_DIAS, minimo: FB_MIN, janela: FB_JANELA,
    pendencias: ps.map(function (o) { delete o.ids; const l = aud[o.id] || []; o.auditores = l.map(function (x) { return x.aud; }).filter(function (x, i, v) { return x && v.indexOf(x) === i; }); o.auditorias = l.map(function (x) { return { data: x.data, proc: x.proc, pct: x.pct }; }); o.registro = regs[o.id] || null; return o; }),
    responsaveis: designaveisFb_(a).map(function (u) { return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil) }; }) };
}
function meusFeedbacks() {
  const a = exigirAcesso_(), hoje = hoje_(), lim = addDias_(hoje, -60), pessoas = {};
  lerDireto_('Cad_Pessoas').forEach(function (p) { pessoas[String(p.Nome)] = p; });
  const brutas = lerDireto_('Feedback_Pendencias').filter(function (p) { return emailDe_(p.Designado_Email) === a.email && (String(p.Status) === 'Designada' || (String(p.Status) === 'Concluida' && String(p.Designado_Em).slice(0, 10) >= lim)); });
  const ps = brutas.map(function (p) { const o = pendOut_(p, hoje, pessoas); o.ids = String(p.IDs_Auditorias); return o; }), aud = auditoriasDasPend_(ps), regs = registrosDe_(ps.filter(function (o) { return o.status === 'Concluida'; }).map(function (o) { return o.id; }));
  return ps.map(function (o) {
    delete o.ids; delete o.designadoEmail; o.auditorias = aud[o.id] || []; o.registro = regs[o.id] || null; return o;
  });
}
function marcarFeedbacksVistos() {
  const a = exigirAcesso_();
  return comLock_(function () {
    const s = aba_('Feedback_Pendencias'), novas = lerDireto_('Feedback_Pendencias').filter(function (p) { return emailDe_(p.Designado_Email) === a.email && String(p.Status) === 'Designada' && String(p.Visto_Em || '') === ''; });
    novas.forEach(function (p) { s.getRange(p._row, 18).setNumberFormat('@').setValue(agora_()); });
    if (novas.length) limparContadores_(a);
    return { ok: true, vistos: novas.length };
  });
}
/** Contadores do menu (um só cálculo por usuário, em cache por versão dos dados). */
function resumoFb_(a) {
  const c = CacheService.getScriptCache(), k = 'fb:' + hv_() + ':' + (a.hub || '') + ':' + a.email, v = c.get(k);
  if (v) return JSON.parse(v);
  const hoje = hoje_(), r = { fbMeus: 0, fbMeusNovos: 0, fbMeusAtrasados: 0, fbTotalMeus: 0, fbAtrasadosHub: 0, fbAbertasHub: 0 };
  const lim = addDias_(hoje, -60);
  lerDireto_('Feedback_Pendencias').forEach(function (p) {
    const meu = emailDe_(p.Designado_Email) === a.email, des = String(p.Status) === 'Designada', atras = des && String(p.Prazo) !== '' && String(p.Prazo) < hoje;
    if (meu && (des || (String(p.Status) === 'Concluida' && String(p.Designado_Em).slice(0, 10) >= lim))) r.fbTotalMeus++;
    if (meu && des) { r.fbMeus++; if (String(p.Visto_Em || '') === '') r.fbMeusNovos++; if (atras) r.fbMeusAtrasados++; }
    if (tem_(a, 'obrigacoes')) { if (atras) r.fbAtrasadosHub++; if (String(p.Status) === 'Aberta') r.fbAbertasHub++; }
  });
  try { c.put(k, JSON.stringify(r), 120); } catch (e) { /* sem cache */ }
  return r;
}
/** O login nunca pode falhar por causa dos contadores de feedback. */
function resumoFbSeguro_(a) { try { return resumoFb_(a); } catch (e) { falhaLog_('contadores de feedback', e); return { fbMeus: 0, fbMeusNovos: 0, fbMeusAtrasados: 0, fbTotalMeus: 0, fbAtrasadosHub: 0, fbAbertasHub: 0 }; } }
function contarFeedbacks() { return resumoFb_(exigirAcesso_()); }

/* ---- designar e registrar ---- */
function designarFeedback(id, email) {
  const a = exigirObrig_(), alvo = emailDe_(email);
  let linhaN = 0, nova = null;
  const r = comLock_(function () {
    const p = lerDireto_('Feedback_Pendencias').find(function (x) { return String(x.ID_Pend) === String(id); });
    if (!p || String(p.Status) === 'Concluida') return { ok: false, msg: 'Pendência não encontrada ou já concluída. Atualize a tela.' };
    const u = designaveisFb_(a).find(function (x) { return emailDe_(x.Email_Google) === alvo; });
    if (!u) return { ok: false, msg: 'Pessoa não encontrada ou inativa neste Hub.' };
    const s = aba_('Feedback_Pendencias'), antes = s.getRange(p._row, 12, 1, 8).getValues(), prazo = addDias_(hoje_(), FB_PRAZO_DIAS);
    s.getRange(p._row, 12, 1, 8).setNumberFormat('@').setValues([['Designada', alvo, limpar_(String(u.Nome)), limpar_(a.email), agora_(), prazo, '', '']]);
    try { registrar_(a, String(p.Status) === 'Designada' ? 'Feedback reatribuído' : 'Feedback designado', alvo, 'Pendência ' + p.ID_Pend + '; prazo ' + prazo); } catch (e) { falhaLog_('designar feedback', e); desfazer_(function () { s.getRange(p._row, 12, 1, 8).setValues(antes); }); throw new Error('Não foi possível registrar a designação no log; nada foi alterado. Tente de novo.'); }
    limparCache_(); linhaN = p._row; nova = { id: String(p.ID_Pend), prazo: prazo };
    return { ok: true };
  });
  if (!r.ok) return r;
  const env = avisarFeedback_(linhaN, nova.id, alvo, nova.prazo);
  try { return Object.assign(listarFeedbacks(), { ok: true, emailEnviado: env }); } catch (e) { falhaLog_('listar após designar', e); return { ok: true, emailEnviado: env, recarregar: true }; }
}
function registrarFeedback(id, texto) {
  const a = exigirAcesso_(), txt = normalizarTextoFb_(texto), erro = validarTextoFb_(txt);
  if (erro) return { ok: false, msg: erro };
  const r = comLock_(function () {
    const MSG = 'Feedback não encontrado ou não designado a você. Atualize a tela.';
    const p = lerDireto_('Feedback_Pendencias').find(function (x) { return String(x.ID_Pend) === String(id); });
    if (!p || String(p.Status) !== 'Designada' || emailDe_(p.Designado_Email) !== a.email) return { ok: false, msg: MSG };
    const sr = aba_('Feedback_Registros'), n = Math.max(0, sr.getLastRow() - 1);
    if (n && sr.getRange(2, 2, n, 1).getValues().some(function (x) { return String(x[0]) === String(p.ID_Pend); })) { aba_('Feedback_Pendencias').getRange(p._row, 12).setValue('Concluida'); limparCache_(); return { ok: false, msg: 'Este feedback já foi registrado.' }; }
    const ini = Math.max(2, n + 2 - 500), cnt = n + 2 - ini; // texto repetido: confere os últimos 500 registros (qualquer Hub)
    if (n && sr.getRange(ini, 6, cnt, 5).getValues().some(function (x) { return emailDe_(x[0]) === a.email && normalizarTextoFb_(x[4]) === txt; })) return { ok: false, msg: 'Este texto é igual a um feedback que você já registrou. Escreva o que foi conversado com este colaborador.' };
    const prev = n ? String(sr.getRange(n + 1, 13).getValue()) : '', ancAntes = ancoraFb_();
    const linha = ['FBR-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000), String(p.ID_Pend), String(p.Colaborador), String(p.Time_Snap), String(p.Turno_Snap), a.email, limpar_(a.nome), String(p.Designado_Por), String(p.Designado_Em), txt, agora_(), prev, ''];
    linha[12] = hashRegistroFb_(prev, linha);
    const linhaN = anexar_('Feedback_Registros', linha), s = aba_('Feedback_Pendencias');
    try {
      s.getRange(p._row, 12).setValue('Concluida');
      ancoraFb_({ n: n + 1, h: linha[12] });
      registrar_(a, 'Feedback registrado', String(p.Colaborador), 'Pendência ' + p.ID_Pend + '; prova ' + linha[12].slice(0, 16));
    } catch (e) { falhaLog_('registrar feedback', e); desfazer_(function () { aba_('Feedback_Registros').deleteRow(linhaN); s.getRange(p._row, 12).setValue('Designada'); ancoraFb_(ancAntes); }); throw new Error('Não foi possível registrar o feedback no log; nada foi salvo. Tente de novo.'); }
    limparCache_();
    return { ok: true };
  });
  if (!r.ok) return r;
  try { return { ok: true, feedbacks: meusFeedbacks() }; } catch (e) { falhaLog_('listar após registrar', e); return { ok: true, recarregar: true }; }
}

/* ---- e-mail do feedback (sem nome do colaborador, nota ou texto livre) ---- */
function avisarFeedback_(row, id, email, prazo) {
  if (!emailValido_(email) || /[,;<>"\r\n]/.test(email)) return false;
  const reservou = comLock_(function () {
    const c = aba_('Feedback_Pendencias').getRange(row, 1, 1, 19).getValues()[0];
    if (String(c[0]) !== String(id) || String(c[11]) !== 'Designada' || String(c[19 - 1]) !== '') return false;
    aba_('Feedback_Pendencias').getRange(row, 19).setNumberFormat('@').setValue(agora_());
    return true;
  });
  if (!reservou) return false;
  try {
    if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) throw new Error('Cota diária de e-mail quase esgotada.');
    const sol = lerAba_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === email; }).pop(), m = MAIL_FB[idiomaOk_(sol && sol.Idioma)];
    enviarAviso_(email, m, m.corpo.replace('{d}', dataBr_(prazo)));
  } catch (e) {
    falhaLog_('aviso de feedback', e);
    desfazer_(function () { comLock_(function () { aba_('Feedback_Pendencias').getRange(row, 19).setValue(''); }); });
    return false;
  }
  return true;
}
function reenviarAvisosFeedback_() {
  if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) return 0;
  const hoje = hoje_(), us = lerBruto_('Cad_Usuarios'), pf = perfis_();
  const pend = lerBruto_('Feedback_Pendencias').filter(function (r) { return String(r.Status) === 'Designada' && String(r.Aviso_Em || '') === ''; }).slice(0, 50);
  let n = 0;
  pend.forEach(function (r) {
    const email = emailDe_(r.Designado_Email), u = us.find(function (x) { return emailDe_(x.Email_Google) === email; });
    const valido = emailValido_(email) && u && ativo_(u) && pf[String(u.Perfil).trim()] && String(u.Hub || '').trim() === String(r.Hub || '').trim();
    if (!valido) { comLock_(function () { aba_('Feedback_Pendencias').getRange(r._row, 19).setNumberFormat('@').setValue('sem destino'); }); return; }
    if (avisarFeedback_(r._row, String(r.ID_Pend), email, String(r.Prazo))) n++;
  });
  return n;
}
