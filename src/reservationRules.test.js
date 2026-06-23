import assert from "node:assert/strict";
import test from "node:test";
import {
  getClassOptionsForGrade,
  getMaxReservationDateKey,
  getReservationDateRange,
  isDateInReservationWindow
} from "./reservationRules.js";

test("선택한 학년에 맞는 반 목록을 반환한다", () => {
  assert.deepEqual(getClassOptionsForGrade(1), [1, 2, 3, 4, 5]);
  assert.deepEqual(getClassOptionsForGrade(4), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getClassOptionsForGrade(6), [1, 2, 3, 4, 5, 6]);
});

test("유치원은 기존 반 범위를 유지한다", () => {
  assert.deepEqual(getClassOptionsForGrade("유치원"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("예약 가능 날짜는 오늘부터 8주 뒤까지다", () => {
  const baseDate = new Date("2026-06-10T09:00:00.000Z");

  assert.equal(getMaxReservationDateKey(baseDate), "2026-08-05");
  assert.equal(isDateInReservationWindow("2026-06-10", baseDate), true);
  assert.equal(isDateInReservationWindow("2026-08-05", baseDate), true);
  assert.equal(isDateInReservationWindow("2026-06-09", baseDate), false);
  assert.equal(isDateInReservationWindow("2026-08-06", baseDate), false);
});

test("예약 날짜 입력 범위를 반환한다", () => {
  assert.deepEqual(getReservationDateRange(new Date("2026-06-10T09:00:00.000Z")), {
    min: "2026-06-10",
    max: "2026-08-05"
  });
});
