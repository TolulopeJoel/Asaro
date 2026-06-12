import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    Modal,
    ScrollView,
    TouchableOpacity,
    DeviceEventEmitter,
    Platform,
    LayoutAnimation,
    TextInput,
} from 'react-native';
import Animated, {
    LinearTransition,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { BibleBook } from '@/src/data/bibleBooks';

// Journal imports
import { JournalEntryList } from '@/src/components/JournalEntryList';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntry, getEntryById } from '@/src/data/database';

// Study imports
import { StudyEditor } from '@/src/components/StudyEditor';
import { MarkdownRenderer } from '@/src/components/MarkdownRenderer';
import { getStudyTopics, updateStudyTopic, StudyTopic } from '@/src/data/database';

// Plan imports
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem, checkEntryCoversChapters } from '@/src/data/database';
import * as WebBrowser from 'expo-web-browser';

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment = 'journal' | 'study' | 'plan';
export type ViewMode = 'recent' | 'books' | 'bookDetail' | 'actions' | 'topics';

type PlanListDataItem =
    | { type: 'sectionHeader'; section: string; id: string }
    | { type: 'reading'; item: ReadingItem; id: string };

// ─── Segment Config ───────────────────────────────────────────────────────────

const SEGMENTS: { key: Segment; label: string; icon: string }[] = [
    { key: 'journal', label: 'Journal', icon: 'journal-outline' },
    { key: 'study', label: 'Study', icon: 'book-outline' },
    { key: 'plan', label: 'Plan', icon: 'map-outline' },
];

// ─── Journal Sub-Tabs ─────────────────────────────────────────────────────────

function JournalSubTabs({
    viewMode,
    selectedBook,
    onNavigateRecent,
    onNavigateBooks,
    onNavigateActions,
    onNavigateTopics,
}: {
    viewMode: ViewMode;
    selectedBook?: BibleBook;
    onNavigateRecent: () => void;
    onNavigateBooks: () => void;
    onNavigateActions: () => void;
    onNavigateTopics: () => void;
}) {
    const { colors } = useTheme();

    return (
        <View>
            {viewMode === 'bookDetail' && selectedBook && (
                <View style={[styles.breadcrumbRow, { borderBottomColor: colors.border }]}>
                    <ScalePressable onPress={onNavigateBooks}>
                        <Text style={[styles.breadcrumbText, { color: colors.textSecondary }]}>Books</Text>
                    </ScalePressable>
                    <Text style={[styles.breadcrumbSep, { color: colors.textTertiary }]}> / </Text>
                    <Text style={[styles.breadcrumbCurrent, { color: colors.textPrimary }]}>
                        {selectedBook.name}
                    </Text>
                </View>
            )}

            <View style={styles.subTabsRow}>
                <Animated.View
                    style={[styles.subTabIndicator, {
                        backgroundColor: colors.accent,
                        left: viewMode === 'recent' ? '0%'
                            : (viewMode === 'books' || viewMode === 'bookDetail') ? '25%'
                                : viewMode === 'actions' ? '50%'
                                    : '75%',
                    }]}
                    layout={LinearTransition}
                />
                <ScalePressable style={styles.subTab} onPress={onNavigateRecent}>
                    <Ionicons name="time" size={20}
                        color={viewMode === 'recent' ? colors.accent : colors.textTertiary} />
                </ScalePressable>
                <ScalePressable style={styles.subTab} onPress={onNavigateBooks}>
                    <Ionicons name="library" size={20}
                        color={(viewMode === 'books' || viewMode === 'bookDetail') ? colors.accent : colors.textTertiary} />
                </ScalePressable>
                <ScalePressable style={styles.subTab} onPress={onNavigateActions}>
                    <Ionicons name="flash" size={20}
                        color={viewMode === 'actions' ? colors.accent : colors.textTertiary} />
                </ScalePressable>
                <ScalePressable style={styles.subTab} onPress={onNavigateTopics}>
                    <Ionicons name="bookmark" size={20}
                        color={viewMode === 'topics' ? colors.accent : colors.textTertiary} />
                </ScalePressable>
            </View>
        </View>
    );
}

// ─── Plan Progress Bar ────────────────────────────────────────────────────────

