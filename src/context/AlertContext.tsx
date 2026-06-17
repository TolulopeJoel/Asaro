import React, { createContext, useContext, useState, useCallback } from 'react';
import { LucideIcon } from 'lucide-react-native';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
    icon?: LucideIcon;
}

export interface AlertOptions {
    title: string;
    message: string;
    buttons?: AlertButton[];
    cancelable?: boolean;
    icon?: LucideIcon;
    iconBackground?: string;
    iconColor?: string;
}

interface AlertContextType {
    showAlert: (options: AlertOptions) => void;
    hideAlert: () => void;
    visible: boolean;
    alertOptions: AlertOptions | null;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

    const showAlert = useCallback((options: AlertOptions) => {
        setAlertOptions(options);
        setVisible(true);
    }, []);

    const hideAlert = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert, visible, alertOptions }}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

// For rendering purposes, we need a way for the Provider to expose its state
export const useAlertInternal = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlertInternal must be used within an AlertProvider');
    }
    // This is a bit of a hack to let the CustomAlert component see the state
    // without circular imports or putting everything in one file.
    // In a real app, you might use a more robust state management.
    return context;
};
