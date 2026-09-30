/**
 * Redraw the practices widget from inside the app, after a practice changes
 * here. A no-op when no widget is placed, and never throws: the widget is
 * never a reason for a tick in the app to fail.
 */
import React from 'react';
import { Platform } from 'react-native';
import { getWidgetInfo, requestPinWidget, requestWidgetUpdate } from 'react-native-android-widget';

import { PracticesWidget } from './PracticesWidget';
import { PRACTICES_WIDGET } from './practices';
import { readPractices } from './taskHandler';

export function refreshPracticesWidget(): void {
    if (Platform.OS !== 'android') return;
    requestWidgetUpdate({
        widgetName: PRACTICES_WIDGET,
        renderWidget: async () => <PracticesWidget practices={await readPractices()} />,
    }).catch(error => console.error('[widget] Failed to refresh:', error));
}

/**
 * Ask the launcher to place the widget. False when it can't ask, so the
 * caller can explain how to add it by hand. True means the launcher showed its
 * prompt, not that the widget was placed.
 */
export async function pinPracticesWidget(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
        return await requestPinWidget({ widgetName: PRACTICES_WIDGET });
    } catch {
        return false;
    }
}

/** Whether a practices widget is on the home screen now. */
export async function isPracticesWidgetPlaced(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
        return (await getWidgetInfo(PRACTICES_WIDGET)).length > 0;
    } catch {
        return false;
    }
}
