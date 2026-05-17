# Pesquisa: âncoras Stellar, SEPs e “Anchor Platform” (contexto para o backend v1)

**Data:** 2026-05-16  
**Objetivo:** clarificar o que a documentação Stellar chama de **anchor**, quais **SEPs** importam para rampas fiat↔cripto, e como isso se relaciona (e se **diferencia**) de integrações tipo **Etherfuse FX API**.  
**Fontes oficiais (prioridade):** [Stellar Developers](https://developers.stellar.org/docs), [Anchor Platform / SEP-24](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started), [Wallet SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24), [Anchor Directory](https://anchors.stellar.org/).

---

## 1. Glossário Stellar: o que é um “anchor”

No ecossistema Stellar, **anchor** (âncora) é, em termos simples, uma entidade que **emite ativos** na rede e/ou opera **on/off-ramps** (depósito e levantamento entre mundo bancário/fiat e a ledger), normalmente de forma **padronizada** por **Stellar Ecosystem Proposals (SEPs)**.

Não confundir com:

- **Anchor** no sentido de *framework* ML (outro domínio).
- **“Integrar uma Anchor”** no produto Dupply: pode significar (a) consumir um **provedor de rampa** com API própria (ex.: Etherfuse), ou (b) integrar um **anchor clássico SEP-10 + SEP-24** listado no diretório, ou (c) ambos, em fases distintas.

---

## 2. SEPs relevantes para rampas “hosted” (visão de integrador)

### SEP-24 — Hosted deposit and withdrawal

- Descreve fluxo em que o cliente interage com uma **URL** hospedada pelo anchor após autenticação.  
- Documentação: [Hosted Deposit and Withdrawal](https://developers.stellar.org/docs/build/apps/wallet/sep24), [SEP-24 getting started (Anchor Platform)](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started), [Integration guide](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration).

Fluxo simplificado (off-ramp, resumo conceitual):

1. Utilizador escolhe ativo e carteira encontra o anchor.  
2. Autenticação com o anchor (tipicamente **SEP-10**).  
3. Carteira abre URL interativa do anchor.  
4. Utilizador confirma dados; carteira envia ativo na Stellar para a conta de distribuição do anchor.  
5. Anchor processa transferência bancária (ou equivalente).

### SEP-10 — Web authentication

Usado para o anchor provar que o utilizador controla a conta Stellar antes de abrir sessão SEP-24. Ver secção de pré-requisitos em [getting started SEP-24](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started).

### SEP-1 — stellar.toml

Ficheiro de descoberta do anchor (domínio, moedas, URLs de autenticação, etc.). Pré-requisito típico para integrações “diretório + carteira”.

### SEP-38 (âmbito de câmbio)

Mencionado na documentação de integração para **quotes** quando há conversão entre ativos não equivalentes. Ver [integration](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration).

### SEP-45 (menção em docs atuais)

A doc de *getting started* referencia **SEP-45** no contexto de *Stellar Web Authentication for contract account* — relevante se o utilizador for **conta contrato (Soroban)** em vez de só conta clássica `G...`. Isto impacta o desenho Dupply se o “seller” operar via **smart wallet**.

---

## 3. Anchor Platform (Stellar)

É a stack de referência da SDF para operadores que querem **correr** um anchor com padrões SEP (eventos JSON-RPC, JWT, etc.). Para o Dupply como **aplicação** que *consome* rampas, o mais comum é:

- integrar como **cliente** SEP-24 / carteira / servidor que orquestra links; **ou**
- integrar **API de terceiros** (Etherfuse) que já agrega KYC, quotes e ordens.

Documentação: [Anchor Platform](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started).

---

## 4. Anchor Directory

Lista pública de âncoras e metadados: [https://anchors.stellar.org/](https://anchors.stellar.org/).  
Útil para: descobrir **quem** suporta **qual** ativo/país, e validar `stellar.toml` / endpoints.

---

## 5. Relação com Soroban e com o `duplicata-registry`

- O contrato **Soroban** atual regista **duplicatas** e **não** implementa rampa.  
- Uma **rampa** (fiat↔stable ou stable↔BRL na conta bancária) é, na prática, **off-chain + transações Stellar** coordenadas por um provedor.  
- O backend v1 pode:  
  - **Orquestrar** chamadas a um anchor (SEP-24 / API Etherfuse);  
  - **Persistir** estado de KYC/ordem **na BD**;  
  - **Submeter** transações Stellar assinadas pelo utilizador ou por relayer (conforme modelo legal e técnico).

---

## 6. Critérios de escolha: “anchor SEP-24” vs “API Etherfuse”

| Critério | Anchor clássico (SEP-24 + diretório) | Etherfuse FX API |
|----------|--------------------------------------|-------------------|
| Descoberta | `stellar.toml`, diretório | Conta org + docs Etherfuse |
| UX rampa | URL hosted SEP-24 | Hosted UI ou programático |
| Padronização | Alta (ecossistema Stellar) | API própria (REST) |
| Ativos / países | Por anchor | Definido pela Etherfuse (ver API) |
| Esforço v1 | Maior (fluxo SEP-10/24 completo) | Menor se API cobre o teu caso |

**Recomendação de documentação:** no v1, **escolher um caminho principal** (Etherfuse *ou* um anchor SEP-24 específico para BRL/USDC), documentar a decisão em ADR, e deixar a interface interna do backend como **“RailsProvider”** com duas implementações na fase 2 se necessário.

---

## 7. Próximos ficheiros nesta série

- `2026-05-16_etherfuse-stellar-fx-api.md` — detalhe do produto Etherfuse (imprensa + FX API).  
- `../notes/2026-05-16_dupply-backend-v1-plan.md` — plano de implementação v1 com integração de rampa.

---

## Referências (links)

1. Stellar Docs — Wallet: SEP-24 — https://developers.stellar.org/docs/build/apps/wallet/sep24  
2. Stellar Docs — Anchor Platform SEP-24 getting started — https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started  
3. Stellar Docs — SEP-24 integration — https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration  
4. Anchor Directory — https://anchors.stellar.org/
