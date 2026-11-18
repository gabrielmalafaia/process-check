/**
 * Process Check - Auditoria de processos do hub
 * (c) 2026 Gabriel Malafaia (desenvolvimento) e Karina Ferreira (concepção dos processos e estrutura da auditoria).
 * Todos os direitos reservados. Versão 7.0
 */
/** Process Check - Servidor (Google Apps Script) - v7
 *
 * Regras de arquitetura:
 *  - Toda função PÚBLICA (sem "_" no fim) pode ser chamada pelo navegador; por isso cada uma valida o acesso no servidor.
 *  - Funções terminadas em "_" são internas (o navegador não as enxerga).
 *  - PORTÃO ÚNICO DE DADOS: todo relatório lê auditorias somente por auditorias_(), que aplica o escopo do perfil
 *    (processos, turnos, equipe, só as próprias) antes de qualquer cálculo.
 *  - Publicar como: Executar como "Eu (dono)" e acesso "Qualquer pessoa da organização". A planilha NÃO deve ser compartilhada
 *    com os usuários (senão eles abrem a planilha e burlam as restrições). Veja a aba Acessos > Segurança.
 */
const PROCESSOS = ['Recebimento', 'Indução', 'Separação', 'Sorting', 'Compra', 'Expedição'];
/** Tipo de unidade auditada por processo. '' = sem doca/cluster (Indução: auditada por colaborador, agrupada por líder). */
const TIPO_PROC = { 'Recebimento': 'Doca', 'Indução': '', 'Separação': 'Cluster', 'Sorting': 'Cluster', 'Compra': 'Cluster', 'Expedição': 'Doca' };
const TURNOS = ['T1', 'T2', 'T3'];
const RASCUNHO_DIAS = 3;
const MAX_COLAB = 10;
const PAGINA = 50;
const EXPORT_LOTE = 5000;
const LEGADO_MAX = 8000;
const MAX_PERIODO_DIAS = 400;
/** Identidade visual de docas e clusters: guardada em Cad_Estrutura.Cor_Simbolo como "Cor/Símbolo" (ex.: Azul/Triângulo). */
const CORES = ['Azul', 'Verde', 'Vermelho', 'Laranja', 'Amarelo', 'Roxo', 'Rosa', 'Marrom', 'Preto', 'Branco', 'Cinza'];
const SIMBOLOS = ['Triângulo', 'Bolinha', 'Quadrado', 'Losango', 'Estrela', 'Cruz', 'Hexágono'];
const ALIAS_SIMBOLO = { circulo: 'Bolinha', bola: 'Bolinha', retangulo: 'Quadrado' };
const CACHE_SEG = 120;
const ABAS = {
  Auditorias_Historico: ['ID_Auditoria', 'Timestamp', 'Processo', 'Doca_Cluster', 'Colaborador', 'Lider', 'Turno', 'Responsavel_Auditoria', 'Pontuacao_Pct', 'Status_Final', 'Observacoes', 'Json_Detalhes_Respostas', 'Auditor_Email', 'Itens_NC', 'Critico_NC'],
  Auditorias_Rascunho: ['ID_Rascunho', 'Timestamp_Inicio', 'Auditor_Email', 'Processo', 'Doca_Cluster', 'Json_Respostas_Parciais'],
  Auditorias_Colaboradores: ['ID_Auditoria', 'Colaborador', 'Lider', 'Turno'],
  Cad_Usuarios: ['Email_Google', 'Nome', 'Perfil', 'Status_Ativo'],
  Cad_Perfis: ['Perfil', 'Descricao', 'Permissoes', 'Telas', 'Escopo', 'Sistema'],
  Cad_Estrutura: ['Tipo', 'Identificador', 'Cor_Simbolo', 'Lider_Padrao', 'Turno_Padrao'],
  Cad_Pessoas: ['Nome', 'Cargo', 'Turno', 'Status_Ativo', 'Lider'],
  Cad_Processos_Perguntas: ['Processo', 'ID_Subprocesso', 'Descricao_Item', 'Requisito_Critico', 'Subprocesso_EN', 'Subprocesso_ES', 'Descricao_EN', 'Descricao_ES'],
  Metas: ['ID_Meta', 'Tipo_Alvo', 'Alvo', 'Quantidade', 'Processos', 'Inicio', 'Fim', 'Descricao', 'Criada_Por', 'Criada_Em', 'Ativa'],
  Log_Permissoes: ['Timestamp', 'Responsavel', 'Acao', 'Alvo', 'Detalhe'],
  Cad_Solicitacoes: ['ID', 'Email', 'Nome', 'Cargo', 'Data', 'Status', 'Decidido_Por', 'Decidido_Em', 'Perfil_Atribuido', 'Idioma'],
  Configuracoes: ['Parametro', 'Valor'],
  Cad_Relatorio_Email: ['Email', 'Frequencia', 'Idioma', 'Ativo', 'Ultimo_Envio']
};
/** Abas existentes que ganharam colunas ao final na v6.2/v7: o cabeçalho é completado sem tocar nos dados. */
const COLS_NOVAS = { Cad_Solicitacoes: 1, Cad_Processos_Perguntas: 1 };
const FREQS = ['Diario', 'Semanal', 'Mensal'];
/** Colunas (1 = primeira) que são sempre TEXTO. Sem isso o Sheets converte "36" em número e "01" em 1 (perde o zero). */
const TEXTO_COLS = {
  Cad_Usuarios: [1, 2, 3, 4], Cad_Perfis: [1, 2, 3, 4, 5, 6], Cad_Estrutura: [1, 2, 3, 4, 5], Cad_Pessoas: [1, 2, 3, 4, 5], Cad_Processos_Perguntas: [1, 2, 3, 4, 5, 6, 7, 8],
  Auditorias_Historico: [4, 5, 6, 7, 13, 14, 15], Auditorias_Rascunho: [3, 4, 5], Auditorias_Colaboradores: [1, 2, 3, 4],
  Metas: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11], Log_Permissoes: [1, 2, 3, 4, 5], Cad_Solicitacoes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Cad_Relatorio_Email: [1, 2, 3, 4, 5]
};
const COLUNAS_NUMERICAS = { Pontuacao_Pct: 1, Valor: 1, Quantidade: 1 };
const STATUS_TXT = { vermelho: 'Em Inconformidade', observacao: 'Em Observação', verde: 'Completo e em Conformidade' };
const CADASTROS = ['Cad_Estrutura', 'Cad_Pessoas', 'Cad_Processos_Perguntas'];
const PERM_CAD = { Cad_Estrutura: 'cad_estrutura', Cad_Pessoas: 'cad_pessoas', Cad_Processos_Perguntas: 'cad_perguntas' };
const CACHE_ABAS = ['Cad_Usuarios', 'Cad_Perfis', 'Cad_Estrutura', 'Cad_Pessoas', 'Cad_Processos_Perguntas', 'Configuracoes'];
const OBRIG = {
  Cad_Estrutura: ['Tipo', 'Identificador', 'Cor_Simbolo'],
  Cad_Pessoas: ['Nome', 'Cargo', 'Turno', 'Status_Ativo'],
  Cad_Processos_Perguntas: ['Processo', 'ID_Subprocesso', 'Descricao_Item', 'Requisito_Critico']
};
const ENUMS = {
  Status_Ativo: ['Sim', 'Não'], Tipo: ['Doca', 'Cluster'], Turno: TURNOS, Turno_Padrao: TURNOS,
  Cargo: ['Líder', 'Colaborador'], Requisito_Critico: ['Sim', 'Não'], Processo: PROCESSOS
};
const MAXLEN = { Descricao_Item: 300, ID_Subprocesso: 120, Descricao_EN: 300, Descricao_ES: 300, Subprocesso_EN: 120, Subprocesso_ES: 120 };

/* ---------- catálogo de telas, permissões e perfis ---------- */
const TELAS = [
  { id: 'matriz', nome: 'Matriz de Processos' }, { id: 'form', nome: 'Formulário de Auditoria' }, { id: 'minhas', nome: 'Minhas metas' },
  { id: 'geral', nome: 'Visão Geral' }, { id: 'auditorias', nome: 'Auditorias realizadas' }, { id: 'auditores', nome: 'Auditores e metas' },
  { id: 'proc', nome: 'Por processo' }, { id: 'doca', nome: 'Por doca e cluster' }, { id: 'colab', nome: 'Por colaborador e equipe' },
  { id: 'tend', nome: 'Tendência' }, { id: 'export', nome: 'Exportar' }, { id: 'cad', nome: 'Cadastros' }, { id: 'cfg', nome: 'Configurações' }, { id: 'acessos', nome: 'Acessos' }, { id: 'autorizar', nome: 'Autorizações' }
];
const PERMS = [
  { id: 'auditar', grupo: 'Auditorias', nome: 'Realizar auditorias', desc: 'Preencher, salvar rascunho e finalizar auditorias.' },
  { id: 'metas', grupo: 'Auditorias', nome: 'Criar e atribuir metas', desc: 'Definir metas de auditoria para pessoas ou perfis.' },
  { id: 'exportar', grupo: 'Dados', nome: 'Baixar dados em CSV', desc: 'Exportar o histórico de auditorias.' },
  { id: 'cad_estrutura', grupo: 'Cadastros', nome: 'Gerir docas e clusters', desc: 'Criar, editar e excluir docas e clusters.' },
  { id: 'cad_pessoas', grupo: 'Cadastros', nome: 'Gerir líderes e colaboradores', desc: 'Criar, editar e excluir pessoas.' },
  { id: 'cad_perguntas', grupo: 'Cadastros', nome: 'Gerir perguntas dos processos', desc: 'Criar, editar e excluir itens do formulário.' },
  { id: 'config', grupo: 'Sistema', nome: 'Alterar configurações', desc: 'Vida útil, notas de corte/média e regras por processo.' },
  { id: 'usuarios', grupo: 'Acessos', nome: 'Cadastrar usuários e atribuir perfis', desc: 'Só é possível atribuir perfis com permissões iguais ou menores que as suas.' },
  { id: 'perfis', grupo: 'Acessos', nome: 'Criar e editar perfis', desc: 'Definir permissões, telas e dados visíveis de cada perfil.' },
  { id: 'ver_nomes', grupo: 'Dados', nome: 'Ver nomes de colaboradores nos relatórios', desc: 'Sem esta permissão os relatórios mostram só equipes, processos e totais, sem nomes de colaboradores.' },
  { id: 'email_rel', grupo: 'Sistema', nome: 'Gerir o relatório por e-mail', desc: 'Escolher quem recebe o relatório por e-mail e a frequência. Cada pessoa recebe só os dados do próprio perfil.' },
  { id: 'autorizar', grupo: 'Acessos', nome: 'Autorizar novos cadastros', desc: 'Ver e recusar solicitações de cadastro; aprovar leva ao cadastro de usuário.' }
];
const PERM_IDS = PERMS.map(function (p) { return p.id; });
const TELA_IDS = TELAS.map(function (t) { return t.id; });
/** Tela só funciona com pelo menos uma destas permissões. */
const REQ_TELA = { form: ['auditar'], minhas: ['auditar'], export: ['exportar'], cfg: ['config', 'email_rel'], cad: ['cad_estrutura', 'cad_pessoas', 'cad_perguntas'], acessos: ['usuarios', 'perfis'], autorizar: ['autorizar'] };
/** Permissão que obriga a tela correspondente (adicionada automaticamente ao salvar um perfil). */
const PERM_TELA = { auditar: 'form', exportar: 'export', config: 'cfg', email_rel: 'cfg', cad_estrutura: 'cad', cad_pessoas: 'cad', cad_perguntas: 'cad', usuarios: 'acessos', perfis: 'acessos', autorizar: 'autorizar' };
const MODOS = ['todos', 'time', 'proprias'];
const REL_TELA = { geral: 'geral', auditorias: 'auditorias', auditores: 'auditores', proc: 'proc', doca: 'doca', colab: 'colab', tend: 'tend', export: 'export' };

