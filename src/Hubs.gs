/* ============================================================
   Hubs (v8): cadastro de Hubs, Hub do usuário, isolamento de dados e migração.
   Regras:
   - O Hub do usuário vem SEMPRE do servidor (coluna Hub de Cad_Usuarios). O navegador nunca informa o Hub.
   - Somente o Admin global (Hub "*") escolhe o Hub ativo, por definirHubAtivo.
   - Com a chave HUBS_ATIVO ligada, linha ou usuário sem Hub válido não enxerga nada (falha fechada).
   - Catálogo global (perguntas, perfis, turnos, clusters) vale para todos os Hubs; dados (auditorias, pessoas, docas, metas) são por Hub.
   ============================================================ */

/** Abas com dados por Hub e a coluna (1 = primeira) onde o Hub é gravado. */
const HUB_ABAS = { Auditorias_Historico: 16, Auditorias_Rascunho: 7, Auditorias_Colaboradores: 5, Cad_Estrutura: 6, Cad_Pessoas: 6, Metas: 12, Pessoas_Historico: 9, Metas_Lider: 19, Feedback_Pendencias: 20, Feedback_Registros: 14 };
const HUB_GLOBAL = '*';
/** Clusters padrão para todos os Hubs (catálogo global A a X). A=Laranja/Bolinha, F e I=Azul/Triângulo etc., conforme definido pelo dono. */
const CLUSTERS_PADRAO = {
  A: 'L', B: 'L', C: 'L', D: 'L', E: 'L', F: 'A', G: 'L', H: 'L', I: 'A', J: 'L', K: 'L', L: 'L', M: 'A', N: 'A', O: 'A', P: 'A', Q: 'A', R: 'L', S: 'L', T: 'A', U: 'A', V: 'A', W: 'A', X: 'A'
};
const CS_CLUSTER = { L: 'Laranja/Bolinha', A: 'Azul/Triângulo' };
const MAX_HUBS = 50;
/** Contexto do acesso da execução atual (cada chamada do navegador é uma execução nova). */
var HUB_CTX = null;

