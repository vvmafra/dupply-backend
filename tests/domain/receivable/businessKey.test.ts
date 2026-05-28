import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveMaterializedBusinessKeys,
  isDuplicateBlockingStatus,
  normalizeBillNumber,
  normalizeFiscalDocumentKey,
  normalizeReceivableMetaDataForStorage,
} from "../../../src/domain/receivable/businessKey.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";

test("normalizeBillNumber trims and uppercases", () => {
  assert.equal(normalizeBillNumber(" dup-001 "), "DUP-001");
});

test("normalizeFiscalDocumentKey strips non-digits for nfe", () => {
  const raw = "3521.2345.6789-0123456789012345678901234567890123456789012345-55";
  const normalized = normalizeFiscalDocumentKey(raw, "nfe");
  assert.equal(normalized, "352123456789012345678901234567890123456789012345678901234555");
  assert.match(normalized, /^\d+$/);
});

test("normalizeFiscalDocumentKey preserves alphanumeric for other type", () => {
  assert.equal(normalizeFiscalDocumentKey(" DOC-99/x ", "other"), "DOC-99/x");
});

test("deriveMaterializedBusinessKeys returns null for empty billNumber", () => {
  assert.deepEqual(deriveMaterializedBusinessKeys({ billNumber: "" }), {
    normalizedBillNumber: null,
    normalizedFiscalDocumentKey: null,
  });
});

test("deriveMaterializedBusinessKeys returns null for missing metadata", () => {
  assert.deepEqual(deriveMaterializedBusinessKeys(null), {
    normalizedBillNumber: null,
    normalizedFiscalDocumentKey: null,
  });
});

test("deriveMaterializedBusinessKeys derives both keys when present", () => {
  const keys = deriveMaterializedBusinessKeys({
    billNumber: " abc-1 ",
    fiscalDocumentKey: "123-456",
    fiscalDocumentType: "nfe",
  });
  assert.equal(keys.normalizedBillNumber, "ABC-1");
  assert.equal(keys.normalizedFiscalDocumentKey, "123456");
});

test("isDuplicateBlockingStatus true for under_review", () => {
  assert.equal(isDuplicateBlockingStatus(RECEIVABLE_STATUS.UNDER_REVIEW), true);
});

test("isDuplicateBlockingStatus false for reproved", () => {
  assert.equal(isDuplicateBlockingStatus(RECEIVABLE_STATUS.REPROVED), false);
});

test("isDuplicateBlockingStatus true for completed", () => {
  assert.equal(isDuplicateBlockingStatus(RECEIVABLE_STATUS.COMPLETED), true);
});

test("normalizeReceivableMetaDataForStorage normalizes identifying fields", () => {
  const normalized = normalizeReceivableMetaDataForStorage({
    billNumber: " dup-001 ",
    fiscalDocumentKey: "12.34-56",
    fiscalDocumentType: "nfe",
    payerCnpj: "12.345.678/0001-90",
  });
  assert.equal(normalized.billNumber, "DUP-001");
  assert.equal(normalized.fiscalDocumentKey, "123456");
  assert.equal(normalized.payerCnpj, "12345678000190");
});
