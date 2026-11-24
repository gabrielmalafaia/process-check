/* ============================================================
   Log de atividade (v8), aviso de transparência com aceite e arquivo.
   - Só ações de escrita. Gravação sempre feita pelo servidor, só de acréscimo, dentro do lock.
   - Leitura: Admin global vê todos os Hubs; os demais só o próprio Hub. Permissão ver_log.
   - Arquivo: registros com mais de LOG_VIVO_DIAS vão para uma planilha separada (ID em LOG_ARQUIVO_ID), que guarda até LOG_ANO_DIAS.
   ============================================================ */
const LOG_VIVO_DIAS = 90;
const LOG_ANO_DIAS = 365;
const LOG_PAGINA = 50;
const LOG_LEITURA_MAX = 6000;
const AVISO_LOG = {
  pt: 'O sistema registra as ações de gravação feitas por cada usuário (quem, quando e o quê) para fins de auditoria e segurança. O registro fica disponível apenas para quem tem permissão, é mantido por até 1 ano e não inclui senhas nem o conteúdo de e-mails.',
  en: 'The system records the write actions made by each user (who, when and what) for audit and security purposes. The record is available only to people with permission, is kept for up to 1 year and does not include passwords or e-mail contents.',
  es: 'El sistema registra las acciones de escritura realizadas por cada usuario (quién, cuándo y qué) con fines de auditoría y seguridad. El registro solo está disponible para quien tiene permiso, se conserva hasta 1 año y no incluye contraseñas ni el contenido de los correos.'
};
function avisoVersao_() { return hash_(JSON.stringify([AVISO_LOG.pt, AVISO_LOG.en, AVISO_LOG.es])); }
function avisoLigado_() { return flagScript_('ACEITE_ATIVO'); }
/** O usuário já aceitou a versão atual do aviso? (cache de 6 h; o aceite é gravado em Log_Aceites, só de acréscimo) */
function aceiteOk_(a) {
  if (!avisoLigado_()) return true;
  const v = avisoVersao_(), c = CacheService.getScriptCache(), k = 'ace:' + a.email + ':' + v;
  if (c.get(k)) return true;
  const ok = lerBruto_('Log_Aceites').some(function (r) { return emailDe_(r.Email) === a.email && String(r.Versao_Texto) === v; });
  if (ok) c.put(k, '1', 21600);
  return ok;
}
function aceitarAviso(versao) {
  const a = acesso_(true);
  if (!a.ok) throw new Error('Acesso negado.');
  const v = avisoVersao_();
  if (String(versao) !== v) return { ok: false, msg: 'O texto do aviso mudou. Leia a nova versão.' };
  comLock_(function () {
    if (!lerBruto_('Log_Aceites').some(function (r) { return emailDe_(r.Email) === a.email && String(r.Versao_Texto) === v; })) {
      anexar_('Log_Aceites', [agora_(), limpar_(a.email), limpar_(a.nome), v, a.hub || '']);
      logAtiv_(a, 'Aviso de transparência aceito', v, '');
    }
  });
  CacheService.getScriptCache().put('ace:' + a.email + ':' + v, '1', 21600);
  return { ok: true };
}
function avisoResumo_(a) { return avisoLigado_() ? { versao: avisoVersao_(), texto: AVISO_LOG, aceito: aceiteOk_(a) } : { versao: '', texto: AVISO_LOG, aceito: true, desligado: true }; }
/** Registra uma ação de escrita. Nunca derruba a operação principal. */
/** Conta as falhas de gravação do log para a tela de Log avisar (nada fica mudo). */
function contarFalhaLog_() { try { const p = PropertiesService.getScriptProperties(); p.setProperty('LOG_FALHAS', String(Number(p.getProperty('LOG_FALHAS') || 0) + 1)); } catch (e) { /* sem propriedades */ } }
function logAtiv_(a, acao, alvo, detalhe, hubLog) {
  try {
    comLock_(function () {
      anexar_('Log_Atividade', [agora_(), limpar_(hubLog !== undefined ? hubLog : (a.hub || '')), limpar_(a.email || ''), limpar_(a.nome || ''), limpar_(a.perfil || ''), limpar_(String(acao).slice(0, 120)), limpar_(String(alvo == null ? '' : alvo).slice(0, 200)), limpar_(String(detalhe == null ? '' : detalhe).slice(0, 600))]);
    });
  } catch (e) { console.error('Falha ao gravar o log de atividade (' + acao + '): ' + e.message); contarFalhaLog_(); /* o log não pode impedir a ação já concluída */ }
}
/** Consulta paginada do log vivo (mais recente primeiro). Site Leader e demais: só o próprio Hub. */
function consultarLog(f) {
  const a = exigirPerm_('ver_log');
  f = f || {};
  const s = aba_('Log_Atividade'), total = Math.max(s.getLastRow() - 1, 0);
  const ini = Math.max(2, total + 2 - LOG_LEITURA_MAX), qtd = total + 2 - ini;
  const cab = ABAS.Log_Atividade;
  let linhas = qtd > 0 ? s.getRange(ini, 1, qtd, cab.length).getValues() : [];
  const txt = function (v) { return String(v == null ? '' : v).trim().toLowerCase().slice(0, 120); };
  const email = txt(f.email), acao = txt(f.acao), de = /^\d{4}-\d{2}-\d{2}$/.test(String(f.de || '')) ? f.de : '', ate = /^\d{4}-\d{2}-\d{2}$/.test(String(f.ate || '')) ? f.ate : '';
  const hubF = a.hubOn && !a.hubGlobal ? a.hub : (a.hubOn ? String(f.hub || '') : '');
  if (a.hubOn && !a.hubGlobal && !a.hub) linhas = [];
  linhas = linhas.map(function (r) { return { ts: tsStr_(r[0]), hub: String(r[1]), email: String(r[2]), nome: String(r[3]), perfil: String(r[4]), acao: String(r[5]), alvo: String(r[6]), detalhe: String(r[7]) }; })
    .filter(function (r) {
      if (hubF && r.hub !== hubF) return false;
      if (email && r.email.toLowerCase().indexOf(email) < 0 && r.nome.toLowerCase().indexOf(email) < 0) return false;
      if (acao && r.acao.toLowerCase().indexOf(acao) < 0) return false;
      if (de && r.ts.slice(0, 10) < de) return false;
      if (ate && r.ts.slice(0, 10) > ate) return false;
      return true;
    }).reverse();
  const pagina = Math.max(1, Math.floor(Number(f.pagina)) || 1);
  const hubs = {};
  lerAba_('Cad_Hubs').forEach(function (h) { hubs[String(h.ID_Hub)] = String(h.Nome); });
  return { total: linhas.length, pagina: pagina, porPagina: LOG_PAGINA, linhas: linhas.slice((pagina - 1) * LOG_PAGINA, pagina * LOG_PAGINA).map(function (r) { r.hubNome = hubs[r.hub] || (r.hub === HUB_GLOBAL ? '' : r.hub); return r; }), truncado: total > LOG_LEITURA_MAX, falhasLog: Number(PropertiesService.getScriptProperties().getProperty('LOG_FALHAS') || 0), vivoDias: LOG_VIVO_DIAS, anoDias: LOG_ANO_DIAS, global: !!a.hubGlobal };
}
/* ---------- arquivo em planilha separada ---------- */
function arquivoLog_() {
  const pr = PropertiesService.getScriptProperties();
  let id = pr.getProperty('LOG_ARQUIVO_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('Process Check - arquivo do log');
  pr.setProperty('LOG_ARQUIVO_ID', ss.getId());
  return ss;
}
/** Move os registros com mais de LOG_VIVO_DIAS para o arquivo e apaga do arquivo o que passou de LOG_ANO_DIAS. Só apaga do log vivo depois de conferir a cópia. */
function arquivarLogCore_() {
  return comLock_(function () {
    const s = aba_('Log_Atividade'), n = s.getLastRow() - 1, rel = { movidos: 0, apagadosArquivo: 0, erro: '' };
    if (n < 1) return rel;
    const corte = fmt_(new Date(Date.now() - LOG_VIVO_DIAS * 864e5)), cab = ABAS.Log_Atividade.length;
    const ts = s.getRange(2, 1, n, 1).getValues().map(function (r) { return tsStr_(r[0]); });
    let k = 0;
    while (k < n && ts[k] && ts[k] < corte) k++;
    if (k > 0) {
      let arq;
      try { arq = arquivoLog_(); } catch (e) { rel.erro = 'Arquivo indisponível: ' + String(e.message).slice(0, 160); return rel; }
      let dest = arq.getSheetByName('Log_Atividade');
      if (!dest) { dest = arq.insertSheet('Log_Atividade'); dest.appendRow(ABAS.Log_Atividade); }
      const antes = dest.getLastRow(), v = s.getRange(2, 1, k, cab).getValues();
      if (antes + k > dest.getMaxRows()) dest.insertRowsAfter(dest.getMaxRows(), antes + k - dest.getMaxRows()); // a aba nova só tem 1000 linhas
      dest.getRange(antes + 1, 1, k, cab).setNumberFormat('@').setValues(v);
      if (dest.getLastRow() - antes !== k) { rel.erro = 'A cópia não bateu com o original; nada foi apagado.'; return rel; }
      s.deleteRows(2, k);
      rel.movidos = k;
    }
    // rascunhos vencidos nunca eram apagados e a Matriz lê a aba inteira
    try {
      const rs = aba_('Auditorias_Rascunho'), lim = Date.now() - (RASCUNHO_DIAS + 1) * 864e5;
      lerBruto_('Auditorias_Rascunho').filter(function (x) { return d_(x.Timestamp_Inicio).getTime() < lim; }).map(function (x) { return x._row; }).sort(function (p, q) { return q - p; }).forEach(function (r) { rs.deleteRow(r); });
    } catch (e) { /* a limpeza de rascunhos não pode atrapalhar o arquivamento */ }
    // retenção prometida no aviso de transparência: o arquivo guarda no máximo LOG_ANO_DIAS dias
    try {
      const arq2 = arquivoLog_(), d2 = arq2.getSheetByName('Log_Atividade');
      if (d2 && d2.getLastRow() > 1) {
        const corteAno = fmt_(new Date(Date.now() - LOG_ANO_DIAS * 864e5)), t2 = d2.getRange(2, 1, d2.getLastRow() - 1, 1).getValues();
        let velhos = 0; while (velhos < t2.length && t2[velhos][0] !== '' && tsStr_(t2[velhos][0]) < corteAno) velhos++;
        if (velhos > 0) { d2.deleteRows(2, velhos); rel.apagadosArquivo = velhos; }
      }
    } catch (e) { if (!rel.erro) rel.erro = 'Não foi possível limpar o arquivo antigo: ' + String(e.message).slice(0, 160); }
    return rel;
  });
}
function arquivarLog() {
  // só o dono ou o gatilho diário (sem identidade): impede que qualquer conta do domínio dispare a rotina pelo navegador
  const ativo = (Session.getActiveUser().getEmail() || '').trim().toLowerCase(), dono = (Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (ativo && ativo !== dono) throw new Error('Acesso negado.');
  const rel = arquivarLogCore_();
  if (rel.erro) { try { registrar_({ nome: 'Sistema', email: 'sistema' }, 'Falha ao arquivar o log', 'Log_Atividade', rel.erro); } catch (e) { /* segue */ } }
  return rel;
}
/** Roda no editor (Admin): instala o gatilho diário que arquiva o log e pede a autorização do Google uma única vez. */
function agendarArquivoLog() {
  manutencao_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'arquivarLog') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('arquivarLog').timeBased().everyDays(1).atHour(3).create();
  arquivoLog_();
  return 'Gatilho diário do arquivo do log instalado.';
}
/** Liga o aviso de transparência com aceite (rodar no editor, depois de publicar a versão com a tela de aceite). */
function ativarAvisoLog() {
  manutencao_();
  PropertiesService.getScriptProperties().setProperty('ACEITE_ATIVO', 'Sim'); limparFlag_('ACEITE_ATIVO');
  return 'Aviso de transparência ligado: cada usuário precisa aceitar a versão atual.';
}
