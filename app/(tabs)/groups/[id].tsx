import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';

const AVATAR_COLORS = [
    '#FF2D55', // vivid red
    '#FF9500', // vivid orange
    '#FFCC00', // vivid yellow
    '#34C759', // vivid green
    '#00C7BE', // vivid teal
    '#007AFF', // vivid blue
    '#5856D6', // vivid indigo
    '#AF52DE', // vivid purple
    '#FF375F', // vivid pink
    '#A2845E', // vivid brown
];

const getAvatarColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function GroupDetailScreen() {
    const { id: groupId } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const { user } = useAuth();

    const [groupName, setGroupName] = React.useState('Loading group...');
    const [activities, setActivities] = React.useState<any[]>([]);
    const [members, setMembers] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!groupId) return;

        // Fetch group info
        const unsubscribeGroup = firestore()
            .collection('groups')
            .doc(groupId)
            .onSnapshot(doc => {
                if (doc && doc.exists()) {
                    setGroupName(doc.data()?.name || 'Group');
                }
                setLoading(false);
            });

        // Listen for activities
        const unsubscribeActivities = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('activities')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot((querySnapshot) => {
                const feed = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setActivities(feed);
            });

        // Listen for members
        const unsubscribeMembers = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('members')
            .onSnapshot((querySnapshot) => {
                const memberList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMembers(memberList);
            });

        return () => {
            unsubscribeGroup();
            unsubscribeActivities();
            unsubscribeMembers();
        };
    }, [groupId]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary }}>Loading...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary, marginBottom: Spacing.xl }]}>{groupName}</Text>

                {/* Members Section */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                    {members.map((member) => (
                        <View key={member.id} style={styles.memberItem}>
                            <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.userId || member.id) }]}>
                                <Text style={[styles.memberInitial, { color: 'white' }]}>
                                    {member.displayName?.charAt(0).toUpperCase()}
                                </Text>
                                <View style={[styles.onlineDot, { backgroundColor: '#4CAF50', borderColor: colors.background }]} />
                            </View>
                            <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {member.displayName}
                            </Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Activity Feed */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LIVE FEED</Text>
                </View>

                {activities.length > 0 ? (
                    activities.map((activity) => (
                        <View key={activity.id} style={[styles.activityCard, { borderColor: colors.border }]}>
                            <View style={[styles.userBadge, { backgroundColor: getAvatarColor(activity.userId) }]}>
                                <Text style={[styles.userInitial, { color: 'white' }]}>
                                    {activity.userName?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                            <View style={styles.activityContent}>
                                <View style={styles.activityHeader}>
                                    <Text style={[styles.userName, { color: colors.textPrimary }]}>{activity.userName}</Text>
                                    <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                                        {activity.timestamp?.toDate ? activity.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </Text>
                                </View>
                                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                    just finished reading {activity.bookName} {activity.chapters}
                                </Text>
                            </View>
                            <View style={styles.activityIcon}>
                                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyFeed}>
                        <Text style={[styles.emptyFeedText, { color: colors.textTertiary }]}>No activity yet today. Be the first!</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerTitle: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.5,
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingTop: Spacing.xs,
    },
    sectionHeader: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 2,
        opacity: 0.6,
    },
    memberList: {
        marginBottom: Spacing.xl,
    },
    memberItem: {
        alignItems: 'center',
        marginRight: Spacing.lg,
        width: 60,
    },
    memberAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        position: 'relative',
    },
    memberInitial: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.bold,
    },
    memberName: {
        fontSize: Typography.size.xs,
        textAlign: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    activityCard: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.md,
        alignItems: 'center',
        gap: Spacing.md,
    },
    userBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInitial: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
    },
    activityContent: {
        flex: 1,
        gap: 2,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userName: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    timestamp: {
        fontSize: Typography.size.xs,
    },
    activityText: {
        fontSize: Typography.size.xs,
        lineHeight: 16,
    },
    activityIcon: {
        marginLeft: Spacing.xs,
    },
    emptyFeed: {
        padding: Spacing.xxl * 2,
        alignItems: 'center',
    },
    emptyFeedText: {
        fontSize: Typography.size.sm,
        fontStyle: 'italic',
    },
});
