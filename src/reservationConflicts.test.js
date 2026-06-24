import assert from "node:assert/strict";
import test from "node:test";
import {
  findReservationConflict,
  findReservationRangeConflict,
  formatReservationConflictMessage
} from "./reservationConflicts.js";

const existingReservation = {
  id: "reservation-1",
  date: "2026-06-19",
  period: 2,
  room: "창의놀이실",
  grade: 3,
  classNumber: 4
};

test("날짜와 교시와 특별실이 같으면 기존 예약을 찾는다", () => {
  const conflict = findReservationConflict([existingReservation], {
    date: "2026-06-19",
    period: "2",
    room: "창의놀이실",
    grade: 5,
    classNumber: 1
  });

  assert.equal(conflict, existingReservation);
});

test("특별실이 다르면 중복 예약이 아니다", () => {
  const conflict = findReservationConflict([existingReservation], {
    date: "2026-06-19",
    period: 2,
    room: "음악실"
  });

  assert.equal(conflict, null);
});

test("범위 안의 한 교시라도 겹치면 기존 예약을 찾는다", () => {
  const conflict = findReservationRangeConflict([existingReservation], {
    date: "2026-06-19",
    startPeriod: 1,
    endPeriod: 3,
    room: "창의놀이실",
    grade: 5,
    classNumber: 1
  });

  assert.equal(conflict, existingReservation);
});

test("청계누리는 같은 날짜와 교시에 두 번째 예약까지 허용한다", () => {
  const gymReservation = {
    ...existingReservation,
    id: "gym-1",
    room: "체육관"
  };
  const conflict = findReservationConflict([gymReservation], {
    date: "2026-06-19",
    period: 2,
    room: "청계누리(강당)",
    grade: 5,
    classNumber: 1
  });

  assert.equal(conflict, null);
});

test("청계누리는 같은 날짜와 교시에 세 번째 예약부터 막는다", () => {
  const gymReservations = [
    {
      ...existingReservation,
      id: "gym-1",
      room: "체육관"
    },
    {
      ...existingReservation,
      id: "gym-2",
      room: "체육관",
      grade: 4,
      classNumber: 2
    }
  ];
  const conflict = findReservationConflict(gymReservations, {
    date: "2026-06-19",
    period: 2,
    room: "청계누리(강당)",
    grade: 5,
    classNumber: 1
  });

  assert.equal(conflict, gymReservations[0]);
});

test("기존 예약자를 포함한 예약 불가 메시지를 만든다", () => {
  assert.equal(
    formatReservationConflictMessage(existingReservation),
    "이미 3학년 4반이 먼저 예약해서 예약할 수 없습니다."
  );
});
