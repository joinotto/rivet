export function migrateBatch(rows, state, maxItems) {
  const pending = rows.filter((row) => row.id > state.cursor).slice(0, maxItems);
  for (const row of pending) {
    if (state.applied.has(row.id)) {
      throw new Error(`row ${row.id} was applied more than once`);
    }
    state.destination.set(row.id, row.value);
    state.applied.add(row.id);
    state.cursor = row.id;
  }
  return {
    processed: pending.length,
    cursor: state.cursor,
    complete: state.cursor === rows.at(-1)?.id,
  };
}
