import assert from "node:assert/strict";
import test from "node:test";
import {
  createReservation,
  createReservationAndConfirm,
  createReservationRangeAndConfirm,
  createFixedScheduleRangeAndConfirm,
  deleteReservation,
  deleteReservationAndConfirm,
  deleteFixedScheduleAndConfirm,
  deleteReservationsAndConfirm,
  fetchFixedSchedules,
  fetchReservations
} from "./api.js";

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

test("JSONP로 고정 사용 목록을 조회한다", async () => {
  const harness = installJsonpDomHarness(() => ({
    ok: true,
    fixedSchedules: [
      {
        id: "fixed-1",
        weekday: "1",
        period: "2",
        room: "음악실(2층)",
        label: "3학년 음악",
        createdAt: "2026-06-10T00:00:00.000Z"
      }
    ]
  }));

  try {
    const fixedSchedules = await fetchFixedSchedules({ scriptUrl: "https://script.google.com/macros/s/example/exec" });
    const scriptUrl = new URL(harness.getLastScriptUrl());
    const payload = JSON.parse(scriptUrl.searchParams.get("payload"));

    assert.equal(payload.action, "listFixedSchedules");
    assert.equal(fixedSchedules.length, 1);
    assert.equal(fixedSchedules[0].weekday, 1);
    assert.equal(fixedSchedules[0].period, 2);
    assert.equal(fixedSchedules[0].room, "음악실");
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

test("예약 생성 후 한 번의 요청으로 최신 목록에서 저장 여부를 확인한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    assert.equal(payload.action, "createManyAndList");

    return {
      ok: true,
      createdReservations: [{
        id: "reservation-2",
        date: validInput.date,
        period: validInput.period,
        room: validInput.room,
        grade: validInput.grade,
        classNumber: validInput.classNumber,
        createdAt: "2026-06-10T00:00:00.000Z"
      }],
      reservations: [{
        id: "reservation-2",
        date: validInput.date,
        period: validInput.period,
        room: validInput.room,
        grade: validInput.grade,
        classNumber: validInput.classNumber,
        createdAt: "2026-06-10T00:00:00.000Z"
      }]
    };
  });

  try {
    const result = await createReservationAndConfirm(validInput, {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });

    assert.equal(result.reservation.id, "reservation-2");
    assert.equal(result.reservations.length, 1);
    assert.deepEqual(actions, ["createManyAndList"]);
  } finally {
    harness.restore();
  }
});

test("생성 응답은 성공이지만 함께 받은 목록에 없으면 저장 확인 실패로 분류한다", async () => {
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));

    assert.equal(payload.action, "createManyAndList");

    return {
      ok: true,
      createdReservations: [{
        id: "reservation-2",
        date: validInput.date,
        period: validInput.period,
        room: validInput.room,
        grade: validInput.grade,
        classNumber: validInput.classNumber,
        createdAt: "2026-06-10T00:00:00.000Z"
      }],
      reservations: []
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

test("예약 중복은 앱스 스크립트의 단일 생성 요청 오류로 처리한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    return {
      ok: false,
      code: "DUPLICATE_RESERVATION",
      message: "이미 3학년 4반이 먼저 예약해서 예약할 수 없습니다."
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

    assert.deepEqual(actions, ["createManyAndList"]);
  } finally {
    harness.restore();
  }
});

test("교시 범위를 한 번의 JSONP 요청으로 예약하고 응답 목록에서 저장 여부를 확인한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    assert.equal(payload.action, "createManyAndList");
    assert.deepEqual(payload.reservations.map((reservation) => reservation.period), [1, 2, 3]);
    const createdReservations = payload.reservations.map((reservation, index) => ({
      ...reservation,
      id: `reservation-${index + 1}`,
      createdAt: "2026-06-10T00:00:00.000Z"
    }));

    return {
      ok: true,
      createdReservations,
      reservations: createdReservations
    };
  });

  try {
    const result = await createReservationRangeAndConfirm(
      {
        ...validInput,
        startPeriod: 1,
        endPeriod: 3
      },
      { scriptUrl: "https://script.google.com/macros/s/example/exec" }
    );

    assert.deepEqual(result.createdReservations.map((reservation) => reservation.period), [1, 2, 3]);
    assert.equal(result.reservations.length, 3);
    assert.deepEqual(actions, ["createManyAndList"]);
  } finally {
    harness.restore();
  }
});

test("교시 범위 중복은 앱스 스크립트의 단일 묶음 생성 요청 오류로 처리한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    return {
      ok: false,
      code: "DUPLICATE_RESERVATION",
      message: "이미 3학년 4반이 먼저 예약해서 예약할 수 없습니다."
    };
  });

  try {
    await assert.rejects(
      () => createReservationRangeAndConfirm(
        {
          ...validInput,
          startPeriod: 1,
          endPeriod: 3
        },
        { scriptUrl: "https://script.google.com/macros/s/example/exec" }
      ),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 3학년 4반이 먼저 예약해서 예약할 수 없습니다."
      }
    );

    assert.deepEqual(actions, ["createManyAndList"]);
  } finally {
    harness.restore();
  }
});