/** Chave do script (Hubs/aceite) lida com cache de 5 min: poucas leituras de Properties (cota) e, se o serviço falhar, o ERRO sobe em vez de virar "desligado" (falha fechada, nunca aberta). */
function flagScript_(nome) {
  const c = CacheService.getScriptCache(); let v = null;
  try { v = c.get('flag:' + nome); } catch (e) { v = null; }
  if (v === null || v === undefined) {
    v = PropertiesService.getScriptProperties().getProperty(nome) === 'Sim' ? 'S' : 'N';
    try { c.put('flag:' + nome, v, 300); } catch (e) { /* sem cache: lê de novo na próxima */ }
  }
  return v === 'S';
}
function limparFlag_(nome) { try { CacheService.getScriptCache().remove('flag:' + nome); } catch (e) { /* expira em 5 min */ } }
function hubsLigado_() { return flagScript_('HUBS_ATIVO'); }
function hubsAtivos_() { return HUB_CTX ? HUB_CTX.on : hubsLigado_(); }
function hubAtual_() { return HUB_CTX && HUB_CTX.hub ? HUB_CTX.hub : ''; }
function semHub_(r) {
  const o = {};
  Object.keys(r).forEach(function (k) { if (k !== 'Hub') o[k] = r[k]; });
  return o;
}
/** Filtro central de Hub. Desligado: devolve tudo (sem a coluna Hub). Ligado: só o Hub do acesso; sem Hub, nada. */
function hubFiltra_(n, rows) {
  if (!HUB_ABAS[n]) return rows;
  if (!hubsAtivos_()) return rows.map(semHub_);
  const h = hubAtual_();
  if (!h) return [];
  return rows.filter(function (r) {
    const rh = String(r.Hub === undefined || r.Hub === null ? '' : r.Hub).trim();
    return rh === h || (n === 'Cad_Estrutura' && r.Tipo === 'Cluster' && rh === HUB_GLOBAL);
  }).map(semHub_);
}
/** Grava o Hub do acesso nas linhas novas das abas por Hub. Cluster é do catálogo global. */
function hubCarimba_(aba, linhas) {
  const hc = HUB_ABAS[aba];
  if (!hc || !linhas.length || linhas[0].length !== hc - 1) return linhas;
  const h = hubAtual_();
  if (hubsAtivos_() && !h) throw new Error('Nenhum Hub ativo para gravar. Cadastre ou ative um Hub.'); // nunca grava linha sem Hub (ficaria invisível)
  return linhas.map(function (l) { return l.concat([aba === 'Cad_Estrutura' && l[0] === 'Cluster' ? HUB_GLOBAL : h]); });
}
function hubAtivoHub_(h) { return String(h.Ativo) !== 'Não' && String(h.ID_Hub || '').trim() !== ''; }
function hubOut_(h) { return { id: String(h.ID_Hub), nome: String(h.Nome), operacao: String(h.Operacao), ativo: hubAtivoHub_(h) }; }
/** Hub escolhido pelo Admin global: cache (rápido) e, se expirou, a propriedade do script (durável). */
/** O registro de auditoria nunca pode fazer uma gravação já concluída parecer falha para o usuário. */
function regSeguro_(a, acao, alvo, detalhe) { try { registrar_(a, acao, alvo, detalhe); } catch (e) { console.error('Falha ao registrar ' + acao + ': ' + e.message); contarFalhaLog_(); } }
function hubEscolhido_(email) {
  const c = CacheService.getScriptCache(); let v = c.get('hubAtivo:' + email);
  if (!v) { v = PropertiesService.getScriptProperties().getProperty('hubAtivo:' + email) || ''; if (v) c.put('hubAtivo:' + email, v, 21600); }
  return v;
}
/** Resolve o Hub do usuário. Devolve { ok, hub, global, nome, operacao }. Admin global: o Hub ativo escolhido, ou o primeiro ativo. */
function hubResolve_(u, email, perfil) {
  const raw = String(u.Hub === undefined || u.Hub === null ? '' : u.Hub).trim(), hubs = lerAba_('Cad_Hubs').filter(hubAtivoHub_);
  if (raw === HUB_GLOBAL) {
    if (perfil !== 'Admin') return { ok: false };
    const esc = hubEscolhido_(email);
    const h = hubs.find(function (x) { return String(x.ID_Hub) === esc; }) || hubs[0];
    return h ? { ok: true, hub: String(h.ID_Hub), global: true, nome: String(h.Nome), operacao: String(h.Operacao) } : { ok: true, hub: '', global: true, nome: '', operacao: '' };
  }
  const h = hubs.find(function (x) { return String(x.ID_Hub) === raw; });
  return raw && h ? { ok: true, hub: raw, global: false, nome: String(h.Nome), operacao: String(h.Operacao) } : { ok: false };
}
/** Dados do Hub para o cabeçalho (e a lista de escolha, só para o Admin global). */
function hubResumo_(a) {
  if (!a.hubOn) return { on: false };
  const r = { on: true, id: a.hub, nome: a.hubNome, operacao: a.hubOperacao, global: !!a.hubGlobal };
  if (a.hubGlobal) r.lista = lerBruto_('Cad_Hubs').filter(hubAtivoHub_).map(hubOut_); // sem cache: um Hub digitado na planilha aparece na hora
  return r;
}
/** Só o Admin global escolhe o Hub que quer ver. A escolha fica no servidor, por usuário. */
function definirHubAtivo(id) {
  const a = exigirAcesso_();
  if (!a.hubOn || !a.hubGlobal) throw new Error('Seu perfil não pode trocar de Hub.');
  const h = lerBruto_('Cad_Hubs').filter(hubAtivoHub_).find(function (x) { return String(x.ID_Hub) === String(id); });
  if (!h) throw new Error('Hub inexistente ou inativo.');
  CacheService.getScriptCache().put('hubAtivo:' + a.email, String(h.ID_Hub), 21600);
  PropertiesService.getScriptProperties().setProperty('hubAtivo:' + a.email, String(h.ID_Hub)); // sobrevive à expiração do cache: a gravação nunca cai em outro Hub sem aviso
  CacheService.getScriptCache().remove(chaveAba_('Cad_Hubs')); // a lista de Hubs em cache pode estar velha (Hub digitado direto na planilha)
  logAtiv_(a, 'Hub ativo trocado', String(h.Nome), '');
  return { ok: true };
}

