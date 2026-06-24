export const ROOMS = [
  "창의놀이실(1층)",
  "청계누리(강당)",
  "컴퓨터실(4층)",
  "AI캠퍼스(2층)",
  "음악실(2층)",
  "다모임실(2층)",
  "신체활동실(1층)",
  "체육관(3층)"
];

const ROOM_ALIASES = {
  "창의놀이실": "창의놀이실(1층)",
  "AI실": "AI캠퍼스(2층)",
  "AI실(2층)": "AI캠퍼스(2층)",
  "음악실": "음악실(2층)",
  "다모임실": "다모임실(2층)",
  "체육관": "체육관(3층)"
};

export function normalizeRoomName(room) {
  const value = String(room);
  return ROOM_ALIASES[value] ?? value;
}

export function isAllowedRoom(room) {
  return ROOMS.includes(normalizeRoomName(room));
}
