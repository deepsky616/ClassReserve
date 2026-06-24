import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createReservationStore } from "./reservationStore.js";

async function withStore(run, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "class-reserve-"));
  const filePath = path.join(directory, "reservations.json");
  const fixedFilePath = path.join(directory, "fixed-schedules.json");
  const store = createReservationStore({
    filePath,
    fixedFilePath,
    now: () => "2026-06-10T00:00:00.000Z",
    id: () => "reservation-1",
    ...options
  });

  try {
    await run(store, filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const validInput = {
  date: "2026-06-15",
  period: 2,
  room: "창의놀이실",
  grade: 3,
  classNumber: 4,
  password: "1234"
};

test("예약을 만들고 조회할 때 삭제 비밀번호 확인값을 숨긴다", async () => {
  await withStore(async (store, filePath) => {
    const created = await store.createReservation(validInput);
    const listed = await store.listReservations();
    const raw = JSON.parse(await readFile(filePath, "utf8"));

    assert.equal(created.id, "reservation-1");
    assert.equal(created.room, "창의놀이실");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].passwordHash, undefined);
    assert.notEqual(raw[0].passwordHash, "1234");
    assert.equal(typeof raw[0].passwordHash, "string");
  });
});

test("같은 날짜와 교시와 특별실은 중복 예약할 수 없다", async () => {
  await withStore(async (store) => {
    await store.createReservation(validInput);

    await assert.rejects(
      () => store.createReservation({ ...validInput, grade: 5 }),
      { code: "DUPLICATE_RESERVATION" }
    );
  });
});

test("청계누리는 같은 날짜와 교시에 두 번째 예약까지 저장할 수 있다", async () => {
  await withStore(async (store) => {
    await store.createReservation({ ...validInput, room: "체육관" });
    await store.createReservation({ ...validInput, room: "청계누리(강당)", grade: 5, classNumber: 1 });

    const reservations = await store.listReservations();
    assert.equal(reservations.length, 2);
    assert.deepEqual(reservations.map((reservation) => reservation.room), ["청계누리(강당)", "청계누리(강당)"]);
  }, {
    id: (() => {
      let nextId = 1;
      return () => `reservation-${nextId++}`;
    })()
  });
});

test("청계누리는 같은 날짜와 교시에 세 번째 예약부터 거부한다", async () => {
  await withStore(async (store) => {
    await store.createReservation({ ...validInput, room: "체육관" });
    await store.createReservation({ ...validInput, room: "청계누리(강당)", grade: 5, classNumber: 1 });

    await assert.rejects(
      () => store.createReservation({ ...validInput, room: "청계누리(강당)", grade: 6, classNumber: 1 }),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 3학년 4반 외 1건이 먼저 예약해서 예약할 수 없습니다."
      }
    );

    assert.equal((await store.listReservations()).length, 2);
  }, {
    id: (() => {
      let nextId = 1;
      return () => `reservation-${nextId++}`;
    })()
  });
});

test("여러 교시 예약은 모두 저장되거나 모두 거부된다", async () => {
  await withStore(async (store) => {
    const created = await store.createReservations([
      { ...validInput, period: 1 },
      { ...validInput, period: 2 },
      { ...validInput, period: 3 }
    ]);

    assert.deepEqual(created.map((reservation) => reservation.period), [1, 2, 3]);
    assert.equal((await store.listReservations()).length, 3);

    await assert.rejects(
      () => store.createReservations([
        { ...validInput, date: "2026-06-16", period: 4 },
        { ...validInput, period: 2 }
      ]),
      { code: "DUPLICATE_RESERVATION" }
    );

    assert.equal((await store.listReservations()).length, 3);
  }, {
    id: (() => {
      let nextId = 1;
      return () => `reservation-${nextId++}`;
    })()
  });
});

test("예약 생성은 최신 예약 목록까지 같은 저장소 작업에서 반환한다", async () => {
  await withStore(async (store) => {
    const result = await store.createReservationsAndList([
      { ...validInput, period: 1 },
      { ...validInput, period: 2 }
    ]);

    assert.deepEqual(result.createdReservations.map((reservation) => reservation.period), [1, 2]);
    assert.deepEqual(result.reservations.map((reservation) => reservation.period), [1, 2]);
  }, {
    id: (() => {
      let nextId = 1;
      return () => `reservation-${nextId++}`;
    })()
  });
});

