import { toDateKey } from "./dateUtils.js";
import { normalizeRoomName } from "./roomUtils.js";
import { getPeriodRange } from "./periodRange.js";
import { normalizeFixedSchedule } from "./fixedSchedules.js";

const DEFAULT_TIMEOUT_MS = 15000;

function getConfiguredScriptUrl(options = {}) {
  return options.scriptUrl ?? import.meta.env?.VITE_GOOGLE_SCRIPT_URL ?? "";
}

function callGoogleScript(payload, options = {}) {
  const scriptUrl = getConfiguredScriptUrl(options);

  if (!scriptUrl) {
    throw createClientError(
      "구글 앱스 스크립트 주소가 설정되지 않았습니다.",
      "CONFIG_MISSING"
    );
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__classReserveCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(scriptUrl);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("payload", JSON.stringify(payload));

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(createClientError("구글 앱스 스크립트 응답 시간이 초과되었습니다.", "GOOGLE_SCRIPT_UNAVAILABLE"));
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    window[callbackName] = (body) => {
      cleanup();

      if (!body?.ok) {
        reject(createClientError(body?.message ?? "요청을 처리하지 못했습니다.", body?.code ?? "GOOGLE_SCRIPT_ERROR"));
        return;
      }

      resolve(body);
    };

    script.onerror = () => {
      cleanup();
      reject(createClientError("구글 앱스 스크립트에 연결할 수 없습니다.", "GOOGLE_SCRIPT_UNAVAILABLE"));
    };

    script.src = url.toString();
    document.body.appendChild(script);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove?.();
    }
  });
}

function createClientError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.status = 0;
  return error;
}

function isPersistedReservation(reservation, reservations) {
  return reservations.some((item) => {
    return (
      item.id === reservation.id ||
      (
        item.date === reservation.date &&
        Number(item.period) === Number(reservation.period) &&
        item.room === reservation.room
      )
    );
  });
}

function isPersistedFixedSchedule(fixedSchedule, fixedSchedules) {
  return fixedSchedules.some((item) => {
    return (
      item.id === fixedSchedule.id ||
      (
        Number(item.weekday) === Number(fixedSchedule.weekday) &&
        Number(item.period) === Number(fixedSchedule.period) &&
        item.room === fixedSchedule.room
      )
    );
  });
}

function normalizeDateValue(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return toDateKey(date);
  }

  return value;
}

function normalizeReservation(reservation) {
  return {
    ...reservation,
    date: normalizeDateValue(reservation.date),
    room: normalizeRoomName(reservation.room)
  };
}

export async function fetchReservations(options) {
  const body = await callGoogleScript({ action: "list" }, options);
  return body.reservations.map(normalizeReservation);
}

export async function fetchFixedSchedules(options) {
  const body = await callGoogleScript({ action: "listFixedSchedules" }, options);
  return body.fixedSchedules.map(normalizeFixedSchedule);
}

export async function createReservation(input, options) {
  const body = await callGoogleScript(
    {
      action: "create",
      reservation: input
    },
    options
  );
  return normalizeReservation(body.reservation);
}

export async function createReservations(inputs, options) {
  const body = await callGoogleScript(
    {
      action: "createMany",
      reservations: inputs
    },
    options
  );
  return body.reservations.map(normalizeReservation);
}

export async function createReservationsAndList(inputs, options) {
  const body = await callGoogleScript(
    {
      action: "createManyAndList",
      reservations: inputs
    },
    options
  );

  return {
    createdReservations: body.createdReservations.map(normalizeReservation),
    reservations: body.reservations.map(normalizeReservation)
  };
}

export async function createFixedSchedulesAndList(inputs, options) {
  const body = await callGoogleScript(
    {
      action: "createFixedSchedulesAndList",
      fixedSchedules: inputs
    },
    options
  );

  return {
    createdFixedSchedules: body.createdFixedSchedules.map(normalizeFixedSchedule),
    fixedSchedules: body.fixedSchedules.map(normalizeFixedSchedule)
  };
}

function confirmCreatedReservations(createdReservations, reservations) {
  const hasUnconfirmedReservation = createdReservations.some((reservation) => {
    return !reservation || !isPersistedReservation(reservation, reservations);
  });

  if (hasUnconfirmedReservation) {
    throw createClientError(
      "예약 저장을 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
      "PERSISTENCE_UNCONFIRMED"
    );
  }
}

