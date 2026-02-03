'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const AuthCallbackContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Processing...');

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            if (!code) {
                setStatus('Error: No code received');
                return;
            }

            try {
                // Determine API URL (client-side)
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

                setStatus('Verifying with System...');
                const res = await fetch(`${apiUrl}/api/license/callback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code })
                });

                if (res.ok) {
                    setStatus('Success! Redirecting...');
                    // Since we opened in _blank (new window), we should close this window and refresh parent
                    setTimeout(() => {
                        if (window.opener) {
                            window.opener.location.reload(); // Refresh parent to show new license
                            window.close();
                        } else {
                            // If no opener (e.g. user manually navigated), redirect plain
                            router.push('/dashboard?settings=true');
                        }
                    }, 1000);
                } else {
                    const err = await res.json();
                    setStatus(`Error: ${err.detail || 'Verification failed'}`);
                }
            } catch (error) {
                console.error(error);
                setStatus('System Error');
            }
        };

        handleCallback();
        // searchParams changes if URL changes, but we only want to run once. 
        // StrictMode might run double, but typically safe if repeatable or we assume code is one-time use but endpoint handles idempotency or failure gracefully.
    }, [searchParams, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <h2 className="text-xl font-bold">{status}</h2>
                <p className="text-sm text-[var(--muted-foreground)]">Please wait while we set up your license...</p>
            </div>
        </div>
    );
};

export default function AuthCallbackPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <AuthCallbackContent />
        </React.Suspense>
    );
}
