# Atualização v10.2: gravações que não ficam pela metade (lote 2 da revisão)

Inclui a v10.1. Publique as duas juntas.

## O que mudou
- **Acessos (H3):**
  - Criar, alterar ou excluir um usuário ou um perfil, e aprovar um cadastro, agora é tudo ou nada.
  - Se o registro no log obrigatório falhar, ou qualquer outro passo, tudo o que já foi gravado é desfeito e o usuário vê "nada foi alterado".
  - Antes, a mudança ficava gravada sem log e o acesso antigo continuava no cache por até 2 minutos.
  - Na aprovação de um líder, o usuário, a solicitação e o cadastro de pessoa voltam ao que eram, e o histórico ganha a linha "Revertido".
- **Auditoria (H4):**
  - Cada formulário tem um identificador. Se o envio for repetido (por exemplo, a rede caiu ou deu erro depois de gravar e o auditor clicou de novo), o servidor devolve a auditoria já gravada em vez de criar outra.
  - Só conta como repetição se o conteúdo for o mesmo. Se o auditor mudou doca, colaborador ou respostas antes de reenviar, a nova auditoria é gravada.
  - Os passos depois da gravação (limpar cache, apagar o rascunho) não viram mais erro na tela.
- **Renomear líder (H5):**
  - A troca do nome no cadastro, nos colaboradores, nas docas e nas regras é desfeita por inteiro se um dos passos falhar.
  - "Revertido" só entra no histórico quando a reversão deu certo. Se ela não der certo, a mensagem pede para atualizar e conferir, e o log de atividade registra "Falha ao desfazer alteração".

## Como publicar
1. Copie `Code.gs`, `Hubs.gs`, `Regras.gs`, `Log.gs`, `Obrigacoes.gs`, `Index.html` e `JS_Client.html` desta pasta para o projeto do Apps Script, substituindo os atuais.
2. Publique uma nova versão da implantação. Não há migração.
3. Peça aos usuários que recarreguem a página, porque o identificador do formulário vem do cliente novo. Um cliente antigo continua funcionando, só que sem essa proteção contra duplicação.

## Testes
Dentro desta pasta:
```
node tests/lote1.test.js
node tests/lote2.test.js
```
São 30 testes. Os do lote 2 simulam falha no log, numa aba no meio da aprovação, no rascunho e nas regras, e também a falha parcial (a planilha grava e depois dá erro). Eles conferem que nada fica gravado pela metade e que um erro sem nenhuma gravação mantém a mensagem original.

## Limites conhecidos
- A proteção contra duplicação da auditoria fica no cache do Apps Script por até 6 horas. Se o Google descartar o cache antes disso, um reenvio pode duplicar. Para garantia permanente, seria preciso uma coluna com o identificador na aba de auditorias (com migração).
- A planilha não tem transação. Se a própria reversão falhar (por exemplo, a planilha fora do ar no mesmo instante), a mensagem avisa e o log registra, mas o dado pode ficar parcial até alguém conferir.
- Com o isolamento ligado e sem Hub ativo, renomear um líder não atualiza as listas de Times das regras. A falha é contada na tela de Log, mas a renomeação segue.
- Ficam para o próximo lote: rollback de `moverCadastro`, `restaurarCadastro` e `salvarConfigs`, e a ordem de desfazer de `registrarFeedback`.
