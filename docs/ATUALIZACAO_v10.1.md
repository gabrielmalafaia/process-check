# Atualização v10.1: correções de segurança (lote 1 da revisão)

## O que mudou
- **Relatórios (H1):** o servidor só aceita o tipo de relatório como texto. Antes, uma chamada feita pelo console com o tipo entre colchetes (`['export']`) exportava sem a permissão "exportar", mostrava nomes sem "ver nomes" e não deixava registro no log.
- **Renomear líder (H2):** as listas de Times das regras de auditoria só são atualizadas para líderes do Hub atual. Antes, um líder com o mesmo nome em outro Hub tinha a regra reescrita. Sem Hub ativo, nenhuma regra muda.
- **Chaves de segurança (M1):** `ativarHubs`, `desativarHubs` e `ativarAvisoLog` só rodam pelo editor do Apps Script, e cada mudança vai para o log antes de acontecer. Se o log falhar, a chave não muda. Pelo navegador, a resposta é "Acesso negado".
- **Chart.js (M2):** passa a ser carregado com verificação de integridade (SRI), pelo arquivo original do pacote. Se o CDN entregar outro conteúdo, o navegador não executa o script.
- **Mesmo nome (M8):** espaço duplo no meio do nome não diferencia mais pessoas. "Ana  Lima" e "Ana Lima" são a mesma líder em todo o sistema, não só na checagem de nome repetido.
- **Usuário ativo (M9):** há uma única regra, a mesma do login. O usuário só está ativo com "Sim", sem diferença de acento ou maiúscula. Listas de responsáveis por meta, de designação de feedback, de regras e de relatório por e-mail não oferecem mais quem não consegue entrar.
  - Em pessoas do cadastro, "NÃO" e "Não " (com espaço) agora contam como inativo. Vazio continua contando como ativo.

## Como publicar
1. Copie `Code.gs`, `Hubs.gs`, `Regras.gs`, `Log.gs`, `Obrigacoes.gs` e `Index.html` desta pasta para o projeto do Apps Script, substituindo os atuais.
2. Publique uma nova versão da implantação. Não há migração: nenhuma aba e nenhuma coluna mudou.
3. Abra uma tela com gráfico (Visão Geral). Se o gráfico não aparecer e o console do navegador mostrar um erro de "integrity", o CDN mudou o arquivo. Nesse caso, remova o atributo `integrity` e avise.

## Testes
`node tests/lote1.test.js` roda em Node, sem nenhuma dependência. São 14 testes; todos falhavam antes das correções (exceto 1, que confirma o comportamento com Hubs desligados) e todos passam agora. O `tests/harness.js` simula planilha, cache, lock, propriedades e sessão.

## Limites conhecidos
- O teste de "só pelo editor" compara o usuário ativo com o efetivo. Em alguma conta em que o editor não informe o e-mail do usuário ativo, a função é negada também no editor (falha fechada). Nesse caso, rode como dono do projeto.
- Os arquivos originais ficaram sem alteração em `Downloads` e em `orig/`, para comparação.
