import React from 'react';
import { View, Text, Image } from 'react-native';
import { Typography } from '../theme/typography';

const AVATAR_COLORS = [
    '#FF2D55', '#FF9500', '#FFCC00', '#34C759',
    '#00C7BE', '#007AFF', '#5856D6', '#AF52DE', '#FF375F',
];

export const getAvatarColor = (id: string | undefined | null, name?: string): string => {
    const seed = (id || name || 'Guest').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const Avatar = ({
    id, name, url, size = 44, radius, borderWidth, borderColor, opacity = 1, style,
}: {
    id?: string; name?: string; url?: string; size?: number; radius?: number;
    borderWidth?: number; borderColor?: string; opacity?: number; style?: any;
}) => (
    <View style={[{
        width: size, height: size,
        borderRadius: radius ?? size / 2,
        backgroundColor: getAvatarColor(id, name),
        justifyContent: 'center', alignItems: 'center',
        borderWidth: borderWidth ?? 0, borderColor, opacity,
        overflow: 'hidden',
    }, style]}>
        {url ? (
            <Image
                source={{ uri: url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
            />
        ) : (
            <Text style={{ fontSize: size * 0.4, fontWeight: Typography.weight.bold as any, color: 'white' }}>
                {name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
        )}
    </View>
);
