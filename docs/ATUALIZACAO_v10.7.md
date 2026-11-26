# Atualização v10.7: itens no feedback e quantidade configurável

Vem depois da v10.6. Já está publicada na cópia da planilha (implantação de teste, versão 2).

## O que mudou
- **Meus feedbacks:** cada auditoria que gerou o feedback mostra os itens **não conformes** (abertos, com "CRÍTICO" quando o item é crítico) e os **conformes** (recolhidos, com a contagem). Os itens N/A não aparecem. A descrição é a da época da auditoria, com a tradução em inglês e espanhol quando o item tem uma cadastrada.
  - O e-mail de quem auditou continua fora dessa tela.
  - Auditoria com detalhe ilegível aparece sem a lista, sem quebrar a tela.
  - A aba Feedbacks do Site Leader não mudou.
- **Configurações:** novo campo **"Feedback obrigatório: auditorias abaixo da nota média"** (inteiro de 1 a 50, padrão 3).
  - Vale para os próximos feedbacks gerados; os que já existem não mudam.
  - A janela continua sendo de 30 dias.
  - Valor inválido digitado direto na planilha volta ao padrão 3. Um 0 nunca gera feedback para todo mundo.
  - A mudança vai para o log de atividade junto com as outras configurações.

## Arquivos alterados
`Feedback.gs`, `Cadastros.gs`, `Code.gs`, `Relatorios.gs` (só um campo interno a mais na leitura do histórico), `JS_Client.html` e `Styles.html`. A planilha não muda: a configuração nova é uma linha `FEEDBACK_MIN_AUDITORIAS` na aba `Configuracoes`, criada ao salvar.

## Testes
`node tests/run-all.js`: 117 testes, com 16 novos em `tests/lote8.test.js`. Um dos novos impede que a mesma função seja declarada em dois `.gs`.

## Conferir no navegador
1. Em Configurações, mude a quantidade (por exemplo, para 2), salve e recarregue: o valor continua.
2. Teste o valor 0: aparece o erro no campo.
3. Em Meus feedbacks, abra um feedback designado a você e confira as listas de não conformes e de conformes.
