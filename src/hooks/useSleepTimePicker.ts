import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { useAlert } from '../context/AlertContext';
import { setupDailyNotifications } from '../utils/notifications';

export const useSleepTimePicker = () => {
    const { showAlert } = useAlert();
    const [sleepTime, setSleepTime] = useState<string | null>(null);
    const [lastSleepChangeAt, setLastSleepChangeAt] = useState<string | null>(null);
    const [isUpdatingSleep, setIsUpdatingSleep] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEYS.SLEEP_TIME).then(val => setSleepTime(val));
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SLEEP_CHANGE_AT).then(val => setLastSleepChangeAt(val));
    }, []);

    const finalizeSleepTimeChange = async (h24: number, min: number) => {
        const now = new Date();
        const sleepDate = new Date(now);
        sleepDate.setHours(h24, min, 0, 0);

        try {
            setIsUpdatingSleep(true);
            const iso = sleepDate.toISOString();
            const nowIso = now.toISOString();

            await AsyncStorage.setItem(STORAGE_KEYS.SLEEP_TIME, iso);
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_SLEEP_CHANGE_AT, nowIso);

            setSleepTime(iso);
            setLastSleepChangeAt(nowIso);

            showAlert({
                title: 'Success! ✅',
                message: "Your sleep time has been locked in for the next month. I've adjusted your notification schedule. Don't sleep too much o!"
            });
            await setupDailyNotifications(false);
        } catch (error) {
            console.error('Failed to save sleep time:', error);
            showAlert({ title: 'Error', message: 'Failed to save your new schedule. Please try again.' });
        } finally {
            setIsUpdatingSleep(false);
        }
    };

    const pickMinute = (h24: number, hourLabel: string) => {
        showAlert({
            title: `Select Minute for ${hourLabel}`,
            message: 'Àṣàrò is waiting...',
            buttons: [
                { text: ':00', onPress: () => finalizeSleepTimeChange(h24, 0) },
                { text: ':15', onPress: () => finalizeSleepTimeChange(h24, 15) },
                { text: ':30', onPress: () => finalizeSleepTimeChange(h24, 30) },
                { text: ':45', onPress: () => finalizeSleepTimeChange(h24, 45) },
            ],
            cancelable: true
        });
    };

    const handleUpdateSleepTime = async () => {
        if (isUpdatingSleep) return;

        if (lastSleepChangeAt) {
            const lastChange = new Date(lastSleepChangeAt);
            const now = new Date();
            const diffDays = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays < 30) {
                const daysLeft = Math.ceil(30 - diffDays);
                showAlert({
                    title: 'Patience o! ✋',
                    message: `Trying to change your sleep time already? That's suspicious. You still have ${daysLeft} days to suffer your current schedule. Àṣàrò sees everything.`
                });
                return;
            }
        }

        showAlert({
            title: 'Select Sleep Hour',
            message: 'I only allow sleep after 8:00 PM. Anything earlier is just laziness! 😌',
            buttons: [
                { text: '08 PM', onPress: () => pickMinute(20, '08:00 PM') },
                { text: '09 PM', onPress: () => pickMinute(21, '09:00 PM') },
                { text: '10 PM', onPress: () => pickMinute(22, '10:00 PM') },
                { text: '11 PM', onPress: () => pickMinute(23, '11:00 PM') },
                { text: 'Cancel', style: 'cancel' }
            ],
            cancelable: true
        });
    };

    const formatSleepTime = (iso: string | null) => {
        if (!iso) return 'Not set';
        try {
            const date = new Date(iso);
            let h = date.getHours();
            const m = date.getMinutes().toString().padStart(2, '0');
            const p = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${p}`;
        } catch {
            return 'Invalid';
        }
    };

    return {
        sleepTime,
        lastSleepChangeAt,
        isUpdatingSleep,
        handleUpdateSleepTime,
        formatSleepTime,
    };
};
