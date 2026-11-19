# Atualização v8: Hubs, Online, Log de atividade, carga em massa

Base: v7.2.0 (commit 9de9a65). Esta atualização é aditiva e fica desligada até a ativação manual (chave `HUBS_ATIVO`), então a planilha atual continua funcionando como antes até você ligar.

## O que muda

| Área | Resumo |
|---|---|
| Hub | Cada usuário pertence a um Hub. Auditorias, pessoas, docas e metas ficam separadas por Hub; processos, perguntas, perfis, turnos e clusters (A a X) são globais. Só o Admin global ("*") troca de Hub e edita o catálogo global. O isolamento é feito no servidor e falha fechado (linha ou usuário sem Hub não aparece). |
| Cabeçalho | Mostra Hub e Operação. O Admin global ganha um seletor de Hub. |
| Online | Botão com a contagem de usuários online (pulso a cada 2 min, só com a aba visível; janela de 5 min; guardado só em cache). Permissão `ver_online`. |
| Log de atividade | Registra só ações de escrita (aba `Log_Atividade`), com consulta paginada e filtros. Mantém 90 dias na planilha e arquiva o restante em planilha separada. Permissão `ver_log`. Site Leader vê só o próprio Hub. |
| Aviso de transparência | Tela de aceite no primeiro acesso e sempre que o texto mudar; cada aceite fica na aba `Log_Aceites` (somente acréscimo). Desligado por padrão (`ativarAvisoLog`). |
| Carga em massa | Cadastros de pessoas e docas colando a tabela do Excel. Tudo ou nada: se houver erro, nada é gravado e o sistema mostra linha e coluna. |
| Cadastro de líder | O líder se cadastra (cargo Líder, Hub, turno). Quem aprova: Admin e Site Leader do mesmo Hub. Ao aprovar, vira pessoa/líder automaticamente. |
| Matriz | Nomes de colaboradores só para quem tem `ver_nomes` (líder do próprio time, Admin, Analista, Site Leader). |
| Perfis | Site Leader passa a ter `autorizar`, `ver_log` e `ver_online`; Analista não tem `ver_log`, `ver_online`, `hubs`, `autorizar` nem `perfis`. |
| Desempenho | Fila de pendentes em cache, permissões na chave dos relatórios, "Atualizar" limitado a 1 limpeza global por 30 s, aba Acessos com chamadas em paralelo, escrita e log dentro do lock. |

## Arquivos

Novos: `src/Hubs.gs`, `src/Log.gs`, `src/Online.gs`, `src/Import.gs`, `client/parts/p7.js`, `client/parts/i18n_8.js`.
Alterados: `src/Code.gs`, `src/Index.html`, `src/Styles.html`, `src/JS_Client.html` (gerado por `bash client/build.sh`), `client/parts/p1,p3,p4,p5.js`.

Novas abas (criadas sozinhas): `Cad_Hubs`, `Log_Atividade`, `Log_Aceites`. Nova coluna `Hub` ao final de `Cad_Usuarios`, `Auditorias_Historico`, `Auditorias_Rascunho`, `Auditorias_Colaboradores`, `Cad_Estrutura`, `Cad_Pessoas` e `Metas`; `Cad_Solicitacoes` ganha `Hub` e `Turno`.

## Publicação (ordem)

1. Copie para o projeto Apps Script: `Code.gs`, `Hubs.gs`, `Log.gs`, `Online.gs`, `Import.gs`, `Index.html`, `Styles.html`, `JS_Client.html`, `appsscript.json`.
2. Nova implantação (nova versão do mesmo web app).
3. Abra a aba `Cad_Hubs` e preencha a primeira linha: `ID_Hub` (pode deixar a função gerar depois, ou use `H1`), `Nome` (ex.: o nome do seu Hub), `Operacao`, `Ativo = Sim`.
4. No editor, execute `ativarHubs()` (roda `migrarV8()` e liga `HUBS_ATIVO`). A migração é idempotente: preenche o Hub dos dados existentes, marca os Admins como "*", normaliza os clusters A a X e acrescenta as permissões novas ao perfil Site Leader.
5. Execute `agendarArquivoLog()` (gatilho diário às 3h que arquiva o log antigo).
6. Depois de publicar o cliente novo, execute `ativarAvisoLog()` para exigir o aceite.
7. Entre como Admin, abra Acessos > Hubs e cadastre os demais Hubs; atribua cada usuário ao seu Hub.

Reversão: `desativarHubs()` desliga o isolamento (os dados e as colunas permanecem).

## Verificação

`bash tests/run-all.sh`: servidor (partes 1 a 10, incluindo golden do comportamento anterior e inventário das funções públicas) e cliente (incluindo `client7.test.js` com 8 testes da interface v8), todos verdes. `npm run lint` cobre todos os `.gs` de `src/`.

## Limites conhecidos

- O arquivo do log guarda 1 ano por regra, mas a limpeza de registros com mais de 365 dias na planilha de arquivo ainda não é automática.
- A autorização para criar a planilha de arquivo depende da conta Workspace permitir o escopo de Planilhas/Drive; se falhar, o erro vai para `Log_Permissoes` e o log principal não é apagado.
- Mais de 5 Hubs: o limite de células da planilha ainda precisa de análise.
- A divisão do `Code.gs` em vários arquivos foi adiada; o código novo já está em arquivos separados.
- `ativarAvisoLog` e `agendarArquivoLog` são executados manualmente no editor.
