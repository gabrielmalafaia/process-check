// Fase 0a: rede de segurança do comportamento atual (golden) + inventário das funções públicas.
// Não testa regra nova: congela o que cada perfil recebe hoje, para que as fases seguintes (Hub, log, processos)
// só possam mudar o resultado de forma deliberada. Para aceitar uma mudança intencional: GOLDEN_ATUALIZAR=1 node tests/server9.test.js
const fs = require('fs'), path = require('path');
const { T, eq, ok, fim } = require('./lib.js');
// Data fixa: o resultado depende do dia da semana (blocos semanais) e das datas do período; sem isso o teste mudava a cada dia.
const FIXA = Date.parse('2026-11-19T12:00:00Z'), DataReal = Date;
global.Date = class extends DataReal { constructor(...a) { if (a.length) super(...a); else super(FIXA); } static now() { return FIXA; } };
const { cenario } = require('./seed.js');
const A = cenario();
const hoje = A.hojeStr, DIA = 864e5;
const dnum = (s) => Math.round((Date.parse(s + 'T00:00:00Z') - Date.parse(hoje + 'T00:00:00Z')) / DIA);

// Datas viram deslocamento em dias a partir de hoje; IDs de auditoria viram marcador; listas de objetos ficam em ordem canônica.
function norm(v) {
  if (Array.isArray(v)) {
    const r = v.map(norm);
    return r.some((x) => x && typeof x === 'object') ? r.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : r;
  }
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = norm(v[k]); }); return o; }
  if (typeof v === 'string') {
    let m;
    if (/^AUD-\d{14}-\d+$/.test(v)) return 'AUD#';
    if ((m = /^(\d{4}-\d{2}-\d{2})( \d{2}:\d{2}:\d{2})?$/.exec(v))) return 'D' + dnum(m[1]) + (m[2] ? ' hh:mm:ss' : '');
    if ((m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v))) return 'dmy:' + dnum(m[3] + '-' + m[2] + '-' + m[1]);
  }
  return v;
}

const pessoas = { owner: 'owner@x.com', ana: 'ana@x.com', sl: 'sl@x.com', aud1: 'aud1@x.com' };
const atual = {};
Object.keys(pessoas).forEach((p) => {
  const snap = (nome, fn) => {
    A.as(pessoas[p]);
    let r; try { r = JSON.parse(JSON.stringify(fn())); } catch (e) { r = { __erro: e.message }; }
    atual[p + '|' + nome] = norm(r);
  };
  snap('bootstrap', () => A.ctx.bootstrap(false));
  ['Recebimento', 'Expedição', 'Indução', 'Separação'].forEach((pr) => snap('getMatriz:' + pr, () => A.ctx.getMatriz(pr)));
  ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'].forEach((t) => snap('rel:' + t, () => A.ctx.relatorio(t, A.F(), {})));
  snap('listarAcessos', () => A.ctx.listarAcessos());
  snap('minhasMetas', () => A.ctx.minhasMetas());
  snap('listarCadastro:Cad_Estrutura', () => A.ctx.listarCadastro('Cad_Estrutura'));
});

const arq = path.join(__dirname, 'golden', 'baseline.json');
if (process.env.GOLDEN_ATUALIZAR) fs.writeFileSync(arq, JSON.stringify(atual, null, 1));
const base = JSON.parse(fs.readFileSync(arq, 'utf8'));

T('golden: cobre os 4 perfis e todos os relatórios', () => { eq(Object.keys(base).length, 64); eq(Object.keys(atual).sort(), Object.keys(base).sort()); });
Object.keys(base).forEach((k) => T('golden: ' + k, () => eq(atual[k], base[k])));
T('golden: negações também são congeladas (ex.: Auditor sem relatório)', () => { ok(atual['aud1|rel:geral'].__erro, 'Auditor deveria continuar sem acesso ao relatório geral'); });

// Inventário: toda função pública do servidor é conhecida e exercitada por algum teste.
const INVENTARIO = ['passoNoturno', 'agendarPassoNoturno', 'migrarV10','listarMetasLider', 'salvarMetaLider', 'cancelarMetaLider', 'contarMetasNovas', 'minhasMetasLider', 'marcarMetasVistas', 'listarFeedbacks', 'designarFeedback', 'registrarFeedback', 'meusFeedbacks', 'marcarFeedbacksVistos', 'contarFeedbacks', 'verificarProvaFeedback', 'migrarV9', 'listarRegrasLider', 'salvarRegraLider', 'excluirRegraLider', 'migrarV8', 'ativarHubs', 'desativarHubs', 'definirHubAtivo', 'listarHubs', 'salvarHub', 'aceitarAviso', 'consultarLog', 'arquivarLog', 'agendarArquivoLog', 'ativarAvisoLog', 'pulso', 'listarOnline', 'importarModelo', 'importarPrevia', 'importarConfirmar', 'doGet', 'include', 'setupPlanilha', 'migrarV6', 'migrarV7', 'migrarV4', 'migrarV3', 'migrarV2', 'bootstrap', 'solicitarCadastro', 'listarSolicitacoes', 'contarPendentes', 'recusarSolicitacao', 'getRascunho', 'getRascunhoLider', 'salvarRascunho', 'descartarRascunho', 'salvarAuditoria', 'getMatriz', 'relatorio', 'minhasMetas', 'salvarMeta', 'excluirMeta', 'listarCadastro', 'salvarCadastro', 'excluirCadastro', 'moverCadastro', 'restaurarCadastro', 'salvarConfigs', 'listarEmailRel', 'salvarEmailRel', 'excluirEmailRel', 'alternarAgendamentoRel', 'enviarRelatorioAgora', 'enviarRelatoriosAgendados', 'listarAcessos', 'salvarUsuario', 'excluirUsuario', 'salvarPerfil', 'excluirPerfil', 'diagnostico'];
const dirSrc = path.join(__dirname, '..', 'src');
const codigo = fs.readdirSync(dirSrc).filter((f) => /\.gs$/.test(f)).map((f) => fs.readFileSync(path.join(dirSrc, f), 'utf8')).join('\n');
const publicas = (codigo.match(/^function [A-Za-z0-9]+\(/gm) || []).map((s) => s.replace(/^function |\($/g, ''));
T('inventário: nenhuma função pública nova sem decisão (adicione ao INVENTARIO e à matriz de acesso)', () => eq(publicas.slice().sort(), INVENTARIO.slice().sort()));
T('inventário: cada função pública é exercitada por algum teste', () => {
  // testes da raiz e os de tests/lotes (v10.1 em diante)
  const ler = (d) => fs.readdirSync(d).filter((f) => /\.test\.js$/.test(f) && f !== 'server9.test.js').map((f) => fs.readFileSync(path.join(d, f), 'utf8'));
  const testes = ler(__dirname).concat(ler(path.join(__dirname, 'lotes'))).join('\n');
  const sem = INVENTARIO.filter((n) => !['doGet', 'include'].includes(n) && !new RegExp('\\b' + n + '\\b').test(testes));
  eq(sem, []);
});
fim('Fase 0a (golden + inventário)');
