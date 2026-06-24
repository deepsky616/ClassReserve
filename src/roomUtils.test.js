import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_GROUPS, normalizeRoomName } from "./roomUtils.js";

test("이전 특별실 이름을 새 층수 이름으로 정규화한다", () => {
  assert.equal(normalizeRoomName("음악실"), "음악실(2층)");
  assert.equal(normalizeRoomName("다모임실"), "다모임실(2층)");
  assert.equal(normalizeRoomName("AI실"), "AI캠퍼스(2층)");
  assert.equal(normalizeRoomName("AI실(2층)"), "AI캠퍼스(2층)");
  assert.equal(normalizeRoomName("체육관"), "체육관(3층)");
});

test("특별실을 층수 오름차순 묶음으로 제공한다", () => {
  assert.deepEqual(ROOM_GROUPS, [
    {
      label: "1층",
      rooms: ["창의놀이실(1층)", "신체활동실(1층)"]
    },
    {
      label: "2층",
      rooms: ["AI캠퍼스(2층)", "음악실(2층)", "다모임실(2층)"]
    },
    {
      label: "3층",
      rooms: ["체육관(3층)"]
    },
    {
      label: "4층",
      rooms: ["컴퓨터실(4층)"]
    },
    {
      label: "기타",
      rooms: ["청계누리(강당)"]
    }
  ]);
});
