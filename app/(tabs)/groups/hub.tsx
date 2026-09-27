/**
 * The groups hub. design/all-screens.html #groups: a nudge if there is one, each
 * group's week counted together with no names, and the two ways in.
 */
import React, { useEffect, useRef } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import { useMyGroups } from '@/src/groups/hooks';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Button } from '@/src/components/Button';
import { Skeleton } from '@/src/components/Skeleton';
import { Avatar } from '@/src/components/Avatar';
import { NudgePanel } from '@/src/components/groups/NudgePanel';
import { Hero, Row, Screen, Text, ThemedButton } from '@/src/components/ui';

export default function GroupsScreen() {
    const { user, loading } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();
    const footPadding = useFootPadding();
    const { rows, loading: groupsLoading, error } = useMyGroups();
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('tab-press-top-groups', () => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        });
        return () => subscription.remove();
    }, []);

    // While auth is still loading, the skeleton below shows rather than the sign-in card.
    if (!user && !loading) {
        /* design/all-screens.html #groups, for a reader who has not signed in. */
        return (
            <Screen edges={[]}>
                <Hero ownsTopInset>
                    <Text variant="display" tone="onBand">Better{'\n'}Together</Text>
                    <Text variant="sub" tone="onHero" style={styles.heroSub}>Read together. I am watching all of you. 👀</Text>
                </Hero>
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.authScroll}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.authContainer}>
                        <View style={[styles.welcomeCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <View style={[styles.welcomeIconWrap, { backgroundColor: colors.accentSecondaryLight + '20' }]}>
                                <Users size={34} color={colors.accentSecondary} />
                            </View>

                            <Text variant="display" style={styles.centre}>Better Together</Text>
                            <Text variant="body" tone="secondary" style={styles.authQuote}>
                                {'“If you want to go fast, go alone. If you want to go far, go together”'}
                            </Text>

                            <Button
                                label="Sign in to Join Them"
                                variant="primary"
                                size="lg"
                                onPress={() => router.push('/(tabs)/groups/auth' as any)}
                                fullWidth
                                style={{ marginTop: Spacing.lg }}
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }

    const isLoading = loading || !user || groupsLoading;

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <Text variant="display" tone="onBand">Better Together</Text>
                <Text variant="sub" tone="onHero" style={styles.heroSub}>Consistency is key. Read together!</Text>
            </Hero>

            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={[styles.body, { paddingBottom: footPadding }]}
                showsVerticalScrollIndicator={false}
            >
                {!isLoading && <NudgePanel />}

                {isLoading ? (
                    <View>
                        <Text variant="label" style={styles.label}>My groups</Text>
                        {[1, 2].map(i => (
                            <Row key={i} style={styles.groupRow}>
                                <Skeleton circle width={38} height={38} />
                                <View style={styles.rowMain}>
                                    <Skeleton width="55%" height={18} borderRadius={0} />
                                    <View style={{ height: 6 }} />
                                    <Skeleton width="80%" height={13} borderRadius={0} />
                                </View>
                            </Row>
                        ))}
                    </View>
                ) : rows.length > 0 ? (
                    <View>
                        <Text variant="label" style={styles.label}>My groups</Text>
                        {error && (
                            <Text variant="bodySmall" style={styles.note}>Couldn’t reach your groups just now. Showing what’s saved.</Text>
                        )}
                        {rows.map(row => (
                            <ScalePressable
                                key={row.group.id}
                                onPress={() => router.push(`/(tabs)/groups/${row.group.id}` as any)}
                                accessibilityRole="button"
                                accessibilityLabel={`${row.group.name}. ${row.line}`}
                            >
                                <Row style={styles.groupRow}>
                                    <Avatar id={row.group.id} name={row.group.name} size={38} radius={19} />
                                    <View style={styles.rowMain}>
                                        <Text variant="reference" numberOfLines={1}>{row.group.name}</Text>
                                        <Text variant="bodySmall" style={styles.snip}>{row.line}</Text>
                                    </View>
                                    {row.window.open && <Text variant="meta" tone="accent">{row.window.label}</Text>}
                                </Row>
                            </ScalePressable>
                        ))}
                    </View>
                ) : (
                    <Text variant="sub">
                        {error ? 'Couldn’t reach your groups just now.' : 'You’re not in a group yet. Read with the people you want to keep going with.'}
                    </Text>
                )}

                {!isLoading && (
                    <View>
                        <Text variant="label" style={styles.label}>{rows.length ? 'Join another' : 'Join a group'}</Text>
                        <ThemedButton label="Enter Group Code" block onPress={() => router.push('/(tabs)/groups/join' as any)} />
                        <ThemedButton
                            label="Start a group"
                            variant="secondary"
                            block
                            onPress={() => router.push('/(tabs)/groups/create' as any)}
                            style={styles.second}
                        />
                    </View>
                )}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    heroSub: { marginTop: Spacing.sm },
    /** `.cl-body{padding:22px 24px 0; gap:18px}` */
    body: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.layout.cardPadding + 4,
        gap: Spacing.layout.cardPadding,
    },
    label: { marginBottom: 9 },
    note: { marginBottom: Spacing.sm },
    groupRow: { alignItems: 'center' },
    rowMain: { flex: 1, minWidth: 0 },
    snip: { marginTop: 4 },
    second: { marginTop: 10 },

    authScroll: { flexGrow: 1 },
    authContainer: {
        flex: 1,
        padding: Spacing.layout.screenPadding,
        gap: Spacing.lg,
        justifyContent: 'center',
    },
    welcomeCard: {
        padding: Spacing.xxl,
        alignItems: 'center',
        borderWidth: 1,
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    centre: { textAlign: 'center' },
    authQuote: { textAlign: 'center', opacity: 0.7, paddingHorizontal: Spacing.md },
    welcomeIconWrap: {
        width: 72,
        height: 72,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
});
