import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';

export default function AboutGroupsScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    const styles = getStyles(colors);

    const sections = [
        {
            title: 'THE IRON MAN RULE',
            subtitle: 'Earn your stripes',
            description: '21 days of reading in a month and you earn Admin. Not 20. Not "almost." This is for people who are actually reading their Bible — not just keeping up appearances.',
            color: colors.accentSecondary,
        },
        {
            title: 'ADMIN PRIVILEGES',
            subtitle: 'What you unlock',
            description: 'As Admin, you keep the group alive: updating the name, refreshing the description, and dropping the Monthly Broadcast to ginger everyone back into their reading.',
            color: colors.accent,
        },
        {
            title: "WE'VE GOT YOU",
            subtitle: 'Nobody left behind',
            description: "Gone quiet for a while? Your group gets a nudge to check on you. Because growth isn't a solo thing — we're all in this together.",
            color: '#34C759',
        },
        {
            title: 'A FRESH START',
            subtitle: 'Every month, a new chance',
            description: "Roles and stats reset for everyone on the 1st. Last month wasn't your best? Oya, wipe your eyes. This one is a clean slate.",
            color: '#00C7BE',
        },
        {
            title: 'WE FALL TO RISE AGAIN',
            subtitle: 'Grace, not disgrace',
            description: "Miss your 21-day streak and Àṣàrò moves you back to Member on the 1st. No shame in it. Every Admin has been there. Just come back stronger.",
            color: '#8E8E93',
        },
        {
            title: 'THE OPEN DOOR',
            subtitle: 'Space for those who show up',
            description: "37 days of silence and Àṣàrò quietly steps back, freeing up space for readers who are ready. Whenever you're ready to return, the door is open.",
            color: '#FF9500',
        },
        {
            title: 'ADMIN BIO',
            subtitle: 'Your story, in your words',
            description: "Got Admin? You're about to be able to add a short bio to your profile. Let people know who you are. Keep it personal, keep it real. Small story o, not a novel.",
            color: '#FF2D55',
            tag: 'DROPPING SOON',
        },
        {
            title: 'NAME CHANGE',
            subtitle: 'Loyalty has a name',
            description: "Hold Admin for 3 months straight and Àṣàrò lets you customise your display name. It's almost ready. Keep showing up.",
            color: '#AF52DE',
            tag: 'DROPPING SOON',
        },
        {
            title: 'GROUP BROADCASTS',
            subtitle: 'Wake the feed',
            description: "Admins are getting one group-wide notification a month to shake everyone out of their slumber. Nearly there. Use it wisely when it lands.",
            color: '#FF3B30',
            tag: 'DROPPING SOON',
        },
        {
            title: 'CREATE GROUP',
            subtitle: 'From member to leader',
            description: "Read through 50% of the Bible consistently and you'll unlock the ability to start your own group.",
            color: '#007AFF',
            tag: 'DROPPING SOON',
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Group Logic', headerTitle: 'Group Logic' }} />
            <View style={styles.header}>
                <ScalePressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </ScalePressable>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>How Groups Work</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.introSection}>
                    <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Group Logic</Text>
                    <Text style={[styles.introDesc, { color: colors.textSecondary }]}>
                        Àṣàrò groups aren't decorative. Every rule, every perk, every reset exists to keep you honest — and keep you growing. Here's how it all works.
                    </Text>
                </View>

                {sections.map((section, index) => (
                    <View key={index} style={[styles.sectionCard, { backgroundColor: colors.backgroundElevated + '40', borderColor: colors.borderSubtle + '40' }]}>
                        <View style={[styles.iconWrap, { backgroundColor: section.color + '15' }]}>
                        </View>
                        <View style={styles.sectionContent}>
                            <View style={styles.titleRow}>
                                <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
                                {section.tag && (
                                    <View style={[styles.tagBadge, { backgroundColor: section.color + '15' }]}>
                                        <Text style={[styles.tagText, { color: section.color }]}>{section.tag}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>{section.subtitle}</Text>
                            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>{section.description}</Text>
                        </View>
                    </View>
                ))}

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: colors.textTertiary }]}>Every day you read is a day well spent.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
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
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: colors.backgroundElevated + '80',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingTop: Spacing.lg,
        paddingBottom: 60,
    },
    introSection: {
        marginBottom: Spacing.xxl,
        gap: Spacing.sm,
    },
    introTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
    },
    introDesc: {
        fontSize: 16,
        lineHeight: 24,
        opacity: 0.9,
    },
    sectionCard: {
        flexDirection: 'row',
        padding: Spacing.lg,
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: Spacing.lg,
        gap: Spacing.lg,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    sectionContent: {
        flex: 1,
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    tagBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    tagText: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    sectionSubtitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.4,
        marginBottom: 2,
    },
    sectionDesc: {
        fontSize: 14,
        lineHeight: 22,
        opacity: 0.8,
    },
    footer: {
        marginTop: Spacing.xxl,
        alignItems: 'center',
        gap: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
    footerText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
});