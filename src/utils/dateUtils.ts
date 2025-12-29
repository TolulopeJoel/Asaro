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
 * Get yesterday's date as a string in YYYY-MM-DD format (local timezone)
 */
export const getYesterdayDateString = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
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
 * Get the difference in days between two dates (local timezone)
 */
export const getDaysDifference = (date1: Date, date2: Date): number => {
    const d1 = getLocalMidnight(date1);
    const d2 = getLocalMidnight(date2);
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};