/* ---------- cadastro de Hubs (somente Admin global) ---------- */
function exigirHubGlobal_() {
  const a = exigirPerm_('hubs');
  if (!a.hubGlobal) throw new Error('Somente o Admin global gerencia Hubs.');
  return a;
}
function listarHubs() {
  exigirHubGlobal_();
  const us = lerBruto_('Cad_Usuarios'), cont = {};
  us.forEach(function (u) { const h = String(u.Hub || ''); if (usuarioAtivo_(u)) cont[h] = (cont[h] || 0) + 1; });
  return { hubs: lerBruto_('Cad_Hubs').map(function (h) { const o = hubOut_(h); o.usuarios = cont[o.id] || 0; o._row = h._row; return o; }) };
}
function textoSeguro_(v, max) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (!t) return { erro: 'Campo obrigatório.' };
  if (t.length > max) return { erro: 'Máximo de ' + max + ' caracteres.' };
  if (/[|;=<>]/.test(t) || /^[+\-@]/.test(t)) return { erro: 'Não use os caracteres | ; = < > nem iniciar com + - @.' };
  return { v: t };
}
function salvarHub(obj, orig) {
  const a = exigirHubGlobal_(), o = obj || {}, erros = {};
  const nome = textoSeguro_(o.nome, 60), oper = textoSeguro_(o.operacao, 60), ativo = String(o.ativo === false || o.ativo === 'Não' ? 'Não' : 'Sim');
  if (nome.erro) erros.nome = nome.erro;
  if (oper.erro) erros.operacao = oper.erro;
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  return comLock_(function () {
    const todos = lerBruto_('Cad_Hubs'), row = o._row ? Number(o._row) : 0, atual = row ? todos.find(function (x) { return x._row === row; }) : null;
    if (todos.some(function (x) { return x._row !== row && semAcento_(x.Nome) === semAcento_(nome.v); })) return { ok: false, erros: { nome: 'Já existe um Hub com este nome.' } };
    if (!row && todos.length >= MAX_HUBS) return { ok: false, msg: 'Limite de ' + MAX_HUBS + ' Hubs atingido.' };
    if (row) {
      if (!atual || !orig || String(orig.id) !== String(atual.ID_Hub)) return { ok: false, msg: 'Este Hub foi alterado ou removido. Clique em Atualizar e tente de novo.' };
      if (ativo === 'Não' && hubAtivoHub_(atual)) {
        if (String(atual.ID_Hub) === String(a.hub)) return { ok: false, msg: 'Troque para outro Hub antes de desativar o Hub em uso.' };
        const n = lerBruto_('Cad_Usuarios').filter(function (u) { return String(u.Hub) === String(atual.ID_Hub) && usuarioAtivo_(u); }).length;
        if (n) return { ok: false, msg: 'Não é possível desativar: há ' + n + ' usuário(s) ativo(s) neste Hub. Mova-os antes.' };
      }
      aba_('Cad_Hubs').getRange(row, 2, 1, 3).setValues([[limpar_(nome.v), limpar_(oper.v), ativo]]);
      regSeguro_(a, 'Hub alterado', atual.ID_Hub, [dif_('Nome', atual.Nome, nome.v), dif_('Operação', atual.Operacao, oper.v), dif_('Ativo', atual.Ativo || 'Sim', ativo)].filter(Boolean).join('; '));
    } else {
      let id = '';
      for (let t = 0; t < 20 && (!id || todos.some(function (x) { return String(x.ID_Hub) === id; })); t++) id = 'H' + Math.floor(Math.random() * 2176782336 + 60466176).toString(36).toUpperCase();
      anexar_('Cad_Hubs', [id, limpar_(nome.v), limpar_(oper.v), ativo]);
      regSeguro_(a, 'Hub criado', id, nome.v + ' / ' + oper.v);
    }
    limparCache_();
    return { ok: true, hubs: lerBruto_('Cad_Hubs').map(function (h) { const x = hubOut_(h); x._row = h._row; return x; }) };
  });
}

