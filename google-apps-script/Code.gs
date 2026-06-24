const SHEET_NAME = "reservations";
const SPREADSHEET_ID_PROPERTY = "SPREADSHEET_ID";
const ADMIN_DELETE_PASSWORD_PROPERTY = "ADMIN_DELETE_PASSWORD";
const ALLOWED_ROOMS = ["창의놀이실(1층)", "청계누리(강당)", "컴퓨터실(4층)", "AI실(2층)", "음악실", "다모임실", "신체활동실(1층)"];
const ROOM_ALIASES = {
  "창의놀이실": "창의놀이실(1층)"
};
const KINDERGARTEN_GRADE = "유치원";
const RESERVATION_WINDOW_DAYS = 56;
const CLASS_OPTIONS_BY_GRADE = {
  "유치원": [],
  "1": [1, 2, 3, 4, 5],
  "2": [1, 2, 3, 4, 5],
  "3": [1, 2, 3, 4, 5],
  "4": [1, 2, 3, 4, 5, 6, 7],
  "5": [1, 2, 3, 4, 5, 6, 7],
  "6": [1, 2, 3, 4, 5, 6]
};
const HEADER = ["id", "date", "period", "room", "grade", "classNumber", "passwordHash", "createdAt"];

function doGet(e) {
  const parameter = e && e.parameter ? e.parameter : {};
  const callback = sanitizeCallback(parameter.callback);

  try {
    const payload = parsePayload(parameter.payload);
    const result = handleAction(payload);
    return jsonp(callback, result);
  } catch (error) {
    return jsonp(callback, {
      ok: false,
      code: error.code || "SERVER_ERROR",
      message: error.message || "요청을 처리하지 못했습니다."
    });
  }
}

function testListReservations() {
  return handleAction({ action: "list" });
}

function handleAction(payload) {
  if (!payload || !payload.action) {
    throw createError("요청 종류가 없습니다.", "VALIDATION_ERROR");
  }

  if (payload.action === "list") {
    return {
      ok: true,
      reservations: listReservations()
    };
  }

  if (payload.action === "create") {
    return {
      ok: true,
      reservation: createReservation(payload.reservation)
    };
  }

  if (payload.action === "createMany") {
    return {
      ok: true,
      reservations: createReservations(payload.reservations)
    };
  }

  if (payload.action === "createManyAndList") {
    return createManyAndList(payload.reservations);
  }

  if (payload.action === "delete") {
    deleteReservation(payload.id, payload.password);
    return {
      ok: true,
      deleted: true
    };
  }

  if (payload.action === "deleteManyAndList") {
    return deleteManyAndList(payload.ids, payload.password);
  }

  throw createError("지원하지 않는 요청입니다.", "VALIDATION_ERROR");
}

function listReservations() {
  const sheet = getReservationSheet();
  const rows = readRows(sheet);
  return rows.map(toPublicReservation);
}

function createReservation(input) {
  return createReservations([input])[0];
}

function createManyAndList(inputs) {
  const createdReservations = createReservations(inputs);

  return {
    ok: true,
    createdReservations: createdReservations,
    reservations: listReservations()
  };
}

function createReservations(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw createError("예약 내용이 없습니다.", "VALIDATION_ERROR");
  }

  inputs.forEach(validateReservation);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getReservationSheet();
    const rows = readRows(sheet);
    const createdAt = new Date().toISOString();
    const createdReservations = [];

    inputs.forEach(function (input) {
      const duplicate = rows.concat(createdReservations).find(function (reservation) {
        return isSameSlot(reservation, input);
      });

      if (duplicate) {
        throw createError("이미 " + formatReservationOwner(duplicate) + "이 먼저 예약해서 예약할 수 없습니다.", "DUPLICATE_RESERVATION");
      }

      createdReservations.push({
        id: Utilities.getUuid(),
        date: input.date,
        period: Number(input.period),
        room: normalizeRoomName(input.room),
        grade: normalizeGrade(input.grade),
        classNumber: normalizeClassNumber(input.grade, input.classNumber),
        passwordHash: hashPassword(input.password),
        createdAt: createdAt
      });
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, createdReservations.length, HEADER.length)
      .setValues(createdReservations.map(function (reservation) {
        return HEADER.map(function (key) {
          return reservation[key];
        });
      }));

    return createdReservations.map(toPublicReservation);
  } finally {
    lock.releaseLock();
  }
}

