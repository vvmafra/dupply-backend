# Design Conceitual: Motor de Investimento em Cotas de FIDC

Este documento detalha o funcionamento conceitual, modelagem de banco de dados e os fluxos financeiros de uma Engine de Investimento em Cotas de FIDC (Fundo de Investimento em Direitos Creditórios).

---

## 1. Funcionamento do FIDC e Divisão de Cotas

Para captar recursos e estruturar a antecipação de recebíveis legalmente e com segurança para os investidores, o fundo é estruturado com base em **Cotas**.

* **Patrimônio Líquido (PL / NAV - Net Asset Value):** Reflete a soma de todos os ativos do fundo (caixa disponível + valor presente dos recebíveis a receber) menos eventuais passivos (taxas de custódia, auditoria, etc.).
* **Cota Sênior (Investidores da Plataforma):** 
  * Possui prioridade no resgate e amortização de valores.
  * Possui um rendimento-alvo pré-fixado ou indexado (ex: 100% do CDI, 12% a.a. ou IPCA + 6%).
  * Rende de forma previsível e linear dia após dia útil.
* **Cota Subordinada (Fintech / Originadora):** 
  * Não possui rendimento fixo.
  * Absorve as primeiras perdas do fundo em caso de inadimplência de devedores (sacados).
  * Fica com o **ganho excedente (spread)** do fundo após o pagamento das cotas seniores e despesas administrativas.
* **Barreira de Subordinação:** Percentual mínimo de cotas subordinadas em relação ao PL total (ex: 20%) que a fintech deve manter para garantir a segurança dos investidores seniores.

---

## 2. Modelagem do Banco de Dados (Schema Conceitual)

Abaixo está a proposta de tabelas necessárias para gerenciar o FIDC, os preços diários das cotas, e a carteira de cada investidor.

### A. Tabela `fidcs`
Configurações globais de cada fundo ativo.
* `id`: `text` (Primary Key)
* `name`: `text` (Nome do fundo)
* `target_yield_annual`: `real` (Taxa de rendimento-alvo, ex: `0.15` para 15% a.a.)
* `subordination_min_percentage`: `real` (Fração mínima exigida de subordinação, ex: `0.20` para 20%)
* `created_at`: `timestamp`

### B. Tabela `fidc_cota_prices` (Histórico Diário de Preços)
Armazena a precificação diária da cota sênior e subordinada (usada para calcular o valor patrimonial em D-0).
* `id`: `text` (Primary Key)
* `fidc_id`: `text` (References `fidcs.id`)
* `date`: `date` (Data de referência do fechamento diário)
* `senior_cota_price_cents`: `integer` (Preço unitário da cota sênior com precisão multiplicada, ex: R$ 1,023456 armazenado como `1023456`)
* `subordinated_cota_price_cents`: `integer` (Preço unitário da cota subordinada)
* `total_pl_cents`: `integer` (Patrimônio Líquido total do fundo no dia)
* `created_at`: `timestamp`

### C. Tabela `investor_cota_balances` (Custódia de Cotas)
Registra a quantidade exata de cotas que cada investidor possui no fundo.
* `investor_id`: `text` (References `investors.id`)
* `fidc_id`: `text` (References `fidcs.id`)
* `cota_type`: `text` (`"senior"` ou `"subordinated"`)
* `amount_shares`: `decimal(18, 8)` (Quantidade de cotas armazenadas com 8 casas decimais de precisão)
* `created_at`: `timestamp`
* `updated_at`: `timestamp`

### D. Tabela `fidc_cota_transactions` (Extrato de Movimentações)
Histórico de compras e vendas de cotas do fundo.
* `id`: `text` (Primary Key)
* `investor_id`: `text` (References `investors.id`)
* `fidc_id`: `text` (References `fidcs.id`)
* `cota_type`: `text` (`"senior"` ou `"subordinated"`)
* `transaction_type`: `text` (`"subscription"` / aplicação ou `"redemption"` / resgate)
* `amount_reais`: `real` (Valor financeiro total movimentado)
* `share_price_at_transaction`: `real` (Valor de 1 cota na data da transação)
* `shares_transacted`: `decimal(18, 8)` (Quantidade de cotas geradas ou liquidadas)
* `created_at`: `timestamp`

---

## 3. Fluxos de Negócio e Cálculos da Engine

### Fluxo 1: Aplicação (Subscription)
Quando o investidor deseja alocar capital no fundo:
1. O investidor define o valor em Reais a ser aplicado (ex: $V = R\$ 1.000,00$).
2. A engine verifica se ele tem saldo livre suficiente em dinheiro (`balance_cents` da tabela `investors`).
3. Busca o preço atualizado da cota sênior do dia ($P_{senior}$): ex: R$ 1,02500000.
4. Calcula a quantidade de cotas geradas ($Q$):
   $$Q = \frac{V}{P_{senior}} = \frac{1000}{1,025} = 975,60975610 \text{ cotas}$$
5. Cria um registro na tabela `fidc_cota_transactions`.
6. Atualiza `investor_cota_balances` somando $Q$ cotas ao saldo do investidor.
7. Decrementa o saldo em dinheiro do investidor em R$ 1.000,00.

### Fluxo 2: Precificação Diária e Fechamento (NAV Run)
Rotina automatizada executada todas as noites (fim do dia útil) para recalcular os preços das cotas:
1. **Calcula o Ativo Total (PL):**
   * **Caixa:** Soma os saldos bancários líquidos do FIDC.
   * **Carteira de Duplicatas:** Calcula o valor presente de todas as duplicatas ativas (compradas pelo FIDC) aplicando a taxa de desconto dia a dia (o recebível "valoriza" conforme se aproxima da data de vencimento).
2. **Atualiza a Cota Sênior:**
   * A cota sênior rende linearmente a taxa alvo diária (ex: se a meta é CDI + 2% a.a., a cota sênior é corrigida pela fração diária correspondente, ex: +0,05%).
3. **Calcula o Residual (Lucro de Spread da Cota Subordinada):**
   * O valor restante do PL do fundo, após deduzir o valor total de todas as cotas seniores emitidas, pertence à Cota Subordinada (nossas cotas).
   * Se a carteira rendeu mais do que a meta dos investidores sênior, o valor unitário da Cota Subordinada sobe, gerando o lucro de spread da plataforma.
4. Grava os novos preços na tabela `fidc_cota_prices`.

### Fluxo 3: Resgate (Redemption)
Quando o investidor deseja retirar o dinheiro de volta para seu saldo livre:
1. O investidor solicita o resgate de um valor em Reais (ex: $R\$ 500,00$).
2. A engine busca o preço atualizado da cota sênior ($P_{senior}$): ex: R$ 1,05000000.
3. Calcula a quantidade de cotas a serem liquidadas ($Q_{liquidar}$):
   $$Q_{liquidar} = \frac{500,00}{1,05} = 476,19047619 \text{ cotas}$$
4. Verifica se o investidor possui saldo de cotas sênior suficiente em `investor_cota_balances`.
5. Deduz $Q_{liquidar}$ cotas da custódia do investidor.
6. Cria transação de resgate em `fidc_cota_transactions`.
7. Adiciona R$ 500,00 ao saldo em dinheiro livre do investidor (`balance_cents`), disponibilizando-o para saque PIX.
