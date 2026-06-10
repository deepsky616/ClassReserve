async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message ?? "요청을 처리하지 못했습니다.");
    error.code = body.code;
    error.status = response.status;
    throw error;
  }

  return body;
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
