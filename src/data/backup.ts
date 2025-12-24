import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { clearAllEntries, getAllEntriesForBackup, importEntries, JournalEntry } from './database';

export interface BackupData {
    version: string;
    exportDate: string;
    appVersion: string;
    totalEntries: number;
    entries: JournalEntry[];
}

export interface BackupPreview {
    totalEntries: number;
    exportDate: string;
    dateRange: {
        earliest: string;
        latest: string;
    };
    isValid: boolean;
    errorMessage?: string;
}

export type RestoreMode = 'merge' | 'replace';

/**
 * Export all journal entries to a JSON backup file
 */
export const exportBackup = async (): Promise<{ success: boolean; message: string; entryCount?: number }> => {
    try {
        // Get all entries
        const entries = await getAllEntriesForBackup();

        if (entries.length === 0) {
            return {
                success: false,
                message: 'No entries to backup. Create some journal entries first!',
            };
        }

        // Create backup data
        const backupData: BackupData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0',
            totalEntries: entries.length,
            entries: entries,
        };

        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        const filename = `asaro-backup-${date}.json`;
        const fileUri = FileSystem.documentDirectory + filename;

        // Write JSON to file
        await FileSystem.writeAsStringAsync(
            fileUri,
            JSON.stringify(backupData, null, 2)
        );

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: 'Save Backup File',
                UTI: 'public.json',
            });
        }

        return {
            success: true,
            message: `Backup created for ${entries.length} entries.`,
            entryCount: entries.length,
        };
    } catch (error) {
        console.error('Export backup error:', error);
        return {
            success: false,
            message: 'Failed to create backup. Please try again.',
        };
    }
};

/**
 * Validate and get preview of backup file
 */
export const getBackupPreview = async (fileUri: string): Promise<BackupPreview> => {
    try {
        // Read file
        const fileContent = await FileSystem.readAsStringAsync(fileUri);

        // Parse JSON
        const backupData: BackupData = JSON.parse(fileContent);

        // Validate structure
        if (!backupData.version || !backupData.entries || !Array.isArray(backupData.entries)) {
            return {
                totalEntries: 0,
                exportDate: '',
                dateRange: { earliest: '', latest: '' },
                isValid: false,
                errorMessage: 'Invalid backup file format',
            };
        }

        if (backupData.entries.length === 0) {
            return {
                totalEntries: 0,
                exportDate: backupData.exportDate || '',
                dateRange: { earliest: '', latest: '' },
                isValid: false,
                errorMessage: 'Backup file is empty',
            };
        }

        // Get date range
        const dates = backupData.entries
            .map(e => new Date(e.created_at))
            .sort((a, b) => a.getTime() - b.getTime());

        return {
            totalEntries: backupData.entries.length,
            exportDate: backupData.exportDate || '',
            dateRange: {
                earliest: dates[0].toLocaleDateString(),
                latest: dates[dates.length - 1].toLocaleDateString(),
            },
            isValid: true,
        };
    } catch (error) {
        console.error('Backup preview error:', error);
        return {
            totalEntries: 0,
            exportDate: '',
            dateRange: { earliest: '', latest: '' },
            isValid: false,
            errorMessage: 'Failed to read backup file. File may be corrupted.',
        };
    }
};

/**
 * Import entries from backup file
 */
export const importBackup = async (
    fileUri: string,
    mode: RestoreMode
): Promise<{ success: boolean; message: string; entryCount?: number }> => {
    try {
        // Read and parse file
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const backupData: BackupData = JSON.parse(fileContent);

        // Validate
        if (!backupData.entries || backupData.entries.length === 0) {
            return {
                success: false,
                message: 'Backup file is empty or invalid',
            };
        }

        // Import based on mode
        if (mode === 'replace') {
            // Clear all existing entries
            await clearAllEntries();
            // Import all entries from backup
            await importEntries(backupData.entries, 'replace');

            return {
                success: true,
                message: `Backup restored! ${backupData.entries.length} entries restored.`,
                entryCount: backupData.entries.length,
            };
        } else {
            // Merge mode - import and skip duplicates
            const importedCount = await importEntries(backupData.entries, 'merge');

            return {
                success: true,
                message: `Backup restored! ${importedCount} new entries added.`,
                entryCount: importedCount,
            };
        }
    } catch (error) {
        console.error('Import backup error:', error);
        return {
            success: false,
            message: 'Failed to restore backup. Please check the file and try again.',
        };
    }
};

/**
 * Pick a backup file using document picker
 */


/**
 * Pick a backup file using document picker
 */
export const pickBackupFile = async (): Promise<string | null> => {
    try {


        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/json',
            copyToCacheDirectory: true,
        });



        if (result.canceled) {
            return null;
        }

        return result.assets[0].uri;
    } catch (error) {
        console.error('Pick file error:', error);

        return null;
    }
};
