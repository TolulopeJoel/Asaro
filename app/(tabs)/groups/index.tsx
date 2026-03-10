import React from 'react';
import { usePathname } from 'expo-router';
import GroupsHub from './hub';
import AuthScreen from './auth';
import JoinGroupScreen from './join';
import GroupDetailScreen from './[id]';

export default function GroupsRouter() {
    const pathname = usePathname();

    // Check if we are in a sub-route
    if (pathname.includes('/groups/auth')) {
        return <AuthScreen />;
    }

    if (pathname.includes('/groups/join')) {
        return <JoinGroupScreen />;
    }

    // Check for group ID detail view
    // Matches /(tabs)/groups/[id] where [id] is not 'auth' or 'join'
    const detailMatch = pathname.match(/\/groups\/([^/]+)/);
    if (detailMatch && !['auth', 'join', 'index'].includes(detailMatch[1])) {
        return <GroupDetailScreen />;
    }

    return <GroupsHub />;
}
