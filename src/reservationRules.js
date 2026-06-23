import { CLASS_OPTIONS_BY_GRADE, CLASSES, KINDERGARTEN_GRADE } from "./constants.js";
import { addDays, toDateKey } from "./dateUtils.js";

export const RESERVATION_WINDOW_DAYS = 56;

export function normalizeGradeValue(grade) {
  return grade === KINDERGARTEN_GRADE ? KINDERGARTEN_GRADE : Number(grade);
}

export function getClassOptionsForGrade(grade) {
  const normalizedGrade = normalizeGradeValue(grade);
  return CLASS_OPTIONS_BY_GRADE[normalizedGrade] ?? CLASSES;
}

export function getMaxReservationDateKey(baseDate = new Date()) {
  return toDateKey(addDays(baseDate, RESERVATION_WINDOW_DAYS));
}

export function getReservationDateRange(baseDate = new Date()) {
  return {
    min: toDateKey(baseDate),
    max: getMaxReservationDateKey(baseDate)
  };
}

export function isDateInReservationWindow(dateKey, baseDate = new Date()) {
  const range = getReservationDateRange(baseDate);
  return dateKey >= range.min && dateKey <= range.max;
}