function perfisBase_() {
  const todos = { modo: 'todos', processos: [], turnos: [] };
  const semPerfis = PERM_IDS.filter(function (p) { return p !== 'perfis' && p !== 'autorizar'; });
  const telasSem = TELA_IDS.filter(function (t) { return t !== 'autorizar'; });
  return {
    'Admin': { nome: 'Admin', desc: 'Acesso total. Perfil protegido: não pode ser editado nem excluído.', perms: PERM_IDS.slice(), telas: TELA_IDS.slice(), escopo: todos, sistema: true },
    'Analista': { nome: 'Analista', desc: 'Acesso total, exceto criar e editar perfis.', perms: semPerfis.slice(), telas: telasSem.slice(), escopo: todos, sistema: true },
    'Site Leader': { nome: 'Site Leader', desc: 'Acesso total, exceto criar e editar perfis.', perms: semPerfis.slice(), telas: telasSem.slice(), escopo: todos, sistema: true },
    'Auditor': { nome: 'Auditor', desc: 'Realiza auditorias, vê a Matriz e as próprias metas.', perms: ['auditar'], telas: ['matriz', 'form', 'minhas'], escopo: todos, sistema: true }
  };
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Process Check')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function include(nome) {
  if (['Styles', 'JS_Client'].indexOf(nome) < 0) throw new Error('Arquivo inválido.');
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/* ---------- manutenção (rodar no editor do Apps Script) ---------- */
/** Só roda no editor pelo dono quando a planilha ainda não tem usuários, ou por um Admin. Evita que o navegador dispare rotinas de manutenção. */
function manutencao_() {
  const ss = SpreadsheetApp.getActive(), us = ss.getSheetByName('Cad_Usuarios');
  if (!us || us.getLastRow() < 2) return true;
  const a = acesso_();
  if (!(a.ok && a.perfil === 'Admin')) throw new Error('Acesso negado.');
  return true;
}
/** Execute UMA vez no editor: cria as abas, parâmetros padrão, perfis padrão e o dono como Admin. Pode ser executado de novo sem perda. */
function setupPlanilha() {
  manutencao_();
  const ss = SpreadsheetApp.getActive();
  Object.keys(ABAS).forEach(function (n) { garantirAba_(n); });
  Object.keys(TEXTO_COLS).forEach(function (n) { formatarTexto_(ss.getSheetByName(n), n); });
  const cfg = ss.getSheetByName('Configuracoes');
  if (cfg.getLastRow() < 2) { cfg.appendRow(['DIAS_VIDA_UTIL_AUDITORIA', 7]); cfg.appendRow(['NOTA_CORTE_PCT', 70]); cfg.appendRow(['NOTA_MEDIA_PCT', 90]); }
  semearPerfis_();
  const us = ss.getSheetByName('Cad_Usuarios');
  if (us.getLastRow() < 2) anexar_('Cad_Usuarios', [Session.getEffectiveUser().getEmail(), 'Administrador', 'Admin', 'Sim']);
  limparCache_();
  return 'Planilha pronta.';
}
/** Atualização da v5 para a v6: acrescenta colunas/abas novas e cadastra os 4 perfis padrão. Não apaga nem altera auditorias existentes. */
function migrarV6() {
  manutencao_();
  const ss = SpreadsheetApp.getActive(), rel = {};
  Object.keys(ABAS).forEach(function (n) { garantirAba_(n); });
  prepararHist_();
  semearPerfis_();
  Object.keys(TEXTO_COLS).forEach(function (n) { formatarTexto_(ss.getSheetByName(n), n); });
  rel.itensNC = 'novas auditorias gravam a coluna Itens_NC; as antigas continuam lendo o JSON';
  limparCache_();
  return rel;
}
/** Atualização da v6.x para a v7 (idempotente): colunas de tradução, aba do relatório por e-mail e a permissão "ver nomes" nos perfis que já viam relatórios. Não altera auditorias. */
function migrarV7() {
  manutencao_();
  const rel = migrarV6(), tn = {}, telasRel = ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'];
  const s = aba_('Cad_Perfis');
  let n = 0;
  lerDireto_('Cad_Perfis').forEach(function (r) {
    const nome = String(r.Perfil || '').trim();
    if (!nome || nome === 'Admin') return;
    const perms = listaValida_(r.Permissoes, PERM_IDS), telas = listaValida_(r.Telas, TELA_IDS);
    if (perms.indexOf('ver_nomes') < 0 && telas.some(function (t) { return telasRel.indexOf(t) > -1; })) {
      s.getRange(r._row, 3).setNumberFormat('@').setValue(perms.concat(['ver_nomes']).join(','));
      n++;
    }
  });
  tn.perfisAtualizados = n;
  tn.traducoes = 'colunas Subprocesso_EN/ES e Descricao_EN/ES disponíveis em Cad_Processos_Perguntas';
  limparCache_();
  rel.v7 = tn;
  return rel;
}
function semearPerfis_() {
  const base = perfisBase_(), s = aba_('Cad_Perfis'), tem = {};
  lerDireto_('Cad_Perfis').forEach(function (r) { tem[r.Perfil] = 1; });
  Object.keys(base).forEach(function (n) { if (!tem[n]) anexar_('Cad_Perfis', serializarPerfil_(base[n])); });
  return s;
}
function garantirAba_(n) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(n);
  if (!s) s = ss.insertSheet(n);
  if (s.getLastRow() === 0) {
    s.appendRow(ABAS[n]);
    s.getRange(1, 1, 1, ABAS[n].length).setFontWeight('bold').setBackground('#EE4D2D').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  } else if (COLS_NOVAS[n]) {
    /* planilhas anteriores têm menos colunas: acrescenta os cabeçalhos que faltam, sem tocar nos dados */
    const tem = s.getLastColumn();
    if (tem < ABAS[n].length) {
      if (s.getMaxColumns() < ABAS[n].length) s.insertColumnsAfter(s.getMaxColumns(), ABAS[n].length - s.getMaxColumns());
      for (let i = tem; i < ABAS[n].length; i++) s.getRange(1, i + 1).setValue(ABAS[n][i]).setFontWeight('bold');
    }
  }
  return s;
}
function formatarTexto_(s, nome) {
  (TEXTO_COLS[nome] || []).forEach(function (c) { if (c <= s.getMaxColumns()) s.getRange(2, c, Math.max(s.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
}
/** Garante as colunas novas (Auditor_Email e Itens_NC) no histórico de planilhas criadas em versões antigas. */
function prepararHist_() {
  const s = garantirAba_('Auditorias_Historico'), n = ABAS.Auditorias_Historico.length;
  if (s.getMaxColumns() < n) s.insertColumnsAfter(s.getMaxColumns(), n - s.getMaxColumns());
  const h = s.getRange(1, 1, 1, n).getValues()[0];
  let mudou = false;
  ABAS.Auditorias_Historico.forEach(function (c, i) { if (h[i] !== c) { h[i] = c; mudou = true; } });
  if (mudou) s.getRange(1, 1, 1, n).setValues([h]).setFontWeight('bold').setBackground('#EE4D2D').setFontColor('#FFFFFF');
  return s;
}
/**
 * Execute UMA vez ao atualizar para a v4 (corrige "Doca não cadastrada" em nomes numéricos e cria a nota média):
 * 1) grava como TEXTO as colunas de identificação e converte os números já gravados;
 * 2) cria NOTA_MEDIA_PCT. A nota de corte antiga vira a nota média e o novo corte padrão é 70.
 */
function migrarV4() {
  manutencao_();
  const ss = SpreadsheetApp.getActive(), rel = { convertidos: {}, notas: '' };
  ['Cad_Usuarios', 'Cad_Estrutura', 'Cad_Pessoas', 'Cad_Processos_Perguntas', 'Auditorias_Historico', 'Auditorias_Rascunho'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (!s) return;
    let conv = 0;
    TEXTO_COLS[n].forEach(function (c) {
      if (c > s.getMaxColumns()) return;
      if (s.getLastRow() >= 2) {
        const r = s.getRange(2, c, s.getLastRow() - 1, 1), v = r.getValues();
        v.forEach(function (l) { if (typeof l[0] === 'number') { l[0] = String(l[0]); conv++; } });
        r.setNumberFormat('@'); r.setValues(v);
      }
    });
    formatarTexto_(s, n);
    rel.convertidos[n] = conv;
  });
  const lido = {};
  lerDireto_('Configuracoes').forEach(function (r) { lido[r.Parametro] = r; });
  const cs = ss.getSheetByName('Configuracoes');
  if (!lido.NOTA_MEDIA_PCT) {
    const antigo = lido.NOTA_CORTE_PCT ? Number(lido.NOTA_CORTE_PCT.Valor) : 90;
    cs.appendRow(['NOTA_MEDIA_PCT', antigo]);
    if (lido.NOTA_CORTE_PCT) cs.getRange(lido.NOTA_CORTE_PCT._row, 2).setValue(70); else cs.appendRow(['NOTA_CORTE_PCT', 70]);
    rel.notas = 'Nota média = ' + antigo + ' e nota de corte = 70 (ajuste em Configurações).';
  } else rel.notas = 'Notas já configuradas.';
  limparCache_();
  return rel;
}
/** Execute UMA vez ao atualizar para a v3: padroniza Cor_Simbolo em Cad_Estrutura (ex.: "azul/triangulo" vira "Azul/Triângulo"). */
function migrarV3() {
  manutencao_();
  const s = aba_('Cad_Estrutura'), rel = { padronizados: 0, jaPadrao: 0, naoReconhecidos: [] };
  if (!s || s.getLastRow() < 2) return rel;
  const n = s.getLastRow() - 1, r = s.getRange(2, 3, n, 1), v = r.getValues(), ids = s.getRange(2, 2, n, 1).getValues();
  v.forEach(function (l, i) {
    const c = canonCS_(l[0]);
    if (!c) { rel.naoReconhecidos.push(String(ids[i][0]) + ' (' + l[0] + ')'); return; }
    if (c === l[0]) rel.jaPadrao++; else { l[0] = c; rel.padronizados++; }
  });
  r.setValues(v);
  limparCache_();
  return rel;
}
/** Execute UMA vez ao atualizar da v1 para a v2: adiciona a coluna Lider em Cad_Pessoas e renomeia "Separação para Indução" para "Separação". */
function migrarV2() {
  manutencao_();
  const ss = SpreadsheetApp.getActive(), rel = {};
  const p = ss.getSheetByName('Cad_Pessoas');
  if (p && p.getRange(1, 5, 1, 1).getValues()[0][0] !== 'Lider') {
    p.getRange(1, 5, 1, 1).setValues([['Lider']]).setFontWeight('bold').setBackground('#EE4D2D').setFontColor('#FFFFFF');
    rel.colunaLider = 'adicionada';
  }
  [['Auditorias_Historico', 3], ['Auditorias_Rascunho', 4], ['Cad_Processos_Perguntas', 1]].forEach(function (x) {
    const s = ss.getSheetByName(x[0]);
    if (!s || s.getLastRow() < 2) { rel[x[0]] = 0; return; }
    const r = s.getRange(2, x[1], s.getLastRow() - 1, 1), v = r.getValues();
    let n = 0;
    v.forEach(function (l) { if (l[0] === 'Separação para Indução') { l[0] = 'Separação'; n++; } });
    if (n) r.setValues(v);
    rel[x[0]] = n;
  });
  limparCache_();
  return rel;
}

/* ---------- utilitários ---------- */
function aba_(n) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(n) || (ABAS[n] ? garantirAba_(n) : null);
}
function fmt_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function agora_() { return fmt_(new Date()); }
function hoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function d_(s) { return new Date(String(s).replace(' ', 'T')); }
function tsStr_(x) { return x instanceof Date ? fmt_(x) : String(x == null ? '' : x); }
function semAcento_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function round1_(x) { return Math.round(x * 10) / 10; }
function addDias_(ymd, n) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function difDias_(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5); }
function segunda_(ymd) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
/** Devolve "Cor/Símbolo" no padrão do catálogo, ou '' se não for reconhecido. Aceita variações de acento e maiúsculas. */
function canonCS_(v) {
  const t = String(v == null ? '' : v).split(/[\/\-–·\s]+/).map(semAcento_).filter(Boolean);
  if (t.length !== 2) return '';
  const cor = function (x) { return CORES.find(function (c) { return semAcento_(c) === x; }); };
  const simb = function (x) { return SIMBOLOS.find(function (m) { return semAcento_(m) === x; }) || (Object.prototype.hasOwnProperty.call(ALIAS_SIMBOLO, x) ? ALIAS_SIMBOLO[x] : ''); };
  const a = cor(t[0]), b = simb(t[1]);
  if (a && b) return a + '/' + b;
  const c2 = cor(t[1]), s2 = simb(t[0]);
  return c2 && s2 ? c2 + '/' + s2 : '';
}
function vazio_(v) { return v === undefined || v === null || String(v).trim() === ''; }
function ativo_(x) { return String(x.Status_Ativo) !== 'Não'; }
/** Neutraliza injeção de fórmula: texto iniciado por = + - @ recebe um espaço na frente. */
function limpar_(v) {
  if (typeof v !== 'string') return v;
  v = v.trim();
  return /^[=+\-@\t\r]/.test(v) ? ' ' + v : v;
}
function comLock_(fn) {
  const l = LockService.getScriptLock();
  try { l.waitLock(15000); } catch (e) { throw new Error('Sistema ocupado. Tente novamente em instantes.'); }
  try { return fn(); } finally { l.releaseLock(); }
}
/** Anexa linhas formatando como texto as colunas de identificação (evita 36 virar número e 01 virar 1). */
function anexarLinhas_(aba, linhas) {
  const s = aba_(aba), r = s.getLastRow() + 1, n = linhas.length, w = linhas[0].length;
  if (r + n - 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + n - 1 - s.getMaxRows());
  (TEXTO_COLS[aba] || []).forEach(function (c) { if (c <= w) s.getRange(r, c, n, 1).setNumberFormat('@'); });
  s.getRange(r, 1, n, w).setValues(linhas);
  return r;
}
function anexar_(aba, linha) { return anexarLinhas_(aba, [linha]); }
/** Faixa da nota: abaixo do corte = vermelho; do corte até a média = observação (amarelo); média ou mais = verde. */
function faixa_(pct, cfg) { return pct < cfg.NOTA_CORTE_PCT ? 'vermelho' : (pct < cfg.NOTA_MEDIA_PCT ? 'observacao' : 'verde'); }
function lerDireto_(n) {
  const s = aba_(n);
  if (!s || s.getLastRow() < 1) return [];
  const v = s.getDataRange().getValues(), h = v.shift();
  return v.map(function (r, i) {
    const o = { _row: i + 2 };
    h.forEach(function (k, j) {
      const x = r[j];
      o[k] = x instanceof Date ? fmt_(x) : (typeof x === 'number' && !COLUNAS_NUMERICAS[k] ? String(x) : x);
    });
    return o;
  }).filter(function (o) { return h.some(function (k) { return o[k] !== '' && o[k] !== undefined; }); });
}
function lerAba_(n) {
  const usa = CACHE_ABAS.indexOf(n) > -1, c = CacheService.getScriptCache();
  if (usa) { const k = c.get('aba:' + n); if (k) return JSON.parse(k); }
  const dados = lerDireto_(n);
  if (usa) { try { c.put('aba:' + n, JSON.stringify(dados), CACHE_SEG); } catch (e) { /* grande demais: segue sem cache */ } }
  return dados;
}
function limparCache_() {
  const c = CacheService.getScriptCache();
  c.removeAll(CACHE_ABAS.map(function (n) { return 'aba:' + n; }).concat(['ult']));
  bumpHv_();
}
function hv_() { const c = CacheService.getScriptCache(); let v = c.get('hv'); if (!v) { v = String(Date.now()); c.put('hv', v, 21600); } return v; }
function bumpHv_() { CacheService.getScriptCache().put('hv', String(Date.now()) + String(Math.floor(Math.random() * 1000)), 21600); }
function hash_(s) {
  let h1 = 5381, h2 = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = ((h1 << 5) + h1 + c) | 0; h2 = (c + (h2 << 6) + (h2 << 16) - h2) | 0; }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length;
}
/** Resultado de relatório em cache (chave = versão do histórico + usuário/escopo + filtros). */
function comCache_(a, chaveObj, fn) {
  const c = CacheService.getScriptCache(), k = 'rel:' + hv_() + ':' + hash_(JSON.stringify([a.email, a.escopo, chaveObj]));
  const x = c.get(k);
  if (x) return JSON.parse(x);
  const r = fn();
  try { const j = JSON.stringify(r); if (j.length < 90000) c.put(k, j, 300); } catch (e) { /* sem cache */ }
  return r;
}
const NUM_KEYS = { DIAS_VIDA_UTIL_AUDITORIA: 1, NOTA_CORTE_PCT: 1, NOTA_MEDIA_PCT: 1, POUCAS_AUDITORIAS: 1 };
function config_() {
  const lido = {}, c = { DIAS_VIDA_UTIL_AUDITORIA: 7, NOTA_CORTE_PCT: 70, NOTA_MEDIA_PCT: 90, POUCAS_AUDITORIAS: 3, MULTI: {} };
  PROCESSOS.forEach(function (p) { c.MULTI[p] = p === 'Expedição'; });
  lerAba_('Configuracoes').forEach(function (r) {
    const k = String(r.Parametro || '').trim();
    if (NUM_KEYS[k]) { const n = Number(r.Valor); if (!isNaN(n) && String(r.Valor).trim() !== '') lido[k] = n; }
    else if (k.indexOf('MULTI_COLAB_') === 0) { const p = k.slice(12); if (PROCESSOS.indexOf(p) > -1) c.MULTI[p] = String(r.Valor).trim() === 'Sim'; }
  });
  Object.keys(lido).forEach(function (k) { c[k] = lido[k]; });
  // planilha das versões anteriores: o antigo "corte" (que valia como conforme) passa a ser a nota média
  if (lido.NOTA_MEDIA_PCT === undefined && lido.NOTA_CORTE_PCT !== undefined) { c.NOTA_MEDIA_PCT = lido.NOTA_CORTE_PCT; c.NOTA_CORTE_PCT = 70; }
  return c;
}
/** Chave do rascunho: doca/cluster, ou o colaborador na Indução (cada colaborador tem o seu rascunho). */
function chaveRascunho_(processo, doca, colab) { return TIPO_PROC[processo] ? doca : colab; }
function liderDoRascunho_(r) { try { return JSON.parse(r.Json_Respostas_Parciais).lider || ''; } catch (e) { return ''; } }
/** Valida o período (AAAA-MM-DD) e devolve as datas inicial e final. */
function periodo_(de, ate) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(String(de)) || !re.test(String(ate))) throw new Error('Informe as datas De e Até.');
  const a = new Date(de + 'T00:00:00Z'), b = new Date(ate + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b) || a.toISOString().slice(0, 10) !== de || b.toISOString().slice(0, 10) !== ate || a > b) throw new Error('Período inválido: a data inicial deve ser anterior à final.');
  return { a: a, b: b };
}
function restaAdmin_(usuarios) {
  return usuarios.some(function (u) { return u.Perfil === 'Admin' && String(u.Status_Ativo).trim().toLowerCase() === 'sim'; });
}

/* ---------- perfis, permissões e escopo ---------- */
function listaValida_(orig, validos) {
  const l = String(orig || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  const ok = l.filter(function (x) { return validos.indexOf(x) > -1; });
  return ok.length || !l.length ? ok : ['__nenhum__'];
}
function escopo_(o) {
  o = o || {};
  const arr = function (v, validos) {
    const l = (Array.isArray(v) ? v : []).map(String), ok = l.filter(function (x) { return validos.indexOf(x) > -1; });
    return ok.length || !l.length ? ok : ['__nenhum__']; // lista preenchida só com valores inválidos nunca vira "todos"
  };
  return { modo: MODOS.indexOf(o.modo) > -1 ? o.modo : 'proprias', processos: arr(o.processos, PROCESSOS), turnos: arr(o.turnos, TURNOS) };
}
function normalizarPerfil_(p) {
  const perms = PERM_IDS.filter(function (x) { return (p.perms || []).indexOf(x) > -1; });
  let telas = TELA_IDS.filter(function (x) { return (p.telas || []).indexOf(x) > -1; });
  perms.forEach(function (x) { const t = PERM_TELA[x]; if (t && telas.indexOf(t) < 0) telas.push(t); });
  telas = TELA_IDS.filter(function (t) {
    if (telas.indexOf(t) < 0) return false;
    const r = REQ_TELA[t];
    return !r || r.some(function (x) { return perms.indexOf(x) > -1; });
  });
  return { nome: p.nome, desc: p.desc || '', perms: perms, telas: telas, escopo: escopo_(p.escopo), sistema: !!p.sistema };
}
function serializarPerfil_(p) {
  return [p.nome, limpar_(p.desc || ''), p.perms.join(','), p.telas.join(','), JSON.stringify(p.escopo), p.sistema ? 'Sim' : 'Não'];
}
/** Todos os perfis (planilha + padrões). O Admin vem sempre do código: ninguém altera pela planilha. */
function perfis_() {
  const base = perfisBase_(), out = Object.create(null);
  lerAba_('Cad_Perfis').forEach(function (r) {
    const nome = String(r.Perfil || '').trim();
    if (!nome || nome === 'Admin') return;
    let esc;
    try { esc = JSON.parse(r.Escopo); } catch (e) { esc = null; }
    out[nome] = normalizarPerfil_({
      nome: nome, desc: r.Descricao, sistema: base[nome] ? true : String(r.Sistema) === 'Sim',
      perms: listaValida_(r.Permissoes, PERM_IDS), telas: listaValida_(r.Telas, TELA_IDS), escopo: esc
    });
    if (esc === null) out[nome].escopo = escopo_({ modo: 'proprias' });
  });
  Object.keys(base).forEach(function (n) { if (!out[n] || n === 'Admin') out[n] = normalizarPerfil_(base[n]); });
  return out;
}
/** O perfil A está contido no perfil B (permissões, telas e dados)? Base da regra "não dá para conceder o que você não tem". */
function contido_(a, b) {
  if (!a.perms.every(function (x) { return b.perms.indexOf(x) > -1; })) return false;
  if (!a.telas.every(function (x) { return b.telas.indexOf(x) > -1; })) return false;
  const ea = a.escopo, eb = b.escopo;
  if (eb.modo !== 'todos' && ea.modo !== eb.modo) return false;
  const sub = function (x, y) { return !y.length || (x.length > 0 && x.every(function (v) { return y.indexOf(v) > -1; })); };
  return sub(ea.processos, eb.processos) && sub(ea.turnos, eb.turnos);
}
/** Identifica o usuário. Sem e-mail (fora do domínio) ou não cadastrado/inativo: bloqueado. */
function acesso_() { return acessoDe_(Session.getActiveUser().getEmail()); }
/** Mesmo cálculo de acesso para qualquer e-mail (o relatório por e-mail usa o perfil do DESTINATÁRIO, nunca o de quem dispara). */
/** Marca o usuário (para a tela Acessos): editável por quem lista e, se o perfil é "time", se o nome bate com um líder ativo do cadastro de pessoas. */
function marcarUsuario_(u, pf, a, lids) {
  u.editavel = !!pf[u.Perfil] && contido_(pf[u.Perfil], a.pf) && String(u.Email_Google).trim().toLowerCase() !== a.email;
  const p = pf[String(u.Perfil).trim()];
  u.semLider = !!(p && p.escopo.modo === 'time' && lids.indexOf(semAcento_(u.Nome)) < 0);
  return u;
}
function lideresAtivos_() { return lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return semAcento_(p.Nome); }); }
function acessoDe_(emailBruto) {
  const email = (emailBruto || '').trim().toLowerCase();
  if (!email) return { email: '', ok: false, motivo: 'sem_email' };
  const u = lerAba_('Cad_Usuarios').find(function (x) { return String(x.Email_Google).trim().toLowerCase() === email; });
  if (!u) return { email: email, ok: false, motivo: 'nao_cadastrado' };
  if (String(u.Status_Ativo).trim().toLowerCase() !== 'sim') return { email: email, ok: false, motivo: 'inativo' };
  const pf = perfis_()[String(u.Perfil).trim()];
  if (!pf) return { email: email, ok: false, motivo: 'perfil_invalido' };
  return { email: email, ok: true, nome: String(u.Nome), perfil: pf.nome, perms: pf.perms, telas: pf.telas, escopo: pf.escopo, pf: pf };
}
function tem_(a, perm) { return a.perms.indexOf(perm) > -1; }
function exigirPerm_(perm) {
  const a = acesso_();
  if (!a.ok) throw new Error('Acesso negado.');
  if (!tem_(a, perm)) throw new Error('Seu perfil não tem permissão para esta ação.');
  return a;
}
function exigirTela_(tela) {
  const a = acesso_();
  if (!a.ok) throw new Error('Acesso negado.');
  if (a.telas.indexOf(tela) < 0) throw new Error('Seu perfil não tem acesso a esta tela.');
  return a;
}
/** Escopo "time": só o que pertence ao líder logado (comparação sem acento e sem diferença de caixa). Outros escopos não restringem por líder. */
function unidadeNoEscopo_(a, lider) { return a.escopo.modo !== 'time' || semAcento_(lider) === semAcento_(a.nome); }
/** Pessoa do cadastro dentro do escopo: líder vê o próprio cadastro e os colaboradores dele; limite de turno também vale. */
function pessoaNoEscopo_(a, p) {
  if (a.escopo.turnos.length && a.escopo.turnos.indexOf(p.Turno) < 0) return false;
  return a.escopo.modo !== 'time' || semAcento_(p.Cargo === 'Líder' ? p.Nome : p.Lider) === semAcento_(a.nome);
}
function procPermitido_(a, p) { const l = a.escopo.processos; return !l.length || l.indexOf(p) > -1; }
function resumoUsuario_(a) { return { email: a.email, ok: true, nome: a.nome, perfil: a.perfil, perms: a.perms, telas: a.telas, escopo: a.escopo }; }
function registrar_(a, acao, alvo, detalhe) {
  anexar_('Log_Permissoes', [agora_(), limpar_(a.nome + ' <' + a.email + '>'), acao, limpar_(String(alvo)), limpar_(String(detalhe).slice(0, 900))]);
}

