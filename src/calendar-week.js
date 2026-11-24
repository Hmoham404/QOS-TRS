// ISO weeks start on Monday; week 1 contains the year's first Thursday.
export function calendarWeekLabel(date) {
  const thursday = new Date(`${date}T12:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 3 - (thursday.getUTCDay() + 6) % 7);
  const firstDay = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1, 12));
  const week = Math.ceil(((thursday - firstDay) / 86400000 + 1) / 7);
  return `W${String(week).padStart(2, '0')}`;
}
