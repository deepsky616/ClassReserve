export const ROOM_GROUPS = [
  {
    label: "1층",
    rooms: ["창의놀이실", "신체활동실"]
  },
  {
    label: "2층",
    rooms: ["AI캠퍼스", "음악실(2층)", "다모임실"]
  },
  {
    label: "3층",
    rooms: ["청계누리(강당)", "동아리1", "동아리2"]
  },
  {
    label: "4층",
    rooms: ["컴퓨터실"]
  },
  {
    label: "5층",
    rooms: ["다목적실", "음악실"]
  }
];

export const ROOMS = ROOM_GROUPS.flatMap((group) => group.rooms);

const ROOM_ALIASES = {
  "AI실": "AI캠퍼스",
  "체육관": "청계누리(강당)",
  "음악실(2층)": "음악실(2층)",
  "음악실(5층)": "음악실"
};

export function normalizeRoomName(room) {
  const rawValue = String(room);
  const value = rawValue.replace(/\([1-5]층\)/g, "");
  return ROOM_ALIASES[rawValue] ?? ROOM_ALIASES[value] ?? value;
}

export function isAllowedRoom(room) {
  return ROOMS.includes(normalizeRoomName(room));
}
