import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut, FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';

interface AuthContextType {
    user: FirebaseAuthTypes.User | null;
    loading: boolean;
    displayName: string | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    displayName: null,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [loading, setLoading] = useState(true);
    const [displayName, setDisplayName] = useState<string | null>(null);

    useEffect(() => {
        // Initial load of display name from local storage
        const loadLocalName = async () => {
            const name = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
            setDisplayName(name);
        };
        loadLocalName();

        const unsubscribe = onAuthStateChanged(getAuth(), async (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);

            if (firebaseUser) {
                if (firebaseUser.displayName) {
                    // Only persist to Firestore when the name has actually changed
                    const storedName = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
                    if (firebaseUser.displayName !== storedName) {
                        await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, firebaseUser.displayName);
                        await setDoc(doc(getFirestore(), 'users', firebaseUser.uid), {
                            displayName: firebaseUser.displayName,
                            lastModified: serverTimestamp(),
                        }, { merge: true });
                    }
                    setDisplayName(firebaseUser.displayName);
                } else {
                    const localName = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
                    if (localName) setDisplayName(localName);
                }
            } else {
                setDisplayName(null);
            }
        });

        return unsubscribe;
    }, []);

    const signOut = async () => {
        await firebaseSignOut(getAuth());
    };

    return (
        <AuthContext.Provider value={{ user, loading, displayName, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
