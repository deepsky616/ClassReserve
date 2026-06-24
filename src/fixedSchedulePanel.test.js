import assert from "node:assert/strict";
import test from "node:test";
import {
  FIXED_SCHEDULE_PANEL_DEFAULT_OPEN,
  getFixedSchedulePanelButtonLabel,
  getFixedSchedulePanelManagementHint,
  getFixedSchedulePanelSummary
} from "./fixedSchedulePanel.js";

test("고정 사용 설정 패널은 기본으로 닫혀 있다", () => {
  assert.equal(FIXED_SCHEDULE_PANEL_DEFAULT_OPEN, false);
});

test("고정 사용 설정 패널 버튼 문구를 상태에 맞게 만든다", () => {
  assert.equal(getFixedSchedulePanelButtonLabel(false), "설정 열기");
  assert.equal(getFixedSchedulePanelButtonLabel(true), "설정 닫기");
});

test("고정 사용 등록 건수 요약을 만든다", () => {
  assert.equal(getFixedSchedulePanelSummary(0), "등록된 고정 사용 없음");
  assert.equal(getFixedSchedulePanelSummary(3), "등록된 고정 사용 3건");
});

test("고정 사용 관리는 달력에서 하도록 안내한다", () => {
  assert.equal(
    getFixedSchedulePanelManagementHint(0),
    "등록 후 달력에서 고정 사용 일정을 확인하고 선택 삭제할 수 있습니다."
  );
  assert.equal(
    getFixedSchedulePanelManagementHint(3),
    "등록된 고정 사용 3건은 달력에 표시됩니다. 삭제할 일정은 달력에서 체크해 고정 삭제를 눌러 주세요."
  );
});
