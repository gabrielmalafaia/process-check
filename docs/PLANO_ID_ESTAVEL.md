# Plano: trocar o nome por um ID estável como chave das pessoas

Este é um documento para decisão, não código. Nada aqui foi aplicado.

## Por que não foi feito junto com os outros lotes
Hoje o sistema liga as pessoas pelo **nome**, comparado sem acento, caixa e espaço duplo. Trocar a chave mexe em todos os relacionamentos da planilha em produção, inclusive no histórico já gravado. Fazer isso sem as suas decisões abaixo poderia deixar auditorias, regras e metas apontando para a pessoa errada.

## Onde o nome é usado como chave hoje

| Onde | Coluna | Liga a |
|---|---|---|
| `Cad_Pessoas` | `Lider` | colaborador ao líder |
| `Cad_Estrutura` | `Lider_Padrao` | doca ao líder |
| `Cad_Usuarios` ↔ `Cad_Pessoas` | `Nome` | usuário de perfil "time" ao seu time |
| `Cad_Regras_Lider` | `Times` (lista `a\|b`) | regra ao time de outros líderes |
| `Metas_Lider` | `Times` | meta ao time |
| `Auditorias_Historico` | `Colaborador`, `Lider` (texto) | auditoria à pessoa |
| `Auditorias_Colaboradores` | colaborador, líder | auditoria com vários colaboradores |
| `Pessoas_Historico` | `Colaborador`, líderes antes/depois | histórico |
| `Feedback_Pendencias` / `Feedback_Registros` | `Colaborador`, `Time_Snap` | feedback à pessoa |

Problemas que isso causa:
- renomear exige propagar o novo nome em cascata (o lote 2 deixou essa cascata atômica);
- homônimos misturam times;
- o lote 7 passou a bloquear nome repetido em perfil "time", o que é um paliativo.

## Decisões que são suas
1. **Formato do ID:** curto e legível (ex.: `P-4K7Q2`) ou UUID? A recomendação é o curto, porque aparece em planilha e em suporte.
2. **Onde fica a coluna:** a convenção do projeto é Hub sempre por último, e o código assume isso em `HUB_ABAS` (posição fixa). Duas opções:
   - **(a)** inserir `ID_Pessoa` antes de `Hub` e reescrever a posição do Hub em todas as linhas (migração maior);
   - **(b)** pôr o ID depois do Hub e mudar a regra para "Hub em posição declarada". A recomendação é a (b): migração menor, só acrescenta coluna.
3. **Histórico antigo:** as auditorias e os feedbacks já gravados ficam com o nome da época (como snapshot) mais o ID preenchido pela migração quando o nome for único? E quando houver homônimo no passado, deixar o ID vazio ou pedir conferência manual?
4. **Usuário ↔ pessoa:** o perfil "time" passa a ligar por uma coluna `ID_Pessoa` em `Cad_Usuarios`, preenchida na aprovação do cadastro e editável pelo Site Leader?

## Desenho proposto (em fases, cada uma publicável sozinha)
1. **Fase A: acrescentar, sem mudar comportamento.**
   - Colunas `ID_Pessoa` em `Cad_Pessoas` e `Cad_Usuarios`, e colunas de ID ao lado de cada coluna de nome nas abas acima.
   - Migração idempotente `migrarV11`: gera o ID de cada pessoa e preenche as referências quando o nome é único no Hub. Ela gera um relatório das ambíguas para conferência.
   - Gravações novas passam a preencher nome e ID.
   - Tudo ainda é lido pelo nome.
2. **Fase B: ler pelo ID com fallback.**
   - Uma única função `pessoaDe_(ref)` resolve por ID e, se vazio, pelo nome. Todas as comparações hoje feitas com `semAcento_(nome)` passam por ela.
   - Um teste de inventário falha se sobrar comparação de nome fora dela.
3. **Fase C: renomear vira só exibição.** Renomear muda só o nome e não propaga em cascata (a cascata do lote 2 sai).
4. **Fase D, opcional:** remover o fallback por nome depois que o relatório de ambíguas zerar.

## Riscos e como cobrir
- **Homônimos no passado:** relatório de ambíguas e conferência manual antes da fase B.
- **Planilha editada à mão** (linha sem ID): o fallback por nome cobre, e a tela de diagnóstico mostra a contagem.
- **Desempenho:** um índice ID → pessoa por execução (mesmo padrão do `ABA_LIDA_`).
- **Volta atrás:** cada fase só acrescenta. Voltar para a fase anterior é publicar a versão anterior; as colunas novas são ignoradas.

## Estimativa
A fase A e a fase B são o grosso do trabalho e tocam cerca de 40 pontos de comparação de nome no servidor e alguns no cliente. Cada fase segue o mesmo ritmo dos lotes: testes primeiro, revisão independente e nota de publicação.
