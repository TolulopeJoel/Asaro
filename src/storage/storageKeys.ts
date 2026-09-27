export const STORAGE_KEYS = {
    USER_NAME: 'user_name',
    SLEEP_TIME: 'sleep_time',
    LAST_SLEEP_CHANGE_AT: 'last_sleep_change_at',
    LAST_BACKUP_DATE: 'lastBackupDate',
    REFLECTION_DRAFT: 'reflection_draft',
    PENDING_ACTIVITIES: 'pending_firestore_activities',
    /** Which style is active. */
    THEME_STYLE: 'theme_style',
    /** Which look of Àṣàrò the reader chose. */
    ASARO_LOOK: 'asaro_look',
    /** Which tree each practice grows, by action item id. Kept so a tree never changes. */
    GROVE_SPECIES: 'grove_species',
    /** Anniversaries already marked, as `practiceId:m6` or `practiceId:y1`, so each is said once. */
    GROVE_MOMENTS: 'grove_moments',
    /** Set when the user chose to go on without lifting battery optimisation. */
    BATTERY_GATE_SKIPPED: 'battery_gate_skipped',
    /** Group milestones already dealt with, per uid, so each is posted once. */
    GROUP_MILESTONES: 'group_milestones',
    /** Nudges sent, per uid, as `toUid_weekKey`. */
    GROUP_NUDGES_SENT: 'group_nudges_sent',
    /** Entries already added to each group's weekly reads counter, per uid. */
    GROUP_COUNTED: 'group_counted',
    /** `uid:YYYY-MM-DD` of the last daily groups upkeep. */
    GROUP_UPKEEP: 'group_upkeep',
    /** Set once the first-visit note on a group has been dismissed. */
    GROUP_INTRO_SEEN: 'group_intro_seen',
} as const;
