import React, { useCallback, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { getStudyTopics, StudyTopic } from '@/src/data/database';

export default function StudyTopicsScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [topics, setTopics] = useState<StudyTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadTopics = useCallback(async () => {
        try {
            const data = await getStudyTopics();
            setTopics(data);
        } catch (error) {
            console.error('Failed to load study topics:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadTopics();
        }, [loadTopics])
    );

    const renderTopicCard = ({ item }: { item: StudyTopic }) => {
        const refCount = item.references?.length || 0;

        return (
            <ScalePressable
                style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                onPress={() => router.push(`/study/${item.id}` as any)}
            >
                <View style={[styles.cardColorStrip, { backgroundColor: item.color || colors.accent }]} />
                <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={[styles.cardSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.content || 'No notes yet...'}
                    </Text>
                    <View style={styles.cardFooter}>
                        <View style={styles.badge}>
                            <Ionicons name="book-outline" size={12} color={colors.textTertiary} />
                            <Text style={[styles.badgeText, { color: colors.textTertiary }]}>
                                {refCount} reference{refCount !== 1 ? 's' : ''}
                            </Text>
                        </View>
                        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                            {new Date(item.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                    </View>
                </View>
            </ScalePressable>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Study Library</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your personal research wiki</Text>
                </View>
                <ScalePressable
                    style={[styles.addButton, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/study/new' as any)}
                >
                    <Ionicons name="add" size={28} color={colors.buttonPrimaryText} />
                </ScalePressable>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <Text style={{ color: colors.textTertiary }}>Loading your library...</Text>
                </View>
            ) : topics.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: colors.cardBackground }]}>
                        <Ionicons name="library-outline" size={48} color={colors.accent + '40'} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Empty Library</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Create your first study topic to start organizing your research.
                    </Text>
                    <ScalePressable
                        style={[styles.createButton, { backgroundColor: colors.accent + '20' }]}
                        onPress={() => router.push('/study/new' as any)}
                    >
                        <Text style={[styles.createButtonText, { color: colors.accent }]}>Create New Topic</Text>
                    </ScalePressable>
                </View>
            ) : (
                <FlatList
                    data={topics}
                    renderItem={renderTopicCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: Spacing.xl,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.7,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    listContent: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingBottom: 100,
        gap: Spacing.md,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        overflow: 'hidden',
        height: 110,
    },
    cardColorStrip: {
        width: 6,
        height: '100%',
    },
    cardContent: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardSnippet: {
        fontSize: 13,
        lineHeight: 18,
        opacity: 0.8,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 11,
        fontWeight: '400',
        opacity: 0.6,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 16,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    emptySubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.7,
    },
    createButton: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    createButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
