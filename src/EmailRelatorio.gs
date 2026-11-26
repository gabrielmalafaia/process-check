/* ============================================================
   Relatório por e-mail, gatilhos agendados e passo noturno.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ---------- relatório por e-mail (v7) ---------- */
const MAIL_REL = {
  pt: {
    assunto: 'Relatório de auditorias - Process Check', titulo: 'Relatório de auditorias', periodo: 'Período', escopo: 'Dados do seu perfil',
    todos: 'Todos os dados', time: 'Equipe de {0}', proprias: 'Somente as auditorias que você realizou', so: 'Somente {0}',
    total: 'Auditorias', media: 'Nota média', meta: 'Meta', conf: 'Em conformidade', obs: 'Em observação', bad: 'Em inconformidade', crit: 'Com item crítico reprovado', pend: 'Sem auditoria no período',
    vs: 'vs. período anterior', semBase: 'sem base de comparação', pp: 'Pontos', pr: 'Por processo', col: 'Processo', n: 'Auditorias', nota: 'Média', of: 'Principais ofensores', ofLinha: '{0} falhas em {1} auditorias ({2}%)',
    aten: 'Prioridade de verificação', vazio: 'Nenhuma auditoria no seu escopo neste período.', botao: 'Abrir o sistema', rodape: 'Você recebe este e-mail porque foi incluído(a) no envio de relatórios. Ele mostra apenas os dados que o seu perfil autoriza. Para sair da lista, fale com o administrador do sistema.',
    freq: { Diario: 'diário', Semanal: 'semanal', Mensal: 'mensal' }
  },
  en: {
    assunto: 'Audit report - Process Check', titulo: 'Audit report', periodo: 'Period', escopo: 'Data of your profile',
    todos: 'All data', time: 'Team of {0}', proprias: 'Only the audits you performed', so: 'Only {0}',
    total: 'Audits', media: 'Average score', meta: 'Target', conf: 'Compliant', obs: 'Under observation', bad: 'Non-compliant', crit: 'With failed critical item', pend: 'Not audited in the period',
    vs: 'vs. previous period', semBase: 'no baseline to compare', pp: 'pts', pr: 'By process', col: 'Process', n: 'Audits', nota: 'Average', of: 'Top offenders', ofLinha: '{0} failures in {1} audits ({2}%)',
    aten: 'Priority to check', vazio: 'No audits in your scope for this period.', botao: 'Open the system', rodape: 'You receive this e-mail because you were added to the report mailing list. It only shows the data your profile allows. To leave the list, contact the system administrator.',
    freq: { Diario: 'daily', Semanal: 'weekly', Mensal: 'monthly' }
  },
  es: {
    assunto: 'Informe de auditorías - Process Check', titulo: 'Informe de auditorías', periodo: 'Período', escopo: 'Datos de su perfil',
    todos: 'Todos los datos', time: 'Equipo de {0}', proprias: 'Solo las auditorías que usted realizó', so: 'Solo {0}',
    total: 'Auditorías', media: 'Nota promedio', meta: 'Meta', conf: 'Conformes', obs: 'En observación', bad: 'No conformes', crit: 'Con ítem crítico reprobado', pend: 'Sin auditoría en el período',
    vs: 'vs. período anterior', semBase: 'sin base de comparación', pp: 'pts', pr: 'Por proceso', col: 'Proceso', n: 'Auditorías', nota: 'Promedio', of: 'Principales infractores', ofLinha: '{0} fallas en {1} auditorías ({2}%)',
    aten: 'Prioridad de verificación', vazio: 'No hay auditorías en su alcance en este período.', botao: 'Abrir el sistema', rodape: 'Usted recibe este correo porque fue incluido(a) en el envío de informes. Solo muestra los datos que su perfil autoriza. Para salir de la lista, hable con el administrador del sistema.',
    freq: { Diario: 'diario', Semanal: 'semanal', Mensal: 'mensual' }
  }
};
const COR_FAIXA = { verde: '#16A34A', observacao: '#F59E0B', vermelho: '#DC2626' };
function fmtMail_(t, args) { return String(t).replace(/\{(\d)\}/g, function (x, i) { return esc_(args[Number(i)]); }); }
/** Período do relatório: o dia de hoje (diário), os 7 dias (semanal) ou os 30 dias (mensal) terminando hoje. O envio agendado sai às 22h, depois das auditorias do dia. */
function periodoEmail_(freq) {
  const ate = hoje_(), dias = freq === 'Mensal' ? 30 : freq === 'Semanal' ? 7 : 1;
  return { de: addDias_(ate, -(dias - 1)), ate: ate };
}
function devidoHoje_(freq) {
  const d = new Date(hoje_() + 'T00:00:00Z');
  return freq === 'Diario' || (freq === 'Semanal' && d.getUTCDay() === 1) || (freq === 'Mensal' && d.getUTCDate() === 1);
}
function escopoTexto_(a, m) {
  const e = a.escopo;
  let t = e.modo === 'todos' ? m.todos : e.modo === 'time' ? fmtMail_(m.time, [a.nome]) : m.proprias;
  const lim = e.processos.filter(function (p) { return PROCESSOS.indexOf(p) > -1; }).concat(e.turnos);
  if (lim.length) t += ' · ' + fmtMail_(m.so, [lim.join(', ')]);
  return t;
}
/** Monta o e-mail com os dados que o perfil do DESTINATÁRIO enxerga (usa o mesmo portão único de dados dos relatórios). */
function montarEmailRel_(a, idioma, per) {
  const m = MAIL_REL[idiomaOk_(idioma)], cfg = config_(), f = filtros_({ de: per.de, ate: per.ate });
  const g = relGeral_(a, f, cfg), A = g.A, B = g.B, url = urlApp_();
  const cel = function (rot, val, cor) {
    return '<td style="padding:10px 8px;text-align:center;border:1px solid #E4E7EB;border-radius:6px"><div style="font-size:11px;color:#6B7280">' + esc_(rot) + '</div><div style="font-size:20px;font-weight:bold;color:' + (cor || '#1F2328') + '">' + esc_(val) + '</div></td>';
  };
  const dif = A.total && B.total ? round1_(A.media - B.media) : null;
  const cmp = dif === null ? m.semBase : (dif > 0 ? '+' : '') + dif.toFixed(1) + ' ' + m.pp + ' ' + m.vs;
  const fxA = faixa_(A.media, cfg);
  const kpis = '<table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0"><tr>'
    + cel(m.total, A.total) + cel(m.media, A.total ? A.media.toFixed(1) + '%' : '-', A.total ? COR_FAIXA[fxA] : '') + cel(m.meta, cfg.NOTA_MEDIA_PCT + '%') + '</tr><tr>'
    + cel(m.conf, A.conf, COR_FAIXA.verde) + cel(m.obs, A.obs, COR_FAIXA.observacao) + cel(m.bad, A.bad, COR_FAIXA.vermelho) + '</tr><tr>'
    + cel(m.crit, A.crit) + cel(m.pend, A.pend) + '<td></td></tr></table>';
  let corpo = '';
  if (A.total) {
    const procs = PROCESSOS.filter(function (p) { return A.pp[p]; });
    corpo += '<div style="font-size:12px;color:#6B7280;margin:4px 0 12px">' + esc_(cmp) + '</div>' + kpis
      + '<div style="font-size:14px;font-weight:bold;margin:18px 0 6px">' + esc_(m.pr) + '</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;border-collapse:collapse"><tr style="color:#6B7280;font-size:11px"><td style="padding:4px 0">' + esc_(m.col) + '</td><td align="right">' + esc_(m.n) + '</td><td align="right">' + esc_(m.nota) + '</td></tr>'
      + procs.map(function (p) {
        const x = A.pp[p];
        return '<tr><td style="padding:6px 0;border-top:1px solid #EEF0F2"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + COR_FAIXA[faixa_(x.media, cfg)] + ';margin-right:8px"></span>' + esc_(p) + '</td><td align="right" style="border-top:1px solid #EEF0F2">' + x.n + '</td><td align="right" style="border-top:1px solid #EEF0F2;font-weight:bold">' + x.media.toFixed(1) + '%</td></tr>';
      }).join('') + '</table>';
    if (g.ofd.length) {
      corpo += '<div style="font-size:14px;font-weight:bold;margin:18px 0 6px">' + esc_(m.of) + '</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">'
        + g.ofd.slice(0, 5).map(function (o) {
          const t = traducoesItens_(o.proc)[o.id] || {}, nome = (idiomaOk_(idioma) === 'en' ? t.en : idiomaOk_(idioma) === 'es' ? t.es : '') || o.id;
          return '<li><b>' + esc_(o.proc + ' › ' + nome) + '</b> - ' + fmtMail_(m.ofLinha, [o.nc, o.aud, o.taxa]) + '</li>';
        }).join('') + '</ul>';
    }
    const aten = Object.keys(A.dc).map(function (k) { return [k, A.dc[k].media]; }).filter(function (x) { return x[1] < cfg.NOTA_MEDIA_PCT; }).sort(function (x, y) { return x[1] - y[1]; }).slice(0, 3);
    if (aten.length) {
      corpo += '<div style="font-size:14px;font-weight:bold;margin:18px 0 6px">' + esc_(m.aten) + '</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">'
        + aten.map(function (x) { return '<li>' + esc_(x[0]) + ' - ' + x[1].toFixed(1) + '%</li>'; }).join('') + '</ul>';
    }
  } else corpo += '<p style="font-size:14px;color:#6B7280">' + esc_(m.vazio) + '</p>';
  const intervalo = per.de === per.ate ? per.de : per.de + ' a ' + per.ate;
  const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F5F7;padding:24px 0"><tr><td align="center">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border:1px solid #E4E7EB;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1F2328">'
    + '<tr><td style="background:#D9441A;padding:18px 28px;color:#FFFFFF;font-size:15px;font-weight:bold">Process Check</td></tr>'
    + '<tr><td style="padding:26px 28px 4px"><div style="font-size:22px;font-weight:bold">' + esc_(m.titulo) + '</div>'
    + '<div style="font-size:13px;color:#6B7280;margin-top:6px">' + esc_(m.periodo) + ': ' + esc_(intervalo) + '<br>' + esc_(m.escopo) + ': ' + esc_(escopoTexto_(a, m)) + '</div></td></tr>'
    + '<tr><td style="padding:8px 28px 8px">' + corpo + '</td></tr>'
    + (url ? '<tr><td style="padding:14px 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#D9441A" style="border-radius:6px"><a href="' + esc_(url) + '" style="display:inline-block;padding:11px 22px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none">' + esc_(m.botao) + '</a></td></tr></table></td></tr>' : '')
    + '<tr><td style="padding:20px 28px 24px;font-size:11px;color:#9AA3AD;border-top:1px solid #EEF0F2">' + esc_(m.rodape) + '</td></tr></table></td></tr></table>';
  const txt = [m.titulo, m.periodo + ': ' + intervalo, m.escopo + ': ' + escopoTexto_(a, m), '',
    m.total + ': ' + A.total, m.media + ': ' + (A.total ? A.media.toFixed(1) + '%' : '-') + ' (' + m.meta + ' ' + cfg.NOTA_MEDIA_PCT + '%)', m.conf + ': ' + A.conf, m.obs + ': ' + A.obs, m.bad + ': ' + A.bad, m.crit + ': ' + A.crit, m.pend + ': ' + A.pend,
    '', url ? m.botao + ': ' + url : '', '', m.rodape].join('\n');
  return { assunto: m.assunto + ' (' + intervalo + ')', html: html, texto: txt, total: A.total };
}
function linhasEmailRel_() {
  return lerDireto_('Cad_Relatorio_Email').filter(function (r) { return String(r.Email || '').trim(); });
}
/** Envia a UM destinatário. Nunca lança erro: devolve { ok, motivo } para que uma falha não derrube os outros envios. */
function enviarUmRel_(a, reg, agendado) {
  const email = emailDe_(reg.Email), freq = FREQS.indexOf(reg.Frequencia) > -1 ? reg.Frequencia : 'Semanal';
  const ctxAntes = HUB_CTX; // acessoDe_ troca o contexto para o Hub do destinatário: quem chamou recebe o seu de volta (finally)
  try {
    const dest = acessoDe_(email);
    if (!dest.ok) return { email: email, ok: false, motivo: 'sem_acesso' };
    if (dest.telas.indexOf('geral') < 0) return { email: email, ok: false, motivo: 'sem_tela' };
    if (dest.hubOn && !dest.hub) return { email: email, ok: false, motivo: 'sem_hub' };
    if (typeof MailApp.getRemainingDailyQuota === 'function' && MailApp.getRemainingDailyQuota() < 1) return { email: email, ok: false, motivo: 'cota' };
    const per = periodoEmail_(freq), msg = montarEmailRel_(dest, reg.Idioma, per);
    MailApp.sendEmail({ to: email, subject: msg.assunto, body: msg.texto, htmlBody: msg.html, name: 'Process Check' });
    // o e-mail já saiu: se só a gravação da data falhar, o envio continua contando como feito (e a falha vai para o log).
    // Só o envio agendado grava a data: um "Enviar agora" feito de dia sai parcial e não pode bloquear o envio completo das 22h.
    if (agendado) {
      try {
        comLock_(function () { // relê dentro do lock: uma exclusão de destinatário no meio do lote desloca as linhas
          const row = lerDireto_('Cad_Relatorio_Email').find(function (x) { return emailDe_(x.Email) === email; });
          if (row) aba_('Cad_Relatorio_Email').getRange(row._row, 5).setNumberFormat('@').setValue(agora_());
        });
      } catch (e0) {
        try { registrar_(a, 'Relatório enviado, data do envio não gravada', email, String(e0 && e0.message || e0)); } catch (e00) { /* log best-effort */ }
      }
    }
    try { registrar_(a, 'Relatório por e-mail enviado', email, 'Período: ' + per.de + ' a ' + per.ate + '; Idioma: ' + idiomaOk_(reg.Idioma)); } catch (e1) { /* log best-effort */ }
    return { email: email, ok: true, motivo: '' };
  } catch (e) {
    try { registrar_(a, 'Relatório por e-mail não enviado', email, String(e && e.message || e)); } catch (e2) { /* log best-effort */ }
    return { email: email, ok: false, motivo: 'erro' };
  } finally { HUB_CTX = ctxAntes; }
}
/**
 * Gatilhos do projeto para uma função, ou null se a consulta falhar (contada no Log).
 * null é "não sei": quem decide criar ou rodar algo com base nisso não age, para não duplicar gatilho nem execução.
 */
