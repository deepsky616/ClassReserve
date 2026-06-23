import assert from "node:assert/strict";
import test from "node:test";
import { GRADES, ROOMS } from "./constants.js";

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

test("예약 대상에는 유치원과 초등학교 학년이 포함된다", () => {
  assert.deepEqual(GRADES, ["유치원", 1, 2, 3, 4, 5, 6]);
});
