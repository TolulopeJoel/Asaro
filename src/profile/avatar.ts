/**
 * The reader's photo: picked, squared, shrunk and kept in Firestore at
 * avatars/{uid}, since the project has no Storage. Member docs carry only
 * `photoAt`, when it last changed, so a member list never pulls photos and a
 * phone refetches one only when it has changed. firestore.rules holds the cap.
 */
import { useEffect, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import {
    deleteDoc, deleteField, doc, getDoc, getFirestore, serverTimestamp, setDoc,
} from '@react-native-firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { syncProfileToGroups } from '../groups/repository';

/** Shown at 80px at most, and 38px in groups; 128 is sharp at both on a 3x screen. */
const SIZE = 128;
/** firestore.rules refuses an image this long or longer. */
const MAX_CHARS = 40_000;

const avatarRef = (uid: string) => doc(getFirestore(), 'avatars', uid);
const userDoc = (uid: string) => doc(getFirestore(), 'users', uid);

/** Photos already fetched, by uid, with the `photoAt` they were fetched for. */
const cache = new Map<string, { photoAt: number; image: string | null }>();

async function squareJpeg(uri: string): Promise<string> {
    const image = await ImageManipulator.manipulate(uri).resize({ width: SIZE, height: SIZE }).renderAsync();
    // Most photos fit at 0.6; a busy one gets a second, rougher pass rather than a refusal.
    for (const compress of [0.6, 0.4, 0.25]) {
        const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
        const data = `data:image/jpeg;base64,${saved.base64 ?? ''}`;
        if (saved.base64 && data.length < MAX_CHARS) return data;
    }
    throw new Error('too-large');
}

async function saveEverywhere(uid: string, photoAt: number | null) {
    await setDoc(userDoc(uid), {
        photoAt: photoAt ?? deleteField(),
        lastModified: serverTimestamp(),
    }, { merge: true });
    await syncProfileToGroups({ photoAt });
}

/**
 * Let the reader choose a photo and make it theirs everywhere. Resolves to the
 * image and when it changed, or null if they backed out of the picker.
 */
export async function chooseAvatar(): Promise<{ image: string; photoAt: number } | null> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('signed-out');

    const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return null;

    const image = await squareJpeg(picked.assets[0].uri);
    await setDoc(avatarRef(uid), { image, updatedAt: serverTimestamp() });
    const photoAt = Date.now();
    cache.set(uid, { photoAt, image });
    await saveEverywhere(uid, photoAt);
    return { image, photoAt };
}

/** Take the photo down, and from everywhere it was shown. */
export async function removeAvatar(): Promise<void> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    await deleteDoc(avatarRef(uid)).catch(() => { });
    cache.delete(uid);
    await saveEverywhere(uid, null);
}

/** When the reader's own photo last changed, or null if they have none. */
export async function myPhotoAt(): Promise<number | null> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return null;
    try {
        const at = (await getDoc(userDoc(uid))).data()?.photoAt;
        return typeof at === 'number' ? at : null;
    } catch {
        return null;
    }
}

/** Someone's photo, fetched once per change. Undefined while loading or when they have none. */
export function useAvatar(uid: string | undefined, photoAt: number | null | undefined): string | undefined {
    const cached = uid && photoAt ? cache.get(uid) : undefined;
    const [image, setImage] = useState<string | undefined>(
        cached && cached.photoAt === photoAt ? cached.image ?? undefined : undefined,
    );

    useEffect(() => {
        if (!uid || !photoAt) {
            setImage(undefined);
            return;
        }
        const known = cache.get(uid);
        if (known && known.photoAt === photoAt) {
            setImage(known.image ?? undefined);
            return;
        }
        let alive = true;
        getDoc(avatarRef(uid))
            .then(snap => {
                const data = snap.data()?.image;
                const found = typeof data === 'string' ? data : null;
                cache.set(uid, { photoAt, image: found });
                if (alive) setImage(found ?? undefined);
            })
            .catch(() => { });
        return () => { alive = false; };
    }, [uid, photoAt]);

    return image;
}
