import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Text } from '@/src/components/ui';
import { Hero, Screen } from '@/src/components/ui';

export default function AboutGroupsScreen() {
    const { colors, isLockedIn } = useTheme();

    // Eight feature cards used to carry eight iOS system hues. The series is a
    // short ordered set that belongs to whichever style is active, so it wraps
    // rather than reaching outside the palette for more colours.
    const hue = (i: number) => colors.series[i % colors.series.length];
    const router = useRouter();

    const styles = getStyles(colors);

    const sections = [
        {
            title: 'THE IRON MAN RULE',
            subtitle: 'Earn your stripes',
            description: '21 days of reading in a month and you earn Admin. Not 20. Not "almost." This is for people who are actually reading their Bible — not just keeping up appearances.',
            colorIndex: 0,
        },
        {
            title: 'ADMIN PRIVILEGES',
            subtitle: 'What you unlock',
            description: 'As Admin, you keep the group alive: updating the name, refreshing the description, and dropping the Monthly Broadcast to ginger everyone back into their reading.',
            colorIndex: 1,
        },
        {
            title: "WE'VE GOT YOU",
            subtitle: 'Nobody left behind',
            description: "Gone quiet for a while? Your group gets a nudge to check on you. Because growth isn't a solo thing — we're all in this together.",
            colorIndex: 2,
        },
        {
            title: 'A FRESH START',
            subtitle: 'Every month, a new chance',
            description: "Roles and stats reset for everyone on the 1st. Last month wasn't your best? Oya, wipe your eyes. This one is a clean slate.",
            colorIndex: 3,
        },
        {
            title: 'WE FALL TO RISE AGAIN',
            subtitle: 'Grace, not disgrace',
            description: "Miss your 21-day streak and Àṣàrò moves you back to Member on the 1st. No shame in it. Every Admin has been there. Just come back stronger.",
            colorIndex: 4,
        },
        {
            title: 'THE OPEN DOOR',
            subtitle: 'Space for those who show up',
            description: "37 days of silence and Àṣàrò quietly steps back, freeing up space for readers who are ready. Whenever you're ready to return, the door is open.",
            colorIndex: 5,
        },
        {
            title: 'ADMIN BIO',
            subtitle: 'Your story, in your words',
            description: "Got Admin? You're about to be able to add a short bio to your profile. Let people know who you are. Keep it personal, keep it real. Small story o, not a novel.",
            colorIndex: 6,
            tag: 'DROPPING SOON',
        },
        {
            title: 'NAME CHANGE',
            subtitle: 'Loyalty has a name',
            description: "Hold Admin for 3 months straight and Àṣàrò lets you customise your display name. It's almost ready. Keep showing up.",
            colorIndex: 7,
            tag: 'DROPPING SOON',
        },
        {
            title: 'GROUP BROADCASTS',
            subtitle: 'Wake the feed',
            description: "Admins are getting one group-wide notification a month to shake everyone out of their slumber. Nearly there. Use it wisely when it lands.",
            colorIndex: 8,
            tag: 'DROPPING SOON',
        },
        {
            title: 'CREATE GROUP',
            subtitle: 'From member to leader',
            description: "Read through 50% of the Bible consistently and you'll unlock the ability to start your own group.",
            colorIndex: 9,
            tag: 'DROPPING SOON',
        },
    ];

    return (
        <Screen edges={[]}>
            <Stack.Screen options={{ headerShown: false }} />
            <Hero ownsTopInset>
                <ScalePressable
                    onPress={() => router.back()}
                    style={styles.backArrow}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={Spacing.md}
                >
                    <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                </ScalePressable>
                <Text variant="display" tone="onBand" style={styles.clothHeroTitle}>Group Logic</Text>
            </Hero>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.introSection}>
                    <Text variant="body" tone="secondary" style={styles.introDesc}>
                        Àṣàrò groups aren't decorative. Every rule, every perk, every reset exists to keep you honest — and keep you growing. Here's how it all works.
                    </Text>
                </View>

                {sections.map((section, index) => (
                    <View
                        key={index}
                        style={[
                            styles.sectionCard,
                            { borderLeftColor: hue(section.colorIndex) },
                            isLockedIn
                                ? { borderBottomColor: colors.border }
                                : { backgroundColor: colors.cardBackground },
                        ]}
                    >
                        <View style={styles.titleRow}>
                            <Text variant="label" style={{ color: hue(section.colorIndex) }}>
                                {section.title}
                            </Text>
                            {section.tag && (
                                <View style={[styles.tagBadge, { borderColor: hue(section.colorIndex) }]}>
                                    <Text variant="label" style={{ color: hue(section.colorIndex) }}>
                                        {section.tag}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text variant="subtitle" style={styles.sectionSubtitle}>{section.subtitle}</Text>
                        <Text variant="body" tone="secondary" style={styles.sectionDesc}>{section.description}</Text>
                    </View>
                ))}

                <View style={styles.footer}>
                    <Text variant="caption">Every day you read is a day well spent.</Text>
                </View>
            </ScrollView>
        </Screen>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        height: 56,
    },
    /*
     * Every Cloth band draws its back arrow the same way: a bare ochre glyph
     * hanging 6px into the gutter so the chevron lines up with the title's
     * stem. This screen used to carry a tinted round pill instead.
     */
    backArrow: { marginLeft: -6, alignSelf: 'flex-start' },
    /** `.cl-htitle{margin-top:10px}` under the arrow. */
    clothHeroTitle: { marginTop: 10 },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingTop: Spacing.lg,
        paddingBottom: 60,
    },
    introSection: {
        marginBottom: Spacing.xxl,
        gap: Spacing.sm,
    },
    introDesc: { opacity: 0.9 },
    /*
     * design/all-screens.html #about. The hue is the only thing holding ten
     * cards apart, and it used to be carried by a 48px tinted rounded square
     * with nothing inside it — a placeholder that shipped. It moves to the
     * rule down the card's left edge, the same device Entry detail uses to
     * hang an answer, and costs no width.
     */
    sectionCard: {
        borderLeftWidth: 3,
        borderBottomWidth: Spacing.border.hairline,
        borderBottomColor: 'transparent',
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.lg,
        paddingVertical: Spacing.lg,
        marginBottom: Spacing.lg,
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
        marginBottom: 2,
    },
    /** Square and outlined in the card's own hue — never filled. */
    tagBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: Spacing.border.hairline,
    },
    sectionSubtitle: { marginBottom: 2 },
    sectionDesc: { opacity: 0.8 },
    footer: {
        marginTop: Spacing.xxl,
        alignItems: 'center',
        gap: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
});