test("예약 삭제는 최신 예약 목록까지 같은 저장소 작업에서 반환한다", async () => {
  await withStore(async (store) => {
    await store.createReservations([
      { ...validInput, period: 1 },
      { ...validInput, period: 2 },
      { ...validInput, period: 3 }
    ]);

    const result = await store.deleteReservationsAndList(["reservation-1", "reservation-2"], "1234");

    assert.equal(result.deletedCount, 2);
    assert.deepEqual(result.reservations.map((reservation) => reservation.id), ["reservation-3"]);
  }, {
    id: (() => {
      let nextId = 1;
      return () => `reservation-${nextId++}`;
    })()
  });
});

test("중복 예약 오류는 이미 예약한 학년과 반을 알려준다", async () => {
  await withStore(async (store) => {
    await store.createReservation(validInput);

    await assert.rejects(
      () => store.createReservation({ ...validInput, grade: 5, classNumber: 1 }),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 3학년 4반이 먼저 예약해서 예약할 수 없습니다."
      }
    );
  });
});

test("유치원이 먼저 예약한 날짜와 교시와 특별실은 다른 학급이 예약할 수 없다", async () => {
  await withStore(async (store) => {
    await store.createReservation({
      ...validInput,
      grade: "유치원",
      classNumber: ""
    });

    await assert.rejects(
      () => store.createReservation({ ...validInput, grade: 2, classNumber: 1 }),
      {
        code: "DUPLICATE_RESERVATION",
        message: "이미 유치원이 먼저 예약해서 예약할 수 없습니다."
      }
    );

    assert.equal((await store.listReservations()).length, 1);
  });
});

test("유치원은 반 선택 없이 특별실을 예약할 수 있다", async () => {
  await withStore(async (store) => {
    const created = await store.createReservation({
      ...validInput,
      grade: "유치원",
      classNumber: ""
    });

    assert.equal(created.grade, "유치원");
    assert.equal(created.classNumber, null);
  });
});

test("학년별 반 수를 넘으면 예약할 수 없다", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.createReservation({ ...validInput, grade: 1, classNumber: 6 }),
      { code: "VALIDATION_ERROR" }
    );

    await assert.rejects(
      () => store.createReservation({ ...validInput, grade: 4, classNumber: 8 }),
      { code: "VALIDATION_ERROR" }
    );

    const sixthGrade = await store.createReservation({ ...validInput, grade: 6, classNumber: 6 });
    assert.equal(sixthGrade.classNumber, 6);
  });
});

test("예약 날짜는 오늘부터 8주 뒤까지만 허용한다", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.createReservation({ ...validInput, date: "2026-06-09" }),
      { code: "VALIDATION_ERROR" }
    );

    await assert.rejects(
      () => store.createReservation({ ...validInput, date: "2026-08-06" }),
      { code: "VALIDATION_ERROR" }
    );

    const created = await store.createReservation({ ...validInput, date: "2026-08-05" });
    assert.equal(created.date, "2026-08-05");
  });
});

test("필수 입력이 없으면 예약을 만들지 않는다", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.createReservation({ ...validInput, room: "" }),
      { code: "VALIDATION_ERROR" }
    );
  });
});

test("목록에 없는 특별실은 예약할 수 없다", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.createReservation({ ...validInput, room: "과학실" }),
      { code: "VALIDATION_ERROR" }
    );
  });
});

test("청계누리와 새 특별실은 예약할 수 있다", async () => {
  await withStore(async (store) => {
    const auditorium = await store.createReservation({ ...validInput, room: "청계누리(강당)" });
    const club1 = await store.createReservation({ ...validInput, date: "2026-06-16", room: "동아리1" });
    const club2 = await store.createReservation({ ...validInput, date: "2026-06-17", room: "동아리2" });
    const multipurpose = await store.createReservation({ ...validInput, date: "2026-06-18", room: "다목적실" });

    assert.equal(auditorium.room, "청계누리(강당)");
    assert.equal(club1.room, "동아리1");
    assert.equal(club2.room, "동아리2");
    assert.equal(multipurpose.room, "다목적실");
  });
});

