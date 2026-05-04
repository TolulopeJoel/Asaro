import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { createStudyTopic } from '@/src/data/database';
import { StudyEditor } from '@/src/components/StudyEditor';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewStudyTopicScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('#E18F43');

    const handleSave = async () => {
        if (!title.trim()) return;
        
        try {
            await createStudyTopic({
                title,
                content,
                color,
            });
            router.back();
        } catch (error) {
            console.error('Failed to create topic:', error);
        }
    };

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
