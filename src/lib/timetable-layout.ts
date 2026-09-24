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
  let cluster: Placed<T>[] = [],
    end = -1;
  const finish = () => {
    if (!cluster.length) return;
    const columns = Math.max(...cluster.map((x) => x.column + 1));
    const crowded = columns > limit;
    const shown: Placed<T>[] = [];
    if (crowded) {
      // Keep the user's lessons first, including those starting after overlays.
      // Packing the compact lanes again avoids hiding them behind earlier friends.
      for (const event of [...cluster].sort(
        (a, b) => (a.priority || 0) - (b.priority || 0),
      )) {
        let column = 0;
        while (
          column < limit - 1 &&
          shown.some(
            (x) =>
              x.column === column &&
              x.startMinute < event.endMinute &&
              event.startMinute < x.endMinute,
          )
        )
          column++;
        if (column < limit - 1) shown.push({ ...event, column });
      }
      shown.sort((a, b) => a.startMinute - b.startMinute);
    } else shown.push(...cluster);
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
    const used = new Set(
      cluster
        .filter((x) => x.endMinute > event.startMinute)
        .map((x) => x.column),
    );
    let column = 0;
    while (used.has(column)) column++;
    cluster.push({ ...event, column, columns: 1 });
    end = Math.max(end, event.endMinute);
  }
  finish();
  return { visible, overflow };
}
