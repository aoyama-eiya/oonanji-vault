'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            fetchUser(token);
        }
        setMounted(true);
    }, []);

    const fetchUser = async (token: string) => {
        console.log('fetchUser called with token length:', token.length);
        try {
            const res = await fetch(`${API_URL}/api/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('fetchUser response status:', res.status);
            if (res.ok) {
                const userData = await res.json();
                console.log('fetchUser data:', userData);
                setUser(userData);
            } else {
                console.warn('fetchUser failed, logging out');
                logout();
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
            logout();
        }
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        console.log('AuthContext: login called for', username);
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            console.log('AuthContext: fetching token from:', `${API_URL}/api/authenticate`);
            const res = await fetch(`${API_URL}/api/authenticate`, {
                method: 'POST',
                body: formData,
            });
            console.log('AuthContext: token response status:', res.status);

            if (res.ok) {
                const data = await res.json();
                console.log('AuthContext: token received');
                localStorage.setItem('access_token', data.access_token);
                await fetchUser(data.access_token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        setUser(null);
    };

    const isAuthenticated = user !== null;
    const isAdmin = user?.role === 'admin';

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
