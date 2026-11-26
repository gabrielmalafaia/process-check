// v10 fase 3: feedback obrigatório (gatilho, designação, registro com prova encadeada, e-mail, isolamento).
const { T, eq, ok, nega, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
A.as('owner@x.com'); A.call('migrarV10');
A.call('salvarPerfil', { nome: 'LiderAud', desc: 't', perms: ['auditar', 'ver_nomes'], telas: ['matriz', 'form', 'minhas', 'auditorias', 'colab'], escopo: { modo: 'time', processos: [], turnos: [] } }, true);
A.ctx.anexar_('Cad_Usuarios', ['carlosa@x.com', 'Carlos Lider', 'LiderAud', 'Sim']); A.run('limparCache_()');
const TXT = 'Conversei com o colaborador sobre os itens reprovados nas últimas auditorias e combinamos reforçar a conferência antes de liberar a doca.';
const gerar = () => A.run('gerarPendenciasFeedback_()');
const pend = () => A.sheets.Feedback_Pendencias.d.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined));
const regs = () => A.sheets.Feedback_Registros.d.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined));
const lista = (e) => { A.as(e || 'sl@x.com'); return A.call('listarFeedbacks'); };
const baixa = (aud, colab) => A.audit(aud || 'aud1@x.com', 'Expedição', { conf: 5, f: { doca: '07', colaboradores: [colab] } });
const mails = () => A.emails.filter((m) => /feedback/i.test(m.subject));

