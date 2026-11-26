// Relatório por e-mail, envio automático: um calendário de noites seguidas com o gatilho das 22h rodando como gatilho
// (sem usuário ativo). Confere quem recebe em cada dia (diário, semanal na segunda, mensal no dia 1), o período de cada
// frequência, o e-mail sem auditorias, pausa, repetição na mesma noite e gatilho antes das 22h.
const { T, eq, ok, fim } = require('./lib.js');
// relógio controlado (fuso do script = UTC no simulador)
let AGORA = Date.parse('2026-10-01T12:00:00Z');
const DataReal = Date;
global.Date = class extends DataReal { constructor(...a) { if (a.length) super(...a); else super(AGORA); } static now() { return AGORA; } };
const em = (iso) => { AGORA = Date.parse(iso); };
const { cenario } = require('./seed.js'); // as auditorias do cenário ficam em 01/10, fora de todos os períodos testados
const A = cenario();

const DEST = { sl: 'sl@x.com', ana: 'ana@x.com', lid: 'owner@x.com' }; // lid = quem recebe o mensal
A.as('owner@x.com'); A.efetivo = 'owner@x.com';
A.sheets.Cad_Relatorio_Email.d.splice(1); // só os destinatários deste teste
[[DEST.sl, 'Diario', 'pt'], [DEST.ana, 'Semanal', 'en'], [DEST.lid, 'Mensal', 'es']].forEach(([email, freq, idioma]) => {
  const r = A.call('salvarEmailRel', { email, freq, idioma }); if (!r.ok) throw new Error('destinatário não cadastrado: ' + email + ' ' + JSON.stringify(r));
});
const VAZIO = { pt: A.run('MAIL_REL.pt.vazio'), en: A.run('MAIL_REL.en.vazio'), es: A.run('MAIL_REL.es.vazio') };
const auditar = (iso) => { em(iso); const r = A.audit('aud1@x.com', 'Recebimento', { conf: 8, nc: 2, f: { doca: '36', colaboradores: ['Ana Souza'] } }); ok(r.ok, JSON.stringify(r)); };
/** roda o gatilho como o Apps Script roda: sem usuário ativo, dono como usuário efetivo */
const noite = (iso) => {
  em(iso); A.email = ''; A.efetivo = 'owner@x.com'; A.emails.length = 0;
  const nLog = A.sheets.Log_Permissoes.d.length;
  let r; try { r = A.call('enviarRelatoriosAgendados'); } catch (e) { r = { erro: e.message }; }
  const log = A.sheets.Log_Permissoes.d.slice(nLog).map((l) => l.join('|'));
  const mail = (e) => A.emails.find((m) => m.to === e);
  const periodo = (e) => { const l = log.find((x) => x.indexOf('Relatório por e-mail enviado') > -1 && x.indexOf('|' + e + '|Período') > -1); const m = l && /Período: (\S+) a (\S+);/.exec(l); return m ? [m[1], m[2]] : null; };
  return { r, para: A.emails.map((m) => m.to).sort(), mail, periodo };
};

T('ligar o agendamento instala o gatilho diário das 22h (e o do passo noturno)', () => {
  A.as('owner@x.com'); A.triggers = [];
  eq(A.call('alternarAgendamentoRel', true).agendado, true);
  const g = (fn) => A.triggers.filter((t) => t.getHandlerFunction() === fn);
  eq(g('enviarRelatoriosAgendados').length, 1); eq(g('enviarRelatoriosAgendados')[0].hora, 22); eq(g('passoNoturno').length, 1);
});
T('sábado sem auditorias: só o diário recebe, com o aviso de período sem auditorias', () => {
  auditar('2026-11-27T15:00:00Z'); // sexta
  const n = noite('2026-11-28T22:30:00Z');
  eq(n.para, [DEST.sl]); eq(n.r.enviados, 1); eq(n.r.falhas, []);
  ok(n.mail(DEST.sl).htmlBody.indexOf(VAZIO.pt) > -1, 'sem o aviso de período vazio'); eq(n.periodo(DEST.sl), ['2026-11-28', '2026-11-28']);
});
T('segunda: diário com a auditoria do dia e semanal com os últimos 7 dias (em inglês)', () => {
  auditar('2026-11-30T14:00:00Z');
  const n = noite('2026-11-30T22:30:00Z');
  eq(n.para, [DEST.ana, DEST.sl]);
  eq(n.periodo(DEST.sl), ['2026-11-30', '2026-11-30']); ok(n.mail(DEST.sl).htmlBody.indexOf(VAZIO.pt) < 0, 'tinha auditoria hoje');
  eq(n.periodo(DEST.ana), ['2026-11-24', '2026-11-30']); ok(n.mail(DEST.ana).htmlBody.indexOf(VAZIO.en) < 0, 'tinha auditorias na semana');
  ok(n.mail(DEST.ana).subject !== n.mail(DEST.sl).subject, 'assunto no idioma do destinatário');
});
T('dia 1: diário e mensal (30 dias, em espanhol); semanal não', () => {
  const n = noite('2026-12-01T22:30:00Z');
  eq(n.para, [DEST.lid, DEST.sl]); eq(n.periodo(DEST.lid), ['2026-11-02', '2026-12-01']);
  ok(n.mail(DEST.sl).htmlBody.indexOf(VAZIO.pt) > -1, 'dia sem auditorias: aviso');
});
T('o gatilho rodando de novo na mesma noite não envia em dobro', () => {
  const n = noite('2026-12-01T23:45:00Z'); eq(n.para, []); eq(n.r.enviados, 0);
});
T('gatilho antigo antes das 22h não envia nem marca o dia (o das 22h envia normalmente)', () => {
  let n = noite('2026-12-02T07:00:00Z'); eq(n.r.adiado, true); eq(n.para, []);
  n = noite('2026-12-02T22:30:00Z'); eq(n.para, [DEST.sl]);
});
T('destinatário pausado não recebe; reativado volta a receber', () => {
  A.as('owner@x.com'); A.call('salvarEmailRel', { email: DEST.sl, freq: 'Diario', idioma: 'pt', ativo: false });
  eq(noite('2026-12-03T22:30:00Z').para, []);
  A.as('owner@x.com'); A.call('salvarEmailRel', { email: DEST.sl, freq: 'Diario', idioma: 'pt', ativo: true });
  eq(noite('2026-12-04T22:30:00Z').para, [DEST.sl]);
});
T('semana seguinte sem auditorias: o semanal sai mesmo assim, com o aviso (não fica sem e-mail)', () => {
  const n = noite('2026-12-07T22:30:00Z');
  eq(n.para, [DEST.ana, DEST.sl]); eq(n.periodo(DEST.ana), ['2026-12-01', '2026-12-07']);
  ok(n.mail(DEST.ana).htmlBody.indexOf(VAZIO.en) > -1, 'semana vazia: aviso em inglês');
});
T('e-mail sem auditorias não traz números inventados (nada de 0% ou média)', () => {
  const n = noite('2026-12-08T22:30:00Z'), b = n.mail(DEST.sl).body;
  ok(n.mail(DEST.sl).htmlBody.indexOf(VAZIO.pt) > -1); ok(!/\b0(,0|\.0)?%/.test(b), b.slice(0, 300));
});
T('quem chama pelo navegador (não é o dono) é barrado', () => {
  em('2026-12-09T22:30:00Z'); A.as('sl@x.com'); A.efetivo = 'owner@x.com';
  let erro = ''; try { A.call('enviarRelatoriosAgendados'); } catch (e) { erro = e.message; } ok(/Acesso negado/.test(erro), erro);
});
fim('Relatório por e-mail: envio automático (calendário)');
