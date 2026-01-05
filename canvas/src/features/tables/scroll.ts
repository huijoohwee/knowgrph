export const scrollRowToCenter = (row: HTMLTableRowElement | undefined | null) => {
  try {
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch { void 0 }
};
