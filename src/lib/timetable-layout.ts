export type TimeSlot = {
  startMinute: number;
  endMinute: number;
  priority?: number;
};
export type Placed<T> = T & { column: number; columns: number };
export type Overflow = TimeSlot & {
  count: number;
  column: number;
  columns: number;
};
/** Pack half-open intervals. In the week, reserve the last lane for overflow
 * when a connected overlap cluster exceeds the limit. Expanded days are uncapped. */
export function arrangeDay<T extends TimeSlot>(events: T[], limit = 3) {
  const visible: Placed<T>[] = [];
  const overflow: Overflow[] = [];
  let cluster: T[] = [],
    end = -1;
  const finish = () => {
    if (!cluster.length) return;
    // Pack by ownership before start time, so later personal lessons also stay
    // left of earlier friends. Test every interval: priority order is not temporal.
    const packed: Placed<T>[] = [];
    for (const event of [...cluster].sort(
      (a, b) => (a.priority || 0) - (b.priority || 0),
    )) {
      let column = Math.max(
        0,
        ...packed
          .filter(
            (x) =>
              (x.priority || 0) < (event.priority || 0) &&
              x.startMinute < event.endMinute &&
              event.startMinute < x.endMinute,
          )
          .map((x) => x.column + 1),
      );
      while (
        packed.some(
          (x) =>
            x.column === column &&
            x.startMinute < event.endMinute &&
            event.startMinute < x.endMinute,
        )
      )
        column++;
      packed.push({ ...event, column, columns: 1 });
    }
    const columns = Math.max(...packed.map((x) => x.column + 1));
    const crowded = columns > limit;
    const shown = packed
      .filter((x) => !crowded || x.column < limit - 1)
      .sort((a, b) => a.startMinute - b.startMinute);
    visible.push(
      ...shown.map((x) => ({ ...x, columns: Math.min(columns, limit) })),
    );
    if (crowded)
      overflow.push({
        startMinute: cluster[0].startMinute,
        endMinute: end,
        count: cluster.length - shown.length,
        column: limit - 1,
        columns: limit,
      });
    cluster = [];
  };
  // Stable sorting lets callers prioritize their own lessons at the same time.
  for (const event of [...events].sort(
    (a, b) => a.startMinute - b.startMinute,
  )) {
    if (event.startMinute >= end) {
      finish();
      end = -1;
    }
    cluster.push(event);
    end = Math.max(end, event.endMinute);
  }
  finish();
  return { visible, overflow };
}

type JoinableSlot = TimeSlot & {
  id: string;
  cancelled?: boolean;
  draft?: boolean;
};
/** Join only identical, unobstructed lessons in adjacent people columns.
 * Separated people and concurrent lessons retain individual cards and their avatars. */
export function joinAdjacentLessons<T extends JoinableSlot>(
  lanes: Placed<T>[][],
) {
  type Card = { event: Placed<T>; lane: number; span: number };
  const cards: Card[] = [];
  const previous = new Map<string, Card>();
  lanes.forEach((events, lane) => {
    for (const event of events) {
      const key = JSON.stringify([
        event.id,
        event.startMinute,
        event.endMinute,
      ]);
      const canJoin = event.columns === 1 && !event.cancelled && !event.draft;
      const match = canJoin ? previous.get(key) : undefined;
      if (match && match.lane + match.span === lane) {
        match.span++;
      } else {
        const card = { event, lane, span: 1 };
        cards.push(card);
        if (canJoin) previous.set(key, card);
      }
    }
  });
  return cards;
}