test("2층 음악실과 5층 음악실은 같은 교시에도 따로 예약할 수 있다", async () => {
  await withStore(async (store) => {
    await store.createReservation({ ...validInput, room: "음악실(2층)" });
    await store.createReservation({ ...validInput, room: "음악실", grade: 5, classNumber: 1 });

    const reservations = await store.listReservations();
    assert.deepEqual(reservations.map((reservation) => reservation.room), ["음악실(2층)", "음악실"]);
  }, {
    id: (() => {
      let nextId = 1;
      return () => `music-room-${nextId++}`;
    })()
  });
});

test("층수 없는 특별실 목록의 컴퓨터실과 AI캠퍼스와 신체활동실과 청계누리를 예약할 수 있다", async () => {
  await withStore(async (store) => {
    const computerRoom = await store.createReservation({
      ...validInput,
      room: "컴퓨터실"
    });
    const aiRoom = await store.createReservation({
      ...validInput,
      date: "2026-06-16",
      room: "AI캠퍼스"
    });
    const activityRoom = await store.createReservation({
      ...validInput,
      date: "2026-06-17",
      room: "신체활동실"
    });
    const gym = await store.createReservation({
      ...validInput,
      date: "2026-06-18",
      room: "청계누리(강당)"
    });

    assert.equal(computerRoom.room, "컴퓨터실");
    assert.equal(aiRoom.room, "AI캠퍼스");
    assert.equal(activityRoom.room, "신체활동실");
    assert.equal(gym.room, "청계누리(강당)");
  });
});

test("이전 층수 이름은 층수 없는 이름으로 저장된다", async () => {
  await withStore(async (store) => {
    const play = await store.createReservation({ ...validInput, room: "창의놀이실(1층)" });
    const music = await store.createReservation({ ...validInput, date: "2026-06-16", room: "음악실(2층)" });
    const meeting = await store.createReservation({ ...validInput, date: "2026-06-17", room: "다모임실(2층)" });
    const ai = await store.createReservation({ ...validInput, date: "2026-06-18", room: "AI실(2층)" });
    const gym = await store.createReservation({ ...validInput, date: "2026-06-19", room: "체육관(3층)" });
    const computer = await store.createReservation({ ...validInput, date: "2026-06-20", room: "컴퓨터실(4층)" });
    const music5 = await store.createReservation({ ...validInput, date: "2026-06-21", room: "음악실(5층)" });

    assert.equal(play.room, "창의놀이실");
    assert.equal(music.room, "음악실");
    assert.equal(meeting.room, "다모임실");
    assert.equal(ai.room, "AI캠퍼스");
    assert.equal(gym.room, "청계누리(강당)");
    assert.equal(computer.room, "컴퓨터실");
    assert.equal(music5.room, "음악실");
  }, {
    id: (() => {
      let nextId = 1;
      return () => `legacy-room-${nextId++}`;
    })()
  });
});

test("층수 없는 컴퓨터실은 예약할 수 있다", async () => {
  await withStore(async (store) => {
    const created = await store.createReservation({ ...validInput, room: "컴퓨터실" });

    assert.equal(created.room, "컴퓨터실");
  });
});

test("올바른 삭제 비밀번호로 예약을 삭제한다", async () => {
  await withStore(async (store) => {
    const created = await store.createReservation(validInput);
    const result = await store.deleteReservation(created.id, "1234");

    assert.equal(result.deleted, true);
    assert.deepEqual(await store.listReservations(), []);
  });
});

test("틀린 삭제 비밀번호로는 예약을 삭제하지 않는다", async () => {
  await withStore(async (store) => {
    const created = await store.createReservation(validInput);

    await assert.rejects(
      () => store.deleteReservation(created.id, "wrong"),
      { code: "INVALID_PASSWORD" }
    );

    assert.equal((await store.listReservations()).length, 1);
  });
});

test("관리자 비밀번호로 예약을 삭제할 수 있다", async () => {
  await withStore(async (store) => {
    const created = await store.createReservation(validInput);
    const result = await store.deleteReservation(created.id, "admin-pass");

    assert.equal(result.deleted, true);
    assert.deepEqual(await store.listReservations(), []);
  }, { adminPassword: "admin-pass" });
});

