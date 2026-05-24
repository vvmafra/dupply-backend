import assert from "node:assert/strict";
import test from "node:test";

import { toCents, toReais } from "../../src/shared/money.js";

test("toCents converts reais to integer cents", () => {
  assert.equal(toCents(150000.0), 15000000);
  assert.equal(toCents(99.99), 9999);
  assert.equal(toCents(0.01), 1);
});

test("toCents handles zero", () => {
  assert.equal(toCents(0), 0);
});

test("toCents rounds floating-point imprecision", () => {
  assert.equal(toCents(1.005), 100);
  assert.equal(toCents(10.005), 1001);
});

test("toReais converts cents to reais", () => {
  assert.equal(toReais(15000000), 150000);
  assert.equal(toReais(9999), 99.99);
  assert.equal(toReais(1), 0.01);
});

test("toReais handles zero", () => {
  assert.equal(toReais(0), 0);
});

test("toReais round-trips with toCents for whole-cent values", () => {
  assert.equal(toReais(toCents(1234.56)), 1234.56);
});

test("toCents handles large values", () => {
  assert.equal(toCents(999999999.99), 99999999999);
});
