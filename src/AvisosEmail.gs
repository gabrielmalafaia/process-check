/* ============================================================
   Avisos por e-mail de metas e feedback: reserva, envio e fila de reenvio.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
/* ---- e-mail de aviso: só diz que há meta nova, com prazo e quantidade (sem nomes, notas ou texto livre) ---- */
const MAIL_META = {
  pt: { assunto: 'Nova meta de auditoria - Process Check', titulo: 'Você tem uma nova meta de auditoria', ola: 'Olá, ', corpo: 'Foi programada uma meta para você: {q} auditoria(s) até {d}. Veja os detalhes na aba Minhas metas.', botao: 'Abrir Minhas metas', rodape: 'Mensagem automática. Não é necessário responder.' },
  en: { assunto: 'New audit goal - Process Check', titulo: 'You have a new audit goal', ola: 'Hello, ', corpo: 'A goal was set for you: {q} audit(s) by {d}. See the details in My goals.', botao: 'Open My goals', rodape: 'Automatic message. No reply is needed.' },
  es: { assunto: 'Nueva meta de auditoría - Process Check', titulo: 'Tiene una nueva meta de auditoría', ola: 'Hola, ', corpo: 'Se programó una meta para usted: {q} auditoría(s) hasta {d}. Vea los detalles en Mis metas.', botao: 'Abrir Mis metas', rodape: 'Mensaje automático. No es necesario responder.' }
};
function dataBr_(ymd) { return String(ymd).slice(8, 10) + '/' + String(ymd).slice(5, 7) + '/' + String(ymd).slice(0, 4); }
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
/* ---- fila de avisos por e-mail (metas e feedback) ----
   Carimbo Aviso_Em: '' = a enviar; 'enviando <data>' = reservado por uma execução; 'sem destino <data>' = destinatário
   inválido na última tentativa (reavaliado a cada noite); uma data = enviado. */
const AVISO_LOTE = 50;
const AVISO_RESERVA_MS = 3600000;
const AVISO_ENVIANDO = 'enviando ';
const AVISO_SEM_DESTINO = 'sem destino';
/** Entra na fila de reenvio: sem carimbo, reserva vencida (a execução morreu entre reservar e confirmar) ou "sem destino". */
function avisoAReenviar_(v, agoraMs) {
  v = String(v == null ? '' : v);
  if (v === '') return true;
  if (v.indexOf(AVISO_ENVIANDO) === 0) { const t = d_(v.slice(AVISO_ENVIANDO.length)).getTime(); return !(agoraMs - t <= AVISO_RESERVA_MS); } // data ilegível conta como vencida
  return v.indexOf(AVISO_SEM_DESTINO) === 0;
}
/** Para a tela: o aviso ainda não saiu (sem carimbo ou reservado). */
function avisoPendente_(v) { v = String(v == null ? '' : v); return v === '' || v.indexOf(AVISO_ENVIANDO) === 0; }
/**
 * Envia um aviso uma única vez: no lock confere que a linha é a mesma, no status esperado e sem carimbo, e reserva ("enviando <data>").
 * Envia fora do lock e só então grava a data. Se o envio falhar, a reserva é desfeita; se nem isso der certo, ela vence em 1 h e o
 * reenvio tenta de novo. Duas execuções nunca enviam o mesmo aviso ao mesmo tempo.
 */
