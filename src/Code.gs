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
  Auditorias_Historico: ['ID_Auditoria', 'Timestamp', 'Processo', 'Doca_Cluster', 'Colaborador', 'Lider', 'Turno', 'Responsavel_Auditoria', 'Pontuacao_Pct', 'Status_Final', 'Observacoes', 'Json_Detalhes_Respostas', 'Auditor_Email', 'Itens_NC', 'Critico_NC', 'Hub'],
  Auditorias_Rascunho: ['ID_Rascunho', 'Timestamp_Inicio', 'Auditor_Email', 'Processo', 'Doca_Cluster', 'Json_Respostas_Parciais', 'Hub'],
  Auditorias_Colaboradores: ['ID_Auditoria', 'Colaborador', 'Lider', 'Turno', 'Hub'],
  Cad_Usuarios: ['Email_Google', 'Nome', 'Perfil', 'Status_Ativo', 'Hub'],
  Cad_Perfis: ['Perfil', 'Descricao', 'Permissoes', 'Telas', 'Escopo', 'Sistema'],
  Cad_Estrutura: ['Tipo', 'Identificador', 'Cor_Simbolo', 'Lider_Padrao', 'Turno_Padrao', 'Hub'],
  Cad_Pessoas: ['Nome', 'Cargo', 'Turno', 'Status_Ativo', 'Lider', 'Hub'],
  Cad_Processos_Perguntas: ['Processo', 'ID_Subprocesso', 'Descricao_Item', 'Requisito_Critico', 'Subprocesso_EN', 'Subprocesso_ES', 'Descricao_EN', 'Descricao_ES', 'Feedback_Imediato'],
  Metas: ['ID_Meta', 'Tipo_Alvo', 'Alvo', 'Quantidade', 'Processos', 'Inicio', 'Fim', 'Descricao', 'Criada_Por', 'Criada_Em', 'Ativa', 'Hub'],
  Log_Permissoes: ['Timestamp', 'Responsavel', 'Acao', 'Alvo', 'Detalhe'],
  Cad_Solicitacoes: ['ID', 'Email', 'Nome', 'Cargo', 'Data', 'Status', 'Decidido_Por', 'Decidido_Em', 'Perfil_Atribuido', 'Idioma', 'Hub', 'Turno'],
  Configuracoes: ['Parametro', 'Valor'],
  Cad_Relatorio_Email: ['Email', 'Frequencia', 'Idioma', 'Ativo', 'Ultimo_Envio'],
  Cad_Hubs: ['ID_Hub', 'Nome', 'Operacao', 'Ativo'],
  Log_Atividade: ['Timestamp', 'Hub', 'Email', 'Nome', 'Perfil', 'Acao', 'Alvo', 'Detalhe'],
  Log_Aceites: ['Timestamp', 'Email', 'Nome', 'Versao_Texto', 'Hub'],
  Cad_Regras_Lider: ['Email', 'Proprio_Time', 'Outros_Times', 'Times', 'Turnos', 'Cores', 'Processos', 'Ver_Proprio', 'Ver_Outros', 'Atualizado_Por', 'Atualizado_Em'],
  Pessoas_Historico: ['Timestamp', 'Colaborador', 'Evento', 'Lider_Antes', 'Lider_Depois', 'Turno_Antes', 'Turno_Depois', 'Alterado_Por', 'Hub'],
  Metas_Lider: ['ID_Meta', 'Lider_Email', 'Lider_Nome', 'Times', 'Turnos', 'Cores', 'Processos', 'Quantidade', 'Inicio', 'Fim', 'Descricao', 'Criada_Por', 'Criada_Em', 'Status', 'Cancelada_Por', 'Cancelada_Em', 'Visto_Em', 'Aviso_Em', 'Hub'],
  Feedback_Pendencias: ['ID_Pend', 'Chave', 'Colaborador', 'Time_Snap', 'Turno_Snap', 'Janela_Ini', 'Janela_Fim', 'Qtd', 'IDs_Auditorias', 'Nota_Corte', 'Gerada_Em', 'Status', 'Designado_Email', 'Designado_Nome', 'Designado_Por', 'Designado_Em', 'Prazo', 'Visto_Em', 'Aviso_Em', 'Hub'],
  Feedback_Registros: ['ID_Reg', 'ID_Pend', 'Colaborador', 'Time_Snap', 'Turno_Snap', 'Autor_Email', 'Autor_Nome', 'Designado_Por', 'Designado_Em', 'Texto', 'Registrado_Em', 'Hash_Anterior', 'Hash', 'Hub']
};
/** Abas existentes que ganharam colunas ao final na v6.2/v7: o cabeçalho é completado sem tocar nos dados. */
const COLS_NOVAS = { Cad_Solicitacoes: 1, Cad_Processos_Perguntas: 1, Cad_Usuarios: 1, Cad_Estrutura: 1, Cad_Pessoas: 1, Auditorias_Historico: 1, Auditorias_Rascunho: 1, Auditorias_Colaboradores: 1, Metas: 1 };
const FREQS = ['Diario', 'Semanal', 'Mensal'];
/** Colunas (1 = primeira) que são sempre TEXTO. Sem isso o Sheets converte "36" em número e "01" em 1 (perde o zero). */
const TEXTO_COLS = {
  Cad_Usuarios: [1, 2, 3, 4, 5], Cad_Perfis: [1, 2, 3, 4, 5, 6], Cad_Estrutura: [1, 2, 3, 4, 5, 6], Cad_Pessoas: [1, 2, 3, 4, 5, 6], Cad_Processos_Perguntas: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Auditorias_Historico: [2, 4, 5, 6, 7, 11, 13, 14, 15, 16], Auditorias_Rascunho: [2, 3, 4, 5, 7], Auditorias_Colaboradores: [1, 2, 3, 4, 5],
  Metas: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12], Log_Permissoes: [1, 2, 3, 4, 5], Cad_Solicitacoes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], Cad_Relatorio_Email: [1, 2, 3, 4, 5],
  Cad_Hubs: [1, 2, 3, 4], Log_Atividade: [1, 2, 3, 4, 5, 6, 7, 8], Log_Aceites: [1, 2, 3, 4, 5],
  Cad_Regras_Lider: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Pessoas_Historico: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Metas_Lider: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  Feedback_Pendencias: [1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  Feedback_Registros: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
};
const COLUNAS_NUMERICAS = { Pontuacao_Pct: 1, Valor: 1, Quantidade: 1 };
const STATUS_TXT = { vermelho: 'Em Inconformidade', observacao: 'Em Observação', verde: 'Completo e em Conformidade' };
const CADASTROS = ['Cad_Estrutura', 'Cad_Pessoas', 'Cad_Processos_Perguntas'];
const PERM_CAD = { Cad_Estrutura: 'cad_estrutura', Cad_Pessoas: 'cad_pessoas', Cad_Processos_Perguntas: 'cad_perguntas' };
const CACHE_ABAS = ['Cad_Usuarios', 'Cad_Perfis', 'Cad_Estrutura', 'Cad_Pessoas', 'Cad_Processos_Perguntas', 'Configuracoes', 'Cad_Solicitacoes', 'Cad_Hubs', 'Cad_Regras_Lider'];
const OBRIG = {
  Cad_Estrutura: ['Tipo', 'Identificador', 'Cor_Simbolo'],
  Cad_Pessoas: ['Nome', 'Cargo', 'Turno', 'Status_Ativo'],
  Cad_Processos_Perguntas: ['Processo', 'ID_Subprocesso', 'Descricao_Item', 'Requisito_Critico']
};
const ENUMS = {
  Status_Ativo: ['Sim', 'Não'], Tipo: ['Doca', 'Cluster'], Turno: TURNOS, Turno_Padrao: TURNOS,
  Cargo: ['Líder', 'Colaborador'], Requisito_Critico: ['Sim', 'Não'], Feedback_Imediato: ['Sim', 'Não'], Processo: PROCESSOS
};
const MAXLEN = { Descricao_Item: 300, ID_Subprocesso: 120, Descricao_EN: 300, Descricao_ES: 300, Subprocesso_EN: 120, Subprocesso_ES: 120 };

