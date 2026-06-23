export const ROOMS = [
  "창의놀이실(1층)",
  "청계누리(강당)",
  "컴퓨터실(4층)",
  "AI실(2층)",
  "음악실",
  "다모임실",
  "신체활동실(1층)"
];

const ROOM_ALIASES = {
  "창의놀이실": "창의놀이실(1층)"
};

export function normalizeRoomName(room) {
  const value = String(room);
  return ROOM_ALIASES[value] ?? value;
}

export function isAllowedRoom(room) {
  return ROOMS.includes(normalizeRoomName(room));
}