/* ---------- migração e ativação (rodar no editor do Apps Script) ---------- */
function preencherHub_(aba, padrao) {
  const s = aba_(aba), hc = HUB_ABAS[aba], n = s.getLastRow() - 1;
  if (n < 1) return 0;
  const k = s.getRange(2, 1, n, 1).getValues(), hv = s.getRange(2, hc, n, 1).getValues();
  let m = 0;
  hv.forEach(function (r, i) { if (String(r[0]).trim() === '' && String(k[i][0]).trim() !== '') { r[0] = padrao; m++; } });
  if (m) s.getRange(2, hc, n, 1).setNumberFormat('@').setValues(hv);
  return m;
}
function padronizarClusters_() {
  const s = aba_('Cad_Estrutura'), n = s.getLastRow() - 1, tem = {}, rel = { globais: 0, criados: 0 };
  if (n >= 1) {
    const v = s.getRange(2, 1, n, 6).getValues();
    v.forEach(function (r, i) {
      const id = String(r[1]).trim();
      if (String(r[0]).trim() === 'Cluster' && CLUSTERS_PADRAO[id]) {
        tem[id] = 1;
        if (String(r[5]).trim() !== HUB_GLOBAL || canonCS_(r[2]) !== CS_CLUSTER[CLUSTERS_PADRAO[id]]) {
          s.getRange(i + 2, 3).setNumberFormat('@').setValue(CS_CLUSTER[CLUSTERS_PADRAO[id]]);
          s.getRange(i + 2, 6).setNumberFormat('@').setValue(HUB_GLOBAL);
          rel.globais++;
        }
      }
    });
  }
  const novas = Object.keys(CLUSTERS_PADRAO).filter(function (id) { return !tem[id]; }).map(function (id) { return ['Cluster', id, CS_CLUSTER[CLUSTERS_PADRAO[id]], '', '']; });
  if (novas.length) { anexarLinhas_('Cad_Estrutura', novas); rel.criados = novas.length; }
  return rel;
}
/** v8 (idempotente e aditiva): colunas de Hub, abas de Hub/log/aceite, Hub padrão nas linhas antigas, clusters globais, permissões novas do Site Leader. Não liga o isolamento. */
function migrarV8() {
  manutencao_();
  const ss = SpreadsheetApp.getActive(), rel = {};
  Object.keys(ABAS).forEach(function (n) { garantirAba_(n); });
  Object.keys(TEXTO_COLS).forEach(function (n) { formatarTexto_(ss.getSheetByName(n), n); });
  const hubs = lerBruto_('Cad_Hubs');
  if (!hubs.length) throw new Error('Cadastre o primeiro Hub na aba Cad_Hubs (ID_Hub, Nome, Operacao, Ativo) antes de rodar a migração.');
  const ativoPadrao = hubs.filter(hubAtivoHub_)[0];
  if (!ativoPadrao) throw new Error('Nenhum Hub ativo com ID_Hub preenchido em Cad_Hubs. Preencha ID_Hub (ex.: H1), Nome, Operacao e Ativo = Sim na primeira linha.');
  const padrao = String(ativoPadrao.ID_Hub);
  rel.hubPadrao = padrao;
  rel.linhas = {};
  Object.keys(HUB_ABAS).forEach(function (n) { rel.linhas[n] = preencherHub_(n, padrao); });
  const us = aba_('Cad_Usuarios'), nu = us.getLastRow() - 1;
  rel.usuarios = 0;
  if (nu >= 1) {
    const v = us.getRange(2, 1, nu, 5).getValues();
    v.forEach(function (r, i) {
      if (String(r[0]).trim() !== '' && String(r[4]).trim() === '') { us.getRange(i + 2, 5).setNumberFormat('@').setValue(String(r[2]).trim() === 'Admin' ? HUB_GLOBAL : padrao); rel.usuarios++; }
    });
  }
  rel.clusters = padronizarClusters_();
  const pf = aba_('Cad_Perfis');
  lerBruto_('Cad_Perfis').forEach(function (r) {
    if (r.Perfil !== 'Site Leader') return;
    const p = String(r.Permissoes || '').split(',').filter(Boolean), t = String(r.Telas || '').split(',').filter(Boolean);
    let m = false;
    ['autorizar', 'ver_log', 'ver_online'].forEach(function (x) { if (p.indexOf(x) < 0) { p.push(x); m = true; } });
    ['autorizar', 'log'].forEach(function (x) { if (t.indexOf(x) < 0) { t.push(x); m = true; } });
    if (m) { pf.getRange(r._row, 3, 1, 2).setNumberFormat('@').setValues([[p.join(','), t.join(',')]]); }
  });
  limparCache_();
  return rel;
}
/** Liga o isolamento por Hub (roda a migração antes). Para desligar: removerIsolamentoHub(). */
/** Só no editor do Apps Script: lá quem executa é a própria conta (ativo = efetivo). Pelo navegador o efetivo é o dono e o ativo é o visitante. */
function soEditor_() {
  const ativo = emailDe_(Session.getActiveUser().getEmail()), efetivo = emailDe_(Session.getEffectiveUser().getEmail());
  if (!efetivo || ativo !== efetivo) throw new Error('Acesso negado: rode esta função no editor do Apps Script.');
  return efetivo;
}
/** Chave de segurança (isolamento, aceite): só pelo editor, por quem passa na manutenção, e registrada no log ANTES de mudar. Sem log, a chave não muda. */
function mudarChaveSeguranca_(chave, valor, acao) {
  const efetivo = soEditor_();
  manutencao_();
  const a = acesso_(true), ator = a.ok ? a : { nome: 'Editor do projeto', email: efetivo, perfil: 'Editor', hub: '' };
  registrar_(ator, acao, chave, 'Novo valor: ' + valor);
  PropertiesService.getScriptProperties().setProperty(chave, valor); limparFlag_(chave);
}
function ativarHubs() {
  soEditor_();
  const rel = migrarV8();
  mudarChaveSeguranca_('HUBS_ATIVO', 'Sim', 'Isolamento por Hub ligado');
  HUB_CTX = null; // a chave mudou: a próxima leitura refaz o contexto
  limparCache_();
  rel.ativo = true;
  return rel;
}
function desativarHubs() {
  mudarChaveSeguranca_('HUBS_ATIVO', 'Não', 'Isolamento por Hub desligado');
  HUB_CTX = null;
  limparCache_();
  return 'Isolamento por Hub desligado.';
}
