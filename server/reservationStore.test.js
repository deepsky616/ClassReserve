import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createReservationStore } from "./reservationStore.js";

async function withStore(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "class-reserve-"));
  const filePath = path.join(directory, "reservations.json");
  const store = createReservationStore({
    filePath,
    now: () => "2026-06-10T00:00:00.000Z",
    id: () => "reservation-1"
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
