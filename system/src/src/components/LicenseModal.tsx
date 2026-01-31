import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/use-translation';
import { Key, CheckCircle, AlertCircle, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';

interface LicenseModalProps {
    isOpen: boolean;
    onVerified: () => void;
}

interface DeviceAuthData {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
}

export function LicenseModal({ isOpen, onVerified }: LicenseModalProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'idle' | 'loading' | 'pending' | 'valid' | 'error'>('idle');
    const [deviceData, setDeviceData] = useState<DeviceAuthData | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up polling on unmount or when modal closes
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // Safety check: stop polling if modal closes
    useEffect(() => {
        if (!isOpen && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            setStatus('idle');
            setDeviceData(null);
            setErrorMessage('');
        }
    }, [isOpen]);

    const startDeviceAuth = async () => {
        setStatus('loading');
        setErrorMessage('');

        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API_BASE_URL}/api/license/start-auth`, {
                method: 'POST',
            });

            if (!res.ok) throw new Error('Failed to initiate authentication');

            const data: DeviceAuthData = await res.json();
            setDeviceData(data);
            setStatus('pending');

            // Open verification URL in new tab
            window.open(data.verification_uri_complete, '_blank');

            // Start polling
            startPolling(data.device_code, data.interval);

        } catch (error) {
            console.error(error);
            setStatus('error');
            setErrorMessage('認証サーバーに接続できませんでした');
        }
    };

    const startPolling = (deviceCode: string, intervalSeconds: number = 5) => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/license/poll-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_code: deviceCode })
                });

                const data = await res.json();

                if (res.ok && data.valid) {
                    // Success!
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

                    // Phase 1: Output token for verification
                    console.log("[Phase 1] Token Acquired:", data.access_token);

                    setStatus('valid');
                    setTimeout(() => {
                        onVerified();
                    }, 1500);
                } else if (res.status === 400 && data.error === 'authorization_pending') {
                    // Still waiting, do nothing
                } else if (res.status === 400 && data.error === 'expired_token') {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    setStatus('error');
                    setErrorMessage('有効期限切れです。もう一度お試しください。');
                }
            } catch (e) {
                // Ignore transient network errors during polling
            }
        }, intervalSeconds * 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[#1e1e2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">

                {/* Decorative background element */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

                {/* Header */}
                <div className="p-8 text-center bg-gradient-to-b from-white/5 to-transparent">
                    <div className="w-20 h-20 bg-[#181825] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
                        {status === 'valid' ? (
                            <CheckCircle className="w-10 h-10 text-green-400 animate-in zoom-in spin-in-90 duration-300" />
                        ) : status === 'pending' ? (
                            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                        ) : (
                            <ShieldCheck className="w-10 h-10 text-blue-400" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">アカウント連携（ログイン）</h2>
                    <p className="text-white/50 text-sm">
                        {status === 'pending'
                            ? 'ブラウザで認証してください...'
                            : 'Oonanji Vaultを利用するにはアカウントが必要です'}
                    </p>
                </div>

                {/* Body */}
                <div className="px-8 pb-8 pt-2 space-y-6">

                    {status === 'idle' || status === 'error' || status === 'loading' ? (
                        <div className="space-y-4">
                            {status === 'error' && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-4 rounded-xl border border-red-500/20 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <div className="bg-[#181825] rounded-xl p-4 border border-white/5 text-sm text-white/70 leading-relaxed">
                                <p>ポータルサイトのアカウントでログインして、ライセンスを有効化します。</p>
                            </div>

                            <button
                                onClick={startDeviceAuth}
                                disabled={status === 'loading'}
                                className="w-full py-4 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {status === 'loading' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>ポータルでログインして連携</span>
                                        <ExternalLink className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            {/* Pending State UI */}
                            {status === 'pending' && (
                                <div className="text-center space-y-4">
                                    <div className="bg-[#181825] p-6 rounded-xl border border-blue-500/20 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
                                        <p className="text-xs text-blue-300 uppercase tracking-widest font-semibold mb-2">確認コード</p>
                                        <p className="text-3xl font-mono font-bold text-white tracking-wider tabular-nums">
                                            {deviceData?.user_code}
                                        </p>
                                    </div>
                                    <div className="text-sm text-white/40">
                                        自動で開かない場合は
                                        <a href={deviceData?.verification_uri_complete} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline mx-1">
                                            こちらをクリック
                                        </a>
                                        してください
                                    </div>
                                </div>
                            )}

                            {/* Valid State UI */}
                            {status === 'valid' && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center animate-in zoom-in">
                                    <p className="text-green-400 font-medium text-lg">連携完了！</p>
                                    <p className="text-green-400/60 text-sm mt-1">Oonanji Vaultを開始します...</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="text-center pt-2">
                        <span className="text-xs text-white/20">Secure Device Authorization Flow</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
