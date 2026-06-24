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
import {
  getRoomReservationLimit,
  getSameSlotReservations
} from "../src/reservationCapacity.js";
import {
  findFixedScheduleRangeConflict,
  formatFixedScheduleConflictMessage,
  isSameFixedScheduleSlot,
  normalizeFixedSchedule
} from "../src/fixedSchedules.js";

const REQUIRED_FIELDS = ["date", "period", "room", "grade", "password"];
const KINDERGARTEN_GRADE = "유치원";

export function createReservationStore(options = {}) {
  const filePath = options.filePath ?? path.resolve("data/reservations.json");
  const fixedFilePath = options.fixedFilePath ?? path.resolve("data/fixed-schedules.json");
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => randomUUID());
  const adminPassword = options.adminPassword ?? process.env.ADMIN_DELETE_PASSWORD ?? "";

  async function readJsonFile(targetPath) {
    try {
      const content = await readFile(targetPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw withCode(error, "STORAGE_ERROR");
    }
  }

  async function writeJsonFile(targetPath, value) {
    try {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    } catch (error) {
      throw withCode(error, "STORAGE_ERROR");
    }
  }

  async function readReservations() {
    return readJsonFile(filePath);
  }

  async function writeReservations(reservations) {
    await writeJsonFile(filePath, reservations);
  }

  async function readFixedSchedules() {
    return readJsonFile(fixedFilePath);
  }

  async function writeFixedSchedules(fixedSchedules) {
    await writeJsonFile(fixedFilePath, fixedSchedules);
  }

  async function listReservations() {
    const reservations = await readReservations();
    return reservations.map(stripPrivateFields);
  }

  async function listFixedSchedules() {
    const fixedSchedules = await readFixedSchedules();
    return fixedSchedules.map(stripFixedScheduleFields).sort(sortFixedSchedules);
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

    const [reservations, fixedSchedules] = await Promise.all([
      readReservations(),
      readFixedSchedules()
    ]);
    const createdReservations = [];

    for (const input of inputs) {
      const fixedConflict = findFixedScheduleRangeConflict(fixedSchedules, {
        ...input,
        startPeriod: input.period,
        endPeriod: input.period
      });

      if (fixedConflict) {
        throw createError(
          formatFixedScheduleConflictMessage(fixedConflict),
          "FIXED_SCHEDULE_CONFLICT",
          409,
          { conflictFixedSchedule: stripFixedScheduleFields(fixedConflict) }
        );
      }

      const sameSlotReservations = getSameSlotReservations([...reservations, ...createdReservations], input);
      const duplicate = sameSlotReservations.length >= getRoomReservationLimit(input.room) ? sameSlotReservations[0] : null;

      if (duplicate) {
        throw createError(
          formatSlotConflictMessage(sameSlotReservations),
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

  async function createFixedSchedules(inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw createError("고정 사용 내용이 없습니다.", "VALIDATION_ERROR", 400);
    }

    const createdAt = now();
    inputs.forEach((input) => validateFixedScheduleInput(input, adminPassword));

    const fixedSchedules = await readFixedSchedules();
    const createdFixedSchedules = [];

    for (const input of inputs) {
      const fixedSchedule = {
        id: id(),
        weekday: Number(input.weekday),
        period: Number(input.period),
        room: normalizeRoomName(input.room),
        label: String(input.label).trim(),
        createdAt
      };
      const duplicate = [...fixedSchedules, ...createdFixedSchedules].find((item) => {
        return isSameFixedScheduleSlot(item, fixedSchedule);
      });

      if (duplicate) {
        throw createError("이미 같은 요일과 교시에 등록된 고정 사용입니다.", "DUPLICATE_FIXED_SCHEDULE", 409);
      }

      createdFixedSchedules.push(fixedSchedule);
    }

    await writeFixedSchedules([...fixedSchedules, ...createdFixedSchedules]);
    return createdFixedSchedules.map(stripFixedScheduleFields);
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

  async function deleteFixedSchedule(fixedScheduleId, password) {
    const result = await deleteFixedSchedules([fixedScheduleId], password);
    return { deleted: result.deletedCount === 1 };
  }

  async function deleteFixedSchedules(fixedScheduleIds, password) {
    verifyAdminPassword(password, adminPassword);

    if (!Array.isArray(fixedScheduleIds) || fixedScheduleIds.length === 0) {
      throw createError("삭제할 고정 사용을 선택해 주세요.", "VALIDATION_ERROR", 400);
    }

    const targetIds = [...new Set(fixedScheduleIds.map((fixedScheduleId) => String(fixedScheduleId)).filter(Boolean))];

    if (targetIds.length === 0) {
      throw createError("삭제할 고정 사용을 선택해 주세요.", "VALIDATION_ERROR", 400);
    }

    const fixedSchedules = await readFixedSchedules();
    const existingIds = new Set(fixedSchedules.map((item) => item.id));
    const missingId = targetIds.find((targetId) => !existingIds.has(targetId));

    if (missingId) {
      throw createError("고정 사용을 찾을 수 없습니다.", "NOT_FOUND", 404);
    }

    const targetIdSet = new Set(targetIds);
    await writeFixedSchedules(fixedSchedules.filter((item) => !targetIdSet.has(item.id)));

    return {
      deleted: true,
      deletedCount: targetIds.length
    };
  }

  return {
    listReservations,
    listFixedSchedules,
    createReservation,
    createReservations,
    createFixedSchedules,
    deleteReservation,
    deleteFixedSchedule,
    deleteFixedSchedules
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

function validateFixedScheduleInput(input, adminPassword) {
  if (!input) {
    throw createError("고정 사용 내용이 없습니다.", "VALIDATION_ERROR", 400);
  }

  verifyAdminPassword(input.password, adminPassword);

  const missing = ["weekday", "period", "room", "label"].filter((field) => {
    return input[field] === undefined || input[field] === null || input[field] === "";
  });

  if (missing.length > 0) {
    throw createError("고정 사용 입력을 모두 채워 주세요.", "VALIDATION_ERROR", 400);
  }

  if (!isNumberInRange(input.weekday, 1, 5)) {
    throw createError("요일은 월요일부터 금요일까지만 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isNumberInRange(input.period, 1, 6)) {
    throw createError("교시는 1교시부터 6교시까지 선택할 수 있습니다.", "VALIDATION_ERROR", 400);
  }

  if (!isAllowedRoom(input.room)) {
    throw createError("선택할 수 없는 특별실입니다.", "VALIDATION_ERROR", 400);
  }
}

function verifyAdminPassword(password, adminPassword) {
  if (!password || password !== adminPassword) {
    throw createError("관리자 비밀번호가 맞지 않습니다.", "INVALID_PASSWORD", 403);
  }
}

function isNumberInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function isValidGrade(value) {
  return value === KINDERGARTEN_GRADE || isNumberInRange(value, 1, 6);
}

function formatSlotConflictMessage(conflictingReservations) {
  const firstReservation = conflictingReservations[0];
  const extraCount = conflictingReservations.length - 1;
  const extraText = extraCount > 0 ? ` 외 ${extraCount}건` : "";
  return `이미 ${formatReservationOwner(firstReservation)}${extraText}이 먼저 예약해서 예약할 수 없습니다.`;
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

function stripFixedScheduleFields(fixedSchedule) {
  const normalized = normalizeFixedSchedule(fixedSchedule);
  return {
    id: normalized.id,
    weekday: normalized.weekday,
    period: normalized.period,
    room: normalized.room,
    label: normalized.label,
    createdAt: normalized.createdAt
  };
}

function sortFixedSchedules(left, right) {
  if (left.weekday !== right.weekday) {
    return left.weekday - right.weekday;
  }

  if (left.period !== right.period) {
    return left.period - right.period;
  }

  return left.room.localeCompare(right.room, "ko-KR");
}

function withCode(error, code) {
  error.code = code;
  error.status = 500;
  return error;
}