test("교시 범위를 한 번의 JSONP 요청으로 고정 사용 등록하고 목록에서 저장 여부를 확인한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    assert.equal(payload.action, "createFixedSchedulesAndList");
    assert.deepEqual(payload.fixedSchedules.map((schedule) => schedule.period), [2, 3]);
    const createdFixedSchedules = payload.fixedSchedules.map((schedule, index) => ({
      ...schedule,
      id: `fixed-${index + 1}`,
      createdAt: "2026-06-10T00:00:00.000Z"
    }));

    return {
      ok: true,
      createdFixedSchedules,
      fixedSchedules: createdFixedSchedules
    };
  });

  try {
    const result = await createFixedScheduleRangeAndConfirm(
      {
        weekday: 1,
        startPeriod: 2,
        endPeriod: 3,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      },
      { scriptUrl: "https://script.google.com/macros/s/example/exec" }
    );

    assert.deepEqual(result.createdFixedSchedules.map((schedule) => schedule.period), [2, 3]);
    assert.equal(result.fixedSchedules.length, 2);
    assert.deepEqual(actions, ["createFixedSchedulesAndList"]);
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

test("예약 삭제 후 한 번의 요청으로 실제 삭제 여부를 확인한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    assert.equal(payload.action, "deleteManyAndList");
    assert.deepEqual(payload.ids, ["reservation-2"]);
    assert.equal(payload.password, "12");

    return {
      ok: true,
      deleted: true,
      deletedCount: 1,
      reservations: [
        {
          id: "reservation-1",
          date: validInput.date,
          period: validInput.period,
          room: validInput.room,
          grade: validInput.grade,
          classNumber: validInput.classNumber,
          createdAt: "2026-06-10T00:00:00.000Z"
        }
      ]
    };
  });

  try {
    const result = await deleteReservationAndConfirm("reservation-2", "12", {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });

    assert.equal(result.deleted, true);
    assert.equal(result.reservations.length, 1);
    assert.deepEqual(actions, ["deleteManyAndList"]);
  } finally {
    harness.restore();
  }
});

test("삭제 응답은 성공이지만 함께 받은 목록에 남아 있으면 삭제 확인 실패로 분류한다", async () => {
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));

    assert.equal(payload.action, "deleteManyAndList");

    return {
      ok: true,
      deleted: true,
      deletedCount: 1,
      reservations: [
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
  });

  try {
    await assert.rejects(
      () => deleteReservationAndConfirm("reservation-2", "12", {
        scriptUrl: "https://script.google.com/macros/s/example/exec"
      }),
      {
        code: "DELETE_UNCONFIRMED",
        message: "예약 삭제를 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요."
      }
    );
  } finally {
    harness.restore();
  }
});

test("여러 예약을 삭제한 뒤 목록에서 모두 삭제됐는지 한 번에 확인한다", async () => {
  const actions = [];
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));
    actions.push(payload.action);

    assert.equal(payload.action, "deleteManyAndList");
    assert.deepEqual(payload.ids, ["reservation-1", "reservation-2"]);
    assert.equal(payload.password, "12");

    return {
      ok: true,
      deleted: true,
      deletedCount: 2,
      reservations: [
        {
          id: "reservation-3",
          date: validInput.date,
          period: 3,
          room: validInput.room,
          grade: validInput.grade,
          classNumber: validInput.classNumber,
          createdAt: "2026-06-10T00:00:00.000Z"
        }
      ]
    };
  });

  try {
    const result = await deleteReservationsAndConfirm(["reservation-1", "reservation-2"], "12", {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });

    assert.equal(result.deleted, true);
    assert.equal(result.deletedCount, 2);
    assert.deepEqual(result.reservations.map((reservation) => reservation.id), ["reservation-3"]);
    assert.deepEqual(actions, ["deleteManyAndList"]);
  } finally {
    harness.restore();
  }
});

test("여러 예약 삭제 뒤 하나라도 목록에 남아 있으면 삭제 확인 실패로 분류한다", async () => {
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));

    assert.equal(payload.action, "deleteManyAndList");

    return {
      ok: true,
      deleted: true,
      deletedCount: 2,
      reservations: [
        {
          id: "reservation-2",
          date: validInput.date,
          period: 2,
          room: validInput.room,
          grade: validInput.grade,
          classNumber: validInput.classNumber,
          createdAt: "2026-06-10T00:00:00.000Z"
        }
      ]
    };
  });

  try {
    await assert.rejects(
      () => deleteReservationsAndConfirm(["reservation-1", "reservation-2"], "12", {
        scriptUrl: "https://script.google.com/macros/s/example/exec"
      }),
      {
        code: "DELETE_UNCONFIRMED",
        message: "예약 삭제를 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요."
      }
    );
  } finally {
    harness.restore();
  }
});

test("고정 사용 삭제 후 한 번의 요청으로 실제 삭제 여부를 확인한다", async () => {
  const harness = installJsonpDomHarness((url) => {
    const payload = JSON.parse(url.searchParams.get("payload"));

    assert.equal(payload.action, "deleteFixedScheduleAndList");
    assert.equal(payload.id, "fixed-1");
    assert.equal(payload.password, "admin-pass");

    return {
      ok: true,
      deleted: true,
      fixedSchedules: []
    };
  });

  try {
    const result = await deleteFixedScheduleAndConfirm("fixed-1", "admin-pass", {
      scriptUrl: "https://script.google.com/macros/s/example/exec"
    });

    assert.equal(result.deleted, true);
    assert.deepEqual(result.fixedSchedules, []);
  } finally {
    harness.restore();
  }
});
