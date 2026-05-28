import assert from "node:assert/strict";
import test from "node:test";

import { prepareReceivableMetaDataForWrite } from "../../../src/application/receivable/receivableHelpers.js";

test("prepareReceivableMetaDataForWrite returns uppercase bill number and matching materialized key", () => {
  const { receivableMetaData, materializedKeys } = prepareReceivableMetaDataForWrite({
    billNumber: " abc-1 ",
    fiscalDocumentType: "nfe",
    fiscalDocumentKey: "12.34-56",
  });
  assert.match(receivableMetaData, /"billNumber":"ABC-1"/);
  assert.equal(materializedKeys.normalizedBillNumber, "ABC-1");
  assert.equal(materializedKeys.normalizedFiscalDocumentKey, "123456");
});

test("prepareReceivableMetaDataForWrite yields null keys for incomplete metadata", () => {
  const { materializedKeys } = prepareReceivableMetaDataForWrite({ type: "commercial" });
  assert.equal(materializedKeys.normalizedBillNumber, null);
  assert.equal(materializedKeys.normalizedFiscalDocumentKey, null);
});
