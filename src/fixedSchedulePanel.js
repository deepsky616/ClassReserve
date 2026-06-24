export const FIXED_SCHEDULE_PANEL_DEFAULT_OPEN = false;

export function getFixedSchedulePanelButtonLabel(isOpen) {
  return isOpen ? "설정 닫기" : "설정 열기";
}

export function getFixedSchedulePanelSummary(count) {
  return count === 0 ? "등록된 고정 사용 없음" : `등록된 고정 사용 ${count}건`;
}
