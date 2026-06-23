import { formatReservationOwner } from "./reservationLabels.js";
import { getPeriodRange } from "./periodRange.js";

export function findReservationConflict(reservations, input) {
  return reservations.find((reservation) => {
    return (
      reservation.date === input.date &&
      Number(reservation.period) === Number(input.period) &&
      reservation.room === input.room
    );
  }) ?? null;
}

export function findReservationRangeConflict(reservations, input) {
  const periods = getPeriodRange(input.startPeriod, input.endPeriod);
  return periods
    .map((period) => findReservationConflict(reservations, { ...input, period }))
    .find(Boolean) ?? null;
}

export function formatReservationConflictMessage(reservation) {
  return `이미 ${formatReservationOwner(reservation)}이 먼저 예약해서 예약할 수 없습니다.`;
}