/* ---------- catálogo de telas, permissões e perfis ---------- */
const TELAS = [
  { id: 'matriz', nome: 'Matriz de Processos' }, { id: 'form', nome: 'Formulário de Auditoria' }, { id: 'minhas', nome: 'Minhas metas' },
  { id: 'geral', nome: 'Visão Geral' }, { id: 'auditorias', nome: 'Auditorias realizadas' }, { id: 'auditores', nome: 'Auditores e metas' }, { id: 'programacao', nome: 'Programação' },
  { id: 'proc', nome: 'Por processo' }, { id: 'doca', nome: 'Por doca e cluster' }, { id: 'colab', nome: 'Por colaborador e equipe' },
  { id: 'tend', nome: 'Tendência' }, { id: 'export', nome: 'Exportar' }, { id: 'cad', nome: 'Cadastros' }, { id: 'cfg', nome: 'Configurações' }, { id: 'acessos', nome: 'Acessos' }, { id: 'autorizar', nome: 'Autorizações' }, { id: 'log', nome: 'Log de atividade' }
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
  { id: 'autorizar', grupo: 'Acessos', nome: 'Autorizar novos cadastros', desc: 'Ver e recusar solicitações de cadastro; aprovar leva ao cadastro de usuário.' },
  { id: 'ver_log', grupo: 'Acessos', nome: 'Ver o log de atividade', desc: 'Consultar o que cada usuário gravou ou alterou no sistema. O Site Leader vê só o próprio Hub.' },
  { id: 'ver_online', grupo: 'Acessos', nome: 'Ver usuários online', desc: 'Ver quem está com o sistema aberto neste momento. O Site Leader vê só o próprio Hub.' },
  { id: 'regras_lider', grupo: 'Acessos', nome: 'Definir quem cada líder pode auditar', desc: 'Para cada líder: se audita o próprio time e outros times, e por turno, cor e símbolo, time e processo. Ninguém edita a própria regra.' },
  { id: 'obrigacoes', grupo: 'Auditorias', nome: 'Programar auditorias e feedbacks dos líderes', desc: 'Definir quais auditorias cada líder deve fazer e até quando, e designar quem dá o feedback obrigatório. Só Site Leader e Admin; cada Site Leader atua no próprio Hub.' },
  { id: 'ver_auditor', grupo: 'Dados', nome: 'Ver quem auditou (feedbacks)', desc: 'Mostra quem fez as auditorias na lista de feedbacks e em Meus feedbacks. Sem esta permissão, quem auditou fica em sigilo. Só o Admin a tem por padrão.' },
  { id: 'hubs', grupo: 'Sistema', nome: 'Gerir Hubs e carga em massa', desc: 'Cadastrar Hubs, atribuir usuários a Hubs e importar pessoas e docas. Só vale para o Admin global.' }
];
const PERM_IDS = PERMS.map(function (p) { return p.id; });
const TELA_IDS = TELAS.map(function (t) { return t.id; });
/** Tela só funciona com pelo menos uma destas permissões. */
const REQ_TELA = { form: ['auditar'], minhas: ['auditar'], export: ['exportar'], cfg: ['config', 'email_rel'], cad: ['cad_estrutura', 'cad_pessoas', 'cad_perguntas'], acessos: ['usuarios', 'perfis', 'regras_lider'], autorizar: ['autorizar'], log: ['ver_log'], programacao: ['obrigacoes'] };
/** Permissão que obriga a tela correspondente (adicionada automaticamente ao salvar um perfil). */
const PERM_TELA = { auditar: 'form', exportar: 'export', config: 'cfg', email_rel: 'cfg', cad_estrutura: 'cad', cad_pessoas: 'cad', cad_perguntas: 'cad', usuarios: 'acessos', perfis: 'acessos', regras_lider: 'acessos', autorizar: 'autorizar', ver_log: 'log', obrigacoes: 'programacao' };
const MODOS = ['todos', 'time', 'proprias'];
const REL_TELA = { geral: 'geral', auditorias: 'auditorias', auditores: 'auditores', proc: 'proc', doca: 'doca', colab: 'colab', tend: 'tend', export: 'export' };

