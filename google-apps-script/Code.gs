const SHEET_NAME = "reservations";
const SPREADSHEET_ID_PROPERTY = "SPREADSHEET_ID";
const ALLOWED_ROOMS = ["창의놀이실", "청계누리(강당)", "컴퓨터실(4층)", "AI실(2층)", "음악실", "다모임실"];
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

  if (payload.action === "delete") {
    deleteReservation(payload.id, payload.password);
    return {
      ok: true,
      deleted: true
    };
  }

  throw createError("지원하지 않는 요청입니다.", "VALIDATION_ERROR");
}

function listReservations() {
  const sheet = getReservationSheet();
  const rows = readRows(sheet);
  return rows.map(toPublicReservation);
}

function createReservation(input) {
  validateReservation(input);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getReservationSheet();
    const rows = readRows(sheet);
    const duplicate = rows.some(function (reservation) {
      return (
        reservation.date === input.date &&
        Number(reservation.period) === Number(input.period) &&
        reservation.room === input.room
      );
    });

    if (duplicate) {
      throw createError("이미 예약된 특별실입니다.", "DUPLICATE_RESERVATION");
    }

    const reservation = {
      id: Utilities.getUuid(),
      date: input.date,
      period: Number(input.period),
      room: input.room,
      grade: Number(input.grade),
      classNumber: Number(input.classNumber),
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString()
    };

    sheet.appendRow(HEADER.map(function (key) {
      return reservation[key];
    }));

    return toPublicReservation(reservation);
  } finally {
    lock.releaseLock();
  }
}

function deleteReservation(id, password) {
  if (!id || !password) {
    throw createError("예약과 비밀번호를 확인해 주세요.", "VALIDATION_ERROR");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getReservationSheet();
    const values = sheet.getDataRange().getValues();

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const reservation = rowToReservation(row);

      if (reservation.id === id) {
        if (reservation.passwordHash !== hashPassword(password)) {
          throw createError("삭제 비밀번호가 맞지 않습니다.", "INVALID_PASSWORD");
        }

        sheet.deleteRow(rowIndex + 1);
        return;
      }
    }

    throw createError("예약을 찾을 수 없습니다.", "NOT_FOUND");
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
    date: String(row[1]),
    period: Number(row[2]),
    room: String(row[3]),
    grade: Number(row[4]),
    classNumber: Number(row[5]),
    passwordHash: String(row[6]),
    createdAt: String(row[7])
  };
}

function toPublicReservation(reservation) {
  return {
    id: reservation.id,
    date: reservation.date,
    period: Number(reservation.period),
    room: reservation.room,
    grade: Number(reservation.grade),
    classNumber: Number(reservation.classNumber),
    createdAt: reservation.createdAt
  };
}

function validateReservation(input) {
  if (!input) {
    throw createError("예약 내용이 없습니다.", "VALIDATION_ERROR");
  }

  const requiredFields = ["date", "period", "room", "grade", "classNumber", "password"];
  const missing = requiredFields.filter(function (field) {
    return input[field] === undefined || input[field] === null || input[field] === "";
  });

  if (missing.length > 0) {
    throw createError("필수 입력을 모두 채워 주세요.", "VALIDATION_ERROR");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw createError("날짜 형식이 올바르지 않습니다.", "VALIDATION_ERROR");
  }

  if (ALLOWED_ROOMS.indexOf(input.room) === -1) {
    throw createError("선택할 수 없는 특별실입니다.", "VALIDATION_ERROR");
  }

  if (!isIntegerInRange(input.period, 1, 6)) {
    throw createError("교시는 1교시부터 6교시까지 선택할 수 있습니다.", "VALIDATION_ERROR");
  }

  if (!isIntegerInRange(input.grade, 1, 6)) {
    throw createError("학년은 1학년부터 6학년까지 선택할 수 있습니다.", "VALIDATION_ERROR");
  }

  if (!isIntegerInRange(input.classNumber, 1, 10)) {
    throw createError("반은 1반부터 10반까지 선택할 수 있습니다.", "VALIDATION_ERROR");
  }
}

function isIntegerInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
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
