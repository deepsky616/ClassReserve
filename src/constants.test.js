import assert from "node:assert/strict";
import test from "node:test";
import { CLASS_OPTIONS_BY_GRADE, GRADES, ROOM_TONE_CLASSES, ROOMS } from "./constants.js";

test("특별실 목록은 최신 학교 목록과 일치한다", () => {
  assert.deepEqual(ROOMS, [
    "창의놀이실",
    "신체활동실",
    "AI캠퍼스",
    "음악실",
    "다모임실",
    "체육관",
    "컴퓨터실"
  ]);
});

test("예약 대상에는 유치원과 초등학교 학년이 포함된다", () => {
  assert.deepEqual(GRADES, ["유치원", 1, 2, 3, 4, 5, 6]);
});

test("초등학교 학년별 반 수를 학교 설정에 맞춘다", () => {
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE["유치원"], []);
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE[1], [1, 2, 3, 4, 5]);
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE[2], [1, 2, 3, 4, 5]);
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE[3], [1, 2, 3, 4, 5]);
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE[4], [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE[5], [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(CLASS_OPTIONS_BY_GRADE[6], [1, 2, 3, 4, 5, 6]);
});

test("특별실별 색상 이름을 모두 가진다", () => {
  assert.deepEqual(Object.keys(ROOM_TONE_CLASSES), ROOMS);
});
