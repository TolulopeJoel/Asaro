/**
 * The practices widget's data: every live practice, and whether its period is
 * kept. Read the same way as Home's Today strip (src/hooks/useToday.ts), so
 * the widget and the app never disagree about a box.
 */
import { getAllActionItems } from '../data/database';
import { actionKindOf } from '../data/actionKind';
import { markPracticeDone, practiceProgress, unmarkPracticeDone } from '../data/practiceRepository';
import { practiceChanged } from '../groups/publish';
import { unwrapReferences } from '../utils/reference';

/** The widget's name in app.json's `react-native-android-widget` plugin. */
export const PRACTICES_WIDGET = 'Practices';

/** The click a practice's row sends back, with `{ id, kept }`. */
export const TOGGLE_PRACTICE = 'TOGGLE_PRACTICE';

export interface WidgetPractice {
    id: number;
    action: string;
    kept: boolean;
    /** "12d" or "3w", as the Today strip writes it; empty before the first keep. */
    streak: string;
}

export async function loadWidgetPractices(): Promise<WidgetPractice[]> {
    const all = await getAllActionItems(200);
    const out: WidgetPractice[] = [];
    for (const item of all) {
        if (item.archived_at || actionKindOf(item) !== 'practice') continue;
        const progress = await practiceProgress(item.id!, item.cadence);
        out.push({
            id: item.id!,
            action: unwrapReferences(item.action),
            kept: progress.doneNow,
            streak: progress.streak >= 1 ? `${progress.streak}${item.cadence === 'weekly' ? 'w' : 'd'}` : '',
        });
    }
    // What is still to do comes first; a kept one sinks, as on Home.
    return out.sort((a, b) => Number(a.kept) - Number(b.kept));
}

/** Tick or untick a practice for today, from the widget. */
export async function togglePracticeFromWidget(id: number, kept: boolean): Promise<void> {
    if (kept) await unmarkPracticeDone(id);
    else await markPracticeDone(id);
    void practiceChanged(id);
}
