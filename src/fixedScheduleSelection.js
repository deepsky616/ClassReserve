import { getWeekdayLabel } from "./fixedSchedules.js";

export function getSelectedFixedSchedules(fixedSchedules, selectedIds) {
  return fixedSchedules
    .filter((fixedSchedule) => selectedIds.has(fixedSchedule.id))
    .sort((left, right) => {
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }

      if (left.room !== right.room) {
        return left.room.localeCompare(right.room, "ko-KR");
      }

      return left.period - right.period;
    });
}

export function formatSelectedFixedScheduleSummary(fixedSchedules) {
  const groups = fixedSchedules.reduce((result, fixedSchedule) => {
    const key = `${fixedSchedule.weekday}-${fixedSchedule.room}`;
    const existingGroup = result.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.periods.push(fixedSchedule.period);
      return result;
    }

    result.push({
      key,
      weekday: fixedSchedule.weekday,
      room: fixedSchedule.room,
      periods: [fixedSchedule.period]
    });
    return result;
  }, []);

  const firstGroup = groups[0];
  const periods = firstGroup.periods.map((period) => `${period}교시`).join(", ");
  const firstSummary = `${getWeekdayLabel(firstGroup.weekday)} ${firstGroup.room} ${periods}`;

  if (groups.length === 1) {
    return `${firstSummary} 고정 사용 ${fixedSchedules.length}건`;
  }

  return `${firstSummary} 외 ${groups.length - 1}묶음 고정 사용 ${fixedSchedules.length}건`;
}
