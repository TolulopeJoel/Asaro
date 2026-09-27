import React from 'react';

import { useAvatar } from '../profile/avatar';
import { Avatar } from './Avatar';

/** A person's avatar: their photo when they have one, their initial until it loads or if not. */
export function MemberAvatar({ uid, name, photoAt, size, radius }: {
    uid: string;
    name: string;
    photoAt: number | null | undefined;
    size: number;
    radius: number;
}) {
    const image = useAvatar(uid, photoAt);
    return <Avatar id={uid} name={name} url={image} size={size} radius={radius} />;
}
