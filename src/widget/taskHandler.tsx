/**
 * What Android asks of the practices widget: draw it when it is placed,
 * resized or due its hourly refresh (the new day's boxes), and tick a
 * practice when its row is tapped. It can run with the app closed, so it opens
 * the database itself. Registered in index.ts, before the app.
 */
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { initializeDatabase } from '../data/database';
import { PracticesWidget } from './PracticesWidget';
import { PRACTICES_WIDGET, TOGGLE_PRACTICE, loadWidgetPractices, togglePracticeFromWidget } from './practices';

/** Today's practices, or null if the journal could not be read. */
export async function readPractices() {
    try {
        if (!(await initializeDatabase())) return null;
        return await loadWidgetPractices();
    } catch (error) {
        console.error('[widget] Failed to read practices:', error);
        return null;
    }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
    if (widgetInfo.widgetName !== PRACTICES_WIDGET || widgetAction === 'WIDGET_DELETED') return;

    if (widgetAction === 'WIDGET_CLICK' && clickAction === TOGGLE_PRACTICE) {
        const id = Number(clickActionData?.id);
        if (Number.isFinite(id)) {
            try {
                if (await initializeDatabase()) await togglePracticeFromWidget(id, clickActionData?.kept === true);
            } catch (error) {
                console.error('[widget] Failed to tick a practice:', error);
            }
        }
    }

    renderWidget(<PracticesWidget practices={await readPractices()} />);
}
