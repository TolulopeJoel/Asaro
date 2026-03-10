import React, { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
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

        const unsubscribe = auth().onAuthStateChanged(async (user) => {
            setUser(user);
            setLoading(false);

            if (user && !displayName) {
                // If user is logged in but we don't have a display name locally, check Firebase
                setDisplayName(user.displayName);
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
