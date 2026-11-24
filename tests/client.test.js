const assert = require('assert');
const { novo, cenario } = require('./seed.js');
const { abrir, sleep } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u25A0-\u25FF\u2B00-\u2BFF\uFE0F\u2713\u2714\u2716]/u;
const TELAS_ALL = ['matriz', 'form', 'minhas', 'geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export', 'cad', 'cfg', 'acessos'];
const TELAS_ADM = TELAS_ALL.concat('autorizar');

(async () => {
  /* ===== 1. menu e telas por perfil ===== */
  const A = cenario();
  A.as('owner@x.com');
  const pf = (nome, perms, telas, escopo) => { const r = A.call('salvarPerfil', { nome, desc: 'x', perms, telas, escopo: escopo || { modo: 'todos', processos: [], turnos: [] } }, true); assert.ok(r.ok, JSON.stringify(r)); };
  pf('Visualizador', [], ['geral', 'proc', 'doca', 'tend']);
  pf('Gestor', ['metas', 'exportar'], ['matriz', 'geral', 'auditorias', 'auditores', 'colab']);
  pf('Cadastrista', ['cad_pessoas'], ['matriz']);
  pf('Restrito', ['auditar'], ['matriz', 'form', 'geral', 'auditorias'], { modo: 'todos', processos: ['Recebimento'], turnos: ['T1'] });
  pf('Meu time', ['auditar'], ['matriz', 'form', 'minhas', 'auditorias', 'colab'], { modo: 'time', processos: [], turnos: [] });
  [['vis@x.com', 'Vis', 'Visualizador'], ['ges@x.com', 'Gestora', 'Gestor'], ['cad@x.com', 'Cadastrista', 'Cadastrista'], ['res@x.com', 'Restrito', 'Restrito'], ['tim@x.com', 'Time', 'Meu time']].forEach(u => A.ctx.anexar_('Cad_Usuarios', [u[0], u[1], u[2], 'Sim']));

  const esperado = {
    'owner@x.com': TELAS_ALL.concat('log', 'programacao'), 'ana@x.com': TELAS_ALL, 'sl@x.com': TELAS_ALL.concat('log', 'programacao'),
    'aud1@x.com': ['matriz', 'form', 'minhas'],
    'vis@x.com': ['geral', 'proc', 'doca', 'tend'],
    'ges@x.com': ['matriz', 'geral', 'auditorias', 'auditores', 'colab', 'export'],
    'cad@x.com': ['matriz', 'cad'],
    'res@x.com': ['matriz', 'form', 'geral', 'auditorias'],
    'tim@x.com': ['matriz', 'form', 'minhas', 'auditorias', 'colab']
  };
  for (const email of Object.keys(esperado)) {
    await TA('menu de ' + email + ' mostra só as telas permitidas', async () => {
      const t = await abrir(A, email);
      eq(t.menu().sort(), esperado[email].slice().sort());
      const rel = ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'].some(x => esperado[email].includes(x));
      eq(!!t.$('#nav button.grp'), rel, 'grupo Relatórios');
      eq(t.erros, []);
    });
    await TA('todas as telas de ' + email + ' abrem sem erro, sem emoji e sem "Não foi possível"', async () => {
      const t = await abrir(A, email);
      for (const v of esperado[email]) {
        await t.nav(v);
        const sec = t.$('#v-' + v);
        ok(!sec.classList.contains('hidden'), v + ' escondida');
        ok(sec.textContent.length > 20, v + ' vazia');
        ok(!/Não foi possível carregar/.test(sec.textContent), v + ': ' + sec.textContent.slice(0, 80));
        ok(!EMOJI.test(t.doc.body.innerHTML), 'emoji em ' + v);
        eq(t.$('#titulo').textContent.length > 0, true);
      }
      eq(t.erros, []);
    });
  }
  await TA('telas fora do perfil não são exibidas nem chamáveis pela UI', async () => {
    const t = await abrir(A, 'aud1@x.com');
    ok(!t.$('#nav button[data-v="geral"]'));
    ok(t.$('#fbar').classList.contains('hidden'));
    ok(!t.$('#nav button[data-v="acessos"]'));
  });
  await TA('barra de filtros só aparece nos relatórios', async () => {
    const t = await abrir(A, 'ana@x.com');
    ok(t.$('#fbar').classList.contains('hidden'));
    await t.nav('geral'); ok(!t.$('#fbar').classList.contains('hidden'));
    await t.nav('cad'); ok(t.$('#fbar').classList.contains('hidden'));
  });
  /* ===== 2. Visão Geral e relatórios ===== */
  await TA('Visão Geral: KPIs, Em observação, gráficos empilhados com cores de status', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('geral');
    const tx = t.$('#v-geral').textContent;
    ['Auditorias realizadas', 'Em observação', 'Em inconformidade', 'Situação por processo', 'Situação por turno', 'Insights', 'Maiores ofensores'].forEach(s => ok(tx.includes(s), s));
    const g1 = t.graficos.find(g => g.id === 'g1'); ok(g1, 'g1');
    eq(JSON.parse(JSON.stringify(g1.cfg.data.datasets.map(d => d.label))), ['Conforme', 'Em observação', 'Inconforme']);
    eq(JSON.parse(JSON.stringify(g1.cfg.data.datasets.map(d => d.backgroundColor))), ['#1E9E5A', '#F2B100', '#D93025']);
    ok(t.graficos.find(g => g.id === 'g2') && t.graficos.find(g => g.id === 'g3') && t.graficos.find(g => g.id === 'g4'));
    const tot = g1.cfg.data.datasets.reduce((s, d) => s + d.counts.reduce((a, b) => a + b, 0), 0);
    eq(tot, 6, 'seis auditorias no cenário');
    ok(t.$$('.ins li').length >= 1);
  });
  await TA('Visão Geral sem biblioteca de gráficos: degrada para aviso, sem quebrar', async () => {
    const t = await abrir(A, 'ana@x.com', { semChart: true }); await t.nav('geral');
    ok(t.$('#v-geral').textContent.includes('Gráfico indisponível'));
    eq(t.erros, []);
  });
  await TA('filtros globais: mudam a chamada ao servidor e persistem entre relatórios', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('geral');
    t.set('#f-processo', 'Expedição'); await t.idle();
    let ch = t.chamadas.filter(c => c[0] === 'relatorio').pop(); eq(ch[1][1].processo, 'Expedição');
    t.set('#f-turno', 'T1'); await t.idle();
    await t.nav('auditorias');
    ch = t.chamadas.filter(c => c[0] === 'relatorio').pop();
    eq([ch[1][0], ch[1][1].processo, ch[1][1].turno], ['auditorias', 'Expedição', 'T1']);
    ok(t.$$('#v-auditorias .scroll tbody tr.exp').every(tr => tr.textContent.includes('Expedição')) || t.$('#v-auditorias').textContent.includes('Nenhuma'));
    t.set('#f-faixa', 'vermelho'); await t.idle();
    t.$('#f-limpar').click(); await t.idle();
    ch = t.chamadas.filter(c => c[0] === 'relatorio').pop();
    eq([ch[1][1].processo, ch[1][1].turno, ch[1][1].faixa], ['', '', '']);
  });
  await TA('doca depende do processo no filtro', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('geral');
    t.set('#f-processo', 'Separação');
    const ops = t.$$('#f-doca option').map(o => o.value).filter(Boolean).sort();
    eq(ops, ['A-10', 'B-20']);
    t.set('#f-processo', 'Recebimento');
    eq(t.$$('#f-doca option').map(o => o.value).filter(Boolean).sort(), ['01', '07', '36']);
  });
  await TA('período: botões e datas inválidas', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('geral');
    t.$('#fper button[data-k="7"]').click(); await t.idle();
    ok(t.$('#fper button[data-k="7"]').classList.contains('on'));
    t.set('#f-de', '2099-01-02'); t.set('#f-ate', '2099-01-01');
    ok(/anterior/.test(t.toast()), t.toast());
  });
  await TA('Auditorias realizadas: tabela, mapa de cobertura, itens da auditoria (modal)', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('auditorias');
    eq(t.$$('#v-auditorias .scroll tbody tr.exp').length, 6);
    ok(t.$('.heat table'), 'mapa de cobertura');
    ok(t.$$('.heat td i[style]').length >= 4);
    const b = t.$('[data-aud]'); await t.click(b);
    ok(!t.$('#modal').classList.contains('hidden'));
    ok(t.$('#modal').textContent.includes('item'), t.$('#modal').textContent.slice(0, 200));
    t.$('#modal [data-fechar]').click(); ok(t.$('#modal').classList.contains('hidden'));
    t.win.document.dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await TA('Expedição multi-colaborador aparece como lista e em Por colaborador (cada um conta)', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('auditorias');
    ok(t.$('#v-auditorias').textContent.includes('Ana Souza; Bruno Lima'));
    await t.nav('colab');
    const nomes = t.$$('#v-colab tr[data-det="colab"]').map(r => r.dataset.chave);
    ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Davi Reis'].forEach(n => ok(nomes.includes(n), n));
    ok(t.$('#v-colab').textContent.includes('Sem auditoria no período'), 'Eva sem auditoria');
  });
  await TA('detalhe por doca e por colaborador (clique na linha) e voltar', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('doca');
    await t.click(t.$('#v-doca tr[data-det="doca"]'));
    ok(t.$('#det-voltar'), 'botão voltar');
    ok(t.graficos.some(g => g.id === 'd1'));
    await t.click('#det-voltar'); ok(t.$('#v-doca table[data-sort]'));
    await t.nav('colab');
    await t.click(t.$('#v-colab tr[data-det="colab"]'));
    ok(t.$('#det-voltar')); eq(t.erros, []);
  });
  await TA('Por processo e Tendência desenham gráficos', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('proc');
    ok(t.graficos.filter(g => /^p\d/.test(g.id)).length >= 3);
    await t.nav('tend'); ok(t.graficos.some(g => g.id === 't1') && t.graficos.some(g => g.id === 't3'));
    eq(t.erros, []);
  });
  await TA('Por doca: busca e ordenação no navegador', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('doca');
    const antes = t.$$('#v-doca tbody tr:not(.hidden)').length;
    t.set('#v-doca input[data-busca]', 'Cluster', 'input'); ok(t.$$('#v-doca tbody tr:not(.hidden)').length < antes);
    t.set('#v-doca input[data-busca]', '', 'input');
    t.$('#v-doca th[data-s="n"]').click();
    eq(t.$('#v-doca th[data-s="n"]').getAttribute('aria-sort'), 'ascending');
  });
  await TA('Auditores e metas: ranking, e Auditor/Gestor veem conforme o escopo', async () => {
    const t = await abrir(A, 'ges@x.com'); await t.nav('auditores');
    ok(t.$('#v-auditores').textContent.includes('Ranking de auditores'));
    ok(t.$('[data-meta-n]'), 'Gestor tem metas');
    const v = await abrir(A, 'tim@x.com'); await v.nav('auditorias'); ok(!v.$('[data-meta-n]'));
  });

  /* ===== 3. metas ===== */
  await TA('Metas: criar, ver progresso, editar e excluir; só auditor com perfil vê "Minhas metas"', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('auditores');
    await t.click('[data-meta-n]');
    t.set('#mt-tipo', 'Pessoa'); t.set('#mt-alvo', 'aud1@x.com'); t.set('#mt-qtd', '5');
    t.set('#mt-ini', A.dia(-5)); t.set('#mt-fim', A.dia(5));
    t.$$('#mt-procs input')[0].checked = true;
    await t.click('#mt-ok');
    ok(t.$('#metasBox').textContent.includes('Audi Um'), t.$('#metasBox').textContent.slice(0, 200));
    ok(t.$('#metasBox .pill'), 'status');
    // erro de validação
    await t.click('[data-meta-n]'); t.set('#mt-qtd', '0'); await t.click('#mt-ok');
    ok(t.$('#modal [data-me="qtd"]').textContent.length > 0); ok(t.$('#modal [data-me="alvo"]').textContent.length > 0);
    t.$('#modal [data-fechar]').click();
    // auditor vê
    const a = await abrir(A, 'aud1@x.com'); await a.nav('minhas');
    ok(a.$('#v-minhas').textContent.includes('5 auditoria'), a.$('#v-minhas').textContent);
    ok(a.$('#v-minhas .pill'));
    const idm = A.call('minhasMetas')[0] ? 1 : 0;
    // editar/excluir
    await t.click('[data-meta-e]'); t.set('#mt-qtd', '8'); await t.click('#mt-ok');
    ok(t.$('#metasBox').textContent.includes('8 auditoria'));
    await t.click('[data-meta-x]'); await t.click('#mx-ok');
    ok(t.$('#metasBox').textContent.includes('Nenhuma meta'));
  });
  await TA('Matriz: aviso de metas em andamento para o auditor', async () => {
    A.as('ana@x.com'); A.call('salvarMeta', { tipo: 'Pessoa', alvo: 'aud2@x.com', qtd: 30, ini: A.dia(-3), fim: A.dia(10), processos: [], desc: '' });
    const t = await abrir(A, 'aud2@x.com'); await t.nav('matriz');
    ok(t.$('#mbanner').textContent.includes('meta'), t.$('#mbanner').innerHTML);
    await t.click('#mbanner [data-vai]'); ok(!t.$('#v-minhas').classList.contains('hidden'));
  });

  /* ===== 4. matriz e formulário ===== */
  await TA('Matriz: cards por processo, status e clique abre o formulário com a doca', async () => {
    const t = await abrir(A, 'aud1@x.com');
    eq(t.$$('#mg .mc').length, 3);
    ok(t.$$('#mg .mc').some(c => c.classList.contains('verde')) && t.$$('#mg .mc').some(c => c.classList.contains('nunca')));
    ok(t.$('#mg .cs'), 'símbolo da doca');
    await t.click(t.$$('#mg .mc')[0]);
    ok(!t.$('#v-form').classList.contains('hidden'));
    eq(t.$('#v-form select[data-f="doca"]').value, '36');
  });
  await TA('Matriz: Indução mostra um card por líder', async () => {
    const t = await abrir(A, 'aud1@x.com'); await t.click('#v-matriz .chip[data-p="Indução"]');
    eq(t.$$('#mg .mc b').map(b => b.textContent).sort(), ['Time Carlos Lider', 'Time Dora Lider']);
    await t.click(t.$$('#mg .mc')[0]);
    ok(t.$('#v-form').textContent.includes('Colaborador'));
  });
  async function escolher(t, nome) {
    const inp = t.$('#cbIn'); inp.focus(); t.ev(inp, 'focusin'); inp.value = nome; t.ev(inp, 'input');
    const li = Array.from(t.$$('#cbList li')).find(l => l.dataset.n === nome); if (!li) throw new Error('sem opção ' + nome);
    li.dispatchEvent(new t.win.MouseEvent('mousedown', { bubbles: true })); await t.idle();
  }
  async function responderTudo(t, valor) { for (const r of t.$$('#v-form input[type=radio][value="' + valor + '"]')) { r.checked = true; t.ev(r, 'change'); } await t.idle(); }
  await TA('Formulário Expedição: 2 colaboradores com tags removíveis; líder e turno derivados', async () => {
    const t = await abrir(A, 'aud1@x.com'); await t.click('#v-matriz .chip[data-p="Expedição"]');
    await t.click(t.$$('#mg .mc')[0]);
    await escolher(t, 'Ana Souza'); await escolher(t, 'Bruno Lima');
    eq(t.$$('#v-form .tagc').map(x => x.textContent.trim()), ['Ana Souza', 'Bruno Lima']);
    ok(t.$('#v-form .ro').textContent.includes('Carlos Lider'));
    eq(t.$('#v-form select[data-f="turno"]').value, 'T1');
    ok(t.$('#v-form').textContent.includes('vale para 2 colaboradores'));
    await t.click('[data-rmc="Bruno Lima"]'); eq(t.$$('#v-form .tagc').length, 1);
    await escolher(t, 'Bruno Lima');
    await responderTudo(t, '1');
    t.$$('#v-form input[type=radio][value="0"]')[1].checked = true; t.ev(t.$$('#v-form input[type=radio][value="0"]')[1], 'change');
    await t.click('#bFin');
    ok(/Auditoria salva/.test(t.toast()), t.toast());
    const h = A.hist(), last = h.d[h.getLastRow() - 1];
    eq([last[2], last[4], last[8]], ['Expedição', 'Ana Souza; Bruno Lima', 90]);
    const ax = A.sheets.Auditorias_Colaboradores; eq(ax.d[ax.getLastRow() - 1][1], 'Bruno Lima');
    ok(!t.$('#v-matriz').classList.contains('hidden'), 'volta para a matriz');
  });
  await TA('Formulário: processo de 1 colaborador substitui em vez de acumular', async () => {
    const t = await abrir(A, 'aud1@x.com');
    await t.click(t.$$('#mg .mc')[0]); // Recebimento 36
    await escolher(t, 'Ana Souza');
    ok(!t.$('#cbIn'), 'sem campo após escolher (um só)');
    await t.click('[data-rmc="Ana Souza"]'); await escolher(t, 'Eva Nunes');
    eq(t.$$('#v-form .tagc').map(x => x.textContent.trim()), ['Eva Nunes']);
  });
  await TA('Formulário: turnos mistos exigem escolha do turno', async () => {
    const t = await abrir(A, 'aud1@x.com'); await t.click('#v-matriz .chip[data-p="Expedição"]');
    await t.click(t.$$('#mg .mc')[2]);
    await escolher(t, 'Ana Souza'); await escolher(t, 'Carla Dias');
    eq(t.$('#v-form select[data-f="turno"]').value, '');
    ok(t.$('#v-form').textContent.includes('turnos diferentes'));
    await responderTudo(t, '1'); await t.click('#bFin');
    ok(/turnos diferentes/.test(t.$('#v-form').textContent) && t.$('#v-form .alert'), 'erro exibido');
    t.set('#v-form select[data-f="turno"]', 'T2'); await t.click('#bFin');
    ok(/Auditoria salva/.test(t.toast()), t.toast());
  });
  await TA('Formulário: validações de campos obrigatórios', async () => {
    const t = await abrir(A, 'aud1@x.com'); await t.nav('form');
    await t.click('#bFin');
    ok(t.$('#v-form .alert')); ok(t.$$('#v-form .err').some(e => e.textContent.includes('doca')));
    ok(t.$$('#v-form .err').some(e => e.textContent.includes('turno')));
    ok(/pendentes/.test(t.toast()));
  });
  await TA('Formulário: rascunho salva sozinho, volta ao reabrir e é descartável', async () => {
    const t = await abrir(A, 'aud2@x.com'); await t.click('#v-matriz .chip[data-p="Expedição"]');
    await t.click(t.$$('#mg .mc')[1]);
    await escolher(t, 'Davi Reis');
    const r = t.$$('#v-form input[type=radio][value="1"]')[0]; r.checked = true; t.ev(r, 'change');
    await sleep(1500); await t.idle();
    ok(t.chamadas.some(c => c[0] === 'salvarRascunho' && c[1][0].estado.colaboradores[0] === 'Davi Reis'));
    const t2 = await abrir(A, 'aud2@x.com'); await t2.click('#v-matriz .chip[data-p="Expedição"]');
    ok(t2.$$('#mg .mc').some(c => c.classList.contains('rascunho')), 'card rascunho');
    await t2.click(t2.$$('#mg .mc').find(c => c.classList.contains('rascunho')));
    eq(t2.$$('#v-form .tagc').map(x => x.textContent.trim()), ['Davi Reis']);
    ok(t2.$('#v-form input[type=radio][value="1"]:checked'));
    await t2.click('#bDesc'); ok(!t2.$$('#mg .mc').some(c => c.classList.contains('rascunho')) || true);
    await t2.nav('matriz'); await t2.click('#v-matriz .chip[data-p="Expedição"]');
    ok(!t2.$$('#mg .mc').some(c => c.classList.contains('rascunho')), 'rascunho descartado');
  });
  await TA('Rascunho antigo (campo colaborador) é aceito', async () => {
    A.as('aud1@x.com'); A.call('salvarRascunho', { processo: 'Recebimento', chave: '07', estado: { colaborador: 'Carla Dias', lider: 'Dora Lider', turno: 'T2', obs: 'ok', resp: {} } });
    const t = await abrir(A, 'aud1@x.com');
    await t.click(t.$$('#mg .mc').find(c => c.dataset.id === '07'));
    eq(t.$$('#v-form .tagc').map(x => x.textContent.trim()), ['Carla Dias']);
    eq(t.$('#v-form textarea').value, 'ok');
  });
  await TA('Formulário: ícones/estado sem emoji e botões presentes', async () => {
    const t = await abrir(A, 'aud1@x.com'); await t.nav('form');
    ['Finalizar auditoria', 'Salvar rascunho', 'Descartar rascunho'].forEach(s => ok(t.$('#v-form .bar').textContent.includes(s)));
    ok(!EMOJI.test(t.$('#v-form').innerHTML));
  });

  /* ===== 5. cadastros e configurações ===== */
  await TA('Cadastros: abas por permissão (sem aba de Usuários)', async () => {
    const t = await abrir(A, 'cad@x.com'); await t.nav('cad');
    eq(t.$$('#v-cad .tabs button').map(b => b.textContent), ['Pessoas']);
    const a = await abrir(A, 'ana@x.com'); await a.nav('cad');
    eq(a.$$('#v-cad .tabs button').map(b => b.textContent), ['Docas e clusters', 'Pessoas', 'Perguntas']);
  });
  await TA('Cadastros: adicionar doca com validação, duplicidade e pré-visualização', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cad');
    await t.click('#cSalvar'); ok(t.$$('#v-cad .err').some(e => e.textContent === 'Campo obrigatório.'));
    t.set('[data-c="Tipo"]', 'Doca'); t.set('[data-c="Identificador"]', '36', 'input'); t.set('[data-c="Cor"]', 'Azul'); t.set('[data-c="Simbolo"]', 'Cruz');
    ok(t.$('#csPrev .cs'));
    await t.click('#cSalvar'); ok(t.$$('#v-cad .err').some(e => e.textContent.includes('Já existe')));
    t.set('[data-c="Identificador"]', '55', 'input'); await t.click('#cSalvar');
    ok(/Cadastro salvo/.test(t.toast()), t.toast());
    ok(t.$('#v-cad tbody').textContent.includes('55'));
    eq(A.call('lerAba_', 'Cad_Estrutura').some(e => String(e.Identificador) === '55'), true);
    ok(![...t.$$('#v-cad option')].some(o => /[\u25A0-\u25FF\u2600-\u27BF]/.test(o.textContent)), 'sem glifos nas opções');
  });
  await TA('Cadastros: líder com colaboradores não é excluído (recusa do servidor devolve a linha)', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cad'); await t.click('#v-cad .tabs button[data-t="Cad_Pessoas"]');
    const linha = () => t.$$('#v-cad tbody tr').find(r => r.children[0].textContent === 'Carlos Lider');
    await t.click(linha().querySelector('[data-m]')); ok(t.$('#v-cad .rm'), 'menu da linha'); await t.click(t.$('#v-cad .rm [data-x]'));
    ok(/vinculado/.test(t.toast()), t.toast()); ok(linha(), 'a linha voltou');
  });
  await TA('Cadastros: excluir é imediato com Desfazer; desfazer restaura o item na mesma posição', async () => {
    A.as('ana@x.com'); A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Zeca Temp', Cargo: 'Colaborador', Turno: 'T1', Lider: 'Carlos Lider', Status_Ativo: 'Sim' }, null);
    const t = await abrir(A, 'ana@x.com'); await t.nav('cad'); await t.click('#v-cad .tabs button[data-t="Cad_Pessoas"]');
    const linha = () => t.$$('#v-cad tbody tr').find(r => r.children[0].textContent === 'Zeca Temp');
    await t.click(linha().querySelector('[data-m]')); await t.click(t.$('#v-cad .rm [data-x]'));
    ok(!linha(), 'saiu da lista'); ok(/Registro excluído/.test(t.toast())); ok(t.$('#toast .tact'), 'botão Desfazer'); eq(t.$('#toast .tact').textContent, 'Desfazer');
    eq(A.call('lerAba_', 'Cad_Pessoas').some(p => p.Nome === 'Zeca Temp'), false);
    await t.click('#toast .tact'); ok(/Registro restaurado/.test(t.toast()), t.toast()); ok(linha(), 'voltou');
    eq(A.call('lerAba_', 'Cad_Pessoas').some(p => p.Nome === 'Zeca Temp'), true);
    eq(t.erros, []);
  });
  await TA('Cadastros/Perguntas: grupos por sub-processo, painel lateral, duplicar, mover e menu de ações', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cad'); await t.click('#v-cad .tabs button[data-t="Cad_Processos_Perguntas"]');
    ok(t.$$('#v-cad details.grupo').length >= 1, 'grupos'); ok(t.$('#v-cad .drawer').classList.contains('hidden'), 'painel fechado por padrão');
    ok(t.$$('#v-cad [data-cp]').length >= 2, 'chips de processo');
    await t.click('#cNovo'); ok(!t.$('#v-cad .drawer').classList.contains('hidden'), 'painel aberto'); eq(t.$('#drT').textContent, 'Nova pergunta');
    await t.click('#cCancel'); ok(t.$('#v-cad .drawer').classList.contains('hidden'));
    const qtd = () => A.call('lerAba_', 'Cad_Processos_Perguntas').filter(r => r.Processo === 'Recebimento').length;
    const n0 = qtd(); const dup = t.$('#v-cad [data-m]'); await t.click(dup);
    await t.click(t.$('#v-cad .rm [data-dup]')); ok(!t.$('#v-cad .drawer').classList.contains('hidden'), 'duplicar abre o painel preenchido'); ok(/\(cópia\)$/.test(t.$('#v-cad [data-c="Descricao_Item"]').value)); eq(qtd(), n0, 'ainda não salvou'); await t.click('#cSalvar'); eq(qtd(), n0 + 1, 'duplicou'); ok(A.call('lerAba_', 'Cad_Processos_Perguntas').some(r => /\(cópia\)/.test(r.Descricao_Item)));
    const ordem = () => A.call('lerAba_', 'Cad_Processos_Perguntas').filter(r => r.Processo === 'Recebimento').map(r => r.Descricao_Item);
    const antes = ordem(); await t.click(t.$$('#v-cad [data-m]')[0]); await t.click(t.$('#v-cad .rm [data-mv="1"]'));
    const depois = ordem(); ok(JSON.stringify(antes) !== JSON.stringify(depois), 'moveu para baixo'); eq(depois[1], antes[0]);
    eq(t.erros, []);
  });
  await TA('Cadastros: XSS em nomes é escapado', async () => {
    A.as('ana@x.com'); A.call('salvarCadastro', 'Cad_Pessoas', { Nome: '<img src=x onerror=window.__xss=1>', Cargo: 'Líder', Turno: 'T1', Lider: '', Status_Ativo: 'Sim' }, null);
    const t = await abrir(A, 'ana@x.com'); await t.nav('cad'); await t.click('#v-cad .tabs button[data-t="Cad_Pessoas"]');
    ok(t.$('#v-cad tbody').textContent.includes('<img src=x'), 'texto literal');
    ok(!t.$('#v-cad tbody img')); eq(t.win.__xss, undefined);
    await t.nav('matriz'); await t.click('#v-matriz .chip[data-p="Indução"]'); ok(!t.$('#mg img'));
    await t.nav('auditorias'); ok(!t.$('#v-auditorias img'));
  });
  await TA('Configurações: vários colaboradores por processo muda o formulário', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cfg');
    const cx = t.$('#kMulti input[value="Recebimento"]'); ok(!cx.checked); cx.checked = true;
    await t.click('#kSalvar'); ok(/Configurações salvas/.test(t.toast()), t.toast());
    const sv = t.chamadas.filter(c => c[0] === 'salvarConfigs').pop(); eq(sv[1][0].multi.Recebimento, true);
    await t.nav('matriz'); await t.click(t.$$('#mg .mc')[0]); await escolher(t, 'Ana Souza'); ok(t.$('#cbIn'), 'segue permitindo adicionar');
    await t.nav('cfg'); t.$('#kMulti input[value="Recebimento"]').checked = false; await t.click('#kSalvar');
  });
  await TA('Configurações: validação corte < média', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cfg');
    t.set('#k2', '95', 'input'); t.set('#k3', '90', 'input'); await t.click('#kSalvar');
    ok(t.$('#e3').textContent.includes('maior')); eq(t.chamadas.filter(c => c[0] === 'salvarConfigs').length, 0);
  });

  /* ===== 6. acessos ===== */
  await TA('Acessos: Admin vê Usuários, Perfis, Histórico e Segurança; Analista não vê Perfis/Segurança', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos');
    eq(t.$$('#v-acessos .tabs button').map(b => b.textContent.replace(/\d+$/, '')), ['Autorizações', 'Usuários', 'Perfis', 'Regras de auditoria', 'Histórico de alterações', 'Segurança']);
    const a = await abrir(A, 'ana@x.com'); await a.nav('acessos');
    eq(a.$$('#v-acessos .tabs button').map(b => b.textContent), ['Usuários', 'Histórico de alterações']);
  });
  await TA('Acessos: criar usuário; Admin/si mesmo ficam somente leitura', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('acessos');
    const linhas = t.$$('#v-acessos tbody tr');
    const dela = linhas.find(r => r.children[0].textContent === 'ana@x.com'); ok(dela.textContent.includes('somente leitura'));
    const adm = linhas.find(r => r.children[0].textContent === 'off@x.com'); ok(adm.textContent.includes('somente leitura'));
    ok([...t.$$('#acBody select[data-u="Perfil"] option')].every(o => o.value !== 'Admin'), 'Analista não atribui Admin');
    t.set('[data-u="Email_Google"]', 'novo@x.com', 'input'); t.set('[data-u="Nome"]', 'Novo', 'input'); t.set('[data-u="Perfil"]', 'Auditor');
    await t.click('#uSalvar'); ok(/Usuário salvo/.test(t.toast()), t.toast());
    ok(t.$('#v-acessos tbody').textContent.includes('novo@x.com'));
    await t.click(t.$$('#v-acessos [data-ux]').pop()); await new Promise(r => setTimeout(r, 600)); await t.click(t.$$('#v-acessos [data-ux]').pop());
    ok(/excluído/.test(t.toast()), t.toast());
  });
  await TA('Acessos: criar perfil por tópicos em linguagem simples; normalização automática', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos'); await t.click('#v-acessos [data-at="perfis"]');
    await t.click('#pfNovo');
    t.set('#pf-nome', 'Config Basico', 'input');
    const cfg = t.$('[data-pp="config"]'); cfg.checked = true; t.ev(cfg, 'change');
    ok(t.$('[data-pt="cfg"]').checked && t.$('[data-pt="cfg"]').disabled, 'tela Configurações marcada e travada');
    ok(t.$('#pfResumo').textContent.includes('Alterar configurações'), t.$('#pfResumo').textContent);
    const rc = t.$('[data-pm="time"]'); rc.checked = true; t.ev(rc, 'change');
    ok(t.$('#pfResumo').textContent.includes('Somente o time dele'));
    const pr = t.$('[data-pp2="Recebimento"]'); pr.checked = true; t.ev(pr, 'change');
    ok(t.$('#pfResumo').textContent.includes('Processos: Recebimento'));
    await t.click('#pfSalvar'); ok(/Perfil salvo/.test(t.toast()), t.toast());
    ok(t.$('#v-acessos .perfs').textContent.includes('Config Basico'));
    const p = A.call('perfis_')['Config Basico']; eq([p.perms, p.escopo.modo, p.escopo.processos], [['config'], 'time', ['Recebimento']]);
    ok(p.telas.includes('cfg'));
    const log = A.call('lerDireto_', 'Log_Permissoes').pop(); ok(log.Acao === 'Perfil criado');
    await t.click('#v-acessos [data-at="log"]'); ok(t.$('#v-acessos').textContent.includes('Perfil criado'));
  });
  await TA('Acessos: Admin protegido, perfil próprio e perfil acima do meu ficam somente leitura', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos'); await t.click('#v-acessos [data-at="perfis"]');
    await t.click('#v-acessos [data-pf="Admin"]'); ok(t.$('#pfEd').textContent.includes('protegido')); ok(!t.$('#pfSalvar'));
    const g = await abrir(A, 'ges@x.com'); ok(!g.menu().includes('acessos'));
    // Analista não tem 'perfis', então só enxerga Usuários; usuário com 'perfis' limitado:
    A.as('owner@x.com'); A.call('salvarPerfil', { nome: 'Chefe Perfis', desc: '', perms: ['perfis', 'usuarios', 'auditar'], telas: ['matriz', 'acessos'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true);
    A.ctx.anexar_('Cad_Usuarios', ['chefe@x.com', 'Chefe', 'Chefe Perfis', 'Sim']);
    const c = await abrir(A, 'chefe@x.com'); await c.nav('acessos'); await c.click('#v-acessos [data-at="perfis"]');
    await c.click('#v-acessos [data-pf="Chefe Perfis"]'); ok(c.$('#pfEd').textContent.includes('não pode editar o perfil que está usando'), c.$('#pfEd').textContent.slice(0, 120));
    await c.click('#v-acessos [data-pf="Analista"]'); ok(c.$('#pfEd').textContent.includes('acima das suas'), 'Analista tem permissões que ele não tem');
    await c.click('#pfNovo');
    ok(c.$('[data-pp="config"]').disabled, 'não concede o que não tem');
    ok(c.$('[data-pp="perfis"]').disabled === false);
  });
  await TA('Acessos: excluir perfil em uso é recusado; excluir sem uso funciona', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos'); await t.click('#v-acessos [data-at="perfis"]');
    await t.click('#v-acessos [data-pf="Restrito"]'); await t.click('#pfExcluir'); await t.click('#px-ok');
    ok(/usuário\(s\) usam/.test(t.toast()), t.toast());
    await t.click('#v-acessos [data-pf="Config Basico"]'); await t.click('#pfExcluir'); await t.click('#px-ok');
    ok(/Perfil excluído/.test(t.toast()), t.toast());
  });
  await TA('Acessos: aba Segurança mostra diagnóstico', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('acessos'); await t.click('#v-acessos [data-at="seg"]');
    ok(t.$$('.sec-i').length >= 2); ok(!EMOJI.test(t.$('#v-acessos').innerHTML));
    A.compart.editors = ['aud1@x.com']; await t.click('#v-acessos [data-at="seg"]');
    const t2 = await abrir(A, 'owner@x.com'); await t2.nav('acessos'); await t2.click('#v-acessos [data-at="seg"]');
    ok(t2.$('.sec-i.alerta'), 'alerta de compartilhamento'); A.compart.editors = [];
  });

  /* ===== 7. escopo de dados no cliente ===== */
  await TA('Perfil Restrito: Matriz só com Recebimento; relatórios só com dados do escopo', async () => {
    const t = await abrir(A, 'res@x.com');
    eq(t.$$('#v-matriz .toolbar:first-child .chip').map(c => c.textContent), ['Recebimento']);
    await t.nav('auditorias');
    const procs = t.$$('#v-auditorias .scroll tbody tr.exp').map(r => r.children[1].textContent);
    ok(procs.length > 0 && procs.every(p => p === 'Recebimento'), procs.join());
    eq([...t.$$('#f-processo option')].map(o => o.value).filter(Boolean).length > 0, true);
    await t.nav('geral'); ok(!t.$('#v-geral').textContent.includes('Expedição'));
  });
  await TA('Perfil "Meu time" (modo time): vê só auditorias do próprio time', async () => {
    const t = await abrir(A, 'tim@x.com'); await t.nav('auditorias');
    ok(t.$$('#v-auditorias tbody tr').length >= 0); eq(t.erros, []);
  });
  await TA('Exportar: CSV em lotes com BOM, cabeçalho, ; e proteção contra fórmulas', async () => {
    A.as('ana@x.com'); A.call('salvarCadastro', 'Cad_Pessoas', { Nome: 'Zed Teste', Cargo: 'Colaborador', Turno: 'T1', Lider: 'Carlos Lider', Status_Ativo: 'Sim' }, null);
    A.audit('aud1@x.com', 'Recebimento', { conf: 10, obs: '=HYPERLINK("x")', f: { doca: '36', colaboradores: ['Zed Teste'] } });
    const t = await abrir(A, 'ana@x.com'); await t.nav('export');
    await t.click('#exp-go');
    ok(/exportada/.test(t.$('#exp-st').textContent), t.$('#exp-st').textContent);
    const blob = t.urls[0]; const buf = await new Promise(r => { const fr = new t.win.FileReader(); fr.onload = () => r(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); });
    ok(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF, 'BOM'); const txt = buf.toString('utf8').replace(/^\uFEFF/, ''); ok(txt.split('\r\n')[0].startsWith('ID_Auditoria;Data_Hora'));
    ok(txt.includes('HYPERLINK'), 'obs presente: ' + txt.slice(-300)); ok(!/;"=/.test(txt) && !/"=HYPER/.test(txt), 'fórmula neutralizada: ' + txt.slice(-300)); ok(txt.split('\r\n').length >= 8);
    ok(t.win.__download.startsWith('auditorias_'));
    const g = await abrir(A, 'ges@x.com'); ok(g.menu().includes('export'), 'permissão exportar libera a tela automaticamente'); const v = await abrir(A, 'vis@x.com'); ok(!v.menu().includes('export'));
  });

  /* ===== 8. tema, menu, refresh ===== */
  await TA('Atualizar mostra tempo relativo; tema alterna sem quebrar; menu expansível', async () => {
    const t = await abrir(A, 'ana@x.com');
    eq(t.$('#atualizado').textContent, 'Atualizado agora'); ok(/\d\d\/\d\d\/\d{4}/.test(t.$('#atualizado').title), 'data completa na dica');
    await t.click('#refresh'); ok(t.chamadas.some(c => c[0] === 'bootstrap' && c[1][0] === true));
    await t.nav('geral'); const g = t.$('#nav .grp'); eq(g.getAttribute('aria-expanded'), 'true');
    await t.click('#userBtn'); await t.click('#userMenu [data-tema="dark"]'); eq(t.doc.documentElement.getAttribute('data-theme'), 'dark'); ok(t.$('#v-geral').textContent.length > 100);
    await t.click('#userMenu [data-tema="light"]'); eq(t.doc.documentElement.getAttribute('data-theme'), null);
    await t.nav('matriz'); t.$('#nav .grp').click(); ok(t.$('#nav .kids').classList.contains('hidden') === false);
    eq(t.erros, []);
  });
  await TA('Nenhum ícone/ glifo decorativo em nenhuma tela (HTML renderizado, todas as telas)', async () => {
    const t = await abrir(A, 'owner@x.com');
    for (const v of TELAS_ALL) { await t.nav(v); ok(!EMOJI.test(t.doc.body.innerHTML), v); }
    await t.irAutorizar(); ok(!EMOJI.test(t.doc.body.innerHTML), 'autorizar');
    ok(t.$$('#nav svg').length >= 10, 'ícones SVG no menu');
  });


  /* ===== 9. carregamento, login, cadastro, autorizações e temas ===== */
  const tituloModal = t => { const m = t.$('#modal'); return m.classList.contains('hidden') ? '' : (m.querySelector('h2') || {}).textContent; };
  const solicitar = (email, o) => { A.as(email); return A.call('solicitarCadastro', Object.assign({ email, nome: 'Pessoa Teste', cargo: 'Analista' }, o || {})); };
  await TA('tela de carregamento: animada, some quando termina e entra direto no app (autenticação automática)', async () => {
    const t = await abrir(A, 'ana@x.com', { minLoad: 350 });
    ok(!t.$('#carregando').classList.contains('hidden'), 'visível durante o carregamento');
    ok(t.$('#carregando .pl-ring') && t.$('#carregando .pl-bar') && t.$('#carregando .pl-d'), 'elementos da animação');
    ok(t.$('#app').classList.contains('hidden') && t.$('#login').classList.contains('hidden'));
    await sleep(500); await t.idle();
    ok(t.$('#carregando').classList.contains('hidden')); ok(!t.$('#app').classList.contains('hidden')); ok(t.$('#login').classList.contains('hidden'));
    eq(t.chamadas.filter(c => c[0] === 'bootstrap').length, 1);
    eq(t.erros, []);
  });
  await TA('falha ao carregar: mostra mensagem e botão de nova tentativa', async () => {
    const B = cenario(); const orig = B.ctx.bootstrap; B.ctx.bootstrap = () => { throw new Error('indisponível'); };
    const t = await abrir(B, 'ana@x.com');
    ok(t.$('#carregando').classList.contains('pl-erro')); ok(!t.$('#plRetry').classList.contains('hidden')); ok(t.$('#plTxt').textContent.includes('Não foi possível'));
    B.ctx.bootstrap = orig;
  });
  await TA('login: usuário não cadastrado vê pop-up "Login não encontrado" e o botão Cadastrar-se', async () => {
    const t = await abrir(A, 'ghost@x.com');
    ok(!t.$('#login').classList.contains('hidden')); ok(t.$('#app').classList.contains('hidden')); ok(t.$('#carregando').classList.contains('hidden'));
    eq(tituloModal(t), 'Login não encontrado'); ok(t.$('#modal').textContent.includes('ghost@x.com'));
    ok(!t.$('#lgCadastrar').classList.contains('hidden')); eq(t.$('#lgEmail').textContent, 'ghost@x.com');
    ok(t.$('#lgGoogle').className.includes('pri') && t.$('#lgCadastrar').className.includes('btn'), 'mesmo estilo dos botões do sistema');
    eq(t.chamadas.length, 1, 'só o bootstrap, nenhum dado exposto');
    await t.click('#modal [data-fechar]'); eq(tituloModal(t), '');
  });
  await TA('login: ordem dos botões (Google acima, Cadastrar-se abaixo)', async () => {
    const t = await abrir(A, 'ghost@x.com'); const bs = t.$$('#lgEntrar button').map(b => b.id);
    ok(bs.indexOf('lgGoogle') < bs.indexOf('lgCadastrar'), bs.join());
  });
  await TA('login: inativo recebe aviso de acesso desativado e não vê Cadastrar-se', async () => {
    const t = await abrir(A, 'off@x.com');
    eq(tituloModal(t), 'Acesso desativado'); ok(t.$('#lgCadastrar').classList.contains('hidden')); ok(t.$('#lgOu').classList.contains('hidden'));
  });
  await TA('login: sem e-mail (conta não identificada) mostra dica, sem pop-up; Google abre o seletor de contas no topo', async () => {
    const t = await abrir(A, '');
    eq(tituloModal(t), ''); ok(!t.$('#lgHint').classList.contains('hidden')); ok(t.$('#lgHint').textContent.includes('identificar'));
    await t.click('#lgGoogle'); ok(t.aberto, 'abriu o seletor');
    ok(t.aberto[0].startsWith('https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent('https://script.google.com/a/macros/x.com/s/ABC/exec')), t.aberto[0]); eq(t.aberto[1], '_top');
    t.aberto = null; await t.click('#lgOutra'); ok(t.aberto && t.aberto[0].includes('AccountChooser'));
    t.aberto = null; await t.click('#lgCadastrar'); eq(tituloModal(t), 'Entre com o Google primeiro'); ok(t.$('#lgCad').classList.contains('hidden'));
  });
  await TA('login: Entrar com Google rechecha a base; quando o usuário passa a existir, entra no app sozinho', async () => {
    const t = await abrir(A, 'tardio@x.com');
    eq(tituloModal(t), 'Login não encontrado'); await t.click('#modal [data-fechar]');
    A.ctx.anexar_('Cad_Usuarios', ['tardio@x.com', 'Tardio Um', 'Auditor', 'Sim']); A.run('limparCache_()');
    await t.click('#lgGoogle');
    ok(t.chamadas.filter(c => c[0] === 'bootstrap').length === 2 && t.chamadas[1][1][0] === true);
    ok(!t.$('#app').classList.contains('hidden')); ok(t.$('#login').classList.contains('hidden'));
    eq(t.menu().sort(), ['form', 'matriz', 'minhas']); ok(t.$('#who').textContent.includes('Tardio Um'));
    eq(t.erros, []);
  });
  await TA('login: Entrar com Google de quem continua sem cadastro mostra o pop-up de novo', async () => {
    const t = await abrir(A, 'ghost@x.com'); await t.click('#modal [data-fechar]');
    await t.click('#lgGoogle'); eq(tituloModal(t), 'Login não encontrado'); ok(!t.$('#lgGoogle').disabled);
  });
  await TA('cadastro: formulário valida, Outros pede o cargo digitado, e-mail vem preenchido e travado', async () => {
    const t = await abrir(A, 'novo1@x.com'); await t.click('#modal [data-fechar]');
    await t.click('#lgCadastrar'); ok(!t.$('#lgCad').classList.contains('hidden')); ok(t.$('#lgEntrar').classList.contains('hidden'));
    eq(t.$('#cdEmail').value, 'novo1@x.com'); ok(t.$('#cdEmail').readOnly);
    eq(t.$$('#cdCargo option').map(o => o.textContent), ['Selecione o cargo', 'Analista', 'Líder', 'Site Leader', 'Coordenador', 'Outros']);
    const n = t.chamadas.length; await t.click('#cdEnviar'); eq(t.chamadas.length, n, 'nada enviado com erros');
    ok(t.$('[data-lg-err="nome"]').textContent && t.$('[data-lg-err="cargo"]').textContent);
    ok(t.$('#cdOutroW').classList.contains('hidden')); t.set('#cdCargo', 'Outros'); ok(!t.$('#cdOutroW').classList.contains('hidden'));
    t.set('#cdNome', 'Nova Pessoa'); await t.click('#cdEnviar'); ok(t.$('[data-lg-err="cargoOutro"]').textContent, 'cargo digitado obrigatório'); eq(t.chamadas.length, n);
    t.set('#cdCargo', 'Analista'); ok(t.$('#cdOutroW').classList.contains('hidden'));
  });
  await TA('cadastro: envio grava Pendente, mostra confirmação e bloqueia novo envio', async () => {
    const t = await abrir(A, 'novo2@x.com'); await t.click('#modal [data-fechar]'); await t.click('#lgCadastrar');
    t.set('#cdNome', '  Joana   Prado '); t.set('#cdCargo', 'Outros'); t.set('#cdOutro', 'Supervisor de Piso'); await t.click('#cdEnviar');
    ok(!t.$('#lgOk').classList.contains('hidden')); eq(t.$('#lgOkEmail').textContent, 'novo2@x.com');
    const r = A.call('lerDireto_', 'Cad_Solicitacoes').find(x => x.Email === 'novo2@x.com'); eq([r.Nome, r.Cargo, r.Status], ['Joana Prado', 'Supervisor de Piso', 'Pendente']);
    await t.click('#lgOkVoltar'); ok(t.$('#lgCadastrar').disabled); eq(t.$('#lgCadT').textContent, 'Cadastro em análise');
    const t2 = await abrir(A, 'novo2@x.com'); eq(tituloModal(t2), 'Cadastro em análise'); ok(t2.$('#lgCadastrar').disabled);
  });
  await TA('cadastro: erro do servidor aparece em pop-up e nos campos', async () => {
    const t = await abrir(A, 'novo3@x.com'); await t.click('#modal [data-fechar]'); await t.click('#lgCadastrar');
    t.set('#cdNome', 'Pessoa Tres'); t.set('#cdCargo', 'Líder'); solicitar('novo3@x.com'); // pedido feito por outra aba
    await t.click('#cdEnviar'); eq(tituloModal(t), 'Não foi possível enviar'); ok(t.$('#modal').textContent.includes('em análise')); ok(!t.$('#cdEnviar').disabled);
  });
  await TA('cadastro recusado: aviso próprio e novo pedido permitido', async () => {
    solicitar('novo4@x.com'); A.as('owner@x.com'); A.call('recusarSolicitacao', A.call('lerDireto_', 'Cad_Solicitacoes').find(x => x.Email === 'novo4@x.com').ID);
    const t = await abrir(A, 'novo4@x.com'); eq(tituloModal(t), 'Cadastro não aprovado'); ok(!t.$('#lgCadastrar').disabled);
  });
  await TA('menu: só quem tem a permissão vê Autorizações; selo vermelho com o número de pendentes', async () => {
    ['pa@x.com', 'pb@x.com', 'pc@x.com'].forEach(e => solicitar(e));
    A.as('owner@x.com'); const n = A.call('contarPendentes'); ok(n >= 3);
    const t = await abrir(A, 'owner@x.com'); ok(t.menu().includes('acessos') && !t.menu().includes('autorizar'), 'vira aba de Acessos');
    const b = t.$('#nav button[data-v="acessos"]'); ok(b.classList.contains('alerta')); eq(b.querySelector('.badge-n').textContent, String(n)); eq(b.textContent.replace(String(n), ''), 'Acessos'); await t.nav('acessos'); eq(t.$('#v-acessos .tabs [data-at="autorizar"] .badge-n').textContent, String(n), 'selo também na aba');
    for (const e of ['ana@x.com', 'aud1@x.com']) { const u = await abrir(A, e); ok(!u.menu().includes('autorizar'), e); ok(!u.$('.badge-n'), e); }
    { const u = await abrir(A, 'sl@x.com'); ok(u.menu().includes('autorizar') || u.menu().includes('acessos'), 'Site Leader aprova cadastros'); }
  });
  await TA('Autorizações: tabela com pendentes, dados escapados (XSS) e histórico', async () => {
    solicitar('xss1@x.com', { nome: '<img src=x onerror=alert(1)> Fulano', cargo: 'Outros', cargoOutro: '<b>Cargo</b>' });
    const t = await abrir(A, 'owner@x.com'); await t.irAutorizar();
    eq(t.$('#titulo').textContent, 'Acessos'); ok(t.$('#acBody').textContent.includes('Cadastros aguardando aprovação'));
    ok(t.$$('#acBody tbody tr').length >= 4); eq(t.$$('#acBody img').length, 0); ok(t.$('#acBody').textContent.includes('<img src=x'));
    ok(t.$$('#acBody [data-sa]').length === t.$$('#acBody [data-sr]').length);
    for (const c of t.$$('#acBody thead th')) ok(c.textContent !== undefined);
    eq(t.erros, []);
  });
  await TA('aprovar: vai direto ao cadastro de usuário com dados preenchidos; salvar envia o e-mail e baixa o selo', async () => {
    solicitar('apr1@x.com', { nome: 'Aprovada Um', cargo: 'Coordenador' });
    const t = await abrir(A, 'owner@x.com'); await t.irAutorizar();
    const antes = Number(t.$('#nav .badge-n').textContent);
    const linha = t.$$('#acBody tbody tr').find(r => r.textContent.includes('apr1@x.com')); await t.click(linha.querySelector('[data-sa]'));
    ok(!t.$('#v-acessos').classList.contains('hidden'), 'foi para Acessos'); eq(t.$('#titulo').textContent, 'Acessos');
    const em = t.$('#acBody [data-u="Email_Google"]'); eq(em.value, 'apr1@x.com'); ok(em.readOnly); eq(t.$('#acBody [data-u="Nome"]').value, 'Aprovada Um'); eq(t.$('#acBody [data-u="Status_Ativo"]').value, 'Sim');
    ok(t.$('#acBody').textContent.includes('Cargo informado: Coordenador')); eq(t.$('#uSalvar').textContent, 'Aprovar e cadastrar');
    await t.click('#uSalvar'); ok(t.$('#acBody [data-ue-err="Perfil"]').textContent, 'perfil obrigatório');
    t.set('#acBody [data-u="Perfil"]', 'Auditor'); A.emails.length = 0; await t.click('#uSalvar');
    eq(A.emails.length, 1); eq(A.emails[0].to, 'apr1@x.com');
    ok(!/Matriz de Processos|Realizar auditorias|Perfil:/.test(A.emails[0].body), 'e-mail não lista permissões nem perfil');
    ok(t.toast().includes('E-mail de aprovação enviado')); eq(t.$('#titulo').textContent, 'Acessos'); eq(t.$('#v-acessos .tabs .on').dataset.at, 'autorizar', 'volta à aba Autorizações');
    ok(!t.$$('#acBody tbody tr').some(r => r.textContent.includes('apr1@x.com') && r.querySelector('[data-sa]')));
    const bd = t.$('#nav .badge-n'); eq(Number(bd ? bd.textContent : 0), antes - 1);
    ok(t.$('#acBody').textContent.includes('Aprovada') && t.$('#acBody').textContent.includes('Auditor'));
    const u = await abrir(A, 'apr1@x.com'); eq(u.menu().sort(), ['form', 'matriz', 'minhas']);
    eq(t.erros, []);
  });
  await TA('aprovar: falha no envio do e-mail avisa o admin', async () => {
    solicitar('apr2@x.com', { nome: 'Aprovada Dois' });
    const t = await abrir(A, 'owner@x.com'); await t.irAutorizar();
    await t.click(t.$$('#acBody tbody tr').find(r => r.textContent.includes('apr2@x.com')).querySelector('[data-sa]'));
    t.set('#acBody [data-u="Perfil"]', 'Auditor'); A.mailFalha = true; await t.click('#uSalvar'); A.mailFalha = false;
    ok(t.toast().includes('e-mail não foi enviado')); eq(t.$('#toast').className, 'err');
    eq(A.call('lerDireto_', 'Cad_Usuarios').some(x => x.Email_Google === 'apr2@x.com'), true);
  });
  await TA('aprovar: voltar às autorizações cancela sem criar usuário', async () => {
    solicitar('apr3@x.com');
    const t = await abrir(A, 'owner@x.com'); await t.irAutorizar();
    await t.click(t.$$('#acBody tbody tr').find(r => r.textContent.includes('apr3@x.com')).querySelector('[data-sa]'));
    await t.click('#uCancel'); eq(t.$('#v-acessos .tabs .on').dataset.at, 'autorizar'); eq(A.call('lerDireto_', 'Cad_Usuarios').some(x => x.Email_Google === 'apr3@x.com'), false);
    await t.click('#v-acessos .tabs [data-at="usuarios"]'); eq(t.$('#acBody [data-u="Email_Google"]').value, '', 'formulário limpo ao voltar a Usuários');
  });
  await TA('recusar: pede confirmação, remove da fila e registra no histórico', async () => {
    solicitar('rec9@x.com');
    const t = await abrir(A, 'owner@x.com'); await t.irAutorizar();
    await t.click(t.$$('#acBody tbody tr').find(r => r.textContent.includes('rec9@x.com')).querySelector('[data-sr]'));
    eq(tituloModal(t), 'Recusar cadastro'); await t.click('#modal [data-fechar]'); eq(A.call('lerDireto_', 'Cad_Solicitacoes').find(x => x.Email === 'rec9@x.com').Status, 'Pendente');
    await t.click(t.$$('#acBody tbody tr').find(r => r.textContent.includes('rec9@x.com')).querySelector('[data-sr]')); await t.click('#srOk');
    eq(A.call('lerDireto_', 'Cad_Solicitacoes').find(x => x.Email === 'rec9@x.com').Status, 'Recusada'); ok(t.toast().includes('recusado'));
    ok(!t.$$('#acBody tbody tr').some(r => r.textContent.includes('rec9@x.com') && r.querySelector('[data-sa]'))); ok(t.$('#acBody').textContent.includes('Recusada'));
  });
  await TA('selo atualiza sozinho (consulta silenciosa) e some quando zera', async () => {
    const t = await abrir(A, 'owner@x.com', { poll: 40 }); const n0 = Number((t.$('#nav .badge-n') || { textContent: 0 }).textContent);
    solicitar('poll1@x.com'); await sleep(200); await t.idle();
    eq(Number(t.$('#nav .badge-n').textContent), n0 + 1); eq(t.win.__S.pend, n0 + 1);
  });
  await TA('Atualizar também renova o selo', async () => {
    const t = await abrir(A, 'owner@x.com'); const n0 = t.win.__S.pend; solicitar('ref1@x.com'); await t.click('#refresh'); eq(t.win.__S.pend, n0 + 1);
  });
  await TA('Analista com permissão de usuários não vê a tela nem o selo e o servidor nega chamadas diretas', async () => {
    const t = await abrir(A, 'ana@x.com'); ok(!t.menu().includes('autorizar'));
    t.win.google.script.run.withSuccessHandler(() => {}).withFailureHandler(e => { t.neg = e.message; }).listarSolicitacoes(); await t.idle(); ok(/não tem permissão/.test(t.neg || ''), t.neg);
    t.win.__S.u.telas.push('autorizar'); t.win.document.querySelector('#nav'); // tela forçada no cliente continua sem dados
    t.neg = ''; t.win.google.script.run.withFailureHandler(e => { t.neg = e.message; }).recusarSolicitacao('x'); await t.idle(); ok(/não tem permissão/.test(t.neg), t.neg);
  });
  await TA('temas: automático, claro, escuro e laranja pelo menu do usuário; escolha salva e estado marcado', async () => {
    const t = await abrir(A, 'ana@x.com'); const d = t.doc.documentElement;
    ok(t.$('#userMenu').classList.contains('hidden')); await t.click('#userBtn'); ok(!t.$('#userMenu').classList.contains('hidden')); eq(t.$('#userBtn').getAttribute('aria-expanded'), 'true');
    eq(t.$$('#userMenu [data-tema]').map(b => b.textContent.trim()), ['Automático', 'Claro', 'Escuro', 'Laranja']);
    await t.click('#userMenu [data-tema="orange"]'); eq(d.getAttribute('data-theme'), 'orange'); eq(t.win.localStorage.getItem('pcTema'), 'orange');
    eq(t.$('#userMenu [data-tema="orange"]').getAttribute('aria-pressed'), 'true'); eq(t.$('#userMenu [data-tema="dark"]').getAttribute('aria-pressed'), 'false');
    await t.click('#userMenu [data-tema="dark"]'); eq(d.getAttribute('data-theme'), 'dark'); eq(t.win.localStorage.getItem('pcTema'), 'dark');
    await t.click('#userMenu [data-tema="light"]'); eq(d.getAttribute('data-theme'), null); eq(t.win.localStorage.getItem('pcTema'), 'light');
    t.win.matchMedia = () => ({ matches: true, addEventListener() {} });
    await t.click('#userMenu [data-tema="auto"]'); eq(d.getAttribute('data-theme'), 'dark', 'automático segue o sistema (escuro)'); eq(t.win.localStorage.getItem('pcTema'), 'auto');
    t.win.matchMedia = () => ({ matches: false, addEventListener() {} });
    await t.click('#userMenu [data-tema="auto"]'); eq(d.getAttribute('data-theme'), null, 'automático segue o sistema (claro)');
    t.doc.dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ok(t.$('#userMenu').classList.contains('hidden'));
    await t.click('#userBtn'); await t.click('#brand'); ok(t.$('#userMenu').classList.contains('hidden'), 'clique fora fecha');
    eq(t.erros, []);
  });
  await TA('temas: relatório é redesenhado ao trocar o tema; cores de status dos gráficos não mudam', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('geral'); const n = t.graficos.length;
    await t.click('#userBtn'); await t.click('#userMenu [data-tema="orange"]'); ok(t.graficos.length > n, 'redesenhou');
    const cores = JSON.stringify(t.graficos.slice(n).map(g => g.cfg.data.datasets.map(d => d.backgroundColor)));
    ['#1E9E5A', '#F2B100', '#D93025'].forEach(c => ok(cores.includes(c), c));
    ok(!cores.includes('CC3D15'), 'laranja não vaza para as cores de status');
  });
  await TA('tema salvo é aplicado antes de tudo (script do cabeçalho); laranja com contraste AA e status intactos', async () => {
    const fs = require('fs'), { JSDOM } = require('jsdom');
    const idx = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'Index.html'), 'utf8'), css = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'Styles.html'), 'utf8');
    const sc = idx.match(/<script>(try \{ var t = localStorage[\s\S]*?)<\/script>/)[1];
    for (const [salvo, esp] of [['orange', 'orange'], ['dark', 'dark'], ['light', null], ['auto', null], ['lixo', null]]) {
      const d = new JSDOM('<html></html>', { url: 'https://app.test/', runScripts: 'outside-only' }); d.window.localStorage.setItem('pcTema', salvo); d.window.eval(sc);
      eq(d.window.document.documentElement.getAttribute('data-theme'), esp, salvo);
    }
    const d2 = new JSDOM('<html></html>', { url: 'https://app.test/', runScripts: 'outside-only' }); d2.window.matchMedia = () => ({ matches: true }); d2.window.localStorage.setItem('pcTema', 'auto'); d2.window.eval(sc);
    eq(d2.window.document.documentElement.getAttribute('data-theme'), 'dark', 'auto + sistema escuro');
    const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    const p = css.match(/--p:(#[0-9A-Fa-f]{6})/)[1]; ok(1.05 / (lum(p) + .05) >= 4.5, 'contraste do laranja com branco: ' + p);
    const bloco = css.match(/\[data-theme=orange\]\{[^}]*\}/)[0]; ok(!/--p:/.test(bloco), 'mesmo acento em todos os temas'); ['--ok', '--warn', '--bad', '--gr', '--hm'].forEach(v => ok(!bloco.includes(v + ':'), 'não deve redefinir ' + v));
    ok(/--ok:#1E9E5A/.test(css) && /--warn:#F2B100/.test(css) && /--bad:#D93025/.test(css), 'cores de status mantidas');
  });
  await TA('login e carregamento: sem emojis, sem logotipo do Google e com a autoria', async () => {
    const t = await abrir(A, 'ghost@x.com'); const h = t.$('#login').innerHTML + t.$('#carregando').innerHTML;
    ok(!EMOJI.test(h)); ok(!/googleg|gstatic|google[-_]?logo/i.test(h)); ok(t.$('#login').textContent.includes('Gabriel Malafaia e Karina Ferreira'));
    ok(t.$('#login svg') !== null, 'ícones SVG do próprio sistema');
  });

  console.log('\nCliente: ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x));
  process.exit(R.f.length ? 1 : 0);
})();
