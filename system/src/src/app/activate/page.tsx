'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ShieldCheck } from 'lucide-react';

function ActivateContent() {
    const searchParams = useSearchParams();
    const userCode = searchParams.get('user_code');

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#11111b] text-white p-4">
            <div className="max-w-md w-full bg-[#1e1e2e] rounded-2xl border border-white/10 p-8 text-center shadow-2xl">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                    <ShieldCheck className="w-10 h-10 text-blue-400" />
                </div>

                <h1 className="text-2xl font-bold mb-2">端末の接続</h1>
                <p className="text-white/60 mb-8">
                    クライアントに表示されている
                    8桁のコードと一致しているか確認してください。
                </p>

                {userCode ? (
                    <div className="bg-[#181825] p-4 rounded-xl border border-white/5 mb-8 font-mono text-3xl tracking-widest text-blue-300">
                        {userCode}
                    </div>
                ) : (
                    <div className="bg-[#181825] p-4 rounded-xl border border-white/5 mb-8 text-white/30 italic">
                        コードがありません
                    </div>
                )}

                <div className="space-y-4">
                    <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors">
                        接続を許可
                    </button>
                    <p className="text-xs text-white/40">
                        許可すると、現在ログインしているアカウントで<br />
                        Oonanji Vaultの使用が開始されます。
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ActivatePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#11111b]" />}>
            <ActivateContent />
        </Suspense>
    );
}
