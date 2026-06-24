import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_GROUPS, isAllowedRoom, normalizeRoomName } from "./roomUtils.js";

test("이전 층수 특별실 이름을 층수 없는 이름으로 정규화한다", () => {
  assert.equal(normalizeRoomName("창의놀이실(1층)"), "창의놀이실");
  assert.equal(normalizeRoomName("신체활동실(1층)"), "신체활동실");
  assert.equal(normalizeRoomName("AI캠퍼스(2층)"), "AI캠퍼스");
  assert.equal(normalizeRoomName("AI실"), "AI캠퍼스");
  assert.equal(normalizeRoomName("AI실(2층)"), "AI캠퍼스");
  assert.equal(normalizeRoomName("음악실(2층)"), "음악실(2층)");
  assert.equal(normalizeRoomName("다모임실(2층)"), "다모임실");
  assert.equal(normalizeRoomName("체육관"), "청계누리(강당)");
  assert.equal(normalizeRoomName("체육관(3층)"), "청계누리(강당)");
  assert.equal(normalizeRoomName("청계누리(강당)"), "청계누리(강당)");
  assert.equal(normalizeRoomName("컴퓨터실(4층)"), "컴퓨터실");
  assert.equal(normalizeRoomName("음악실(5층)"), "음악실");
});

test("특별실을 층수 오름차순 묶음으로 제공한다", () => {
  assert.deepEqual(ROOM_GROUPS, [
    {
      label: "1층",
      rooms: ["창의놀이실", "신체활동실"]
    },
    {
      label: "2층",
      rooms: ["AI캠퍼스", "음악실(2층)", "다모임실"]
    },
    {
      label: "3층",
      rooms: ["청계누리(강당)", "동아리1", "동아리2"]
    },
    {
      label: "4층",
      rooms: ["컴퓨터실"]
    },
    {
      label: "5층",
      rooms: ["다목적실", "음악실"]
    }
  ]);
});

test("청계누리와 새 특별실은 예약 가능한 특별실로 취급한다", () => {
  assert.equal(isAllowedRoom("청계누리(강당)"), true);
  assert.equal(isAllowedRoom("체육관"), true);
  assert.equal(isAllowedRoom("음악실(2층)"), true);
  assert.equal(isAllowedRoom("동아리1"), true);
  assert.equal(isAllowedRoom("동아리2"), true);
  assert.equal(isAllowedRoom("다목적실"), true);
});
