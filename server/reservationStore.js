import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createPasswordHash, verifyPassword } from "./password.js";

const REQUIRED_FIELDS = ["date", "period", "room", "grade", "classNumber", "password"];

export function createReservationStore(options = {}) {
  const filePath = options.filePath ?? path.resolve("data/reservations.json");
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => randomUUID());

  async function readReservations() {
    try {
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw withCode(error, "STORAGE_ERROR");
    }
  }

  async function writeReservations(reservations) {
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(reservations, null, 2)}\n`, "utf8");
    } catch (error) {
      throw withCode(error, "STORAGE_ERROR");
    }
  }

  async function listReservations() {
    const reservations = await readReservations();
    return reservations.map(stripPrivateFields);
  }

  async function createReservation(input) {
    validateReservationInput(input);
    const reservations = await readReservations();
    const duplicate = reservations.some((reservation) => {
      return (
        reservation.date === input.date &&
        Number(reservation.period) === Number(input.period) &&
        reservation.room === input.room
      );
    });

    if (duplicate) {
      throw createError("이미 예약된 특별실입니다.", "DUPLICATE_RESERVATION", 409);
    }

    const reservation = {
      id: id(),
      date: input.date,
      period: Number(input.period),
      room: input.room,
      grade: Number(input.grade),
      classNumber: Number(input.classNumber),
      passwordHash: createPasswordHash(input.password),
      createdAt: now()
    };

    await writeReservations([...reservations, reservation]);
    return stripPrivateFields(reservation);
  }

  async function deleteReservation(reservationId, password) {
    if (!reservationId || !password) {
      throw createError("예약과 비밀번호를 확인해 주세요.", "VALIDATION_ERROR", 400);
    }

    const reservations = await readReservations();
    const reservation = reservations.find((item) => item.id === reservationId);

    if (!reservation) {
      throw createError("예약을 찾을 수 없습니다.", "NOT_FOUND", 404);
    }

    if (!verifyPassword(password, reservation.passwordHash)) {
      throw createError("삭제 비밀번호가 맞지 않습니다.", "INVALID_PASSWORD", 403);
    }

    await writeReservations(reservations.filter((item) => item.id !== reservationId));
    return { deleted: true };
  }

  return {
    listReservations,
    createReservation,
    deleteReservation
  };
}

export function createError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function validateReservationInput(input) {
  const missing = REQUIRED_FIELDS.filter((field) => {
    return input?.[field] === undefined || input?.[field] === null || input?.[field] === "";
  });

  if (missing.length > 0) {
    throw createError("필수 입력을 모두 채워 주세요.", "VALIDATION_ERROR", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw createError("날짜 형식이 올바르지 않습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isNumberInRange(input.period, 1, 6)) {
    throw createError("교시는 1교시부터 6교시까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isNumberInRange(input.grade, 1, 6)) {
    throw createError("학년은 1학년부터 6학년까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isNumberInRange(input.classNumber, 1, 10)) {
    throw createError("반은 1반부터 10반까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }
}

function isNumberInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function stripPrivateFields(reservation) {
  const { passwordHash, ...publicReservation } = reservation;
  return publicReservation;
}

function withCode(error, code) {
  error.code = code;
  error.status = 500;
  return error;
}
