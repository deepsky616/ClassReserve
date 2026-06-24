import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createReservationStore } from "./reservationStore.js";
import { createReservationApp } from "./reservationRoutes.js";

async function withTestServer(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "class-reserve-api-"));
  const store = createReservationStore({
    filePath: path.join(directory, "reservations.json"),
    fixedFilePath: path.join(directory, "fixed-schedules.json"),
    now: () => "2026-06-10T00:00:00.000Z",
    id: (() => {
      let nextId = 1;
      return () => `id-${nextId++}`;
    })(),
    adminPassword: "admin-pass"
  });
  const app = createReservationApp({ store });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(directory, { recursive: true, force: true });
  }
}

const reservationInput = {
  date: "2026-06-15",
  period: 1,
  room: "컴퓨터실",
  grade: 4,
  classNumber: 2,
  password: "2468"
};

test("예약 목록을 조회한다", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reservations`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.reservations, []);
  });
});

test("고정 사용을 만들고 조회하고 삭제한다", async () => {
  await withTestServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/fixed-schedules/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedules: [
          {
            weekday: 1,
            period: 2,
            room: "음악실",
            label: "3학년 음악",
            password: "admin-pass"
          }
        ]
      })
    });
    const createBody = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createBody.fixedSchedules[0].room, "음악실");
    assert.equal(createBody.fixedSchedules[0].password, undefined);

    const listResponse = await fetch(`${baseUrl}/api/fixed-schedules`);
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.fixedSchedules.length, 1);

    const deleteResponse = await fetch(`${baseUrl}/api/fixed-schedules/${createBody.fixedSchedules[0].id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin-pass" })
    });
    const deleteBody = await deleteResponse.json();

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteBody.deleted, true);
  });
});

test("예약을 만들고 삭제 비밀번호 확인값은 응답하지 않는다", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reservationInput)
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.reservation.room, "컴퓨터실");
    assert.equal(body.reservation.passwordHash, undefined);
  });
});

test("중복 예약은 거부한다", async () => {
  await withTestServer(async (baseUrl) => {
    for (let index = 0; index < 2; index += 1) {
      const response = await fetch(`${baseUrl}/api/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reservationInput, grade: index + 1 })
      });

      if (index === 0) {
        assert.equal(response.status, 201);
      } else {
        const body = await response.json();
        assert.equal(response.status, 409);
        assert.equal(body.code, "DUPLICATE_RESERVATION");
        assert.equal(body.message, "이미 1학년 2반이 먼저 예약해서 예약할 수 없습니다.");
      }
    }
  });
});

test("틀린 비밀번호로 삭제하면 거부한다", async () => {
  await withTestServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reservationInput)
    });

    const response = await fetch(`${baseUrl}/api/reservations/id-1`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" })
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.code, "INVALID_PASSWORD");
  });
});
