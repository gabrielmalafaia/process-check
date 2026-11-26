/* Lote 1 da revisão v10: cada teste reproduz um achado (falha antes da correção, passa depois). */
const { criarAmbiente, teste, eq, lanca, resumo } = require('./harness');

console.log('H1: relatorio recusa tipo que não é texto');
teste('array ["export"] é recusado antes de qualquer acesso', () => {
  const env = criarAmbiente();
  lanca(() => env.run("relatorio(['export'], {}, { offset: 0 })"), /Relatório inválido/);
});
teste('array ["auditorias"] e ["colab"] também são recusados', () => {
  const env = criarAmbiente();
  lanca(() => env.run("relatorio(['auditorias'], {}, {})"), /Relatório inválido/);
  lanca(() => env.run("relatorio(['colab'], {}, {})"), /Relatório inválido/);
});
teste('objeto com toString é recusado', () => {
  const env = criarAmbiente();
  lanca(() => env.run("relatorio({ toString: function () { return 'export'; } }, {}, {})"), /Relatório inválido/);
});

console.log('H2: renomear líder só reescreve regras do Hub atual');
teste('regra de outro Hub não muda', () => {
  const env = criarAmbiente();
  env.linhas('Cad_Usuarios', [
    ['lider.a@x.com', 'Líder A', 'Líder', 'Sim', 'H1'],
    ['lider.b@x.com', 'Líder B', 'Líder', 'Sim', 'H2'],
  ]);
  const regra = (email) => [email, 'Sim', 'Sim', 'João Silva|Maria', '', '', '', 'Sim', 'proprias', 'sl@x.com', '2026-11-01 10:00:00'];
  env.linhas('Cad_Regras_Lider', [regra('lider.a@x.com'), regra('lider.b@x.com')]);
  env.set('HUB_CTX', { on: true, hub: 'H1', global: false });
  env.run("renomearTimeRegras_('João Silva', 'João Souza')");
  const ls = env.abas.Cad_Regras_Lider.linhas;
  eq(ls[1][3], 'João Souza|Maria', 'regra do Hub atual');
  eq(ls[2][3], 'João Silva|Maria', 'regra do outro Hub');
});
teste('sem Hub ativo (isolamento ligado), nada é reescrito', () => {
  const env = criarAmbiente();
  env.linhas('Cad_Usuarios', [['lider.a@x.com', 'Líder A', 'Líder', 'Sim', 'H1']]);
  env.linhas('Cad_Regras_Lider', [['lider.a@x.com', 'Sim', 'Sim', 'João Silva', '', '', '', 'Sim', 'proprias', '', '']]);
  env.set('HUB_CTX', { on: true, hub: '', global: false });
  env.run("renomearTimeRegras_('João Silva', 'João Souza')");
  eq(env.abas.Cad_Regras_Lider.linhas[1][3], 'João Silva');
});
teste('com Hubs desligados, todas as regras acompanham o novo nome', () => {
  const env = criarAmbiente();
  env.linhas('Cad_Regras_Lider', [['lider.a@x.com', 'Sim', 'Sim', 'João Silva', '', '', '', 'Sim', 'proprias', '', '']]);
  env.set('HUB_CTX', { on: false, hub: '', global: false });
  env.run("renomearTimeRegras_('João Silva', 'João Souza')");
  eq(env.abas.Cad_Regras_Lider.linhas[1][3], 'João Souza');
});

console.log('M8: uma única definição de "mesmo nome"');
teste('espaço duplo no meio não diferencia nomes', () => {
  const env = criarAmbiente();
  eq(env.run("semAcento_('Ana  Lima') === semAcento_('ana lima')"), true);
  eq(env.run("semAcento_(' José\\tSouza ')"), 'jose souza');
});

console.log('M9: uma única definição de "usuário ativo"');
teste('usuarioAtivo_ só aceita Sim (sem acento e caixa)', () => {
  const env = criarAmbiente();
  eq(env.run("[' Sim ', 'SIM', 'Não', 'NÃO', 'nao', '', 'x'].map(function (v) { return usuarioAtivo_({ Status_Ativo: v }); })"), [true, true, false, false, false, false, false]);
});
teste('ativo_ (pessoas) trata NÃO e "Não " como inativo e vazio como ativo', () => {
  const env = criarAmbiente();
  eq(env.run("['Não', 'NÃO', 'Não ', 'nao', '', 'Sim'].map(function (v) { return ativo_({ Status_Ativo: v }); })"), [false, false, false, false, true, true]);
});
teste('designaveisFb_ não oferece usuário que não consegue entrar', () => {
  const env = criarAmbiente();
  env.linhas('Cad_Usuarios', [
    ['ok@x.com', 'Ok', 'Líder', 'Sim', 'H1'],
    ['fora@x.com', 'Fora', 'Líder', 'NÃO', 'H1'],
    ['vazio@x.com', 'Vazio', 'Líder', '', 'H1'],
  ]);
  const r = env.run("designaveisFb_({ hubOn: true, hubGlobal: false, hub: 'H1' }).map(function (u) { return u.Email_Google; })");
  eq(r, ['ok@x.com']);
});

console.log('M1: chaves de segurança só pelo editor e sempre no log');
teste('desativarHubs chamado pelo navegador (usuário ativo != dono) é negado', () => {
  const env = criarAmbiente({ ativo: 'admin@x.com', efetivo: 'dono@x.com', props: { HUBS_ATIVO: 'Sim' } });
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '*']]);
  lanca(() => env.run('desativarHubs()'), /editor/);
  eq(env.props.get('HUBS_ATIVO'), 'Sim', 'a chave não pode mudar');
});
teste('desativarHubs no editor registra no log antes de mudar a chave', () => {
  const env = criarAmbiente({ ativo: 'dono@x.com', efetivo: 'dono@x.com', props: { HUBS_ATIVO: 'Sim' } });
  env.run('desativarHubs()');
  eq(env.props.get('HUBS_ATIVO'), 'Não');
  const log = env.abas.Log_Permissoes.linhas.slice(1).map((l) => l[2]);
  eq(log.indexOf('Isolamento por Hub desligado') > -1, true, 'ação no log');
});
teste('se o log falhar, a chave não muda', () => {
  const env = criarAmbiente({ ativo: 'dono@x.com', efetivo: 'dono@x.com', props: { HUBS_ATIVO: 'Sim' } });
  env.quebrar('Log_Permissoes'); // a gravação do log lança erro
  lanca(() => env.run('desativarHubs()'));
  eq(env.props.get('HUBS_ATIVO'), 'Sim');
});
teste('ativarAvisoLog chamado pelo navegador é negado', () => {
  const env = criarAmbiente({ ativo: 'admin@x.com', efetivo: 'dono@x.com' });
  env.linhas('Cad_Usuarios', [['admin@x.com', 'Admin', 'Admin', 'Sim', '*']]);
  lanca(() => env.run('ativarAvisoLog()'), /editor/);
  eq(env.props.get('ACEITE_ATIVO') || '', '');
});

resumo();
