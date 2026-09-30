import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { LucideIcon } from 'lucide-react-native';
import type { AsaroAction, AsaroLook } from '../components/ui';

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
    /**
     * Àṣàrò asks instead of an icon. Takes the icon's place when both are set.
     * `look` defaults to the reader's choice.
     */
    face?: { look?: AsaroLook; action?: AsaroAction };
}

interface AlertActions {
    showAlert: (options: AlertOptions) => void;
    hideAlert: () => void;
}

interface AlertState {
    visible: boolean;
    alertOptions: AlertOptions | null;
}

/*
 * Two contexts: screens only ever ask for the functions, which never change,
 * so opening or closing an alert re-renders the alert alone rather than every
 * screen that can show one.
 */
const AlertActionsContext = createContext<AlertActions | undefined>(undefined);
const AlertStateContext = createContext<AlertState | undefined>(undefined);

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

    const actions = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert]);
    const state = useMemo(() => ({ visible, alertOptions }), [visible, alertOptions]);

    return (
        <AlertActionsContext.Provider value={actions}>
            <AlertStateContext.Provider value={state}>
                {children}
            </AlertStateContext.Provider>
        </AlertActionsContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertActionsContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

/** What the alert shows, for CustomAlert alone. */
export const useAlertState = () => {
    const context = useContext(AlertStateContext);
    if (!context) {
        throw new Error('useAlertState must be used within an AlertProvider');
    }
    return context;
};
