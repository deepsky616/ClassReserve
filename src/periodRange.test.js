import assert from "node:assert/strict";
import test from "node:test";
import { getPeriodRange, getPeriodRangeLabel } from "./periodRange.js";

test("시작 교시부터 끝 교시까지 포함한 범위를 만든다", () => {
  assert.deepEqual(getPeriodRange(1, 3), [1, 2, 3]);
});

test("시작 교시와 끝 교시가 같으면 한 교시 범위를 만든다", () => {
  assert.deepEqual(getPeriodRange("4", "4"), [4]);
});

test("끝 교시가 시작 교시보다 앞이면 검증 오류를 낸다", () => {
  assert.throws(
    () => getPeriodRange(4, 2),
    {
      code: "VALIDATION_ERROR",
      message: "끝 교시는 시작 교시보다 빠를 수 없습니다."
    }
  );
});

test("교시 범위 표시 문구를 만든다", () => {
  assert.equal(getPeriodRangeLabel([1, 2, 3]), "1교시~3교시");
  assert.equal(getPeriodRangeLabel([2]), "2교시");
});
