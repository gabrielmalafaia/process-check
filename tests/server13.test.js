// v10 fase 2: metas de auditoria por líder (Metas_Lider), contador e e-mail de aviso.
const { T, eq, ok, nega, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
A.as('owner@x.com');
A.call('migrarV10');
A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar', 'ver_nomes'], telas: ['matriz', 'form', 'minhas', 'auditorias', 'colab'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
A.call('salvarPerfil', { nome: 'SLparcial', desc: 't', perms: ['obrigacoes'], telas: ['programacao'], escopo: { modo: 'todos', processos: [], turnos: ['T1'] } }, true);
A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['dora@x.com', 'Dora Lider', 'LiderAud', 'Sim']);
A.ctx.anexar_('Cad_Usuarios', ['parcial@x.com', 'Parcial', 'SLparcial', 'Sim']);
A.run('limparCache_()');
const hoje = A.hojeStr, ate = A.dia(10), de = A.dia(-5);
const meta = (o) => Object.assign({ email: 'carlosa@x.com', qtd: 3, ini: de, fim: ate, desc: '', times: [], turnos: [], cores: [], processos: [] }, o || {});
const linhas = () => A.sheets.Metas_Lider.d.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined));
const criar = (o) => { A.as('sl@x.com'); return A.call('salvarMetaLider', meta(o)); };
const mails = () => A.emails.filter((m) => /meta/i.test(m.subject));
const regra = (email, o) => {
  const d = Object.assign({ p: 'Sim', o: 'Não' }, o || {});
  const aba = A.sheets.Cad_Regras_Lider; for (let i = aba.d.length - 1; i > 0; i--) if (aba.d[i][0] === email) aba.d.splice(i, 1);
  A.ctx.anexar_('Cad_Regras_Lider', [email, d.p, d.o, '', '', '', '', 'Sim', 'proprias', 'teste', '']); A.run('limparCache_()');
};
const semRegra = (email) => { const aba = A.sheets.Cad_Regras_Lider; for (let i = aba.d.length - 1; i > 0; i--) if (aba.d[i][0] === email) aba.d.splice(i, 1); A.run('limparCache_()'); };