function gatilhosDe_(funcao) {
  try { return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === funcao; }); } catch (e) { falhaLog_('consultar gatilhos de ' + funcao, e); return null; }
}
function triggerRel_() { return gatilhosDe_('enviarRelatoriosAgendados') || []; } // só para exibir na tela
function gatilhosOuErro_(funcao) {
  const g = gatilhosDe_(funcao);
  if (g === null) throw new Error('Não foi possível consultar os gatilhos do Google agora; nada foi alterado. Tente de novo em instantes.');
  return g;
}
/** Troca os gatilhos diários de uma função: cria o novo ANTES de apagar os antigos (se a criação falhar, os antigos continuam). */
function recriarGatilhoDiario_(funcao) {
  const velhos = gatilhosOuErro_(funcao);
  ScriptApp.newTrigger(funcao).timeBased().everyDays(1).atHour(HORA_ENVIO_REL).create();
  velhos.forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
function emailRelOut_(a) {
  const us = usuariosVisiveis_(a, lerAba_('Cad_Usuarios')), pf = perfis_(), por = {};
  us.forEach(function (u) { por[emailDe_(u.Email_Google)] = u; });
  const linhas = linhasEmailRel_().map(function (r) {
    const e = emailDe_(r.Email), u = por[e], p = u && pf[String(u.Perfil).trim()];
    return { email: e, nome: u ? String(u.Nome) : '', perfil: u ? String(u.Perfil) : '', freq: FREQS.indexOf(r.Frequencia) > -1 ? r.Frequencia : 'Semanal', idioma: idiomaOk_(r.Idioma), ativo: String(r.Ativo) !== 'Não', ultimo: String(r.Ultimo_Envio || ''), elegivel: !!(u && usuarioAtivo_(u) && p && p.telas.indexOf('geral') > -1) };
  });
  if (a.hubOn && !a.hubGlobal) { for (let i = linhas.length - 1; i >= 0; i--) if (!por[linhas[i].email]) linhas.splice(i, 1); } // destinatários de outros Hubs não aparecem
  const ja = {}; linhas.forEach(function (l) { ja[l.email] = 1; });
  const cand = us.filter(function (u) { const p = pf[String(u.Perfil).trim()]; return usuarioAtivo_(u) && p && p.telas.indexOf('geral') > -1 && !ja[emailDe_(u.Email_Google)]; })
    .map(function (u) { return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil) }; });
  let cota = null; try { cota = typeof MailApp.getRemainingDailyQuota === 'function' ? MailApp.getRemainingDailyQuota() : null; } catch (e) { cota = null; }
  return { ok: true, linhas: linhas, candidatos: cand, agendado: triggerRel_().length > 0, cota: cota };
}
function listarEmailRel() {
  const a = exigirPerm_('email_rel');
  return emailRelOut_(a);
}
function salvarEmailRel(obj) {
  const a = exigirPerm_('email_rel');
  obj = obj || {};
  const email = emailDe_(obj.email), freq = String(obj.freq || ''), idioma = idiomaOk_(obj.idioma), ativo = obj.ativo !== false;
  if (FREQS.indexOf(freq) < 0) return { ok: false, msg: 'Escolha a frequência.' };
  return comLock_(function () {
    const u = usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).find(function (x) { return emailDe_(x.Email_Google) === email; });
    if (!u || !usuarioAtivo_(u)) return { ok: false, msg: 'Usuário não cadastrado ou inativo.' };
    const p = perfis_()[String(u.Perfil).trim()];
    if (!p || p.telas.indexOf('geral') < 0) return { ok: false, msg: 'O perfil deste usuário não tem acesso à Visão Geral, então não pode receber o relatório.' };
    const ex = lerDireto_('Cad_Relatorio_Email').find(function (x) { return emailDe_(x.Email) === email; });
    if (ex) aba_('Cad_Relatorio_Email').getRange(ex._row, 1, 1, 4).setValues([[email, freq, idioma, ativo ? 'Sim' : 'Não']]);
    else {
      if (linhasEmailRel_().length >= 200) return { ok: false, msg: 'Limite de 200 destinatários.' };
      anexar_('Cad_Relatorio_Email', [email, freq, idioma, ativo ? 'Sim' : 'Não', '']);
    }
    registrar_(a, ex ? 'Relatório por e-mail alterado' : 'Relatório por e-mail: destinatário incluído', email, 'Frequência: ' + freq + '; Idioma: ' + idioma + '; Ativo: ' + (ativo ? 'Sim' : 'Não'));
    return Object.assign({}, emailRelOut_(a));
  });
}
function excluirEmailRel(email) {
  const a = exigirPerm_('email_rel');
  email = emailDe_(email);
  return comLock_(function () {
    const ex = lerDireto_('Cad_Relatorio_Email').find(function (x) { return emailDe_(x.Email) === email; });
    if (!ex || !emailVisivel_(a, email)) return { ok: false, msg: 'Destinatário não encontrado. Clique em Atualizar.' };
    aba_('Cad_Relatorio_Email').deleteRow(ex._row);
    registrar_(a, 'Relatório por e-mail: destinatário removido', email, '');
    return emailRelOut_(a);
  });
}
const HORA_ENVIO_REL = 22;
/**
 * Liga ou desliga o envio agendado do relatório (um gatilho diário, às 22h; cada pessoa recebe conforme a frequência escolhida).
 * Ligar recria o gatilho (troca um antigo de outro horário) e garante o gatilho do passo noturno, que é independente:
 * desligar o relatório nunca desliga metas, feedback e reenvio de avisos.
 */
