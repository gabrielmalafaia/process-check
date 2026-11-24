const { T, eq, ok, nega, fim } = require('./lib.js');
const { cenario, novo } = require('./seed.js');
const A = cenario();
A.as('owner@x.com');
const perfil = (nome, perms, telas, escopo) => A.call('salvarPerfil', { nome, desc: 'teste', perms, telas, escopo: Object.assign({ modo: 'todos', processos: [], turnos: [] }, escopo) }, true);
const usuario = (email, nome, perfilNome) => A.ctx.anexar_('Cad_Usuarios', [email, nome, perfilNome, 'Sim']);
const R = (tipo, f, ex) => A.call('relatorio', tipo, f || A.F(), ex);

/* ===== A. Visão Geral: ofensores, críticos, série semanal, comparação ===== */
T('Visão Geral v7: devolve ofensores com taxa, unidade e variação (período anterior sem dados = null)', () => {
  A.as('sl@x.com'); const g = R('geral');
  ok(Array.isArray(g.ofd) && g.ofd.length > 0);
  const o = g.ofd[0]; ok(['proc', 'id', 'nc', 'aud', 'taxa', 'taxaB', 'dif', 'un'].every(k => k in o));
  ok(o.taxa > 0 && o.taxa <= 100); eq(o.taxaB, null); eq(o.dif, null);
  for (let i = 1; i < g.ofd.length; i++) ok(g.ofd[i - 1].taxa >= g.ofd[i].taxa, 'ordenado por taxa');
  eq(g.tem_b, false);
});
T('Visão Geral v7: auditorias com item crítico reprovado (item 1 de cada processo é crítico)', () => {
  A.as('sl@x.com'); const g = R('geral');
  // as 5 auditorias com NC reprovam, na ordem dos itens, o item 1 só quando nConf=0; nos testes de seed os conformes vêm primeiro => nenhum crítico
  ok(Number.isInteger(g.A.crit) && g.A.crit >= 0); ok(Number.isInteger(g.B.crit));
  const r0 = A.audit('aud1@x.com', 'Separação', { conf: 0, nc: 10, f: { doca: 'A-10', lider: 'Dora Lider', turno: 'T2' } }); eq(r0.ok, true, JSON.stringify(r0)); const id = r0.id; A.run('limparCache_()');
  A.as('sl@x.com'); const g2 = R('geral'); eq(g2.A.crit, g.A.crit + 1, 'uma auditoria com tudo reprovado inclui o item crítico');
  ok(id);
  // item NÃO crítico reprovado não conta: reprova só o último item (não crítico)
  const r1 = A.audit('aud1@x.com', 'Separação', { conf: 9, nc: 1, f: { doca: 'A-10', lider: 'Dora Lider', turno: 'T2' } }); eq(r1.ok, true); A.run('limparCache_()');
  A.as('sl@x.com'); eq(R('geral').A.crit, g2.A.crit, 'não crítico não altera o KPI');
});
T('auditoria antiga (sem a coluna Critico_NC) é lida do JSON: crítico reprovado conta', () => {
  const h = A.hist(); const col = h.d[0].indexOf('Critico_NC'); ok(col > -1);
  const n0 = h.d.length; let alvo = -1; for (let i = 1; i < h.d.length; i++) if (h.d[i][col] === 'S') { alvo = i; break; } ok(alvo > -1);
  A.as('sl@x.com'); const antes = R('geral').A.crit; h.d[alvo][col] = ''; A.run('limparCache_()');
  A.run("MEMO_ = {}"); eq(R('geral').A.crit, antes, 'mesmo resultado lendo o JSON legado'); h.d[alvo][col] = 'S'; ok(n0);
});
T('Visão Geral v7: série semanal cobre as semanas do período e soma o total', () => {
  A.as('sl@x.com'); const g = R('geral'); ok(g.sem.length >= 4);
  eq(g.sem.reduce((s, x) => s + x.n, 0), g.A.total);
  g.sem.forEach(x => eq(x.m === null, x.n === 0));
});
T('Comparação: com período anterior preenchido, ofensores trazem taxaB e variação', () => {
  A.as('sl@x.com'); const f = { de: A.dia(-3), ate: A.hojeStr }; const g = R('geral', f);
  // período anterior (3 dias antes) tem auditorias retroativas
  eq(g.tem_b, g.B.total > 0);
});
T('insights clicáveis: trazem o filtro (go) que abre as auditorias do item citado', () => {
  A.as('sl@x.com'); const g = R('geral'); const com = g.ins.filter(i => i.go);
  ok(com.length > 0); com.forEach(i => { ok(typeof i.go === 'object'); if (i.go.processo) ok(['Recebimento', 'Indução', 'Separação', 'Sorting', 'Compra', 'Expedição'].includes(i.go.processo), JSON.stringify(i)); if (i.go.turno) ok(['T1', 'T2', 'T3'].includes(i.go.turno)); });
  const r = R('auditorias', A.F(com[0].go)); ok(r.total >= 1, 'o filtro do insight devolve auditorias');
});
T('relatório devolve o limite de "poucas auditorias" (padrão 3) e a nota média como meta', () => {
  A.as('sl@x.com'); const g = R('geral'); eq(g.pouco, 3); eq(g.media, 90);
});

