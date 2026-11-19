const { T, eq, ok, nega, fim } = require('./lib.js');
const { novo, cenario } = require('./seed.js');

/* ===================== A. REGRESSÃO (tudo que já existia na v5) ===================== */
{
  const A = novo();
  T('setup: abas, perfis padrão e Admin dono', () => {
    ['Auditorias_Historico', 'Auditorias_Colaboradores', 'Cad_Perfis', 'Metas', 'Log_Permissoes', 'Configuracoes'].forEach(n => ok(A.sheets[n], 'falta ' + n));
    eq(A.sheets.Cad_Perfis.getLastRow(), 5);
    eq(A.sheets.Auditorias_Historico.d[0].length, 16);
  });
  T('setup/migração é idempotente (não duplica perfis)', () => { A.as('owner@x.com'); A.call('migrarV6'); A.call('migrarV6'); eq(A.sheets.Cad_Perfis.getLastRow(), 5); });
  T('bloqueados: não cadastrado, inativo e sem e-mail', () => {
    A.as('ghost@x.com'); eq(A.call('bootstrap').user.ok, false);
    A.as('off@x.com'); eq(A.call('bootstrap').user.ok, false);
    A.as(''); const b = A.call('bootstrap'); eq(b.user.ok, false); eq(b.user.motivo, 'sem_email');
    A.as('ghost@x.com'); nega(() => A.ctx.getMatriz('Recebimento'), 'Acesso negado');
  });
  T('e-mail com caixa diferente/espaços entra', () => { A.as('  ANA@X.COM '); eq(A.call('bootstrap').user.ok, true); });
  T('doca numérica "36" e "01" (Sheets converte em número) é encontrada', () => {
    const e = A.J(A.ctx.lerAba_('Cad_Estrutura')); eq(e.map(x => x.Identificador), ['36', '01', '07', 'A-10', 'B-20']);
    const r = A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', lider: 'Carlos Lider', turno: 'T1' } }); eq(r.ok, true, JSON.stringify(r));
    const r2 = A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '01', colaborador: 'Ana Souza' } }); eq(r2.ok, true, JSON.stringify(r2));
    const h = A.hist(); eq(h.d[h.getLastRow() - 1][3], '01');
  });
  T('doca inexistente / vazia / cluster errado', () => {
    eq(A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '99', turno: 'T1', lider: 'Carlos Lider' } }).erros.doca, 'Doca não cadastrada.');
    eq(A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: {} }).erros.doca, 'Selecione a doca.');
    eq(A.audit('aud1@x.com', 'Separação', { conf: 10, f: { doca: '36' } }).erros.doca, 'Cluster não cadastrado.');
  });
  T('faixas: 69.9 vermelho, 70 observação, 89.9 observação, 90 verde', () => {
    const f = (conf, nc) => A.audit('aud1@x.com', 'Sorting', { conf, nc, f: { doca: 'B-20', lider: 'Carlos Lider', turno: 'T1' } });
    // 10 itens: 7 conf/3 nc = 70% ; 6/4 = 60 ; 9/1=90 ; 8/2=80
    eq(f(7, 3).status, 'Em Observação'); eq(f(6, 4).status, 'Em Inconformidade'); eq(f(9, 1).status, 'Completo e em Conformidade'); eq(f(8, 2).status, 'Em Observação');
    // 3 avaliados: 2/3 = 66.7 -> vermelho ; N/A não conta
    eq(f(2, 1).pct, 66.7); eq(f(2, 1).status, 'Em Inconformidade'); eq(f(1, 0).pct, 100);
  });
  T('crítico sozinho não reprova: só a nota decide', () => {
    const resp = A.perg('Sorting').map((x, i) => ({ k: x._row, ok: i === 0 ? false : true }));
    A.as('aud1@x.com'); const r = A.call('salvarAuditoria', { processo: 'Sorting', doca: 'B-20', lider: 'Carlos Lider', turno: 'T1', respostas: resp });
    eq(r.pct, 90); eq(r.status, 'Completo e em Conformidade');
  });
  T('tudo N/A, itens faltando e valores estranhos são recusados', () => {
    eq(A.audit('aud1@x.com', 'Sorting', { conf: 0, nc: 0, f: { doca: 'B-20', lider: 'Carlos Lider', turno: 'T1' } }).erros.itens, 'Avalie ao menos um item (nem tudo pode ser N/A).');
    A.as('aud1@x.com');
    const r = A.call('salvarAuditoria', { processo: 'Sorting', doca: 'B-20', lider: 'Carlos Lider', turno: 'T1', respostas: A.resp('Sorting', 5, 0).slice(0, 7) });
    eq(r.ok, false); ok(/Responda todos os itens \(3 pendentes\)/.test(r.erros.itens)); eq(r.faltam.length, 3);
    const r2 = A.call('salvarAuditoria', { processo: 'Sorting', doca: 'B-20', lider: 'Carlos Lider', turno: 'T1', respostas: A.perg('Sorting').map(x => ({ k: x._row, ok: 'sim' })) });
    eq(r2.ok, false);
    eq(A.call('salvarAuditoria', { processo: 'Inexistente', respostas: [] }).ok, false);
    eq(A.call('salvarAuditoria', null).ok, false);
  });
  T('observações > 500 recusadas; fórmula neutralizada', () => {
    eq(A.audit('aud1@x.com', 'Sorting', { conf: 10, obs: 'x'.repeat(501), f: { doca: 'B-20', lider: 'Carlos Lider', turno: 'T1' } }).erros.obs, 'Máximo de 500 caracteres.');
    const r = A.audit('aud1@x.com', 'Sorting', { conf: 10, obs: '=HYPERLINK("http://x")', f: { doca: 'B-20', lider: 'Carlos Lider', turno: 'T1' } });
    const h = A.hist(); eq(h.d[h.getLastRow() - 1][10], ' =HYPERLINK("http://x")', r.id);
  });
  T('colaborador define líder e turno (ignora o que o cliente mandou)', () => {
    const r = A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Carla Dias', lider: 'Carlos Lider', turno: 'T1' } });
    eq(r.ok, true); const h = A.hist(), l = h.d[h.getLastRow() - 1];
    eq([l[4], l[5], l[6]], ['Carla Dias', 'Dora Lider', 'T2']);
  });
  T('colaborador inativo ou inexistente é recusado', () => {
    eq(A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Fabio Saiu' } }).erros.colaborador, 'Colaborador não cadastrado ou inativo: Fabio Saiu.');
    ok(/não cadastrado/.test(A.audit('aud1@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaborador: 'Carlos Lider' } }).erros.colaborador), 'líder não é colaborador');
  });
  T('Indução: sem doca, colaborador obrigatório, líder do cadastro', () => {
    eq(A.audit('aud1@x.com', 'Indução', { conf: 10, f: {} }).erros.colaborador, 'Selecione o colaborador.');
    const r = A.audit('aud1@x.com', 'Indução', { conf: 9, nc: 1, f: { colaborador: 'Eva Nunes', doca: 'ignorada' } }); eq(r.ok, true);
    const h = A.hist(), l = h.d[h.getLastRow() - 1]; eq([l[3], l[4], l[5], l[6]], ['', 'Eva Nunes', 'Carlos Lider', 'T1']);
  });
  T('Matriz: nunca / verde / observação / vermelho / vencido / rascunho', () => {
    A.as('ana@x.com');
    let m = A.call('getMatriz', 'Recebimento'); eq(m.find(x => x.id === '07').status, 'nunca');
    ok(['verde', 'observacao', 'vermelho'].indexOf(m.find(x => x.id === '36').status) > -1);
    eq(m.find(x => x.id === '01').ultColab, 'Ana Souza'); eq(m.find(x => x.id === '36').ultLider, 'Dora Lider');
    const id = A.audit('aud2@x.com', 'Recebimento', { conf: 6, nc: 4, f: { doca: '07' , lider: 'Dora Lider', turno: 'T2'} }).id; A.run('limparCache_()');
    eq(A.call('getMatriz', 'Recebimento').find(x => x.id === '07').status, 'vermelho');
    const novoId = A.retro(id, 10); A.as('ana@x.com');
    const v = A.call('getMatriz', 'Recebimento').find(x => x.id === '07'); eq(v.status, 'vencido'); ok(v.dias >= 10);
    A.as('aud1@x.com'); A.call('salvarRascunho', { processo: 'Recebimento', chave: '07', estado: { resp: {} } });
    eq(A.call('getMatriz', 'Recebimento').find(x => x.id === '07').status, 'rascunho');
    const mi = A.call('getMatriz', 'Indução'); eq(mi.find(x => x.id === 'Carlos Lider').tipo, 'Time');
  });
  T('Matriz: ao salvar nova auditoria o card muda na hora (cache invalidado)', () => {
    A.as('aud1@x.com'); A.call('getMatriz', 'Compra');
    A.audit('aud1@x.com', 'Compra', { conf: 10, f: { doca: 'A-10', lider: 'Dora Lider', turno: 'T2' } });
    eq(A.call('getMatriz', 'Compra').find(x => x.id === 'A-10').status, 'verde');
  });
  T('rascunho: salva, lê, expira em 3 dias, descarta; some ao finalizar', () => {
    A.as('aud1@x.com');
    A.call('salvarRascunho', { processo: 'Expedição', chave: '36', estado: { obs: 'x', resp: { 1: true } } });
    eq(A.call('getRascunho', 'Expedição', '36').obs, 'x');
    A.as('aud2@x.com'); eq(A.call('getRascunho', 'Expedição', '36'), null);
    A.as('aud1@x.com');
    const s = A.sheets.Auditorias_Rascunho, r = s.getLastRow(); s.d[r - 1][1] = new Date(Date.now() - 4 * 864e5);
    eq(A.call('getRascunho', 'Expedição', '36'), null);
    A.call('salvarRascunho', { processo: 'Expedição', chave: '36', estado: { obs: 'y' } });
    eq(A.call('getRascunho', 'Expedição', '36').obs, 'y'); eq(s.getLastRow(), r, 'reusa a linha');
    A.call('descartarRascunho', 'Expedição', '36'); eq(A.call('getRascunho', 'Expedição', '36'), null);
    A.call('salvarRascunho', { processo: 'Expedição', chave: '36', estado: {} });
    eq(A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza'] } }).ok, true);
    eq(A.call('getRascunho', 'Expedição', '36'), null);
  });
  T('rascunho Indução por colaborador + getRascunhoLider', () => {
    A.as('aud1@x.com');
    A.call('salvarRascunho', { processo: 'Indução', chave: 'Bruno Lima', estado: { colaborador: 'Bruno Lima', lider: 'Carlos Lider', resp: {} } });
    eq(A.call('getRascunhoLider', 'Carlos Lider').chave, 'Bruno Lima');
    eq(A.call('getRascunhoLider', 'Dora Lider'), null);
    nega(() => A.ctx.salvarRascunho({ processo: 'X', chave: 'a', estado: {} }), 'inválido');
    nega(() => A.ctx.salvarRascunho({ processo: 'Indução', chave: 'a', estado: { x: 'y'.repeat(50000) } }), 'grande demais');
  });
  T('cadastros: duplicidade, líder obrigatório, cor/símbolo, nome com ; ou |', () => {
    A.as('ana@x.com');
    eq(A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Doca', Identificador: '36', Cor_Simbolo: 'Azul/Cruz' }, null).erros.Identificador, 'Já existe uma doca com este identificador.');
    eq(A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Doca', Identificador: '40', Cor_Simbolo: 'Foo/Bar' }, null).erros.Cor_Simbolo, 'Escolha a cor e o símbolo da lista.');
    eq(A.call('salvarCadastro', 'Cad_Estrutura', { Tipo: 'Doca', Identificador: '40', Cor_Simbolo: 'bolinha laranja' }, null).ok, true);
    eq(A.call('getMatriz', 'Recebimento').find(x => x.id === '40').simbolo, 'Laranja/Bolinha');
    eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Zé', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim' }, null).erros.Lider, 'Informe o líder do colaborador.');
    eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Zé; Ana', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }, null).erros.Nome, 'O nome não pode conter ; ou |.');
    eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: '__proto__', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }, null).erros.Nome, 'Nome reservado pelo sistema.');
    eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'ana souza', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }, null).erros.Nome, 'Já existe uma pessoa com este nome.');
    eq(A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'N'.repeat(121), Cargo: 'Líder', Turno: 'T1', Status_Ativo: 'Sim' }, null).erros.Nome, 'Máximo de 120 caracteres.');
  });
  T('Cad_Usuarios NÃO é mais editável pelo caminho genérico de cadastros', () => {
    nega(() => A.ctx.salvarCadastro('Cad_Usuarios', { Email_Google: 'x@x.com', Nome: 'x', Perfil: 'Admin', Status_Ativo: 'Sim' }, null), 'Aba inválida');
    nega(() => A.ctx.excluirCadastro('Cad_Usuarios', 2, {}), 'Aba inválida');
    nega(() => A.ctx.listarCadastro('Cad_Usuarios'), 'Aba inválida');
  });
  T('renomear líder propaga; excluir líder com colaboradores é bloqueado; edição concorrente detectada', () => {
    A.as('ana@x.com');
    const l = A.J(A.ctx.listarCadastro('Cad_Pessoas')).find(x => x.Nome === 'Dora Lider');
    const r = A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, l, { Nome: 'Dora L. Nova' }), l); eq(r.ok, true);
    eq(A.call('listarCadastro', 'Cad_Pessoas').find(x => x.Nome === 'Carla Dias').Lider, 'Dora L. Nova');
    eq(A.call('listarCadastro', 'Cad_Estrutura').find(x => x.Identificador === '07').Lider_Padrao, 'Dora L. Nova');
    const novoL = A.call('listarCadastro', 'Cad_Pessoas').find(x => x.Nome === 'Dora L. Nova');
    ok(/colaborador\(es\) vinculado/.test(A.call('excluirCadastro', 'Cad_Pessoas', novoL._row, novoL).msg));
    const velho = Object.assign({}, novoL, { Turno: 'T3' });
    ok(/alterado ou removido/.test(A.call('salvarCadastro', 'Cad_Pessoas', Object.assign({}, novoL, { Turno: 'T1' }), velho).msg));
  });
  T('configs: validações, legado (corte antigo vira média), NaN ignorado', () => {
    A.as('ana@x.com');
    eq(A.call('salvarConfigs', { dias: 0, corte: 70, media: 90 }).erros.dias, 'Informe um número inteiro de dias, 1 ou mais.');
    eq(A.call('salvarConfigs', { dias: 7, corte: 90, media: 90 }).erros.media, 'A nota média deve ser maior que a nota de corte.');
    eq(A.call('salvarConfigs', { dias: 7, corte: 70, media: 101 }).erros.media, 'Informe um valor entre 0 e 100.');
    eq(A.call('salvarConfigs', { dias: 5, corte: 60, media: 85 }).config.NOTA_MEDIA_PCT, 85);
    A.as('owner@x.com'); const c = A.sheets.Configuracoes; c.d[2][1] = 'abc'; A.run('limparCache_()');
    eq(A.call('bootstrap').config.NOTA_CORTE_PCT, 70, 'valor inválido não vira NaN');
  });
  T('config legado: só NOTA_CORTE=90 => média 90 e corte 70', () => {
    const B = novo(); const c = B.sheets.Configuracoes; c.d.length = 1; c.appendRow(['NOTA_CORTE_PCT', 90]); B.run('limparCache_()');
    const cfg = B.call('bootstrap').config; eq([cfg.NOTA_CORTE_PCT, cfg.NOTA_MEDIA_PCT], [70, 90]);
  });
}

