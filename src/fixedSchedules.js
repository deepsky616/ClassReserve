import { getPeriodRange } from "./periodRange.js";
import { normalizeRoomName } from "./roomUtils.js";

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "월요일", shortLabel: "월" },
  { value: 2, label: "화요일", shortLabel: "화" },
  { value: 3, label: "수요일", shortLabel: "수" },
  { value: 4, label: "목요일", shortLabel: "목" },
  { value: 5, label: "금요일", shortLabel: "금" }
];

export function getWeekdayFromDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`).getDay();
}

export function getWeekdayLabel(weekday) {
  return WEEKDAY_OPTIONS.find((option) => option.value === Number(weekday))?.label ?? `${weekday}요일`;
}

export function normalizeFixedSchedule(fixedSchedule) {
  return {
    ...fixedSchedule,
    weekday: Number(fixedSchedule.weekday),
    period: Number(fixedSchedule.period),
    room: normalizeRoomName(fixedSchedule.room),
    label: String(fixedSchedule.label ?? "").trim()
  };
}

export function findFixedScheduleRangeConflict(fixedSchedules, input) {
  const weekday = getWeekdayFromDateKey(input.date);
  const startPeriod = input.startPeriod ?? input.period;
  const endPeriod = input.endPeriod ?? input.period;
  const periods = getPeriodRange(startPeriod, endPeriod);
  const room = normalizeRoomName(input.room);

  return fixedSchedules.find((fixedSchedule) => {
    const normalized = normalizeFixedSchedule(fixedSchedule);
    return (
      normalized.weekday === weekday &&
      periods.includes(Number(normalized.period)) &&
      normalized.room === room
    );
  }) ?? null;
}

export function formatFixedScheduleConflictMessage(fixedSchedule) {
  const normalized = normalizeFixedSchedule(fixedSchedule);
  const labelText = normalized.label ? `(${normalized.label})` : "";
  return `매주 ${getWeekdayLabel(normalized.weekday)} ${normalized.period}교시는 ${normalized.room} 고정 사용 시간${labelText}이라 예약할 수 없습니다.`;
}

export function isSameFixedScheduleSlot(left, right) {
  return (
    Number(left.weekday) === Number(right.weekday) &&
    Number(left.period) === Number(right.period) &&
    normalizeRoomName(left.room) === normalizeRoomName(right.room)
  );
}
