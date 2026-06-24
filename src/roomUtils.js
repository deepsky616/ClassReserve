export const ROOM_GROUPS = [
  {
    label: "1층",
    rooms: ["창의놀이실(1층)", "신체활동실(1층)"]
  },
  {
    label: "2층",
    rooms: ["AI캠퍼스(2층)", "음악실(2층)", "다모임실(2층)"]
  },
  {
    label: "3층",
    rooms: ["체육관(3층)"]
  },
  {
    label: "4층",
    rooms: ["컴퓨터실(4층)"]
  },
  {
    label: "기타",
    rooms: ["청계누리(강당)"]
  }
];

export const ROOMS = ROOM_GROUPS.flatMap((group) => group.rooms);

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