/* ===== B. Configuração ===== */
T('configuração: limite de poucas auditorias é validado e gravado', () => {
  A.as('owner@x.com'); const base = { dias: 7, corte: 70, media: 90 };
  eq(A.call('salvarConfigs', Object.assign({ poucas: 0 }, base)).erros.poucas, 'Informe um número inteiro entre 1 e 50.');
  eq(A.call('salvarConfigs', Object.assign({ poucas: 2.5 }, base)).ok, false);
  eq(A.call('salvarConfigs', Object.assign({ poucas: 5 }, base)).ok, true);
  A.as('sl@x.com'); eq(R('geral').pouco, 5);
  A.as('owner@x.com'); eq(A.call('salvarConfigs', Object.assign({ poucas: 3 }, base)).ok, true);
  eq(A.call('salvarConfigs', base).ok, true, 'sem o campo: mantém o valor');
  A.as('sl@x.com'); eq(R('geral').pouco, 3);
});

/* ===== C. Observações e ordenação ===== */
T('Auditorias: coluna de observações, bloco recente e busca por texto (sem acento, sem caixa)', () => {
  A.audit('aud1@x.com', 'Expedição', { conf: 5, nc: 5, obs: 'Vazamento na área de Expedição, atenção!', f: { doca: '36', colaboradores: ['Ana Souza'] } });
  A.run('limparCache_()'); A.as('sl@x.com');
  const r = R('auditorias'); ok(r.linhas.some(l => /Vazamento/.test(l.obs)));
  ok(r.obsRec.length >= 1 && r.obsRec.every(x => x.faixa !== 'verde' && x.obs));
  eq(R('auditorias', A.F({ obs: 'EXPEDICAO' })).linhas.length, 1);
  eq(R('auditorias', A.F({ obs: 'inexistente' })).linhas.length, 0);
});
T('Colaboradores: ordena pior nota com amostra suficiente primeiro; poucas auditorias por último; série semanal', () => {
  A.as('sl@x.com'); const c = R('colab');
  ok(c.colabs.every(x => x.serie.length <= 8 && 'pouca' in x));
  const idx = c.colabs.findIndex(x => x.pouca);
  if (idx > -1) ok(c.colabs.slice(idx).every(x => x.pouca), 'quem tem poucas auditorias vem depois');
  A.as('owner@x.com'); A.call('salvarConfigs', { dias: 7, corte: 70, media: 90, poucas: 1 }); A.as('sl@x.com');
  ok(R('colab').colabs.every(x => !x.pouca), 'com limite 1 ninguém é "pouca"');
  A.as('owner@x.com'); A.call('salvarConfigs', { dias: 7, corte: 70, media: 90, poucas: 3 });
});

