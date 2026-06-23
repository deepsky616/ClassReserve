import { KINDERGARTEN_GRADE } from "./constants.js";

export function formatReservationOwner(reservation) {
  const grade = reservation.grade === KINDERGARTEN_GRADE ? KINDERGARTEN_GRADE : `${Number(reservation.grade)}학년`;
  return `${grade} ${Number(reservation.classNumber)}반`;
}
