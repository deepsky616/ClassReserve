import assert from "node:assert/strict";
import test from "node:test";
import { formatReservationOwner } from "./reservationLabels.js";

test("초등 학년과 반을 표시한다", () => {
  assert.equal(formatReservationOwner({ grade: 3, classNumber: 4 }), "3학년 4반");
});

test("유치원 반을 표시한다", () => {
  assert.equal(formatReservationOwner({ grade: "유치원", classNumber: 2 }), "유치원 2반");
});
