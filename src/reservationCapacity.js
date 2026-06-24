import { normalizeRoomName } from "./roomUtils.js";

export const GYM_ROOM = "체육관";
export const DEFAULT_ROOM_RESERVATION_LIMIT = 1;
export const GYM_RESERVATION_LIMIT = 2;

export function getRoomReservationLimit(room) {
  return normalizeRoomName(room) === GYM_ROOM ? GYM_RESERVATION_LIMIT : DEFAULT_ROOM_RESERVATION_LIMIT;
}

export function isSameReservationSlot(reservation, input) {
  return (
    reservation.date === input.date &&
    Number(reservation.period) === Number(input.period) &&
    normalizeRoomName(reservation.room) === normalizeRoomName(input.room)
  );
}

export function getSameSlotReservations(reservations, input) {
  return reservations.filter((reservation) => isSameReservationSlot(reservation, input));
}

export function hasReachedReservationLimit(reservations, input) {
  return getSameSlotReservations(reservations, input).length >= getRoomReservationLimit(input.room);
}
