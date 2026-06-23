import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSelectedReservationSummary,
  getSelectedReservations,
  validateSameDateSelection
} from "./selectionDelete.js";

const reservations = [
  {
    id: "reservation-1",
    date: "2026-06-24",
    period: 1,
    room: "창의놀이실(1층)",
    grade: 1,
    classNumber: 1
  },
  {
    id: "reservation-2",
    date: "2026-06-24",
    period: 2,
    room: "창의놀이실(1층)",
    grade: 1,
    classNumber: 1
  },
  {
    id: "reservation-3",
    date: "2026-06-25",
    period: 1,
    room: "음악실",
    grade: "유치원",
    classNumber: null
  }
];

test("선택한 아이디에 해당하는 예약을 교시 순서로 찾는다", () => {
  const selected = getSelectedReservations(reservations, new Set(["reservation-2", "reservation-1"]));

  assert.deepEqual(selected.map((reservation) => reservation.id), ["reservation-1", "reservation-2"]);
});

test("같은 날짜 예약 선택은 통과한다", () => {
  assert.doesNotThrow(() => {
    validateSameDateSelection(reservations.slice(0, 2));
  });
});

test("다른 날짜 예약이 섞이면 검증 오류를 낸다", () => {
  assert.throws(
    () => validateSameDateSelection(reservations),
    {
      code: "VALIDATION_ERROR",
      message: "같은 날짜의 예약만 함께 삭제할 수 있습니다."
    }
  );
});

test("선택 삭제 확인 문구를 만든다", () => {
  const summary = formatSelectedReservationSummary(reservations.slice(0, 2));

  assert.equal(summary, "2026-06-24 창의놀이실(1층) 1교시, 2교시 2건");
});