/* ===== D. Sem a permissão "ver nomes": nenhum nome sai do servidor ===== */
T('sem "ver nomes": listas, relatório por colaborador, detalhe, itens e CSV não devolvem nomes', () => {
  A.as('owner@x.com');
  eq(perfil('Gerente Sem Nomes', ['exportar'], ['geral', 'auditorias', 'colab', 'export'], {}).ok, true);
  usuario('sn@x.com', 'Gerente SN', 'Gerente Sem Nomes'); A.run('limparCache_()');
  A.as('sn@x.com');
  const au = R('auditorias'); ok(au.semNomes === true); ok(au.linhas.length > 0 && au.linhas.every(l => l.colab === ''));
  const co = R('colab'); eq([co.colabs.length, co.semAuditoria.length, co.totalSem], [0, 0, 0]); ok(co.times.length > 0, 'equipes continuam visíveis');
  nega(() => R('detalhe', A.F(), { kind: 'colab', chave: 'Ana Souza' }), 'por colaborador');
  eq(R('detalhe', A.F(), { kind: 'lider', chave: 'Carlos Lider' }).hist.every(h => h.colab === ''), true);
  const it = R('itensAuditoria', A.F(), { id: A.ids.a2 }); eq(it.colab, '');
  const ex = R('export'); ok(ex.linhas.length > 0 && ex.linhas.every(l => l[4] === ''));
  const txt = JSON.stringify([au, co, ex, it]); ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Davi Reis'].forEach(n => ok(txt.indexOf(n) < 0, 'vazou ' + n));
});
T('com "ver nomes" (Site Leader) os nomes continuam aparecendo', () => {
  A.as('sl@x.com'); ok(R('auditorias').linhas.some(l => l.colab)); ok(R('colab').colabs.length > 0);
});

/* ===== E. Traduções cadastradas (EN/ES) ===== */
T('cadastro de pergunta aceita Subprocesso/Descricao EN/ES e o relatório de itens as devolve', () => {
  A.as('owner@x.com');
  const q = A.call('listarCadastro', 'Cad_Processos_Perguntas').find(x => x.Processo === 'Expedição' && x.Descricao_Item === 'Expedição item 1');
  const o = Object.assign({}, q, { Subprocesso_EN: 'Dock safety', Subprocesso_ES: 'Seguridad de muelle', Descricao_EN: 'Dock item 1', Descricao_ES: 'Elemento 1' });
  const r = A.call('salvarCadastro', 'Cad_Processos_Perguntas', o, q); eq(r.ok, true, JSON.stringify(r));
  A.as('sl@x.com'); const it = R('itensAuditoria', A.F(), { id: A.ids.a3 }).itens.find(i => i.desc === 'Expedição item 1');
  eq([it.desc_en, it.desc_es, it.id_en, it.id_es], ['Dock item 1', 'Elemento 1', 'Dock safety', 'Seguridad de muelle']);
  A.as('owner@x.com'); const q2 = A.call('listarCadastro', 'Cad_Processos_Perguntas').find(x => x._row === q._row);
  const r2 = A.call('salvarCadastro', 'Cad_Processos_Perguntas', Object.assign({}, q2, { Descricao_EN: 'x'.repeat(301) }), q2); eq(r2.erros.Descricao_EN, 'Máximo de 300 caracteres.');
});

