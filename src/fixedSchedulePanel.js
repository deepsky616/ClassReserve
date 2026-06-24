export const FIXED_SCHEDULE_PANEL_DEFAULT_OPEN = false;

export function getFixedSchedulePanelButtonLabel(isOpen) {
  return isOpen ? "설정 닫기" : "설정 열기";
}

export function getFixedSchedulePanelSummary(count) {
  return count === 0 ? "등록된 고정 사용 없음" : `등록된 고정 사용 ${count}건`;
}

export function getFixedSchedulePanelManagementHint(count) {
  if (count === 0) {
    return "등록 후 달력에서 고정 사용 일정을 확인하고 선택 삭제할 수 있습니다.";
  }

  return `등록된 고정 사용 ${count}건은 달력에 표시됩니다. 삭제할 일정은 달력에서 체크해 고정 삭제를 눌러 주세요.`;
}
