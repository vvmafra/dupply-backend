import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReceivableMetaDataComplete,
  parseReceivableMetaData,
} from "../../../src/domain/receivable/metadata.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import { completeReceivableMetaData } from "../../helpers/receivableTestHelpers.js";

test("complete metadata passes validation", () => {
  const meta = assertReceivableMetaDataComplete(JSON.stringify(completeReceivableMetaData));
  assert.equal(meta.billNumber, "BILL-001");
});

test("missing dueDate throws INCOMPLETE_METADATA", () => {
  const incomplete = { ...completeReceivableMetaData, dueDate: "" };
  assert.throws(
    () => assertReceivableMetaDataComplete(JSON.stringify(incomplete)),
    (e: unknown) => {
      assert.ok(e instanceof ReceivableError);
      assert.equal(e.code, RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
      return true;
    },
  );
});

test("antifraudDeclarationsAccepted false throws INCOMPLETE_METADATA", () => {
  const incomplete = { ...completeReceivableMetaData, antifraudDeclarationsAccepted: false };
  assert.throws(
    () => assertReceivableMetaDataComplete(JSON.stringify(incomplete)),
    ReceivableError,
  );
});

test("parseReceivableMetaData returns null for empty input", () => {
  assert.equal(parseReceivableMetaData(null), null);
});
