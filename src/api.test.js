import assert from "node:assert/strict";
import test from "node:test";
import { createReservation, deleteReservation, fetchReservations } from "./api.js";

const validInput = {
  date: "2026-06-19",
  period: 1,
  room: "창의놀이실",
  grade: 1,
  classNumber: 1,
  password: "12"
};

function installJsonpDomHarness(responseForUrl) {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const appendedScripts = [];

  globalThis.window = globalThis;
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "script");
      return {};
    },
    body: {
      appendChild(script) {
        appendedScripts.push(script);
        queueMicrotask(() => {
          const url = new URL(script.src);
          const callbackName = url.searchParams.get("callback");
          globalThis[callbackName](responseForUrl(url));
        });
      },
      removeChild() {}
    }
  };

  return {
    getLastScriptUrl() {
      return appendedScripts.at(-1)?.src;
    },
    restore() {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }
  };
}

test("구글 스크립트 주소가 없으면 설정 오류로 분류한다", async () => {
  await assert.rejects(
    () => fetchReservations({ scriptUrl: "" }),
    { code: "CONFIG_MISSING" }
  );
});

test("JSONP로 예약 목록을 조회한다", async () => {
  const harness = installJsonpDomHarness(() => ({
    ok: true,
    reservations: [
      {
        id: "reservation-1",
        date: "2026-06-19",
        period: 1,
        room: "창의놀이실",
        grade: 1,
        classNumber: 1,
        createdAt: "2026-06-10T00:00:00.000Z"
      }
    ]
  }));

  try {
    const reservations = await fetchReservations({ scriptUrl: "https://script.google.com/macros/s/example/exec" });
    const scriptUrl = new URL(harness.getLastScriptUrl());
    const payload = JSON.parse(scriptUrl.searchParams.get("payload"));

    assert.equal(payload.action, "list");
    assert.equal(reservations.length, 1);
    assert.equal(reservations[0].room, "창의놀이실");
  } finally {
    harness.restore();
  }
});

test("JSONP로 예약을 생성한다", async () => {
  const harness = installJsonpDomHarness(() => ({
    ok: true,
    reservation: {
      id: "reservation-2",
      date: validInput.date,
      period: validInput.period,
      room: validInput.room,
      grade: validInput.grade,
      classNumber: validInput.classNumber,
      createdAt: "2026-06-10T00:00:00.000Z"
    }
  }));

  try {
    const reservation = await createReservation(validInput, {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });
    const scriptUrl = new URL(harness.getLastScriptUrl());
    const payload = JSON.parse(scriptUrl.searchParams.get("payload"));

    assert.equal(payload.action, "create");
    assert.equal(payload.reservation.room, "창의놀이실");
    assert.equal(reservation.id, "reservation-2");
  } finally {
    harness.restore();
  }
});

test("앱스 스크립트 오류 응답을 같은 코드로 던진다", async () => {
  const harness = installJsonpDomHarness(() => ({
    ok: false,
    code: "DUPLICATE_RESERVATION",
    message: "이미 2학년 3반이 예약한 특별실입니다."
  }));

  try {
    await assert.rejects(
      () => createReservation(validInput, { scriptUrl: "https://script.google.com/macros/s/example/exec" }),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 2학년 3반이 예약한 특별실입니다."
      }
    );
  } finally {
    harness.restore();
  }
});

test("JSONP로 예약을 삭제한다", async () => {
  const harness = installJsonpDomHarness(() => ({
    ok: true,
    deleted: true
  }));

  try {
    const result = await deleteReservation("reservation-2", "12", {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });
    const scriptUrl = new URL(harness.getLastScriptUrl());
    const payload = JSON.parse(scriptUrl.searchParams.get("payload"));

    assert.equal(payload.action, "delete");
    assert.equal(payload.id, "reservation-2");
    assert.equal(payload.password, "12");
    assert.equal(result.deleted, true);
  } finally {
    harness.restore();
  }
});
