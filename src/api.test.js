import assert from "node:assert/strict";
import test from "node:test";
import { createReservation } from "./api.js";

const validInput = {
  date: "2026-06-19",
  period: 1,
  room: "창의놀이실",
  grade: 1,
  classNumber: 1,
  password: "12"
};

test("HTML 오류 응답은 저장 서버 미연결로 분류한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response("<!doctype html><title>없음</title>", {
      status: 501,
      headers: { "Content-Type": "text/html" }
    });
  };

  try {
    await assert.rejects(
      () => createReservation(validInput),
      { code: "API_UNAVAILABLE" }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("네트워크 실패는 저장 서버 미연결로 분류한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  try {
    await assert.rejects(
      () => createReservation(validInput),
      { code: "API_UNAVAILABLE" }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
