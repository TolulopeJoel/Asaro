import { useState, useCallback } from 'react';
import { useAlert } from '../context/AlertContext';
import { getAllScheduledNotifications, setupDailyNotifications, sendTestNotification } from '../utils/notifications';

export const useNotificationDebugger = () => {
    const { showAlert } = useAlert();
    const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [tapCount, setTapCount] = useState(0);

    const loadScheduledNotifications = useCallback(async () => {
        setIsLoadingNotifications(true);
        try {
            const notifications = await getAllScheduledNotifications();

            const sorted = notifications.sort((a, b) => {
                const aIsDaily = a.trigger && 'hour' in a.trigger && a.trigger.hour !== undefined;
                const bIsDaily = b.trigger && 'hour' in b.trigger && b.trigger.hour !== undefined;

                if (aIsDaily && !bIsDaily) return -1;
                if (!aIsDaily && bIsDaily) return 1;

                if (aIsDaily && bIsDaily) {
                    const aTime = (a.trigger as any).hour * 60 + (a.trigger as any).minute;
                    const bTime = (b.trigger as any).hour * 60 + (b.trigger as any).minute;
                    return aTime - bTime;
                }

                if (a.trigger && 'value' in a.trigger && b.trigger && 'value' in b.trigger) {
                    const aDate = new Date((a.trigger as any).value).getTime();
                    const bDate = new Date((b.trigger as any).value).getTime();
                    return aDate - bDate;
                }

                return 0;
            });

            setScheduledNotifications(sorted);
        } catch (error) {
            console.error('Failed to load scheduled notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
        }
    }, []);

    const handleNotificationTitleTap = useCallback(() => {
        setTapCount(prev => {
            const next = prev + 1;
            if (next >= 5) {
                setShowNotifications(true);
                loadScheduledNotifications();
            }
            return next;
        });
    }, [loadScheduledNotifications]);

    const handleTestNotification = useCallback(async () => {
        try {
            await sendTestNotification();
        } catch (error) {
            console.error('Failed to send test notification:', error);
            showAlert({ title: 'Error', message: 'Failed to send test notification.' });
        }
    }, [showAlert]);

    const handleForceReschedule = useCallback(async () => {
        setIsLoadingNotifications(true);
        try {
            const success = await setupDailyNotifications(false);
            if (success) {
                await loadScheduledNotifications();
                showAlert({ title: 'Success', message: 'Notifications have been rescheduled.' });
            } else {
                showAlert({ title: 'Error', message: 'Failed to reschedule notifications.' });
            }
        } catch (error) {
            console.error('Failed to reschedule notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
        }
    }, [loadScheduledNotifications, showAlert]);

    const formatTrigger = useCallback((trigger: any) => {
        if (!trigger) return 'None';
        if (trigger.type === 'date') {
            return new Date(trigger.value).toLocaleString();
        } else if (trigger.hour !== undefined) {
            const hour = trigger.hour.toString().padStart(2, '0');
            const minute = trigger.minute.toString().padStart(2, '0');
            return `Daily at ${hour}:${minute}${trigger.repeats ? ' (Repeating)' : ''}`;
        }
        return JSON.stringify(trigger);
    }, []);

    return {
        scheduledNotifications,
        isLoadingNotifications,
        showNotifications,
        handleNotificationTitleTap,
        handleTestNotification,
        handleForceReschedule,
        formatTrigger,
    };
};