function deleteReservation(id, password) {
  deleteReservations([id], password);
}

function deleteManyAndList(ids, password) {
  const result = deleteReservations(ids, password);

  return {
    ok: true,
    deleted: true,
    deletedCount: result.deletedCount,
    reservations: listReservations()
  };
}

function deleteReservations(ids, password) {
  if (!Array.isArray(ids) || ids.length === 0 || !password) {
    throw createError("예약과 비밀번호를 확인해 주세요.", "VALIDATION_ERROR");
  }

  const targetIds = [];
  ids.forEach(function (id) {
    const value = String(id);
    if (value && targetIds.indexOf(value) === -1) {
      targetIds.push(value);
    }
  });

  if (targetIds.length === 0) {
    throw createError("예약과 비밀번호를 확인해 주세요.", "VALIDATION_ERROR");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getReservationSheet();
    const values = sheet.getDataRange().getValues();
    const rowsToDelete = [];

    targetIds.forEach(function (id) {
      let matchedRowNumber = null;
      let matchedReservation = null;

      for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex];
        const reservation = rowToReservation(row);

        if (reservation.id === id) {
          matchedRowNumber = rowIndex + 1;
          matchedReservation = reservation;
          break;
        }
      }

      if (!matchedReservation) {
        throw createError("예약을 찾을 수 없습니다.", "NOT_FOUND");
      }

      if (matchedReservation.passwordHash !== hashPassword(password) && password !== getAdminDeletePassword()) {
        throw createError("삭제 비밀번호가 맞지 않습니다.", "INVALID_PASSWORD");
      }

      rowsToDelete.push(matchedRowNumber);
    });

    rowsToDelete.sort(function (left, right) {
      return right - left;
    }).forEach(function (rowNumber) {
      sheet.deleteRow(rowNumber);
    });

    return {
      deletedCount: rowsToDelete.length
    };
  } finally {
    lock.releaseLock();
  }
}

function getReservationSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);

  if (!spreadsheetId) {
    throw createError("시트 식별값이 설정되지 않았습니다.", "CONFIG_MISSING");
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeader(sheet);
  return sheet;
}

function ensureHeader(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADER.length).getValues()[0];
  const hasHeader = HEADER.every(function (name, index) {
    return firstRow[index] === name;
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  }

  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
}

function readRows(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, HEADER.length)
    .getValues()
    .filter(function (row) {
      return row[0];
    })
    .map(rowToReservation);
}

function rowToReservation(row) {
  return {
    id: String(row[0]),
    date: normalizeDate(row[1]),
    period: Number(row[2]),
    room: normalizeRoomName(row[3]),
    grade: normalizeGrade(row[4]),
    classNumber: normalizeClassNumber(row[4], row[5]),
    passwordHash: String(row[6]),
    createdAt: String(row[7])
  };
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return formatDateKey(value);
  }

  const parsedDate = new Date(value);
  if (!isNaN(parsedDate.getTime())) {
    return formatDateKey(parsedDate);
  }

  return String(value);
}

function toPublicReservation(reservation) {
  return {
    id: reservation.id,
    date: reservation.date,
    period: Number(reservation.period),
    room: normalizeRoomName(reservation.room),
    grade: normalizeGrade(reservation.grade),
    classNumber: normalizeClassNumber(reservation.grade, reservation.classNumber),
    createdAt: reservation.createdAt
  };
}

