# Pesquisa: Etherfuse, Stellar e FX API (rampa / câmbio)

**Data:** 2026-05-16  
**Objetivo:** documentar o que é a **Etherfuse** no contexto **Stellar**, o produto **FX API** (REST), e como isso se compara a **âncoras SEP-24** clássicas.  
**Nota de rigor:** este ficheiro resume a documentação pública consultada em 2026-05-16; antes de implementação em produção, rever **changelog** e **contratos de API** na documentação oficial Etherfuse.

---

## 1. Etherfuse e a rede Stellar (contexto de negócio / imprensa)

### 1.1 Anúncio Stellar (Meridian 2025)

A **Stellar Development Foundation (SDF)** anunciou publicamente que a **Etherfuse** se iria juntar à rede Stellar em 2025, com foco em **Stablebonds** e infraestrutura de ativos do mundo real na Stellar.

- **Fonte:** [Stellar.org — Press: Etherfuse to join Stellar network in 2025](https://stellar.org/press/etherfuse-to-join-stellar-network-in-2025-ceo-david-taylor-announces-at-the-stellar-meridian-conference-in-london)

### 1.2 O que isto *não* implica automaticamente

O anúncio de parceria / integração na rede **não** substitui a leitura da **API concreta** que o vosso backend vai chamar. Para engenharia, a fonte de verdade é:

- Documentação técnica Etherfuse: [https://docs.etherfuse.com/](https://docs.etherfuse.com/)

---

## 2. FX API — visão geral (documentação Etherfuse)

A documentação “Overview” descreve a **FX API** como interface para **organizações** criarem experiências de **câmbio** e **pagamentos** com:

- **Quotes** (cotações) com preço fixo por janela de tempo.  
- **Orders** (ordens) que movem fundos entre contas **Etherfuse** e destinos definidos (incluindo, conforme o produto, integração com **Stellar** no fluxo de liquidação).

### 2.1 Conceitos de domínio (modelo mental)

1. **Organization** — entidade cliente da Etherfuse; agrupa utilizadores e chaves.  
2. **API keys** — autenticação de servidor para servidor (nunca expor no browser).  
3. **JWT / sessão de utilizador** — padrão descrito na doc para fluxos onde um utilizador final autentica na vossa aplicação e o backend troca/valida tokens com a Etherfuse (detalhes na doc “Authentication”).  
4. **Quotes** — pedido de cotação com par de moedas, montantes, TTL.  
5. **Orders** — execução após aceitação da cotação; estados e webhooks conforme doc.

### 2.2 Ambiente sandbox

A documentação referencia um host de sandbox para testes sem fundos reais, por exemplo:

- `https://api.sand.etherfuse.com` (confirmar na doc atual o path base exato dos recursos).

**Regra de projeto:** variáveis de ambiente separadas `ETHERFUSE_BASE_URL`, `ETHERFUSE_API_KEY`, `ETHERFUSE_ORG_ID` (nomes ilustrativos) para **sandbox** vs **production**.

### 2.3 Segurança

- **Chaves API** apenas no **backend** (Dupply API), nunca no frontend.  
- **Webhooks** assinados ou validados conforme especificação Etherfuse (implementar após ler secção exacta na doc).  
- **Idempotência** em endpoints de criação de ordem (chaves `Idempotency-Key` se a API suportar — verificar doc).

---

## 3. Etherfuse vs “anchor SEP-24” (tabela de engenharia)

| Aspeto | Anchor SEP-24 (ecossistema Stellar) | Etherfuse FX API |
|--------|-------------------------------------|------------------|
| Padrão | SEP-1, SEP-10, SEP-24, possivelmente SEP-38 | REST proprietário + auth org |
| Descoberta | `stellar.toml`, Anchor Directory | Conta + dashboard Etherfuse |
| UX típica | URL hosted do anchor | Hosted UI Etherfuse *ou* fluxo API-only |
| Carteira Stellar | Fortemente acoplada ao fluxo SEP | Depende do desenho da ordem / liquidação Stellar |
| Manutenção | Menos fornecedores, mais código SEP | Menos código SEP, mais acoplamento a um vendor |

**Conclusão para Dupply:** a Etherfuse é um **provedor de rampa/câmbio** com API própria; **não** é automaticamente o mesmo artefacto que “um anchor no diretório Stellar com SEP-24”, embora ambos possam cumprir o papel de **fiat↔ativo na Stellar** no vosso produto.

---

## 4. Encaixe com o `duplicata-registry` (Soroban)

O contrato atual:

- Regista **metadados** de duplicata na chain (emitente, sacado, montante, hashes, etc.).  
- **Não** move dinheiro fiat.  
- **Não** substitui KYC do banco ou do provedor de rampa.

Um fluxo de produto coerente seria:

1. **Off-chain / rampa:** utilizador converte ou deposita via **Etherfuse** (ou anchor) para obter **USDC/XLM/stable** na Stellar.  
2. **On-chain:** utilizador (ou agente com autorização) chama `issue` no **registry** para ancorar a duplicata ao estado on-chain.  
3. **Indexador:** correlaciona eventos `DuplicataIssued` com IDs de ordem Etherfuse na vossa BD (opcional mas poderoso para auditoria).

---

## 5. Riscos e decisões em aberto

1. **Jurisdição e licenciamento** — rampas envolvem compliance; validar com Etherfuse e assessoria jurídica.  
2. **Testnet vs mainnet** — contrato Dupply pode estar em testnet enquanto Etherfuse sandbox valida fluxos; alinhar **rede Stellar** da ordem com a **rede do ativo** suportado.  
3. **Conta Soroban vs clássica** — se o utilizador for só `C...` (contract), rever SEP-45 / limitações de carteiras com SEP-24 clássico.  
4. **Vendor lock-in** — abstrair `RailsProvider` no código com interface estável.

---

## Referências (links)

1. Stellar press — Etherfuse joins network (2025) — https://stellar.org/press/etherfuse-to-join-stellar-network-in-2025-ceo-david-taylor-announces-at-the-stellar-meridian-conference-in-london  
2. Etherfuse docs (overview) — https://docs.etherfuse.com/  
3. Stellar developers (anchors / SEP-24) — https://developers.stellar.org/docs/build/apps/wallet/sep24  
