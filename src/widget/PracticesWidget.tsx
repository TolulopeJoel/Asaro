/**
 * Today's practices on the home screen, ticked from there. Built from the
 * Today strip's rules (src/components/home/TodayStrip.tsx): headed "Today",
 * never "To do"; an 18px box filled indigo once kept; the streak in ochre
 * beside it; a kept practice dimmed and sunk to the bottom.
 *
 * It also keeps the reminders alive on Transsion phones: HiOS's freezer
 * leaves an app with a placed widget alone, and drops every other app's alarms.
 *
 * Not React: the widget library renders this tree once into Android views, so
 * no hooks, and colours are the Cloth palette's values rather than the theme's.
 */
import React from 'react';
import { FlexWidget, ListWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { cloth } from '../theme/colors';
import { TOGGLE_PRACTICE, type WidgetPractice } from './practices';

type Hex = `#${string}`;
const C = cloth as unknown as Record<keyof typeof cloth, Hex>;

const DISPLAY = 'Fraunces_700Bold';
const BODY = 'WorkSans_400Regular';
const BODY_STRONG = 'WorkSans_600SemiBold';

const TICK = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${cloth.background}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function Box({ kept }: { kept: boolean }) {
    return kept ? (
        <FlexWidget style={{ width: 18, height: 18, backgroundColor: C.textPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <SvgWidget svg={TICK} style={{ width: 11, height: 11 }} />
        </FlexWidget>
    ) : (
        <FlexWidget style={{ width: 18, height: 18, borderWidth: 1, borderColor: C.borderStrong }} />
    );
}

function Row({ practice }: { practice: WidgetPractice }) {
    return (
        <FlexWidget
            clickAction={TOGGLE_PRACTICE}
            clickActionData={{ id: practice.id, kept: practice.kept }}
            accessibilityLabel={practice.kept ? `Undo ${practice.action} for today` : `Mark ${practice.action} done for today`}
            style={{
                width: 'match_parent',
                flexDirection: 'row',
                alignItems: 'center',
                flexGap: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
            }}
        >
            <Box kept={practice.kept} />
            <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                    text={practice.action}
                    maxLines={2}
                    truncate="END"
                    style={{ fontFamily: BODY, fontSize: 14, color: practice.kept ? C.textTertiary : C.textPrimary }}
                />
            </FlexWidget>
            {practice.streak ? (
                <TextWidget text={practice.streak} style={{ fontFamily: BODY_STRONG, fontSize: 12, color: C.accent }} />
            ) : null}
        </FlexWidget>
    );
}

/** `practices` is null when they could not be read. */
export function PracticesWidget({ practices }: { practices: WidgetPractice[] | null }) {
    const kept = practices?.filter(p => p.kept).length ?? 0;
    const empty = !practices || practices.length === 0;

    return (
        <FlexWidget
            clickAction="OPEN_APP"
            style={{
                width: 'match_parent',
                height: 'match_parent',
                backgroundColor: C.background,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 6,
            }}
        >
            <FlexWidget
                clickAction="OPEN_APP"
                style={{
                    width: 'match_parent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                }}
            >
                <TextWidget text="Today" style={{ fontFamily: DISPLAY, fontSize: 20, color: C.textPrimary }} />
                {!empty && (
                    <TextWidget
                        text={kept === practices!.length ? 'All kept' : `${kept} of ${practices!.length} kept`}
                        style={{ fontFamily: BODY, fontSize: 12, color: kept === practices!.length ? C.accent : C.textSecondary }}
                    />
                )}
            </FlexWidget>

            {empty ? (
                <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', paddingTop: 12 }}>
                    <TextWidget
                        text={practices ? 'No practices yet.' : 'Open Àṣàrò to see today.'}
                        style={{ fontFamily: BODY_STRONG, fontSize: 14, color: C.textPrimary }}
                    />
                    {practices && (
                        <TextWidget
                            text="A practice comes from what you write. Add one to an entry and it shows here."
                            maxLines={3}
                            style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 4 }}
                        />
                    )}
                </FlexWidget>
            ) : (
                <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
                    {practices!.map(practice => <Row key={practice.id} practice={practice} />)}
                </ListWidget>
            )}
        </FlexWidget>
    );
}
