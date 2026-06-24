import assert from "node:assert/strict";
import test from "node:test";
import {
  getDuplicateReservationGroups,
  getDuplicateReservationsToDelete
} from "./reservationCleanup.js";

const baseReservation = {
  date: "2026-06-19",
  period: 1,
  room: "컴퓨터실",
  grade: 1,
  classNumber: 1
};

test("같은 날짜, 교시, 특별실 예약은 먼저 만든 예약만 남긴다", () => {
  const reservations = [
    {
      ...baseReservation,
      id: "late",
      grade: 2,
      classNumber: 3,
      createdAt: "2026-06-10T09:02:00.000Z"
    },
    {
      ...baseReservation,
      id: "early",
      grade: 1,
      classNumber: 1,
      createdAt: "2026-06-10T09:01:00.000Z"
    },
    {
      ...baseReservation,
      id: "later",
      grade: 3,
      classNumber: 2,
      createdAt: "2026-06-10T09:03:00.000Z"
    }
  ];

  const groups = getDuplicateReservationGroups(reservations);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].keeper.id, "early");
  assert.deepEqual(groups[0].duplicates.map((reservation) => reservation.id), ["late", "later"]);
});

test("특별실이 다르면 중복 정리 대상이 아니다", () => {
  const reservations = [
    {
      ...baseReservation,
      id: "computer",
      createdAt: "2026-06-10T09:01:00.000Z"
    },
    {
      ...baseReservation,
      id: "music",
      room: "음악실",
      createdAt: "2026-06-10T09:02:00.000Z"
    }
  ];

  assert.deepEqual(getDuplicateReservationGroups(reservations), []);
});

test("청계누리는 같은 시간 두 건까지 중복 정리 대상이 아니다", () => {
  const reservations = [
    {
      ...baseReservation,
      id: "gym-early",
      room: "체육관",
      createdAt: "2026-06-10T09:01:00.000Z"
    },
    {
      ...baseReservation,
      id: "gym-second",
      room: "청계누리(강당)",
      grade: 2,
      classNumber: 1,
      createdAt: "2026-06-10T09:02:00.000Z"
    }
  ];

  assert.deepEqual(getDuplicateReservationGroups(reservations), []);
});

test("청계누리는 같은 시간 세 번째 예약부터 중복 정리 대상이다", () => {
  const reservations = [
    {
      ...baseReservation,
      id: "gym-early",
      room: "체육관",
      createdAt: "2026-06-10T09:01:00.000Z"
    },
    {
      ...baseReservation,
      id: "gym-second",
      room: "청계누리(강당)",
      grade: 2,
      classNumber: 1,
      createdAt: "2026-06-10T09:02:00.000Z"
    },
    {
      ...baseReservation,
      id: "gym-third",
      room: "청계누리(강당)",
      grade: 3,
      classNumber: 1,
      createdAt: "2026-06-10T09:03:00.000Z"
    }
  ];

  const groups = getDuplicateReservationGroups(reservations);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].duplicates.map((reservation) => reservation.id), ["gym-third"]);
});

test("유치원 예약도 같은 시간과 특별실이면 중복 삭제 후보에 포함한다", () => {
  const reservations = [
    {
      ...baseReservation,
      id: "elementary",
      createdAt: "2026-06-10T09:01:00.000Z"
    },
    {
      ...baseReservation,
      id: "kindergarten",
      grade: "유치원",
      classNumber: "",
      createdAt: "2026-06-10T09:02:00.000Z"
    }
  ];

  assert.deepEqual(
    getDuplicateReservationsToDelete(reservations).map((reservation) => reservation.id),
    ["kindergarten"]
  );
});
