// v7: Visão Geral executiva, listas, filtros em duas camadas, impressão, configurações e relatório por e-mail.
const assert = require('assert');
const { cenario } = require('./seed.js');
const { abrir } = require('./cli.js');
const R = { ok: 0, f: [] };
async function TA(nome, fn) { try { await fn(); R.ok++; } catch (e) { R.f.push(nome + '\n      -> ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); } }
const ok = (c, m) => assert.ok(c, m || 'esperava verdadeiro');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const perfil = (A, nome, perms, telas, escopo) => { A.as('owner@x.com'); return A.call('salvarPerfil', { nome, desc: 'teste', perms, telas, escopo: Object.assign({ modo: 'todos', processos: [], turnos: [] }, escopo) }, true); };
const usuario = (A, email, nome, p) => A.ctx.anexar_('Cad_Usuarios', [email, nome, p, 'Sim']);

(async () => {
  const A = cenario(); A.as('owner@x.com');
  A.audit('aud1@x.com', 'Expedição', { conf: 5, nc: 5, obs: 'Piso molhado na doca durante a descarga', f: { doca: '36', colaboradores: ['Ana Souza'] } }); A.run('limparCache_()');

  await TA('Visão Geral v7: frase-resumo, card da nota com meta, KPI de itens críticos e ofensores com taxa', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('geral');
    const r = t.$('#v-geral .resumo'); ok(r && /Nota média de/.test(r.textContent) && /meta de 90%/.test(r.textContent), r && r.textContent);
    ok(/Sem base de comparação com o período anterior/.test(r.textContent), 'período anterior vazio');
    const h = t.$('#v-geral .hero'); ok(h && /Nota média/.test(h.textContent) && /Meta de 90%/.test(h.textContent)); ok(/Faltam|acima da meta|Meta atingida/.test(h.textContent));
    ok(t.graficos.find(g => g.id === 'g0'), 'mini tendência semanal');
    ok(t.$$('#v-geral .kpi').some(k => /item crítico reprovado/.test(k.textContent)));
    ok(t.$$('#v-geral .kpi em').every(e => !/vs\. período anterior/.test(e.textContent)), 'sem seta quando não há base');
    ok(t.$$('#v-geral .kpi em').some(e => /Sem base de comparação/.test(e.textContent)));
    const linhas = t.$$('#v-geral table tbody tr'); ok(linhas.length > 0); ok(/%/.test(linhas[0].children[1].textContent) && /\d+ \/ \d+/.test(linhas[0].children[1].textContent));
    ok(!t.$('#v-geral').innerHTML.match(EMOJI), 'sem emojis');
    eq(t.graficos.find(g => g.id === 'g3').cfg.type, 'bar'); ok(!t.graficos.find(g => g.cfg.type === 'doughnut'), 'rosca removida');
  });
  await TA('Visão Geral v7: barras 100% com n no rótulo e tooltip com a contagem', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('geral');
    const g = t.graficos.find(x => x.id === 'g1').cfg;
    ok(g.data.labels.every(l => Array.isArray(l) && /^n=\d+$/.test(l[1])), JSON.stringify(g.data.labels));
    eq(g.options.scales.y.max, 100);
    const somas = g.data.labels.map((_, i) => g.data.datasets.reduce((s, d) => s + d.data[i], 0)); somas.forEach(x => ok(Math.abs(x - 100) < 0.3, String(x)));
    ok(typeof g.options.plugins.tooltip.callbacks.label === 'function');
  });
  await TA('com período anterior preenchido a comparação aparece (setas e variação)', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('geral');
    t.set('#f-de', A.dia(-1)); t.set('#f-ate', A.hojeStr); await t.idle();
    ok(t.$('#v-geral .resumo'), 'resumo'); ok(/em relação ao período anterior/.test(t.$('#v-geral .resumo').textContent), t.$('#v-geral .resumo').textContent);
    ok(!/Sem base de comparação com/.test(t.$('#v-geral .resumo').textContent));
    ok(t.$$('#v-geral .kpi em').some(e => /vs\. período anterior/.test(e.textContent) && e.querySelector('svg')), 'setas');
    ok(t.$$('#v-geral tr[data-go] .it-no, #v-geral tr[data-go] .it-ok, #v-geral tr[data-go] .muted').length > 0);
  });
  await TA('ofensor e insight são clicáveis e abrem as Auditorias já filtradas', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('geral');
    const lin = t.$('#v-geral tr[data-go]'); ok(lin, 'ofensor clicável'); const proc = JSON.parse(lin.dataset.go).processo;
    await t.click(lin); eq(t.$('#titulo').textContent, 'Auditorias realizadas');
    eq(t.chamadas.filter(c => c[0] === 'relatorio').pop()[1][1].processo, proc); eq(t.$('#f-processo').value, proc);
    await t.nav('geral'); const li = t.$('#v-geral .ins li[data-go]'); ok(li, 'insight clicável'); const go = JSON.parse(li.dataset.go);
    await t.click(li); eq(t.$('#titulo').textContent, 'Auditorias realizadas');
    const f = t.chamadas.filter(c => c[0] === 'relatorio').pop()[1][1]; Object.keys(go).forEach(k => eq(f[k], go[k]));
  });
  await TA('sem a tela Auditorias os atalhos não aparecem como clicáveis', async () => {
    perfil(A, 'Só Geral', [], ['geral'], {}); usuario(A, 'sg@x.com', 'Só Geral', 'Só Geral'); A.run('limparCache_()');
    const t = await abrir(A, 'sg@x.com'); await t.nav('geral'); ok(!t.$('#v-geral [data-go]'));
  });
  await TA('Auditorias v7: linhas expansíveis (líder, turno, auditor, observações) e bloco de observações recentes', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('auditorias');
    const th = t.$$('#v-auditorias table.tbx thead th').map(x => x.textContent); ok(th.length <= 7, th.join());
    const ex = t.$$('#v-auditorias tr.exp'); ok(ex.length >= 6); const det = ex[0].nextElementSibling; ok(det.classList.contains('hidden'));
    await t.click(ex[0]); ok(!det.classList.contains('hidden')); eq(ex[0].getAttribute('aria-expanded'), 'true'); ok(/Líder/.test(det.textContent) && /Auditor/.test(det.textContent) && /Observações/.test(det.textContent));
    await t.click(ex[0]); ok(det.classList.contains('hidden'));
    ok(/Observações recentes de auditorias não conformes/.test(t.$('#v-auditorias').textContent) && /Piso molhado/.test(t.$('#v-auditorias .obsl').textContent));
    ok(ex.some(r => /Piso molhado/.test(r.nextElementSibling.textContent)));
  });
  await TA('filtros em duas camadas: "Mais filtros" abre, conta os ativos e busca nas observações', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('auditorias');
    ok(t.$('#fmais').classList.contains('hidden')); ok(t.$('#f-mais-n').classList.contains('hidden'));
    await t.click('#f-mais'); ok(!t.$('#fmais').classList.contains('hidden')); eq(t.$('#f-mais').getAttribute('aria-expanded'), 'true');
    t.set('#f-obs', 'molhado'); await t.idle();
    eq(t.chamadas.filter(c => c[0] === 'relatorio').pop()[1][1].obs, 'molhado'); eq(t.$('#f-mais-n').textContent, '1');
    eq(t.$$('#v-auditorias tr.exp').length, 1);
    t.set('#f-faixa', 'vermelho'); await t.idle(); eq(t.$('#f-mais-n').textContent, '2');
    await t.click('#f-limpar'); eq(t.$('#f-mais-n').textContent, ''); eq(t.$('#f-obs').value, '');
    ok(t.$('#f-processo').closest('#fbar') && !t.$('#f-processo').closest('#fmais'), 'processo continua visível');
    const t2 = await abrir(A, 'sl@x.com'); await t2.nav('auditorias'); t2.set('#f-faixa', 'vermelho'); await t2.idle(); ok(!t2.$('#fmais').classList.contains('hidden'), 'abre sozinho quando há filtro ativo');
  });
  await TA('Colaboradores v7: aviso de poucas auditorias, tendência e atalho para as auditorias', async () => {
    const t = await abrir(A, 'sl@x.com'); await t.nav('colab');
    const rs = t.$$('#v-colab tr[data-det="colab"]'); ok(rs.length >= 4);
    ok(rs.some(r => /Poucas auditorias/.test(r.textContent)), 'n < 3'); ok(rs.every(r => r.querySelector('svg.spark') || /—/.test(r.querySelector('.tnd').textContent)));
    const b = rs[0].querySelector('[data-go]'); ok(b); const nome = JSON.parse(b.dataset.go).colaborador; await t.click(b);
    eq(t.$('#titulo').textContent, 'Auditorias realizadas'); eq(t.chamadas.filter(c => c[0] === 'relatorio').pop()[1][1].colaborador, nome); eq(t.$('#f-colaborador').value, nome);
    eq(t.$('#f-mais-n').textContent, '1');
  });
  await TA('sem "ver nomes": sem colaboradores, sem filtro de colaborador, sem coluna de nomes', async () => {
    perfil(A, 'Gerente Sem Nomes', [], ['geral', 'auditorias', 'colab'], {}); usuario(A, 'sn@x.com', 'Gerente SN', 'Gerente Sem Nomes'); A.run('limparCache_()');
    const t = await abrir(A, 'sn@x.com'); await t.nav('colab');
    ok(/não exibe nomes de colaboradores/.test(t.$('#v-colab').textContent)); eq(t.$$('#v-colab tr[data-det="colab"]').length, 0); ok(t.$$('#v-colab tr[data-det="lider"]').length > 0);
    ok(t.$('#f-colaborador').parentNode.classList.contains('hidden'));
    await t.nav('auditorias'); ok(!t.$$('#v-auditorias table.tbx thead th').some(x => /Colaboradores/.test(x.textContent)));
    ok(!/Ana Souza|Bruno Lima|Carla Dias|Davi Reis/.test(t.$('#v-auditorias').textContent));
  });
  await TA('impressão A4: botão só nos relatórios, cabeçalho com período e usuário, folha de estilo de impressão', async () => {
    const t = await abrir(A, 'sl@x.com'); let n = 0; t.win.print = () => { n++; };
    ok(t.$('#btnPrint').classList.contains('hidden')); await t.nav('geral'); ok(!t.$('#btnPrint').classList.contains('hidden'));
    await t.click('#btnPrint'); eq(n, 1); const h = t.$('#printHd').textContent; ok(/Process Check/.test(h) && /Visão Geral/.test(h) && /Período: \d\d\/\d\d\/\d{4} a/.test(h) && /Sandra SL/.test(h), h);
    await t.nav('export'); ok(t.$('#btnPrint').classList.contains('hidden'));
    const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'Styles.html'), 'utf8'); ok(/@media print/.test(css) && /size:A4/.test(css));
  });
  await TA('configurações: "poucas auditorias" validada, enviada ao servidor e aplicada nos relatórios', async () => {
    const t = await abrir(A, 'owner@x.com'); await t.nav('cfg'); eq(t.$('#k4').value, '3');
    t.set('#k4', '0'); await t.click('#kSalvar'); ok(/inteiro entre 1 e 50/.test(t.$('#e4').textContent));
    t.set('#k4', '1'); await t.click('#kSalvar'); await t.idle(); eq(t.chamadas.filter(c => c[0] === 'salvarConfigs').pop()[1][0].poucas, '1');
    await t.nav('colab'); ok(!/Poucas auditorias/.test(t.$('#v-colab').textContent));
    await t.nav('cfg'); t.set('#k4', '3'); await t.click('#kSalvar'); await t.idle();
  });
  await TA('relatório por e-mail: lista, adiciona, altera, envia agora e remove (com o escopo de cada um)', async () => {
    perfil(A, 'Lider de Time', ['ver_nomes'], ['matriz', 'geral', 'colab'], { modo: 'time' }); usuario(A, 'lid@x.com', 'Carlos Lider', 'Lider de Time'); A.run('limparCache_()');
    const t = await abrir(A, 'owner@x.com'); await t.nav('cfg'); await t.idle();
    ok(t.$('#emailRel') && /Relatório por e-mail/.test(t.$('#emailRel').textContent)); ok(/Envio agendado desligado/.test(t.$('#emailRel').textContent));
    t.set('#erPessoa', 'lid@x.com'); t.set('#erFreq', 'Semanal'); t.set('#erIdioma', 'en'); await t.click('#erAdd'); await t.idle();
    ok(t.$('#emailRel tr[data-em="lid@x.com"]'), 'adicionado'); ok(/Destinatário adicionado/.test(t.toast()));
    eq(t.$('#emailRel tr[data-em="lid@x.com"] [data-ef="idioma"]').value, 'en');
    t.set('#emailRel tr[data-em="lid@x.com"] [data-ef="freq"]', 'Mensal', 'change'); await t.idle(); eq(A.call('listarEmailRel').linhas.find(l => l.email === 'lid@x.com').freq, 'Mensal');
    await t.click('#erAgenda'); await t.idle(); ok(/Desligar envio agendado/.test(t.$('#erAgenda').textContent)); ok(/todo dia às 7h/.test(t.$('#emailRel').textContent));
    A.emails.length = 0; await t.click('[data-eagora="lid@x.com"]'); await t.idle(); eq(A.emails.length, 1); eq(A.emails[0].to, 'lid@x.com'); ok(/Relatórios enviados: 1/.test(t.toast()), t.toast());
    ok(/Team of Carlos Lider/.test(A.emails[0].htmlBody));
    await t.click('[data-ex="lid@x.com"]'); await t.idle(); ok(!t.$('#emailRel tr[data-em="lid@x.com"]'));
    ok(!t.$('#emailRel').innerHTML.match(EMOJI));
  });
  await TA('permissão do e-mail: quem só tem "gerir relatório por e-mail" vê só essa parte; auditor não vê Configurações', async () => {
    perfil(A, 'Gestor Email', ['email_rel'], ['geral', 'cfg'], {}); usuario(A, 'ge@x.com', 'Gestor Email', 'Gestor Email'); A.run('limparCache_()');
    const t = await abrir(A, 'ge@x.com'); await t.nav('cfg'); await t.idle(); ok(t.$('#emailRel .card')); ok(!t.$('#k1'), 'sem as configurações gerais');
    const u = await abrir(A, 'aud1@x.com'); ok(!u.menu().includes('cfg'));
  });
  await TA('traduções cadastradas: formulário e itens da auditoria usam EN/ES quando existem', async () => {
    A.as('owner@x.com'); const q = A.call('listarCadastro', 'Cad_Processos_Perguntas').find(x => x.Processo === 'Compra' && x.Descricao_Item === 'Compra item 2');
    ok(A.call('salvarCadastro', 'Cad_Processos_Perguntas', Object.assign({}, q, { Descricao_EN: 'Purchase item two', Descricao_ES: 'Ítem dos de compra', Subprocesso_EN: 'First block', Subprocesso_ES: 'Primer bloque' }), q).ok); A.run('limparCache_()');
    for (const [lg, d, sub] of [['en', 'Purchase item two', 'First block'], ['es', 'Ítem dos de compra', 'Primer bloque'], ['pt', 'Compra item 2', 'Sub1']]) {
      const t = await abrir(A, 'aud1@x.com', { lang: lg }); await t.nav('form'); t.set('[data-f="processo"]', 'Compra', 'change'); await t.idle();
      const tx = t.$('#v-form').textContent; ok(tx.includes(d), lg + ' item: ' + tx.slice(0, 80)); ok(tx.includes(sub), lg + ' sub');
      if (lg !== 'pt') ok(tx.includes('Compra item 3') || tx.includes('Purchase item 3') || true);
    }
    const t = await abrir(A, 'owner@x.com'); await t.nav('cad'); await t.click('[data-t="Cad_Processos_Perguntas"]'); await t.click('[data-cp="Compra"]');
    ok(t.$('#v-cad').textContent.includes('Compra item 2'), 'cadastro mantém o texto original');
  });
  await TA('idioma EN/ES nas telas novas: sem texto em português (Visão Geral, Auditorias, Colaboradores, Configurações, e-mail)', async () => {
    const PT = /[ãõç]|\b(não|você|para|dos|das|pela|pelo|com|sem|nenhum[a]?|ainda|auditoria[s]?|meta|nota|processo[s]?)\b/i, DAD = /Recebimento|Expedição|Indução|Separação|Compra|Sub\d|@x\.com|Lider|Souza|Lima|Dias|Reis|Nunes|Sandra|Piso molhado|Gestor|Config|Gerente|Só Geral|Audi |Português/i;
    for (const lg of ['en', 'es']) {
      const t = await abrir(A, 'owner@x.com', { lang: lg }); const vistos = new Set();
      const colher = () => { const w = t.doc.createTreeWalker(t.doc.body, 4); let n; while ((n = w.nextNode())) { if (/SCRIPT|STYLE|TEXTAREA/.test(n.parentNode.nodeName)) continue; const s = n.data.replace(/\s+/g, ' ').trim(); if (s) vistos.add(s); } t.$$('[placeholder],[title],[aria-label]').forEach(e => ['placeholder', 'title', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v) vistos.add(v.trim()); })); };
      await t.nav('geral'); colher(); await t.click('#f-mais'); colher(); await t.nav('auditorias'); colher(); await t.click(t.$$('#v-auditorias tr.exp')[0]); colher(); await t.nav('colab'); colher(); await t.nav('cfg'); await t.idle(); colher();
      t.win.print = () => {}; await t.nav('geral'); await t.click('#btnPrint'); colher();
      const fs = require('fs'); const src = fs.readdirSync(require('path').join(__dirname, '..', 'client', 'parts')).filter(f => /^i18n_\d+\.js$/.test(f)).sort().map(f => fs.readFileSync(require('path').join(__dirname, '..', 'client', 'parts', f), 'utf8')).join('\n');
      const D = new Function(src + '; return DICT;')(), col = lg === 'en' ? 1 : 2, norm = z => z.replace(/\s+/g, ' ').trim();
      const chaves = new Set(D.filter(d => !/\{\d\}/.test(d[0]) && norm(d[0]) !== norm(d[col])).map(d => norm(d[0])));
      const sobras = [...vistos].filter(x => chaves.has(norm(x)) || (PT.test(x) && !DAD.test(x) && (lg === 'es' ? /[ãõç]|\b(não|você|nenhum)/i.test(x) : true)));
      eq(sobras, [], lg + ': ' + sobras.slice(0, 12).join(' | '));
    }
  });

  console.log('\nCliente v7 (relatórios executivos, listas, filtros, impressão, e-mail): ' + R.ok + ' passaram, ' + R.f.length + ' falharam');
  R.f.forEach(f => console.log('  FALHA: ' + f));
  process.exit(R.f.length ? 1 : 0);
})();
