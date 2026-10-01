import { Share } from 'react-native';
import type { JournalEntry } from '../data/types';
import { getEntryById } from '../data/journalRepository';
import { entryReference, entryShareText } from './entryText';

/** Share an entry from the system sheet. Read fresh, so its actions and topics always come with it. */
export async function shareEntry(entry: JournalEntry): Promise<void> {
    const full = entry.id != null && entry.id > 0 ? (await getEntryById(entry.id)) ?? entry : entry;
    await Share.share({ message: entryShareText(full), title: entryReference(full) });
}
