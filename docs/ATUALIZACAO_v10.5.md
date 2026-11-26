# Atualização v10.5: acessibilidade (lote 5 da revisão)

Inclui as versões 10.1 a 10.4. Publique tudo junto.

## O que mudou
- **Diálogos (H10):** janelas, busca (Ctrl+K), aviso de transparência e painel lateral de cadastro passam a usar um comportamento único:
  - o foco entra na janela ao abrir;
  - Tab e Shift+Tab ficam dentro dela;
  - o resto da página fica inerte, ou seja, o leitor de tela e o teclado não "escapam" para trás da janela;
  - ao fechar, o foco volta para o botão que abriu.
  - Uma janela aberta a partir de outra não perde para onde voltar.
  - O aviso de transparência continua sem fechar por Esc, porque o aceite é obrigatório.
  - O painel de cadastro segue o estado a cada redesenho. Fechado por qualquer caminho (X, Esc, salvar, trocar de aba), o foco volta ao botão "Novo" ou ao "Editar" da linha. Recusado pelo servidor, o foco vai ao primeiro campo com erro.
  - Uma janela que sumiu da tela sem ser fechada nunca deixa o resto da página travado.
- **Contraste (H11):**
  - O texto das pílulas de status (conforme, em observação, inconforme) passa a usar os tons escuros que já existiam no tema. Antes ficava entre 3,0:1 e 4,1:1; agora passa de 4,5:1.
  - O cartão verde da Matriz fica um pouco mais escuro (#17804A), para o texto branco ficar legível: 4,97:1, antes 3,45:1.
  - O ponto colorido e as demais cores de status não mudam.
- **Erros do cadastro (H12):**
  - A mensagem de erro saiu de dentro do rótulo, então o nome do campo não inclui mais o erro, e está ligada ao campo.
  - Ao enviar com erro, o campo fica marcado como inválido e o foco vai para o primeiro campo com problema. O leitor de tela lê o rótulo e a mensagem.

## Como publicar
1. Copie `Code.gs`, `Hubs.gs`, `Regras.gs`, `Log.gs`, `Obrigacoes.gs`, `Online.gs`, `Index.html`, `JS_Client.html` e `Styles.html` desta pasta para o projeto do Apps Script.
2. Publique uma nova versão da implantação. Não há migração.

## Testes
```
node tests/lote1.test.js
node tests/lote2.test.js
node tests/lote3.test.js
node tests/lote4.test.js
node tests/lote5.test.js
```
São 82 testes. Os do lote 5:
- guardam contra `$(...).forEach` no cliente (`$` devolve um elemento só; lista é `$$`). Esse erro entrou na primeira versão deste lote e quebrava o botão "Cadastrar-se"; foi pego na revisão e corrigido;
- cobrem a janela que some sem fechar e a volta do foco por seletor;
- calculam o contraste WCAG a partir do próprio `Styles.html`;
- testam o comportamento dos diálogos com um DOM simulado (foco inicial, Tab preso, fundo inerte, foco devolvido, janela em cascata, painel dentro da página);
- conferem que cada campo do cadastro aponta para o próprio erro.

## Limites conhecidos
- Não houve teste em navegador real nem com leitor de tela. Vale conferir com o teclado: abrir e fechar uma janela, o Ctrl+K e o painel de cadastro, e enviar o cadastro com um campo vazio.
- O contraste foi calculado no tema claro, que é o pior caso. No escuro, os tons de status já eram claros.
- Ficam para depois os outros itens de acessibilidade do relatório (nível médio):
  - a busca Ctrl+K no padrão combobox;
  - o menu do usuário;
  - o tom cinza de texto secundário (--mut);
  - o mapa de calor só por cor;
  - o toast;
  - tabelas sem legenda e ordenação só por mouse.
