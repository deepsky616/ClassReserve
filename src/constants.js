export { ROOM_GROUPS, ROOMS } from "./roomUtils.js";

export const PERIODS = [1, 2, 3, 4, 5, 6];

export const KINDERGARTEN_GRADE = "유치원";

export const GRADES = [KINDERGARTEN_GRADE, 1, 2, 3, 4, 5, 6];

export const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const CLASS_OPTIONS_BY_GRADE = {
  [KINDERGARTEN_GRADE]: [],
  1: [1, 2, 3, 4, 5],
  2: [1, 2, 3, 4, 5],
  3: [1, 2, 3, 4, 5],
  4: [1, 2, 3, 4, 5, 6, 7],
  5: [1, 2, 3, 4, 5, 6, 7],
  6: [1, 2, 3, 4, 5, 6]
};

export const ROOM_TONE_CLASSES = {
  "창의놀이실": "tone-play",
  "신체활동실": "tone-activity",
  "AI캠퍼스": "tone-ai",
  "다모임실": "tone-meeting",
  "청계누리(강당)": "tone-gym",
  "동아리1": "tone-club",
  "동아리2": "tone-club",
  "컴퓨터실": "tone-computer",
  "다목적실": "tone-purpose",
  "음악실": "tone-music"
};

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];