/** Endereço que o envio aceita: válido e sem caracteres que mudariam o cabeçalho do e-mail. Mesma regra na fila e no envio. */
function destinoEnviavel_(email) { return emailValido_(email) && !/[,;<>"\r\n]/.test(email); }
const AVISO_GRAVAR_TENTATIVAS = 3;
function avisarComReserva_(onde, aba, row, id, colStatus, status, colAviso, email, enviar) {
  if (!destinoEnviavel_(email)) return false;
  const s = aba_(aba);
  const reservou = comLock_(function () {
    const c = s.getRange(row, 1, 1, colAviso).getValues()[0];
    if (String(c[0]) !== String(id) || String(c[colStatus - 1]) !== status || String(c[colAviso - 1]) !== '') return false;
    s.getRange(row, colAviso).setNumberFormat('@').setValue(AVISO_ENVIANDO + agora_());
    return true;
  });
  if (!reservou) return false;
  try {
    if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) throw new Error('Cota diária de e-mail quase esgotada.');
    enviar();
  } catch (e) {
    falhaLog_(onde, e);
    desfazer_(function () { comLock_(function () { s.getRange(row, colAviso).setValue(''); }); });
    return false;
  }
  // o e-mail já saiu: insiste na data (o lock pode estar ocupado), porque sem ela a reserva vence e o aviso sai de novo
  for (let t = 1; t <= AVISO_GRAVAR_TENTATIVAS; t++) {
    try { comLock_(function () { s.getRange(row, colAviso).setNumberFormat('@').setValue(agora_()); }); break; }
    catch (e) { if (t === AVISO_GRAVAR_TENTATIVAS) falhaLog_(onde + ': e-mail enviado, mas a data não foi gravada (pode ser reenviado em 1 h)', e); else Utilities.sleep(500 * t); }
  }
  return true; // o carimbo Aviso_Em não está em cache: não derruba o cache de todos
}
/**
 * Passo das 22h: reenvia os avisos que não saíram. Rodízio diário do ponto de partida (um aviso que sempre falha não trava os outros),
 * no máximo AVISO_LOTE envios, erro de um item não derruba a fila, e tudo para no prazo da execução.
 * Destinatário inativo, de outro Hub ou inválido recebe "sem destino <data>" e é reavaliado na noite seguinte.
 */
function reenviarFila_(onde, aba, colAviso, pend, destino, avisar, prazo) {
  if (!pend.length || MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) return 0; // sem cota: não gasta o tempo do passo das 22h
  const us = lerBruto_('Cad_Usuarios'), pf = perfis_(), s = aba_(aba), off = Math.floor(Date.now() / 864e5) % pend.length;
  const fila = pend.slice(off).concat(pend.slice(0, off));
  let n = 0, tentativas = 0;
  for (let i = 0; i < fila.length && tentativas < AVISO_LOTE; i++) {
    if (Date.now() > prazo) { falhaLog_(onde, new Error('Tempo esgotado; os avisos restantes ficam para a próxima execução.')); break; }
    const r = fila[i], atual = String(r.Aviso_Em || '');
    try {
      const email = destino(r), u = us.find(function (x) { return emailDe_(x.Email_Google) === email; });
      const valido = destinoEnviavel_(email) && u && usuarioAtivo_(u) && pf[String(u.Perfil).trim()] && String(u.Hub || '').trim() === String(r.Hub || '').trim();
      if (!valido) {
        // só marca se o carimbo ainda é o lido: a fila pode ter até 5 min, e a pendência pode ter sido reatribuída e avisada nesse meio
        if (atual.indexOf(AVISO_SEM_DESTINO) !== 0) comLock_(function () { const c = s.getRange(r._row, colAviso); if (String(c.getValue()) === atual) c.setNumberFormat('@').setValue(AVISO_SEM_DESTINO + ' ' + hoje_()); });
        continue;
      }
      if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVA) { falhaLog_(onde, new Error('Cota diária de e-mail quase esgotada; os avisos restantes ficam para a próxima execução.')); break; }
      // libera a reserva vencida ou o "sem destino" para a nova tentativa, só se ninguém mexeu no carimbo desde a leitura
      if (atual !== '') comLock_(function () { const c = s.getRange(r._row, colAviso); if (String(c.getValue()) === atual) c.setValue(''); });
      tentativas++;
      if (avisar(r, email)) n++;
    } catch (e) { falhaLog_(onde + ' (linha ' + r._row + ')', e); }
  }
  return n;
}
function avisarMetaLider_(row, id, email, ini, fim, qtd) {
  return avisarComReserva_('aviso de meta', 'Metas_Lider', row, id, 14, 'Ativa', 18, email, function () {
    const sol = lerAba_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === email; }).pop(), m = MAIL_META[idiomaOk_(sol && sol.Idioma)];
    enviarAviso_(email, m, m.corpo.replace('{q}', String(qtd)).replace('{d}', dataBr_(fim)));
  });
}
function reenviarAvisosMetas_(prazo) {
  const hoje = hoje_(), agora = Date.now();
  const pend = lerBruto_('Metas_Lider').filter(function (r) { return String(r.Status) === 'Ativa' && String(r.Fim) >= hoje && avisoAReenviar_(r.Aviso_Em, agora); });
  return reenviarFila_('reenvio de avisos de meta', 'Metas_Lider', 18, pend, function (r) { return emailDe_(r.Lider_Email); },
    function (r, email) { return avisarMetaLider_(r._row, String(r.ID_Meta), email, String(r.Inicio), String(r.Fim), Number(r.Quantidade)); }, prazo || Infinity);
}
