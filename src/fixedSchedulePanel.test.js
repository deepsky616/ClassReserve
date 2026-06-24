import assert from "node:assert/strict";
import test from "node:test";
import {
  FIXED_SCHEDULE_PANEL_DEFAULT_OPEN,
  getFixedSchedulePanelButtonLabel,
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
