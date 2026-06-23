import { PERIODS } from "./constants.js";

function createValidationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  return error;
}

function normalizePeriod(value) {
  const period = Number(value);

  if (!Number.isInteger(period) || !PERIODS.includes(period)) {
    throw createValidationError("교시는 1교시부터 6교시까지 선택할 수 있습니다.");
  }

  return period;
}

export function getPeriodRange(startPeriod, endPeriod) {
  const start = normalizePeriod(startPeriod);
  const end = normalizePeriod(endPeriod);

  if (end < start) {
    throw createValidationError("끝 교시는 시작 교시보다 빠를 수 없습니다.");
  }

  return PERIODS.filter((period) => period >= start && period <= end);
}

export function getPeriodRangeLabel(periods) {
  if (periods.length === 0) {
    return "";
  }

  if (periods.length === 1) {
    return `${periods[0]}교시`;
  }

  return `${periods[0]}교시~${periods.at(-1)}교시`;
}