function perfisBase_() {
  const todos = { modo: 'todos', processos: [], turnos: [] };
  const semPerfis = PERM_IDS.filter(function (p) { return p !== 'perfis' && p !== 'autorizar' && p !== 'ver_log' && p !== 'ver_online' && p !== 'hubs' && p !== 'regras_lider' && p !== 'obrigacoes' && p !== 'ver_auditor'; }); // quem auditou: sigiloso por padrão
  const telasSem = TELA_IDS.filter(function (t) { return t !== 'autorizar' && t !== 'log' && t !== 'programacao'; });
  return {
    'Admin': { nome: 'Admin', desc: 'Acesso total. Perfil protegido: não pode ser editado nem excluído.', perms: PERM_IDS.slice(), telas: TELA_IDS.slice(), escopo: todos, sistema: true },
    'Analista': { nome: 'Analista', desc: 'Acesso total, exceto criar e editar perfis.', perms: semPerfis.slice(), telas: telasSem.slice(), escopo: todos, sistema: true },
    'Site Leader': { nome: 'Site Leader', desc: 'Acesso total do seu Hub, exceto criar e editar perfis.', perms: semPerfis.concat(['autorizar', 'ver_log', 'ver_online', 'regras_lider', 'obrigacoes']), telas: telasSem.concat(['autorizar', 'log', 'programacao']), escopo: todos, sistema: true },
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
  if (!us || us.getLastRow() < 2) {
    const ativo = (Session.getActiveUser().getEmail() || '').trim().toLowerCase(), dono = (Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
    if (ativo && ativo !== dono) throw new Error('Acesso negado.'); // sem usuários cadastrados, só o dono roda a manutenção
    return true;
  }
  const a = acesso_();
  if (!(a.ok && a.perfil === 'Admin' && (!a.hubOn || a.hubGlobal))) throw new Error('Acesso negado.');
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
  // o cabeçalho quase nunca muda: conferido uma vez a cada 6 h (por versão do esquema), não a cada auditoria salva
  const cache = CacheService.getScriptCache(), chave = 'histcab:' + hash_(ABAS.Auditorias_Historico.join('|'));
  // aba limpa à mão ou com colunas a menos (cópia antiga colada): confere de novo
  if (cache.get(chave)) { const s0 = aba_('Auditorias_Historico'); if (s0.getLastRow() >= 1 && s0.getMaxColumns() >= ABAS.Auditorias_Historico.length) return s0; }
  const s = garantirAba_('Auditorias_Historico'), n = ABAS.Auditorias_Historico.length;
  if (s.getMaxColumns() < n) s.insertColumnsAfter(s.getMaxColumns(), n - s.getMaxColumns());
  const h = s.getRange(1, 1, 1, n).getValues()[0];
  let mudou = false;
  ABAS.Auditorias_Historico.forEach(function (c, i) { if (h[i] !== c) { h[i] = c; mudou = true; } });
  if (mudou) s.getRange(1, 1, 1, n).setValues([h]).setFontWeight('bold').setBackground('#EE4D2D').setFontColor('#FFFFFF');
  try { cache.put(chave, '1', 21600); } catch (e) { /* sem cache: confere de novo na próxima gravação */ }
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
/** Abas já localizadas nesta execução (cada chamada do navegador é uma execução nova: nunca fica velho entre usuários). */
var ABA_MEMO_ = {};
function aba_(n) {
  if (ABA_MEMO_[n]) return ABA_MEMO_[n];
  const ss = SpreadsheetApp.getActive(), s = ss.getSheetByName(n) || (ABAS[n] ? garantirAba_(n) : null);
  if (s) ABA_MEMO_[n] = s;
  return s;
}
/** Letra da coluna (1 = A, 27 = AA), para montar faixas A1. */
function colLetra_(c) { let s = ''; for (let x = c; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + (x - 1) % 26) + s; return s; }
function fmt_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function agora_() { return fmt_(new Date()); }
function hoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function d_(s) { return new Date(String(s).replace(' ', 'T')); }
function tsStr_(x) { return x instanceof Date ? fmt_(x) : String(x == null ? '' : x); }
function semAcento_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); } // espaço duplo colapsado: a mesma definição de "mesmo nome" da unicidade
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
/** Pessoa do cadastro: inativa só com "Não" (sem acento e caixa); vazio continua ativo, como nas versões anteriores. */
function ativo_(x) { return semAcento_(x.Status_Ativo) !== 'nao'; }
/** Usuário do sistema: ativo só com "Sim" (falha fechada). É a mesma regra do login, usada em toda lista de usuários. */
function usuarioAtivo_(u) { return semAcento_(u.Status_Ativo) === 'sim'; }
/** Neutraliza injeção de fórmula: texto iniciado por = + - @ recebe um espaço na frente. */
function limpar_(v) {
  if (v !== null && v !== undefined && typeof v === 'object' && !(v instanceof Date)) return ''; // objeto/array vindo do navegador nunca vira "[object Object]" na célula
  if (typeof v !== 'string') return v;
  v = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return /^[=+\-@\t\r]/.test(v) ? ' ' + v : v;
}
var LOCK_COM_ = false;
function comLock_(fn) {
  if (LOCK_COM_) return fn(); // já dentro do lock desta execução (o log pode ser gravado de dentro de outra operação)
  const l = LockService.getScriptLock();
  try { l.waitLock(15000); } catch (e) { throw new Error('Sistema ocupado. Tente novamente em instantes.'); }
  LOCK_COM_ = true;
  try { return fn(); } finally { LOCK_COM_ = false; l.releaseLock(); }
}
/**
 * Gravação com compensação (usar DENTRO do lock). Cada passo que grava informa como se desfaz: desfaz(function (ok) {...}).
 * Se qualquer passo falhar (inclusive o log obrigatório), os passos feitos são desfeitos em ordem inversa, uma vez cada
 * (desfazer não é repetido: deleteRow/insertRow não são idempotentes). ok = todos os desfazer anteriores deram certo.
 * O cache é sempre limpo e a mensagem diz a verdade: nada mudou, ou parte pode ter ficado gravada.
 * Regra de uso: registre o desfazer ANTES de gravar (com o estado anterior já lido). Uma gravação que escreve e depois lança
 * também precisa ser desfeita, e restaurar um valor igual ao atual não faz mal.
 * Premissa: tudo roda dentro do mesmo lock e os desfazer rodam em ordem inversa; as posições de linha só valem por isso.
 */
function gravarComDesfazer_(a, onde, fn) {
  const pilha = [];
  try { return fn(function (d) { pilha.push(d); }); }
  catch (e) {
    if (!pilha.length) throw e; // nada foi gravado: a mensagem original (validação, regra) chega ao usuário como antes
    falhaLog_(onde, e);
    let ok = true;
    for (let i = pilha.length - 1; i >= 0; i--) { try { pilha[i](ok); } catch (e2) { ok = false; falhaLog_('desfazer ' + onde, e2); } }
    try { limparCache_(); } catch (e3) { falhaLog_('limpar cache após desfazer', e3); }
    logAtiv_(a, ok ? 'Alteração desfeita após falha' : 'Falha ao desfazer alteração', onde, String(e && e.message || e).slice(0, 200));
    throw new Error(ok ? 'Não foi possível concluir a gravação; nada foi alterado. Tente de novo.' : 'A gravação falhou e não foi possível desfazer tudo. Clique em Atualizar e confira antes de tentar de novo.');
  }
}
/** Valores atuais de uma linha (todas as colunas do esquema), para desfazer depois. */
function linhaAtual_(aba, row) { return aba_(aba).getRange(row, 1, 1, ABAS[aba].length).getValues()[0]; }
function restaurarLinha_(aba, row, valores) { aba_(aba).getRange(row, 1, 1, valores.length).setValues([valores]); }
/** Anexa UMA linha com o desfazer registrado antes: se o append gravar e lançar, a linha é apagada (só se for mesmo a que foi gravada). */
function anexarDesfazivel_(desfaz, aba, linha) {
  const s = aba_(aba), r = s.getLastRow() + 1, chave = String(linha[0]);
  desfaz(function () { if (s.getLastRow() >= r && String(s.getRange(r, 1).getValue()) === chave) s.deleteRow(r); });
  return anexarLinhas_(aba, [linha]);
}
/** Recoloca uma linha excluída na posição original (ou no fim, se a aba encolheu), com as colunas de texto formatadas. */
function reinserirLinha_(aba, row, valores) {
  const s = aba_(aba), r = Math.min(row, s.getLastRow() + 1);
  if (r <= s.getLastRow()) s.insertRowBefore(r);
  (TEXTO_COLS[aba] || []).forEach(function (c) { s.getRange(r, c).setNumberFormat('@'); });
  s.getRange(r, 1, 1, valores.length).setValues([valores]);
}
/** Anexa linhas formatando como texto as colunas de identificação (evita 36 virar número e 01 virar 1). */
function anexarLinhas_(aba, linhas) {
  if (!linhas || !linhas.length) return;
  linhas = hubCarimba_(aba, linhas);
  const s = aba_(aba), r = s.getLastRow() + 1, n = linhas.length, w = linhas[0].length;
  if (r + n - 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + n - 1 - s.getMaxRows());
  // todas as colunas de texto numa chamada só (antes era uma por coluna, até 10 por gravação, com a trava presa)
  const txt = (TEXTO_COLS[aba] || []).filter(function (c) { return c <= w; });
  if (txt.length) s.getRangeList(txt.map(function (c) { return colLetra_(c) + r + ':' + colLetra_(c) + (r + n - 1); })).setNumberFormat('@');
  s.getRange(r, 1, n, w).setValues(linhas);
  return r;
}
function anexar_(aba, linha) { return anexarLinhas_(aba, [linha]); }
/** Faixa da nota: abaixo do corte = vermelho; do corte até a média = observação (amarelo); média ou mais = verde. */
function faixa_(pct, cfg) { return pct < cfg.NOTA_CORTE_PCT ? 'vermelho' : (pct < cfg.NOTA_MEDIA_PCT ? 'observacao' : 'verde'); }
/** Leitura sem filtro de Hub: só para migração e manutenção. Os cadastros e relatórios usam lerDireto_/lerAba_, que isolam por Hub. */
function lerBruto_(n) {
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
function lerDireto_(n) { return hubFiltra_(n, lerBruto_(n)); }
/**
 * Chave do cache de uma aba com a versão dos dados: um leitor que lê a planilha antes de uma gravação e só grava no cache
 * depois do limparCache_ escreve na versão antiga, que ninguém lê mais (antes ele repunha o dado velho por até 2 min).
 */
function chaveAba_(n, v) { return 'aba:' + (v || hv_()) + (n === 'Cad_Solicitacoes' ? '.' + hvSol_() : '') + ':' + n; }
/** Versão própria da fila de solicitações: limparSol_ troca só ela (não derruba o cache dos relatórios). */
function hvSol_() { const c = CacheService.getScriptCache(); let v = c.get('hvsol'); if (!v) { v = String(Date.now()); c.put('hvsol', v, 21600); } return v; }
/** Abas já lidas nesta execução (o mesmo JSON não é buscado e convertido várias vezes). Zerado a cada limparCache_. */
var ABA_LIDA_ = {};
/** Cópia rasa das linhas: quem recebe pode marcar ou reordenar sem contaminar a memória da execução (como era com o JSON.parse). */
function copiaLinhas_(l) { return l.map(function (o) { return Object.assign({}, o); }); }
function lerAba_(n) {
  const usa = CACHE_ABAS.indexOf(n) > -1, c = CacheService.getScriptCache(), k = usa ? chaveAba_(n) : '';
  if (usa && ABA_LIDA_[k]) return hubFiltra_(n, copiaLinhas_(ABA_LIDA_[k]));
  if (usa) { const v = c.get(k); if (v) { ABA_LIDA_[k] = JSON.parse(v); return hubFiltra_(n, copiaLinhas_(ABA_LIDA_[k])); } }
  const dados = lerBruto_(n);
  if (usa) {
    ABA_LIDA_[k] = dados;
    try { c.put(k, JSON.stringify(dados), CACHE_SEG); } catch (e) { console.warn('Aba ' + n + ' grande demais para o cache: lida da planilha a cada execução.'); }
  }
  return hubFiltra_(n, usa ? copiaLinhas_(dados) : dados);
}
function limparCache_() {
  const c = CacheService.getScriptCache();
  const v = hv_(); // uma leitura da versão para todas as chaves
  c.removeAll(CACHE_ABAS.map(function (n) { return chaveAba_(n, v); }).concat(['ult:h', 'ult:s']));
  ABA_LIDA_ = {};
  bumpHv_();
}
/** Invalida só a fila de solicitações (não derruba o cache dos relatórios). */
function limparSol_() {
  const c = CacheService.getScriptCache(), k = chaveAba_('Cad_Solicitacoes');
  c.remove(k); delete ABA_LIDA_[k];
  c.put('hvsol', String(Date.now()) + String(Math.floor(Math.random() * 1000)), 21600); // gravação tardia de um leitor vai para a versão antiga
}
function hv_() { const c = CacheService.getScriptCache(); let v = c.get('hv'); if (!v) { v = String(Date.now()); c.put('hv', v, 21600); } return v; }
function bumpHv_() { CacheService.getScriptCache().put('hv', String(Date.now()) + String(Math.floor(Math.random() * 1000)), 21600); }
/** Resumo SHA-256 (hex) para chaves de cache de relatórios: não dá para forjar colisão entre usuários ou Hubs. */
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}
function hash_(s) {
  let h1 = 5381, h2 = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = ((h1 << 5) + h1 + c) | 0; h2 = (c + (h2 << 6) + (h2 << 16) - h2) | 0; }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length;
}
/** Resultado de relatório em cache (chave = versão do histórico + usuário/escopo + filtros). */
function comCache_(a, chaveObj, fn) {
  const c = CacheService.getScriptCache(), k = 'rel:' + hv_() + ':' + sha_(JSON.stringify([a.email, a.escopo, a.perms, a.telas, a.hub || '', a.escopo.modo === 'time' ? regraDe_(a.email) : '', chaveObj]));
  const x = c.get(k);
  if (x) return JSON.parse(x);
  const r = fn();
  try { const j = JSON.stringify(r); if (j.length < 90000) c.put(k, j, 300); } catch (e) { /* sem cache */ }
  return r;
}
const NUM_KEYS = { DIAS_VIDA_UTIL_AUDITORIA: 1, NOTA_CORTE_PCT: 1, NOTA_MEDIA_PCT: 1, POUCAS_AUDITORIAS: 1, FEEDBACK_MIN_AUDITORIAS: 1 };
function config_() {
  const lido = {}, c = { DIAS_VIDA_UTIL_AUDITORIA: 7, NOTA_CORTE_PCT: 70, NOTA_MEDIA_PCT: 90, POUCAS_AUDITORIAS: 3, FEEDBACK_MIN_AUDITORIAS: 3, MULTI: {} };
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
  return usuarios.some(function (u) { return u.Perfil === 'Admin' && usuarioAtivo_(u); });
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
function acesso_(livre) {
  const a = acessoDe_(Session.getActiveUser().getEmail());
  if (a.ok && !livre && !aceiteOk_(a)) return { email: a.email, ok: false, motivo: 'aceite_pendente' };
  return a;
}
/** Mesmo cálculo de acesso para qualquer e-mail (o relatório por e-mail usa o perfil do DESTINATÁRIO, nunca o de quem dispara). */
/** Marca o usuário (para a tela Acessos): editável por quem lista e, se o perfil é "time", se o nome bate com um líder ativo do cadastro de pessoas. */
function marcarUsuario_(u, pf, a, lids) {
  u.editavel = !!pf[u.Perfil] && contido_(pf[u.Perfil], a.pf) && String(u.Email_Google).trim().toLowerCase() !== a.email;
  const p = pf[String(u.Perfil).trim()];
  u.semLider = !!(p && p.escopo.modo === 'time' && lids.indexOf(semAcento_(u.Nome)) < 0);
  return u;
}
/** Usuários que o ator pode ver e gerir: com o isolamento ligado, só os do próprio Hub (o Admin global vê todos). */
function usuariosVisiveis_(a, lista) {
  if (!a.hubOn || a.hubGlobal) return lista;
  return lista.filter(function (u) { return String(u.Hub || '').trim() === a.hub; });
}
function emailVisivel_(a, email) { return usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).some(function (u) { return emailDe_(u.Email_Google) === email; }); }
function lideresAtivos_() { return lerAba_('Cad_Pessoas').filter(function (p) { return p.Cargo === 'Líder' && ativo_(p); }).map(function (p) { return semAcento_(p.Nome); }); }
function acessoDe_(emailBruto) {
  HUB_CTX = { on: hubsLigado_(), hub: '', global: false };
  const email = (emailBruto || '').trim().toLowerCase();
  if (!email) return { email: '', ok: false, motivo: 'sem_email' };
  const u = lerAba_('Cad_Usuarios').find(function (x) { return String(x.Email_Google).trim().toLowerCase() === email; });
  if (!u) return { email: email, ok: false, motivo: 'nao_cadastrado' };
  if (!usuarioAtivo_(u)) return { email: email, ok: false, motivo: 'inativo' };
  const pf = perfis_()[String(u.Perfil).trim()];
  if (!pf) return { email: email, ok: false, motivo: 'perfil_invalido' };
  const r = { email: email, ok: true, nome: String(u.Nome), perfil: pf.nome, perms: pf.perms, telas: pf.telas, escopo: pf.escopo, pf: pf, hubOn: HUB_CTX.on, hub: '', hubGlobal: false, hubNome: '', hubOperacao: '' };
  if (HUB_CTX.on) {
    const h = hubResolve_(u, email, pf.nome);
    if (!h.ok) { HUB_CTX.hub = ''; return { email: email, ok: false, motivo: 'sem_hub' }; }
    HUB_CTX.hub = h.hub; HUB_CTX.global = h.global;
    r.hub = h.hub; r.hubGlobal = h.global; r.hubNome = h.nome; r.hubOperacao = h.operacao;
  }
  return r;
}
function tem_(a, perm) { return a.perms.indexOf(perm) > -1; }
/** Acesso de qualquer usuário ativo (sem exigir permissão específica); respeita o aceite do aviso. */
function exigirAcesso_() {
  const a = acesso_();
  if (a.motivo === 'aceite_pendente') throw new Error('Leia e aceite o aviso de transparência para continuar.');
  if (!a.ok) throw new Error('Acesso negado.');
  return a;
}
function exigirPerm_(perm) {
  const a = acesso_();
  if (a.motivo === 'aceite_pendente') throw new Error('Leia e aceite o aviso de transparência para continuar.');
  if (!a.ok) throw new Error('Acesso negado.');
  if (!tem_(a, perm)) throw new Error('Seu perfil não tem permissão para esta ação.');
  return a;
}
function exigirTela_(tela) {
  const a = acesso_();
  if (a.motivo === 'aceite_pendente') throw new Error('Leia e aceite o aviso de transparência para continuar.');
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
function resumoUsuario_(a) { return { email: a.email, ok: true, nome: a.nome, perfil: a.perfil, perms: a.perms, telas: a.telas, escopo: a.escopo, hub: hubResumo_(a) }; }
function registrar_(a, acao, alvo, detalhe, hubLog) {
  comLock_(function () { anexar_('Log_Permissoes', [agora_(), limpar_(a.nome + ' <' + a.email + '>'), acao, limpar_(String(alvo)), limpar_(String(detalhe).slice(0, 900))]); });
  logAtiv_(a, acao, alvo, detalhe, hubLog);
}

/* ---------- carga inicial ---------- */
/** O botão Atualizar só derruba o cache para todos no máximo 1 vez a cada 30 s. */
function podeForcar_() {
  const c = CacheService.getScriptCache();
  if (c.get('forcado')) return false;
  c.put('forcado', '1', 30);
  return true;
}
/** Pessoas que o cliente recebe: líder que audita só recebe quem a regra dele permite auditar; os demais seguem o escopo do perfil. */
function pessoasDoFormulario_(a) {
  const todas = lerAba_('Cad_Pessoas');
  if (a.escopo.modo === 'time' && tem_(a, 'auditar') && !tem_(a, 'cad_pessoas')) return pessoasAuditaveis_(a, todas);
  return todas.filter(function (p) { return (a.escopo.modo !== 'time' && tem_(a, 'auditar')) || tem_(a, 'cad_pessoas') || pessoaNoEscopo_(a, p); });
}
/** A partir de quantos ms uma chamada do navegador conta como lenta (o limite de uma execução é 6 min). */
const LENTO_MS = 3000;
/** Mede a operação e, se passar do limite, escreve um aviso estruturado no log de execuções (Apps Script > Execuções / Cloud Logging).
    Só dados técnicos: nunca e-mail, nome ou parâmetros. É o "span manual" de quem não tem SDK de tracing. */
function medir_(op, fn, args) {
  const ini = Date.now();
  let erro = false;
  try { return fn.apply(null, args); } catch (e) { erro = true; throw e; } finally {
    const ms = Date.now() - ini;
    if (ms >= LENTO_MS) { try { console.warn(JSON.stringify({ evento: 'operacao_lenta', op: op, ms: ms, erro: erro, hub: (HUB_CTX && HUB_CTX.hub) || '' })); } catch (x) { /* log indisponível não derruba a chamada */ } }
  }
}
function bootstrap(forcar) { return medir_('bootstrap', bootstrapCore_, arguments); }
function bootstrapCore_(forcar) {
  let a = acesso_(true);
  if (forcar && a.ok && podeForcar_()) { limparCache_(); a = acesso_(true); }
  if (!a.ok) {
    const bl = { email: a.email, ok: false, motivo: a.motivo || '', solicitacao: '' };
    if (a.motivo === 'nao_cadastrado') { const sl = ultimaSolicitacao_(a.email); bl.solicitacao = sl ? sl.Status : ''; if (hubsAtivos_()) bl.hubs = lerAba_('Cad_Hubs').filter(hubAtivoHub_).map(function (h) { return { id: String(h.ID_Hub), nome: String(h.Nome), operacao: String(h.Operacao) }; }); }
    return { user: bl, appUrl: urlApp_() };
  }
  const temRel = ['geral', 'auditorias', 'auditores', 'proc', 'doca', 'colab', 'tend', 'export'].some(function (t) { return a.telas.indexOf(t) > -1; });
  const procs = PROCESSOS.filter(function (p) { return procPermitido_(a, p); });
  const aviso = avisoResumo_(a);
  if (!aviso.aceito) return { user: resumoUsuario_(a), aviso: aviso, appUrl: urlApp_(), bloqueado: true };
  const r = {
    aviso: aviso, appUrl: urlApp_(), user: resumoUsuario_(a), config: config_(), processos: procs, tipos: TIPO_PROC, visual: { cores: CORES, simbolos: SIMBOLOS }, turnos: TURNOS,
    pendentes: tem_(a, 'autorizar') ? pendentes_().length : 0,
    metasNovas: a.telas.indexOf('minhas') > -1 ? contarMetasNovas_(a) : 0,
    fb: resumoFbSeguro_(a),
    db: { Cad_Estrutura: lerAba_('Cad_Estrutura'), Cad_Pessoas: pessoasDoFormulario_(a), Cad_Processos_Perguntas: perguntasVisiveis_(a, lerAba_('Cad_Processos_Perguntas')) }
  };
  if (a.telas.indexOf('auditores') > -1 || temRel) {
    const pf = perfis_();
    r.auditores = usuariosVisiveis_(a, lerAba_('Cad_Usuarios')).filter(function (u) { return pf[u.Perfil] && pf[u.Perfil].perms.indexOf('auditar') > -1; })
      .map(function (u) { return { email: String(u.Email_Google).trim().toLowerCase(), nome: u.Nome, ativo: usuarioAtivo_(u) }; });
  }
  return r;
}