function alternarAgendamentoRel(ligar) {
  const a = exigirPerm_('email_rel');
  exigirGlobal_(a);
  return comLock_(function () {
    if (ligar) {
      // passo noturno primeiro: se o relatório falhar depois, metas e feedback já ficam agendados
      if (!gatilhosOuErro_('passoNoturno').length) recriarGatilhoDiario_('passoNoturno');
      recriarGatilhoDiario_('enviarRelatoriosAgendados');
    } else gatilhosOuErro_('enviarRelatoriosAgendados').forEach(function (t) { ScriptApp.deleteTrigger(t); });
    registrar_(a, ligar ? 'Relatório por e-mail: agendamento ligado' : 'Relatório por e-mail: agendamento desligado', '', '');
    return emailRelOut_(a);
  });
}
function resumoEnvio_(res) {
  return { enviados: res.filter(function (r) { return r.ok; }).length, falhas: res.filter(function (r) { return !r.ok; }).map(function (r) { return { email: r.email, motivo: r.motivo }; }) };
}
/** Envia em lote respeitando o limite de 6 min do Apps Script: o que não couber vira falha visível ("reenvie") e não é marcado como enviado. */
function enviarLote_(ator, regs, agendado) {
  const ini = Date.now(), res = [];
  regs.forEach(function (r) {
    if (Date.now() - ini > 270000) res.push({ ok: false, email: emailDe_(r.Email), motivo: 'Tempo de execução esgotado; envie de novo.' });
    else res.push(enviarUmRel_(ator, r, agendado));
  });
  return res;
}
/** "Enviar agora": um destinatário (email) ou todos os ativos (email vazio). */
function enviarRelatorioAgora(email) {
  const a = exigirPerm_('email_rel');
  email = emailDe_(email);
  const regs = linhasEmailRel_().filter(function (r) { return String(r.Ativo) !== 'Não' && (!email || emailDe_(r.Email) === email) && emailVisivel_(a, emailDe_(r.Email)); });
  if (!regs.length) return { ok: false, msg: 'Nenhum destinatário ativo para enviar.' };
  const res = enviarLote_(a, regs);
  const out = resumoEnvio_(res);
  out.ok = true; out.dados = emailRelOut_(a);
  return out;
}
/** Limite de uma execução agendada do Apps Script é 6 min: cada rotina noturna para em 5,5 min (prazo único para todos os passos). */
const NOTURNO_PRAZO_MS = 330000;
const UMA_HORA_MS = 3600000;
/**
 * Portão das rotinas agendadas. Só o dono (no editor) ou o próprio gatilho; um gatilho antigo de antes das 22h não roda;
 * sem identidade, no máximo uma execução por hora por rotina (limita abuso). Devolve { ok, dono } ou { ok: false } para adiar.
 */
