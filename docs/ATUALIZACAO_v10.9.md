# Process Check v10.9: feedback imediato e sigilo de quem auditou

## Feedback imediato

- **Configurar:** em Cadastros > Perguntas, o campo "Feedback imediato" (Sim/Não) aparece só para quem tem a permissão de obrigações (Site Leader e Admin). Os outros perfis não veem o campo nem recebem a marcação do servidor; ao editarem a pergunta, a marcação é mantida.
- **Gatilho:** uma única não conformidade num item marcado gera na hora uma pendência de feedback "Aberta" para cada colaborador da auditoria. Ela não depende da regra das N auditorias abaixo da nota média.
- **O auditor não vê nada:** o formulário não recebe a marcação e a resposta ao salvar a auditoria não muda.
- **Tela do Site Leader (Programação > Feedbacks):** o feedback imediato aparece primeiro, com faixa vermelha, o texto "Feedback imediato" e o motivo, que é o texto da pergunta que ficou não conforme. Quem é designado também vê o destaque e o motivo em Meus feedbacks.
- **Prazo:** o mesmo dos feedbacks normais.
- **A marcação vale como era na hora da auditoria:** ela é gravada no detalhe da auditoria, como o "crítico". Desmarcar depois não apaga o motivo das pendências já geradas.
- **Cobertura:** a auditoria do feedback imediato conta como coberta. O gatilho normal não a conta de novo.

## Quem auditou: permissão "Ver quem auditou (feedbacks)"

- **Permissão nova de perfil, `ver_auditor`:** o Admin a tem por padrão e decide, no editor de perfis, se outros perfis também a terão. Só quem edita perfis concede a permissão, e ninguém concede o que não tem.
- **Com a permissão:** a lista de feedbacks do Site Leader e a tela Meus feedbacks mostram "Auditado por <nome>" em cada auditoria. O aviso "esta pessoa fez uma ou mais das auditorias", ao designar, também aparece.
- **Sem a permissão:** o servidor não envia quem auditou. Nada disso chega ao navegador.
- **Padrão desta versão:** Site Leader, Analista e Auditor começam sem a permissão, que é o comportamento de antes desta versão. Antes, o Site Leader recebia o auditor; agora, só se o Admin liberar.

## Revisão (código, segurança e desempenho)

Corrigido nesta versão:
- Excluir, mover e desfazer a exclusão de uma pergunta devolviam a marcação de feedback imediato a quem não pode vê-la. Agora a marcação é filtrada.
- Quem não vê a marcação não conseguia mover nem excluir uma pergunta marcada, porque a conferência de versão falhava. A falha também revelava quais perguntas estavam marcadas. Agora o valor da planilha é completado dentro da trava, numa função só (`origComMarcacao_`).
- Em Meus feedbacks, os itens não trazem mais a etiqueta de quais perguntas são imediatas. O motivo continua aparecendo.
- **Desempenho:**
  - a geração do feedback imediato lê só a coluna Chave dentro da trava;
  - a lista de feedbacks lê o histórico uma vez, e não duas;
  - depois de gerar a pendência, só a versão do cache é trocada, sem a limpeza completa.

Fica como está (decisão de produto):
- **Nome do auditor nos relatórios:** ele continua aparecendo na lista de Auditorias e na tela Auditores para quem tem essas telas, como antes desta versão. A permissão nova vale para as telas de feedback.
- **Quem dá o feedback vê o motivo e sabe que é imediato:** precisa disso para conversar com o colaborador.
- **Reenvio da mesma auditoria:** se a geração da pendência imediata falhar na primeira gravação (a falha vai para o log), o reenvio do mesmo formulário não tenta de novo.
- **Marcação em cache:** a marcação usada na auditoria vem do cache das perguntas, e uma mudança acabada de fazer pode levar até 2 minutos para valer.
- **Excluir e restaurar:** quem não pode definir a marcação, ao excluir e restaurar uma pergunta marcada, a restaura sem a marcação. O Site Leader precisa marcá-la de novo.

## Publicação

1. Substitua os arquivos `.gs` e `.html` de `src/` no Apps Script. Não há migração para rodar: a coluna `Feedback_Imediato` entra sozinha na aba `Cad_Processos_Perguntas` na primeira vez que uma pergunta é salva.
2. Publique uma nova versão da implantação.

## Limites conhecidos

- Uma auditoria só de doca ou cluster, sem colaborador, não gera feedback imediato, porque o feedback é sempre para uma pessoa.
- Se a gravação da pendência imediata falhar depois de a auditoria já estar salva, a falha vai para o log e a auditoria não é perdida. Nenhuma rotina gera a pendência de novo depois. Isso acompanha o padrão da v10.2: nada depois da gravação vira erro para o auditor.
- Quando quem não pode configurar desfaz a exclusão de uma pergunta marcada, ela volta sem a marcação. O Site Leader precisa marcá-la de novo.

## Testes

- `tests/server16.test.js` (9 testes) e 3 testes novos em `tests/client10.test.js`.
- Sigilo: `tests/server15.test.js` ("sigilo: só o Admin sabe quem auditou") e `tests/client10.test.js`.
- Relatório por e-mail, envio automático: `tests/server17.test.js` (10 testes). O teste simula um calendário de noites com o gatilho das 22h e confere:
  - o diário todo dia;
  - o semanal na segunda, cobrindo os últimos 7 dias;
  - o mensal no dia 1, cobrindo os últimos 30 dias;
  - o idioma de cada destinatário;
  - o e-mail de período sem auditorias, que sai com o aviso e sem números;
  - o destinatário pausado e reativado;
  - que não há envio em dobro na mesma noite;
  - que um gatilho antes das 22h não envia;
  - que uma chamada pelo navegador é barrada.
- O simulador passou a entender a hora no formato `'H'`. Antes, o portão das 22h nunca era testado de verdade.
- Permissão `ver_auditor`: `tests/server15.test.js` e `tests/client10.test.js`. Revisão de segurança: 2 testes novos em `tests/server16.test.js`.
- Suíte completa (`npm test`): 1.151 testes passando, lint sem erros.

## Ponto em aberto: envio perdido

Se o gatilho não rodar no dia certo (falha do Google ou cota esgotada), o relatório daquele período não é enviado depois:
- o semanal só sai na segunda seguinte, já cobrindo outra semana;
- o mensal só sai no dia 1 do mês seguinte.

O diário não perde nada além do próprio dia.
