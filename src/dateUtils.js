const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric"
});

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStartOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function addWeeks(date, amount) {
  return addDays(date, amount * 7);
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 5 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      key: toDateKey(date),
      label: DATE_FORMATTER.format(date)
    };
  });
}

export function formatWeekRange(weekStart) {
  const days = getWeekDays(weekStart);
  return `${days[0].label} - ${days[days.length - 1].label}`;
}
