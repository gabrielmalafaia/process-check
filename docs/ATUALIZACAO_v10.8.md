# Atualização v10.8: desempenho percebido

Vem depois da v10.7. Já está publicada na cópia da planilha (implantação de teste, versão 3).

## O que mudou
- **Abertura mais leve:** o Chart.js (cerca de 200 KB) não carrega mais na abertura do app. Ele vem na primeira tela que tem gráfico, com o mesmo hash de integridade. Se o CDN falhar, aparece "Gráfico indisponível" e a próxima tela com gráfico tenta de novo.
- **Busca sem engasgo:** a busca das tabelas dos relatórios e a busca de Cadastros esperam 200 ms sem digitação antes de filtrar, em vez de filtrar a cada tecla.
- **Ordenar itens na hora:** ao mover um item do processo para cima ou para baixo, a troca aparece antes da resposta do servidor. Se o servidor recusar (outra pessoa mudou o item) ou a rede falhar, a lista volta ao que era e o aviso aparece.
- **Menu estável:** o menu só é redesenhado quando muda (selo novo, idioma, tela). Antes era recriado a cada pulso, o que podia tirar o foco de quem navegava pelo teclado.
- **Operações lentas registradas:** `bootstrap`, `relatorio`, `getMatriz`, `salvarAuditoria`, `listarFeedbacks`, `meusFeedbacks` e `pulso` são medidas. Quando uma passa de 3 s, fica um aviso no log de execuções com a operação, a duração, se deu erro e o Hub, sem e-mail nem parâmetros.
  - Para ver: no editor do Apps Script, **Execuções**, e filtre por `operacao_lenta`.

## Arquivos alterados
`Code.gs`, `Relatorios.gs`, `Auditoria.gs`, `Feedback.gs`, `Online.gs`, `Index.html` e `JS_Client.html`. A planilha não muda.

## Testes
`node tests/run-all.js`: 131 testes, com 14 novos em `tests/lote9.test.js`.

## Conferir no navegador
1. Abra um relatório com gráfico: o gráfico aparece (na primeira vez, um instante depois das tabelas).
2. Digite rápido na busca de uma tabela e na busca de Cadastros: o filtro acompanha sem travar.
3. Em Cadastros > itens do processo, mova um item: ele troca de lugar na hora.
4. Depois de usar o app, veja em Execuções se alguma operação aparece como `operacao_lenta`.

## Ainda não feito
O teste automático em celular com rede lenta precisa do Playwright (um navegador de teste, cerca de 150 MB) e de um login seu no app de teste.