function confirmCreatedFixedSchedules(createdFixedSchedules, fixedSchedules) {
  const hasUnconfirmedFixedSchedule = createdFixedSchedules.some((fixedSchedule) => {
    return !fixedSchedule || !isPersistedFixedSchedule(fixedSchedule, fixedSchedules);
  });

  if (hasUnconfirmedFixedSchedule) {
    throw createClientError(
      "고정 사용 저장을 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
      "PERSISTENCE_UNCONFIRMED"
    );
  }
}

export async function createReservationAndConfirm(input, options) {
  const result = await createReservationsAndList([input], options);
  const reservation = result.createdReservations[0];

  confirmCreatedReservations([reservation], result.reservations);

  return {
    reservation,
    reservations: result.reservations
  };
}

export async function createReservationRangeAndConfirm(input, options) {
  const periods = getPeriodRange(input.startPeriod, input.endPeriod);
  const reservationInputs = periods.map((period) => {
    const { startPeriod, endPeriod, ...reservationInput } = input;
    return {
      ...reservationInput,
      period
    };
  });
  const result = await createReservationsAndList(reservationInputs, options);
  confirmCreatedReservations(result.createdReservations, result.reservations);

  return {
    createdReservations: result.createdReservations,
    reservations: result.reservations
  };
}

export async function createFixedScheduleRangeAndConfirm(input, options) {
  const periods = getPeriodRange(input.startPeriod, input.endPeriod);
  const fixedScheduleInputs = periods.map((period) => {
    const { startPeriod, endPeriod, ...fixedScheduleInput } = input;
    return {
      ...fixedScheduleInput,
      period
    };
  });
  const result = await createFixedSchedulesAndList(fixedScheduleInputs, options);
  confirmCreatedFixedSchedules(result.createdFixedSchedules, result.fixedSchedules);

  return {
    createdFixedSchedules: result.createdFixedSchedules,
    fixedSchedules: result.fixedSchedules
  };
}

export async function deleteReservation(id, password, options) {
  return callGoogleScript(
    {
      action: "delete",
      id,
      password
    },
    options
  );
}

export async function deleteReservationAndConfirm(id, password, options) {
  const result = await deleteReservationsAndList([id], password, options);
  const reservations = result.reservations;
  const stillExists = reservations.some((reservation) => reservation.id === id);

  if (stillExists) {
    throw createClientError(
      "예약 삭제를 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
      "DELETE_UNCONFIRMED"
    );
  }

  return {
    deleted: true,
    reservations
  };
}

export async function deleteReservationsAndConfirm(ids, password, options) {
  const result = await deleteReservationsAndList(ids, password, options);
  const reservations = result.reservations;
  const deletedIds = new Set(ids);
  const stillExists = reservations.some((reservation) => deletedIds.has(reservation.id));

  if (stillExists) {
    throw createClientError(
      "예약 삭제를 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
      "DELETE_UNCONFIRMED"
    );
  }

  return {
    deleted: true,
    deletedCount: result.deletedCount,
    reservations
  };
}

export async function deleteReservationsAndList(ids, password, options) {
  const body = await callGoogleScript(
    {
      action: "deleteManyAndList",
      ids,
      password
    },
    options
  );

  return {
    deleted: true,
    deletedCount: body.deletedCount,
    reservations: body.reservations.map(normalizeReservation)
  };
}

export async function deleteFixedScheduleAndConfirm(id, password, options) {
  const result = await deleteFixedSchedulesAndConfirm([id], password, options);

  return {
    deleted: result.deleted,
    fixedSchedules: result.fixedSchedules
  };
}

export async function deleteFixedSchedulesAndConfirm(ids, password, options) {
  const body = await callGoogleScript(
    {
      action: "deleteFixedSchedulesAndList",
      ids,
      password
    },
    options
  );
  const fixedSchedules = body.fixedSchedules.map(normalizeFixedSchedule);
  const deletedIds = new Set(ids);
  const stillExists = fixedSchedules.some((fixedSchedule) => deletedIds.has(fixedSchedule.id));

  if (stillExists) {
    throw createClientError(
      "고정 사용 삭제를 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
      "DELETE_UNCONFIRMED"
    );
  }

  return {
    deleted: true,
    deletedCount: body.deletedCount,
    fixedSchedules
  };
}
