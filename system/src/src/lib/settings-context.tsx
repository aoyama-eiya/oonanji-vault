'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSettings } from '@/types';

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    toggleTheme: () => void;
}

const defaultSettings: AppSettings = {
    theme: 'dark',
    language: 'ja',
    fontSize: 'medium',
    enableNotifications: true,
    animationsEnabled: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('app-settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                setSettings(prev => ({ ...prev, ...parsed }));
            } catch (error) {
                console.error('Failed to parse settings:', error);
            }
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // Apply theme
        document.documentElement.setAttribute('data-theme', settings.theme);

        // Apply font size
        const fontSizeMap = {
            small: '14px',
            medium: '16px',
            large: '18px',
        };
        document.documentElement.style.fontSize = fontSizeMap[settings.fontSize];
        
        // Apply animations setting
        if (settings.animationsEnabled) {
            document.body.classList.remove('no-animations');
        } else {
            document.body.classList.add('no-animations');
        }

        // Save to localStorage
        localStorage.setItem('app-settings', JSON.stringify(settings));
    }, [settings, mounted]);

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const toggleTheme = () => {
        setSettings((prev) => ({
            ...prev,
            theme: prev.theme === 'light' ? 'dark' : 'light',
        }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, toggleTheme }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