/* ---------- carga inicial ---------- */
function bootstrap(forcar) {
  let a = acesso_();
  if (forcar && a.ok) { limparCache_(); a = acesso_(); }
  if (!a.ok) {
    const bl = { email: a.email, ok: false, motivo: a.motivo || '', solicitacao: '' };
    if (a.motivo === 'nao_cadastrado') { const sl = ultimaSolicitacao_(a.email); bl.solicitacao = sl ? sl.Status : ''; }
    return { user: bl, appUrl: urlApp_() };
  }
  const temRel = ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'].some(function (t) { return a.telas.indexOf(t) > -1; });
  const procs = PROCESSOS.filter(function (p) { return procPermitido_(a, p); });
  const r = {
    user: resumoUsuario_(a), config: config_(), processos: procs, tipos: TIPO_PROC, visual: { cores: CORES, simbolos: SIMBOLOS }, turnos: TURNOS,
    pendentes: tem_(a, 'autorizar') ? pendentes_().length : 0,
    db: { Cad_Estrutura: lerAba_('Cad_Estrutura'), Cad_Pessoas: lerAba_('Cad_Pessoas').filter(function (p) { return (a.escopo.modo !== 'time' && tem_(a, 'auditar')) || tem_(a, 'cad_pessoas') || pessoaNoEscopo_(a, p); }), Cad_Processos_Perguntas: lerAba_('Cad_Processos_Perguntas') }
  };
  if (a.telas.indexOf('auditores') > -1 || temRel) {
    const pf = perfis_();
    r.auditores = lerAba_('Cad_Usuarios').filter(function (u) { return pf[u.Perfil] && pf[u.Perfil].perms.indexOf('auditar') > -1; })
      .map(function (u) { return { email: String(u.Email_Google).trim().toLowerCase(), nome: u.Nome, ativo: ativo_(u) }; });
  }
  return r;
}

/* ---------- solicitações de cadastro e autorização ---------- */
const CARGOS_SOL = ['Analista', 'Líder', 'Site Leader', 'Coordenador', 'Outros'];
const MAX_RECUSAS = 5;
const MAX_PENDENTES = 300;
function urlApp_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }
function emailValido_(e) { return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
const IDIOMAS = ['pt', 'en', 'es'];
function idiomaOk_(v) { v = String(v || '').trim().toLowerCase(); return IDIOMAS.indexOf(v) > -1 ? v : 'pt'; }
function emailDe_(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function ultimaSolicitacao_(email) {
  const l = lerDireto_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === email; });
  return l.length ? l[l.length - 1] : null;
}
/** Solicitações pendentes cujo e-mail ainda não virou usuário. */
function pendentes_() {
  const us = {};
  lerDireto_('Cad_Usuarios').forEach(function (u) { us[emailDe_(u.Email_Google)] = 1; });
  return lerDireto_('Cad_Solicitacoes').filter(function (x) { return String(x.Status) === 'Pendente' && !us[emailDe_(x.Email)]; });
}
function solOut_(x) { return { idioma: idiomaOk_(x.Idioma), id: x.ID, email: emailDe_(x.Email), nome: x.Nome, cargo: x.Cargo, data: x.Data, status: x.Status, por: x.Decidido_Por, em: x.Decidido_Em, perfil: x.Perfil_Atribuido }; }
function listaSol_() {
  const todas = lerDireto_('Cad_Solicitacoes');
  return {
    pendentes: pendentes_().map(solOut_).reverse(),
    historico: todas.filter(function (x) { return String(x.Status) !== 'Pendente'; }).slice(-50).reverse().map(solOut_)
  };
}
/** Pedido de cadastro feito por quem ainda não tem acesso. Só vale para a conta Google que está em uso (ninguém cadastra outra pessoa). */
function solicitarCadastro(obj) {
  const ativo = emailDe_(Session.getActiveUser().getEmail());
  if (!ativo) return { ok: false, msg: 'Não foi possível identificar a sua conta Google. Entre com a sua conta e tente novamente.' };
  const o = obj || {}, erros = {};
  const email = emailDe_(o.email), nome = String(o.nome || '').replace(/\s+/g, ' ').trim(), cargoSel = String(o.cargo || '').trim(), outro = String(o.cargoOutro || '').replace(/\s+/g, ' ').trim();
  if (!email) erros.email = 'Campo obrigatório.';
  else if (!emailValido_(email)) erros.email = 'E-mail inválido.';
  else if (email !== ativo) erros.email = 'Use o e-mail da conta Google com a qual você entrou.';
  if (nome.length < 3) erros.nome = 'Informe o nome completo.'; else if (nome.length > 120) erros.nome = 'Máximo de 120 caracteres.';
  if (CARGOS_SOL.indexOf(cargoSel) < 0) erros.cargo = 'Selecione o cargo.';
  else if (cargoSel === 'Outros') { if (outro.length < 2) erros.cargoOutro = 'Digite o cargo.'; else if (outro.length > 60) erros.cargoOutro = 'Máximo de 60 caracteres.'; }
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  const cargo = cargoSel === 'Outros' ? outro : cargoSel;
  return comLock_(function () {
    const u = lerDireto_('Cad_Usuarios').find(function (x) { return emailDe_(x.Email_Google) === ativo; });
    if (u) return { ok: false, msg: String(u.Status_Ativo).trim().toLowerCase() === 'sim' ? 'Este e-mail já possui cadastro. Entre com o Google.' : 'Este cadastro está desativado. Fale com o administrador.' };
    const minhas = lerDireto_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === ativo; });
    if (minhas.some(function (x) { return String(x.Status) === 'Pendente'; })) return { ok: false, msg: 'Seu cadastro já foi enviado e está em análise.' };
    if (minhas.filter(function (x) { return String(x.Status) === 'Recusada'; }).length >= MAX_RECUSAS) return { ok: false, msg: 'Limite de solicitações atingido. Fale com o administrador.' };
    if (pendentes_().length >= MAX_PENDENTES) return { ok: false, msg: 'Há solicitações demais em análise no momento. Tente novamente mais tarde.' };
    const id = 'SOL-' + Date.now() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
    anexar_('Cad_Solicitacoes', [id, ativo, limpar_(nome), limpar_(cargo), agora_(), 'Pendente', '', '', '', idiomaOk_(o.idioma)]);
    registrar_({ nome: nome, email: ativo }, 'Cadastro solicitado', ativo, 'Cargo informado: ' + cargo);
    return { ok: true };
  });
}
function listarSolicitacoes() {
  exigirPerm_('autorizar');
  return listaSol_();
}
function contarPendentes() {
  exigirPerm_('autorizar');
  return pendentes_().length;
}
function recusarSolicitacao(id) {
  const a = exigirPerm_('autorizar');
  return comLock_(function () {
    const x = lerDireto_('Cad_Solicitacoes').find(function (r) { return String(r.ID) === String(id) && String(r.Status) === 'Pendente'; });
    if (!x) return { ok: false, msg: 'Esta solicitação já foi tratada ou não existe. Clique em Atualizar.' };
    aba_('Cad_Solicitacoes').getRange(x._row, 6, 1, 3).setValues([['Recusada', limpar_(a.email), agora_()]]);
    registrar_(a, 'Cadastro recusado', emailDe_(x.Email), 'Nome: ' + x.Nome);
    return { ok: true, dados: listaSol_() };
  });
}
function esc_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const MAIL_TXT = {
  pt: { assunto: 'Seu cadastro foi aprovado - Process Check', titulo: 'Cadastro aprovado', ola: 'Olá, ', corpo: 'Seu cadastro foi aprovado. Você já pode acessar o sistema com a sua conta Google.', botao: 'Acessar o sistema', dica: 'Se o botão não abrir, copie e cole este endereço no navegador:', rodape: 'Mensagem automática. Não é necessário responder.' },
  en: { assunto: 'Your registration was approved - Process Check', titulo: 'Registration approved', ola: 'Hello, ', corpo: 'Your registration was approved. You can now access the system with your Google account.', botao: 'Open the system', dica: 'If the button does not open, copy and paste this address into your browser:', rodape: 'Automatic message. No reply is needed.' },
  es: { assunto: 'Su registro fue aprobado - Process Check', titulo: 'Registro aprobado', ola: 'Hola, ', corpo: 'Su registro fue aprobado. Ya puede acceder al sistema con su cuenta de Google.', botao: 'Abrir el sistema', dica: 'Si el botón no abre, copie y pegue esta dirección en el navegador:', rodape: 'Mensaje automático. No es necesario responder.' }
};
/** E-mail de aprovação (PT, EN ou ES, conforme o idioma escolhido no cadastro). Só avisa a aprovação: não lista permissões, não cita perfil e não explica motivos. */
function enviarAprovacao_(a, nome, para, idioma) {
  const url = urlApp_(), m = MAIL_TXT[idiomaOk_(idioma)], primeiro = esc_(String(nome).split(' ')[0]);
  const txt = m.ola + String(nome).split(' ')[0] + '.\n\n' + m.corpo + '\n\n' + (url ? m.botao + ': ' + url + '\n\n' : '') + m.rodape;
  const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F5F7;padding:24px 0"><tr><td align="center">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #E4E7EB;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1F2328">'
    + '<tr><td style="background:#D9441A;padding:18px 28px;color:#FFFFFF;font-size:15px;font-weight:bold;letter-spacing:.3px">Process Check</td></tr>'
    + '<tr><td style="padding:30px 28px 8px"><div style="font-size:22px;font-weight:bold;line-height:1.3">' + esc_(m.titulo) + '</div></td></tr>'
    + '<tr><td style="padding:8px 28px 4px;font-size:15px;line-height:1.6">' + esc_(m.ola) + primeiro + '.<br><br>' + esc_(m.corpo) + '</td></tr>'
    + (url ? '<tr><td style="padding:20px 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#D9441A" style="border-radius:6px"><a href="' + esc_(url) + '" style="display:inline-block;padding:12px 24px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none">' + esc_(m.botao) + '</a></td></tr></table></td></tr>'
      + '<tr><td style="padding:14px 28px 4px;font-size:12px;line-height:1.5;color:#6B7280">' + esc_(m.dica) + '<br><a href="' + esc_(url) + '" style="color:#6B7280;word-break:break-all">' + esc_(url) + '</a></td></tr>' : '')
    + '<tr><td style="padding:22px 28px 26px;font-size:11px;color:#9AA3AD;border-top:1px solid #EEF0F2">' + esc_(m.rodape) + '</td></tr>'
    + '</table></td></tr></table>';
  try {
    MailApp.sendEmail({ to: para, subject: m.assunto, body: txt, htmlBody: html, name: 'Process Check' });
    try { registrar_(a, 'E-mail de aprovação enviado', para, 'Idioma: ' + idiomaOk_(idioma)); } catch (e1) { /* log best-effort */ }
    return { enviado: true, msg: '' };
  } catch (e) {
    try { registrar_(a, 'E-mail de aprovação não enviado', para, String(e && e.message || e)); } catch (e2) { /* log best-effort */ }
    return { enviado: false, msg: 'Não foi possível enviar o e-mail de aprovação.' };
  }
}

