# Atualização v10.6: código por domínio e pendências médias (lotes 6 e 7 da revisão)

Inclui as versões 10.1 a 10.5. Esta é a nota de publicação de tudo: siga só esta.

## O que mudou nesta versão
### Lote 6: código organizado por domínio (mesmo comportamento)
O `Code.gs` (cerca de 2.270 linhas) e o `Obrigacoes.gs` (cerca de 620) foram recortados por seção, sem alterar nenhuma linha de código:

| Arquivo | Conteúdo |
|---|---|
| `Code.gs` | constantes, catálogo de telas e permissões, manutenção, utilitários, perfis e acesso, carga inicial |
| `Acessos.gs` | solicitações de cadastro, usuários, perfis, diagnóstico |
| `Auditoria.gs` | rascunhos, gravação da auditoria, Matriz |
| `Relatorios.gs` | leitura do histórico no escopo do perfil e relatórios |
| `Metas.gs` | metas gerais |
| `Cadastros.gs` | cadastros e configurações |
| `EmailRelatorio.gs` | relatório por e-mail, gatilhos, passo noturno |
| `PessoasHistorico.gs` | histórico de time e turno, `migrarV10` |
| `MetasLider.gs` | metas por líder |
| `AvisosEmail.gs` | avisos por e-mail e fila de reenvio |
| `Feedback.gs` | feedback obrigatório |

Como o lote foi conferido:
- Todos os arquivos ficaram abaixo de 800 linhas.
- Nenhuma função duplicada.
- A carga funciona em qualquer ordem de arquivos (testado em ordem invertida, um arquivo por vez, como no Apps Script).
- Os originais estão em `antes-da-divisao/`, para comparação.

### Lote 7: pendências médias da revisão
- **Nome repetido (M3):** dois usuários ativos com o mesmo nome no mesmo Hub não podem ter perfil de time, porque um veria o time do outro. A regra só barra quando a gravação cria o conflito (usuário novo, renomeado, com perfil trocado ou reativado). Homônimos que já existiam podem ser editados e inativados.
- **Regra ilegível (M5):** um líder com regra corrompida passa a ver só o que ele mesmo auditou, em vez do time inteiro.
- **Cache (M6):** depois de uma gravação, ninguém volta a ver o dado antigo por 2 minutos. A mesma aba é lida uma vez por execução, e o sistema registra quando uma aba é grande demais para o cache.
- **Itens do formulário (M10):** se um item do processo foi movido ou restaurado depois que o auditor abriu o formulário, a auditoria é recusada com "os itens mudaram, atualize". Antes, a resposta caía no item errado.
- **Vencimento na Matriz (M11):** a auditoria vence exatamente na vida útil configurada. Antes, durava quase um dia a mais.
- **Feedback (M12):** se o registro falhar no meio, tudo é desfeito uma vez só, sem risco de apagar a linha errada.
- **Mover e restaurar item (M13):** as duas linhas trocam numa gravação só. Restaurar não deixa linha em branco. As duas ações vão para o log.
- **Configurações (M14):** salvar é tudo ou nada. Nunca fica nota de corte nova com nota média antiga.
- **Texto secundário:** o cinza ficou um pouco mais escuro e passa de 4,5:1 nos fundos cinza.

### Plano, não aplicado
A troca do nome por um ID estável está em `PLANO_ID_ESTAVEL.md`, com 4 decisões suas e as fases propostas.

## Como publicar (versões 10.1 a 10.6 juntas)
1. Faça uma cópia da planilha e do projeto do Apps Script, por segurança.
2. No projeto do Apps Script:
   - **apague** o arquivo `Obrigacoes`, porque o conteúdo dele foi para 4 arquivos novos;
   - **crie** os arquivos novos `Acessos`, `Auditoria`, `Relatorios`, `Metas`, `Cadastros`, `EmailRelatorio`, `PessoasHistorico`, `MetasLider`, `AvisosEmail` e `Feedback` (do tipo Script), e copie o conteúdo de cada `.gs` desta pasta;
   - **substitua** `Code`, `Hubs`, `Regras`, `Log`, `Online`, `Index`, `JS_Client` e `Styles` pelo conteúdo desta pasta.
3. Confira que não sobrou nenhum `.gs` antigo com função repetida. O Apps Script avisa ao salvar se houver `const` declarado duas vezes.
4. Publique uma nova versão da implantação. Não há migração de planilha.
5. Instale o gatilho do passo noturno: em Configurações, desligue e ligue o envio agendado, ou rode `agendarPassoNoturno` no editor.
6. Peça aos usuários que recarreguem a página.
7. Confira no navegador:
   - **Login:** "Cadastrar-se" abre e mostra os erros.
   - **Matriz:** as cores e o vencimento.
   - **Auditoria:** salvar uma.
   - **Teclado:** abrir e fechar uma janela, o Ctrl+K e o painel de cadastro.
   - **Menu:** os selos e o contador online.
   - **Relatório:** abrir um.

## Testes
```
node tests/run-all.js
```
São 101 testes nos lotes 1 a 5 e 7. O lote 6 não muda comportamento: todos os testes anteriores passam depois da divisão, e a divisão manteve as mesmas 245 funções, sem duplicata.

## Limites conhecidos (resumo de todas as versões)
- Não houve teste em navegador real nem com leitor de tela, porque o simulador de navegador da suíte original não está aqui.
- A proteção contra auditoria duplicada vive no cache, por até 6 horas.
- Se a própria reversão falhar, a mensagem e o log avisam, e o dado pode ficar parcial.
- Ficam para depois:
  - os itens de desempenho que dependem do tamanho real das abas (Matriz, progresso de metas, invalidação do cache);
  - acessibilidade média: Ctrl+K como combobox, mapa de calor, toast, tabelas;
  - a confirmação de intenção do M4, a leitura do cadastro inteiro por quem tem `cad_pessoas`;
  - o M7: o Hub esperado nas gravações do Admin global com duas abas abertas.
