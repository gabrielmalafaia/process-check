# Atualização v10.3: passo das 22h confiável (lote 3 da revisão)

Inclui a v10.1 e a v10.2. Publique tudo junto.

## O que mudou
- **Gatilho próprio (H6):**
  - Metas, feedback obrigatório e reenvio de avisos têm agora um gatilho só deles, `passoNoturno`, às 22h.
  - Desligar o relatório por e-mail não desliga mais esses passos.
  - Ligar o relatório cria o gatilho novo antes de apagar o antigo; se a criação falhar, o antigo continua.
- **Prazo único (H6):**
  - Cada rotina para em 5,5 minutos (o limite do Google é 6).
  - Os três passos noturnos dividem esse prazo, e cada um roda isolado: a falha de um é contada na tela de Log e os outros seguem.
  - Antes, os orçamentos somavam mais de 6 minutos e a última etapa podia nem rodar.
- **Fila de avisos (M15):**
  - O carimbo do aviso passa por "enviando…" e só vira data depois que o e-mail sai. Se a execução morrer no meio, o aviso é tentado de novo depois de 1 hora.
  - "Sem destino" é reavaliado a cada noite: quem foi reativado recebe o aviso.
  - O ponto de partida da fila muda a cada dia, então um aviso que sempre falha não trava os outros.
  - Um erro num item não derruba o resto.
  - Se a cota de e-mail acabar no meio, a fila para ali, sem reservar à toa os itens restantes.
  - Depois que o e-mail sai, a data é gravada com até 3 tentativas, porque a trava pode estar ocupada.
  - "Sem destino" só é gravado se o carimbo não mudou desde a leitura. Assim, uma pendência reatribuída e avisada nesse meio tempo não perde a data.
  - Endereço com caractere proibido (vírgula, ponto e vírgula etc.) vira "sem destino", em vez de ficar pendente para sempre.
  - Se a consulta de gatilhos do Google falhar, nada é criado nem rodado em dobro: ligar o agendamento mostra o erro, e o relatório não roda os passos noturnos naquele dia.
- **Relatório (M16):**
  - Enviar o relatório para alguém de outro Hub não troca mais o Hub de quem disparou.
  - A data do último envio é gravada dentro da trava, relendo a linha (uma exclusão no meio do lote não carimba a pessoa errada).

## Como publicar
1. Copie `Code.gs`, `Hubs.gs`, `Regras.gs`, `Log.gs`, `Obrigacoes.gs`, `Index.html` e `JS_Client.html` desta pasta para o projeto do Apps Script.
2. Publique uma nova versão da implantação. Não há migração.
3. Instale o gatilho novo, de uma destas formas:
   - em Configurações, desligue e ligue o envio agendado (isso também garante o gatilho do passo noturno);
   - ou, no editor, rode `agendarPassoNoturno`.
4. Até que o gatilho novo exista, o relatório das 22h continua rodando os passos noturnos, como antes. Nada para de funcionar no meio da publicação.

## Testes
```
node tests/lote1.test.js
node tests/lote2.test.js
node tests/lote3.test.js
```
São 51 testes. Os do lote 3 cobrem o gatilho próprio, o prazo único, a ordem de criar e apagar gatilhos, a reserva "enviando" vencida e recente, a reavaliação de "sem destino", o erro num item, o prazo esgotado e o contexto de Hub.

## Limites conhecidos
- Se o e-mail sair mas a gravação da data falhar, o aviso pode ser enviado de novo depois de 1 hora (a falha é contada no Log). Entre um aviso duplicado e um perdido, o sistema escolhe o duplicado.
- `passoNoturno` e `enviarRelatoriosAgendados` são funções públicas, como toda rotina de gatilho no Apps Script. Elas recusam quem chega pelo navegador com identidade, e sem identidade aceitam no máximo uma execução por hora.
  - Com a implantação atual (acesso só para o domínio) o navegador sempre manda identidade, então o risco é baixo.
  - Se um dia a implantação for aberta para "qualquer pessoa", uma chamada anônima depois das 22h poderia ocupar a janela da hora e fazer o gatilho real daquele dia ser recusado. Esse risco já existia antes, só para o relatório.
- O gatilho do passo noturno só é criado automaticamente quando alguém liga o envio agendado. Se o relatório estiver desligado, rode `agendarPassoNoturno` uma vez no editor.
