import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createPasswordHash, verifyPassword } from "./password.js";
import {
  getClassOptionsForGrade,
  isDateInReservationWindow,
  isKindergartenGrade,
  normalizeClassNumberValue,
  normalizeGradeValue
} from "../src/reservationRules.js";
import { isAllowedRoom, normalizeRoomName } from "../src/roomUtils.js";

const REQUIRED_FIELDS = ["date", "period", "room", "grade", "password"];
const KINDERGARTEN_GRADE = "유치원";

export function createReservationStore(options = {}) {
  const filePath = options.filePath ?? path.resolve("data/reservations.json");
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => randomUUID());
  const adminPassword = options.adminPassword ?? process.env.ADMIN_DELETE_PASSWORD ?? "";

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
    const reservations = await createReservations([input]);
    return reservations[0];
  }

  async function createReservations(inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw createError("예약 내용이 없습니다.", "VALIDATION_ERROR", 400);
    }

    const createdAt = now();
    const baseDate = new Date(createdAt);
    inputs.forEach((input) => validateReservationInput(input, baseDate));

    const reservations = await readReservations();
    const createdReservations = [];

    for (const input of inputs) {
      const duplicate = [...reservations, ...createdReservations].find((reservation) => isSameSlot(reservation, input));

      if (duplicate) {
        throw createError(
          `이미 ${formatReservationOwner(duplicate)}이 먼저 예약해서 예약할 수 없습니다.`,
          "DUPLICATE_RESERVATION",
          409,
          { conflictReservation: stripPrivateFields(duplicate) }
        );
      }

      createdReservations.push({
        id: id(),
        date: input.date,
        period: Number(input.period),
        room: normalizeRoomName(input.room),
        grade: normalizeGradeValue(input.grade),
        classNumber: normalizeClassNumberValue(input.grade, input.classNumber),
        passwordHash: createPasswordHash(input.password),
        createdAt
      });
    }

    await writeReservations([...reservations, ...createdReservations]);
    return createdReservations.map(stripPrivateFields);
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

    if (!verifyPassword(password, reservation.passwordHash) && password !== adminPassword) {
      throw createError("삭제 비밀번호가 맞지 않습니다.", "INVALID_PASSWORD", 403);
    }

    await writeReservations(reservations.filter((item) => item.id !== reservationId));
    return { deleted: true };
  }

  return {
    listReservations,
    createReservation,
    createReservations,
    deleteReservation
  };
}

export function createError(message, code, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function validateReservationInput(input, baseDate) {
  const missing = REQUIRED_FIELDS.filter((field) => {
    return input?.[field] === undefined || input?.[field] === null || input?.[field] === "";
  });

  if (missing.length > 0) {
    throw createError("필수 입력을 모두 채워 주세요.", "VALIDATION_ERROR", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw createError("날짜 형식이 올바르지 않습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isDateInReservationWindow(input.date, baseDate)) {
    throw createError("예약 날짜는 오늘부터 8주 뒤까지만 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isAllowedRoom(input.room)) {
    throw createError("선택할 수 없는 특별실입니다.", "VALIDATION_ERROR", 400);
  }

  if (!isNumberInRange(input.period, 1, 6)) {
    throw createError("교시는 1교시부터 6교시까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isValidGrade(input.grade)) {
    throw createError("학년은 유치원 또는 1학년부터 6학년까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isKindergartenGrade(input.grade)) {
    if (input.classNumber === undefined || input.classNumber === null || input.classNumber === "") {
      throw createError("반을 선택해 주세요.", "VALIDATION_ERROR", 400);
    }

    if (!isNumberInRange(input.classNumber, 1, 10)) {
      throw createError("반은 1반부터 10반까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
    }

    if (!getClassOptionsForGrade(input.grade).includes(Number(input.classNumber))) {
      throw createError("선택한 학년에 없는 반입니다.", "VALIDATION_ERROR", 400);
    }
  }
}

function isNumberInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function isValidGrade(value) {
  return value === KINDERGARTEN_GRADE || isNumberInRange(value, 1, 6);
}

function isSameSlot(reservation, input) {
  return (
    reservation.date === input.date &&
    Number(reservation.period) === Number(input.period) &&
    normalizeRoomName(reservation.room) === normalizeRoomName(input.room)
  );
}

function formatReservationOwner(reservation) {
  const grade = normalizeGradeValue(reservation.grade);
  if (grade === KINDERGARTEN_GRADE) {
    return KINDERGARTEN_GRADE;
  }

  const gradeLabel = grade === KINDERGARTEN_GRADE ? KINDERGARTEN_GRADE : `${grade}학년`;
  return `${gradeLabel} ${Number(reservation.classNumber)}반`;
}

function stripPrivateFields(reservation) {
  const { passwordHash, ...publicReservation } = reservation;
  return {
    ...publicReservation,
    room: normalizeRoomName(publicReservation.room),
    period: Number(publicReservation.period),
    grade: normalizeGradeValue(publicReservation.grade),
    classNumber: normalizeClassNumberValue(publicReservation.grade, publicReservation.classNumber)
  };
}

function withCode(error, code) {
  error.code = code;
  error.status = 500;
  return error;
}
