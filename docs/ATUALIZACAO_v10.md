# Atualização v10: histórico de pessoas, metas por líder e feedback obrigatório

## O que mudou

### 1. Histórico de time e turno (nada é sobrescrito)
- Toda mudança de colaborador ou líder (criar, editar, mover, renomear, excluir, restaurar, carga em massa e aprovação de líder) grava uma linha em `Pessoas_Historico`: quem, quando, líder e turno antes e depois, e quem alterou.
- Renomear grava também uma linha "Renomeado para" no nome antigo, para a história continuar ligada.
- Se a gravação do cadastro falha depois do histórico, o sistema grava "Revertido: motivo". Se o histórico falha, o cadastro não é alterado.
- A migração grava o "Estado inicial" de cada pessoa já cadastrada.

### 2. Metas por líder (Programação > Metas por líder)
- Permissão nova `obrigacoes` (só Site Leader e Admin; cada Site Leader age só no próprio Hub; o perfil precisa enxergar todos os dados).
- O Site Leader escolhe a pessoa, a quantidade de auditorias, o início, o prazo final e, se quiser, limita por processo, turno, cor/símbolo ou time. A pessoa recebe e-mail e um número no menu **Minhas metas**.
- A meta só conta auditorias finalizadas pelo responsável, no período e no escopo. Se a regra v9 dele não permite auditar ninguém, a meta é recusada.
- Cancelar mantém a linha (status "Cancelada") e vai para o log.
- E-mail não enviado fica marcado e é reenviado pelo passo das 22h (no máximo 50 por execução).

### 3. Feedback obrigatório (Programação > Feedbacks obrigatórios, e Meus feedbacks)
- **Gatilho:** 3 ou mais auditorias abaixo da nota média (hoje 90%) do mesmo colaborador ativo em 30 dias. A nota de corte usada fica guardada na pendência. Auditoria já usada em uma pendência nunca conta de novo. Auditoria com vários colaboradores conta a nota agregada para cada um.
- A pendência é criada quando o Site Leader abre a aba (no máximo a cada 5 minutos) e pelo passo das 22h, em cada Hub ativo.
- **Designação:** o Site Leader ou o Admin escolhe qualquer usuário ativo do Hub (inclusive auditor). Se a pessoa fez uma das auditorias da pendência, aparece só um aviso. Pode reatribuir até o feedback ser registrado; cada designação dá 7 dias e envia e-mail sem nome de colaborador, nota ou texto livre.
- **Registro:** só a pessoa designada registra, pelo e-mail autenticado da sessão. Mínimo de 50 caracteres (máximo 2000), no mínimo 8 palavras e 12 letras diferentes, nenhuma palavra repetida em mais de 40% do texto, não repete um texto antigo do mesmo autor, não começa com `= + - @`.
- **Prova:** `Feedback_Registros` só recebe linhas novas. Cada linha guarda autor (e-mail), quem designou e quando, time e turno na época, texto, data e um hash SHA-256 encadeado com a linha anterior (todos os Hubs). `verificarProvaFeedback` (Site Leader/Admin) confere a cadeia e aponta a primeira linha alterada. O log de atividade guarda só o início do hash, nunca o texto.
- **Atraso:** passou de 7 dias, continua aberto; o Site Leader e a pessoa designada veem o alerta e podem registrar ou reatribuir.
- **Privacidade:** o texto é lido pela pessoa designada, pelo Site Leader do Hub e pelo Admin. Retenção prevista de 12 meses (ver limites).
- A tela **Meus feedbacks** aparece só para quem tem designação (decidido pelos dados no servidor, não pelo perfil).
- Selos no menu: Programação (feedbacks abertos ou atrasados), Meus feedbacks (a registrar), Minhas metas (metas novas).

## Como publicar
1. No projeto do Apps Script, crie os arquivos NOVOS `Obrigacoes.gs` e (se ainda não tem a v9) `Regras.gs`.
2. Copie `Code.gs`, `Hubs.gs`, `Import.gs`, `JS_Client.html`, `Index.html` e `Styles.html`.
3. Rode `migrarV9` (se ainda não rodou) e `migrarV10` uma vez no editor. A v10 cria `Pessoas_Historico`, `Metas_Lider`, `Feedback_Pendencias` e `Feedback_Registros`, dá a permissão `obrigacoes` ao perfil Site Leader e grava o estado inicial.
4. Publique uma nova versão da implantação.
5. Desligue e ligue o envio agendado em Configurações (recria o gatilho das 22h, que agora também gera feedbacks e reenvia avisos).
6. Perfis de líder precisam da tela `minhas` para ver Minhas metas.

## Limites conhecidos
- Pessoas são ligadas por nome (sem acento e caixa), como na v9.
- O Site Leader pode programar meta para um Admin do próprio Hub. O progresso da meta não remove auditorias repetidas e aceita início retroativo.
- O histórico não acompanha mudanças de Cargo e de Status_Ativo (só time e turno).
- A retenção de 12 meses não é aplicada automaticamente: não existe rotina de eliminação. Quando existir, deve ser um evento registrado. Até lá, a planilha deve ser protegida no Google Sheets (só leitura para editores comuns).
- A prova encadeada detecta alteração, mas quem tem acesso de edição à planilha pode reescrever a cadeia inteira. Para prova externa, exporte periodicamente o último hash.
- A qualidade do texto tem só um piso automático; a revisão de conteúdo é humana.
- Desempenho (medido no simulador com 3000 registros e 600 pendências): registrar lê cerca de 33 mil células, a lista do Site Leader 15 mil e o login 13 mil (com cache de 2 min por usuário). `verificarProvaFeedback` percorre a cadeia inteira: com mais de 50 mil registros pode passar de 1 minuto. `progressoMetasLider_` lê o período inteiro da meta; com a aba de auditorias muito grande, abrir Programação ou Minhas metas pode ficar lento.
- O passo das 22h tem tempo limitado (cerca de 6 minutos para tudo). A geração de feedback usa orçamento de 200 s e rodízio diário de Hubs; um Hub com erro é registrado e os outros seguem. Avisos que sempre falham (endereço recusado) podem ocupar as 50 vagas do reenvio; corrija o e-mail do usuário.
- A âncora da cadeia (quantidade e último hash) fica em ScriptProperties; apagar as últimas linhas ou reescrever o texto é detectado. Quem edita a planilha e o projeto do Apps Script ainda pode refazer tudo.
- `verificarProvaFeedback` devolve só "ok" ao Site Leader de um Hub (a cadeia é de todos os Hubs); número de registros e linha adulterada só para o Admin global.
- O gatilho roda a cada 5 minutos no máximo pela tela e uma vez por dia às 22h: uma auditoria nova pode demorar a gerar a pendência.
