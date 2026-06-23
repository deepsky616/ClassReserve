import { toDateKey } from "./dateUtils.js";
import { findReservationConflict, formatReservationConflictMessage } from "./reservationConflicts.js";

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
    date: normalizeDateValue(reservation.date)
  };
}

export async function fetchReservations(options) {
  const body = await callGoogleScript({ action: "list" }, options);
  return body.reservations.map(normalizeReservation);
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

export async function createReservationAndConfirm(input, options) {
  const latestReservations = await fetchReservations(options);
  const conflict = findReservationConflict(latestReservations, input);

  if (conflict) {
    throw createClientError(
      formatReservationConflictMessage(conflict),
      "DUPLICATE_RESERVATION"
    );
  }

  const reservation = await createReservation(input, options);
  const reservations = await fetchReservations(options);

  if (!isPersistedReservation(reservation, reservations)) {
    throw createClientError(
      "예약 저장을 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
      "PERSISTENCE_UNCONFIRMED"
    );
  }

  return {
    reservation,
    reservations
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
  await deleteReservation(id, password, options);
  const reservations = await fetchReservations(options);
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