T('permissão: só Site Leader/Admin gerenciam; qualquer usuário ativo consulta só os próprios', () => {
  ['ana@x.com', 'aud1@x.com', 'carlosa@x.com'].forEach((e) => {
    A.as(e);
    nega(() => A.call('listarFeedbacks'), 'permiss'); nega(() => A.call('designarFeedback', 'x', 'aud1@x.com'), 'permiss'); nega(() => A.call('verificarProvaFeedback'), 'permiss');
    eq(A.call('meusFeedbacks'), []);
  });
  A.as('desconhecido@x.com'); nega(() => A.call('meusFeedbacks'), 'negado');
});
T('abaixo do limite: 2 reprovadas em 30 dias não geram pendência (Carla 60% e 50%)', () => {
  eq(gerar(), 0); eq(lista().pendencias.length, 0);
});
T('a 3ª auditoria abaixo de 90% gera a pendência com o time e o turno da época; auditoria 100% ou antiga não conta', () => {
  A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '07', colaboradores: ['Carla Dias'] } }); eq(gerar(), 0, '100% não conta');
  const velha = baixa('aud1@x.com', 'Bruno Lima'); A.retro(velha.id, 40); eq(gerar(), 0, 'fora da janela de 30 dias');
  baixa('aud1@x.com', 'Carla Dias'); eq(gerar(), 1);
  const l = lista(); eq(l.pendencias.length, 1);
  const p = l.pendencias[0];
  eq([p.colaborador, p.qtd, p.status, p.timeEpoca, p.turnoEpoca, p.corte], ['Carla Dias', 3, 'Aberta', 'Dora Lider', 'T2', 90]);
  eq(p.auditorias.length, 3); ok(p.auditorias.every((x) => x.pct < 90));
  eq(gerar(), 0, 'idempotente'); eq(pend().length, 1);
});
T('histórico: se a colaboradora muda de time, a pendência guarda o time da época e mostra o atual', () => {
  A.as('owner@x.com');
  const row = A.sheets.Cad_Pessoas.d.findIndex((r) => r[0] === 'Carla Dias');
  const ant = A.sheets.Cad_Pessoas.d[row].slice();
  A.sheets.Cad_Pessoas.d[row][4] = 'Carlos Lider'; A.sheets.Cad_Pessoas.d[row][2] = 'T1'; A.run('limparCache_()');
  const p = lista().pendencias[0]; eq([p.timeEpoca, p.timeAtual, p.turnoEpoca, p.turnoAtual], ['Dora Lider', 'Carlos Lider', 'T2', 'T1']);
  A.sheets.Cad_Pessoas.d[row] = ant; A.run('limparCache_()');
});
T('colaborador inativo não gera pendência', () => {
  ['Eva Nunes'].forEach((n) => { for (let i = 0; i < 3; i++) baixa('aud1@x.com', n); });
  const row = A.sheets.Cad_Pessoas.d.findIndex((r) => r[0] === 'Eva Nunes'); A.sheets.Cad_Pessoas.d[row][3] = 'Não'; A.run('limparCache_()');
  eq(gerar(), 0); eq(pend().length, 1);
  A.sheets.Cad_Pessoas.d[row][3] = 'Sim'; A.run('limparCache_()'); eq(gerar(), 1, 'ativa de novo: gera'); 
});
T('designar: valida pessoa do Hub, grava prazo de 7 dias, envia e-mail sem nome nem nota', () => {
  const id = lista().pendencias.find((p) => p.colaborador === 'Carla Dias').id;
  A.as('sl@x.com'); A.emails.length = 0;
  eq(A.call('designarFeedback', id, 'naoexiste@x.com').ok, false);
  eq(A.call('designarFeedback', 'FBK-0', 'aud1@x.com').ok, false);
  const r = A.call('designarFeedback', id, 'aud1@x.com'); eq(r.ok, true, JSON.stringify(r)); eq(r.emailEnviado, true);
  const p = r.pendencias.find((x) => x.id === id);
  eq([p.status, p.designadoEmail, p.prazo, p.atrasado], ['Designada', 'aud1@x.com', A.dia(7), false]);
  eq(mails().length, 1); eq(mails()[0].to, 'aud1@x.com'); ok(!/Carla|Dora|%|nota/i.test(mails()[0].body));
  ok(String(pend().find((x) => x[0] === id)[18]) !== '', 'Aviso_Em carimbado');
});
T('só a pessoa designada vê o feedback (por dado); os demais não', () => {
  A.as('aud1@x.com'); const m = A.call('meusFeedbacks'); eq(m.length, 1); eq(m[0].colaborador, 'Carla Dias'); eq(m[0].auditorias.length, 3);
  ok(m[0].designadoEmail === undefined);
  const b = A.call('bootstrap'); eq(b.fb.fbMeus, 1); eq(b.fb.fbMeusNovos, 1);
  eq(A.call('marcarFeedbacksVistos').vistos, 1); eq(A.call('contarFeedbacks').fbMeusNovos, 0);
  ['aud2@x.com', 'ana@x.com', 'carlosa@x.com'].forEach((e) => { A.as(e); eq(A.call('meusFeedbacks'), [], e); eq(A.call('bootstrap').fb.fbMeus, 0); });
});
T('reatribuir: novo prazo, novo e-mail, o anterior perde o acesso', () => {
  const id = lista().pendencias.find((p) => p.colaborador === 'Carla Dias').id;
  A.as('sl@x.com'); A.emails.length = 0; const r = A.call('designarFeedback', id, 'aud2@x.com'); eq(r.ok, true);
  eq(mails().map((m) => m.to), ['aud2@x.com']);
  A.as('aud1@x.com'); eq(A.call('meusFeedbacks'), []);
  A.as('aud1@x.com'); eq(A.call('registrarFeedback', id, TXT).ok, false);
  A.as('aud2@x.com'); eq(A.call('meusFeedbacks').length, 1);
});
T('registrar: recusa texto curto, de baixa qualidade, de quem não é o designado; aceita o válido e conclui', () => {
  const id = lista().pendencias.find((p) => p.colaborador === 'Carla Dias').id;
  A.as('aud2@x.com');
  eq(A.call('registrarFeedback', id, 'curto demais').ok, false);
  eq(A.call('registrarFeedback', id, 'a'.repeat(60)).ok, false); eq(A.call('registrarFeedback', id, 'ok '.repeat(30)).ok, false);
  eq(A.call('registrarFeedback', id, '=SOMA(A1:A9) conversei com o colaborador sobre as reprovações das auditorias recentes').ok, false);
  eq(A.call('registrarFeedback', id, 'x'.repeat(2001)).ok, false);
  eq(regs().length, 0);
  A.as('sl@x.com'); eq(A.call('registrarFeedback', id, TXT).ok, false, 'Site Leader não designado não registra');
  A.as('aud2@x.com'); const r = A.call('registrarFeedback', id, '  ' + TXT.replace(' ', '   ') + '​ ');
  eq(r.ok, true, JSON.stringify(r)); eq(regs().length, 1); eq(A.call('meusFeedbacks')[0].status, 'Concluida');
  const rg = regs()[0]; eq([rg[5], rg[7], rg[2]], ['aud2@x.com', 'sl@x.com', 'Carla Dias']); eq(rg[9], TXT); eq(rg[11], '');
  eq(A.call('registrarFeedback', id, TXT).ok, false, 'duplicado');
});
T('o Site Leader lê o texto; a cadeia de provas confere e acusa adulteração', () => {
  const p = lista().pendencias.find((x) => x.colaborador === 'Carla Dias'); eq(p.status, 'Concluida'); eq(p.registro.texto, TXT); eq(p.registro.autorEmail, 'aud2@x.com');
  A.as('sl@x.com'); eq(A.call('verificarProvaFeedback').ok, true);
  const s = A.sheets.Feedback_Registros; const o = s.d[1][9]; s.d[1][9] = o + ' alterado';
  const v = A.call('verificarProvaFeedback'); eq([v.ok, v.linhaAdulterada], [false, 2]); s.d[1][9] = o; eq(A.call('verificarProvaFeedback').ok, true);
  A.as('aud1@x.com'); ok(!JSON.stringify(A.call('meusFeedbacks')).includes('Carla'), 'outros não leem');
});
T('texto repetido do mesmo autor é recusado; 2ª pendência encadeia o hash', () => {
  for (let i = 0; i < 3; i++) baixa('aud2@x.com', 'Bruno Lima'); eq(gerar() >= 1, true);
  const id = lista().pendencias.find((p) => p.colaborador === 'Bruno Lima' && p.status === 'Aberta').id;
  A.as('sl@x.com'); A.call('designarFeedback', id, 'aud2@x.com');
  A.as('aud2@x.com'); eq(A.call('registrarFeedback', id, TXT).ok, false, 'igual ao anterior');
  const r = A.call('registrarFeedback', id, 'Falamos sobre a ordem das conferências na doca e o colaborador se comprometeu a revisar cada item antes de liberar.');
  eq(r.ok, true, JSON.stringify(r)); eq(regs().length, 2); eq(regs()[1][11], regs()[0][12]); A.as('sl@x.com'); eq(A.call('verificarProvaFeedback').ok, true);
});
T('falha no log desfaz o registro e a designação (nada fica pela metade)', () => {
  for (let i = 0; i < 3; i++) baixa('aud1@x.com', 'Davi Reis'); gerar();
  const id = lista().pendencias.find((p) => p.colaborador === 'Davi Reis').id;
  A.as('sl@x.com'); A.run('var __r = registrar_; registrar_ = function () { throw new Error("log fora"); };');
  // desde a v10.2 o usuário vê a mensagem padrão do desfazer; o erro técnico vai para o log de atividade
  nega(() => A.call('designarFeedback', id, 'aud1@x.com'), 'nada foi alterado'); A.run('registrar_ = __r;');
  eq(pend().find((p) => p[0] === id)[11], 'Aberta');
  A.call('designarFeedback', id, 'aud1@x.com'); A.as('aud1@x.com');
  A.run('var __r = registrar_; registrar_ = function () { throw new Error("log fora"); };');
  const antes = regs().length; nega(() => A.call('registrarFeedback', id, 'Conversei sobre as falhas de conferência e orientei o passo a passo correto para cada etapa da doca.'), 'nada foi alterado'); A.run('registrar_ = __r;');
  eq(regs().length, antes); eq(pend().find((p) => p[0] === id)[11], 'Designada');
});
T('atrasado: continua aberto, alerta o Site Leader e o designado, e ainda pode ser registrado', () => {
  const id = pend().find((p) => p[2] === 'Davi Reis')[0];
  A.sheets.Feedback_Pendencias.d[pend().findIndex((p) => p[0] === id) + 1][16] = A.dia(-2); A.run('limparCache_()');
  const p = lista().pendencias.find((x) => x.id === id); eq([p.status, p.atrasado], ['Designada', true]);
  A.as('sl@x.com'); eq(A.call('bootstrap').fb.fbAtrasadosHub >= 1, true);
  A.as('aud1@x.com'); const b = A.call('bootstrap').fb; eq(b.fbMeusAtrasados, 1);
  eq(A.call('registrarFeedback', id, 'Conversei sobre as falhas de conferência e orientei o passo a passo correto para cada etapa da doca.').ok, true);
});
T('auditorias já cobertas não contam de novo; novas 3 geram nova pendência', () => {
  eq(gerar(), 0);
  for (let i = 0; i < 3; i++) baixa('aud1@x.com', 'Carla Dias'); eq(gerar(), 1);
  eq(pend().filter((p) => p[2] === 'Carla Dias').length, 2);
});
T('e-mail de designação que falha: segue válido e o passo das 22h reenvia só destinatário válido', () => {
  const id = lista().pendencias.find((p) => p.colaborador === 'Carla Dias' && p.status === 'Aberta').id;
  A.as('sl@x.com'); A.emails.length = 0; A.mailFalha = true;
  const r = A.call('designarFeedback', id, 'aud1@x.com'); A.mailFalha = false; eq(r.ok, true); eq(r.emailEnviado, false); eq(mails().length, 0);
  A.cota = 5; eq(A.run('reenviarAvisosFeedback_()'), 0); A.cota = undefined;
  A.run('HUB_CTX = null;'); eq(A.run('reenviarAvisosFeedback_()'), 1); eq(mails().map((m) => m.to), ['aud1@x.com']);
});
T('passo das 22h: gera pendência sem contexto de usuário e restaura o contexto', () => {
  for (let i = 0; i < 3; i++) baixa('aud1@x.com', 'Bruno Lima');
  A.run('HUB_CTX = null;'); const n = A.run('gerarFeedbackTodosHubs_()'); eq(n, 1); eq(A.run('HUB_CTX'), null);
});
T('listas: Site Leader vê responsáveis do Hub; resposta não vaza e-mail de quem não deve', () => {
  const l = lista(); ok(l.responsaveis.some((u) => u.email === 'aud1@x.com')); ok(!l.responsaveis.some((u) => u.email === 'off@x.com'), 'inativo fora');
});
T('prova: apagar o último registro ou reescrever o texto é detectado (âncora fora da planilha); Site Leader de Hub só recebe ok', () => {
  A.as('sl@x.com'); eq(A.call('verificarProvaFeedback').ok, true);
  const s = A.sheets.Feedback_Registros, ult = s.d[s.d.length - 1].slice(); s.d.pop();
  const v = A.call('verificarProvaFeedback'); eq(v.ok, false); s.d.push(ult); eq(A.call('verificarProvaFeedback').ok, true);
  A.as('owner@x.com'); const o = A.call('verificarProvaFeedback'); eq(o.ok, true); ok(o.total >= 2);
});
T('texto: caracteres invisíveis e de direção (U+202E, U+00AD) são removidos antes de contar e gravar', () => {
  eq(A.run("normalizarTextoFb_('a\\u202Eb\\u00ADc\\u200Bd')"), 'abcd');
  eq(A.run("validarTextoFb_(normalizarTextoFb_('x\\u202E'.repeat(30)))") !== '', true);
});
T('gatilho com erro não derruba a lista do Site Leader; a geração por Hub registra a falha e segue', () => {
  A.as('sl@x.com'); A.run("CacheService.getScriptCache().remove('fbgen:-')");
  A.run('var __g = gerarPendenciasFeedback_; gerarPendenciasFeedback_ = function () { throw new Error("Sistema ocupado."); };');
  eq(Array.isArray(A.call('listarFeedbacks').pendencias), true);
  A.run('HUB_CTX = null;'); eq(A.run('gerarFeedbackTodosHubs_()'), 0); eq(A.run('HUB_CTX'), null);
  A.run('gerarPendenciasFeedback_ = __g;');
});
T('o login não falha se o contador de feedback quebrar', () => {
  A.as('sl@x.com'); A.run('var __r = resumoFb_; resumoFb_ = function () { throw new Error("boom"); };');
  const b = A.call('bootstrap'); A.run('resumoFb_ = __r;'); eq(b.fb.fbMeus, 0); ok(b.ok !== false);
});
T('sigilo: só o Admin sabe quem auditou; Site Leader e quem dá o feedback não recebem o auditor', () => {
  const temAud = (r) => JSON.stringify(r).indexOf('aud1@x.com') > -1 && r.pendencias.some((p) => (p.auditores || []).length);
  const sl = lista('sl@x.com'); ok(sl.pendencias.length > 0, 'cenário sem pendências');
  ok(sl.pendencias.every((p) => !(p.auditores || []).length && p.auditorias.every((x) => !('aud' in x))), 'Site Leader recebeu o auditor');
  ok(temAud(lista('owner@x.com')), 'Admin deveria ver quem auditou');
  A.as('aud1@x.com'); const meus = A.call('meusFeedbacks'); ok(!/"aud"|auditores/.test(JSON.stringify(meus)), 'quem dá o feedback recebeu o auditor');
});
T('ver quem auditou: o Admin libera por perfil (permissão ver_auditor); quem recebe vê o nome de quem auditou', () => {
  A.as('owner@x.com'); const perf = A.call('listarAcessos').perfis.find((p) => p.nome === 'Site Leader');
  ok(perf.perms.indexOf('ver_auditor') < 0, 'Site Leader começa sem a permissão');
  const r = A.call('salvarPerfil', Object.assign({}, perf, { perms: perf.perms.concat(['ver_auditor']) }), false); eq(r.ok, true, JSON.stringify(r));
  const sl = lista('sl@x.com'); ok(sl.pendencias.some((p) => (p.auditores || []).length), 'liberado: Site Leader recebe os auditores');
  ok(sl.pendencias.some((p) => p.auditorias.some((x) => x.audNome)), 'liberado: cada auditoria traz o nome de quem auditou');
  A.as('owner@x.com'); eq(A.call('salvarPerfil', Object.assign({}, perf), false).ok, true); // volta a negar
  ok(lista('sl@x.com').pendencias.every((p) => !(p.auditores || []).length && p.auditorias.every((x) => !x.audNome && !x.aud)), 'negado de novo');
});
T('ver quem auditou: quem dá o feedback só vê com a permissão no perfil dele', () => {
  A.as('aud1@x.com'); ok(!/"aud"|audNome/.test(JSON.stringify(A.call('meusFeedbacks'))), 'sem a permissão não vê');
  A.as('owner@x.com'); const perf = A.call('listarAcessos').perfis.find((p) => p.nome === 'Auditor');
  eq(A.call('salvarPerfil', Object.assign({}, perf, { perms: perf.perms.concat(['ver_auditor']) }), false).ok, true);
  A.as('aud1@x.com'); const m = A.call('meusFeedbacks'); ok(m.some((p) => p.auditorias.some((x) => x.audNome)), 'com a permissão vê quem auditou');
  A.as('owner@x.com'); eq(A.call('salvarPerfil', Object.assign({}, perf), false).ok, true);
});
T('ver quem auditou: só quem edita perfis (Admin) concede; o Site Leader não consegue', () => {
  A.as('sl@x.com'); let erro = ''; try { const pf = A.call('listarAcessos').perfis.find((p) => p.nome === 'Auditor'); const r = A.call('salvarPerfil', Object.assign({}, pf, { perms: pf.perms.concat(['ver_auditor']) }), false); erro = r.ok ? '' : 'recusado'; } catch (e) { erro = e.message; }
  ok(erro, 'Site Leader conseguiu conceder');
});
fim('v10 fase 3 (feedback)');
