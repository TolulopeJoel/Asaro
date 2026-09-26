import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The local calendar date as `YYYY-MM-DD`. */
export function localDayKey(date: Date = new Date()): string {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Today's local date key, updated at midnight and whenever the app comes back
 * to the foreground. Use it as a dependency for anything that means "today".
 */
export function useLocalDay(): string {
    const [day, setDay] = useState(localDayKey);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const refresh = () => {
            setDay(localDayKey());
            if (timer) clearTimeout(timer);
            const now = new Date();
            // A second past midnight, so the new date has definitely started.
            const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
            timer = setTimeout(refresh, next.getTime() - now.getTime());
        };

        refresh();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') refresh();
        });

        return () => {
            if (timer) clearTimeout(timer);
            subscription.remove();
        };
    }, []);

    return day;
}
