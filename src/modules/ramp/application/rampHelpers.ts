import type { RampAssetRow, RampQuoteAssets } from "../../../infra/gateways/ports/rampGateway.js";

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function nowMs(): string {
  return String(Date.now());
}

/** Aligns with Regional Starter Pack: use fiat side (no colon) as GET /ramp/assets `currency` hint. */
export function resolveQuoteAssetsFromMap(
  qa: RampQuoteAssets,
  assets: RampAssetRow[],
): RampQuoteAssets {
  if (qa.type === "swap") return qa;
  const source = qa.sourceAsset;
  const target = qa.targetAsset;
  if (source.includes(":") && target.includes(":")) return qa;
  const map = new Map(assets.map((a) => [a.symbol, a.identifier]));
  return {
    ...qa,
    sourceAsset: map.get(source) ?? source,
    targetAsset: map.get(target) ?? target,
  };
}

/** Fiat currency hint used when resolving plain symbols via GET /ramp/assets. */
export function fiatHintForQuoteAssets(qa: RampQuoteAssets): string {
  if (qa.type === "swap") return "MXN";
  const source = qa.sourceAsset;
  const target = qa.targetAsset;
  if (qa.type === "onramp") {
    if (!source.includes(":")) return source;
    if (!target.includes(":")) return target;
    return "MXN";
  }
  if (!target.includes(":")) return target;
  if (!source.includes(":")) return source;
  return "MXN";
}

/** Normalized deposit instructions for on-ramp orders (SPEI Mexico vs PIX Brazil). */
export function extractOnRampDepositInstructions(orderBody: unknown): unknown {
  if (!orderBody || typeof orderBody !== "object") return null;
  const root = orderBody as Record<string, unknown>;
  const on = root.onramp;
  if (!on || typeof on !== "object") return null;
  const r = on as Record<string, unknown>;
  const amount = typeof r.depositAmount === "string" ? r.depositAmount : "";
  if (typeof r.depositClabe === "string") {
    return {
      type: "spei" as const,
      clabe: r.depositClabe,
      bankName: r.bankName,
      beneficiary: r.beneficiary,
      amount,
    };
  }
  if (typeof r.depositPixCode === "string" || typeof r.depositPixKey === "string") {
    return {
      type: "pix" as const,
      pixCode:
        typeof r.depositPixCode === "string"
          ? r.depositPixCode
          : typeof r.depositPixKey === "string"
            ? r.depositPixKey
            : "",
      pixKey: typeof r.depositPixKey === "string" ? r.depositPixKey : undefined,
      pixKeyType: typeof r.depositPixKeyType === "string" ? r.depositPixKeyType : undefined,
      beneficiary: typeof r.beneficiary === "string" ? r.beneficiary : undefined,
      amount,
    };
  }
  return null;
}