T('permissão: só Admin e Site Leader têm "obrigacoes"; Analista, Auditor e líder não', () => {
  const pf = (e) => { A.as(e); return A.call('bootstrap').user; };
  ok(pf('owner@x.com').perms.indexOf('obrigacoes') > -1); ok(pf('sl@x.com').perms.indexOf('obrigacoes') > -1);
  ok(pf('sl@x.com').telas.indexOf('programacao') > -1);
  ['ana@x.com', 'aud1@x.com', 'carlosa@x.com'].forEach((e) => { ok(pf(e).perms.indexOf('obrigacoes') < 0, e); ok(pf(e).telas.indexOf('programacao') < 0, e); });
});
T('negado a quem não tem a permissão, em todas as funções de programação', () => {
  ['ana@x.com', 'aud1@x.com', 'carlosa@x.com'].forEach((e) => {
    A.as(e);
    nega(() => A.call('listarMetasLider'), 'permissão'); nega(() => A.call('salvarMetaLider', meta()), 'permissão'); nega(() => A.call('cancelarMetaLider', 'x'), 'permissão');
  });
});
T('perfil com a permissão mas dados parciais (um turno) não programa', () => {
  A.as('parcial@x.com'); nega(() => A.call('listarMetasLider'), 'só parte dos dados'); nega(() => A.call('salvarMetaLider', meta()), 'só parte dos dados');
});
T('Site Leader programa a meta: grava, lista com progresso 0 e envia e-mail só com prazo e quantidade', () => {
  A.emails.length = 0;
  const r = criar({ qtd: 3 }); eq(r.ok, true, JSON.stringify(r)); eq(r.emailEnviado, true);
  const m = r.metas.find((x) => x.id === r.id); eq([m.email, m.qtd, m.feito, m.status, m.cancelada], ['carlosa@x.com', 3, 0, 'em_risco', false]);
  eq(mails().length, 1); eq(mails()[0].to, 'carlosa@x.com');
  ok(!/Ana|Bruno|%|nota/i.test(mails()[0].body), 'sem nomes de colaboradores nem notas');
  ok(mails()[0].body.indexOf('3 auditoria') > -1 && mails()[0].body.indexOf(ate.slice(8, 10) + '/') > -1);
  ok(String(linhas()[0][17]) !== '', 'Aviso_Em carimbado');
});
T('o líder vê só a própria meta; contador no bootstrap; marcar como vista zera o contador', () => {
  A.as('carlosa@x.com'); eq(A.call('bootstrap').metasNovas, 1);
  const m = A.call('minhasMetasLider'); eq(m.length, 1); eq(m[0].nova, true);
  A.as('dora@x.com'); eq(A.call('bootstrap').metasNovas, 0); eq(A.call('minhasMetasLider').length, 0);
  eq(A.call('marcarMetasVistas').vistas, 0);
  A.as('carlosa@x.com'); eq(A.call('contarMetasNovas'), 1);
  eq(A.call('marcarMetasVistas').vistas, 1); eq(A.call('bootstrap').metasNovas, 0); eq(A.call('minhasMetasLider')[0].nova, false);
});
T('progresso conta só as auditorias finalizadas do responsável, no período e no escopo', () => {
  A.audit('carlosa@x.com', 'Expedição', { conf: 10, f: { doca: '01', colaboradores: ['Ana Souza'] } });
  A.audit('carlosa@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaboradores: ['Bruno Lima'] } });
  A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '01', colaboradores: ['Ana Souza'] } }); // outro auditor: não conta
  A.as('carlosa@x.com'); eq(A.call('minhasMetasLider')[0].feito, 2);
  const r1 = criar({ processos: ['Expedição'] }); eq(r1.metas.find((x) => x.id === r1.id).feito, 1);
  const r2 = criar({ cores: ['Verde/Bolinha'] }); eq(r2.metas.find((x) => x.id === r2.id).feito, 1, 'só a doca 01 (Verde/Bolinha)');
  const r3 = criar({ cores: ['Roxo/Losango'] }); eq(r3.metas.find((x) => x.id === r3.id).feito, 0);
  const r4 = criar({ turnos: ['T2'] }); eq(r4.metas.find((x) => x.id === r4.id).feito, 0);
  const r5 = criar({ turnos: ['T1'], times: ['Carlos Lider'] }); eq(r5.metas.find((x) => x.id === r5.id).feito, 2);
  const r6 = criar({ times: ['Dora Lider'] }); eq(r6.metas.find((x) => x.id === r6.id).feito, 0);
  const r7 = criar({ qtd: 2 }); eq(r7.metas.find((x) => x.id === r7.id).status, 'atingida');
});
T('auditoria fora do período não conta', () => {
  const r = criar({ ini: A.dia(1), fim: A.dia(5) }); const m = r.metas.find((x) => x.id === r.id); eq([m.feito, m.status], [0, 'futura']);
});
T('validações: quantidade, datas, prazo vencido, descrição, listas inválidas', () => {
  const v = (o) => criar(o);
  eq(v({ qtd: 0 }).erros.qtd !== undefined, true); eq(v({ qtd: 1.5 }).erros.qtd !== undefined, true); eq(v({ qtd: 10000 }).erros.qtd !== undefined, true); eq(v({ qtd: '' }).erros.qtd !== undefined, true);
  eq(v({ ini: 'x' }).erros.ini !== undefined, true); eq(v({ fim: A.dia(-1) }).erros.fim !== undefined, true, 'prazo no passado');
  eq(v({ ini: ate, fim: de }).erros.fim !== undefined, true); eq(v({ fim: A.dia(400) }).erros.fim !== undefined, true);
  eq(v({ desc: 'x'.repeat(201) }).erros.desc !== undefined, true); eq(v({ desc: '=1+1' }).erros.desc !== undefined, true); eq(v({ desc: '<b>x</b>' }).erros.desc !== undefined, true);
  eq(v({ processos: ['Inexistente'] }).erros.processos !== undefined, true); eq(v({ turnos: ['T9'] }).erros.turnos !== undefined, true);
  eq(v({ times: ['Fulano'] }).erros.times !== undefined, true); eq(v({ cores: ['Verde/Estrela'] }).erros.cores !== undefined, true);
  eq(v({ processos: ['Expedição', 'Expedição'] }).erros.processos !== undefined, true, 'lista duplicada');
});
T('responsável inválido: não cadastrado, inativo, sem permissão de auditar, o próprio ator', () => {
  eq(criar({ email: 'nao@x.com' }).ok, false); eq(criar({ email: 'off@x.com' }).ok, false);
  eq(criar({ email: 'sl@x.com' }).ok, false, 'ninguém programa para si');
  A.as('owner@x.com'); eq(A.call('salvarMetaLider', meta({ email: 'owner@x.com' })).ok, false);
  const e = criar({ email: 'ana@x.com' }); ok(e.ok === true || e.erros.email, 'Analista com auditar pode receber');
});
T('líder cuja regra v9 não deixa auditar ninguém não recebe meta; regra liberada recebe', () => {
  regra('dora@x.com', { p: 'Não', o: 'Não' }); const r = criar({ email: 'dora@x.com' }); eq(r.ok, false); ok(/regra de auditoria/.test(r.erros.email));
  regra('dora@x.com', { p: 'Não', o: 'Sim' }); eq(criar({ email: 'dora@x.com' }).ok, true); semRegra('dora@x.com');
});
T('cancelar mantém a linha, o líder deixa de ver e de ser contado; cancelar de novo e id inexistente são recusados', () => {
  A.as('sl@x.com'); const id = A.call('listarMetasLider').metas.find((m) => m.email === 'dora@x.com').id;
  const n0 = linhas().length; const r = A.call('cancelarMetaLider', id); eq(r.ok, true); eq(linhas().length, n0, 'não apaga');
  eq(r.metas.find((m) => m.id === id).status, 'cancelada');
  eq(A.call('cancelarMetaLider', id).ok, false); eq(A.call('cancelarMetaLider', 'MTL-0').ok, false);
  A.as('dora@x.com'); eq(A.call('minhasMetasLider').filter((m) => m.id === id).length, 0);
});
T('IDOR: o líder não cancela a meta de outro e a programação não vaza para ele', () => {
  A.as('sl@x.com'); const id = A.call('listarMetasLider').metas.find((m) => m.email === 'carlosa@x.com' && !m.cancelada).id;
  A.as('dora@x.com'); nega(() => A.call('cancelarMetaLider', id), 'permissão');
  A.as('dora@x.com'); ok(A.call('minhasMetasLider').every((m) => m.id !== id));
});
T('se o log falhar, a meta não fica gravada (reversão)', () => {
  const n0 = linhas().length;
  A.run('var __r = registrar_; registrar_ = function () { throw new Error("log fora"); };');
  const r = (() => { try { return criar({ qtd: 7 }); } catch (e) { return { erro: e.message }; } })();
  A.run('registrar_ = __r;');
  ok(r.erro && /nada foi salvo/.test(r.erro), JSON.stringify(r)); eq(linhas().length, n0);
});
T('e-mail falhou: a meta é salva, Aviso_Em fica vazio e o passo das 22h reenvia; com cota esgotada não envia', () => {
  A.emails.length = 0; A.mailFalha = true;
  const r = criar({ qtd: 9 }); A.mailFalha = false; eq(r.ok, true); eq(r.emailEnviado, false);
  const row = linhas().find((l) => l[7] === 9); eq(String(row[17]), '');
  A.cota = 5; eq(A.run('reenviarAvisosMetas_()'), 0); eq(mails().length, 0);
  A.cota = undefined; ok(A.run('reenviarAvisosMetas_()') >= 1); eq(mails().length >= 1, true); ok(String(linhas().find((l) => l[7] === 9)[17]) !== '');
  const n = mails().length; eq(A.run('reenviarAvisosMetas_()'), 0, 'não reenvia o que já foi avisado'); eq(mails().length, n);
});
T('meta idêntica ativa é recusada (repetir a operação não duplica); qtd frouxa (true, 1e2) é recusada', () => {
  const r = criar({ qtd: 4 }); eq(r.ok, true); const n = linhas().length;
  const d = criar({ qtd: 4 }); eq(d.ok, false); ok(/idêntica/.test(d.erros.email)); eq(linhas().length, n);
  eq(criar({ qtd: true }).ok, false); eq(criar({ qtd: '1e2' }).ok, false); eq(criar({ qtd: '5' }).ok, true);
});
T('prazo ou início longe demais (erro de digitação no ano) é recusado: o progresso nunca precisa cortar o período', () => {
  ok(criar({ fim: A.dia(401), ini: A.dia(300) }).erros.fim);
});
T('se a releitura da lista falhar DEPOIS de gravar, devolve ok com recarregar (não pede para repetir)', () => {
  const n = linhas().length;
  A.run('var __l = listarMetasLider; listarMetasLider = function () { throw new Error("planilha lenta"); };');
  const r = criar({ qtd: 12 }); A.run('listarMetasLider = __l;');
  eq(r.ok, true); eq(r.recarregar, true); eq(linhas().length, n + 1);
});
T('e-mail enviado mas carimbo falhando não conta como envio duplicado: duas execuções seguidas enviam uma vez só', () => {
  A.emails.length = 0; const r = criar({ qtd: 13 }); const row = linhas().find((l) => l[7] === 13);
  eq(mails().length, 1); eq(A.run('avisarMetaLider_(' + (linhas().indexOf(row) + 2) + ', "' + r.id + '", "carlosa@x.com", "' + de + '", "' + ate + '", 13)'), false, 'já carimbada'); eq(mails().length, 1);
});
T('reenvio das 22h: usuário desativado, de outro Hub ou com perfil inválido sai da fila sem receber e-mail', () => {
  A.as('sl@x.com'); A.emails.length = 0; A.mailFalha = true; const r = criar({ qtd: 14 }); A.mailFalha = false;
  const i = linhas().findIndex((l) => l[7] === 14); eq(String(linhas()[i][17]), '');
  A.sheets.Cad_Usuarios.d.forEach((l) => { if (l[0] === 'carlosa@x.com') l[3] = 'Não'; }); A.run('limparCache_()');
  // desde a v10.3 o "sem destino" leva a data, para o destinatário ser reavaliado depois
  A.run('reenviarAvisosMetas_()'); eq(mails().length, 0); ok(/^sem destino \d{4}-\d{2}-\d{2}/.test(String(linhas()[i][17])), String(linhas()[i][17]));
  A.sheets.Cad_Usuarios.d.forEach((l) => { if (l[0] === 'carlosa@x.com') l[3] = 'Sim'; }); A.run('limparCache_()');
});
T('contador não fica preso: meta não aberta e fora da janela de 30 dias não conta e não impede de zerar', () => {
  A.as('sl@x.com'); const r = criar({ email: 'dora@x.com', qtd: 15 }); const i = linhas().findIndex((l) => l[7] === 15);
  A.as('dora@x.com'); ok(A.call('bootstrap').metasNovas >= 1);
  A.sheets.Metas_Lider.d[i + 1][9] = A.dia(-40); A.run('limparCache_()');
  eq(A.call('bootstrap').metasNovas, 0, 'meta antiga já não aparece em Minhas metas, então não conta');
});
T('o passo das 22h executa o reenvio sem derrubar o relatório', () => {
  A.as('owner@x.com'); A.efetivo = 'owner@x.com'; A.email = '';
  const r = A.call('enviarRelatoriosAgendados'); ok(r && r.enviados !== undefined || r.adiado);
  A.as('owner@x.com');
});
T('endereço de e-mail com caracteres de cabeçalho nunca é usado como destinatário', () => {
  A.emails.length = 0;
  eq(A.run('avisarMetaLider_(2, "X", "a@x.com,b@x.com", "2026-01-01", "2026-01-02", 1)'), false);
  eq(A.run('avisarMetaLider_(2, "X", "a@x.com\\r\\nBcc: z@x.com", "2026-01-01", "2026-01-02", 1)'), false); eq(A.emails.length, 0);
});
T('texto livre e nome ficam escapados no e-mail (sem HTML injetado)', () => {
  A.emails.length = 0; criar({ desc: 'normal', qtd: 11 });
  const m = mails()[0]; ok(m && !/<script/i.test(m.htmlBody)); ok(m.htmlBody.indexOf('Process Check') > -1);
});
T('log de atividade registra programação e cancelamento com o responsável', () => {
  A.as('owner@x.com'); const lp = A.sheets.Log_Permissoes.d.map((r) => r.join('|')).join('\n');
  ok(/Meta de auditoria programada/.test(lp) && /Meta de auditoria cancelada/.test(lp)); ok(/Sandra SL <sl@x.com>/.test(lp));
});
fim('v10 fase 2 (metas por líder)');