/* ---------- rascunhos ---------- */
function rascunhoValido_(r) { return d_(r.Timestamp_Inicio).getTime() >= Date.now() - RASCUNHO_DIAS * 864e5; }
function getRascunho(processo, chave) {
  const u = exigirPerm_('auditar');
  if (!procPermitido_(u, processo)) throw new Error('Sem acesso a este processo.');
  const r = lerDireto_('Auditorias_Rascunho').find(function (x) {
    return String(x.Auditor_Email).toLowerCase() === u.email && x.Processo === processo && x.Doca_Cluster === chave && rascunhoValido_(x);
  });
  return r ? JSON.parse(r.Json_Respostas_Parciais) : null;
}
function getRascunhoLider(lider) {
  const u = exigirPerm_('auditar');
  if (!procPermitido_(u, 'Indução')) return null;
  const r = lerDireto_('Auditorias_Rascunho').filter(function (x) {
    return String(x.Auditor_Email).toLowerCase() === u.email && x.Processo === 'Indução' && rascunhoValido_(x) && liderDoRascunho_(x) === lider;
  }).sort(function (x, y) { return String(y.Timestamp_Inicio).localeCompare(String(x.Timestamp_Inicio)); })[0];
  return r ? { chave: r.Doca_Cluster, estado: JSON.parse(r.Json_Respostas_Parciais) } : null;
}
function salvarRascunho(p) {
  const u = exigirPerm_('auditar');
  if (!p || PROCESSOS.indexOf(p.processo) < 0 || vazio_(p.chave) || String(p.chave).length > 120) throw new Error('Rascunho inválido.');
  if (!procPermitido_(u, p.processo)) throw new Error('Sem acesso a este processo.');
  const json = JSON.stringify(p.estado == null ? {} : p.estado);
  if (json.length > 40000) throw new Error('Rascunho grande demais.');
  const chave = limpar_(String(p.chave));
  return comLock_(function () {
    const s = aba_('Auditorias_Rascunho');
    const ex = lerDireto_('Auditorias_Rascunho').find(function (x) {
      return String(x.Auditor_Email).toLowerCase() === u.email && x.Processo === p.processo && x.Doca_Cluster === chave;
    });
    if (ex) {
      if (!rascunhoValido_(ex)) s.getRange(ex._row, 2).setValue(agora_());
      s.getRange(ex._row, 6).setValue(json);
      return ex.ID_Rascunho;
    }
    const id = 'RAS-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
    anexar_('Auditorias_Rascunho', [id, agora_(), u.email, p.processo, chave, json]);
    return id;
  });
}
function descartarRascunho(processo, chave) {
  const u = exigirPerm_('auditar');
  comLock_(function () { removerRascunhos_(u.email, processo, chave); });
  return true;
}
function removerRascunhos_(email, processo, chave) {
  const s = aba_('Auditorias_Rascunho');
  lerDireto_('Auditorias_Rascunho').filter(function (x) {
    return String(x.Auditor_Email).toLowerCase() === email && x.Processo === processo && x.Doca_Cluster === chave;
  }).map(function (x) { return x._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { s.deleteRow(r); });
}

/* ---------- auditoria ---------- */
function salvarAuditoria(p) {
  const u = exigirPerm_('auditar'), cfg = config_(), erros = {};
  if (!p || PROCESSOS.indexOf(p.processo) < 0) return { ok: false, erros: { processo: 'Selecione o processo.' } };
  if (!procPermitido_(u, p.processo)) return { ok: false, erros: { processo: 'Seu perfil não pode auditar este processo.' } };
  const tipo = TIPO_PROC[p.processo], multi = !!cfg.MULTI[p.processo];
  let doca = String(p.doca || '').trim(), lider = String(p.lider || '').trim(), turno = String(p.turno || '').trim();
  let nomes = Array.isArray(p.colaboradores) ? p.colaboradores : (vazio_(p.colaborador) ? [] : [p.colaborador]);
  nomes = nomes.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
  const pessoas = lerAba_('Cad_Pessoas').filter(ativo_);
  if (tipo) {
    if (!doca) erros.doca = 'Selecione ' + (tipo === 'Doca' ? 'a doca' : 'o cluster') + '.';
    else if (!lerAba_('Cad_Estrutura').some(function (e) { return e.Tipo === tipo && String(e.Identificador) === doca; })) erros.doca = (tipo === 'Doca' ? 'Doca não cadastrada.' : 'Cluster não cadastrado.');
  } else doca = '';
  const unicos = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
  if (unicos.length !== nomes.length) erros.colaborador = 'Colaborador repetido na lista.';
  else if (nomes.length > 1 && !multi) erros.colaborador = 'Este processo permite apenas um colaborador por auditoria.';
  else if (nomes.length > MAX_COLAB) erros.colaborador = 'No máximo ' + MAX_COLAB + ' colaboradores por auditoria.';
  const linhasColab = [];
  if (!erros.colaborador) {
    nomes.forEach(function (n) {
      const pe = pessoas.find(function (x) { return x.Cargo === 'Colaborador' && x.Nome === n; });
      if (!pe) { erros.colaborador = 'Colaborador não cadastrado ou inativo: ' + n + '.'; return; }
      linhasColab.push({ n: pe.Nome, l: String(pe.Lider || ''), t: String(pe.Turno || '') });
    });
  }
  if (u.escopo.modo === 'time') {
    // líder audita qualquer doca/cluster, mas só colaboradores do próprio time; a auditoria sempre fica no nome dele
    const eu = semAcento_(u.nome), fora = linhasColab.filter(function (c) { return semAcento_(c.l) !== eu; });
    if (!erros.colaborador && fora.length) erros.colaborador = 'Seu perfil só pode auditar colaboradores do seu time: ' + fora.map(function (c) { return c.n; }).join(', ') + '.';
    if (!linhasColab.length) { const ld = pessoas.find(function (x) { return x.Cargo === 'Líder' && semAcento_(x.Nome) === eu; }); lider = ld ? ld.Nome : u.nome; }
  }
  if (!linhasColab.length && lider && !erros.lider) {
    const ldc = pessoas.find(function (x) { return x.Cargo === 'Líder' && semAcento_(x.Nome) === semAcento_(lider); });
    if (ldc) lider = ldc.Nome; else erros.lider = 'Líder não cadastrado ou inativo: ' + lider.slice(0, 60) + '.';
  }
  if (!erros.colaborador && !tipo && !linhasColab.length) erros.colaborador = 'Selecione o colaborador.';
  if (!erros.colaborador && linhasColab.length) {
    const ls = linhasColab.map(function (c) { return c.l; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    const ts = linhasColab.map(function (c) { return c.t; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (ls.length) lider = ls.join('; ');
    if (ts.length === 1) turno = ts[0];
    else if (ts.length > 1 && TURNOS.indexOf(turno) < 0) erros.turno = 'Os colaboradores são de turnos diferentes. Selecione o turno da auditoria.';
  }
  if (!tipo && !erros.colaborador && !lider) erros.lider = 'Líder não identificado. Cadastre o líder deste colaborador.';
  if (!erros.turno && TURNOS.indexOf(turno) < 0) erros.turno = 'Selecione o turno.';
  if (!erros.turno && u.escopo.turnos.length && u.escopo.turnos.indexOf(turno) < 0) erros.turno = 'Seu perfil só pode auditar o(s) turno(s): ' + u.escopo.turnos.join(', ') + '.';
  const obs = String(p.observacoes || '').trim();
  if (obs.length > 500) erros.obs = 'Máximo de 500 caracteres.';
  const perg = lerAba_('Cad_Processos_Perguntas').filter(function (x) { return x.Processo === p.processo; });
  const mapa = {};
  (Array.isArray(p.respostas) ? p.respostas : []).forEach(function (r) { if (r) mapa[String(r.k)] = r.ok; });
  const faltam = perg.filter(function (x) { const k = String(x._row); return !(k in mapa) || [true, false, null].indexOf(mapa[k]) < 0; });
  if (!perg.length) erros.itens = 'Não há itens cadastrados para este processo.';
  else if (faltam.length) erros.itens = 'Responda todos os itens (' + faltam.length + ' pendente' + (faltam.length > 1 ? 's' : '') + ').';
  const detalhes = perg.map(function (x) { return { k: x._row, id: x.ID_Subprocesso, desc: x.Descricao_Item, critico: x.Requisito_Critico === 'Sim', ok: mapa[String(x._row)] }; });
  const av = detalhes.filter(function (r) { return r.ok === true || r.ok === false; });
  if (!erros.itens && !av.length) erros.itens = 'Avalie ao menos um item (nem tudo pode ser N/A).';
  if (Object.keys(erros).length) return { ok: false, erros: erros, faltam: faltam.map(function (x) { return x._row; }) };
  const conf = av.filter(function (r) { return r.ok; }).length;
  const pct = Math.round(conf / av.length * 1000) / 10;
  const status = STATUS_TXT[faixa_(pct, cfg)];
  const agora = new Date();
  const novoId = function () { return 'AUD-' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 90000 + 10000); };
  let id = novoId();
  const nc = av.filter(function (r) { return !r.ok; }).map(function (r) { return String(r.id).replace(/\|/g, '/'); }).join('|');
  const resumoColab = linhasColab.map(function (c) { return c.n; }).join('; ');
  comLock_(function () {
    prepararHist_();
    // garante ID único: confere as últimas linhas (mesmo segundo) antes de gravar
    const sh = aba_('Auditorias_Historico'), nh = sh.getLastRow() - 1;
    if (nh > 0) { const ini = Math.max(2, nh + 2 - 199), rec = sh.getRange(ini, 1, nh + 2 - ini, 1).getValues().map(function (r) { return String(r[0]); }); for (let t = 0; rec.indexOf(id) > -1 && t < 20; t++) id = novoId(); }
    // colaboradores primeiro: se falhar no meio, não fica auditoria sem a lista de colaboradores
    if (linhasColab.length) anexarLinhas_('Auditorias_Colaboradores', linhasColab.map(function (c) { return [id, limpar_(c.n), limpar_(c.l), c.t]; }));
    anexar_('Auditorias_Historico', [id, fmt_(agora), p.processo, doca, limpar_(resumoColab), limpar_(lider), turno, limpar_(u.nome), pct, status, limpar_(obs), JSON.stringify(detalhes), u.email, limpar_(nc), av.some(function (r) { return !r.ok && r.critico; }) ? 'S' : 'N']);
    removerRascunhos_(u.email, p.processo, chaveRascunho_(p.processo, doca, tipo ? '' : nomes[0]));
    CacheService.getScriptCache().remove('ult');
    bumpHv_();
  });
  return { ok: true, id: id, pct: pct, status: status };
}

/* ---------- camada de dados (histórico) ---------- */
/** Memória só da execução atual (cada chamada do navegador é uma execução nova). A chave inclui a versão do histórico e o nº de linhas. */
var MEMO_ = {};
function memo_(nome, n, fn) {
  const k = hv_() + ':' + n, m = MEMO_[nome];
  if (m && m.k === k) return m.v;
  const v = fn();
  MEMO_[nome] = { k: k, v: v };
  return v;
}
/** Lê só o necessário: coluna de datas inteira + o trecho de linhas do período, nas colunas pedidas. Auditorias_Historico nunca é lida inteira por relatório. */
function lerHist_(de, ate, comNC) {
  const s = aba_('Auditorias_Historico'), n = s.getLastRow() - 1;
  if (n < 1) return [];
  const lo = de + ' 00:00:00', hi = ate + ' 23:59:59';
  const ts = memo_('hts', n, function () { return s.getRange(2, 2, n, 1).getValues().map(function (r) { return tsStr_(r[0]); }); });
  let a = -1, b = -1;
  for (let i = 0; i < n; i++) { const t = ts[i]; if (t >= lo && t <= hi) { if (a < 0) a = i; b = i; } }
  if (a < 0) return [];
  const span = b - a + 1, r0 = a + 2, nc = s.getLastColumn();
  const v = s.getRange(r0, 1, span, 11).getValues();
  const em = nc >= 13 ? s.getRange(r0, 13, span, 1).getValues() : null;
  const ncv = comNC && nc >= 14 ? s.getRange(r0, 14, span, 1).getValues() : null;
  const crv = comNC && nc >= 15 ? s.getRange(r0, 15, span, 1).getValues() : null;
  const out = [];
  for (let i = 0; i < span; i++) {
    const x = v[i], t = tsStr_(x[1]), pct = Number(x[8]);
    if (t < lo || t > hi || !x[0] || isNaN(pct) || String(x[8]).trim() === '') continue;
    out.push({
      _i: i, id: String(x[0]), ts: t, proc: String(x[2]), doca: String(x[3]), colab: String(x[4]), lider: String(x[5]), turno: String(x[6]), resp: String(x[7]),
      pct: pct, status: String(x[9]), obs: String(x[10]), email: em ? String(em[i][0]).trim().toLowerCase() : '',
      ncs: comNC ? (ncv && String(ncv[i][0]) !== '' ? String(ncv[i][0]).split('|') : null) : [],
      // item crítico reprovado: 'S'/'N' gravado pela v7; vazio = auditoria antiga (lida do JSON abaixo)
      crit: comNC ? (crv && (String(crv[i][0]) === 'S' || String(crv[i][0]) === 'N') ? String(crv[i][0]) === 'S' : (x[8] === 100 || Number(x[8]) >= 100 ? false : null)) : false
    });
  }
  if (comNC) {
    const leg = out.filter(function (r) { return (r.ncs === null || r.crit === null) && r.pct < 100; });
    if (leg.length && leg.length <= LEGADO_MAX) {
      const js = s.getRange(r0, 12, span, 1).getValues();
      leg.forEach(function (r) {
        let det = [];
        try { det = JSON.parse(js[r._i][0]); } catch (e) { det = []; }
        if (r.ncs === null) r.ncs = det.filter(function (d) { return d.ok === false; }).map(function (d) { return String(d.id); });
        if (r.crit === null) r.crit = det.some(function (d) { return d.ok === false && d.critico === true; });
      });
    }
    out.forEach(function (r) { if (!r.ncs) r.ncs = []; r.crit = r.crit === true; });
  }
  return out;
}
function lerColabs_(de, ate) {
  const s = aba_('Auditorias_Colaboradores'), n = s.getLastRow() - 1, m = {};
  if (n < 1) return m;
  const d0 = de.replace(/-/g, ''), d1 = ate.replace(/-/g, '');
  const ids = memo_('cids', n, function () { return s.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }); });
  let a = -1, b = -1;
  for (let i = 0; i < n; i++) { const d = ids[i].substr(4, 8); if (d >= d0 && d <= d1) { if (a < 0) a = i; b = i; } }
  if (a < 0) return m;
  s.getRange(a + 2, 1, b - a + 1, 4).getValues().forEach(function (r) {
    const id = String(r[0]);
    if (id) (m[id] = m[id] || []).push({ n: String(r[1]), l: String(r[2]), t: String(r[3]) });
  });
  return m;
}
/** Última auditoria de cada doca/cluster/time (para a Matriz). Cache curto; é limpo ao salvar auditoria. */
function ultimas_() {
  const c = CacheService.getScriptCache(), k = c.get('ult');
  if (k) return JSON.parse(k);
  const s = aba_('Auditorias_Historico'), n = s.getLastRow() - 1, m = {};
  if (n >= 1) {
    s.getRange(2, 2, n, 8).getValues().forEach(function (r) {
      const ts = tsStr_(r[0]), p = String(r[1]);
      if (!ts || PROCESSOS.indexOf(p) < 0 || isNaN(Number(r[7]))) return;
      const key = p + '|' + (TIPO_PROC[p] ? String(r[2]) : String(r[4]));
      const o = m[key];
      if (!o || ts >= o.ts) m[key] = { ts: ts, pct: Number(r[7]), lider: String(r[4]), colab: String(r[3]) };
    });
  }
  try { c.put('ult', JSON.stringify(m), 600); } catch (e) { /* sem cache */ }
  return m;
}
function filtros_(f) {
  f = f || {};
  const s = function (v) { return String(v == null ? '' : v).trim().slice(0, 120); };
  const per = periodo_(f.de, f.ate);
  if ((per.b - per.a) / 864e5 > MAX_PERIODO_DIAS) throw new Error('Período máximo: ' + MAX_PERIODO_DIAS + ' dias.');
  const o = { de: f.de, ate: f.ate, processo: s(f.processo), doca: s(f.doca), turno: s(f.turno), lider: s(f.lider), colaborador: s(f.colaborador), auditor: s(f.auditor).toLowerCase(), faixa: s(f.faixa), obs: s(f.obs) };
  if (o.processo && PROCESSOS.indexOf(o.processo) < 0) throw new Error('Processo inválido.');
  if (o.turno && TURNOS.indexOf(o.turno) < 0) throw new Error('Turno inválido.');
  if (o.faixa && ['verde', 'observacao', 'vermelho'].indexOf(o.faixa) < 0) throw new Error('Faixa inválida.');
  return o;
}
/**
 * PORTÃO ÚNICO: devolve as auditorias do período que o usuário PODE ver (escopo do perfil) e que casam com os filtros.
 * Nenhum relatório lê o histórico por outro caminho.
 */
function auditorias_(a, f, comNC) {
  const cfg = config_(), esc = a.escopo, colabs = lerColabs_(f.de, f.ate);
  const users = lerAba_('Cad_Usuarios'), nomeDoFiltro = f.auditor ? semAcento_((users.find(function (u) { return String(u.Email_Google).trim().toLowerCase() === f.auditor; }) || {}).Nome) : '';
  const meuNome = semAcento_(a.nome), soTime = esc.modo === 'time', meu = function (l) { return semAcento_(l) === meuNome; };
  return lerHist_(f.de, f.ate, comNC).map(function (r) {
    r.colabs = colabs[r.id] || (r.colab ? [{ n: r.colab, l: r.lider, t: r.turno }] : []);
    const ls = r.colabs.map(function (c) { return c.l; }).concat(String(r.lider).split(';').map(function (x) { return x.trim(); })).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
    r.lids = ls;
    // escopo "time": a auditoria pode envolver outra equipe, mas o líder só enxerga o que é do time dele (colaboradores e líderes de fora são recortados aqui, antes de qualquer relatório)
    if (soTime && ls.some(meu)) {
      r.colabs = r.colabs.filter(function (c) { return meu(c.l); });
      r.colab = r.colabs.map(function (c) { return c.n; }).join('; ');
      r.lids = ls.filter(meu);
      r.lider = r.lids.join('; ');
    }
    r.faixa = faixa_(r.pct, cfg);
    return r;
  }).filter(function (r) {
    if (esc.processos.length && esc.processos.indexOf(r.proc) < 0) return false;
    if (esc.turnos.length && esc.turnos.indexOf(r.turno) < 0) return false;
    if (esc.modo === 'proprias' && !(r.email ? r.email === a.email : semAcento_(r.resp) === meuNome)) return false;
    if (soTime && !r.lids.some(meu)) return false;
    if (f.processo && r.proc !== f.processo) return false;
    if (f.doca && r.doca !== f.doca) return false;
    if (f.turno && r.turno !== f.turno) return false;
    if (f.lider && r.lids.indexOf(f.lider) < 0) return false;
    if (f.colaborador && !r.colabs.some(function (c) { return c.n === f.colaborador; })) return false;
    if (f.auditor && !(r.email ? r.email === f.auditor : semAcento_(r.resp) === nomeDoFiltro)) return false;
    if (f.faixa && r.faixa !== f.faixa) return false;
    if (f.obs && semAcento_(r.obs).toLowerCase().indexOf(semAcento_(f.obs).toLowerCase()) < 0) return false;
    return true;
  });
}

/* ---------- matriz ---------- */
function getMatriz(processo) {
  const a = exigirTela_('matriz');
  if (PROCESSOS.indexOf(processo) < 0) throw new Error('Processo inválido.');
  if (!procPermitido_(a, processo)) throw new Error('Sem acesso a este processo.');
  const cfg = config_(), agora = new Date(), tipo = TIPO_PROC[processo], ult = ultimas_();
  const rasc = lerDireto_('Auditorias_Rascunho').filter(function (r) { return r.Processo === processo && rascunhoValido_(r); });
  const unidades = tipo
    ? lerAba_('Cad_Estrutura').filter(function (e) { return e.Tipo === tipo; }).map(function (e) { return { id: e.Identificador, tipo: e.Tipo, simbolo: e.Cor_Simbolo, lider: e.Lider_Padrao, turno: e.Turno_Padrao }; })
    : lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return { id: p.Nome, tipo: 'Time', simbolo: '', lider: p.Nome, turno: p.Turno }; });
  return unidades.map(function (un) {
    const u = ult[processo + '|' + un.id];
    let status = 'nunca', dias = null, nota = null;
    if (u) {
      dias = Math.floor((agora - d_(u.ts)) / 864e5);
      nota = u.pct;
      status = dias > cfg.DIAS_VIDA_UTIL_AUDITORIA ? 'vencido' : faixa_(nota, cfg);
    }
    if (rasc.some(function (r) { return tipo ? r.Doca_Cluster === un.id : liderDoRascunho_(r) === un.id; })) status = 'rascunho';
    un.status = status; un.dias = dias; un.nota = nota;
    un.ultLider = u ? u.lider : ''; un.ultColab = u ? u.colab : '';
    return un;
  });
}

