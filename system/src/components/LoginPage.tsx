'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LogIn } from 'lucide-react';
import { useTranslation } from '@/lib/use-translation';

// Starry background component
// Starry background component removed
// const StarryBackground = React.memo(() => { ... });

export default function LoginPage() {
    const router = useRouter();
    const { login, isAuthenticated, user } = useAuth();
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ... (useEffect hook remains same)

    const authenticate = async (id: string, pw: string) => {
        try {
            console.log('Starting authentication...');
            setError('');
            setLoading(true);
            const success = await login(id, pw);
            console.log('Login result:', success);

            if (success) {
                console.log('Login success, attempting redirect...');
                router.push('/dashboard');
                // Keep loading true
            } else {
                setError(t('login_failed'));
                setLoading(false);
            }
        } catch (e) {
            console.error('Auth error:', e);
            setError(t('error'));
            setLoading(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!username || !password) {
            setError(t('error')); // Or specific message for inputs required
            return;
        }
        await authenticate(username, password);
    };

    return (
        <main className="login-shell relative bg-white dark:bg-black">
            {/* StarryBackground removed */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
                <h1 className="text-[15vw] font-extrabold select-none bg-[linear-gradient(to_right,#facc15,#f97316,#ef4444,#a855f7,#3b82f6,#22c55e)] text-transparent bg-clip-text">
                    Oonanji Vault
                </h1>
            </div>

            <section className="login-panel glass-surface w-full max-w-xs z-10">
                <header className="text-center mb-6">
                    <h1 className="text-xl font-bold tracking-tight">{t('login_button')}</h1>
                </header>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block space-y-2">
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground))]">{t('username')}</span>
                        <input
                            id="username"
                            name="username"
                            className="input-field"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground))]">{t('password')}</span>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            className="input-field"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                        />
                    </label>

                    {error && (
                        <div className="text-sm text-red-500/90 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            {error}
                        </div>
                    )}

                    <div className="pt-2">
                        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
                            <LogIn className="w-4 h-4" />
                            <span>{loading ? t('login_processing') : t('login_button')}</span>
                        </button>
                    </div>
                </form>
            </section>

        </main>
    );
}
