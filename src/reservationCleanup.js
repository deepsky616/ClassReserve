function getSlotKey(reservation) {
  return [
    reservation.date,
    Number(reservation.period),
    reservation.room
  ].join("|");
}

function getCreatedAtTime(reservation) {
  const time = Date.parse(reservation.createdAt);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function byFirstCreatedThenInputOrder(left, right) {
  const createdAtDiff = getCreatedAtTime(left.reservation) - getCreatedAtTime(right.reservation);

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.index - right.index;
}

export function getDuplicateReservationGroups(reservations) {
  const grouped = new Map();

  reservations.forEach((reservation, index) => {
    const key = getSlotKey(reservation);
    const group = grouped.get(key) ?? [];
    group.push({ reservation, index });
    grouped.set(key, group);
  });

  return [...grouped.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const sorted = [...group].sort(byFirstCreatedThenInputOrder).map((entry) => entry.reservation);
      const keeper = sorted[0];

      return {
        key,
        date: keeper.date,
        period: Number(keeper.period),
        room: keeper.room,
        keeper,
        duplicates: sorted.slice(1),
        reservations: sorted
      };
    })
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      if (left.period !== right.period) {
        return left.period - right.period;
      }

      return left.room.localeCompare(right.room, "ko-KR");
    });
}

export function getDuplicateReservationsToDelete(reservations) {
  return getDuplicateReservationGroups(reservations).flatMap((group) => group.duplicates);
}
