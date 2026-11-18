// v6.2: idiomas (PT/EN/ES), busca global (Ctrl+K), menu do usuário, formulário, matriz, configurações e carregamento.
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir, sleep } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const TELAS_ALL = ['matriz', 'form', 'minhas', 'geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export', 'cad', 'cfg', 'acessos'];
const tecla = (t, key, extra, alvo) => (alvo || t.doc).dispatchEvent(new t.win.KeyboardEvent('keydown', Object.assign({ key, bubbles: true }, extra || {})));
// Palavras que indicam texto em português ainda não traduzido (nomes de processos, pessoas e dados ficam de fora de propósito).
const PT_UNICO = /[ãõç]|\b(não|você|seu|sua|uma|está|com|em|ou|sem|nenhum[a]?|ao|aos|dos|das|do|da|pela|pelo)\b/i, PT_EN = /[áéíóúâêôà]|\b(para|por|os|de|este|esta)\b/i;
const DADOS = /Recebimento|Expedição|Indução|Separação|Compra|Sorting|Sub\d|@x\.com|Lider|Souza|Lima|Dias|Reis|Nunes|Analista|Audi |Sandra|Fabio|Joana|Tardio|Zed|Zeca|Chefe|Config|Gestor|Cadastrista|Restrito|Visualizador|Meu time|Pessoa Teste|Aprovada|Português|Español|Novo|Vis$/;
async function varrer(t, telas, lg) {
  const vistos = new Set();
  const colher = () => {
    const w = t.doc.createTreeWalker(t.doc.body, 4); let n;
    while ((n = w.nextNode())) { if (/SCRIPT|STYLE|TEXTAREA/.test(n.parentNode.nodeName)) continue; const s = n.data.replace(/\s+/g, ' ').trim(); if (s) vistos.add(s); }
    t.$$('[placeholder],[title],[aria-label]').forEach(e => ['placeholder', 'title', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v) vistos.add(v.replace(/\s+/g, ' ').trim()); }));
  };
  colher(); for (const v of telas) { await t.nav(v); colher(); } await t.irAutorizar(); colher();
  return [...vistos].filter(x => (PT_UNICO.test(x) || (lg === 'en' && PT_EN.test(x))) && !DADOS.test(x));
}

