import assert from "node:assert/strict";
import test from "node:test";
import { ROOMS } from "./constants.js";

test("특별실 목록은 최신 학교 목록과 일치한다", () => {
  assert.deepEqual(ROOMS, [
    "창의놀이실",
    "청계누리(강당)",
    "컴퓨터실(4층)",
    "AI실(2층)",
    "음악실",
    "다모임실"
  ]);
});
