export const STORAGE_KEYS = {
    USER_NAME: 'user_name',
    SLEEP_TIME: 'sleep_time',
    LAST_SLEEP_CHANGE_AT: 'last_sleep_change_at',
    LAST_BACKUP_DATE: 'lastBackupDate',
    REFLECTION_DRAFT: 'reflection_draft',
    PENDING_ACTIVITIES: 'pending_firestore_activities',
    LOCKED_IN_MODE: 'locked_in_mode',
    /**
     * Which of the three styles is active. Supersedes LOCKED_IN_MODE, which is
     * still written in step so anything still reading the old boolean is right.
     */
    THEME_STYLE: 'theme_style',
} as const;