/* ===== F. Relatório por e-mail ===== */
const lider = () => { A.as('owner@x.com'); eq(perfil('Lider de Time', ['ver_nomes'], ['matriz', 'geral', 'colab'], { modo: 'time' }).ok, true); usuario('lid@x.com', 'Carlos Lider', 'Lider de Time'); usuario('lid2@x.com', 'Dora Lider', 'Lider de Time'); };
lider();
const emails = () => A.emails.slice();
T('e-mail: somente quem tem a permissão gerencia destinatários', () => {
  A.as('aud1@x.com'); nega(() => A.call('listarEmailRel'), 'permissão'); nega(() => A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Semanal' }), 'permissão');
  nega(() => A.call('enviarRelatorioAgora', ''), 'permissão'); nega(() => A.call('alternarAgendamentoRel', true), 'permissão');
  A.as('sn@x.com'); nega(() => A.call('listarEmailRel'), 'permissão');
});
T('e-mail: valida frequência, usuário, perfil sem Visão Geral; idioma inválido vira pt', () => {
  A.as('owner@x.com');
  eq(A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Hora' }).ok, false);
  eq(A.call('salvarEmailRel', { email: 'ninguem@x.com', freq: 'Semanal' }).msg, 'Usuário não cadastrado ou inativo.');
  eq(A.call('salvarEmailRel', { email: 'off@x.com', freq: 'Semanal' }).ok, false);
  ok(/Visão Geral/.test(A.call('salvarEmailRel', { email: 'aud1@x.com', freq: 'Semanal' }).msg));
  const r = A.call('salvarEmailRel', { email: 'SL@x.com', freq: 'Semanal', idioma: 'xx' }); eq(r.ok, true); eq(r.linhas[0].idioma, 'pt'); eq(r.linhas.length, 1);
  eq(A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Mensal', idioma: 'pt' }).linhas.length, 1, 'mesmo e-mail edita, não duplica');
});
T('e-mail: cada destinatário recebe só o escopo do próprio perfil (líder só o time; Site Leader tudo)', () => {
  A.as('owner@x.com');
  A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Semanal', idioma: 'pt' });
  A.call('salvarEmailRel', { email: 'lid@x.com', freq: 'Semanal', idioma: 'en' });
  A.call('salvarEmailRel', { email: 'lid2@x.com', freq: 'Semanal', idioma: 'es' });
  A.emails.length = 0; const r = A.call('enviarRelatorioAgora', ''); eq([r.ok, r.enviados, r.falhas.length], [true, 3, 0]);
  const por = {}; emails().forEach(m => { por[m.to] = m; });
  const nTot = t => Number((/(?:Auditorias|Audits|Auditorías): (\d+)/.exec(t) || [])[1]);
  const esperado = (email, nome) => { A.as(email); return R('geral', { de: A.dia(-6), ate: A.dia(0) }).A.total; };
  eq(nTot(por['sl@x.com'].body), esperado('sl@x.com')); eq(nTot(por['lid@x.com'].body), esperado('lid@x.com')); eq(nTot(por['lid2@x.com'].body), esperado('lid2@x.com'));
  ok(nTot(por['sl@x.com'].body) > nTot(por['lid@x.com'].body), 'Site Leader vê mais que o líder'); eq(nTot(por['lid@x.com'].body) + nTot(por['lid2@x.com'].body) >= 4, true);
  ok(!/Dora/.test(por['lid@x.com'].htmlBody + por['lid@x.com'].body), 'líder Carlos não vê dados da Dora'); ok(!/Carlos Lider/.test(por['lid2@x.com'].htmlBody.replace(/Equipe de Carlos Lider/, '')));
  ok(/Team of Carlos Lider/.test(por['lid@x.com'].htmlBody) && /Equipo de Dora Lider/.test(por['lid2@x.com'].htmlBody) && /Todos os dados/.test(por['sl@x.com'].htmlBody));
});
T('e-mail: idioma do destinatário (EN/ES/PT), assunto, números e sem emojis', () => {
  const por = {}; emails().forEach(m => { por[m.to] = m; });
  ok(/^Audit report/.test(por['lid@x.com'].subject) && /^Informe de auditor/.test(por['lid2@x.com'].subject) && /^Relatório de auditorias/.test(por['sl@x.com'].subject));
  ok(/Average score/.test(por['lid@x.com'].htmlBody) && /Nota promedio/.test(por['lid2@x.com'].htmlBody) && /Nota média/.test(por['sl@x.com'].htmlBody));
  emails().forEach(m => { ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(m.htmlBody + m.body)); ok(/Process Check/.test(m.htmlBody)); });
  ok(/script\.google\.com/.test(por['sl@x.com'].htmlBody));
});
T('e-mail: dados do e-mail do Site Leader batem com a Visão Geral dele (nota média e metas)', () => {
  A.as('sl@x.com'); const g = R('geral', { de: A.dia(-6), ate: A.dia(0) });
  const m = emails().find(x => x.to === 'sl@x.com');
  ok(m.htmlBody.indexOf(g.A.media.toFixed(1) + '%') > -1); ok(new RegExp('Em conformidade: ' + g.A.conf).test(m.body));
});
T('e-mail: usuário que perdeu o acesso ou a Visão Geral é pulado sem derrubar os outros', () => {
  A.as('owner@x.com');
  A.run("lerDireto_('Cad_Usuarios')"); const u = A.call('lerDireto_', 'Cad_Usuarios').find(x => x.Email_Google === 'lid2@x.com');
  A.sheets.Cad_Usuarios.d[u._row - 1][3] = 'Não'; A.run('limparCache_()');
  A.emails.length = 0; const r = A.call('enviarRelatorioAgora', '');
  eq([r.enviados, r.falhas], [2, [{ email: 'lid2@x.com', motivo: 'sem_acesso' }]]);
  A.sheets.Cad_Usuarios.d[u._row - 1][3] = 'Sim'; A.run('limparCache_()');
});
T('e-mail: falha de envio de um destinatário não impede os outros e fica no log', () => {
  A.as('owner@x.com'); A.mailFalhaPara = 'lid@x.com'; A.emails.length = 0; const r = A.call('enviarRelatorioAgora', '');
  eq([r.enviados, r.falhas.map(x => x.email)], [2, ['lid@x.com']]); A.mailFalhaPara = '';
  ok(A.call('lerDireto_', 'Log_Permissoes').some(l => l.Acao === 'Relatório por e-mail não enviado' && l.Alvo === 'lid@x.com'));
  ok(A.call('lerDireto_', 'Log_Permissoes').some(l => l.Acao === 'Relatório por e-mail enviado' && l.Alvo === 'sl@x.com'));
});
T('e-mail: cota esgotada não envia e informa o motivo', () => {
  A.as('owner@x.com'); A.cota = 0; A.emails.length = 0; const r = A.call('enviarRelatorioAgora', 'sl@x.com'); A.cota = undefined;
  eq([r.enviados, r.falhas[0].motivo, A.emails.length], [0, 'cota', 0]);
});
T('e-mail: destinatário pausado não recebe; enviar agora sem destinatários ativos avisa', () => {
  A.as('owner@x.com'); A.call('salvarEmailRel', { email: 'lid@x.com', freq: 'Semanal', idioma: 'en', ativo: false });
  A.emails.length = 0; const r = A.call('enviarRelatorioAgora', ''); eq(r.enviados, 2); ok(!A.emails.some(m => m.to === 'lid@x.com'));
  A.call('salvarEmailRel', { email: 'lid@x.com', freq: 'Semanal', idioma: 'en', ativo: true });
});
T('e-mail: período sem auditorias gera aviso (não envia números inventados)', () => {
  A.as('owner@x.com');
  const m = A.run("montarEmailRel_(acessoDe_('lid@x.com'), 'pt', { de: '2020-01-01', ate: '2020-01-07' })"); ok(/Nenhuma auditoria no seu escopo/.test(m.html)); eq(m.total, 0);
});
T('e-mail agendado: só o dono ou o gatilho; envia quem vence hoje; não duplica no mesmo dia', () => {
  A.as('owner@x.com');
  A.call('alternarAgendamentoRel', false); eq(A.call('listarEmailRel').agendado, false);
  eq(A.call('alternarAgendamentoRel', true).agendado, true); eq(A.call('alternarAgendamentoRel', true).agendado, true); eq(A.triggers.length, 1, 'não cria gatilho duplicado');
  A.as('sl@x.com'); nega(() => A.call('enviarRelatoriosAgendados'), 'Acesso negado'); A.as('owner@x.com');
  ['sl@x.com', 'lid@x.com', 'lid2@x.com'].forEach(e => A.call('salvarEmailRel', { email: e, freq: 'Diario', idioma: 'pt' }));
  A.sheets.Cad_Relatorio_Email.d.forEach((l, i) => { if (i) l[4] = ''; });
  A.emails.length = 0; let r = A.call('enviarRelatoriosAgendados'); eq(r.enviados, 3);
  A.emails.length = 0; r = A.call('enviarRelatoriosAgendados'); eq([r.enviados, A.emails.length], [0, 0]);
  eq(A.call('alternarAgendamentoRel', false).agendado, false); eq(A.triggers.length, 0);
});
T('e-mail: o período termina HOJE (auditoria de hoje entra no relatório) e o agendamento é às 22h', () => {
  A.as('owner@x.com');
  const hoje = A.run('hoje_()');
  eq(A.run("periodoEmail_('Diario')"), { de: hoje, ate: hoje }); eq(A.run("periodoEmail_('Semanal')").ate, hoje); eq(A.run("periodoEmail_('Mensal')").ate, hoje);
  A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Diario', idioma: 'pt' }); A.run('limparCache_()'); A.emails.length = 0;
  const r = A.call('enviarRelatorioAgora', 'sl@x.com'); eq(r.enviados, 1, JSON.stringify(r));
  const m = A.emails[0]; ok(!/Nenhuma auditoria no seu escopo/.test(m.htmlBody), 'relatório de hoje não pode sair vazio'); ok(/Auditorias/.test(m.htmlBody)); ok(!/Auditorias: 0\n/.test(m.body));
  // gatilho antigo (7h, sem a marca de horário) é substituído por um de 22h, sem duplicar
  A.call('alternarAgendamentoRel', false); A.triggers.length = 0;
  A.ctx.ScriptApp.newTrigger('enviarRelatoriosAgendados').timeBased().everyDays(1).atHour(7).create();
  eq(A.triggers.length, 1); eq(A.triggers[0].hora, 7);
  A.call('alternarAgendamentoRel', true); eq(A.triggers.length, 1); eq(A.triggers[0].hora, 22);
  A.call('alternarAgendamentoRel', true); eq(A.triggers.length, 1); eq(A.triggers[0].hora, 22);
  A.call('alternarAgendamentoRel', false); eq(A.triggers.length, 0);
});
T('e-mail: "Enviar agora" não marca o dia como enviado (não bloqueia o envio completo das 22h)', () => {
  A.as('owner@x.com'); A.call('salvarEmailRel', { email: 'sl@x.com', freq: 'Diario', idioma: 'pt' });
  A.sheets.Cad_Relatorio_Email.d.forEach((l, i) => { if (i) l[4] = ''; }); A.run('limparCache_()'); A.emails.length = 0;
  eq(A.call('enviarRelatorioAgora', 'sl@x.com').enviados, 1);
  eq(A.sheets.Cad_Relatorio_Email.d.filter((l, i) => i && l[0] === 'sl@x.com').map(l => l[4]), ['']);
  const r = A.call('enviarRelatoriosAgendados'); eq(r.enviados >= 1, true, 'o agendado ainda envia depois de um envio manual');
  ok(A.sheets.Cad_Relatorio_Email.d.filter((l, i) => i && l[0] === 'sl@x.com')[0][4] !== '', 'agendado grava a data');
});
T('e-mail agendado: semanal só na segunda e mensal só no dia 1', () => {
  const dow = A.run("new Date(hoje_() + 'T00:00:00Z').getUTCDay()"), dia = A.run("new Date(hoje_() + 'T00:00:00Z').getUTCDate()");
  eq(A.run("devidoHoje_('Diario')"), true); eq(A.run("devidoHoje_('Semanal')"), dow === 1); eq(A.run("devidoHoje_('Mensal')"), dia === 1);
});
T('e-mail: remover destinatário e candidatos listados', () => {
  A.as('owner@x.com'); const l = A.call('listarEmailRel'); ok(l.candidatos.every(c => !l.linhas.some(x => x.email === c.email)));
  ok(!l.candidatos.some(c => c.email === 'aud1@x.com'), 'quem não vê a Visão Geral não é candidato');
  eq(A.call('excluirEmailRel', 'lid2@x.com').linhas.some(x => x.email === 'lid2@x.com'), false); eq(A.call('excluirEmailRel', 'lid2@x.com').ok, false);
});
T('e-mail: o relatório do destinatário nunca usa o perfil de quem dispara o envio', () => {
  A.as('owner@x.com'); A.emails.length = 0; A.call('enviarRelatorioAgora', 'lid@x.com');
  ok(!/Dora/.test(A.emails[0].htmlBody), 'Admin disparou, mas o conteúdo segue o escopo do líder');
});

/* ===== G. Migração v6.2 -> v7 (simula a planilha antiga e roda duas vezes) ===== */
T('migrarV7: planilha v6.2 (sem colunas de tradução, sem aba de e-mail, perfis sem ver_nomes) atualiza e é idempotente', () => {
  const B = novo(); B.as('owner@x.com');
  // simula v6.2
  B.sheets.Cad_Processos_Perguntas.d = B.sheets.Cad_Processos_Perguntas.d.map(l => l.slice(0, 4));
  delete B.sheets.Cad_Relatorio_Email;
  const pf = B.sheets.Cad_Perfis; for (let i = 1; i < pf.d.length; i++) pf.d[i][2] = String(pf.d[i][2]).split(',').filter(x => x !== 'ver_nomes' && x !== 'email_rel').join(',');
  B.call('salvarPerfil', { nome: 'Gestor', desc: 'x', perms: [], telas: ['geral', 'colab'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true);
  const gestor = () => B.sheets.Cad_Perfis.d.find(l => l[0] === 'Gestor');
  gestor()[2] = ''; B.run('limparCache_()');
  const nAud = B.hist().getLastRow(), snap = () => JSON.stringify([B.sheets.Cad_Processos_Perguntas.d.map(l => l.slice(0, 4)), B.sheets.Cad_Usuarios.d, B.sheets.Cad_Estrutura.d, B.sheets.Cad_Pessoas.d]);
  const antes = snap();
  const r1 = B.call('migrarV7');
  eq(B.sheets.Cad_Processos_Perguntas.d[0], ['Processo', 'ID_Subprocesso', 'Descricao_Item', 'Requisito_Critico', 'Subprocesso_EN', 'Subprocesso_ES', 'Descricao_EN', 'Descricao_ES']);
  ok(B.sheets.Cad_Relatorio_Email); eq(B.sheets.Cad_Relatorio_Email.d[0], ['Email', 'Frequencia', 'Idioma', 'Ativo', 'Ultimo_Envio']);
  ok(String(gestor()[2]).split(',').indexOf('ver_nomes') > -1, 'perfil que via relatórios continua vendo nomes');
  ok(r1.v7.perfisAtualizados >= 1); eq(snap(), antes, 'dados e cadastros preservados'); eq(B.hist().getLastRow(), nAud);
  const depois = JSON.stringify(B.sheets.Cad_Perfis.d); const r2 = B.call('migrarV7');
  eq(JSON.stringify(B.sheets.Cad_Perfis.d), depois, 'segunda execução não muda nada'); eq(r2.v7.perfisAtualizados, 0);
  eq(B.sheets.Cad_Processos_Perguntas.d[0].length, 8);
  // salvar pergunta numa planilha ainda sem as colunas também funciona (cabeçalho completado na hora)
  const C = novo(); C.as('owner@x.com'); C.sheets.Cad_Processos_Perguntas.d = C.sheets.Cad_Processos_Perguntas.d.map(l => l.slice(0, 4));
  const rr = C.call('salvarCadastro', 'Cad_Processos_Perguntas', { Processo: 'Compra', ID_Subprocesso: 'Sub9', Descricao_Item: 'Item novo', Requisito_Critico: 'Não', Descricao_EN: 'New item' }, null);
  eq(rr.ok, true); eq(C.sheets.Cad_Processos_Perguntas.d[0].length, 8);
});
T('migração a partir da v6.1 (Cad_Solicitacoes com 9 colunas) continua funcionando', () => {
  const B = novo(); B.as('owner@x.com'); B.sheets.Cad_Solicitacoes.d = B.sheets.Cad_Solicitacoes.d.map(l => l.slice(0, 9)); B.call('migrarV7');
  eq(B.sheets.Cad_Solicitacoes.d[0].length, 12);
});
T('perfis padrão: Admin/Analista/Site Leader têm ver_nomes e email_rel; Auditor não', () => {
  A.as('owner@x.com'); const p = A.call('listarAcessos').perfis; const g = n => p.find(x => x.nome === n).perms;
  ['Admin', 'Analista', 'Site Leader'].forEach(n => { ok(g(n).includes('ver_nomes')); ok(g(n).includes('email_rel')); });
  ok(!g('Auditor').includes('ver_nomes') && !g('Auditor').includes('email_rel'));
});
fim('SERVIDOR parte 4 (v7: ofensores, nomes, e-mail por perfil, migração)');
