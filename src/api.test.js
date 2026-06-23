import assert from "node:assert/strict";
import test from "node:test";
import { createReservation, createReservationAndConfirm, deleteReservation, fetchReservations } from "./api.js";

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
        date: "Tue Jun 23 2026 00:00:00 GMT+0900 (한국 표준시)",
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
    assert.equal(reservations[0].date, "2026-06-23");
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

test("예약 생성 후 목록에서 저장 여부를 확인한다", async () => {
  const actions = [];
  let listCallCount = 0;
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    if (payload.action === "list") {
      listCallCount += 1;
      return {
        ok: true,
        reservations: listCallCount === 1 ? [] : [
          {
            id: "reservation-2",
            date: validInput.date,
            period: validInput.period,
            room: validInput.room,
            grade: validInput.grade,
            classNumber: validInput.classNumber,
            createdAt: "2026-06-10T00:00:00.000Z"
          }
        ]
      };
    }

    return {
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
    };
  });

  try {
    const result = await createReservationAndConfirm(validInput, {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });

    assert.equal(result.reservation.id, "reservation-2");
    assert.equal(result.reservations.length, 1);
    assert.deepEqual(actions, ["list", "create", "list"]);
  } finally {
    harness.restore();
  }
});

test("생성 응답은 성공이지만 목록에 없으면 저장 확인 실패로 분류한다", async () => {
  let listCallCount = 0;
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));

    if (payload.action === "list") {
      listCallCount += 1;
      return {
        ok: true,
        reservations: listCallCount === 1 ? [] : []
      };
    }

    return {
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
    };
  });

  try {
    await assert.rejects(
      () => createReservationAndConfirm(validInput, { scriptUrl: "https://script.google.com/macros/s/example/exec" }),
      {
        code: "PERSISTENCE_UNCONFIRMED",
        message: "예약 저장을 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요."
      }
    );
  } finally {
    harness.restore();
  }
});

test("예약 직전 최신 목록에서 중복을 발견하면 생성 요청을 보내지 않는다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    if (payload.action === "list") {
      return {
        ok: true,
        reservations: [
          {
            id: "reservation-1",
            date: validInput.date,
            period: validInput.period,
            room: validInput.room,
            grade: 3,
            classNumber: 4,
            createdAt: "2026-06-10T00:00:00.000Z"
          }
        ]
      };
    }

    return {
      ok: false,
      code: "UNEXPECTED_CREATE",
      message: "생성 요청이 호출되면 안 됩니다."
    };
  });

  try {
    await assert.rejects(
      () => createReservationAndConfirm(validInput, { scriptUrl: "https://script.google.com/macros/s/example/exec" }),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 3학년 4반이 먼저 예약해서 예약할 수 없습니다."
      }
    );

    assert.deepEqual(actions, ["list"]);
  } finally {
    harness.restore();
  }
});

test("앱스 스크립트 오류 응답을 같은 코드로 던진다", async () => {
  const harness = installJsonpDomHarness(() => ({
    ok: false,
    code: "DUPLICATE_RESERVATION",
    message: "이미 2학년 3반이 먼저 예약해서 예약할 수 없습니다."
  }));

  try {
    await assert.rejects(
      () => createReservation(validInput, { scriptUrl: "https://script.google.com/macros/s/example/exec" }),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 2학년 3반이 먼저 예약해서 예약할 수 없습니다."
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
