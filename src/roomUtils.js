export const ROOM_GROUPS = [
  {
    label: "1층",
    rooms: ["창의놀이실", "신체활동실"]
  },
  {
    label: "2층",
    rooms: ["AI캠퍼스", "음악실", "다모임실"]
  },
  {
    label: "3층",
    rooms: ["체육관"]
  },
  {
    label: "4층",
    rooms: ["컴퓨터실"]
  }
];

export const ROOMS = ROOM_GROUPS.flatMap((group) => group.rooms);

const ROOM_ALIASES = {
  "AI실": "AI캠퍼스"
};

export function normalizeRoomName(room) {
  const value = String(room).replace(/\([1-4]층\)/g, "");
  return ROOM_ALIASES[value] ?? value;
}

export function isAllowedRoom(room) {
  return ROOMS.includes(normalizeRoomName(room));
}
