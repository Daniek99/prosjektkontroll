import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Convert a Date to a YYYY-MM-DD string in the user's local timezone.
 * Avoids the off-by-one-day bug that occurs when using `toISOString().split('T')[0]`
 * in timezones with a positive UTC offset (e.g. Europe/Oslo UTC+2), where a
 * midnight local time becomes the previous day in UTC.
 */
export function toLocalDateString(date: Date | null | undefined): string {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