test("고정 사용을 등록하고 조회할 때 관리자 비밀번호는 응답하지 않는다", async () => {
  await withStore(async (store) => {
    const created = await store.createFixedSchedules([
      {
        weekday: 1,
        period: 2,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      }
    ]);
    const listed = await store.listFixedSchedules();

    assert.equal(created.length, 1);
    assert.equal(created[0].room, "음악실");
    assert.equal(created[0].label, "3학년 음악");
    assert.equal(created[0].password, undefined);
    assert.deepEqual(listed, created);
  }, { adminPassword: "admin-pass" });
});

test("고정 사용 시간에는 일반 예약을 만들 수 없다", async () => {
  await withStore(async (store) => {
    await store.createFixedSchedules([
      {
        weekday: 1,
        period: 2,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      }
    ]);

    await assert.rejects(
      () => store.createReservation({
        ...validInput,
        date: "2026-06-22",
        period: 2,
        room: "음악실"
      }),
      {
        code: "FIXED_SCHEDULE_CONFLICT",
        message: "매주 월요일 2교시는 음악실 고정 사용 시간(3학년 음악)이라 예약할 수 없습니다."
      }
    );
  }, { adminPassword: "admin-pass" });
});

test("고정 사용은 관리자 비밀번호로 삭제한다", async () => {
  await withStore(async (store) => {
    const [created] = await store.createFixedSchedules([
      {
        weekday: 3,
        period: 4,
        room: "체육관",
        label: "5학년 체육",
        password: "admin-pass"
      }
    ]);

    await assert.rejects(
      () => store.deleteFixedSchedule(created.id, "wrong"),
      { code: "INVALID_PASSWORD" }
    );

    const result = await store.deleteFixedSchedule(created.id, "admin-pass");

    assert.equal(result.deleted, true);
    assert.deepEqual(await store.listFixedSchedules(), []);
  }, { adminPassword: "admin-pass" });
});

test("여러 고정 사용은 관리자 비밀번호로 한 번에 삭제한다", async () => {
  await withStore(async (store) => {
    const created = await store.createFixedSchedules([
      {
        weekday: 1,
        period: 2,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      },
      {
        weekday: 1,
        period: 3,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      }
    ]);

    await assert.rejects(
      () => store.deleteFixedSchedules(created.map((fixedSchedule) => fixedSchedule.id), "wrong"),
      { code: "INVALID_PASSWORD" }
    );

    assert.equal((await store.listFixedSchedules()).length, 2);

    const result = await store.deleteFixedSchedules(created.map((fixedSchedule) => fixedSchedule.id), "admin-pass");

    assert.equal(result.deletedCount, 2);
    assert.deepEqual(await store.listFixedSchedules(), []);
  }, {
    adminPassword: "admin-pass",
    id: (() => {
      let nextId = 1;
      return () => `fixed-${nextId++}`;
    })()
  });
});

test("고정 사용 등록은 최신 고정 사용 목록까지 같은 저장소 작업에서 반환한다", async () => {
  await withStore(async (store) => {
    const result = await store.createFixedSchedulesAndList([
      {
        weekday: 1,
        period: 2,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      },
      {
        weekday: 1,
        period: 3,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      }
    ]);

    assert.deepEqual(result.createdFixedSchedules.map((fixedSchedule) => fixedSchedule.period), [2, 3]);
    assert.deepEqual(result.fixedSchedules.map((fixedSchedule) => fixedSchedule.period), [2, 3]);
  }, {
    adminPassword: "admin-pass",
    id: (() => {
      let nextId = 1;
      return () => `fixed-${nextId++}`;
    })()
  });
});

test("고정 사용 삭제는 최신 고정 사용 목록까지 같은 저장소 작업에서 반환한다", async () => {
  await withStore(async (store) => {
    await store.createFixedSchedules([
      {
        weekday: 1,
        period: 2,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      },
      {
        weekday: 1,
        period: 3,
        room: "음악실",
        label: "3학년 음악",
        password: "admin-pass"
      },
      {
        weekday: 2,
        period: 4,
        room: "체육관",
        label: "5학년 체육",
        password: "admin-pass"
      }
    ]);

    const result = await store.deleteFixedSchedulesAndList(["fixed-1", "fixed-2"], "admin-pass");

    assert.equal(result.deletedCount, 2);
    assert.deepEqual(result.fixedSchedules.map((fixedSchedule) => fixedSchedule.id), ["fixed-3"]);
  }, {
    adminPassword: "admin-pass",
    id: (() => {
      let nextId = 1;
      return () => `fixed-${nextId++}`;
    })()
  });
});
