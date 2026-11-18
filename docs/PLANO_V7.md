# Process Check - Plano da versão 7 (aguardando autorização para gerar)

Autor: Gabriel Malafaia · Co-autora: Karina Ferreira
Base: v6.2. Este documento é a memória de alteração da v7: tudo que será mudado, em um só lugar.

## 0. Correções de idioma (feitas e testadas na base 6.2, entram na v7)
- Novo arquivo de dicionário i18n_6: aprovação por e-mail (enviado/não enviado), "Cargo informado", linhas do histórico (Ativo, Nome, Perfil, Permissões, Telas, Dados), "Sem Time", listas de metas (No ritmo, Em risco, Atingidas, Não atingidas), "Todos os turnos/processos.", "indisponível".
- Auditoria: 10.874 textos devolvidos pelo servidor nos testes; os que sobraram sem tradução são apenas nomes de dados de teste.
- Limite conhecido: textos digitados pelo usuário (perguntas, sub-processos, processos, docas/clusters, nomes de perfis) permanecem no idioma em que foram cadastrados. Solução na v7: colunas opcionais EN/ES nos cadastros (item 6).

## 1. Relatórios - leitura executiva (BI)
- A1 Comparação com período anterior mostra "sem base de comparação" (sem seta) quando o período anterior tem 0 auditorias.
- A2 Meta (padrão 90%) e distância até a meta dentro do KPI Nota média.
- A3 Gráficos empilhados em 100% por processo e por turno, com n nos rótulos.
- B1 Frase-resumo executiva no topo da Visão Geral.
- B2 Nota média como card principal com mini tendência e linha da meta.
- B3 Tendência semanal substitui o gráfico de rosca.
- B4 Tabela de ofensores: processo, taxa de falha, variação, líder/doca (alteração no servidor + testes).
- B5 Insights clicáveis abrem o relatório já filtrado.
- B6 KPI "auditorias com item crítico reprovado".
- C1 Filtros em duas camadas ("Mais filtros" com contador de filtros ativos).
- C2 Visão A4 de uma página para impressão/PDF.

## 2. Listas de colaboradores e textos
- Sinalizador "poucas auditorias" (padrão n < 3).
- Ordenação padrão: pior nota com n suficiente, depois não auditados.
- Mini tendência por pessoa; ações a partir da lista.
- Observações: coluna/busca e bloco de observações recentes de auditorias não conformes.
- Tabela de auditorias com menos colunas e linha expansível.
- Nova permissão "ver nomes de colaboradores nos relatórios".

## 3. NOVO - Relatório por e-mail
- Além do PDF, envio de relatório por e-mail a pessoas selecionadas.
- Cada destinatário recebe somente o que o perfil dele autoriza (líder: só o time dele; Site Leader: tudo), reaproveitando o mesmo escopo de dados de `auditorias_()`.
- Conteúdo: números principais das auditorias (total, nota média e meta, conformes/observação/não conformes, itens críticos, piores processos, metas em risco), no idioma do destinatário.
- Envio agendado (diário/semanal/mensal) e botão "enviar agora".
- Registro no histórico de alterações; cota do MailApp respeitada; falha de envio não derruba os demais.

## 4. Configurável ou só código? Configurável
Tudo abaixo fica em Configurações/Acessos e na planilha, não no código:
- limite de "poucas auditorias", meta padrão da nota;
- exibir ou não nomes de colaboradores (permissão por perfil);
- destinatários, frequência, conteúdo do e-mail e idioma;
- colunas de tradução EN/ES dos cadastros.

## 5. Migração
- `migrarV7`, idempotente (rodar duas vezes não altera nada); preserva v6.x; novas abas/colunas criadas por `garantirAba_`.

## 6. Tradução dos dados cadastrados
- Colunas opcionais Nome_EN / Nome_ES (e descrição de perguntas) nos cadastros; se vazias, usa o texto original.

## 7. Entrega
- Code.gs, Index.html, Styles.html, JS_Client.html, appsscript.json, README.md (seção v7) e pasta de testes atualizada; todas as suítes e varreduras repetidas antes da entrega.
