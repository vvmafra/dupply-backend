# Technical deep dive: SEP-10, SEP-24, and integration points (Dupply)

**Date:** 2026-05-16  
**Audience:** engineers implementing a **SEP-24**-style `RailsProvider` or auditing wallet integrations.  
**Sources:** [Stellar Developers — Wallet SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24), [SEP-24 integration (Anchor Platform)](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration), [SEP-24 getting started](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started).

---

## 1. Why SEP-10 comes before SEP-24

The anchor needs cryptographic proof that the client controls the indicated Stellar account before exposing authenticated endpoints or interactive URLs with sensitive data (IBAN, limits, etc.).

Typical flow (summary):

1. Client requests a **challenge** from the anchor server (`GET .../auth` with SEP-10 parameters).  
2. Server returns a **transaction** to sign (usually no payment, only metadata / `manage_data`).  
3. Client signs with **secret key** or via hardware wallet / MPC.  
4. Client submits the signed transaction; anchor returns a **JWT** (short-lived).  
5. Client uses the JWT in headers for subsequent **SEP-24** calls.

**Dupply implication:** if your backend acts as “wallet” on behalf of the user, it **cannot** sign SEP-10 without the user trusting the backend with the key — the more common model is the **frontend** signs and passes only the JWT to the backend, or the backend is a **proxy** with log redaction.

---

## 2. SEP-24: deposit vs withdrawal

### 2.1 Withdrawal (off-ramp crypto → fiat)

Summary aligned with Stellar docs:

1. Pick asset and anchor (via `stellar.toml` / directory).  
2. Get withdraw info (`GET /withdraw`).  
3. Authenticate (SEP-10).  
4. Submit request (`POST /transactions/withdraw`).  
5. Anchor returns interactive URL; user completes KYC/IBAN.  
6. Wallet sends on-chain funds to the account indicated by the anchor.  
7. Anchor initiates bank transfer.

### 2.2 Deposit (on-ramp fiat → crypto)

Mirrored flow: anchor gives bank-deposit or supported-method instructions; after reconciliation, credits Stellar asset to the user’s account.

### 2.3 States and polling

Integration docs describe the SEP-24 transaction **state machine** and JSON-RPC events for operators running **Anchor Platform**. As a **client**, the Dupply backend should:

- persist the anchor transaction `id`;  
- **poll** with *backoff* respecting `Rate-Limits`;  
- handle terminal states (`completed`, `refunded`, `expired`, etc. — exact names in SEP-24 spec).

---

## 3. SEP-38 (quotes) in the same flow

When the user wants to **swap** non 1:1 assets (e.g. XLM → USDC) inside the ramp flow, the anchor may require a **SEP-38** quote. The Dupply backend should model:

- `quote_id`  
- `expires_at`  
- spread / fees returned by the anchor  

This parallels **Etherfuse Quotes** mentally, but with **different fields and endpoints** — hence the value of a `RailsProvider` abstraction.

---

## 4. SEP-45 and contract accounts (Soroban)

Recent SEP-24 flow documentation mentions **SEP-45** for authentication when the account is a **contract account**. This matters because:

- The trade-bill registry is **Soroban**; end users may interact via **`C...` smart wallets**.  
- Not all anchors / wallets support the same maturity for **contract signers**.

**Action:** before committing to “Soroban-only” UX, validate with 1–2 target anchors whether SEP-24 + SEP-45 is operational for your use case.

---

## 5. `stellar.toml` — fields integrators usually read

Without enumerating the full spec (it evolves), a typical integrator looks for:

- `SIGNING_KEY` / trust keys  
- `WEB_AUTH_ENDPOINT`, `TRANSFER_SERVER_SEP0024` URLs  
- currency list with `code` and `issuer`  

Tools: parsers in SDKs; always validate **HTTPS** and **domain** to reduce phishing.

---

## 6. Operational comparison: SEP-24 client vs Etherfuse client

### Estimated effort (order of magnitude, small team)

| Task | SEP-24 client | Etherfuse REST |
|------|---------------|----------------|
| Auth | SEP-10 + JWT handling | API key + JWT flow per Etherfuse docs |
| Discovery | stellar.toml + validation | Static config |
| States | Polling + spec mapping | Polling + webhooks |
| Tests | Per-anchor sandbox | Etherfuse sandbox |
| Maintenance | Multiple anchors = multiple quirks | Single vendor |

### When to prefer SEP-24 in v1

- Explicit requirement to support **multiple** directory anchors.  
- Generic **wallet**-style product.

### When to prefer Etherfuse in v1

- One currency pair / corridor already covered by the API.  
- MVP speed and single documentation set.

---

## 7. Security and compliance (minimum checklist)

- [ ] Never log full JWTs or secrets.  
- [ ] Mandatory TLS; optional *pinning* for critical APIs.  
- [ ] Validate that URLs returned by the anchor belong to the **expected domain** (`stellar.toml`).  
- [ ] Data retention policy (LGPD / GDPR) if the backend stores copies of banking payloads.  
- [ ] Rotate Etherfuse API keys and webhooks.

---

## 8. Link to Dupply indexer

The indexer can write to `chain_events` with:

- `contract` = `DUPPLY_REGISTRY_CONTRACT_ID`  
- `topic` = normalized Soroban event name  
- `tx_hash`, `ledger`, `body_json`

The ramp service correlates by:

- `user_id` + time window **or**  
- custom field in Stellar transaction `memo` (if you adopt a memo referencing `ramp_order_id`).

---

## References

1. https://developers.stellar.org/docs/build/apps/wallet/sep24  
2. https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration  
3. https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started  
4. https://anchors.stellar.org/  
