# Referência técnica aprofundada: SEP-10, SEP-24 e pontos de integração (Dupply)

**Data:** 2026-05-16  
**Público:** engenheiros que vão implementar `RailsProvider` tipo **SEP-24** ou auditar integrações com carteiras.  
**Fontes:** [Stellar Developers — Wallet SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24), [SEP-24 integration (Anchor Platform)](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration), [SEP-24 getting started](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started).

---

## 1. Por que SEP-10 precede SEP-24

O anchor precisa de prova criptográfica de que o cliente controla a conta Stellar indicada, antes de expor endpoints autenticados ou URLs interativas com dados sensíveis (IBAN, limites, etc.).

Fluxo típico (resumo):

1. Cliente pede **challenge** ao servidor do anchor (`GET .../auth` com parâmetros definidos no SEP-10).  
2. Servidor devolve **transaction** a assinar (geralmente sem pagamento, só metadados / `manage_data`).  
3. Cliente assina com a **secret key** ou via hardware wallet / MPC.  
4. Cliente envia a transação assinada; anchor devolve **JWT** (curta duração).  
5. Cliente usa o JWT nos headers das chamadas **SEP-24** subsequentes.

**Implicação Dupply:** se o vosso backend for “carteira” em nome do utilizador, **não** pode assinar SEP-10 sem o utilizador confiar ao backend a chave — modelo mais comum é o **frontend** assinar e passar só o JWT ao backend, ou o backend ser apenas **proxy** com redação de logs.

---

## 2. SEP-24: depósito vs levantamento

### 2.1 Withdrawal (off-ramp cripto → fiat)

Resumo alinhado à doc Stellar:

1. Escolher ativo e anchor (via `stellar.toml` / diretório).  
2. Obter informação de withdraw (`GET /withdraw`).  
3. Autenticar (SEP-10).  
4. Submeter pedido (`POST /transactions/withdraw`).  
5. Anchor devolve URL interativa; utilizador completa KYC/IBAN.  
6. Carteira envia fundos on-chain para a conta indicada pelo anchor.  
7. Anchor inicia transferência bancária.

### 2.2 Deposit (on-ramp fiat → cripto)

Fluxo espelhado: o anchor indica instruções de depósito bancário ou método suportado; após reconciliação, credita ativo Stellar na conta do utilizador.

### 2.3 Estados e polling

A doc de integração descreve **máquina de estados** da transação SEP-24 e eventos JSON-RPC para quem corre **Anchor Platform**. Como **cliente**, o Dupply backend deve:

- persistir `id` da transação no anchor;  
- fazer **polling** com *backoff* respeitando `Rate-Limits`;  
- tratar estados terminais (`completed`, `refunded`, `expired`, etc. — nomes exactos na spec SEP-24).

---

## 3. SEP-38 (quotes) no mesmo fluxo

Quando o utilizador quer **trocar** ativos não 1:1 (ex.: XLM → USDC) dentro do fluxo de rampa, o anchor pode exigir **quote** SEP-38. O backend Dupply deve modelar:

- `quote_id`  
- `expires_at`  
- spread / fees devolvidos pelo anchor  

Isto paraleliza mentalmente com **Etherfuse Quotes**, mas com **campos e endpoints diferentes** — daí a utilidade da abstração `RailsProvider`.

---

## 4. SEP-45 e contas contrato (Soroban)

A documentação recente do fluxo SEP-24 menciona **SEP-45** para autenticação quando a conta é **contract account**. Isto é relevante porque:

- O `duplicata-registry` é **Soroban**; os utilizadores finais podem interagir via **smart wallet** `C...`.  
- Nem todos os anchors / carteiras suportam o mesmo nível de maturidade para **contract signers**.

**Ação:** antes de comprometer UX “só Soroban”, validar com 1–2 anchors alvo se o fluxo SEP-24 + SEP-45 está operacional para o vosso caso de uso.

---

## 5. `stellar.toml` — campos que o integrador costuma ler

Sem enumerar a spec completa (evolui), o integrador típico procura:

- `SIGNING_KEY` / chaves de confiança  
- URLs de `WEB_AUTH_ENDPOINT`, `TRANSFER_SERVER_SEP0024`  
- Lista de moedas com `code` e `issuer`  

Ferramentas: parsers existentes em SDKs; validar sempre **HTTPS** e **domínio** para evitar phishing.

---

## 6. Comparação operacional: implementar cliente SEP-24 vs cliente Etherfuse

### Esforço estimado (ordem de grandeza, equipe pequena)

| Tarefa | SEP-24 cliente | Etherfuse REST |
|--------|----------------|------------------|
| Auth | SEP-10 + gestão JWT | API key + fluxo JWT doc Etherfuse |
| Descoberta | stellar.toml + validação | Config estática |
| Estados | Polling + mapeamento spec | Polling + webhooks |
| Testes | Sandbox por anchor | Sandbox Etherfuse |
| Manutenção | Múltiplos anchors = múltiplos quirks | Um vendor |

### Quando preferir SEP-24 na v1

- Requisito explícito de suportar **vários** anchors do diretório.  
- Produto estilo **carteira** genérica.  

### Quando preferir Etherfuse na v1

- Um par de moedas / corredor já coberto pela API.  
- Velocidade de MVP e documentação única.

---

## 7. Segurança e compliance (checklist mínima)

- [ ] Nunca logar JWT completos ou secrets.  
- [ ] TLS obrigatório; *pinning* opcional para APIs críticas.  
- [ ] Validar que URLs devolvidas pelo anchor pertencem ao **mesmo domínio** esperado (`stellar.toml`).  
- [ ] Política de retenção de dados bancários (LGPD / GDPR) se o backend armazenar cópias de payloads.  
- [ ] Rotação de API keys Etherfuse e webhooks.

---

## 8. Ligação ao indexador Dupply

O indexador pode escrever na tabela `chain_events` com:

- `contract` = `DUPPLY_REGISTRY_CONTRACT_ID`  
- `topic` = nome do evento Soroban normalizado  
- `tx_hash`, `ledger`, `body_json`

O serviço de rampa correlaciona por:

- `user_id` + janela temporal **ou**  
- campo custom em `memo` da transação Stellar (se adoptarem memo referenciando `ramp_order_id`).

---

## Referências

1. https://developers.stellar.org/docs/build/apps/wallet/sep24  
2. https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration  
3. https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started  
4. https://anchors.stellar.org/  
