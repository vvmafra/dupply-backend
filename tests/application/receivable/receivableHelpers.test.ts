import assert from "node:assert/strict";
import test from "node:test";

import {
  mapReceivableMetaDataForApi,
  metaApiToStored,
  metaStoredToApi,
  valueDbCentsTextToReais,
  valueReaisToDbCentsText,
} from "../../../src/application/receivable/receivableHelpers.js";
import type { ReceivableMetaData } from "../../../src/domain/receivable/types.js";

test("valueReaisToDbCentsText and valueDbCentsTextToReais round-trip", () => {
  assert.equal(valueReaisToDbCentsText(500), "50000");
  assert.equal(valueDbCentsTextToReais("50000"), 500);
  assert.equal(valueReaisToDbCentsText(), "0");
});

test("metaApiToStored and metaStoredToApi convert desiredAnticipationValue", () => {
  const api: Partial<ReceivableMetaData> = { desiredAnticipationValue: 500 };
  const stored = metaApiToStored(api);
  assert.equal(stored.desiredAnticipationValue, 50000);
  const back = metaStoredToApi({ desiredAnticipationValue: 50000 } as ReceivableMetaData);
  assert.equal(back.desiredAnticipationValue, 500);
});

test("mapReceivableMetaDataForApi rewrites JSON to reais", () => {
  const raw = JSON.stringify({ desiredAnticipationValue: 50000, type: "commercial" });
  const mapped = mapReceivableMetaDataForApi(raw);
  const parsed = JSON.parse(mapped!) as { desiredAnticipationValue: number };
  assert.equal(parsed.desiredAnticipationValue, 500);
});
