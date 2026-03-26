/**
 * Date utility functions for consistent date handling across the app.
 * All dates are normalized to local timezone to match SQLite's 'localtime' modifier.
 */

/**
 * Get today's date as a string in YYYY-MM-DD format (local timezone)
 */
export const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Format a Date object to YYYY-MM-DD string (local timezone)
 * This matches SQLite's DATE(created_at, 'localtime') format
 */
export const formatDateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get a Date object set to midnight in local timezone
 */
export const getLocalMidnight = (date: Date = new Date()): Date => {
    const local = new Date(date);
    local.setHours(0, 0, 0, 0);
    return local;
};

/**
 * Parse a date string (YYYY-MM-DD) to a Date object at local midnight
 * Assumes the string is already in local timezone format
 */
export const parseLocalDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Check if two dates are the same day (local timezone)
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
    return formatDateToLocalString(date1) === formatDateToLocalString(date2);
};

/**
 * Get the difference in days between two dates (date2 - date1, local timezone).
 * Returns a positive number if date2 is after date1, negative if before.
 */
export const getDaysDifference = (date1: Date, date2: Date): number => {
    const d1 = getLocalMidnight(date1);
    const d2 = getLocalMidnight(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
};