/* ===================== B. EXPEDIÇÃO COM VÁRIOS COLABORADORES ===================== */
{
  const A = novo();
  T('multi: 3 colaboradores, uma nota para a doca; histórico resumido + aba auxiliar', () => {
    const r = A.audit('aud1@x.com', 'Expedição', { conf: 8, nc: 2, f: { doca: '36', colaboradores: ['Ana Souza', 'Bruno Lima', 'Eva Nunes'] } });
    eq(r.ok, true, JSON.stringify(r)); eq(r.pct, 80);
    const h = A.hist(), l = h.d[h.getLastRow() - 1];
    eq([l[4], l[5], l[6], l[8]], ['Ana Souza; Bruno Lima; Eva Nunes', 'Carlos Lider', 'T1', 80]);
    const ax = A.sheets.Auditorias_Colaboradores; eq(ax.getLastRow(), 4);
    eq(ax.d.slice(1).map(x => x.slice(1, 4)), [['Ana Souza', 'Carlos Lider', 'T1'], ['Bruno Lima', 'Carlos Lider', 'T1'], ['Eva Nunes', 'Carlos Lider', 'T1']]);
    eq(new Set(ax.d.slice(1).map(x => x[0])).size, 1); eq(ax.d[1][0], r.id);
  });
  T('multi: líderes e turnos diferentes — líderes resumidos, turno exigido', () => {
    const r = A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza', 'Carla Dias'] } });
    eq(r.ok, false); eq(r.erros.turno, 'Os colaboradores são de turnos diferentes. Selecione o turno da auditoria.');
    const r2 = A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza', 'Carla Dias'], turno: 'T2' } });
    eq(r2.ok, true); const h = A.hist(), l = h.d[h.getLastRow() - 1]; eq([l[5], l[6]], ['Carlos Lider; Dora Lider', 'T2']);
    eq(A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza', 'Carla Dias'], turno: 'T9' } }).erros.turno, 'Os colaboradores são de turnos diferentes. Selecione o turno da auditoria.');
  });
  T('multi: repetido, inativo, inexistente, passou do máximo', () => {
    const f = (c) => A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaboradores: c } });
    eq(f(['Ana Souza', 'Ana Souza']).erros.colaborador, 'Colaborador repetido na lista.');
    ok(/inativo/.test(f(['Ana Souza', 'Fabio Saiu']).erros.colaborador));
    ok(/inativo/.test(f(['Ana Souza', 'Fulano']).erros.colaborador));
    const muitos = []; for (let i = 0; i < 11; i++) muitos.push('Ana Souza ' + i);
    eq(f(muitos).erros.colaborador, 'No máximo 10 colaboradores por auditoria.');
  });
  T('multi: expedição com 0 colaboradores continua válida (colaborador opcional)', () => {
    const r = A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '01', lider: 'Carlos Lider', turno: 'T1' } }); eq(r.ok, true);
    const h = A.hist(), l = h.d[h.getLastRow() - 1]; eq(l[4], ''); eq(A.sheets.Auditorias_Colaboradores.getLastRow(), 6, 'sem colaboradores = sem linhas auxiliares');
  });
  T('parâmetro por processo: outros processos aceitam só 1; ligar/desligar em Configurações', () => {
    const f = (p, extra) => A.audit('aud1@x.com', p, { conf: 10, f: Object.assign({ doca: '36', colaboradores: ['Ana Souza', 'Bruno Lima'] }, extra || {}) });
    eq(f('Recebimento').erros.colaborador, 'Este processo permite apenas um colaborador por auditoria.');
    eq(A.cfg({ dias: 7, corte: 70, media: 90, multi: { 'Recebimento': true, 'Expedição': false } }).ok, true);
    eq(f('Recebimento').ok, true);
    eq(f('Expedição').erros.colaborador, 'Este processo permite apenas um colaborador por auditoria.');
    eq(A.call('bootstrap').config.MULTI['Recebimento'], true);
    A.cfg({ dias: 7, corte: 70, media: 90, multi: { 'Recebimento': false, 'Expedição': true } });
  });
  T('compatibilidade: cliente antigo manda "colaborador" (string)', () => {
    const r = A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '36', colaborador: 'Eva Nunes' } }); eq(r.ok, true);
  });
  T('Matriz mostra todos os colaboradores da última auditoria da doca', () => {
    A.as('ana@x.com'); A.run('limparCache_()');
    const m = A.call('getMatriz', 'Expedição'); ok(m.find(x => x.id === '36').ultColab.length > 0);
    const r = A.audit('aud1@x.com', 'Expedição', { conf: 10, f: { doca: '07', colaboradores: ['Carla Dias', 'Davi Reis'] } });
    eq(A.call('getMatriz', 'Expedição').find(x => x.id === '07').ultColab, 'Carla Dias; Davi Reis');
  });
  T('rascunho com lista de colaboradores é guardado e devolvido', () => {
    A.as('aud1@x.com'); A.call('salvarRascunho', { processo: 'Expedição', chave: '01', estado: { colaboradores: ['Ana Souza', 'Bruno Lima'], resp: {} } });
    eq(A.call('getRascunho', 'Expedição', '01').colaboradores, ['Ana Souza', 'Bruno Lima']);
  });
}

fim('SERVIDOR parte 1 (regressão + multi-colaborador)');
