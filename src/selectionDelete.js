function createValidationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  return error;
}

function byDatePeriodRoom(left, right) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  if (Number(left.period) !== Number(right.period)) {
    return Number(left.period) - Number(right.period);
  }

  return left.room.localeCompare(right.room, "ko-KR");
}

export function getSelectedReservations(reservations, selectedIds) {
  return reservations
    .filter((reservation) => selectedIds.has(reservation.id))
    .sort(byDatePeriodRoom);
}

export function validateSameDateSelection(selectedReservations) {
  if (selectedReservations.length === 0) {
    throw createValidationError("삭제할 예약을 선택해 주세요.");
  }

  const dates = new Set(selectedReservations.map((reservation) => reservation.date));

  if (dates.size > 1) {
    throw createValidationError("같은 날짜의 예약만 함께 삭제할 수 있습니다.");
  }
}

export function formatSelectedReservationSummary(selectedReservations) {
  if (selectedReservations.length === 0) {
    return "선택한 예약 0건";
  }

  const sorted = [...selectedReservations].sort(byDatePeriodRoom);
  const date = sorted[0].date;
  const groupedByRoom = new Map();

  sorted.forEach((reservation) => {
    const periods = groupedByRoom.get(reservation.room) ?? [];
    periods.push(Number(reservation.period));
    groupedByRoom.set(reservation.room, periods);
  });

  const roomSummaries = [...groupedByRoom.entries()].map(([room, periods]) => {
    const periodLabels = [...new Set(periods)]
      .sort((left, right) => left - right)
      .map((period) => `${period}교시`)
      .join(", ");
    return `${room} ${periodLabels}`;
  });

  return `${date} ${roomSummaries.join(" / ")} ${sorted.length}건`;
}
