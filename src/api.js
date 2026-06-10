async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    });
  } catch (error) {
    throw createApiUnavailableError(error);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    if (!isJson) {
      throw createApiUnavailableError();
    }

    const error = new Error(body.message ?? "요청을 처리하지 못했습니다.");
    error.code = body.code;
    error.status = response.status;
    throw error;
  }

  return body;
}

function createApiUnavailableError(cause) {
  const error = new Error("저장 서버에 연결할 수 없습니다.");
  error.code = "API_UNAVAILABLE";
  error.status = 0;
  error.cause = cause;
  return error;
}

export async function fetchReservations() {
  const body = await request("/api/reservations");
  return body.reservations;
}

export async function createReservation(input) {
  const body = await request("/api/reservations", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return body.reservation;
}

export async function deleteReservation(id, password) {
  return request(`/api/reservations/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ password })
  });
}
