import React, { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
            const name = await AsyncStorage.getItem('user_name');
            setDisplayName(name);
        };
        loadLocalName();

        const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);

            if (firebaseUser) {
                if (firebaseUser.displayName) {
                    // Only persist to Firestore when the name has actually changed
                    const storedName = await AsyncStorage.getItem('user_name');
                    if (firebaseUser.displayName !== storedName) {
                        await AsyncStorage.setItem('user_name', firebaseUser.displayName);
                        await firestore().collection('users').doc(firebaseUser.uid).set({
                            displayName: firebaseUser.displayName,
                            lastModified: firestore.FieldValue.serverTimestamp(),
                        }, { merge: true });
                    }
                    setDisplayName(firebaseUser.displayName);
                } else {
                    const localName = await AsyncStorage.getItem('user_name');
                    if (localName) setDisplayName(localName);
                }
            } else {
                setDisplayName(null);
            }
        });

        return unsubscribe;
    }, []);

    const signOut = async () => {
        await auth().signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, displayName, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
