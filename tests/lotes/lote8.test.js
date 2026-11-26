/* Lote 8 (pedido do usuário): itens conformes e não conformes na tela "Meus feedbacks" e
   quantidade de auditorias do feedback obrigatório configurável. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { criarAmbiente, teste, eq, lanca, resumo } = require('./harness');

const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const det = (itens) => JSON.stringify(itens.map((x, i) => ({ k: i + 2, id: 'S' + i, desc: x[0], critico: !!x[2], ok: x[1] })));

function base() {
  const env = criarAmbiente();
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '']]);
  env.linhas('Cad_Pessoas', [env.linha('Cad_Pessoas', { Nome: 'Bia', Cargo: 'Colaborador', Turno: 'T1', Status_Ativo: 'Sim', Lider: 'Ana' })]);
  return env;
}
function auditoria(env, id, d, pct, json) {
  env.linhas('Auditorias_Historico', [env.linha('Auditorias_Historico', { ID_Auditoria: id, Timestamp: d + ' 10:00:00', Processo: 'Expedição', Colaborador: 'Bia', Lider: 'Ana', Turno: 'T1', Responsavel_Auditoria: 'Admin', Pontuacao_Pct: pct, Status_Final: 'Inconforme', Json_Detalhes_Respostas: json, Auditor_Email: 'aud@x.com' })]);
}
function pendencia(env, ids, ini, fim) {
  env.linhas('Feedback_Pendencias', [env.linha('Feedback_Pendencias', { ID_Pend: 'FBK-1', Colaborador: 'Bia', Time_Snap: 'Ana', Turno_Snap: 'T1', Janela_Ini: ini, Janela_Fim: fim, Qtd: ids.length, IDs_Auditorias: ids.join('|'), Nota_Corte: 90, Status: 'Designada', Designado_Email: 'admin@x.com', Designado_Nome: 'Admin', Designado_Por: 'sl@x.com', Designado_Em: dia(1) + ' 10:00:00', Prazo: dia(-5) })]);
}

console.log('Meus feedbacks: itens conformes e não conformes de cada auditoria');
teste('cada auditoria traz os itens não conformes e os conformes (N/A fica de fora)', () => {
  const env = base();
  auditoria(env, 'AUD-1', dia(3), 50, det([['Doca limpa', false, true], ['Etiqueta conferida', true], ['Lacre', null], ['Palete', false]]));
  pendencia(env, ['AUD-1'], dia(3), dia(3));
  const a = env.run('meusFeedbacks()')[0].auditorias[0];
  const so = (l) => l.map((x) => [x.desc, x.critico]);
  eq(so(a.nc), [['Doca limpa', true], ['Palete', false]]);
  eq(so(a.conf), [['Etiqueta conferida', false]]);
});
teste('item traduzido no cadastro chega com a tradução (en/es)', () => {
  const env = base();
  env.linhas('Cad_Processos_Perguntas', [env.linha('Cad_Processos_Perguntas', { Processo: 'Expedição', ID_Subprocesso: 'S0', Descricao_Item: 'Doca limpa', Requisito_Critico: 'Sim', Descricao_EN: 'Clean dock', Descricao_ES: 'Muelle limpio' })]);
  auditoria(env, 'AUD-1', dia(3), 50, det([['Doca limpa', false, true]]));
  pendencia(env, ['AUD-1'], dia(3), dia(3));
  const x = env.run('meusFeedbacks()')[0].auditorias[0].nc[0];
  eq([x.desc_en, x.desc_es], ['Clean dock', 'Muelle limpio']);
});
teste('nenhuma função é declarada duas vezes nos .gs (no Apps Script a última venceria em silêncio)', () => {
  const raiz = path.join(__dirname, '..', '..', 'src'), vistos = {}, dup = [];
  fs.readdirSync(raiz).filter((f) => f.endsWith('.gs')).forEach((f) => {
    for (const m of fs.readFileSync(path.join(raiz, f), 'utf8').matchAll(/^function\s+([\w$]+)/gm)) { if (vistos[m[1]]) dup.push(m[1] + ' (' + vistos[m[1]] + ', ' + f + ')'); else vistos[m[1]] = f; }
  });
  eq(dup, []);
});
teste('detalhe ilegível não quebra a tela: a auditoria aparece sem a lista de itens', () => {
  const env = base();
  auditoria(env, 'AUD-1', dia(3), 50, '{quebrado');
  pendencia(env, ['AUD-1'], dia(3), dia(3));
  const a = env.run('meusFeedbacks()')[0].auditorias[0];
  eq([a.proc, a.nc, a.conf], ['Expedição', null, null]);
});
// v10.9: quem auditou só vai para quem tem "ver_auditor". O designado aqui é o Admin, que tem a permissão por padrão;
// o designado sem a permissão (não vê) está em tests/server15.test.js.
teste('quem auditou só chega a quem dá o feedback com a permissão ver_auditor (Admin tem por padrão)', () => {
  const env = base();
  auditoria(env, 'AUD-1', dia(3), 50, det([['Doca limpa', false]]));
  pendencia(env, ['AUD-1'], dia(3), dia(3));
  eq(env.run('meusFeedbacks()')[0].auditorias[0].aud, 'aud@x.com');
});

console.log('Quantidade de auditorias do feedback obrigatório: configurável');
function duasRuins() {
  const env = base();
  auditoria(env, 'AUD-20261101000001-1', dia(2), 40, '[]');
  auditoria(env, 'AUD-20261101000002-2', dia(1), 50, '[]');
  return env;
}
teste('padrão continua 3: com 2 auditorias ruins não gera pendência', () => {
  const env = duasRuins();
  eq(env.run('gerarPendenciasFeedback_()'), 0);
});
teste('configurado para 2: com 2 auditorias ruins gera a pendência', () => {
  const env = duasRuins();
  env.linhas('Configuracoes', [['FEEDBACK_MIN_AUDITORIAS', 2]]);
  eq(env.run('gerarPendenciasFeedback_()'), 1);
  eq(env.abas.Feedback_Pendencias.linhas[1][7], 2, 'Qtd');
});
teste('valor inválido na planilha (0, fração, texto) volta ao padrão 3, nunca gera para todo mundo', () => {
  ['0', '2.5', 'abc', '-1'].forEach((v) => {
    const env = duasRuins();
    env.linhas('Configuracoes', [['FEEDBACK_MIN_AUDITORIAS', v]]);
    eq(env.run('fbMinimo_(config_())'), 3, 'valor ' + v);
    eq(env.run('gerarPendenciasFeedback_()'), 0, 'valor ' + v);
  });
});
const CFG = "{ dias: 7, corte: 70, media: 90, poucas: 3, fbMin: __v }";
teste('salvarConfigs grava a quantidade e o config_ devolve o novo valor', () => {
  const env = base();
  env.ctx.__v = '5';
  eq(env.run('salvarConfigs(' + CFG + ').ok'), true);
  eq(env.run('config_().FEEDBACK_MIN_AUDITORIAS'), 5);
});
teste('salvarConfigs recusa 0, 51, fração e texto, sem gravar nada', () => {
  ['0', '51', '2.5', 'x'].forEach((v) => {
    const env = base();
    env.ctx.__v = v;
    const r = env.run('salvarConfigs(' + CFG + ')');
    eq([r.ok, !!(r.erros && r.erros.fbMin)], [false, true], 'valor ' + v);
    eq(env.abas.Configuracoes.linhas.length, 1, 'nada gravado com ' + v);
  });
});
teste('cliente antigo (sem o campo) continua salvando e não muda a quantidade', () => {
  const env = base();
  env.linhas('Configuracoes', [['FEEDBACK_MIN_AUDITORIAS', 4]]);
  eq(env.run('salvarConfigs({ dias: 7, corte: 70, media: 90 }).ok'), true);
  eq(env.run('config_().FEEDBACK_MIN_AUDITORIAS'), 4);
});

console.log('Cliente');
const JS = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'JS_Client.html'), 'utf8');
function funcao(nome) {
  const i = JS.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('função ' + nome + ' não encontrada');
  let n = 0, j = JS.indexOf('{', i);
  for (; j < JS.length; j++) { if (JS[j] === '{') n++; else if (JS[j] === '}' && --n === 0) break; }
  return JS.slice(i, j + 1);
}
function render(p, lang) {
  const ctx = { LANG: lang || 'pt', esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), tr: (s) => s, tpl: (s, a) => s.replace(/\{(\d)\}/g, (_, i) => a[i]), fmtD: (d) => d, pc: (x) => x + '%' };
  vm.createContext(ctx);
  vm.runInContext(funcao('fbItens') + '\n' + funcao('fbAuditorias'), ctx);
  ctx.__p = p;
  return vm.runInContext('fbAuditorias(__p)', ctx);
}
teste('a tela lista os não conformes (com o crítico marcado em texto) e os conformes, escapando o HTML', () => {
  const h = render({ qtd: 1, corte: 90, auditorias: [{ data: '2026-11-20', proc: 'Expedição', pct: 50, nc: [{ desc: '<b>Doca</b>', critico: true }], conf: [{ desc: 'Etiqueta', critico: false }] }] });
  eq(h.indexOf('<b>Doca</b>'), -1, 'HTML não escapado');
  eq(h.indexOf('&lt;b&gt;Doca&lt;/b&gt;') > -1, true);
  eq(/Não conforme/.test(h) && /Conforme/.test(h) && /crítico/i.test(h), true, h);
});
teste('em inglês, usa a tradução do item quando existe', () => {
  const h = render({ qtd: 1, corte: 90, auditorias: [{ data: '2026-11-20', proc: 'Expedição', pct: 50, nc: [{ desc: 'Doca limpa', desc_en: 'Clean dock', critico: false }], conf: [] }] }, 'en');
  eq(h.indexOf('Clean dock') > -1 && h.indexOf('Doca limpa') < 0, true, h);
});
teste('Styles: a cor do título dos não conformes usa um token que existe', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'Styles.html'), 'utf8');
  eq(/\.fb-nc\{color:var\(--bad-t\)\}/.test(css) && /--bad-t\s*:/.test(css), true);
});
teste('auditoria sem itens (detalhe ilegível ou visão do Site Leader) mostra só a linha da auditoria', () => {
  const h = render({ qtd: 1, corte: 90, auditorias: [{ data: '2026-11-20', proc: 'Expedição', pct: 50 }] });
  eq(/Não conforme/.test(h), false);
  eq(h.indexOf('Expedição') > -1, true);
});
teste('configurações: campo da quantidade existe, é validado e vai para o servidor', () => {
  const cfg = funcao('loadCfgBase');
  eq(/id="k5"/.test(cfg) && /FEEDBACK_MIN_AUDITORIAS/.test(cfg), true, 'campo');
  eq(/fbMin:\s*v5/.test(cfg), true, 'envio');
  eq(/r\.erros\.fbMin/.test(cfg), true, 'erro do servidor');
});

resumo();
