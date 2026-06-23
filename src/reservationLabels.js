import { KINDERGARTEN_GRADE } from "./constants.js";

export function formatReservationOwner(reservation) {
  if (reservation.grade === KINDERGARTEN_GRADE) {
    return KINDERGARTEN_GRADE;
  }

  const grade = `${Number(reservation.grade)}학년`;
  return `${grade} ${Number(reservation.classNumber)}반`;
}