/* ---------- relatórios ---------- */
function relatorio(tipo, filtros, extra) {
  const tipoOk = Object.prototype.hasOwnProperty.call(REL_TELA, tipo) || tipo === 'detalhe' || tipo === 'itensAuditoria';
  const tela = !tipoOk ? '' : (REL_TELA[tipo] || (tipo === 'detalhe' ? ((extra || {}).kind === 'doca' ? 'doca' : 'colab') : (tipo === 'itensAuditoria' ? 'auditorias' : '')));
  if (!tela) throw new Error('Relatório inválido.');
  const a = exigirTela_(tela);
  if (tipo === 'export') exigirPerm_('exportar');
  const f = filtros_(filtros);
  extra = extra || {};
  const cfg = config_();
  if (tipo === 'itensAuditoria') return itensAuditoria_(a, f, String(extra.id || ''));
  const ex = { pagina: Math.max(1, Math.floor(Number(extra.pagina)) || 1), offset: Math.max(0, Math.floor(Number(extra.offset)) || 0), kind: String(extra.kind || ''), chave: String(extra.chave || '').slice(0, 200) };
  const chExp = 'exp:' + a.email, scExp = CacheService.getScriptCache();
  if (tipo === 'export' && (ex.offset === 0 || !scExp.get(chExp))) { scExp.put(chExp, '1', 600); registrar_(a, 'Exportação de dados', 'CSV', 'Período: ' + f.de + ' a ' + f.ate + '; Filtros: ' + (['processo', 'doca', 'turno', 'lider', 'colaborador', 'auditor', 'faixa'].map(function (k) { return f[k] ? k + '=' + f[k] : ''; }).filter(Boolean).join(', ') || 'nenhum')); }
  return comCache_(a, [tipo, f, ex], function () {
    const R = { geral: relGeral_, auditorias: relAuditorias_, auditores: relAuditores_, proc: relProc_, doca: relDoca_, colab: relColab_, tend: relTend_, export: relExport_, detalhe: relDetalhe_ }[tipo];
    const out = R(a, f, cfg, ex);
    out.corte = cfg.NOTA_CORTE_PCT; out.media = cfg.NOTA_MEDIA_PCT; out.pouco = cfg.POUCAS_AUDITORIAS;
    return mascarar_(a, tipo, out, ex);
  });
}
/** Sem a permissão "ver nomes", nenhum relatório devolve nome de colaborador (a máscara roda no servidor, depois do cálculo e antes da resposta). */
function mascarar_(a, tipo, out, ex) {
  if (tem_(a, 'ver_nomes')) return out;
  out.semNomes = true;
  const ocultar = function (l) { if (l && l.colab) l.colab = ''; };
  if (tipo === 'auditorias') out.linhas.forEach(ocultar);
  if (tipo === 'export') out.linhas.forEach(function (l) { l[4] = ''; });
  if (tipo === 'colab') { out.colabs = []; out.semAuditoria = []; out.totalSem = 0; }
  if (tipo === 'detalhe') {
    if (ex.kind === 'colab') throw new Error('Seu perfil não pode ver relatórios por colaborador.');
    (out.hist || []).forEach(ocultar);
  }
  return out;
}
function stat_(rows, cfg) {
  let s = 0, v = 0, o = 0, r = 0;
  rows.forEach(function (x) { s += x.pct; if (x.faixa === 'verde') v++; else if (x.faixa === 'observacao') o++; else r++; });
  return { n: rows.length, media: rows.length ? round1_(s / rows.length) : 0, v: v, o: o, r: r };
}
function agrupar_(rows, fn) { const m = Object.create(null); rows.forEach(function (r) { const k = fn(r); (m[k] = m[k] || []).push(r); }); return m; }
function unidade_(r) { return TIPO_PROC[r.proc] ? r.doca : r.lider; }
function rotulo_(r) { return TIPO_PROC[r.proc] ? r.doca : 'Time ' + r.lider; }
function top_(rows, n) {
  const of = Object.create(null);
  rows.forEach(function (r) { r.ncs.forEach(function (id) { const k = r.proc + ' › ' + id; of[k] = (of[k] || 0) + 1; }); });
  return Object.keys(of).map(function (k) { return [k, of[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, n);
}
function esperadas_(a, f) {
  const estr = lerAba_('Cad_Estrutura'), lids = lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }), keys = {};
  PROCESSOS.forEach(function (pr) {
    if (!procPermitido_(a, pr) || (f.processo && f.processo !== pr)) return;
    const t = TIPO_PROC[pr];
    if (t) estr.filter(function (e) { return e.Tipo === t && (!f.doca || e.Identificador === f.doca); }).forEach(function (e) { keys[pr + '|' + e.Identificador] = 1; });
    else if (!f.doca) lids.filter(function (l) { return (!f.lider || l.Nome === f.lider) && unidadeNoEscopo_(a, l.Nome); }).forEach(function (l) { keys[pr + '|' + l.Nome] = 1; });
  });
  return keys;
}
/** Visão Geral: período atual x período anterior de mesmo tamanho. Inclui "Em observação" em todos os recortes. */
function relGeral_(a, f, cfg) {
  const dias = difDias_(f.de, f.ate) + 1, fB = Object.assign({}, f, { de: addDias_(f.de, -dias), ate: addDias_(f.de, -1) });
  const esp = esperadas_(a, f), nEsp = Object.keys(esp).length;
  const res = function (rows, comOf) {
    const pp = {}, tu = {}, dc = {}, uniq = {};
    rows.forEach(function (r) { if (esp[r.proc + '|' + unidade_(r)]) uniq[r.proc + '|' + unidade_(r)] = 1; });
    const gp = agrupar_(rows, function (r) { return r.proc; });
    Object.keys(gp).forEach(function (k) { pp[k] = stat_(gp[k], cfg); });
    const gt = agrupar_(rows, function (r) { return r.turno || 'N/I'; });
    Object.keys(gt).forEach(function (k) { tu[k] = stat_(gt[k], cfg); });
    const gd = agrupar_(rows, function (r) { return r.proc + ' · ' + rotulo_(r); });
    Object.keys(gd).forEach(function (k) { dc[k] = stat_(gd[k], cfg); });
    const st = stat_(rows, cfg);
    return { total: st.n, media: st.media, conf: st.v, obs: st.o, bad: st.r, pend: Math.max(nEsp - Object.keys(uniq).length, 0), pp: pp, tu: tu, dc: dc, of: comOf ? top_(rows, 10) : [] };
  };
  const rowsA = auditorias_(a, f, true), rowsB = auditorias_(a, fB, true), A = res(rowsA, true), B = res(rowsB, false);
  const ofd = ofensores_(rowsA, rowsB), semanas = serieSemanal_(f, rowsA, cfg);
  A.crit = rowsA.filter(function (r) { return r.crit; }).length;
  B.crit = rowsB.filter(function (r) { return r.crit; }).length;
  const ins = [], pct = function (n, t) { return t ? round1_(n / t * 100) : 0; };
  // vermelho: inconformidade; amarelo: observação; verde: bom
  const tb = Object.keys(A.tu).map(function (k) { return [k, pct(A.tu[k].r, A.tu[k].n), A.tu[k].n]; }).sort(function (x, y) { return y[1] - x[1]; })[0];
  if (tb && tb[1] > 0) ins.push({ t: 'bad', txt: 'Turno ' + tb[0] + ' tem a maior taxa de inconformidade: ' + tb[1] + '% das auditorias.', go: { turno: tb[0], faixa: 'vermelho' } });
  const to = Object.keys(A.tu).map(function (k) { return [k, pct(A.tu[k].o, A.tu[k].n)]; }).sort(function (x, y) { return y[1] - x[1]; })[0];
  if (to && to[1] > 0) ins.push({ t: 'obs', txt: 'Turno ' + to[0] + ' concentra mais auditorias em observação: ' + to[1] + '%.', go: { turno: to[0], faixa: 'observacao' } });
  const oA = pct(A.obs, A.total), oB = pct(B.obs, B.total);
  if (A.total && B.total && oA - oB >= 5) ins.push({ t: 'obs', txt: 'Auditorias em observação subiram de ' + oB + '% para ' + oA + '% em relação ao período anterior.' });
  Object.keys(A.dc).map(function (k) { return [k, A.dc[k].media, A.dc[k].n]; }).sort(function (x, y) { return x[1] - y[1]; }).slice(0, 3)
    .filter(function (x) { return x[1] < cfg.NOTA_MEDIA_PCT; })
    .forEach(function (x) { ins.push({ t: x[1] < cfg.NOTA_CORTE_PCT ? 'bad' : 'obs', txt: 'Prioridade de verificação: ' + x[0] + ' (média ' + x[1].toFixed(1) + '%).', go: { processo: x[0].split(' · ')[0] } }); });
  Object.keys(A.pp).forEach(function (k) {
    const m = A.pp[k].media;
    if (m < cfg.NOTA_CORTE_PCT) ins.push({ t: 'bad', txt: 'Ação corretiva: ' + k + ' abaixo da nota de corte (' + m.toFixed(1) + '%).', go: { processo: k } });
    else if (m < cfg.NOTA_MEDIA_PCT) ins.push({ t: 'obs', txt: 'Atenção: ' + k + ' em observação, abaixo da nota média (' + m.toFixed(1) + '%).', go: { processo: k } });
  });
  if (A.of[0]) ins.push({ t: 'bad', txt: 'Maior ofensor: ' + A.of[0][0] + ' (' + A.of[0][1] + ' não conformidades).', go: { processo: A.of[0][0].split(' › ')[0] } });
  if (A.pend > 0) ins.push({ t: 'info', txt: A.pend + ' doca(s)/cluster(s)/time(s) sem auditoria no período.' });
  if (A.total && !ins.some(function (i) { return i.t === 'bad' || i.t === 'obs'; })) ins.push({ t: 'ok', txt: 'Todos os processos estão em conformidade no período.' });
  const ord = { bad: 0, obs: 1, info: 2, ok: 3 };
  ins.sort(function (x, y) { return ord[x.t] - ord[y.t]; });
  return { A: A, B: B, ins: ins, ofd: ofd, sem: semanas, tem_b: B.total > 0 };
}
/** Ofensores: taxa de falha = auditorias com a não conformidade / auditorias do processo, comparada ao período anterior, com a unidade (doca/cluster/time) mais frequente. */
function ofensores_(rowsA, rowsB) {
  const calc = function (rows) {
    const aud = Object.create(null), nc = Object.create(null), un = Object.create(null);
    rows.forEach(function (r) {
      aud[r.proc] = (aud[r.proc] || 0) + 1;
      r.ncs.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).forEach(function (id) {
        const k = r.proc + '|' + id;
        nc[k] = (nc[k] || 0) + 1;
        const u = (un[k] = un[k] || Object.create(null)), rt = rotulo_(r);
        u[rt] = (u[rt] || 0) + 1;
      });
    });
    return { aud: aud, nc: nc, un: un };
  };
  const A = calc(rowsA), B = calc(rowsB);
  return Object.keys(A.nc).map(function (k) {
    const i = k.indexOf('|'), proc = k.slice(0, i), id = k.slice(i + 1), tA = round1_(A.nc[k] / A.aud[proc] * 100);
    const tB = B.aud[proc] ? round1_((B.nc[k] || 0) / B.aud[proc] * 100) : null;
    const us = Object.keys(A.un[k]).sort(function (x, y) { return A.un[k][y] - A.un[k][x]; });
    return { proc: proc, id: id, nc: A.nc[k], aud: A.aud[proc], taxa: tA, taxaB: tB, dif: tB === null ? null : round1_(tA - tB), un: us[0] || '', uns: us.length };
  }).sort(function (x, y) { return y.taxa - x.taxa || y.nc - x.nc; }).slice(0, 8);
}
/** Série semanal da nota média (sempre por semana, qualquer que seja o período). */
function serieSemanal_(f, rows, cfg) {
  const chaves = []; let k = segunda_(f.de);
  while (k <= f.ate) { chaves.push(k); k = addDias_(k, 7); }
  const g = agrupar_(rows, function (r) { return segunda_(r.ts.slice(0, 10)); });
  return chaves.map(function (c) { const st = stat_(g[c] || [], cfg); return { k: c, n: st.n, m: st.n ? st.media : null, v: st.v, o: st.o, r: st.r }; });
}
function baldes_(f) {
  const dias = difDias_(f.de, f.ate) + 1, modo = dias <= 62 ? 'dia' : 'semana', chaves = [];
  if (modo === 'dia') for (let i = 0; i < dias; i++) chaves.push(addDias_(f.de, i));
  else { let k = segunda_(f.de); while (k <= f.ate) { chaves.push(k); k = addDias_(k, 7); } }
  return { modo: modo, chaves: chaves, de: function (r) { const d = r.ts.slice(0, 10); return modo === 'dia' ? d : segunda_(d); } };
}
function relAuditorias_(a, f, cfg, ex) {
  const rows = auditorias_(a, f, false).sort(function (x, y) { return y.ts.localeCompare(x.ts) || y.id.localeCompare(x.id); });
  const st = stat_(rows, cfg), total = rows.length, paginas = Math.max(1, Math.ceil(total / PAGINA)), pg = Math.min(ex.pagina, paginas);
  const b = baldes_(f), procs = PROCESSOS.filter(function (p) { return procPermitido_(a, p) && (!f.processo || f.processo === p); }), idx = {}, mat = {};
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  procs.forEach(function (p) { mat[p] = b.chaves.map(function () { return 0; }); });
  rows.forEach(function (r) { if (mat[r.proc] && idx[b.de(r)] !== undefined) mat[r.proc][idx[b.de(r)]]++; });
  let max = 0; procs.forEach(function (p) { mat[p].forEach(function (x) { if (x > max) max = x; }); });
  return {
    kpis: st, total: total, pagina: pg, paginas: paginas,
    linhas: rows.slice((pg - 1) * PAGINA, pg * PAGINA).map(function (r) { return { id: r.id, ts: r.ts, proc: r.proc, doca: r.doca, colab: r.colab, lider: r.lider, turno: r.turno, resp: r.resp, pct: r.pct, faixa: r.faixa, obs: r.obs.slice(0, 300) }; }),
    obsRec: rows.filter(function (r) { return r.faixa !== 'verde' && String(r.obs).trim(); }).slice(0, 6).map(function (r) { return { id: r.id, ts: r.ts, proc: r.proc, un: rotulo_(r), pct: r.pct, faixa: r.faixa, obs: r.obs.slice(0, 300) }; }),
    heat: { modo: b.modo, cols: b.chaves, rows: procs.map(function (p) { return { proc: p, v: mat[p] }; }), max: max }
  };
}
/** Traduções opcionais cadastradas (EN/ES) do subprocesso e da descrição de cada item do processo. Vazio = usa o texto original. */
function traducoesItens_(proc) {
  const m = Object.create(null);
  lerAba_('Cad_Processos_Perguntas').forEach(function (x) {
    if (x.Processo !== proc) return;
    if ((x.Subprocesso_EN || x.Subprocesso_ES) && !m[x.ID_Subprocesso]) m[x.ID_Subprocesso] = { en: String(x.Subprocesso_EN || ''), es: String(x.Subprocesso_ES || '') };
    if (x.Descricao_EN || x.Descricao_ES) m[x.ID_Subprocesso + '|' + x.Descricao_Item] = { en: String(x.Descricao_EN || ''), es: String(x.Descricao_ES || '') };
  });
  return m;
}
function itensAuditoria_(a, f, id) {
  if (!/^AUD-\d{14}-\d{3,5}$/.test(id)) throw new Error('Auditoria inválida.');
  const dia = id.substr(4, 4) + '-' + id.substr(8, 2) + '-' + id.substr(10, 2), g = Object.assign({}, f, { de: addDias_(dia, -1), ate: addDias_(dia, 1), processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '' });
  const r = auditorias_(a, g, false).find(function (x) { return x.id === id; });
  if (!r) throw new Error('Auditoria não encontrada ou fora do seu escopo de dados.');
  const s = aba_('Auditorias_Historico'), n = s.getLastRow() - 1, ids = s.getRange(2, 1, n, 1).getValues();
  let linha = -1;
  for (let i = n - 1; i >= 0; i--) if (String(ids[i][0]) === id) { linha = i + 2; break; }
  let det = [];
  try { det = JSON.parse(s.getRange(linha, 12, 1, 1).getValues()[0][0]); } catch (e) { det = []; }
  const trad = traducoesItens_(r.proc);
  return { id: id, proc: r.proc, doca: r.doca, colab: tem_(a, 'ver_nomes') ? r.colab : '', lider: r.lider, turno: r.turno, resp: r.resp, pct: r.pct, faixa: r.faixa, obs: r.obs, ts: r.ts, itens: det.map(function (d) { const t = trad[d.id + '|' + d.desc] || {}; return { id: d.id, desc: d.desc, critico: !!d.critico, ok: d.ok, id_en: (trad[d.id] || {}).en || '', id_es: (trad[d.id] || {}).es || '', desc_en: t.en || '', desc_es: t.es || '' }; }) };
}
function relAuditores_(a, f, cfg) {
  const rows = auditorias_(a, f, false), hoje = hoje_(), pf = perfis_();
  const users = lerAba_('Cad_Usuarios').filter(function (u) { return ativo_(u) && pf[u.Perfil] && pf[u.Perfil].perms.indexOf('auditar') > -1; });
  const semanas = Math.max((difDias_(f.de, f.ate) + 1) / 7, 1 / 7);
  const por = agrupar_(rows, function (r) { return r.email || 'nome:' + semAcento_(r.resp); });
  const linhas = users.map(function (u) {
    const em = String(u.Email_Google).trim().toLowerCase(), mine = (por[em] || []).concat(por['nome:' + semAcento_(u.Nome)] || []);
    const st = stat_(mine, cfg), dias = {}, procs = {};
    mine.forEach(function (r) { dias[r.ts.slice(0, 10)] = 1; procs[r.proc] = (procs[r.proc] || 0) + 1; });
    const ult = mine.map(function (r) { return r.ts; }).sort().pop() || '';
    return { email: em, nome: u.Nome, perfil: u.Perfil, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, porSemana: round1_(st.n / semanas), diasAtivos: Object.keys(dias).length, ultima: ult, procs: procs };
  }).sort(function (x, y) { return y.n - x.n || x.nome.localeCompare(y.nome, 'pt-BR'); });
  linhas.forEach(function (l, i) { l.rank = i + 1; });
  const b = baldes_(f), idx = {}, serie = b.chaves.map(function () { return 0; });
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  rows.forEach(function (r) { if (idx[b.de(r)] !== undefined) serie[idx[b.de(r)]]++; });
  const out = { linhas: linhas, total: rows.length, serie: { modo: b.modo, cols: b.chaves, v: serie }, metas: metasProgresso_(a, hoje, users), podeMetas: tem_(a, 'metas'), limitado: a.escopo.modo !== 'todos' || a.escopo.processos.length > 0 || a.escopo.turnos.length > 0 };
  out.users = users.map(function (u) { return { email: String(u.Email_Google).trim().toLowerCase(), nome: u.Nome, perfil: u.Perfil }; });
  return out;
}
function relProc_(a, f, cfg) {
  const rows = auditorias_(a, f, true), g = agrupar_(rows, function (r) { return r.proc; }), b = baldes_(f), idx = {};
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  const linhas = PROCESSOS.filter(function (p) { return procPermitido_(a, p) && (!f.processo || f.processo === p); }).map(function (p) {
    const l = g[p] || [], st = stat_(l, cfg), tu = {}, gt = agrupar_(l, function (r) { return r.turno; });
    Object.keys(gt).forEach(function (t) { tu[t] = stat_(gt[t], cfg); });
    const soma = b.chaves.map(function () { return 0; }), cnt = b.chaves.map(function () { return 0; });
    l.forEach(function (r) { const i = idx[b.de(r)]; if (i !== undefined) { soma[i] += r.pct; cnt[i]++; } });
    return { proc: p, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, tu: tu, of: top_(l, 5), serie: soma.map(function (s, i) { return cnt[i] ? round1_(s / cnt[i]) : null; }) };
  });
  return { linhas: linhas, cols: b.chaves, modo: b.modo };
}
function relDoca_(a, f, cfg) {
  const rows = auditorias_(a, f, false), g = agrupar_(rows, function (r) { return r.proc + '|' + r.doca; }), meio = addDias_(f.de, Math.floor((difDias_(f.de, f.ate) + 1) / 2)), linhas = [];
  PROCESSOS.forEach(function (p) {
    const t = TIPO_PROC[p];
    if (!t || !procPermitido_(a, p) || (f.processo && f.processo !== p)) return;
    lerAba_('Cad_Estrutura').filter(function (e) { return e.Tipo === t && (!f.doca || e.Identificador === f.doca); }).forEach(function (e) {
      const l = g[p + '|' + e.Identificador] || [], st = stat_(l, cfg);
      const h1 = l.filter(function (r) { return r.ts.slice(0, 10) < meio; }), h2 = l.filter(function (r) { return r.ts.slice(0, 10) >= meio; });
      const ult = l.slice().sort(function (x, y) { return y.ts.localeCompare(x.ts); })[0];
      linhas.push({
        proc: p, id: e.Identificador, simbolo: e.Cor_Simbolo, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r,
        faixa: st.n ? faixa_(st.media, cfg) : '', ult: ult ? ult.ts : '', tend: h1.length && h2.length ? round1_(stat_(h2, cfg).media - stat_(h1, cfg).media) : null
      });
    });
  });
  return { linhas: linhas };
}
function relColab_(a, f, cfg) {
  const rows = auditorias_(a, f, false), linhasC = {}, times = {};
  rows.forEach(function (r) {
    r.colabs.forEach(function (c) {
      if (f.colaborador && c.n !== f.colaborador) return;
      if (f.lider && c.l !== f.lider) return;
      const o = linhasC[c.n] = linhasC[c.n] || { nome: c.n, lider: c.l, turno: c.t, rs: [], ult: '' };
      o.rs.push(r); if (r.ts >= o.ult) { o.ult = r.ts; o.lider = c.l; o.turno = c.t; }
    });
    r.lids.forEach(function (l) { if (f.lider && l !== f.lider) return; (times[l] = times[l] || []).push(r); });
  });
  const wk = serieSemanal_(f, [], cfg).map(function (x) { return x.k; }).slice(-8), poucas = cfg.POUCAS_AUDITORIAS;
  const colabs = Object.keys(linhasC).map(function (k) {
    const o = linhasC[k], st = stat_(o.rs, cfg), gw = agrupar_(o.rs, function (r) { return segunda_(r.ts.slice(0, 10)); });
    const serie = wk.map(function (c) { return gw[c] ? stat_(gw[c], cfg).media : null; });
    return { nome: o.nome, lider: o.lider, turno: o.turno, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, ult: o.ult, serie: serie, pouca: st.n < poucas };
  }).sort(function (x, y) {
    // pior nota entre quem tem auditorias suficientes; quem tem poucas auditorias vem depois, com menos auditorias primeiro
    if (x.pouca !== y.pouca) return x.pouca ? 1 : -1;
    return (x.pouca ? x.n - y.n : x.media - y.media) || x.nome.localeCompare(y.nome, 'pt-BR');
  });
  const sem = [];
  if (!f.colaborador && !f.processo && !f.doca && !f.auditor && !f.faixa) {
    lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Colaborador' && ativo_(p) && !linhasC[p.Nome] && (!f.lider || p.Lider === f.lider) && (!f.turno || p.Turno === f.turno) && pessoaNoEscopo_(a, p); })
      .forEach(function (p) { sem.push({ nome: p.Nome, lider: p.Lider, turno: p.Turno }); });
  }
  const eq = Object.keys(times).map(function (k) {
    const st = stat_(times[k], cfg), nomes = {};
    times[k].forEach(function (r) { r.colabs.forEach(function (c) { if (c.l === k) nomes[c.n] = 1; }); });
    return { lider: k, n: st.n, media: st.media, v: st.v, o: st.o, r: st.r, colabs: Object.keys(nomes).length };
  }).sort(function (x, y) { return y.n - x.n; });
  return { colabs: colabs, semAuditoria: sem.slice(0, 300), totalSem: sem.length, times: eq };
}
function relTend_(a, f, cfg) {
  const rows = auditorias_(a, f, false), b = baldes_(f), idx = {}, g = agrupar_(rows, function (r) { return b.de(r); });
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  const serie = b.chaves.map(function (k) { const st = stat_(g[k] || [], cfg); return { k: k, n: st.n, m: st.n ? st.media : null, v: st.v, o: st.o, r: st.r }; });
  const porProc = {};
  PROCESSOS.filter(function (p) { return procPermitido_(a, p) && (!f.processo || f.processo === p); }).forEach(function (p) {
    const soma = b.chaves.map(function () { return 0; }), cnt = b.chaves.map(function () { return 0; });
    rows.filter(function (r) { return r.proc === p; }).forEach(function (r) { const i = idx[b.de(r)]; if (i !== undefined) { soma[i] += r.pct; cnt[i]++; } });
    porProc[p] = soma.map(function (s, i) { return cnt[i] ? round1_(s / cnt[i]) : null; });
  });
  const dias = difDias_(f.de, f.ate) + 1, metade = Math.floor(rows.length / 2), ord = rows.slice().sort(function (x, y) { return x.ts.localeCompare(y.ts); });
  const m1 = stat_(ord.slice(0, metade), cfg).media, m2 = stat_(ord.slice(metade), cfg).media;
  return { modo: b.modo, cols: b.chaves, serie: serie, porProc: porProc, dias: dias, delta: rows.length >= 4 ? round1_(m2 - m1) : null, total: rows.length };
}
function relDetalhe_(a, f, cfg, ex) {
  let g = Object.assign({}, f), titulo = '', sub = '';
  if (ex.kind === 'doca') {
    const p = ex.chave.split('|');
    if (p.length !== 2 || PROCESSOS.indexOf(p[0]) < 0 || !TIPO_PROC[p[0]]) throw new Error('Unidade inválida.');
    if (!procPermitido_(a, p[0])) throw new Error('Sem acesso a este processo.');
    g.processo = p[0]; g.doca = p[1]; titulo = p[1]; sub = p[0] + ' · ' + TIPO_PROC[p[0]];
  } else if (ex.kind === 'colab') { g.colaborador = ex.chave; titulo = ex.chave; sub = 'Colaborador'; }
  else if (ex.kind === 'lider') { g.lider = ex.chave; titulo = 'Time ' + ex.chave; sub = 'Equipe'; }
  else throw new Error('Tipo inválido.');
  const rows = auditorias_(a, g, true).sort(function (x, y) { return y.ts.localeCompare(x.ts); }), st = stat_(rows, cfg), b = baldes_(g), idx = {};
  b.chaves.forEach(function (k, i) { idx[k] = i; });
  const soma = b.chaves.map(function () { return 0; }), cnt = b.chaves.map(function () { return 0; });
  rows.forEach(function (r) { const i = idx[b.de(r)]; if (i !== undefined) { soma[i] += r.pct; cnt[i]++; } });
  const pp = agrupar_(rows, function (r) { return r.proc; });
  return {
    titulo: titulo, sub: sub, kind: ex.kind, chave: ex.chave, kpis: st, ultima: rows[0] ? rows[0].ts : '',
    melhor: rows.length ? Math.max.apply(null, rows.map(function (r) { return r.pct; })) : null, pior: rows.length ? Math.min.apply(null, rows.map(function (r) { return r.pct; })) : null,
    modo: b.modo, cols: b.chaves, serie: soma.map(function (s, i) { return cnt[i] ? round1_(s / cnt[i]) : null; }),
    porProc: Object.keys(pp).map(function (k) { const s = stat_(pp[k], cfg); return { proc: k, n: s.n, media: s.media }; }),
    of: top_(rows, 8),
    hist: rows.slice(0, 40).map(function (r) { return { id: r.id, ts: r.ts, proc: r.proc, doca: r.doca, colab: r.colab, turno: r.turno, pct: r.pct, faixa: r.faixa }; })
  };
}
function relExport_(a, f, cfg, ex) {
  const rows = auditorias_(a, f, false).sort(function (x, y) { return y.ts.localeCompare(x.ts) || y.id.localeCompare(x.id); });
  const part = rows.slice(ex.offset, ex.offset + EXPORT_LOTE);
  return {
    total: rows.length, offset: ex.offset, fim: ex.offset + part.length >= rows.length,
    linhas: part.map(function (r) { return [r.id, r.ts, r.proc, r.doca, r.colab, r.lider, r.turno, r.resp, r.pct, r.status, r.obs]; })
  };
}

