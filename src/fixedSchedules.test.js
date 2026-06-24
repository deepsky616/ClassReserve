import assert from "node:assert/strict";
import test from "node:test";
import {
  findFixedScheduleRangeConflict,
  formatFixedScheduleConflictMessage,
  getWeekdayFromDateKey
} from "./fixedSchedules.js";

const fixedSchedule = {
  id: "fixed-1",
  weekday: 1,
  period: 2,
  room: "음악실",
  label: "3학년 음악"
};

test("날짜에서 월요일부터 금요일까지의 요일 번호를 구한다", () => {
  assert.equal(getWeekdayFromDateKey("2026-06-22"), 1);
  assert.equal(getWeekdayFromDateKey("2026-06-26"), 5);
});

test("예약 범위 안에 고정 사용이 있으면 충돌로 찾는다", () => {
  const conflict = findFixedScheduleRangeConflict([fixedSchedule], {
    date: "2026-06-22",
    startPeriod: 1,
    endPeriod: 3,
    room: "음악실"
  });

  assert.equal(conflict, fixedSchedule);
});

test("요일이나 특별실이 다르면 고정 사용 충돌이 아니다", () => {
  assert.equal(findFixedScheduleRangeConflict([fixedSchedule], {
    date: "2026-06-23",
    startPeriod: 1,
    endPeriod: 3,
    room: "음악실"
  }), null);

  assert.equal(findFixedScheduleRangeConflict([fixedSchedule], {
    date: "2026-06-22",
    startPeriod: 1,
    endPeriod: 3,
    room: "컴퓨터실"
  }), null);
});

test("고정 사용 충돌 메시지를 만든다", () => {
  assert.equal(
    formatFixedScheduleConflictMessage(fixedSchedule),
    "매주 월요일 2교시는 음악실 고정 사용 시간(3학년 음악)이라 예약할 수 없습니다."
  );
});
