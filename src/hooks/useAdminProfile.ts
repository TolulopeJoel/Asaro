import { useState, useEffect, useCallback } from 'react';
import { getFirestore, doc, setDoc, getDoc, writeBatch, query, where, onSnapshot, collectionGroup } from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

export const useAdminProfile = () => {
    const { user } = useAuth();
    const { showAlert } = useAlert();
    const db = getFirestore();
    const [isAdmin, setIsAdmin] = useState(false);
    const [photoURL, setPhotoURL] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        if (!user?.uid) {
            setIsAdmin(false);
            setPhotoURL('');
            return;
        }

        // Check if user is an admin in any group
        const q = query(
            collectionGroup(db, 'members'),
            where('userId', '==', user.uid),
            where('role', '==', 'admin')
        );
        const unsubscribe = onSnapshot(q, snapshot => {
            setIsAdmin(!snapshot.empty);
        });

        // Fetch current user's photoURL
        getDoc(doc(db, 'users', user.uid)).then(docSnap => {
            if (docSnap.exists()) {
                setPhotoURL(docSnap.data()?.photoURL || '');
            }
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const handleSaveProfileURL = useCallback(async (url: string) => {
        if (!user?.uid) return;
        setIsSavingProfile(true);
        try {
            await setDoc(doc(db, 'users', user.uid), { photoURL: url.trim() }, { merge: true });
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const groupIds = userDoc.data()?.groupIds || [];
                if (groupIds.length > 0) {
                    const batch = writeBatch(db);
                    groupIds.forEach((groupId: string) => {
                        batch.set(
                            doc(db, 'groups', groupId, 'members', user.uid),
                            { photoURL: url.trim() }, { merge: true }
                        );
                    });
                    await batch.commit();
                }
            }
            setPhotoURL(url.trim());
            showAlert({ title: 'Success', message: 'Profile photo updated successfully' });
        } catch (error) {
            console.error('Failed to save profile:', error);
            showAlert({ title: 'Error', message: 'Failed to update profile photo' });
        } finally {
            setIsSavingProfile(false);
        }
    }, [user?.uid]);

    return {
        isAdmin,
        photoURL,
        isSavingProfile,
        handleSaveProfileURL,
        user,
    };
};