function PlanProgressBar({ progress }: { progress: number }) {
    const { colors } = useTheme();
    if (progress === 0) return null;
    return (
        <View style={styles.planProgressRow}>
            <View style={[styles.planProgressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.planProgressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
            </View>
            <Text style={[styles.planProgressPct, { color: colors.accent }]}>
                {parseFloat(progress.toFixed(2))}%
            </Text>
        </View>
    );
}

// ─── Plan Section Header ──────────────────────────────────────────────────────

const PlanSectionHeader = React.memo(({
    title,
    isCollapsed,
    onToggle,
    completedCount,
    totalCount
}: {
    title: string;
    isCollapsed: boolean;
    onToggle: () => void;
    completedCount: number;
    totalCount: number;
}) => {
    const { colors } = useTheme();
    const isDone = completedCount === totalCount && totalCount > 0;
    const progress = totalCount > 0 ? (completedCount / totalCount) : 0;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={[
                styles.planSectionHeader,
                { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }
            ]}
        >
            <View style={styles.planSectionTitleContainer}>
                <Text style={[styles.planSectionTitle, { color: colors.textPrimary }]}>{title.toUpperCase()}</Text>
                <View style={[styles.planSectionBadge, { backgroundColor: isDone ? colors.accent + '20' : colors.border }]}>
                    <Text style={[styles.planSectionProgress, { color: isDone ? colors.accent : colors.textSecondary }]}>
                        {completedCount}/{totalCount}
                    </Text>
                </View>
            </View>
            <View style={styles.planSectionHeaderRight}>
                {progress > 0 && !isDone && (
                    <View style={[styles.miniProgressTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.miniProgressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
                    </View>
                )}
                {isDone && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
                <Ionicons
                    name={isCollapsed ? "chevron-forward" : "chevron-down"}
                    size={16}
                    color={colors.textTertiary}
                    style={{ marginLeft: 8 }}
                />
            </View>
        </TouchableOpacity>
    );
});

// ─── Reading Card ─────────────────────────────────────────────────────────────

const ReadingCard = React.memo(({
    item,
    isCompleted,
    onToggle
}: {
    item: ReadingItem;
    isCompleted: boolean;
    onToggle: (id: number, completed: boolean) => void
}) => {
    const { colors } = useTheme();

    return (
        <ScalePressable
            style={[
                styles.planCard,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: isCompleted ? colors.accent + '40' : colors.cardBorder,
                },
                item.isKey && !isCompleted && {
                    borderColor: item.id <= 286 ? '#E53935' + '60' : '#1E88E560',
                    backgroundColor: item.id <= 286 ? '#E53935' + '05' : '#1E88E505',
                }
            ]}
            onPress={() => onToggle(item.id, !isCompleted)}
        >
            <View style={styles.planCardContent}>
                <View style={styles.planBookInfo}>
                    <View style={styles.planBookHeader}>
                        {item.isKey && item.id <= 286 && (
                            <View style={[styles.keyBadge, { backgroundColor: colors.accentSecondary + '15' }]}>
                                <View style={[styles.redDiamond, { backgroundColor: '#E53935' }]} />
                            </View>
                        )}
                        {item.isKey && item.id > 286 && (
                            <View style={[styles.keyBadge, { backgroundColor: '#1E88E515' }]}>
                                <View style={[styles.blueDot, { backgroundColor: '#1E88E5' }]} />
                            </View>
                        )}
                        <Text style={[
                            styles.planBookName,
                            { color: isCompleted ? colors.textTertiary : colors.textPrimary },
                            isCompleted && { textDecorationLine: 'line-through' }
                        ]}>
                            {item.book}
                        </Text>
                    </View>
                    <Text style={[
                        styles.planChapters,
                        { color: isCompleted ? colors.textMuted : colors.textSecondary }
                    ]}>
                        {item.chapters || "Full Book"}
                    </Text>
                </View>
                <View style={[
                    styles.planCheckbox,
                    {
                        backgroundColor: isCompleted ? colors.accent : 'transparent',
                        borderColor: isCompleted ? colors.accent : colors.border,
                    }
                ]}>
                    {isCompleted && <Ionicons name="checkmark" size={14} color={colors.background} />}
                </View>
            </View>
        </ScalePressable>
    );
});

// ─── Journal Content ──────────────────────────────────────────────────────────

interface JournalContentProps {
    viewMode: ViewMode;
    searchQuery: string;
    selectedBook?: BibleBook;
    onViewModeChange: (mode: ViewMode) => void;
    onSearchChange: (q: string) => void;
    onSelectedBookChange: (book: BibleBook | undefined) => void;
}

function JournalContent({
    viewMode,
    searchQuery,
    selectedBook,
    onViewModeChange,
    onSearchChange,
    onSelectedBookChange,
}: JournalContentProps) {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { colors } = useTheme();

    useFocusEffect(
        useCallback(() => {
            if (selectedEntry?.id) {
                getEntryById(selectedEntry.id).then(updated => {
                    if (updated) setSelectedEntry(updated);
                });
            }
        }, [selectedEntry?.id])
    );

    useEffect(() => {
        if (params.openEntryId) {
            const entryId = Number(params.openEntryId);
            getEntryById(entryId).then(entry => {
                if (entry) {
                    setSelectedEntry(entry);
                    setIsDetailModalVisible(true);
                    router.setParams({ openEntryId: undefined });
                }
            });
        }
    }, [params.openEntryId]);

    const handleEntryPress = (entry: JournalEntry) => {
        setSelectedEntry(entry);
        setIsDetailModalVisible(true);
    };

    const handleCloseDetail = () => {
        setIsDetailModalVisible(false);
        setSelectedEntry(null);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleDeleteEntry = () => handleCloseDetail();

    const handleEditEntry = (entry: JournalEntry) => {
        router.push({
            pathname: '/addEntry',
            params: { entryId: entry.id!.toString() }
        });
    };

    return (
        <View style={{ flex: 1 }}>
            <JournalEntryList
                onEntryPress={handleEntryPress}
                refreshTrigger={refreshTrigger}
                viewMode={viewMode}
                searchQuery={searchQuery}
                selectedBook={selectedBook}
                onViewModeChange={onViewModeChange}
                onSearchChange={onSearchChange}
                onSelectedBookChange={onSelectedBookChange}
            />
            <AnimatedModal
                visible={isDetailModalVisible}
                onRequestClose={handleCloseDetail}
            >
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    {selectedEntry && (
                        <JournalEntryDetail
                            entry={selectedEntry}
                            onEdit={handleEditEntry}
                            onDelete={handleDeleteEntry}
                            onClose={handleCloseDetail}
                        />
                    )}
                </SafeAreaView>
            </AnimatedModal>
        </View>
    );
}

// ─── Study Content ────────────────────────────────────────────────────────────

function StudyContent({ onCountChange }: { onCountChange: (count: number) => void }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [topics, setTopics] = useState<StudyTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingTopic, setViewingTopic] = useState<StudyTopic | null>(null);
    const [editingTopic, setEditingTopic] = useState<StudyTopic | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editColor, setEditColor] = useState('#E18F43');

    const loadTopics = useCallback(async () => {
        try {
            const data = await getStudyTopics();
            setTopics(data);
            onCountChange(data.length);
        } catch (error) {
            console.error('Failed to load study topics:', error);
        } finally {
            setIsLoading(false);
        }
    }, [onCountChange]);

    useFocusEffect(useCallback(() => { loadTopics(); }, [loadTopics]));

    const openPreview = (topic: StudyTopic) => setViewingTopic(topic);
    const closePreview = () => setViewingTopic(null);

    const openEditor = (topic: StudyTopic) => {
        setEditingTopic(topic);
        setEditTitle(topic.title);
        setEditContent(topic.content || '');
        setEditColor(topic.color || '#E18F43');
        closePreview();
    };

    const closeEditor = () => setEditingTopic(null);

    const handleSave = async () => {
        if (!editingTopic || !editTitle.trim()) return;
        try {
            await updateStudyTopic(editingTopic.id, {
                title: editTitle,
                content: editContent,
                color: editColor,
            });
            closeEditor();
            loadTopics();
        } catch (error) {
            console.error('Failed to update topic:', error);
        }
    };

    const renderTopicCard = ({ item }: { item: StudyTopic }) => {
        const cardColor = item.color || colors.accent;
        return (
            <ScalePressable
                style={[
                    styles.studyCard,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: cardColor + '50',
                        borderLeftColor: cardColor,
                        borderLeftWidth: 4,
                    }
                ]}
                onPress={() => openPreview(item)}
                onLongPress={() => openEditor(item)}
            >
                <View style={styles.studyCardTop}>
                    <Text style={[styles.studyDateText, { color: colors.textTertiary }]}>
                        {new Date(item.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                </View>
                <Text style={[styles.studyCardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.title}
                </Text>
                {!!item.content && (
                    <Text style={[styles.studyCardSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.content}
                    </Text>
                )}
            </ScalePressable>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {isLoading ? (
                <View style={styles.center}>
                    <LoadingView size={48} />
                </View>
            ) : topics.length === 0 ? (
                <View style={styles.studyEmptyContainer}>
                    <View style={[styles.studyEmptyIconContainer, { backgroundColor: colors.accent + '12' }]}>
                        <Ionicons name="library-outline" size={44} color={colors.accent} />
                    </View>
                    <Text style={[styles.studyEmptyTitle, { color: colors.textPrimary }]}>Empty Library</Text>
                    <Text style={[styles.studyEmptySubtitle, { color: colors.textSecondary }]}>
                        Create your first study topic to start organizing your research.
                    </Text>
                    <ScalePressable
                        style={[styles.studyCreateButton, { backgroundColor: colors.accent + '15' }]}
                        onPress={() => router.push('/study/new' as any)}
                    >
                        <Ionicons name="add" size={16} color={colors.accent} />
                        <Text style={[styles.studyCreateButtonText, { color: colors.accent }]}>New Topic</Text>
                    </ScalePressable>
                </View>
            ) : (
                <FlatList
                    data={topics}
                    renderItem={renderTopicCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.studyListContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal
                visible={!!viewingTopic}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closePreview}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
                    <View style={styles.studyPreviewHeader}>
                        <ScalePressable onPress={closePreview} style={[styles.studyPreviewIconBtn, { backgroundColor: colors.backgroundSubtle }]}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </ScalePressable>
                        <ScalePressable onPress={() => viewingTopic && openEditor(viewingTopic)} style={[styles.studyEditButton, { backgroundColor: colors.accent }]}>
                            <Ionicons name="create-outline" size={18} color={colors.buttonPrimaryText} />
                            <Text style={[styles.studyEditButtonText, { color: colors.buttonPrimaryText }]}>Edit</Text>
                        </ScalePressable>
                    </View>
                    <ScrollView style={styles.studyPreviewContent} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.studyPreviewTitle, { color: colors.textPrimary }]}>{viewingTopic?.title}</Text>
                        <View style={[styles.studyPreviewDivider, { backgroundColor: viewingTopic?.color || colors.accent }]} />
                        <MarkdownRenderer
                            content={viewingTopic?.content || ''}
                            accentColor={viewingTopic?.color}
                        />
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <Modal
                visible={!!editingTopic}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closeEditor}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
                    <StudyEditor
                        title={editTitle}
                        content={editContent}
                        color={editColor}
                        onTitleChange={setEditTitle}
                        onContentChange={setEditContent}
                        onColorChange={setEditColor}
                        onSave={handleSave}
                        onCancel={closeEditor}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
}

// ─── Plan Content ─────────────────────────────────────────────────────────────

function PlanContent({ onProgressChange }: { onProgressChange: (p: number) => void }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    const sectionData = React.useMemo(() => {
        const counts: Record<string, { completed: number; total: number }> = {};
        READING_PLAN_DATA.forEach(item => {
            if (!counts[item.section]) counts[item.section] = { completed: 0, total: 0 };
            counts[item.section].total++;
            if (completedItems.has(item.id)) counts[item.section].completed++;
        });
        return counts;
    }, [completedItems]);

    const updateProgress = useCallback((newCompleted: Set<number>) => {
        const p = parseFloat(((newCompleted.size / READING_PLAN_DATA.length) * 100).toFixed(2));
        setProgress(p);
        onProgressChange(p);
    }, [onProgressChange]);

    const loadProgress = useCallback(async () => {
        const progressIds = await getReadingProgress();
        const completedSet = new Set(progressIds);
        setCompletedItems(completedSet);
        updateProgress(completedSet);

        if (isInitialLoad) {
            const nextItem = READING_PLAN_DATA.find(item => !completedSet.has(item.id));
            if (nextItem) {
                const allSections = Array.from(new Set(READING_PLAN_DATA.map(i => i.section)));
                const collapsed = new Set(allSections.filter(s => s !== nextItem.section));
                setCollapsedSections(collapsed);
            }
            setIsInitialLoad(false);
        }
    }, [isInitialLoad, updateProgress]);

    useFocusEffect(useCallback(() => { loadProgress(); }, [loadProgress]));

    const handleToggle = useCallback(async (id: number, completed: boolean) => {
        if (completed) {
            const item = READING_PLAN_DATA.find(i => i.id === id);
            if (!item) return;

            const rawChapters = item.chapters;
            const parts = rawChapters.split('-');
            const firstHasVerse = parts[0].includes(':');
            const planStart = parseInt(parts[0].split(':')[0], 10);

            let planEnd: number;
            if (parts.length > 1) {
                planEnd = firstHasVerse ? planStart : parseInt(parts[parts.length - 1].split(':')[0], 10);
            } else {
                planEnd = planStart;
            }

            if (isNaN(planStart)) {
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                updateProgress(newCompleted);
                return;
            }

            const isCovered = await checkEntryCoversChapters(item.book, planStart, planEnd);
            if (isCovered) {
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                updateProgress(newCompleted);
            } else {
                router.push({
                    pathname: '/addEntry',
                    params: { readingItemId: id, bookName: item.book, chapters: item.chapters }
                });
            }
        } else {
            await toggleReadingItem(id, false);
            const newCompleted = new Set(completedItems);
            newCompleted.delete(id);
            setCompletedItems(newCompleted);
            updateProgress(newCompleted);
        }
    }, [completedItems, router, updateProgress]);

    const toggleSection = useCallback((section: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => {
            const newCollapsed = new Set(prev);
            if (newCollapsed.has(section)) newCollapsed.delete(section);
            else newCollapsed.add(section);
            return newCollapsed;
        });
    }, []);

    const flatListData = useMemo(() => {
        const result: PlanListDataItem[] = [];
        let lastSection = '';
        for (const item of READING_PLAN_DATA) {
            if (item.section !== lastSection) {
                result.push({ type: 'sectionHeader', section: item.section, id: `section-${item.section}` });
                lastSection = item.section;
            }
            if (!collapsedSections.has(item.section)) {
                result.push({ type: 'reading', item, id: `reading-${item.id}` });
            }
        }
        return result;
    }, [collapsedSections]);

    const renderItem = useCallback(({ item }: { item: PlanListDataItem }) => {
        if (item.type === 'sectionHeader') {
            const stats = sectionData[item.section] || { completed: 0, total: 0 };
            return (
                <PlanSectionHeader
                    title={item.section}
                    isCollapsed={collapsedSections.has(item.section)}
                    onToggle={() => toggleSection(item.section)}
                    completedCount={stats.completed}
                    totalCount={stats.total}
                />
            );
        }
        return (
            <ReadingCard
                item={item.item}
                isCompleted={completedItems.has(item.item.id)}
                onToggle={handleToggle}
            />
        );
    }, [sectionData, collapsedSections, completedItems, handleToggle, toggleSection]);

    const renderHeader = useCallback(() => (
        <View style={styles.planLegendHeader}>
            {progress === 0 && (
                <View style={[styles.planLegendContainer, { backgroundColor: colors.backgroundSubtle }]}>
                    <View style={styles.planLegendItem}>
                        <View style={[styles.redDiamond, { backgroundColor: '#E53935', marginTop: 4 }]} />
                        <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                            Historical overview of God's dealings with the Israelites
                        </Text>
                    </View>
                    <View style={styles.planLegendItem}>
                        <View style={[styles.blueDot, { backgroundColor: '#1E88E5', marginTop: 4 }]} />
                        <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                            Chronological overview of the development of the Christian congregation
                        </Text>
                    </View>
                </View>
            )}
        </View>
    ), [colors, progress]);

    const renderFooter = useCallback(() => {
        const url = 'https://www.jw.org/en/library/series/more-topics/bible-reading-plan/';
        return (
            <View>
                {progress > 0 && (
                    <View style={[styles.planLegendContainer, { backgroundColor: colors.backgroundSubtle }]}>
                        <View style={styles.planLegendItem}>
                            <View style={[styles.redDiamond, { backgroundColor: '#E53935', marginTop: 4 }]} />
                            <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                                Historical overview of God's dealings with the Israelites
                            </Text>
                        </View>
                        <View style={styles.planLegendItem}>
                            <View style={[styles.blueDot, { backgroundColor: '#1E88E5', marginTop: 4 }]} />
                            <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                                Chronological overview of the development of the Christian congregation
                            </Text>
                        </View>
                    </View>
                )}
                <Text style={[styles.planFootnote, { color: colors.textSecondary, marginTop: Spacing.xl }]}>
                    * This reading plan was adapted from the Bible Reading Plan found on{' '}
                    <Text
                        style={{ textDecorationLine: 'underline', color: colors.accent }}
                        onPress={() => WebBrowser.openBrowserAsync(url)}
                    >
                        jw.org
                    </Text>
                </Text>
            </View>
        );
    }, [colors.textSecondary, colors.accent, colors.backgroundSubtle, progress]);

    const keyExtractor = useCallback((item: PlanListDataItem) => item.id, []);

    return (
        <View style={{ flex: 1 }}>
            {isInitialLoad ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={flatListData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.planListContent}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={15}
                    maxToRenderPerBatch={15}
                    windowSize={7}
                    removeClippedSubviews={Platform.OS === 'android'}
                />
            )}
        </View>
    );
}

// ─── Main Library Screen ──────────────────────────────────────────────────────

export default function LibraryScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    const [activeSegment, setActiveSegment] = useState<Segment>('journal');
    const [dropdownVisible, setDropdownVisible] = useState(false);

    // Journal header state
    const [journalViewMode, setJournalViewMode] = useState<ViewMode>(
        (params.view as ViewMode) || 'recent'
    );
    const [journalSearch, setJournalSearch] = useState('');
    const [journalSelectedBook, setJournalSelectedBook] = useState<BibleBook | undefined>();

    // Study header state
    const [studyCount, setStudyCount] = useState(0);

    // Plan header state
    const [planProgress, setPlanProgress] = useState(0);

    const handleJournalNavigate = useCallback((mode: ViewMode) => {
        setJournalViewMode(mode);
        setJournalSearch('');
        if (mode !== 'bookDetail') setJournalSelectedBook(undefined);
    }, []);

    const toggleDropdown = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDropdownVisible(prev => !prev);
    }, []);

    const handleSelectSegment = useCallback((s: Segment) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveSegment(s);
        setDropdownVisible(false);
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('tab-press-top-library', () => { });
        return () => subscription.remove();
    }, []);

    const activeLabel = SEGMENTS.find(s => s.key === activeSegment)?.label ?? '';
    const activeIcon = SEGMENTS.find(s => s.key === activeSegment)?.icon ?? '';

    const renderDropdownItem = (seg: typeof SEGMENTS[0], idx: number) => {
        const isActive = activeSegment === seg.key;
        return (
            <ScalePressable
                key={seg.key}
                style={[
                    styles.dropdownItem,
                    { borderBottomColor: idx === SEGMENTS.length - 1 ? 'transparent' : colors.border + '20' }
                ]}
                onPress={() => handleSelectSegment(seg.key)}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.dropdownIconBox, { backgroundColor: isActive ? colors.accent + '15' : colors.backgroundSubtle }]}>
                        <Ionicons name={seg.icon as any} size={22} color={isActive ? colors.accent : colors.textMuted} />
                    </View>
                    <Text style={[
                        styles.dropdownItemText,
                        { color: isActive ? colors.accent : colors.textPrimary }
                    ]}>
                        {seg.label}
                    </Text>
                </View>
                {isActive && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                )}
            </ScalePressable>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

            {/* ── Header Zone ───────────────────────────────────────────────── */}
            <View>

                {/* Row 1: PixelPlay-style pill + section name + contextual action */}
                <View style={[styles.titleRow, { zIndex: 10 }]}>
                    <View style={styles.pillGroup}>

                        {/* "Library" pill — the main tappable identity button */}
                        <ScalePressable
                            style={[styles.libraryPill, { backgroundColor: colors.backgroundSubtle }]}
                            onPress={toggleDropdown}
                        >
                            <Ionicons name={activeIcon as any} size={25} color={colors.textMuted} />
                            <Text style={[styles.libraryPillLabel, { color: colors.textPrimary }]}>
                                {activeLabel}
                            </Text>
                        </ScalePressable>

                        {/* Standalone chevron pill — matches PixelPlay's separate arrow */}
                        <ScalePressable
                            style={[styles.chevronPill, { backgroundColor: colors.backgroundSubtle }]}
                            onPress={toggleDropdown}
                        >
                            <Ionicons
                                name={dropdownVisible ? 'chevron-up' : 'chevron-down'}
                                size={15}
                                color={colors.textSecondary}
                            />
                        </ScalePressable>
                    </View>

                    {/* Study: count badge + add button */}
                    {activeSegment === 'study' && (
                        <View style={styles.titleActions}>
                            {studyCount > 0 && (
                                <View style={[styles.studyCountBadge, { backgroundColor: colors.accent + '18' }]}>
                                    <Text style={[styles.studyCountText, { color: colors.accent }]}>
                                        {studyCount}
                                    </Text>
                                </View>
                            )}
                            <ScalePressable
                                style={[styles.addButton, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                                onPress={() => router.push('/study/new' as any)}
                            >
                                <Ionicons name="add" size={26} color={colors.buttonPrimaryText} />
                            </ScalePressable>
                        </View>
                    )}

                    {/* Row 2: Floating overlay dropdown — appears anchored to the pill */}
                    {dropdownVisible && (
                        <View style={styles.dropdownOverlayContainer}>
                            <TouchableOpacity
                                style={styles.dropdownBackdrop}
                                activeOpacity={1}
                                onPress={toggleDropdown}
                            />
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                exiting={FadeOut.duration(150)}
                                style={[
                                    styles.floatingDropdown,
                                    { backgroundColor: colors.cardBackground, borderColor: colors.border }
                                ]}
                            >
                                {SEGMENTS.map((seg, idx) => renderDropdownItem(seg, idx))}
                            </Animated.View>
                        </View>
                    )}
                </View>

                {/* Row 3: Journal sub-tabs (+ optional breadcrumb) */}
                {activeSegment === 'journal' && (
                    <JournalSubTabs
                        viewMode={journalViewMode}
                        selectedBook={journalSelectedBook}
                        onNavigateRecent={() => handleJournalNavigate('recent')}
                        onNavigateBooks={() => handleJournalNavigate('books')}
                        onNavigateActions={() => handleJournalNavigate('actions')}
                        onNavigateTopics={() => handleJournalNavigate('topics')}
                    />
                )}

                {/* Row 4: Journal search bar */}
                {activeSegment === 'journal' &&
                    (journalViewMode === 'recent' || journalViewMode === 'bookDetail') && (
                        <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
                            <TextInput
                                style={[styles.searchInput, {
                                    backgroundColor: colors.searchBackground,
                                    color: colors.textPrimary,
                                    borderColor: colors.border,
                                }]}
                                placeholder={
                                    journalViewMode === 'bookDetail' && journalSelectedBook
                                        ? `Search ${journalSelectedBook.name}...`
                                        : 'Search entries...'
                                }
                                placeholderTextColor={colors.textTertiary}
                                value={journalSearch}
                                onChangeText={setJournalSearch}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {journalSearch.length > 0 && (
                                <ScalePressable style={styles.clearSearch} onPress={() => setJournalSearch('')}>
                                    <Text style={[styles.clearSearchText, { color: colors.textSecondary }]}>×</Text>
                                </ScalePressable>
                            )}
                        </View>
                    )}

                {/* Row 4: Plan progress bar */}
                {activeSegment === 'plan' && <PlanProgressBar progress={planProgress} />}

            </View>

            {/* ── Content Zone ──────────────────────────────────────────────── */}
            <View style={{ flex: 1 }}>
                {activeSegment === 'journal' && (
                    <JournalContent
                        viewMode={journalViewMode}
                        searchQuery={journalSearch}
                        selectedBook={journalSelectedBook}
                        onViewModeChange={setJournalViewMode}
                        onSearchChange={setJournalSearch}
                        onSelectedBookChange={setJournalSelectedBook}
                    />
                )}
                {activeSegment === 'study' && (
                    <StudyContent onCountChange={setStudyCount} />
                )}
                {activeSegment === 'plan' && (
                    <PlanContent onProgressChange={setPlanProgress} />
                )}
            </View>

        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    modalContainer: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // ── Header: title row ──────────────────────────────────────────
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },

    // ── PixelPlay-style pill group ─────────────────────────────────
    pillGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    // Main "Library" pill — icon + bold label, rounded rectangle
    libraryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 14,
    },
    libraryPillLabel: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -0.5,
    },

    // Standalone chevron pill — mirrors PixelPlay's separate "▾" button
    chevronPill: {
        width: 32,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    titleActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    studyCountBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    studyCountText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.3 },
    addButton: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
    },

    // ── Floating dropdown ─────────────────────────────────────────
    dropdownOverlayContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    dropdownBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -100,
        right: -100,
        bottom: 2000,
    },
    floatingDropdown: {
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 8,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dropdownIconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownItemText: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.5,
    },

    // ── Journal sub-tabs ───────────────────────────────────────────
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    breadcrumbText: { fontSize: 14, fontWeight: '400' },
    breadcrumbSep: { fontSize: 14, marginHorizontal: 6 },
    breadcrumbCurrent: { fontSize: 14, fontWeight: '600' },
    subTabsRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.layout.screenPadding,
        position: 'relative',
    },
    subTabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: '25%',
        height: 3,
        borderRadius: 1.5,
    },
    subTab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        zIndex: 1,
    },

    // ── Search bar ─────────────────────────────────────────────────
    searchContainer: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        borderWidth: 1,
        fontWeight: '500',
    },
    clearSearch: {
        marginLeft: 10, width: 32, height: 32,
        borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    },
    clearSearchText: { fontSize: 18, fontWeight: '300' },

    // ── Plan progress bar ──────────────────────────────────────────
    planProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        gap: 12,
    },
    planProgressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    planProgressFill: { height: '100%', borderRadius: 3 },
    planProgressPct: { fontSize: 13, fontWeight: '800', letterSpacing: -0.5, minWidth: 46, textAlign: 'right' },

    // ── Study ──────────────────────────────────────────────────────
    studyCard: {
        borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
        borderTopRightRadius: 12, borderBottomRightRadius: 12,
        borderWidth: 1, padding: 18, gap: 8,
    },
    studyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    studyDateText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
    studyCardTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, lineHeight: 24 },
    studyCardSnippet: { fontSize: 13, lineHeight: 19, fontWeight: '500', opacity: 0.75 },
    studyListContent: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: 110,
        gap: Spacing.md,
    },
    studyEmptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 14 },
    studyEmptyIconContainer: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    studyEmptyTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    studyEmptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21, opacity: 0.7 },
    studyCreateButton: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },
    studyCreateButtonText: { fontSize: 15, fontWeight: '700' },
    studyPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.layout.screenPadding, paddingVertical: 12 },
    studyPreviewIconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    studyEditButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    studyEditButtonText: { fontSize: 15, fontWeight: '700' },
    studyPreviewContent: { flex: 1, paddingHorizontal: Spacing.layout.screenPadding },
    studyPreviewTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 8 },
    studyPreviewDivider: { height: 4, width: 40, borderRadius: 2, marginBottom: 20 },

    // ── Plan ───────────────────────────────────────────────────────
    planLegendHeader: { marginBottom: Spacing.sm },
    planListContent: { padding: Spacing.layout.screenPadding, paddingBottom: 120 },
    planSectionHeader: {
        marginTop: Spacing.lg, marginBottom: Spacing.sm,
        paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 14, borderWidth: 1,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    planSectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    planSectionTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, paddingRight: Spacing.md },
    planSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, flexShrink: 1 },
    planSectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    planSectionProgress: { fontSize: 10, fontWeight: '800' },
    miniProgressTrack: { width: 56, height: 6, borderRadius: 3, overflow: 'hidden' },
    miniProgressFill: { height: '100%', borderRadius: 3 },
    planCard: { borderRadius: 16, borderWidth: 1, marginBottom: Spacing.xs, padding: 16 },
    planCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planBookInfo: { flex: 1, gap: 2 },
    planBookHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    planBookName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    planChapters: { fontSize: 14, letterSpacing: 0.1 },
    planCheckbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    keyBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 5, borderRadius: 8, width: 24, height: 24 },
    redDiamond: { width: 8, height: 8, transform: [{ rotate: '45deg' }] },
    blueDot: { width: 8, height: 8, borderRadius: 4 },
    planLegendContainer: { marginTop: Spacing.xl, gap: Spacing.md, padding: Spacing.md, borderRadius: 12 },
    planLegendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    planLegendText: { fontSize: 13, flex: 1, lineHeight: 18 },
    planFootnote: { fontSize: 10, lineHeight: 14, fontStyle: 'italic' },
});
