# Process Check

Sistema web de auditoria de processos do hub, feito em Google Apps Script com Google Sheets como banco de dados e publicado no Google Sites.

## Autoria

© 2026 Gabriel Malafaia e Karina Ferreira. Todos os direitos reservados.

- **Gabriel Malafaia**: desenvolvimento do software (código, banco de dados, interface, testes e publicação).
- **Karina Ferreira**: concepção dos processos auditados e da estrutura da auditoria (processos, critérios, perguntas, regras de nota e organização do fluxo de trabalho).

O uso, a cópia, a modificação, a venda ou o licenciamento do software dependem de autorização dos dois autores, conforme o Acordo de Autoria que acompanha este projeto.

## Data de criação

Desenvolvimento iniciado em 2026. Versão atual: 7.0.

## Arquivos

| Arquivo | Função |
|---|---|
| `Code.gs` | Servidor: regras, permissões, relatórios, metas, cadastros |
| `Index.html` | Estrutura da página |
| `Styles.html` | Aparência |
| `JS_Client.html` | Lógica da tela (navegador) |
| `appsscript.json` | Manifesto do projeto (fuso, tipo de publicação) |
| `testes/` | Testes automáticos (`npm install` e `node server.test.js`, `server2.test.js`, `server3.test.js`, `client.test.js`, `client2.test.js`) |

## Como publicar

1. Crie uma cópia da planilha e teste nela primeiro.
2. Cole os arquivos no Apps Script e rode `migrarV7` uma vez (ela já executa a `migrarV6` e pode ser repetida sem perda).
3. Publique como "Executar como: Eu" e acesso "Qualquer pessoa da organização".
4. Não compartilhe a planilha com os usuários finais.
5. (Histórico, para quem ainda está na v6.x: siga a seção "Como atualizar da v6.x para a v7" mais abaixo, que já cobre estes passos.) Ao atualizar da v6.1 para a 6.2: substitua `Code.gs`, `Index.html`, `Styles.html` e `JS_Client.html` e rode `migrarV6` uma vez (acrescenta a coluna `Idioma` em `Cad_Solicitacoes`, sem apagar dados). Publique uma nova versão.
6. (Histórico.) Ao atualizar da v6.0: substitua também o `appsscript.json` (novo escopo para enviar e-mail), rode `migrarV6` (cria a aba `Cad_Solicitacoes`) e publique uma nova versão. O Google vai pedir nova autorização por causa do envio de e-mail.

## Novidades da versão 6.1