function validateReservation(input) {
  if (!input) {
    throw createError("예약 내용이 없습니다.", "VALIDATION_ERROR");
  }

  const requiredFields = ["date", "period", "room", "grade", "password"];
  const missing = requiredFields.filter(function (field) {
    return input[field] === undefined || input[field] === null || input[field] === "";
  });

  if (missing.length > 0) {
    throw createError("필수 입력을 모두 채워 주세요.", "VALIDATION_ERROR");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw createError("날짜 형식이 올바르지 않습니다.", "VALIDATION_ERROR");
  }

  if (!isDateInReservationWindow(input.date)) {
    throw createError("예약 날짜는 오늘부터 8주 뒤까지만 선택할 수 있습니다.", "VALIDATION_ERROR");
  }

  if (ALLOWED_ROOMS.indexOf(normalizeRoomName(input.room)) === -1) {
    throw createError("선택할 수 없는 특별실입니다.", "VALIDATION_ERROR");
  }

  if (!isIntegerInRange(input.period, 1, 6)) {
    throw createError("교시는 1교시부터 6교시까지 선택할 수 있습니다.", "VALIDATION_ERROR");
  }

  if (!isValidGrade(input.grade)) {
    throw createError("학년은 유치원 또는 1학년부터 6학년까지 선택할 수 있습니다.", "VALIDATION_ERROR");
  }

  if (!isKindergartenGrade(input.grade)) {
    if (input.classNumber === undefined || input.classNumber === null || input.classNumber === "") {
      throw createError("반을 선택해 주세요.", "VALIDATION_ERROR");
    }

    if (!isIntegerInRange(input.classNumber, 1, 10)) {
      throw createError("반은 1반부터 10반까지 선택할 수 있습니다.", "VALIDATION_ERROR");
    }

    if (getClassOptionsForGrade(input.grade).indexOf(Number(input.classNumber)) === -1) {
      throw createError("선택한 학년에 없는 반입니다.", "VALIDATION_ERROR");
    }
  }
}

function isIntegerInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function isValidGrade(value) {
  return value === KINDERGARTEN_GRADE || isIntegerInRange(value, 1, 6);
}

function isSameSlot(reservation, input) {
  return (
    reservation.date === input.date &&
    Number(reservation.period) === Number(input.period) &&
    normalizeRoomName(reservation.room) === normalizeRoomName(input.room)
  );
}

function normalizeRoomName(room) {
  const value = String(room);
  return ROOM_ALIASES[value] || value;
}

function isKindergartenGrade(value) {
  return normalizeGrade(value) === KINDERGARTEN_GRADE;
}

function normalizeGrade(value) {
  return value === KINDERGARTEN_GRADE ? KINDERGARTEN_GRADE : Number(value);
}

function normalizeClassNumber(grade, classNumber) {
  if (isKindergartenGrade(grade)) {
    return null;
  }

  return Number(classNumber);
}

function getClassOptionsForGrade(grade) {
  const normalizedGrade = normalizeGrade(grade);
  return CLASS_OPTIONS_BY_GRADE[String(normalizedGrade)] || CLASS_OPTIONS_BY_GRADE[KINDERGARTEN_GRADE];
}

function isDateInReservationWindow(dateKey) {
  const todayKey = formatDateKey(new Date());
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + RESERVATION_WINDOW_DAYS);
  const maxDateKey = formatDateKey(maxDate);
  return dateKey >= todayKey && dateKey <= maxDateKey;
}

function formatDateKey(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getAdminDeletePassword() {
  return PropertiesService.getScriptProperties().getProperty(ADMIN_DELETE_PASSWORD_PROPERTY) || "";
}

function formatReservationOwner(reservation) {
  const grade = normalizeGrade(reservation.grade);
  if (grade === KINDERGARTEN_GRADE) {
    return KINDERGARTEN_GRADE;
  }

  return grade + "학년 " + Number(reservation.classNumber) + "반";
}

function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function parsePayload(payload) {
  if (!payload) {
    throw createError("요청 내용이 없습니다.", "VALIDATION_ERROR");
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    throw createError("요청 내용을 읽을 수 없습니다.", "VALIDATION_ERROR");
  }
}

function sanitizeCallback(callback) {
  if (!callback || !/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    return "callback";
  }

  return callback;
}

function jsonp(callback, body) {
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(body) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function createError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
