// Shared helpers for grouping notes by month and ISO week. Used by both the
// dashboard NotesWidget and the main Notater page so the grouping is identical.

export type MonthWeekGroup<T> = {
    key: string;
    label: string;
    weeks: Array<{ key: string; label: string; notes: T[] }>;
};

export function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function parseNoteDate(value: string): Date {
    return new Date(`${value}T00:00:00`);
}

export function groupNotesByMonthWeek<T extends { date: string }>(notes: T[]): MonthWeekGroup<T>[] {
    const months = new Map<string, {
        label: string;
        weeks: Map<string, { label: string; notes: T[] }>;
    }>();

    notes.forEach((note) => {
        const date = parseNoteDate(note.date);
        if (Number.isNaN(date.getTime())) return;

        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthLabel = capitalize(date.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }));
        const week = getISOWeek(date);
        const weekKey = `${date.getFullYear()}-W${week}`;

        if (!months.has(monthKey)) {
            months.set(monthKey, { label: monthLabel, weeks: new Map() });
        }
        const month = months.get(monthKey)!;
        if (!month.weeks.has(weekKey)) {
            month.weeks.set(weekKey, { label: `Uke ${week}`, notes: [] });
        }
        month.weeks.get(weekKey)!.notes.push(note);
    });

    return Array.from(months.entries()).map(([key, month]) => ({
        key,
        label: month.label,
        weeks: Array.from(month.weeks.entries()).map(([weekKey, week]) => ({
            key: weekKey,
            label: week.label,
            notes: week.notes,
        })),
    }));
}