function portaoAgendado_(chaveUltima) {
  const ativo = emailDe_(Session.getActiveUser().getEmail()), dono = emailDe_(Session.getEffectiveUser().getEmail());
  if (ativo && ativo !== dono) throw new Error('Acesso negado.');
  if (!ativo && Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'H')) < HORA_ENVIO_REL) return { ok: false };
  if (!ativo) {
    const pr = PropertiesService.getScriptProperties(), ult = Number(pr.getProperty(chaveUltima) || 0);
    if (Date.now() - ult < UMA_HORA_MS) throw new Error('Acesso negado.');
    pr.setProperty(chaveUltima, String(Date.now()));
  }
  return { ok: true, dono: dono };
}
/** Passos noturnos de metas e feedback, cada um isolado: a falha de um é contada e os outros seguem. Todos param no mesmo prazo. */
function passoNoturnoCore_(prazo) {
  const passos = [
    ['reenvio de avisos de meta', function () { return reenviarAvisosMetas_(prazo); }],
    ['gatilho de feedback', function () { return gerarFeedbackTodosHubs_(prazo); }],
    ['reenvio de avisos de feedback', function () { return reenviarAvisosFeedback_(prazo); }]
  ];
  passos.forEach(function (p) {
    if (Date.now() > prazo) { falhaLog_(p[0], new Error('Tempo esgotado antes de começar; fica para a próxima execução.')); return; }
    try { p[1](); } catch (e) { falhaLog_(p[0], e); }
  });
}
/** Gatilho diário próprio (22h) de metas, feedback e reenvio de avisos: independente do relatório por e-mail. */
function passoNoturno() {
  if (!portaoAgendado_('ULT_NOTURNO').ok) return { adiado: true };
  passoNoturnoCore_(Date.now() + NOTURNO_PRAZO_MS);
  return { ok: true };
}
/** Roda no editor (dono): instala ou recria o gatilho diário do passo noturno. */
function agendarPassoNoturno() {
  soEditor_(); manutencao_();
  recriarGatilhoDiario_('passoNoturno');
  return 'Gatilho do passo noturno instalado (todo dia às ' + HORA_ENVIO_REL + 'h).';
}
/** Chamada pelo gatilho diário. Só o dono (ou o próprio gatilho) pode executar; envia apenas quem vence hoje e ainda não recebeu hoje. */
function enviarRelatoriosAgendados() {
  const ini = Date.now(), pt = portaoAgendado_('ULT_AGENDADO');
  // um gatilho antigo (de antes das 22h) não pode enviar um relatório parcial nem marcar o dia como enviado
  if (!pt.ok) return { enviados: 0, falhas: [], adiado: true };
  const hoje = hoje_(), ator = { nome: 'Agendamento', email: pt.dono };
  const regs = linhasEmailRel_().filter(function (r) {
    return String(r.Ativo) !== 'Não' && devidoHoje_(FREQS.indexOf(r.Frequencia) > -1 ? r.Frequencia : 'Semanal') && String(r.Ultimo_Envio || '').slice(0, 10) !== hoje;
  });
  let resumo = { enviados: 0, falhas: [] };
  try { resumo = resumoEnvio_(enviarLote_(ator, regs, true)); } catch (e) { falhaLog_('envio agendado de relatórios', e); }
  // publicação antiga, sem o gatilho próprio: os passos noturnos ainda rodam aqui, no tempo que sobrar (consulta falhou = não roda: evita rodar em dobro)
  const pn = gatilhosDe_('passoNoturno');
  if (pn && !pn.length) passoNoturnoCore_(ini + NOTURNO_PRAZO_MS);
  if (resumo.falhas.length) {
    try { registrar_(ator, 'Agendamento com falhas', resumo.falhas.length + '/' + (resumo.enviados + resumo.falhas.length), resumo.falhas.map(function (x) { return x.email + ' (' + x.motivo + ')'; }).join('; ').slice(0, 450)); } catch (e) { /* log best-effort */ }
  }
  return resumo;
}
