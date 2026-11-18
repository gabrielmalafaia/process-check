// Correções da revisão ECC (versão 7.2): falhas silenciosas e segurança do servidor.
const { T, eq, ok, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
const log = () => A.call('lerDireto_', 'Log_Permissoes');
const novoUsuario = (email, nome, perfil) => { A.as('owner@x.com'); A.ctx.anexar_('Cad_Usuarios', [email, nome, perfil, 'Sim']); A.run('limparCache_()'); };

T('e-mail: se só a gravação da data do envio falhar, o envio conta como feito e a falha vai para o log', () => {
  A.as('owner@x.com'); A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Diario', idioma: 'pt' });
  const envio = A.ctx.MailApp.sendEmail, abaOrig = A.ctx.aba_; let quebra = false;
  A.ctx.MailApp.sendEmail = (m) => { envio(m); quebra = true; };
  A.ctx.aba_ = (n) => { if (quebra && n === 'Cad_Relatorio_Email') { quebra = false; throw new Error('Planilha cheia'); } return abaOrig(n); };
  A.emails.length = 0;
  try { const r = A.call('enviarRelatorioAgora', 'sl@x.com'); eq([r.enviados, r.falhas.length], [1, 0]); }
  finally { A.ctx.MailApp.sendEmail = envio; A.ctx.aba_ = abaOrig; }
  eq(A.emails.length, 1);
  ok(log().some(l => /data do envio não gravada/.test(l.Acao) && l.Alvo === 'sl@x.com'), 'falha da data sem registro');
  ok(!log().some(l => l.Acao === 'Relatório por e-mail não enviado' && l.Alvo === 'sl@x.com' && /Planilha cheia/.test(l.Detalhe || '')), 'foi marcado como não enviado');
});
T('e-mail agendado: falhas do gatilho diário ficam registradas no log', () => {
  A.as('owner@x.com'); ['sl@x.com', 'ana@x.com'].forEach(e => A.call('salvarEmailRel', { email: e, freq: 'Diario', idioma: 'pt' }));
  A.sheets.Cad_Relatorio_Email.d.forEach((l, i) => { if (i) l[4] = ''; }); A.run('limparCache_()');
  A.mailFalhaPara = 'ana@x.com'; A.emails.length = 0;
  const r = A.call('enviarRelatoriosAgendados'); A.mailFalhaPara = '';
  eq(r.falhas.map(x => x.email + ':' + x.motivo), ['ana@x.com:erro']);
  const l = log().filter(x => x.Acao === 'Agendamento com falhas'); eq(l.length, 1); ok(/ana@x\.com/.test(l[0].Detalhe), l[0].Detalhe);
});
T('exportação: lote com offset maior que 0, sem o primeiro lote, também fica registrado (uma vez)', () => {
  A.as('sl@x.com'); const n = () => log().filter(x => /Exporta/.test(x.Acao)).length, n0 = n();
  A.call('relatorio', 'export', A.F({ processo: 'Recebimento' }), { offset: 500 });
  A.call('relatorio', 'export', A.F({ processo: 'Recebimento' }), { offset: 1000 });
  eq(n(), n0 + 1, 'deveria registrar uma vez, mesmo começando em offset 500');
  A.call('relatorio', 'export', A.F({ processo: 'Recebimento' }), { offset: 0 }); eq(n(), n0 + 2, 'nova exportação (offset 0) registra de novo');
});
T('bootstrap(true): quem não tem acesso não limpa o cache dos outros; quem tem, limpa', () => {
  const orig = A.ctx.limparCache_; let n = 0; A.ctx.limparCache_ = () => { n++; return orig(); };
  try {
    A.as('estranho@x.com'); A.call('bootstrap', true); eq(n, 0, 'conta sem cadastro limpou o cache');
    A.as('aud1@x.com'); A.call('bootstrap', true); ok(n >= 1, 'usuário cadastrado deveria poder atualizar');
  } finally { A.ctx.limparCache_ = orig; }
});
T('auditoria sem colaborador: líder inventado é recusado; líder cadastrado é aceito e gravado com o nome do cadastro', () => {
  const f = (lider) => A.audit('aud2@x.com', 'Separação', { conf: 10, f: { doca: 'A-10', lider: lider, turno: 'T2' } });
  const r = f('Fulano Inventado'); eq(r.ok, false); ok(r.erros && r.erros.lider, 'sem erro de líder');
  const k = f('dora lider'); eq(k.ok, true);
  const h = A.hist(); eq(String(h.d[h.d.length - 1][5]), 'Dora Lider');
});
T('turno: perfil limitado a T1 não grava auditoria de outro turno', () => {
  A.as('owner@x.com');
  A.call('salvarPerfil', { nome: 'SoT1', desc: 't', perms: ['auditar'], telas: ['matriz', 'form'], escopo: { modo: 'proprias', processos: [], turnos: ['T1'] } }, true);
  novoUsuario('t1@x.com', 'T Um', 'SoT1');
  const r = A.audit('t1@x.com', 'Separação', { conf: 10, f: { doca: 'A-10', lider: 'Dora Lider', turno: 'T2' } });
  eq(r.ok, false); ok(r.erros && r.erros.turno && /T1/.test(r.erros.turno), JSON.stringify(r.erros));
  const k = A.audit('t1@x.com', 'Separação', { conf: 10, f: { doca: 'A-10', lider: 'Dora Lider', turno: 'T1' } }); eq(k.ok, true);
});
T('perfis: quem tem permissão "perfis" não edita um perfil com mais acesso que o dele, mesmo para reduzi-lo', () => {
  A.as('owner@x.com');
  const forte = A.call('salvarPerfil', { nome: 'Forte', desc: 't', perms: ['perfis', 'usuarios', 'auditar'], telas: ['acessos', 'form'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true); ok(forte.ok, JSON.stringify(forte));
  const fraco = A.call('salvarPerfil', { nome: 'Fraco', desc: 't', perms: ['perfis'], telas: ['acessos'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true); ok(fraco.ok, JSON.stringify(fraco));
  novoUsuario('fraco@x.com', 'Fraco Um', 'Fraco');
  A.as('fraco@x.com');
  const r = A.call('salvarPerfil', { nome: 'Forte', desc: 'rebaixado', perms: ['perfis'], telas: ['acessos'], escopo: { modo: 'todos', processos: [], turnos: [] } }, false);
  eq(!!r.ok, false); ok(/mais acesso/.test(r.msg || ''), JSON.stringify(r));
  const p = A.call('listarAcessos').perfis.find(x => x.nome === 'Forte'); eq(p.perms.length, 3, 'o perfil Forte foi alterado');
});
fim('SERVIDOR parte 8 (correções da revisão ECC: falhas silenciosas e segurança)');
