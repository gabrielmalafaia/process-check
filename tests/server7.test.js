// Segurança: chamadores sem permissão, escalada de privilégio, injeção de fórmula e rascunho de terceiros.
const fs = require('fs');
const { T, eq, ok, fim } = require('./lib.js');
const { cenario } = require('./seed.js');
const A = cenario();
const src = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'Code.gs'), 'utf8');
const publicas = [...src.matchAll(/^function ([a-zA-Z0-9]+)\(/gm)].map(m => m[1]);
const livres = ['doGet', 'include', 'solicitarCadastro', 'bootstrap'];
const contagem = () => Object.keys(A.sheets).map(n => n + ':' + A.sheets[n].getLastRow()).join('|');
const tenta = (fn) => { try { const r = A.call(fn, {}, {}, {}); return (r && r.ok === false) ? 'recusado' : 'RETORNOU'; } catch (e) { return 'negado'; } };

['estranho@x.com', 'off@x.com'].forEach(u => {
  T('chamador ' + u + ' (sem cadastro ativo): nenhuma função pública devolve dado nem altera planilha', () => {
    A.as(u); const antes = contagem(); const falhas = [];
    publicas.filter(f => livres.indexOf(f) < 0 && f !== 'setupPlanilha' && f !== 'diagnostico' && !/^migrar/.test(f)).forEach(f => { const r = tenta(f); if (r === 'RETORNOU') falhas.push(f); });
    eq(falhas, [], 'funções que responderam: ' + falhas.join(','));
    eq(contagem(), antes, 'planilha alterada');
  });
});
T('chamador sem cadastro: bootstrap não entrega dados, só o estado de acesso', () => {
  A.as('estranho@x.com'); const b = A.call('bootstrap'); eq(b.user.ok, false); ok(!b.db && !b.config);
});
T('manutenção (setup/migrar/diagnóstico) é negada a quem não é Admin, com a planilha já em uso', () => {
  A.as('aud1@x.com'); ['setupPlanilha', 'diagnostico', 'migrarV6', 'migrarV7'].forEach(f => { if (publicas.indexOf(f) < 0) return; let neg = false; try { A.call(f); } catch (e) { neg = true; } ok(neg, f + ' executou para um Auditor'); });
});
T('Auditor não chama funções de gestão (perfis, usuários, cadastros, configurações, metas, e-mail)', () => {
  A.as('aud1@x.com');
  ['salvarPerfil', 'excluirPerfil', 'salvarUsuario', 'excluirUsuario', 'listarAcessos', 'salvarConfigs', 'salvarCadastro', 'excluirCadastro', 'salvarMeta', 'listarSolicitacoes', 'recusarSolicitacao', 'enviarRelatorioAgora', 'salvarEmailRel', 'alternarAgendamentoRel', 'relatorio'].forEach(f => eq(tenta(f) !== 'RETORNOU', true, f));
});
T('escalada: Analista não consegue criar perfil mais forte nem se promover a Admin', () => {
  A.as('ana@x.com');
  let r; try { r = A.call('salvarPerfil', { nome: 'Super', desc: 'x', perms: ['perfis', 'usuarios', 'config', 'cad_pessoas'], telas: ['acessos', 'cfg'], escopo: { modo: 'todos', processos: [], turnos: [] } }, true); } catch (e) { r = { ok: false }; }
  eq(!!r.ok, false, 'Analista criou perfil com permissões acima das dele');
  let u; try { u = A.call('salvarUsuario', { Email_Google: 'ana@x.com', Nome: 'Ana Analista', Perfil: 'Admin', Status_Ativo: 'Sim', _row: 0 }, null); } catch (e) { u = { ok: false }; }
  eq(!!u.ok, false, 'Analista virou Admin');
  A.as('owner@x.com'); eq(A.ctx.lerAba_('Cad_Usuarios').find(x => x.Email_Google === 'ana@x.com').Perfil, 'Analista');
});
T('injeção de fórmula: texto que começa com = + - @ é neutralizado ao gravar em cadastro e observação', () => {
  A.as('owner@x.com');
  const r = A.call('salvarCadastro', 'Cad_Pessoas', { _row: 0, Nome: '=HYPERLINK("http://x","a")', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Carlos Lider' }, null);
  const p = A.ctx.lerAba_('Cad_Pessoas').find(x => /HYPERLINK/.test(x.Nome)); ok(!p || !/^=/.test(p.Nome), 'fórmula gravada crua');
  const a = A.audit('aud1@x.com', 'Recebimento', { conf: 10, obs: '=1+1', f: { doca: '36', colaboradores: ['Ana Souza'] } });
  const h = A.hist(); const linha = h.d[h.d.length - 1]; ok(!/^=/.test(String(linha[10])), 'observação gravada como fórmula: ' + linha[10]); ok(a.ok);
});
T('rascunho: um auditor não lê o rascunho de outro (mesma doca e processo)', () => {
  A.as('aud1@x.com'); const s = A.call('salvarRascunho', { processo: 'Recebimento', chave: '36', estado: { obs: 'segredo do aud1' } }); ok(s);
  A.as('aud2@x.com'); const r = A.call('getRascunho', 'Recebimento', '36'); ok(!r || JSON.stringify(r).indexOf('segredo') < 0, 'aud2 leu o rascunho do aud1');
});
T('auditoria forjada: respostas com chaves de outro processo ou processo sem permissão são recusadas', () => {
  A.as('owner@x.com');
  A.call('salvarPerfil', { nome: 'SoRecebimento', desc: 't', perms: ['auditar'], telas: ['matriz', 'form'], escopo: { modo: 'proprias', processos: ['Recebimento'], turnos: [] } }, true);
  A.ctx.anexar_('Cad_Usuarios', ['rec@x.com', 'Rec Um', 'SoRecebimento', 'Sim']); A.run('limparCache_()');
  const r = A.audit('rec@x.com', 'Expedição', { conf: 10, f: { doca: '01', colaboradores: ['Ana Souza'] } }); eq(r.ok, false);
  const k = A.audit('rec@x.com', 'Recebimento', { conf: 10, f: { doca: '36', colaboradores: ['Ana Souza'] } }); eq(k.ok, true);
  const f = A.call('salvarAuditoria', { processo: 'Recebimento', doca: '36', colaboradores: ['Ana Souza'], respostas: [{ k: 99999, ok: true }], observacoes: '' }); eq(f.ok, false);
});
T('relatório: período absurdo e filtros inválidos são recusados (proteção contra abuso de cota)', () => {
  A.as('sl@x.com'); let m = ''; try { A.call('relatorio', 'geral', { de: '2000-01-01', ate: '2026-12-31' }, {}); } catch (e) { m = e.message; } ok(/Período máximo/.test(m), m);
  m = ''; try { A.call('relatorio', 'geral', A.F({ processo: 'X<script>' }), {}); } catch (e) { m = e.message; } ok(/inválido/.test(m), m);
});
T('e-mail do relatório: nomes e textos com HTML saem escapados', () => {
  A.as('owner@x.com'); A.ctx.anexar_('Cad_Pessoas', ['<b>X</b>', 'Líder', 'T1', 'Sim', '']); A.run('limparCache_()');
  const m = A.run("montarEmailRel_(acessoDe_('sl@x.com'),'pt',{de:'" + A.dia(-30) + "',ate:'" + A.hojeStr + "'})");
  const h = JSON.stringify(m); ok(h.indexOf('<b>X</b>') < 0 && h.indexOf('<script') < 0);
});
const fsx = require('fs');
T('configuração: sem escopo do Drive, sem DriveApp e página sem ALLOWALL (clickjacking)', () => {
  const m = JSON.parse(fsx.readFileSync(require('path').join(__dirname, '..', 'src', 'appsscript.json'), 'utf8'));
  ok(!m.oauthScopes.some(x => /drive/.test(x)), 'escopo do Drive ainda presente'); ok(!/DriveApp/.test(src), 'DriveApp ainda usado'); ok(!/ALLOWALL/.test(src), 'ALLOWALL ainda presente');
});
T('exportação é registrada no log uma vez por exportação (não a cada lote), com período e filtros', () => {
  A.as('sl@x.com'); const n0 = A.sheets.Log_Permissoes.getLastRow();
  A.call('relatorio', 'export', A.F({ processo: 'Recebimento' }), { offset: 0 }); A.call('relatorio', 'export', A.F({ processo: 'Recebimento' }), { offset: 500 });
  const log = A.sheets.Log_Permissoes; eq(log.getLastRow(), n0 + 1); const l = log.d[log.getLastRow() - 1]; ok(/Exporta/.test(l[2]) && /Período/.test(l[4]) && /processo=Recebimento/.test(l[4]) && /sl@x.com/.test(l[1]), JSON.stringify(l));
});
T('agendamento: sem identidade roda no máximo uma vez por hora; com outra pessoa é negado; dono roda', () => {
  A.as('aud1@x.com'); let m = ''; try { A.call('enviarRelatoriosAgendados'); } catch (e) { m = e.message; } eq(m, 'Acesso negado.');
  A.email = ''; A.efetivo = 'owner@x.com'; A.props = {};
  A.call('enviarRelatoriosAgendados'); m = ''; try { A.call('enviarRelatoriosAgendados'); } catch (e) { m = e.message; } eq(m, 'Acesso negado.', 'segunda chamada sem identidade na mesma hora');
  A.as('owner@x.com'); ok(A.call('enviarRelatoriosAgendados') !== undefined);
});
fim();