- Tela de carregamento animada e tela de login (entrada com a conta Google já aberta no navegador).
- Quem não tem cadastro vê o aviso "Login não encontrado" e pode pedir cadastro (nome, cargo, e-mail corporativo). O e-mail do pedido precisa ser o da conta Google em uso.
- Nova tela **Autorizações** (só para quem tem a permissão "Autorizar novos cadastros", por padrão apenas Admin): item do menu fica vermelho com o número de pedidos pendentes. Aprovar leva ao cadastro de usuário para escolher o perfil; ao salvar, a pessoa recebe um e-mail de aprovação com as telas e ações liberadas.
- Novo tema **Laranja** (#F76331), além de claro e escuro. As cores de status não mudam.
- Os pedidos ficam na aba `Cad_Solicitacoes` e todas as decisões entram no histórico de alterações.


## Novidades da versão 6.2

- **Idiomas**: Português, English e Español em toda a interface (telas, menus, pop-ups, erros de validação, tabelas, gráficos e dicas). A escolha fica salva no navegador; sem escolha, vale o idioma do navegador. O seletor fica no menu do usuário e na tela de login. Os arquivos CSV exportados continuam em português, e nomes cadastrados (processos, pessoas, perfis) não são traduzidos.
- **E-mail de aprovação** novo, sem lista de permissões, no idioma escolhido pela pessoa no cadastro (coluna `Idioma` em `Cad_Solicitacoes`).
- **Menu em seções** (Operação, Análise, Administração), **menu do usuário** no rodapé (idioma, tema e atalhos) e **busca global** (Ctrl+K ou "/"): telas permitidas, nova auditoria, matriz por processo, idioma e tema.
- **Cadastros > Perguntas**: perguntas agrupadas por sub-processo, painel lateral para criar e editar, menu de ações por linha (duplicar, mover, excluir) e exclusão com Desfazer.
- **Formulário de auditoria**: botões Conforme / Não conforme / N/A com as cores de status e progresso "X de N itens".
- **Matriz**: cards com status, nota em destaque e "há N dias"; filtros por status com contagem.
- **Configurações**: barra fixa "Alterações não salvas" com Salvar e Descartar.
- **Acessos**: Autorizações passou a ser uma aba, com selo vermelho no menu e na aba.
- **Temas**: Automático (segue o sistema), Claro, Escuro e Laranja, todos com o mesmo laranja de acento (#CC3D15, contraste mínimo AA com texto branco). As cores de status não mudam.
- Carregamento com esqueleto nas listas e cabeçalho com "Atualizado há N min".

## Novidades da versão 7

**Relatórios para decisão**
- Visão Geral com frase-resumo no topo, card da **Nota média** com meta, distância até a meta e evolução semanal, e comparação com o período anterior (sem seta e com o aviso "Sem base de comparação" quando o período anterior não tem auditorias).
- Barras em **100%** por processo e por turno, com o `n` no rótulo; tendência semanal no lugar da rosca.
- **Maiores ofensores** com taxa de falha (auditorias com a falha / auditorias do processo), variação e onde mais ocorre; novo KPI "Auditorias com item crítico reprovado" (coluna `Critico_NC` no histórico; auditorias antigas são lidas do JSON).
- Insights, ofensores e listas **clicáveis**: abrem as Auditorias já filtradas.
- **Mais filtros** (doca/cluster, líder, colaborador, auditor, faixa e busca nas observações) com contador de filtros ativos.
- **Imprimir / PDF** em A4 (uma página na Visão Geral).

**Listas**
- Aviso "Poucas auditorias" (limite configurável, padrão 3); ordem: pior nota entre quem tem amostra suficiente, depois quem tem poucas; tendência semanal por pessoa; atalho "Ver auditorias".
- Auditorias: menos colunas, linha expansível (líder, turno, auditor, observações) e bloco de observações recentes de auditorias não conformes.
- Permissão **Ver nomes de colaboradores nos relatórios**: sem ela, o servidor não devolve nomes (listas, detalhe, itens e CSV).

**Relatório por e-mail** (Configurações > Relatório por e-mail, permissão "Gerir o relatório por e-mail")
- Escolha de destinatários, frequência (diário, semanal, mensal) e idioma; "Enviar agora" e envio agendado diário às 7h.
- Cada pessoa recebe **somente o que o próprio perfil autoriza** (líder: só o time; Site Leader: tudo), com nota média, meta, situação, itens críticos, processos e principais ofensores.
- Falha de um envio não derruba os demais; cota diária respeitada; tudo registrado no histórico de alterações.

**Idiomas**: dicionário completo nas telas e mensagens novas e colunas opcionais de tradução (EN/ES) para sub-processo e descrição das perguntas em Cadastros.

**Configurável**: limite de "poucas auditorias", meta (nota média), permissões por perfil, destinatários, frequência e idioma dos e-mails.

### Como atualizar da v6.x para a v7
1. Substitua `Code.gs`, `Index.html`, `Styles.html`, `JS_Client.html` e `appsscript.json` (novo escopo `script.scriptapp`, usado só para o envio agendado).
2. No editor, execute **uma vez** `migrarV7` (pode repetir sem perda): cria a aba `Cad_Relatorio_Email`, as colunas de tradução e `Critico_NC`, e dá a permissão "ver nomes" aos perfis que já viam relatórios.
3. Publique uma nova versão da implantação e autorize os novos escopos quando o Google pedir.
4. Em Configurações > Relatório por e-mail, adicione os destinatários e ligue o envio agendado.

### Perfil Líder (escopo "Somente o time dele")
- O escopo é automático: o líder é identificado pelo nome do usuário (igual ao do líder no cadastro de pessoas; acento e maiúsculas não importam). Não há permissão extra.
- Vale para relatórios, exportação, e-mail, lista "sem auditoria", contadores de pendentes e a lista de pessoas enviada ao navegador. A Matriz e o formulário mostram todas as docas e clusters (o líder pode auditar qualquer unidade).
- Líder com permissão de auditar: escolhe qualquer doca ou cluster, mas só colaboradores do time dele (o servidor recusa os demais) e a auditoria fica no nome dele.
- Auditoria com colaboradores de duas equipes: o líder vê a auditoria, mas só os colaboradores e o líder dele.
- O limite por turno é opcional e soma-se ao escopo; um mesmo perfil serve para todos os líderes.
- Em Acessos, usuário com perfil "time" sem líder ativo correspondente aparece com a etiqueta "líder não encontrado".
- Auditor comum e quem gere pessoas continuam recebendo o cadastro completo; o líder recebe só o time dele.

### Segurança (revisão de 16/11)
- O escopo `drive.readonly` foi removido do `appsscript.json`. A verificação em Acessos > Segurança usa só a planilha (quem tem edição ou leitura direta) e avisa que o compartilhamento por link deve ser conferido em Compartilhar.
- A página não aceita mais ser embutida em outros sites (removido `ALLOWALL`). Se o app for embutido em Google Sites ou outra página, é preciso reverter esta mudança.
- `diagnostico()` só roda para Admin (ou para o dono quando a planilha ainda não tem usuários).
- `enviarRelatoriosAgendados`: chamada sem identidade roda no máximo uma vez por hora; chamada de outra pessoa é negada.
- Cada exportação de CSV é registrada no log de Acessos (quem, período e filtros), uma vez por exportação.
- Ao publicar a nova versão, o Google pode pedir nova autorização, porque os escopos mudaram.
- Pendente para a próxima execução: fixar o hash de integridade (SRI) do Chart.js 4.4.1 carregado da CDN.

## Correções da versão 7.2 (revisão de código)

Revisão feita com os agentes de segurança, falhas silenciosas e fluxos de clique. Nenhuma migração é necessária: basta substituir `Code.gs`, `JS_Client.html` e publicar uma nova versão.

Servidor:
- Relatório por e-mail: se o e-mail sai e só a gravação da data falha, o envio conta como feito (antes era reenviado em duplicidade). Falhas do envio agendado das 7h passam a aparecer no log como "Agendamento com falhas".
- Exportação CSV registrada no log mesmo quando o primeiro lote não é o de início (antes, pular o primeiro lote escapava do registro).
- `bootstrap(true)` só limpa o cache de quem tem acesso (antes, qualquer conta da organização podia limpar o cache de todos).
- Auditoria sem colaborador: o líder informado precisa existir no cadastro. O turno é checado contra o escopo do perfil na gravação.
- Perfis: quem tem a permissão de perfis não edita um perfil com mais acesso do que o próprio.

Cliente:
- Formulário de auditoria: trocar a doca mantém as respostas; rascunho que chega atrasado não sobrescreve o que foi marcado; falha ao ler o rascunho pausa o salvamento automático; indicador "Falha ao salvar o rascunho"; cards de líder abertos em sequência não se misturam.
- Acessos: armar a exclusão não apaga o formulário; a consulta de pendentes atualiza só o selo; salvar e depois trocar de aba não desenha a aba errada.
- Telas: período inválido restaura as datas; clicar no menu dentro de um detalhe volta à lista; exportação não roda em paralelo e o arquivo usa o período pedido; busca de colaboradores não esconde a tabela Equipes; botões "Enviando…" voltam ao normal em falha; duas alterações seguidas de frequência e idioma do relatório por e-mail não se revertem.

Decisões mantidas: o líder vê todas as docas e clusters (Matriz sem recorte); o cadastro de pessoas segue completo para quem audita, porque a escolha do colaborador depende dele. Pendente: hash SRI do Chart.js.

Testes novos: `server8.test.js` (7) e `client6.test.js` (16). Cada um falha no código da 7.1 e passa na 7.2.

## Estrutura do repositório e desenvolvimento
- `src/`: os arquivos que vão para o Apps Script (`Code.gs`, `Index.html`, `Styles.html`, `JS_Client.html`, `appsscript.json`). Não edite `JS_Client.html` à mão.
- `client/parts/`: fonte do JavaScript do cliente (`i18n_*.js`, `p0.js` a `p6.js`). `npm run build` junta tudo em `src/JS_Client.html`.
- `tests/`: simulador do Apps Script, dados de teste e as suítes (servidor e cliente em jsdom). `npm test` roda todas.
- `docs/`: plano da versão 7 e acordo de autoria.

Fluxo: edite `src/Code.gs`, `src/Index.html`, `src/Styles.html` ou `client/parts/`, rode `npm run build` e `npm test`, e só então cole os arquivos de `src/` no Apps Script.
