# Atualização v10.4: menos espera e menos chamadas (lote 4 da revisão)

Inclui as versões 10.1 a 10.3. Publique tudo junto.

## O que mudou
- **Gravar auditoria (H7):**
  - As colunas de texto de uma linha nova são formatadas numa chamada só. Antes era uma por coluna, até 10 por gravação, com a trava de todos presa.
  - O cabeçalho do histórico é conferido uma vez a cada 6 horas, não a cada auditoria.
  - A localização das abas fica guardada durante a execução.
  - O registro de atividade saiu de dentro da trava principal, então os outros auditores não esperam por ele.
- **Rascunho (H8):**
  - O salvamento automático, o descarte e a leitura do rascunho localizam a linha lendo só as colunas de chave (auditor, processo, doca ou colaborador, e Hub).
  - Antes, a cada pausa de 1,2 segundo na digitação, o sistema lia a aba inteira de rascunhos, com o JSON de todos os auditores, dentro da trava.
  - Ao abrir um rascunho, o sistema confere o ID e o e-mail da linha antes de devolver o conteúdo. Se a linha tiver mudado de posição nesse meio tempo (outro auditor finalizou uma auditoria), nada é devolvido. Um auditor nunca abre o rascunho de outro.
- **Selos do menu (H9):**
  - O navegador faz uma chamada a cada 2 minutos (o pulso), e ela traz junto os números de pendentes, metas novas, feedbacks e usuários online, conforme o que o perfil pode ver.
  - Antes eram até 5 chamadas separadas, e cada uma refazia a checagem de acesso.
  - Se um dos números falhar no servidor, ele só fica de fora e os outros chegam.
  - Os contadores ficam 10 minutos em cache no servidor, em vez de 2. O cache é refeito a cada gravação, então uma mudança aparece no próximo pulso.

## Como publicar
1. Copie `Code.gs`, `Hubs.gs`, `Regras.gs`, `Log.gs`, `Obrigacoes.gs`, `Online.gs`, `Index.html` e `JS_Client.html` desta pasta para o projeto do Apps Script. O `Online.gs` entra a partir desta versão.
2. Publique uma nova versão da implantação. Não há migração.
3. Peça aos usuários que recarreguem a página: o pulso único vem do cliente novo.

## Testes
```
node tests/lote1.test.js
node tests/lote2.test.js
node tests/lote3.test.js
node tests/lote4.test.js
```
São 63 testes. Os do lote 4 medem as chamadas à planilha e as células lidas: uma formatação por gravação, nenhuma leitura da aba inteira de rascunhos, menos de 1.010 células lidas com 200 rascunhos. Eles também conferem o pulso por perfil e o pulso com um contador em erro.

## Limites conhecidos
- O cliente não tem teste automatizado aqui (falta o simulador de navegador da suíte original). O pulso único foi conferido por leitura e pela sintaxe. Vale abrir o sistema depois de publicar e conferir os selos do menu e o contador online.
- Se alguém mudar o cabeçalho da aba de auditorias direto na planilha, o sistema só corrige na próxima conferência (até 6 horas). Se a aba for apagada ou esvaziada, o cabeçalho é refeito na hora.
- Se um contador falhar sempre no servidor, o selo fica parado no último valor, sem aviso na tela. A falha aparece no contador de falhas da tela de Log.
- Ficam para depois os itens de desempenho que dependem do tamanho real das abas (M18 a M22: Matriz, progresso de metas, cache acima de 100 KB, invalidação do cache). Antes deles, vale medir.
