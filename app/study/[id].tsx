import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { getStudyTopicById, updateStudyTopic, StudyTopic } from '@/src/data/database';
import { StudyEditor } from '@/src/components/StudyEditor';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';

export default function StudyTopicDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const [topic, setTopic] = useState<StudyTopic | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('#E18F43');

    useEffect(() => {
        const loadTopic = async () => {
            try {
                const data = await getStudyTopicById(Number(id));
                if (data) {
                    setTopic(data);
                    setTitle(data.title);
                    setContent(data.content);
                    setColor(data.color);
                } else {
                    router.back();
                }
            } catch (error) {
                console.error('Failed to load topic:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTopic();
    }, [id]);

    const handleSave = async () => {
        if (!title.trim() || !topic) return;
        
        try {
            await updateStudyTopic(topic.id, {
                title,
                content,
                color,
            });
            router.back();
        } catch (error) {
            console.error('Failed to update topic:', error);
        }
    };

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <StudyEditor
                title={title}
                content={content}
                color={color}
                onTitleChange={setTitle}
                onContentChange={setContent}
                onColorChange={setColor}
                onSave={handleSave}
                onCancel={() => router.back()}
            />
        </SafeAreaView>
    );
}
