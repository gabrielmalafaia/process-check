# Atualização v9: regras de auditoria por líder

## O que mudou
- Cada líder pode ter uma regra própria, definida pelo Site Leader ou pelo Admin (permissão "Definir quem cada líder pode auditar"), na aba **Acessos > Regras de auditoria**.
- A regra define: se audita o próprio time e/ou outros times; quais times (pelo líder dono); turnos; cores e símbolos das docas e clusters; processos; se vê os resultados do próprio time; e, nos outros times, se vê só o que auditou ou o histórico dos times que pode auditar.
- Os critérios combinam com E (todos precisam bater). Lista vazia = sem restrição naquele critério.
- Sem regra, o líder audita só o próprio time (como antes). A regra só restringe o perfil, nunca amplia.
- Regra ilegível, repetida ou com valor desconhecido: o líder não audita ninguém. Para a visão dos resultados, cai no padrão.
- "Não audita ninguém" (próprio time e outros times desmarcados) vale também para docas e clusters.
- Ninguém edita a própria regra. Quem tem a permissão precisa enxergar todos os dados (sem limite de turno ou processo). Cada Site Leader só vê os líderes do próprio Hub. Toda mudança vai para o log; se o log falhar, a regra não muda.
- Líder com permissão de cadastro só altera colaboradores do próprio time e nunca muda time, turno nem cargo (salvar, restaurar, excluir e carga em massa). Nome de líder agora é único sem considerar acento, caixa ou espaço duplo.
- O Site Leader recebe a permissão nova. O Analista não.

## Como publicar
1. Copie `Code.gs`, `Import.gs`, `JS_Client.html` e o arquivo NOVO `Regras.gs` para o projeto do Apps Script.
2. Rode `migrarV9` uma vez no editor (cria a aba `Cad_Regras_Lider` e dá a permissão ao perfil Site Leader).
3. Publique uma nova versão da implantação.
4. Em Acessos, confira a aba "Regras de auditoria".

## Limites conhecidos
- A regra liga líderes por nome (sem acento e caixa), não por código. Renomear um líder atualiza as listas de Times das regras, mas não o nome do usuário em Cad_Usuarios.
- Matriz e a lista "sem auditoria" ainda mostram só o time próprio do líder; a Matriz não aplica as opções de visão da regra.
- Auditorias antigas com vários colaboradores e sem a tabela de colaboradores podem esconder o colaborador do líder (perda de visão, não vazamento).
- O detalhe de uma auditoria com vários colaboradores mostra a nota e os itens agregados mesmo que parte dos colaboradores esteja oculta.
- Edição em massa de regras (aplicar a vários líderes) não existe ainda.