/* ---------- metas ---------- */
function statusMeta_(feito, qtd, ini, fim, hoje) {
  if (feito >= qtd) return 'atingida';
  if (hoje < ini) return 'futura';
  if (hoje > fim) return 'nao_atingida';
  const total = difDias_(ini, fim) + 1, dec = difDias_(ini, hoje) + 1, esperado = qtd * dec / total;
  return feito >= esperado * 0.8 ? 'no_ritmo' : 'em_risco';
}
function metaOut_(m) {
  return { id: m.ID_Meta, tipo: m.Tipo_Alvo, alvo: m.Alvo, qtd: Number(m.Quantidade), processos: String(m.Processos || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean), ini: String(m.Inicio), fim: String(m.Fim), desc: m.Descricao, criadaPor: m.Criada_Por, criadaEm: m.Criada_Em, ativa: String(m.Ativa) !== 'Não' };
}
/** Só auditorias FINALIZADAS contam (rascunho não está no histórico). Conta por auditor, no período e nos processos da meta. */
function contarMeta_(rows, m, user) {
  const nome = semAcento_(user.nome);
  return rows.filter(function (r) {
    const d = r.ts.slice(0, 10);
    if (d < m.ini || d > m.fim) return false;
    if (m.processos.length && m.processos.indexOf(r.proc) < 0) return false;
    return r.email ? r.email === user.email : semAcento_(r.resp) === nome;
  }).length;
}
function alvosMeta_(m, users) {
  return users.filter(function (u) { return m.tipo === 'Pessoa' ? String(u.Email_Google).trim().toLowerCase() === String(m.alvo).trim().toLowerCase() : u.Perfil === m.alvo; })
    .map(function (u) { return { email: String(u.Email_Google).trim().toLowerCase(), nome: String(u.Nome) }; });
}
function metasProgresso_(a, hoje, users) {
  const metas = lerDireto_('Metas').map(metaOut_).filter(function (m) { return m.fim >= addDias_(hoje, -90); });
  if (!metas.length) return [];
  const de = metas.reduce(function (x, m) { return m.ini < x ? m.ini : x; }, metas[0].ini), ate = metas.reduce(function (x, m) { return m.fim > x ? m.fim : x; }, metas[0].fim);
  const lim = { de: de, ate: ate > hoje ? ate : hoje, processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '' };
  if ((difDias_(lim.de, lim.ate)) > MAX_PERIODO_DIAS * 2) lim.de = addDias_(lim.ate, -MAX_PERIODO_DIAS * 2);
  const rows = auditorias_(a, lim, false);
  return metas.map(function (m) {
    m.alvos = alvosMeta_(m, users).map(function (u) { const feito = contarMeta_(rows, m, { email: u.email, nome: u.nome }); return { email: u.email, nome: u.nome, feito: feito, status: m.ativa ? statusMeta_(feito, m.qtd, m.ini, m.fim, hoje) : 'inativa' }; });
    return m;
  });
}
function minhasMetas() {
  const a = exigirTela_('minhas'), hoje = hoje_(), proprio = Object.assign({}, a, { escopo: { modo: 'proprias', processos: [], turnos: [] } });
  const metas = lerDireto_('Metas').map(metaOut_).filter(function (m) {
    return m.ativa && m.fim >= addDias_(hoje, -30) && ((m.tipo === 'Pessoa' && String(m.alvo).trim().toLowerCase() === a.email) || (m.tipo === 'Perfil' && m.alvo === a.perfil));
  });
  if (!metas.length) return [];
  const de = metas.reduce(function (x, m) { return m.ini < x ? m.ini : x; }, metas[0].ini);
  const rows = auditorias_(proprio, { de: de, ate: hoje > metas[0].fim ? hoje : metas.reduce(function (x, m) { return m.fim > x ? m.fim : x; }, hoje), processo: '', doca: '', turno: '', lider: '', colaborador: '', auditor: '', faixa: '' }, false);
  return metas.map(function (m) { const feito = contarMeta_(rows, m, a); m.feito = feito; m.status = statusMeta_(feito, m.qtd, m.ini, m.fim, hoje); return m; });
}
function salvarMeta(obj) {
  const a = exigirPerm_('metas'), erros = {}, o = obj || {};
  const pf = perfis_(), users = lerAba_('Cad_Usuarios').filter(ativo_);
  const tipo = String(o.tipo || '').trim(), alvo = String(o.alvo || '').trim().toLowerCase() === '' ? '' : String(o.alvo).trim();
  const qtd = Number(o.qtd);
  if (['Pessoa', 'Perfil'].indexOf(tipo) < 0) erros.tipo = 'Escolha pessoa ou perfil.';
  else if (!alvo) erros.alvo = 'Selecione para quem é a meta.';
  else if (tipo === 'Pessoa' && !users.some(function (u) { return String(u.Email_Google).trim().toLowerCase() === alvo.toLowerCase() && pf[u.Perfil] && tem_({ perms: pf[u.Perfil].perms }, 'auditar'); })) erros.alvo = 'Usuário ativo com permissão de auditar não encontrado.';
  else if (tipo === 'Perfil' && !(pf[alvo] && pf[alvo].perms.indexOf('auditar') > -1)) erros.alvo = 'Perfil inexistente ou sem permissão de auditar.';
  if (vazio_(o.qtd) || isNaN(qtd) || qtd < 1 || qtd > 9999 || Math.floor(qtd) !== qtd) erros.qtd = 'Informe um número inteiro entre 1 e 9999.';
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(String(o.ini))) erros.ini = 'Informe a data inicial.';
  if (!re.test(String(o.fim))) erros.fim = 'Informe a data final.';
  if (!erros.ini && !erros.fim && String(o.ini) > String(o.fim)) erros.fim = 'A data final deve ser igual ou posterior à inicial.';
  const procs = (Array.isArray(o.processos) ? o.processos : []).map(String);
  if (procs.some(function (p) { return PROCESSOS.indexOf(p) < 0; })) erros.processos = 'Processo inválido.';
  const desc = String(o.desc || '').trim();
  if (desc.length > 200) erros.desc = 'Máximo de 200 caracteres.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  return comLock_(function () {
    const s = aba_('Metas'), linha = [null, tipo, tipo === 'Pessoa' ? alvo.toLowerCase() : alvo, qtd, procs.join(','), o.ini, o.fim, limpar_(desc), limpar_(a.nome), agora_(), o.ativa === false ? 'Não' : 'Sim'];
    if (o.id) {
      const ex = lerDireto_('Metas').find(function (m) { return m.ID_Meta === String(o.id); });
      if (!ex) return { ok: false, msg: 'Meta não encontrada. Atualize a tela.' };
      linha[0] = ex.ID_Meta; linha[8] = ex.Criada_Por; linha[9] = ex.Criada_Em;
      (TEXTO_COLS.Metas || []).forEach(function (c) { s.getRange(ex._row, c).setNumberFormat('@'); });
      s.getRange(ex._row, 1, 1, linha.length).setValues([linha]);
    } else { linha[0] = 'MET-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000); anexar_('Metas', linha); }
    bumpHv_();
    return { ok: true, metas: metasProgresso_(a, hoje_(), lerAba_('Cad_Usuarios').filter(ativo_)) };
  });
}
function excluirMeta(id) {
  const a = exigirPerm_('metas');
  return comLock_(function () {
    const ex = lerDireto_('Metas').find(function (m) { return m.ID_Meta === String(id); });
    if (!ex) return { ok: false, msg: 'Meta não encontrada. Atualize a tela.' };
    aba_('Metas').deleteRow(ex._row);
    bumpHv_();
    return { ok: true, metas: metasProgresso_(a, hoje_(), lerAba_('Cad_Usuarios').filter(ativo_)) };
  });
}

/* ---------- cadastros e configurações ---------- */
function validarCadastro_(aba, o) {
  const e = {}, campos = ABAS[aba];
  OBRIG[aba].forEach(function (c) { if (vazio_(o[c])) e[c] = 'Campo obrigatório.'; });
  campos.forEach(function (c) {
    if (!e[c] && ENUMS[c] && !vazio_(o[c]) && ENUMS[c].indexOf(String(o[c]).trim()) < 0) e[c] = 'Valor inválido.';
    if (!e[c] && String(o[c] == null ? '' : o[c]).length > (MAXLEN[c] || 120)) e[c] = 'Máximo de ' + (MAXLEN[c] || 120) + ' caracteres.';
  });
  ['Identificador', 'Nome', 'ID_Subprocesso'].forEach(function (c) { if (!e[c] && /^(__proto__|constructor|prototype)$/i.test(String(o[c] == null ? '' : o[c]).trim())) e[c] = 'Nome reservado pelo sistema.'; });
  const todos = lerDireto_(aba).filter(function (x) { return x._row !== o._row; });
  const lideres = lerDireto_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return p.Nome; });
  const igual = function (x, y) { return String(x).trim().toLowerCase() === String(y).trim().toLowerCase(); };
  if (aba === 'Cad_Estrutura') {
    if (!e.Cor_Simbolo) {
      const cs = canonCS_(o.Cor_Simbolo);
      if (!cs) e.Cor_Simbolo = 'Escolha a cor e o símbolo da lista.'; else o.Cor_Simbolo = cs;
    }
    if (!e.Identificador && todos.some(function (x) { return x.Tipo === o.Tipo && igual(x.Identificador, o.Identificador); })) e.Identificador = 'Já existe ' + (o.Tipo === 'Doca' ? 'uma doca' : 'um cluster') + ' com este identificador.';
    if (!vazio_(o.Lider_Padrao) && lideres.indexOf(o.Lider_Padrao) < 0) e.Lider_Padrao = 'Líder não cadastrado ou inativo.';
  }
  if (aba === 'Cad_Pessoas') {
    if (!e.Nome && /[;|]/.test(o.Nome)) e.Nome = 'O nome não pode conter ; ou |.';
    if (!e.Nome && todos.some(function (x) { return igual(x.Nome, o.Nome); })) e.Nome = 'Já existe uma pessoa com este nome.';
    if (o.Cargo === 'Colaborador') {
      if (vazio_(o.Lider)) e.Lider = 'Informe o líder do colaborador.';
      else if (lideres.indexOf(o.Lider) < 0) e.Lider = 'Líder não cadastrado ou inativo.';
    }
  }
  if (aba === 'Cad_Processos_Perguntas' && !e.Descricao_Item && !e.Processo &&
    todos.some(function (x) { return x.Processo === o.Processo && igual(x.Descricao_Item, o.Descricao_Item); })) e.Descricao_Item = 'Este item já existe neste processo.';
  return e;
}
function confere_(aba, row, orig) {
  if (!orig) return false;
  const s = aba_(aba);
  if (row < 2 || row > s.getLastRow()) return false;
  const v = s.getRange(row, 1, 1, ABAS[aba].length).getValues()[0];
  return ABAS[aba].every(function (c, i) { return String(v[i]) === String(orig[c] === undefined ? '' : orig[c]); });
}
function renomearRef_(aba, coluna, de, para) {
  const s = aba_(aba);
  if (s.getLastRow() < 2) return;
  const r = s.getRange(2, coluna, s.getLastRow() - 1, 1), v = r.getValues();
  let mudou = false;
  v.forEach(function (l) { if (l[0] === de) { l[0] = para; mudou = true; } });
  if (mudou) r.setValues(v);
}
function listarCadastro(aba) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  exigirPerm_(PERM_CAD[aba]);
  return lerDireto_(aba);
}
function salvarCadastro(aba, obj, orig) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  exigirPerm_(PERM_CAD[aba]);
  if (COLS_NOVAS[aba]) garantirAba_(aba); // planilha ainda sem as colunas de tradução: completa o cabeçalho antes de gravar
  obj = obj || {};
  const o = { _row: obj._row ? Number(obj._row) : 0 };
  ABAS[aba].forEach(function (c) { o[c] = obj[c] === undefined || obj[c] === null ? '' : (typeof obj[c] === 'string' ? obj[c].trim() : obj[c]); });
  if (aba === 'Cad_Pessoas' && o.Cargo === 'Líder') o.Lider = '';
  return comLock_(function () {
    const erros = validarCadastro_(aba, o);
    if (Object.keys(erros).length) return { ok: false, erros: erros };
    if (o._row && !confere_(aba, o._row, orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    const linha = ABAS[aba].map(function (c) { return limpar_(o[c]); });
    const s = aba_(aba);
    if (o._row) {
      (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(o._row, c).setNumberFormat('@'); });
      s.getRange(o._row, 1, 1, linha.length).setValues([linha]);
      if (aba === 'Cad_Pessoas' && orig.Cargo === 'Líder' && orig.Nome !== linha[0]) {
        renomearRef_('Cad_Pessoas', 5, orig.Nome, linha[0]);
        renomearRef_('Cad_Estrutura', 4, orig.Nome, linha[0]);
      }
    } else anexar_(aba, linha);
    limparCache_();
    return { ok: true, linhas: lerDireto_(aba) };
  });
}
function excluirCadastro(aba, row, orig) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  exigirPerm_(PERM_CAD[aba]);
  return comLock_(function () {
    if (!confere_(aba, Number(row), orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    if (aba === 'Cad_Pessoas' && orig.Cargo === 'Líder') {
      const n = lerDireto_('Cad_Pessoas').filter(function (p) { return p.Lider === orig.Nome; }).length;
      if (n) return { ok: false, msg: 'Não é possível excluir: ' + n + ' colaborador(es) vinculado(s) a este líder. Reatribua-os antes.' };
    }
    aba_(aba).deleteRow(Number(row));
    limparCache_();
    return { ok: true, linhas: lerDireto_(aba) };
  });
}
/** Troca de lugar com o item vizinho do mesmo processo (ordem do formulário). dir: -1 sobe, +1 desce. */
function moverCadastro(aba, row, orig, dir) {
  if (aba !== 'Cad_Processos_Perguntas') throw new Error('Aba inválida.');
  exigirPerm_(PERM_CAD[aba]);
  const r = Number(row), d = Number(dir) < 0 ? -1 : 1;
  return comLock_(function () {
    if (!confere_(aba, r, orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    const todos = lerDireto_(aba), a = todos.find(function (x) { return x._row === r; }), b = todos.find(function (x) { return x._row === r + d; });
    if (!b || b.Processo !== a.Processo) return { ok: true, linhas: todos };
    const s = aba_(aba), n = ABAS[aba].length;
    (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(r, c).setNumberFormat('@'); s.getRange(r + d, c).setNumberFormat('@'); });
    s.getRange(r, 1, 1, n).setValues([ABAS[aba].map(function (c) { return limpar_(b[c]); })]);
    s.getRange(r + d, 1, 1, n).setValues([ABAS[aba].map(function (c) { return limpar_(a[c]); })]);
    limparCache_();
    return { ok: true, linhas: lerDireto_(aba) };
  });
}
/** Desfazer exclusão: recoloca o item na posição original (ou no fim, se a planilha mudou). */
function restaurarCadastro(aba, obj, pos) {
  if (CADASTROS.indexOf(aba) < 0) throw new Error('Aba inválida.');
  exigirPerm_(PERM_CAD[aba]);
  const o = { _row: 0 };
  ABAS[aba].forEach(function (c) { o[c] = obj && obj[c] !== undefined && obj[c] !== null ? (typeof obj[c] === 'string' ? obj[c].trim() : obj[c]) : ''; });
  return comLock_(function () {
    const erros = validarCadastro_(aba, o);
    if (Object.keys(erros).length) return { ok: false, erros: erros, msg: 'Não foi possível desfazer: o item já existe ou os dados mudaram.' };
    const s = aba_(aba), linha = ABAS[aba].map(function (c) { return limpar_(o[c]); }), p = Number(pos);
    if (p >= 2 && p <= s.getLastRow()) {
      s.insertRowBefore(p);
      (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(p, c).setNumberFormat('@'); });
      s.getRange(p, 1, 1, linha.length).setValues([linha]);
    } else anexar_(aba, linha);
    limparCache_();
    return { ok: true, linhas: lerDireto_(aba) };
  });
}
function gravarConfig_(param, valor) {
  const s = aba_('Configuracoes'), r = lerDireto_('Configuracoes').find(function (x) { return x.Parametro === param; });
  if (r) s.getRange(r._row, 2).setValue(valor); else s.appendRow([param, valor]);
}
/** Salva vida útil, nota de corte, nota média e a regra "vários colaboradores" por processo (valida: 0 <= corte < média <= 100). */
function salvarConfigs(p) {
  exigirPerm_('config');
  p = p || {};
  const dias = Number(p.dias), corte = Number(p.corte), media = Number(p.media), erros = {};
  if (vazio_(p.dias) || isNaN(dias) || dias < 1 || Math.floor(dias) !== dias) erros.dias = 'Informe um número inteiro de dias, 1 ou mais.';
  if (vazio_(p.corte) || isNaN(corte) || corte < 0 || corte > 100) erros.corte = 'Informe um valor entre 0 e 100.';
  if (vazio_(p.media) || isNaN(media) || media > 100 || media < 0) erros.media = 'Informe um valor entre 0 e 100.';
  else if (!erros.corte && media <= corte) erros.media = 'A nota média deve ser maior que a nota de corte.';
  const poucas = vazio_(p.poucas) ? null : Number(p.poucas);
  if (poucas !== null && (isNaN(poucas) || poucas < 1 || poucas > 50 || Math.floor(poucas) !== poucas)) erros.poucas = 'Informe um número inteiro entre 1 e 50.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  comLock_(function () {
    if (poucas !== null) gravarConfig_('POUCAS_AUDITORIAS', poucas);
    gravarConfig_('DIAS_VIDA_UTIL_AUDITORIA', dias);
    gravarConfig_('NOTA_CORTE_PCT', corte);
    gravarConfig_('NOTA_MEDIA_PCT', media);
    if (p.multi && typeof p.multi === 'object') PROCESSOS.forEach(function (pr) { if (pr in p.multi) gravarConfig_('MULTI_COLAB_' + pr, p.multi[pr] === true ? 'Sim' : 'Não'); });
    limparCache_();
  });
  return { ok: true, config: config_() };
}

