import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSelectedFixedScheduleSummary,
  getSelectedFixedSchedules
} from "./fixedScheduleSelection.js";

const fixedSchedules = [
  {
    id: "fixed-1",
    weekday: 1,
    period: 2,
    room: "음악실",
    label: "3학년 음악"
  },
  {
    id: "fixed-2",
    weekday: 1,
    period: 3,
    room: "음악실",
    label: "3학년 음악"
  },
  {
    id: "fixed-3",
    weekday: 3,
    period: 4,
    room: "체육관",
    label: "5학년 체육"
  }
];

test("선택한 아이디에 해당하는 고정 사용을 요일과 교시 순서로 찾는다", () => {
  const selected = getSelectedFixedSchedules(fixedSchedules, new Set(["fixed-2", "fixed-1"]));

  assert.deepEqual(selected.map((fixedSchedule) => fixedSchedule.id), ["fixed-1", "fixed-2"]);
});

test("선택 고정 사용 삭제 확인 문구를 만든다", () => {
  const summary = formatSelectedFixedScheduleSummary(fixedSchedules.slice(0, 2));

  assert.equal(summary, "월요일 음악실 2교시, 3교시 고정 사용 2건");
});
