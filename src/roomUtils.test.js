import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomName } from "./roomUtils.js";

test("이전 특별실 이름을 새 층수 이름으로 정규화한다", () => {
  assert.equal(normalizeRoomName("음악실"), "음악실(2층)");
  assert.equal(normalizeRoomName("다모임실"), "다모임실(2층)");
  assert.equal(normalizeRoomName("AI실"), "AI캠퍼스(2층)");
  assert.equal(normalizeRoomName("AI실(2층)"), "AI캠퍼스(2층)");
  assert.equal(normalizeRoomName("체육관"), "체육관(3층)");
});
