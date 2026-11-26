/* ============================================================
   Acessos: solicitações de cadastro, usuários, perfis e diagnóstico de segurança.
   (dividido do Code.gs/Obrigacoes.gs na v10.6: mesmo código, organizado por domínio.
   No Apps Script todos os .gs compartilham o escopo global; a ordem dos arquivos não importa aqui,
   porque as constantes de topo deste arquivo são literais.)
   ============================================================ */
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
/** Com o isolamento ligado, quem não é Admin global só enxerga as solicitações do próprio Hub. */
function solDoHub_(x) { return !(HUB_CTX && HUB_CTX.on && !HUB_CTX.global) || String(x.Hub || '').trim() === hubAtual_(); }
function pendentes_(direto, todos) {
  const us = {}, ler = direto ? lerDireto_ : lerAba_;
  ler('Cad_Usuarios').forEach(function (u) { us[emailDe_(u.Email_Google)] = 1; });
  return ler('Cad_Solicitacoes').filter(function (x) { return String(x.Status) === 'Pendente' && !us[emailDe_(x.Email)] && (todos || solDoHub_(x)); });
}
function solOut_(x) { return { hub: String(x.Hub || ''), turno: String(x.Turno || ''), idioma: idiomaOk_(x.Idioma), id: x.ID, email: emailDe_(x.Email), nome: x.Nome, cargo: x.Cargo, data: x.Data, status: x.Status, por: x.Decidido_Por, em: x.Decidido_Em, perfil: x.Perfil_Atribuido }; }
function listaSol_() {
  const todas = lerDireto_('Cad_Solicitacoes');
  return {
    pendentes: pendentes_().map(solOut_).reverse(),
    historico: todas.filter(function (x) { return String(x.Status) !== 'Pendente' && solDoHub_(x); }).slice(-50).reverse().map(solOut_)
  };
}
/** Pedido de cadastro feito por quem ainda não tem acesso. Só vale para a conta Google que está em uso (ninguém cadastra outra pessoa). */
function solicitarCadastro(obj) {
  HUB_CTX = { on: hubsLigado_(), hub: '', global: false }; // quem solicita ainda não tem acesso: contexto limpo
  const ativo = emailDe_(Session.getActiveUser().getEmail());
  if (!ativo) return { ok: false, msg: 'Não foi possível identificar a sua conta Google. Entre com a sua conta e tente novamente.' };
  const o = obj || {}, erros = {};
  const email = emailDe_(o.email), nome = String(o.nome || '').replace(/\s+/g, ' ').trim(), cargoSel = String(o.cargo || '').trim(), outro = String(o.cargoOutro || '').replace(/\s+/g, ' ').trim();
  if (!email) erros.email = 'Campo obrigatório.';
  else if (!emailValido_(email)) erros.email = 'E-mail inválido.';
  else if (email !== ativo) erros.email = 'Use o e-mail da conta Google com a qual você entrou.';
  if (nome.length < 3) erros.nome = 'Informe o nome completo.'; else if (nome.length > 120) erros.nome = 'Máximo de 120 caracteres.';
  const hubOn = hubsAtivos_(), hubSel = String(o.hub || '').trim(), turnoSel = String(o.turno || '').trim();
  if (hubOn && !lerAba_('Cad_Hubs').some(function (h) { return hubAtivoHub_(h) && String(h.ID_Hub) === hubSel; })) erros.hub = 'Selecione o Hub.';
  if (hubOn && cargoSel === 'Líder' && TURNOS.indexOf(turnoSel) < 0) erros.turno = 'Selecione o turno.';
  if (CARGOS_SOL.indexOf(cargoSel) < 0) erros.cargo = 'Selecione o cargo.';
  else if (cargoSel === 'Outros') { if (outro.length < 2) erros.cargoOutro = 'Digite o cargo.'; else if (outro.length > 60) erros.cargoOutro = 'Máximo de 60 caracteres.'; }
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  const cargo = cargoSel === 'Outros' ? outro : cargoSel;
  return comLock_(function () {
    const u = lerDireto_('Cad_Usuarios').find(function (x) { return emailDe_(x.Email_Google) === ativo; });
    if (u) return { ok: false, msg: usuarioAtivo_(u) ? 'Este e-mail já possui cadastro. Entre com o Google.' : 'Este cadastro está desativado. Fale com o administrador.' };
    const minhas = lerDireto_('Cad_Solicitacoes').filter(function (x) { return emailDe_(x.Email) === ativo; });
    if (minhas.some(function (x) { return String(x.Status) === 'Pendente'; })) return { ok: false, msg: 'Seu cadastro já foi enviado e está em análise.' };
    if (minhas.filter(function (x) { return String(x.Status) === 'Recusada'; }).length >= MAX_RECUSAS) return { ok: false, msg: 'Limite de solicitações atingido. Fale com o administrador.' };
    if (pendentes_(true, true).length >= MAX_PENDENTES) return { ok: false, msg: 'Há solicitações demais em análise no momento. Tente novamente mais tarde.' };
    const id = 'SOL-' + Date.now() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
    anexar_('Cad_Solicitacoes', [id, ativo, limpar_(nome), limpar_(cargo), agora_(), 'Pendente', '', '', '', idiomaOk_(o.idioma), hubOn ? hubSel : '', cargoSel === 'Líder' ? turnoSel : '']);
    registrar_({ nome: nome, email: ativo }, 'Cadastro solicitado', ativo, 'Cargo informado: ' + cargo);
    limparSol_();
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
    const x = lerDireto_('Cad_Solicitacoes').find(function (r) { return String(r.ID) === String(id) && String(r.Status) === 'Pendente' && solDoHub_(r); });
    if (!x) return { ok: false, msg: 'Esta solicitação já foi tratada ou não existe. Clique em Atualizar.' };
    aba_('Cad_Solicitacoes').getRange(x._row, 6, 1, 3).setValues([['Recusada', limpar_(a.email), agora_()]]);
    registrar_(a, 'Cadastro recusado', emailDe_(x.Email), 'Nome: ' + x.Nome);
    limparSol_();
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

/* ---------- acessos: usuários, perfis, log ---------- */
function perfilOut_(p, meu) { return { nome: p.nome, desc: p.desc, perms: p.perms, telas: p.telas, escopo: p.escopo, sistema: p.sistema, protegido: p.nome === 'Admin', atribuivel: !!meu && contido_(p, meu) }; }
function listarAcessos() {
  const a = exigirAcesso_();
  if (!(tem_(a, 'usuarios') || tem_(a, 'perfis') || tem_(a, 'regras_lider'))) throw new Error('Seu perfil não tem acesso a esta tela.');
  const pf = perfis_(), out = { perms: PERMS, telas: TELAS, processos: PROCESSOS, turnos: TURNOS, pode: { usuarios: tem_(a, 'usuarios'), perfis: tem_(a, 'perfis'), regras: tem_(a, 'regras_lider') }, meuPerfil: a.perfil };
  out.reqTela = REQ_TELA; out.permTela = PERM_TELA;
  out.perfis = Object.keys(pf).map(function (n) { return perfilOut_(pf[n], a.pf); });
  const contar = {};
  const us = usuariosVisiveis_(a, lerDireto_('Cad_Usuarios'));
  us.forEach(function (u) { contar[u.Perfil] = (contar[u.Perfil] || 0) + 1; });
  out.perfis.forEach(function (p) { p.usuarios = contar[p.nome] || 0; });
  if (tem_(a, 'usuarios')) { const lids = lideresAtivos_(); out.usuarios = us.map(function (u) { return marcarUsuario_(u, pf, a, lids); }); }
  out.log = (a.hubOn && !a.hubGlobal) || !(tem_(a, 'usuarios') || tem_(a, 'perfis')) ? [] : lerDireto_('Log_Permissoes').slice(-200).reverse(); // o log do Hub fica na tela Log de atividade
  out.hub = hubResumo_(a);
  if (a.hubOn && a.hubGlobal) { const nomes = {}; lerAba_('Cad_Hubs').forEach(function (h) { nomes[String(h.ID_Hub)] = String(h.Nome); }); out.hubs = Object.keys(nomes).map(function (k) { return { id: k, nome: nomes[k] }; }); }
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
  // Hub do usuário: só o Admin global escolhe; os demais criam sempre no próprio Hub. Admin é sempre global (*) e os outros perfis sempre têm um Hub.
  let hubU = '';
  if (a.hubOn) {
    const hubsOk = lerAba_('Cad_Hubs').filter(hubAtivoHub_).map(function (h) { return String(h.ID_Hub); });
    hubU = a.hubGlobal ? String(o.Hub === undefined || o.Hub === null ? '' : o.Hub).trim() : a.hub;
    if (perfil === 'Admin') { if (!a.hubGlobal) erros.Perfil = 'Somente o Admin global cadastra outro Admin.'; hubU = HUB_GLOBAL; }
    else if (hubsOk.indexOf(hubU) < 0) erros.Hub = 'Selecione o Hub do usuário.';
  }
  if (Object.keys(erros).length) return { ok: false, erros: erros };
  const res = comLock_(function () {
    let sol = null;
    const todos = lerDireto_('Cad_Usuarios'), row = o._row ? Number(o._row) : 0, atual = row ? todos.find(function (x) { return x._row === row; }) : null;
    if (todos.some(function (x) { return x._row !== row && String(x.Email_Google).trim().toLowerCase() === email; })) return { ok: false, erros: { Email_Google: 'E-mail já cadastrado.' } };
    // o perfil "time" liga o usuário ao líder pelo nome: dois usuários com o mesmo nome no Hub veriam o time um do outro
    const hubNome = a.hubOn ? hubU : '';
    // só barra quando esta gravação cria o conflito (novo, renomeado, mudou de perfil ou reativado); homônimos antigos podem ser inativados e editados
    const criaConflito = ativo === 'Sim' && (!atual || semAcento_(atual.Nome) !== semAcento_(nome) || String(atual.Perfil) !== perfil || !usuarioAtivo_(atual));
    if (criaConflito && pf[perfil].escopo.modo === 'time' && todos.some(function (x) { return x._row !== row && usuarioAtivo_(x) && semAcento_(x.Nome) === semAcento_(nome) && (!a.hubOn || String(x.Hub || '').trim() === hubNome); })) {
      return { ok: false, erros: { Nome: 'Já existe um usuário ativo com este nome neste Hub. Para o perfil de time, use o nome completo e diferente.' } };
    }
    if (row) {
      if (!atual || !confere_('Cad_Usuarios', row, orig)) return { ok: false, msg: 'Este registro foi alterado ou removido por outra pessoa. Clique em Atualizar e tente de novo.' };
      if (String(atual.Email_Google).trim().toLowerCase() === a.email) return { ok: false, msg: 'Você não pode alterar o seu próprio acesso.' };
      if (!pf[atual.Perfil] || !contido_(pf[atual.Perfil], a.pf)) return { ok: false, msg: 'Você não pode alterar um usuário com perfil acima do seu.' };
      if (a.hubOn && !a.hubGlobal && String(atual.Hub || '').trim() !== a.hub) return { ok: false, msg: 'Este usuário pertence a outro Hub.' };
    }
    const novos = todos.filter(function (x) { return x._row !== row; }).concat([{ Perfil: perfil, Status_Ativo: ativo }]);
    if (!restaAdmin_(novos)) return { ok: false, erros: { Perfil: 'Mantenha ao menos um Admin ativo.' } };
    const hubGrava = a.hubOn ? hubU : (atual ? String(atual.Hub || '') : '');
    const linha = [limpar_(email), limpar_(nome), perfil, ativo, hubGrava], s = aba_('Cad_Usuarios');
    if (!row) {
      sol = lerDireto_('Cad_Solicitacoes').find(function (x) { return emailDe_(x.Email) === email && String(x.Status) === 'Pendente'; });
      if (sol && a.hubOn && !a.hubGlobal && String(sol.Hub || '').trim() !== a.hub) { return { ok: false, msg: 'Esta solicitação é de outro Hub.' }; } // antes de gravar qualquer coisa
    }
    // mudança de acesso sem log não vale: qualquer falha (gravação ou log) desfaz tudo o que já foi gravado
    gravarComDesfazer_(a, 'salvar usuário', function (desfaz) {
      if (row) {
        const antes = linhaAtual_('Cad_Usuarios', row);
        desfaz(function () { restaurarLinha_('Cad_Usuarios', row, antes); });
        (TEXTO_COLS.Cad_Usuarios).forEach(function (c) { s.getRange(row, c).setNumberFormat('@'); });
        s.getRange(row, 1, 1, 5).setValues([linha]);
        const d = [dif_('Perfil', atual.Perfil, perfil), dif_('Ativo', atual.Status_Ativo, ativo), dif_('Nome', atual.Nome, nome), dif_('E-mail', String(atual.Email_Google).toLowerCase(), email), a.hubOn ? dif_('Hub', String(atual.Hub || ''), hubGrava) : ''].filter(Boolean).join('; ');
        if (d) registrar_(a, 'Usuário alterado', email, d, a.hubOn ? String(atual.Hub || '') : undefined);
        return;
      }
      anexarDesfazivel_(desfaz, 'Cad_Usuarios', linha);
      registrar_(a, 'Usuário criado', email, 'Perfil: ' + perfil + '; Ativo: ' + ativo, a.hubOn ? String(linha[4] || '') : undefined);
      if (!sol || ativo !== 'Sim') { sol = null; return; }
      const solS = aba_('Cad_Solicitacoes'), solAntes = solS.getRange(sol._row, 6, 1, 4).getValues();
      desfaz(function () { solS.getRange(sol._row, 6, 1, 4).setValues(solAntes); });
      solS.getRange(sol._row, 6, 1, 4).setValues([['Aprovada', limpar_(a.email), agora_(), perfil]]);
      registrar_(a, 'Cadastro aprovado', email, 'Perfil: ' + perfil);
      // líder que se cadastrou sozinho vira pessoa/líder do Hub e turno escolhidos
      if (String(sol.Cargo) === 'Líder' && TURNOS.indexOf(String(sol.Turno)) > -1 && !lerBruto_('Cad_Pessoas').some(function (x) { return semAcento_(x.Nome) === semAcento_(nome) && (!a.hubOn || String(x.Hub || '').trim() === hubGrava); })) {
        const hl = [histLinha_(a, 'Criado', null, { Nome: nome, Cargo: 'Líder', Turno: String(sol.Turno), Lider: '' }).concat([a.hubOn ? hubGrava : ''])];
        anexarLinhas_('Pessoas_Historico', hl);
        desfaz(function (ok) { if (ok) histRevertido_(a, hl, new Error('aprovação desfeita')); }); // histórico é só de acréscimo: marca, não apaga
        anexarDesfazivel_(desfaz, 'Cad_Pessoas', [limpar_(nome), 'Líder', String(sol.Turno), 'Sim', '', a.hubOn ? hubGrava : '']);
        registrar_(a, 'Líder cadastrado na aprovação', nome, 'Turno: ' + sol.Turno);
      }
    });
    limparCache_();
    return { ok: true, _mail: sol ? { nome: nome, para: email, idioma: idiomaOk_(sol.Idioma) } : null, usuarios: usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).map(function (u) { return marcarUsuario_(u, pf, a, lideresAtivos_()); }) };
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
    if (a.hubOn && !a.hubGlobal && String(atual.Hub || '').trim() !== a.hub) return { ok: false, msg: 'Este usuário pertence a outro Hub.' };
    if (!restaAdmin_(todos.filter(function (x) { return x._row !== Number(row); }))) return { ok: false, msg: 'Não é possível excluir o último Admin ativo.' };
    gravarComDesfazer_(a, 'excluir usuário', function (desfaz) {
      const antes = linhaAtual_('Cad_Usuarios', Number(row));
      aba_('Cad_Usuarios').deleteRow(Number(row));
      desfaz(function () { reinserirLinha_('Cad_Usuarios', Number(row), antes); });
      registrar_(a, 'Usuário excluído', String(atual.Email_Google).toLowerCase(), 'Perfil: ' + atual.Perfil, a.hubOn ? String(atual.Hub || '') : undefined);
    });
    limparCache_();
    return { ok: true, usuarios: usuariosVisiveis_(a, lerDireto_('Cad_Usuarios')).map(function (u) { return marcarUsuario_(u, pf, a, lideresAtivos_()); }) };
  });
}
function salvarPerfil(obj, novo) {
  const a = exigirPerm_('perfis'), erros = {}, o = obj || {}, pf = perfis_();
  exigirGlobal_(a, 'Perfis são iguais em todos os Hubs.');
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
        const lista = function (x, y, rot) {
          const mais = y.filter(function (v) { return x.indexOf(v) < 0; }), menos = x.filter(function (v) { return y.indexOf(v) < 0; });
          return (mais.length || menos.length) ? rot + ' ' + mais.map(function (v) { return '+' + v; }).concat(menos.map(function (v) { return '−' + v; })).join(' ') : '';
        };
        const det = antes
          ? [lista(antes.perms, cand.perms, 'Permissões:'), lista(antes.telas, cand.telas, 'Telas:'), dif_('Dados', JSON.stringify(antes.escopo), JSON.stringify(cand.escopo)), dif_('Descrição', antes.desc, cand.desc)].filter(Boolean).join('; ')
          : 'Permissões: ' + cand.perms.join(',') + '; Telas: ' + cand.telas.join(',') + '; Dados: ' + JSON.stringify(cand.escopo);
        gravarComDesfazer_(a, 'salvar perfil', function (desfaz) {
          if (ex) {
            const linhaAntes = linhaAtual_('Cad_Perfis', ex._row);
            desfaz(function () { restaurarLinha_('Cad_Perfis', ex._row, linhaAntes); });
            (TEXTO_COLS.Cad_Perfis).forEach(function (c) { s.getRange(ex._row, c).setNumberFormat('@'); });
            s.getRange(ex._row, 1, 1, 6).setValues([linha]);
          } else anexarDesfazivel_(desfaz, 'Cad_Perfis', linha);
          registrar_(a, antes ? 'Perfil alterado' : 'Perfil criado', nome, det || 'Sem mudanças');
        });
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
  exigirGlobal_(a, 'Perfis são iguais em todos os Hubs.');
  nome = String(nome || '');
  if (!pf[nome]) return { ok: false, msg: 'Perfil não encontrado. Atualize a tela.' };
  if (pf[nome].sistema || nome === 'Admin') return { ok: false, msg: 'Perfis padrão do sistema não podem ser excluídos.' };
  if (nome === a.perfil) return { ok: false, msg: 'Você não pode excluir o perfil que está usando.' };
  if (!contido_(pf[nome], a.pf)) return { ok: false, msg: 'Você não pode excluir um perfil acima do seu.' };
  return comLock_(function () {
    const n = lerDireto_('Cad_Usuarios').filter(function (u) { return u.Perfil === nome; }).length;
    if (n) return { ok: false, msg: 'Não é possível excluir: ' + n + ' usuário(s) usam este perfil. Troque o perfil deles antes.' };
    const ex = lerDireto_('Cad_Perfis').find(function (r) { return r.Perfil === nome; });
    gravarComDesfazer_(a, 'excluir perfil', function (desfaz) {
      if (ex) {
        const linhaAntes = linhaAtual_('Cad_Perfis', ex._row);
        aba_('Cad_Perfis').deleteRow(ex._row);
        desfaz(function () { reinserirLinha_('Cad_Perfis', ex._row, linhaAntes); });
      }
      registrar_(a, 'Perfil excluído', nome, 'Perfil removido');
    });
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