/* ---------- relatório por e-mail (v7) ---------- */
const MAIL_REL = {
  pt: {
    assunto: 'Relatório de auditorias - Process Check', titulo: 'Relatório de auditorias', periodo: 'Período', escopo: 'Dados do seu perfil',
    todos: 'Todos os dados', time: 'Equipe de {0}', proprias: 'Somente as auditorias que você realizou', so: 'Somente {0}',
    total: 'Auditorias', media: 'Nota média', meta: 'Meta', conf: 'Em conformidade', obs: 'Em observação', bad: 'Em inconformidade', crit: 'Com item crítico reprovado', pend: 'Sem auditoria no período',
    vs: 'vs. período anterior', semBase: 'sem base de comparação', pp: 'Pontos', pr: 'Por processo', col: 'Processo', n: 'Auditorias', nota: 'Média', of: 'Principais ofensores', ofLinha: '{0} falhas em {1} auditorias ({2}%)',
    aten: 'Prioridade de verificação', vazio: 'Nenhuma auditoria no seu escopo neste período.', botao: 'Abrir o sistema', rodape: 'Você recebe este e-mail porque foi incluído(a) no envio de relatórios. Ele mostra apenas os dados que o seu perfil autoriza. Para sair da lista, fale com o administrador do sistema.',
    freq: { Diario: 'diário', Semanal: 'semanal', Mensal: 'mensal' }
  },
  en: {
    assunto: 'Audit report - Process Check', titulo: 'Audit report', periodo: 'Period', escopo: 'Data of your profile',
    todos: 'All data', time: 'Team of {0}', proprias: 'Only the audits you performed', so: 'Only {0}',
    total: 'Audits', media: 'Average score', meta: 'Target', conf: 'Compliant', obs: 'Under observation', bad: 'Non-compliant', crit: 'With failed critical item', pend: 'Not audited in the period',
    vs: 'vs. previous period', semBase: 'no baseline to compare', pp: 'pts', pr: 'By process', col: 'Process', n: 'Audits', nota: 'Average', of: 'Top offenders', ofLinha: '{0} failures in {1} audits ({2}%)',
    aten: 'Priority to check', vazio: 'No audits in your scope for this period.', botao: 'Open the system', rodape: 'You receive this e-mail because you were added to the report mailing list. It only shows the data your profile allows. To leave the list, contact the system administrator.',
    freq: { Diario: 'daily', Semanal: 'weekly', Mensal: 'monthly' }
  },
  es: {
    assunto: 'Informe de auditorías - Process Check', titulo: 'Informe de auditorías', periodo: 'Período', escopo: 'Datos de su perfil',
    todos: 'Todos los datos', time: 'Equipo de {0}', proprias: 'Solo las auditorías que usted realizó', so: 'Solo {0}',
    total: 'Auditorías', media: 'Nota promedio', meta: 'Meta', conf: 'Conformes', obs: 'En observación', bad: 'No conformes', crit: 'Con ítem crítico reprobado', pend: 'Sin auditoría en el período',
    vs: 'vs. período anterior', semBase: 'sin base de comparación', pp: 'pts', pr: 'Por proceso', col: 'Proceso', n: 'Auditorías', nota: 'Promedio', of: 'Principales infractores', ofLinha: '{0} fallas en {1} auditorías ({2}%)',
    aten: 'Prioridad de verificación', vazio: 'No hay auditorías en su alcance en este período.', botao: 'Abrir el sistema', rodape: 'Usted recibe este correo porque fue incluido(a) en el envío de informes. Solo muestra los datos que su perfil autoriza. Para salir de la lista, hable con el administrador del sistema.',
    freq: { Diario: 'diario', Semanal: 'semanal', Mensal: 'mensual' }
  }
};
const COR_FAIXA = { verde: '#16A34A', observacao: '#F59E0B', vermelho: '#DC2626' };
function fmtMail_(t, args) { return String(t).replace(/\{(\d)\}/g, function (x, i) { return esc_(args[Number(i)]); }); }
/** Período do relatório: o dia anterior (diário), os 7 dias (semanal) ou os 30 dias (mensal) terminando ontem. */
function periodoEmail_(freq) {
  const ate = addDias_(hoje_(), -1), dias = freq === 'Mensal' ? 30 : freq === 'Semanal' ? 7 : 1;
  return { de: addDias_(ate, -(dias - 1)), ate: ate };
}
function devidoHoje_(freq) {
  const d = new Date(hoje_() + 'T00:00:00Z');
  return freq === 'Diario' || (freq === 'Semanal' && d.getUTCDay() === 1) || (freq === 'Mensal' && d.getUTCDate() === 1);
}
function escopoTexto_(a, m) {
  const e = a.escopo;
  let t = e.modo === 'todos' ? m.todos : e.modo === 'time' ? fmtMail_(m.time, [a.nome]) : m.proprias;
  const lim = e.processos.filter(function (p) { return PROCESSOS.indexOf(p) > -1; }).concat(e.turnos);
  if (lim.length) t += ' · ' + fmtMail_(m.so, [lim.join(', ')]);
  return t;
}
/** Monta o e-mail com os dados que o perfil do DESTINATÁRIO enxerga (usa o mesmo portão único de dados dos relatórios). */
function montarEmailRel_(a, idioma, per) {
  const m = MAIL_REL[idiomaOk_(idioma)], cfg = config_(), f = filtros_({ de: per.de, ate: per.ate });
  const g = relGeral_(a, f, cfg), A = g.A, B = g.B, url = urlApp_();
  const cel = function (rot, val, cor) {
    return '<td style="padding:10px 8px;text-align:center;border:1px solid #E4E7EB;border-radius:6px"><div style="font-size:11px;color:#6B7280">' + esc_(rot) + '</div><div style="font-size:20px;font-weight:bold;color:' + (cor || '#1F2328') + '">' + esc_(val) + '</div></td>';
  };
  const dif = A.total && B.total ? round1_(A.media - B.media) : null;
  const cmp = dif === null ? m.semBase : (dif > 0 ? '+' : '') + dif.toFixed(1) + ' ' + m.pp + ' ' + m.vs;
  const fxA = faixa_(A.media, cfg);
  const kpis = '<table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0"><tr>'
    + cel(m.total, A.total) + cel(m.media, A.total ? A.media.toFixed(1) + '%' : '-', A.total ? COR_FAIXA[fxA] : '') + cel(m.meta, cfg.NOTA_MEDIA_PCT + '%') + '</tr><tr>'
    + cel(m.conf, A.conf, COR_FAIXA.verde) + cel(m.obs, A.obs, COR_FAIXA.observacao) + cel(m.bad, A.bad, COR_FAIXA.vermelho) + '</tr><tr>'
    + cel(m.crit, A.crit) + cel(m.pend, A.pend) + '<td></td></tr></table>';
  let corpo = '';
  if (A.total) {
    const procs = PROCESSOS.filter(function (p) { return A.pp[p]; });
    corpo += '<div style="font-size:12px;color:#6B7280;margin:4px 0 12px">' + esc_(cmp) + '</div>' + kpis
      + '<div style="font-size:14px;font-weight:bold;margin:18px 0 6px">' + esc_(m.pr) + '</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;border-collapse:collapse"><tr style="color:#6B7280;font-size:11px"><td style="padding:4px 0">' + esc_(m.col) + '</td><td align="right">' + esc_(m.n) + '</td><td align="right">' + esc_(m.nota) + '</td></tr>'
      + procs.map(function (p) {
        const x = A.pp[p];
        return '<tr><td style="padding:6px 0;border-top:1px solid #EEF0F2"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + COR_FAIXA[faixa_(x.media, cfg)] + ';margin-right:8px"></span>' + esc_(p) + '</td><td align="right" style="border-top:1px solid #EEF0F2">' + x.n + '</td><td align="right" style="border-top:1px solid #EEF0F2;font-weight:bold">' + x.media.toFixed(1) + '%</td></tr>';
      }).join('') + '</table>';
    if (g.ofd.length) {
      corpo += '<div style="font-size:14px;font-weight:bold;margin:18px 0 6px">' + esc_(m.of) + '</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">'
        + g.ofd.slice(0, 5).map(function (o) {
          const t = traducoesItens_(o.proc)[o.id] || {}, nome = (idiomaOk_(idioma) === 'en' ? t.en : idiomaOk_(idioma) === 'es' ? t.es : '') || o.id;
          return '<li><b>' + esc_(o.proc + ' › ' + nome) + '</b> - ' + fmtMail_(m.ofLinha, [o.nc, o.aud, o.taxa]) + '</li>';
        }).join('') + '</ul>';
    }
    const aten = Object.keys(A.dc).map(function (k) { return [k, A.dc[k].media]; }).filter(function (x) { return x[1] < cfg.NOTA_MEDIA_PCT; }).sort(function (x, y) { return x[1] - y[1]; }).slice(0, 3);
    if (aten.length) {
      corpo += '<div style="font-size:14px;font-weight:bold;margin:18px 0 6px">' + esc_(m.aten) + '</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">'
        + aten.map(function (x) { return '<li>' + esc_(x[0]) + ' - ' + x[1].toFixed(1) + '%</li>'; }).join('') + '</ul>';
    }
  } else corpo += '<p style="font-size:14px;color:#6B7280">' + esc_(m.vazio) + '</p>';
  const intervalo = per.de === per.ate ? per.de : per.de + ' a ' + per.ate;
  const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F5F7;padding:24px 0"><tr><td align="center">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border:1px solid #E4E7EB;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1F2328">'
    + '<tr><td style="background:#D9441A;padding:18px 28px;color:#FFFFFF;font-size:15px;font-weight:bold">Process Check</td></tr>'
    + '<tr><td style="padding:26px 28px 4px"><div style="font-size:22px;font-weight:bold">' + esc_(m.titulo) + '</div>'
    + '<div style="font-size:13px;color:#6B7280;margin-top:6px">' + esc_(m.periodo) + ': ' + esc_(intervalo) + '<br>' + esc_(m.escopo) + ': ' + esc_(escopoTexto_(a, m)) + '</div></td></tr>'
    + '<tr><td style="padding:8px 28px 8px">' + corpo + '</td></tr>'
    + (url ? '<tr><td style="padding:14px 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#D9441A" style="border-radius:6px"><a href="' + esc_(url) + '" style="display:inline-block;padding:11px 22px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none">' + esc_(m.botao) + '</a></td></tr></table></td></tr>' : '')
    + '<tr><td style="padding:20px 28px 24px;font-size:11px;color:#9AA3AD;border-top:1px solid #EEF0F2">' + esc_(m.rodape) + '</td></tr></table></td></tr></table>';
  const txt = [m.titulo, m.periodo + ': ' + intervalo, m.escopo + ': ' + escopoTexto_(a, m), '',
    m.total + ': ' + A.total, m.media + ': ' + (A.total ? A.media.toFixed(1) + '%' : '-') + ' (' + m.meta + ' ' + cfg.NOTA_MEDIA_PCT + '%)', m.conf + ': ' + A.conf, m.obs + ': ' + A.obs, m.bad + ': ' + A.bad, m.crit + ': ' + A.crit, m.pend + ': ' + A.pend,
    '', url ? m.botao + ': ' + url : '', '', m.rodape].join('\n');
  return { assunto: m.assunto + ' (' + intervalo + ')', html: html, texto: txt, total: A.total };
}
function linhasEmailRel_() {
  return lerDireto_('Cad_Relatorio_Email').filter(function (r) { return String(r.Email || '').trim(); });
}
/** Envia a UM destinatário. Nunca lança erro: devolve { ok, motivo } para que uma falha não derrube os outros envios. */
function enviarUmRel_(a, reg) {
  const email = emailDe_(reg.Email), freq = FREQS.indexOf(reg.Frequencia) > -1 ? reg.Frequencia : 'Semanal';
  try {
    const dest = acessoDe_(email);
    if (!dest.ok) return { email: email, ok: false, motivo: 'sem_acesso' };
    if (dest.telas.indexOf('geral') < 0) return { email: email, ok: false, motivo: 'sem_tela' };
    if (typeof MailApp.getRemainingDailyQuota === 'function' && MailApp.getRemainingDailyQuota() < 1) return { email: email, ok: false, motivo: 'cota' };
    const per = periodoEmail_(freq), msg = montarEmailRel_(dest, reg.Idioma, per);
    MailApp.sendEmail({ to: email, subject: msg.assunto, body: msg.texto, htmlBody: msg.html, name: 'Process Check' });
    // o e-mail já saiu: se só a gravação da data falhar, o envio continua contando como feito (e a falha vai para o log)
    try {
      const row = lerDireto_('Cad_Relatorio_Email').find(function (x) { return emailDe_(x.Email) === email; });
      if (row) aba_('Cad_Relatorio_Email').getRange(row._row, 5).setNumberFormat('@').setValue(agora_());
    } catch (e0) {
      try { registrar_(a, 'Relatório enviado, data do envio não gravada', email, String(e0 && e0.message || e0)); } catch (e00) { /* log best-effort */ }
    }
    try { registrar_(a, 'Relatório por e-mail enviado', email, 'Período: ' + per.de + ' a ' + per.ate + '; Idioma: ' + idiomaOk_(reg.Idioma)); } catch (e1) { /* log best-effort */ }
    return { email: email, ok: true, motivo: '' };
  } catch (e) {
    try { registrar_(a, 'Relatório por e-mail não enviado', email, String(e && e.message || e)); } catch (e2) { /* log best-effort */ }
    return { email: email, ok: false, motivo: 'erro' };
  }
}
function triggerRel_() {
  try { return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'enviarRelatoriosAgendados'; }); } catch (e) { return []; }
}
function emailRelOut_(a) {
  const us = lerAba_('Cad_Usuarios'), pf = perfis_(), por = {};
  us.forEach(function (u) { por[emailDe_(u.Email_Google)] = u; });
  const linhas = linhasEmailRel_().map(function (r) {
    const e = emailDe_(r.Email), u = por[e], p = u && pf[String(u.Perfil).trim()];
    return { email: e, nome: u ? String(u.Nome) : '', perfil: u ? String(u.Perfil) : '', freq: FREQS.indexOf(r.Frequencia) > -1 ? r.Frequencia : 'Semanal', idioma: idiomaOk_(r.Idioma), ativo: String(r.Ativo) !== 'Não', ultimo: String(r.Ultimo_Envio || ''), elegivel: !!(u && ativo_(u) && p && p.telas.indexOf('geral') > -1) };
  });
  const ja = {}; linhas.forEach(function (l) { ja[l.email] = 1; });
  const cand = us.filter(function (u) { const p = pf[String(u.Perfil).trim()]; return ativo_(u) && p && p.telas.indexOf('geral') > -1 && !ja[emailDe_(u.Email_Google)]; })
    .map(function (u) { return { email: emailDe_(u.Email_Google), nome: String(u.Nome), perfil: String(u.Perfil) }; });
  let cota = null; try { cota = typeof MailApp.getRemainingDailyQuota === 'function' ? MailApp.getRemainingDailyQuota() : null; } catch (e) { cota = null; }
  return { ok: true, linhas: linhas, candidatos: cand, agendado: triggerRel_().length > 0, cota: cota };
}
function listarEmailRel() {
  const a = exigirPerm_('email_rel');
  return emailRelOut_(a);
}
function salvarEmailRel(obj) {
  const a = exigirPerm_('email_rel');
  obj = obj || {};
  const email = emailDe_(obj.email), freq = String(obj.freq || ''), idioma = idiomaOk_(obj.idioma), ativo = obj.ativo !== false;
  if (FREQS.indexOf(freq) < 0) return { ok: false, msg: 'Escolha a frequência.' };
  return comLock_(function () {
    const u = lerAba_('Cad_Usuarios').find(function (x) { return emailDe_(x.Email_Google) === email; });
    if (!u || !ativo_(u)) return { ok: false, msg: 'Usuário não cadastrado ou inativo.' };
    const p = perfis_()[String(u.Perfil).trim()];
    if (!p || p.telas.indexOf('geral') < 0) return { ok: false, msg: 'O perfil deste usuário não tem acesso à Visão Geral, então não pode receber o relatório.' };
    const ex = lerDireto_('Cad_Relatorio_Email').find(function (x) { return emailDe_(x.Email) === email; });
    if (ex) aba_('Cad_Relatorio_Email').getRange(ex._row, 1, 1, 4).setValues([[email, freq, idioma, ativo ? 'Sim' : 'Não']]);
    else {
      if (linhasEmailRel_().length >= 200) return { ok: false, msg: 'Limite de 200 destinatários.' };
      anexar_('Cad_Relatorio_Email', [email, freq, idioma, ativo ? 'Sim' : 'Não', '']);
    }
    registrar_(a, ex ? 'Relatório por e-mail alterado' : 'Relatório por e-mail: destinatário incluído', email, 'Frequência: ' + freq + '; Idioma: ' + idioma + '; Ativo: ' + (ativo ? 'Sim' : 'Não'));
    return Object.assign({}, emailRelOut_(a));
  });
}
function excluirEmailRel(email) {
  const a = exigirPerm_('email_rel');
  email = emailDe_(email);
  return comLock_(function () {
    const ex = lerDireto_('Cad_Relatorio_Email').find(function (x) { return emailDe_(x.Email) === email; });
    if (!ex) return { ok: false, msg: 'Destinatário não encontrado. Clique em Atualizar.' };
    aba_('Cad_Relatorio_Email').deleteRow(ex._row);
    registrar_(a, 'Relatório por e-mail: destinatário removido', email, '');
    return emailRelOut_(a);
  });
}
/** Liga ou desliga o envio agendado (um gatilho diário, às 7h; cada pessoa recebe conforme a frequência escolhida). */
function alternarAgendamentoRel(ligar) {
  const a = exigirPerm_('email_rel');
  return comLock_(function () {
    const ts = triggerRel_();
    if (ligar && !ts.length) ScriptApp.newTrigger('enviarRelatoriosAgendados').timeBased().everyDays(1).atHour(7).create();
    if (!ligar) ts.forEach(function (t) { ScriptApp.deleteTrigger(t); });
    registrar_(a, ligar ? 'Relatório por e-mail: agendamento ligado' : 'Relatório por e-mail: agendamento desligado', '', '');
    return emailRelOut_(a);
  });
}
function resumoEnvio_(res) {
  return { enviados: res.filter(function (r) { return r.ok; }).length, falhas: res.filter(function (r) { return !r.ok; }).map(function (r) { return { email: r.email, motivo: r.motivo }; }) };
}
/** "Enviar agora": um destinatário (email) ou todos os ativos (email vazio). */
function enviarRelatorioAgora(email) {
  const a = exigirPerm_('email_rel');
  email = emailDe_(email);
  const regs = linhasEmailRel_().filter(function (r) { return String(r.Ativo) !== 'Não' && (!email || emailDe_(r.Email) === email); });
  if (!regs.length) return { ok: false, msg: 'Nenhum destinatário ativo para enviar.' };
  const res = regs.map(function (r) { return enviarUmRel_(a, r); });
  const out = resumoEnvio_(res);
  out.ok = true; out.dados = emailRelOut_(a);
  return out;
}
/** Chamada pelo gatilho diário. Só o dono (ou o próprio gatilho) pode executar; envia apenas quem vence hoje e ainda não recebeu hoje. */
function enviarRelatoriosAgendados() {
  const ativo = (Session.getActiveUser().getEmail() || '').trim().toLowerCase(), dono = (Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (ativo && ativo !== dono) throw new Error('Acesso negado.');
  if (!ativo) {
    // chamada sem identidade (gatilho ou chamador não identificado): no máximo uma execução por hora, para limitar abuso
    const pr = PropertiesService.getScriptProperties(), ult = Number(pr.getProperty('ULT_AGENDADO') || 0);
    if (Date.now() - ult < 3600000) throw new Error('Acesso negado.');
    pr.setProperty('ULT_AGENDADO', String(Date.now()));
  }
  const hoje = hoje_(), ator = { nome: 'Agendamento', email: dono };
  const regs = linhasEmailRel_().filter(function (r) {
    return String(r.Ativo) !== 'Não' && devidoHoje_(FREQS.indexOf(r.Frequencia) > -1 ? r.Frequencia : 'Semanal') && String(r.Ultimo_Envio || '').slice(0, 10) !== hoje;
  });
  const resumo = resumoEnvio_(regs.map(function (r) { return enviarUmRel_(ator, r); }));
  if (resumo.falhas.length) {
    try { registrar_(ator, 'Agendamento com falhas', resumo.falhas.length + '/' + (resumo.enviados + resumo.falhas.length), resumo.falhas.map(function (x) { return x.email + ' (' + x.motivo + ')'; }).join('; ').slice(0, 450)); } catch (e) { /* log best-effort */ }
  }
  return resumo;
}

/* ---------- acessos: usuários, perfis, log ---------- */
function perfilOut_(p, meu) { return { nome: p.nome, desc: p.desc, perms: p.perms, telas: p.telas, escopo: p.escopo, sistema: p.sistema, protegido: p.nome === 'Admin', atribuivel: !!meu && contido_(p, meu) }; }
function listarAcessos() {
  const a = acesso_();
  if (!a.ok || !(tem_(a, 'usuarios') || tem_(a, 'perfis'))) throw new Error('Seu perfil não tem acesso a esta tela.');
  const pf = perfis_(), out = { perms: PERMS, telas: TELAS, processos: PROCESSOS, turnos: TURNOS, pode: { usuarios: tem_(a, 'usuarios'), perfis: tem_(a, 'perfis') }, meuPerfil: a.perfil };
  out.reqTela = REQ_TELA; out.permTela = PERM_TELA;
  out.perfis = Object.keys(pf).map(function (n) { return perfilOut_(pf[n], a.pf); });
  const contar = {};
  const us = lerDireto_('Cad_Usuarios');
  us.forEach(function (u) { contar[u.Perfil] = (contar[u.Perfil] || 0) + 1; });
  out.perfis.forEach(function (p) { p.usuarios = contar[p.nome] || 0; });
  if (tem_(a, 'usuarios')) { const lids = lideresAtivos_(); out.usuarios = us.map(function (u) { return marcarUsuario_(u, pf, a, lids); }); }
  out.log = lerDireto_('Log_Permissoes').slice(-200).reverse();
  if (tem_(a, 'perfis')) out.seguranca = diagnosticoSeg_(a);
  return out;
}
function dif_(rotulo, antes, depois) { return antes === depois ? '' : rotulo + ': ' + antes + ' → ' + depois; }
function salvarUsuario(obj, orig) {
  const a = exigirPerm_('usuarios'), erros = {}, o = obj || {}, pf = perfis_();
  const email = String(o.Email_Google || '').trim().toLowerCase(), nome = String(o.Nome || '').trim(), perfil = String(o.Perfil || '').trim(), ativo = String(o.Status_Ativo || '').trim();
  if (!email) erros.Email_Google = 'Campo obrigatório.'; else if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.Email_Google = 'E-mail inválido.';
  if (!nome) erros.Nome = 'Campo obrigatório.'; else if (nome.length > 120) erros.Nome = 'Máximo de 120 caracteres.';
  if (!perfil) erros.Perfil = 'Campo obrigatório.'; else if (!pf[perfil]) erros.Perfil = 'Perfil inexistente.'; else if (!contido_(pf[perfil], a.pf)) erros.Perfil = 'Você só pode atribuir perfis com permissões iguais ou menores que as suas.';
  if (['Sim', 'Não'].indexOf(ativo) < 0) erros.Status_Ativo = 'Valor inválido.';
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  const res = comLock_(function () {
    let sol = null;
    const todos = lerDireto_('Cad_Usuarios'), row = o._row ? Number(o._row) : 0, atual = row ? todos.find(function (x) { return x._row === row; }) : null;
    if (todos.some(function (x) { return x._row !== row && String(x.Email_Google).trim().toLowerCase() === email; })) return { ok: false, erros: { Email_Google: 'E-mail já cadastrado.' } };
    if (row) {
      if (!atual || !confere_('Cad_Usuarios', row, orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
      if (String(atual.Email_Google).trim().toLowerCase() === a.email) return { ok: false, msg: 'Você não pode alterar o seu próprio acesso.' };
      if (!pf[atual.Perfil] || !contido_(pf[atual.Perfil], a.pf)) return { ok: false, msg: 'Você não pode alterar um usuário com perfil acima do seu.' };
    }
    const novos = todos.filter(function (x) { return x._row !== row; }).concat([{ Perfil: perfil, Status_Ativo: ativo }]);
    if (!restaAdmin_(novos)) return { ok: false, erros: { Perfil: 'Mantenha ao menos um Admin ativo.' } };
    const linha = [limpar_(email), limpar_(nome), perfil, ativo], s = aba_('Cad_Usuarios');
    if (row) {
      (TEXTO_COLS.Cad_Usuarios).forEach(function (c) { s.getRange(row, c).setNumberFormat('@'); });
      s.getRange(row, 1, 1, 4).setValues([linha]);
      const d = [dif_('Perfil', atual.Perfil, perfil), dif_('Ativo', atual.Status_Ativo, ativo), dif_('Nome', atual.Nome, nome), dif_('E-mail', String(atual.Email_Google).toLowerCase(), email)].filter(Boolean).join('; ');
      if (d) registrar_(a, 'Usuário alterado', email, d);
    } else {
      anexar_('Cad_Usuarios', linha); registrar_(a, 'Usuário criado', email, 'Perfil: ' + perfil + '; Ativo: ' + ativo);
      sol = lerDireto_('Cad_Solicitacoes').find(function (x) { return emailDe_(x.Email) === email && String(x.Status) === 'Pendente'; });
      if (sol && ativo === 'Sim') {
        aba_('Cad_Solicitacoes').getRange(sol._row, 6, 1, 4).setValues([['Aprovada', limpar_(a.email), agora_(), perfil]]);
        registrar_(a, 'Cadastro aprovado', email, 'Perfil: ' + perfil);
      } else sol = null;
    }
    limparCache_();
    return { ok: true, _mail: sol ? { nome: nome, para: email, idioma: idiomaOk_(sol.Idioma) } : null, usuarios: lerDireto_('Cad_Usuarios').map(function (u) { return marcarUsuario_(u, pf, a, lideresAtivos_()); }) };
  });
  if (res && res.ok) {
    if (res._mail) res.email = enviarAprovacao_(a, res._mail.nome, res._mail.para, res._mail.idioma);
    delete res._mail;
  }
  return res;
}
function excluirUsuario(row, orig) {
  const a = exigirPerm_('usuarios'), pf = perfis_();
  return comLock_(function () {
    const todos = lerDireto_('Cad_Usuarios'), atual = todos.find(function (x) { return x._row === Number(row); });
    if (!atual || !confere_('Cad_Usuarios', Number(row), orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
    if (String(atual.Email_Google).trim().toLowerCase() === a.email) return { ok: false, msg: 'Você não pode excluir o seu próprio acesso.' };
    if (!pf[atual.Perfil] || !contido_(pf[atual.Perfil], a.pf)) return { ok: false, msg: 'Você não pode excluir um usuário com perfil acima do seu.' };
    if (!restaAdmin_(todos.filter(function (x) { return x._row !== Number(row); }))) return { ok: false, msg: 'Não é possível excluir o último Admin ativo.' };
    aba_('Cad_Usuarios').deleteRow(Number(row));
    registrar_(a, 'Usuário excluído', String(atual.Email_Google).toLowerCase(), 'Perfil: ' + atual.Perfil);
    limparCache_();
    return { ok: true, usuarios: lerDireto_('Cad_Usuarios').map(function (u) { return marcarUsuario_(u, pf, a, lideresAtivos_()); }) };
  });
}
function salvarPerfil(obj, novo) {
  const a = exigirPerm_('perfis'), erros = {}, o = obj || {}, pf = perfis_();
  const nome = String(o.nome || '').trim(), desc = String(o.desc || '').trim();
  if (!nome) erros.nome = 'Campo obrigatório.';
  else if (nome.length < 2 || nome.length > 40 || !/^[0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ \-]*$/.test(nome)) erros.nome = 'Use de 2 a 40 letras, números, espaço ou hífen.';
  else if (novo && Object.keys(pf).some(function (n) { return semAcento_(n) === semAcento_(nome); })) erros.nome = 'Já existe um perfil com este nome.';
  else if (!novo && !pf[nome]) erros.nome = 'Perfil não encontrado. Atualize a tela.';
  if (desc.length > 200) erros.desc = 'Máximo de 200 caracteres.';
  const permsIn = Array.isArray(o.perms) ? o.perms.map(String) : [], telasIn = Array.isArray(o.telas) ? o.telas.map(String) : [];
  if (permsIn.some(function (x) { return PERM_IDS.indexOf(x) < 0; })) erros.perms = 'Permissão inválida.';
  if (telasIn.some(function (x) { return TELA_IDS.indexOf(x) < 0; })) erros.telas = 'Tela inválida.';
  const e0 = o.escopo || {};
  if (MODOS.indexOf(e0.modo) < 0) erros.escopo = 'Escolha quais dados o perfil enxerga.';
  else if ((e0.processos || []).some(function (x) { return PROCESSOS.indexOf(x) < 0; }) || (e0.turnos || []).some(function (x) { return TURNOS.indexOf(x) < 0; })) erros.escopo = 'Processo ou turno inválido.';
  if (!novo && nome === 'Admin') return { ok: false, msg: 'O perfil Admin é protegido e não pode ser editado.' };
  if (novo && semAcento_(nome) === 'admin') erros.nome = 'Este nome é reservado.';
  if (!erros.perms && !erros.telas && !erros.escopo) {
    const cand = normalizarPerfil_({ nome: nome, desc: desc, perms: permsIn, telas: telasIn, escopo: e0 });
    if (!cand.telas.length) erros.telas = 'Selecione ao menos uma tela.';
    if (!Object.keys(erros).length) {
      if (!novo && nome === a.perfil) return { ok: false, msg: 'Você não pode editar o perfil que está usando.' };
      if (!novo && pf[nome] && !contido_(pf[nome], a.pf)) return { ok: false, msg: 'Você não pode editar um perfil com mais acesso do que o seu.' };
      if (!contido_(cand, a.pf)) return { ok: false, msg: 'Você não pode conceder permissões, telas ou dados que o seu próprio perfil não tem.' };
      return comLock_(function () {
        const s = aba_('Cad_Perfis'), antes = !novo ? pf[nome] : null, linha = serializarPerfil_(Object.assign(cand, { sistema: antes ? antes.sistema : false }));
        const ex = lerDireto_('Cad_Perfis').find(function (r) { return r.Perfil === nome; });
        (TEXTO_COLS.Cad_Perfis).forEach(function (c) { if (ex) s.getRange(ex._row, c).setNumberFormat('@'); });
        if (ex) s.getRange(ex._row, 1, 1, 6).setValues([linha]); else anexar_('Cad_Perfis', linha);
        const lista = function (x, y, rot) {
          const mais = y.filter(function (v) { return x.indexOf(v) < 0; }), menos = x.filter(function (v) { return y.indexOf(v) < 0; });
          return (mais.length || menos.length) ? rot + ' ' + mais.map(function (v) { return '+' + v; }).concat(menos.map(function (v) { return '−' + v; })).join(' ') : '';
        };
        const det = antes
          ? [lista(antes.perms, cand.perms, 'Permissões:'), lista(antes.telas, cand.telas, 'Telas:'), dif_('Dados', JSON.stringify(antes.escopo), JSON.stringify(cand.escopo)), dif_('Descrição', antes.desc, cand.desc)].filter(Boolean).join('; ')
          : 'Permissões: ' + cand.perms.join(',') + '; Telas: ' + cand.telas.join(',') + '; Dados: ' + JSON.stringify(cand.escopo);
        registrar_(a, antes ? 'Perfil alterado' : 'Perfil criado', nome, det || 'Sem mudanças');
        limparCache_();
        const novos = perfis_();
        return { ok: true, perfil: perfilOut_(novos[nome], a.pf) };
      });
    }
  }
  return { ok: false, erros: erros };
}
function excluirPerfil(nome) {
  const a = exigirPerm_('perfis'), pf = perfis_();
  nome = String(nome || '');
  if (!pf[nome]) return { ok: false, msg: 'Perfil não encontrado. Atualize a tela.' };
  if (pf[nome].sistema || nome === 'Admin') return { ok: false, msg: 'Perfis padrão do sistema não podem ser excluídos.' };
  if (nome === a.perfil) return { ok: false, msg: 'Você não pode excluir o perfil que está usando.' };
  if (!contido_(pf[nome], a.pf)) return { ok: false, msg: 'Você não pode excluir um perfil acima do seu.' };
  return comLock_(function () {
    const n = lerDireto_('Cad_Usuarios').filter(function (u) { return u.Perfil === nome; }).length;
    if (n) return { ok: false, msg: 'Não é possível excluir: ' + n + ' usuário(s) usam este perfil. Troque o perfil deles antes.' };
    const ex = lerDireto_('Cad_Perfis').find(function (r) { return r.Perfil === nome; });
    if (ex) aba_('Cad_Perfis').deleteRow(ex._row);
    registrar_(a, 'Perfil excluído', nome, 'Perfil removido');
    limparCache_();
    return { ok: true };
  });
}
/** Verificações de segurança para o Admin: a planilha não deve estar aberta a outras pessoas, senão elas veem os dados direto nela. */
function diagnosticoSeg_(a) {
  const it = [];
  it.push({ nivel: 'info', txt: 'Para a restrição de dados valer, publique o app com "Executar como: Eu" e acesso "Qualquer pessoa da organização". Se for publicado como "Usuário que acessa", cada pessoa precisa de acesso à planilha e as restrições do perfil podem ser contornadas abrindo a planilha.' });
  try {
    const ss = SpreadsheetApp.getActive(), dono = ss.getOwner() ? ss.getOwner().getEmail().toLowerCase() : '';
    const ed = ss.getEditors().map(function (x) { return x.getEmail().toLowerCase(); }).filter(function (x) { return x !== dono; });
    const vw = ss.getViewers().map(function (x) { return x.getEmail().toLowerCase(); }).filter(function (x) { return x !== dono; });
    const pessoas = ed.concat(vw), cad = {};
    lerAba_('Cad_Usuarios').forEach(function (u) { cad[String(u.Email_Google).trim().toLowerCase()] = u.Perfil; });
    const perigosos = pessoas.filter(function (e) { return cad[e] && cad[e] !== 'Admin'; });
    it.push({ nivel: 'info', txt: 'O app não consegue ver o compartilhamento por link. Confira em Compartilhar, na planilha, que o acesso geral está como "Restrito".' });
    if (perigosos.length) it.push({ nivel: 'alerta', txt: 'A planilha está compartilhada diretamente com usuários do sistema (' + perigosos.slice(0, 8).join(', ') + '). Eles podem ver todos os dados abrindo a planilha. Remova o acesso deles na planilha.' });
    else it.push({ nivel: 'ok', txt: 'A planilha não está compartilhada diretamente com usuários do sistema. Confirme o acesso por link, como indicado acima.' });
  } catch (e) { it.push({ nivel: 'info', txt: 'Não foi possível verificar o compartilhamento da planilha.' }); }
  return it;
}
/** Rode no editor para conferir a instalação (abas, perfis, usuários). Não altera dados. */
function diagnostico() {
  manutencao_();
  const r = { abas: {}, perfis: Object.keys(perfis_()), usuarios: lerDireto_('Cad_Usuarios').length };
  Object.keys(ABAS).forEach(function (n) { const s = SpreadsheetApp.getActive().getSheetByName(n); r.abas[n] = s ? s.getLastRow() - 1 : 'ausente'; });
  Logger.log(JSON.stringify(r));
  return r;
}