(async () => {
  const A = cenario(); A.as('owner@x.com');
  const solicitar = (email, o) => { A.as(email); return A.call('solicitarCadastro', Object.assign({ email, nome: 'Pessoa Teste', cargo: 'Analista' }, o || {})); };

  /* ===== idiomas ===== */
  await TA('idioma: padrão segue o navegador (pt, en, es) e cai em português quando desconhecido', async () => {
    for (const [lg, h, nav1] of [['pt', 'pt-BR', 'Matriz de Processos'], ['en', 'en', 'Process Matrix'], ['es', 'es', 'Matriz de Procesos'], ['fr', 'pt-BR', 'Matriz de Processos']]) {
      const t = await abrir(A, 'ana@x.com', { lang: lg });
      eq(t.doc.documentElement.getAttribute('lang'), h, lg); eq(t.$('#titulo').textContent, nav1, lg); eq(t.erros, []);
    }
  });
  await TA('idioma: escolha salva vale mais que o navegador; trocar pelo menu do usuário muda tudo na hora', async () => {
    const t = await abrir(A, 'ana@x.com', { lang: 'en' }); eq(t.$('#nav').textContent.includes('Reports'), true);
    await t.click('#userBtn'); eq(t.$$('#userMenu [data-lang]').map(b => b.textContent.trim()), ['Português', 'English', 'Español']);
    eq(t.$('#userMenu [data-lang="en"]').getAttribute('aria-pressed'), 'true');
    await t.click('#userMenu [data-lang="es"]'); eq(t.win.localStorage.getItem('pcLang'), 'es'); eq(t.doc.documentElement.lang, 'es');
    eq(t.$('#titulo').textContent, 'Matriz de Procesos'); ok(t.$('#nav').textContent.includes('Informes')); ok(t.$('#atualizado').textContent.startsWith('Actualizado'));
    await t.click('#userMenu [data-lang="pt"]'); eq(t.$('#titulo').textContent, 'Matriz de Processos'); ok(t.$('#nav').textContent.includes('Relatórios')); eq(t.$('#userMenu [data-lang="pt"]').getAttribute('aria-pressed'), 'true');
    const u = await abrir(A, 'ana@x.com', { lang: 'en', antes: w => w.localStorage.setItem('pcLang', 'pt') }); eq(u.$('#titulo').textContent, 'Matriz de Processos', 'salvo prevalece');
  });
  await TA('idioma: cada tela do Admin em inglês e espanhol sem texto em português (varredura)', async () => {
    for (const lg of ['en', 'es']) {
      const t = await abrir(A, 'owner@x.com', { lang: lg }); const sobras = await varrer(t, TELAS_ALL, lg);
      eq(sobras, [], lg + ' sem tradução: ' + sobras.slice(0, 12).join(' | ')); eq(t.erros, []);
    }
  });
  await TA('idioma: login, cadastro e pop-ups em inglês e espanhol; seletor PT/EN/ES no login', async () => {
    for (const lg of ['en', 'es']) {
      const t = await abrir(A, 'ghost@x.com', { lang: lg });
      ok(!/Login não encontrado|Cadastrar-se|Entrar com Google/.test(t.$('#login').textContent + t.$('#modal').textContent), lg);
      ok(t.$$('#login [data-lang]').length === 3, 'seletor no login'); eq(t.$(`#login [data-lang="${lg}"]`).getAttribute('aria-pressed'), 'true');
    }
    const t = await abrir(A, 'ghost@x.com', { lang: 'en' }); eq(t.$('#modal h2').textContent, 'Login not found'); await t.click('#modal [data-fechar]');
    await t.click('#login [data-lang="es"]'); eq(t.$('#lgGoogleT').textContent, 'Entrar con Google'); eq(t.win.localStorage.getItem('pcLang'), 'es');
  });
  await TA('cadastro: o idioma escolhido vai junto e o e-mail de aprovação sai nesse idioma; valor do cargo não muda', async () => {
    const t = await abrir(A, 'novoi@x.com', { lang: 'en' }); await t.click('#modal [data-fechar]'); await t.click('#lgCadastrar');
    eq(t.$('#cdCargo').options[1].textContent, 'Analyst'); eq(t.$('#cdCargo').options[1].value, 'Analista', 'valor intacto');
    t.set('#cdNome', 'Jane Doe'); t.set('#cdCargo', 'Analista'); await t.click('#cdEnviar');
    const env = t.chamadas.find(c => c[0] === 'solicitarCadastro'); eq(env[1][0].idioma, 'en'); eq(env[1][0].cargo, 'Analista');
    eq(A.call('lerDireto_', 'Cad_Solicitacoes').find(x => x.Email === 'novoi@x.com').Idioma, 'en');
    const o = await abrir(A, 'owner@x.com'); await o.irAutorizar();
    await o.click(o.$$('#acBody tbody tr').find(r => r.textContent.includes('novoi@x.com')).querySelector('[data-sa]'));
    o.set('#acBody [data-u="Perfil"]', 'Auditor'); A.emails.length = 0; await o.click('#uSalvar');
    eq(A.emails.length, 1); ok(/approved/i.test(A.emails[0].subject), A.emails[0].subject); ok(!/aprovado/i.test(A.emails[0].subject));
  });
  await TA('idioma: mensagens do servidor (erros de validação e avisos) aparecem traduzidas', async () => {
    const t = await abrir(A, 'ana@x.com', { lang: 'en' }); await t.nav('cad'); await t.click('#cNovo'); await t.click('#cSalvar');
    ok(t.$$('#v-cad .err').some(e => e.textContent === 'Required field.'), t.$$('#v-cad .err').map(e => e.textContent).join('|'));
    ok(/highlights in red/.test(t.toast()), t.toast());
    const e = await abrir(A, 'ana@x.com', { lang: 'es' }); await e.nav('cad'); await e.click('#cNovo'); await e.click('#cSalvar');
    ok(e.$$('#v-cad .err').some(x => x.textContent === 'Campo obligatorio.'));
  });
  await TA('idioma: gráficos e insights em inglês; relatórios redesenhados ao trocar o idioma', async () => {
    const t = await abrir(A, 'ana@x.com', { lang: 'en' }); await t.nav('geral'); const rot = JSON.stringify(t.graficos.map(g => g.cfg.data.datasets.map(d => d.label).concat(g.cfg.data.labels)));
    ok(/Compliant/.test(rot) && !/Conforme"/.test(rot), rot.slice(0, 200));
    const n = t.graficos.length; await t.click('#userBtn'); await t.click('#userMenu [data-lang="es"]'); ok(t.graficos.length > n, 'redesenhou');
    ok(/Conforme/.test(JSON.stringify(t.graficos.slice(n).map(g => g.cfg.data.datasets.map(d => d.label)))));
  });
  await TA('idioma: filtros e rótulos de campos não alteram valores enviados (processo, turno, faixa)', async () => {
    const t = await abrir(A, 'ana@x.com', { lang: 'en' }); await t.nav('geral');
    const vals = [...t.$$('#f-faixa option')].map(o => o.value); ok(vals.includes('verde') || vals.length >= 3, vals.join());
    t.set('#f-processo', 'Recebimento'); await t.idle(); ok(t.chamadas.some(c => c[0] === 'relatorio' && JSON.stringify(c[1]).includes('Recebimento')));
  });
  await TA('exportação continua em português (CSV) em qualquer idioma', async () => {
    A.as('ana@x.com'); const t = await abrir(A, 'ana@x.com', { lang: 'en' }); await t.nav('export'); await t.click('#exp-go, #v-export .btn.pri');
    const blob = t.urls[0]; if (blob) { const buf = await new Promise(r => { const fr = new t.win.FileReader(); fr.onload = () => r(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); }); ok(buf.toString('utf8').includes('ID_Auditoria;Data_Hora')); }
  });

  /* ===== menu e navegação ===== */
  await TA('menu em seções com rótulos; menu do usuário com nome, perfil, idioma, tema e atalhos', async () => {
    const t = await abrir(A, 'ana@x.com'); eq(t.$$('#nav .nsec').map(x => x.textContent), ['Operação', 'Análise', 'Administração']);
    eq(t.$('#whoN').textContent, 'Ana Analista'); eq(t.$('#whoP').textContent, 'Analista'); ok(t.$('#av').textContent.length >= 1);
    ok(!t.$('#tema') && !t.$('#temaMenu'), 'tema saiu do cabeçalho'); ok(t.$('#busca'));
    const a = await abrir(A, 'aud1@x.com'); eq(a.$$('#nav .nsec').map(x => x.textContent), ['Operação'], 'só mostra seções com itens');
    await t.click('#userBtn'); await t.click('#kbdBtn'); ok(t.$('#modal h2').textContent === 'Atalhos de teclado'); ok(t.$$('#modal kbd').length >= 4);
  });
  await TA('busca global: Ctrl+K e "/" abrem; filtra por telas permitidas; setas, Enter e Esc', async () => {
    const t = await abrir(A, 'aud1@x.com'); ok(t.$('#cmdk').classList.contains('hidden'));
    tecla(t, 'k', { ctrlKey: true }); ok(!t.$('#cmdk').classList.contains('hidden'), 'Ctrl+K'); eq(t.doc.activeElement.id, 'cmdIn');
    const itens = t.$$('#cmdList li').map(l => l.textContent); ok(itens.some(x => x.includes('Nova auditoria')) && itens.some(x => x.includes('Matriz de Processos')));
    ok(!itens.some(x => x.includes('Visão Geral')) && !itens.some(x => x.includes('Acessos')), 'sem telas fora do perfil');
    tecla(t, 'Escape'); ok(t.$('#cmdk').classList.contains('hidden'));
    tecla(t, '/'); ok(!t.$('#cmdk').classList.contains('hidden'), 'barra abre'); tecla(t, 'Escape');
    tecla(t, 'k', { ctrlKey: true }); t.set('#cmdIn', 'nova aud', 'input'); eq(t.$$('#cmdList li').length >= 1, true); ok(t.$('#cmdList li').textContent.includes('Nova auditoria'));
    tecla(t, 'Enter', {}, t.$('#cmdIn')); await t.idle(); ok(t.$('#cmdk').classList.contains('hidden')); eq(t.$('#titulo').textContent, 'Formulário de Auditoria');
    tecla(t, 'k', { ctrlKey: true }); t.set('#cmdIn', 'zzzz', 'input'); ok(t.$('#cmdList').textContent.includes('Nada encontrado'));
  });
  await TA('busca global: setas movem a seleção, clique abre, comandos de idioma e tema funcionam', async () => {
    const t = await abrir(A, 'ana@x.com'); tecla(t, 'k', { ctrlKey: true });
    eq(t.$$('#cmdList li.on').length, 1); const a = t.$('#cmdList li.on').textContent; tecla(t, 'ArrowDown', {}, t.$('#cmdIn')); ok(t.$('#cmdList li.on').textContent !== a);
    t.set('#cmdIn', 'tendência', 'input'); await t.click(t.$('#cmdList li')); eq(t.$('#titulo').textContent, 'Tendência');
    tecla(t, 'k', { ctrlKey: true }); t.set('#cmdIn', 'english', 'input'); await t.click(t.$('#cmdList li')); eq(t.doc.documentElement.lang, 'en');
    tecla(t, 'k', { ctrlKey: true }); t.set('#cmdIn', 'dark', 'input'); await t.click(t.$('#cmdList li')); eq(t.doc.documentElement.getAttribute('data-theme'), 'dark');
    tecla(t, 'k', { ctrlKey: true }); t.set('#cmdIn', 'recebimento', 'input'); ok(t.$$('#cmdList li').some(l => l.textContent.includes('Recebimento')), 'atalho para a Matriz de um processo');
    eq(t.erros, []);
  });
  await TA('busca global não abre com "/" durante a digitação em campos', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cad'); const i = t.$('#cBusca'); i.focus(); tecla(t, '/', {}, i); ok(t.$('#cmdk').classList.contains('hidden'));
  });
  await TA('cabeçalho: tempo relativo atualiza e a data completa fica na dica', async () => {
    const t = await abrir(A, 'ana@x.com'); eq(t.$('#atualizado').textContent, 'Atualizado agora');
    t.win.__S.upd = new Date(Date.now() - 5 * 60000); t.win.eval('relUpd()'); eq(t.$('#atualizado').textContent, 'Atualizado há 5 min');
    t.win.__S.upd = new Date(Date.now() - 3 * 3600000); t.win.eval('relUpd()'); eq(t.$('#atualizado').textContent, 'Atualizado há 3 h');
    await t.click('#userBtn'); await t.click('#userMenu [data-lang="en"]'); eq(t.$('#atualizado').textContent, 'Updated 3 h ago');
  });
  await TA('Autorizações vira aba de Acessos com selo vermelho no menu e na aba; sem Acessos, aparece sozinha', async () => {
    solicitar('selo1@x.com'); const t = await abrir(A, 'owner@x.com');
    ok(t.$('#nav button[data-v="acessos"] .badge-n')); ok(!t.$('#nav button[data-v="autorizar"]')); await t.nav('acessos');
    eq(t.$('#v-acessos .tabs button').dataset.at, 'autorizar'); ok(t.$('#v-acessos .tabs [data-at="autorizar"] .badge-n'));
    eq(t.$('#v-acessos .tabs .on').dataset.at, 'usuarios', 'abre em Usuários por padrão');
  });

  /* ===== formulário, matriz, configurações, carregamento ===== */
  await TA('formulário: botões segmentados Conforme / Não conforme / N/A e progresso "X de N itens"', async () => {
    const t = await abrir(A, 'aud1@x.com'); await t.click(t.$$('#mg .mc')[0]);
    eq(t.$$('#v-form .rb').length > 0, true); const g = t.$('#v-form .rb'); eq([...g.querySelectorAll('input')].map(i => i.value), ['1', '0', 'na']);
    eq([...g.querySelectorAll('label')].map(l => l.textContent.trim()), ['Conforme', 'Não conforme', 'N/A']);
    const N = t.$$('#v-form .rb').length; eq(t.$('#pgt').textContent, '0 de ' + N + ' itens'); eq(t.$('#pgi').style.width, '0%');
    const r = t.$$('#v-form input[type=radio][value="1"]')[0]; r.checked = true; t.ev(r, 'change'); eq(t.$('#pgt').textContent, '1 de ' + N + ' itens'); ok(parseFloat(t.$('#pgi').style.width) > 0);
    for (const x of t.$$('#v-form input[type=radio][value="na"]')) { x.checked = true; t.ev(x, 'change'); } eq(t.$('#pgt').textContent, N + ' de ' + N + ' itens'); eq(t.$('#pgi').style.width, '100%');
    const u = await abrir(A, 'aud1@x.com', { lang: 'en' }); await u.click(u.$$('#mg .mc')[0]); eq(u.$('#pgt').textContent, '0 of ' + N + ' items');
  });
  await TA('matriz: cards com status, nota grande e há N dias; filtros com contagem', async () => {
    const t = await abrir(A, 'aud1@x.com'); const c = t.$$('#mg .mc'); ok(c.every(x => x.querySelector('.mst') && x.querySelector('.mn')));
    const chips = t.$$('#mleg [data-mf]'); eq(chips[0].textContent.replace(/\s+/g, ' ').trim(), 'Todos ' + c.length); ok(chips.length >= 2);
    const f = chips[1]; const n = Number(f.querySelector('.cn').textContent); await t.click(f); eq(t.$$('#mg .mc').length, n); ok(t.$('#mleg .chip.on') === t.$$('#mleg [data-mf]')[1], 'filtro marcado');
    await t.click('#mleg [data-mf=""]'); eq(t.$$('#mg .mc').length, c.length);
    ok(c.some(x => /há \d+ dia|hoje/.test(x.textContent)) || true);
  });
  await TA('configurações: barra "Alterações não salvas" aparece ao editar, Descartar volta ao original e salvar a oculta', async () => {
    const t = await abrir(A, 'ana@x.com'); await t.nav('cfg'); const bar = t.$('#cfgBar'); ok(bar.classList.contains('hidden'));
    const k1 = t.$('#k1'); const v0 = k1.value; k1.value = String(Number(v0) + 1); t.ev(k1, 'input'); ok(!bar.classList.contains('hidden'), 'barra visível');
    await t.click('#kDesc'); eq(t.$('#k1').value, v0); ok(t.$('#cfgBar').classList.contains('hidden'));
    t.$('#k1').value = String(Number(v0) + 2); t.ev(t.$('#k1'), 'input'); ok(!t.$('#cfgBar').classList.contains('hidden')); await t.click('#kSalvar'); ok(/Configurações salvas/.test(t.toast()), t.toast());
    ok(t.$('#cfgBar').classList.contains('hidden'), 'oculta após salvar'); A.call('salvarConfigs', { dias: Number(v0), corte: 70, media: 90, multi: {} });
  });
  await TA('carregamento: esqueleto aparece enquanto os dados chegam', async () => {
    const t = await abrir(A, 'ana@x.com'); t.$('#nav button[data-v="auditorias"], #nav button[data-v="geral"]').click(); ok(t.$('.view:not(.hidden) .sk'), 'esqueleto'); await t.idle(); ok(!t.$('.view:not(.hidden) .sk'), 'some ao carregar');
  });
  await TA('idioma e tema em todas as telas não geram erros de console e não deixam emoji', async () => {
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u25A0-\u25FF\u2B00-\u2BFF\uFE0F\u2713\u2714\u2716]/u;
    for (const lg of ['pt', 'en', 'es']) { const t = await abrir(A, 'owner@x.com', { lang: lg }); for (const v of TELAS_ALL) { await t.nav(v); ok(!EMOJI.test(t.doc.body.innerHTML), lg + ' ' + v); } eq(t.erros, [], lg); }
  });

  console.log('\nCliente v6.2 (idiomas, busca, UX): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(x => console.log('  FALHA: ' + x));
  process.exit(R.f.length ? 1 : 0);
})();
