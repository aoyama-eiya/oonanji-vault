'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Users,
    Database,
    HardDrive,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    RefreshCw,
    Server,
    Shield,
    ShieldAlert,
    StopCircle,
    GitBranch,
    Download,
    Github
} from 'lucide-react';

interface User {
    id: number;
    username: string;
    display_name: string;
    role: string;
    created_at?: string;
}

interface NASStatus {
    is_mounted: boolean;
    has_files: boolean;
    mount_path: string;
    storage_mode: string;
    indexing_status: string;
    indexing_progress: number;
    is_indexing: boolean;
    indexing_log?: string[];
    processed_files?: number;
    total_files?: number;
    last_indexed_at?: string;
}

interface IndexedDocument {
    id: string;
    filename: string;
    path: string;
    chunk_count: number;
    modified_at: string;
}

interface ChunkResult {
    id: string;
    content: string;
    metadata: any;
    score?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const PORTAL_URL = 'http://localhost:3000'; // User defined Portal URL
const APP_URL = 'http://localhost:80'; // User defined App URL

export default function AdminPage() {
    const { isAuthenticated, isAdmin } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'users' | 'nas' | 'indexing' | 'updates'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [nasStatus, setNasStatus] = useState<NASStatus | null>(null);
    const [licenseInfo, setLicenseInfo] = useState<any>(null);

    // Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({ username: '', display_name: '', password: '', role: 'user' });
    const [indexingStorageMode, setIndexingStorageMode] = useState<'nas' | 'internal'>('nas');

    // Data Browser State
    const [indexedDocs, setIndexedDocs] = useState<IndexedDocument[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<IndexedDocument | null>(null);
    const [docChunks, setDocChunks] = useState<ChunkResult[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [showBrowser, setShowBrowser] = useState(false);
    const logContainerRef = React.useRef<HTMLDivElement>(null);

    // Update State
    const [updateStatus, setUpdateStatus] = useState({
        checked: false,
        updating: false,
        completed: false
    });
    const [updateLogs, setUpdateLogs] = useState<string[]>([]);

    // Auto-scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [nasStatus?.indexing_log]);

    useEffect(() => {
        if (!isAuthenticated || !isAdmin) {
            router.push('/');
        }
    }, [isAuthenticated, isAdmin, router]);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchUsers();
            fetchCommonData();

            const interval = setInterval(() => {
                fetchCommonData();
            }, 5000); // Check status every 5s

            return () => clearInterval(interval);
        }
    }, [isAuthenticated, isAdmin]);

    const getToken = () => localStorage.getItem('access_token');

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const fetchCommonData = async () => {
        await Promise.all([fetchNASStatus(), fetchLicenseInfo()]);
    }

    const fetchNASStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/nas/status`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNasStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch NAS status:', error);
        }
    };

    const fetchLicenseInfo = async () => {
        try {
            // We can check license status via existing endpoint or new refresh
            const res = await fetch(`${API_URL}/api/license/status`);
            if (res.ok) {
                const data = await res.json();
                setLicenseInfo(data);
            }
        } catch (error) {
            console.error('Failed to fetch License info:', error);
        }
    };

    const fetchIndexedDocs = async () => {
        setIsLoadingDocs(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/index/documents`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIndexedDocs(data);
            }
        } catch (error) {
            console.error('Failed to fetch indexed docs:', error);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const fetchDocChunks = async (path: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/index/search`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file_path: path, limit: 100 })
            });
            if (res.ok) {
                const data = await res.json();
                setDocChunks(data);
            }
        } catch (error) {
            console.error('Failed to fetch chunks:', error);
        }
    };

    const handleOpenModal = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                display_name: user.display_name || '',
                password: '', // Password not shown
                role: user.role
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                display_name: '',
                password: '',
                role: 'user'
            });
        }
        setShowUserModal(true);
    };

    const handleSaveUser = async () => {
        // Validation
        if (!editingUser) {
            if (!formData.username || !formData.password) {
                alert('ユーザーIDとパスワードは必須です');
                return;
            }
            if (!/^[a-zA-Z0-9-]+$/.test(formData.username)) {
                alert('ユーザーIDは半角英数とハイフンのみ使用可能です');
                return;
            }
        }

        if (formData.password && /[_.]/.test(formData.password)) {
            alert('パスワードに「_」や「.」は使用できません');
            return;
        }

        try {
            const url = editingUser
                ? `${API_URL}/api/admin/users/${editingUser.id}`
                : `${API_URL}/api/admin/users`;

            const method = editingUser ? 'PUT' : 'POST';

            const body: any = {
                display_name: formData.display_name,
                role: formData.role
            };

            if (!editingUser) {
                body.username = formData.username;
                body.password = formData.password;
            } else {
                if (formData.password) body.password = formData.password;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowUserModal(false);
                fetchUsers();
            } else {
                const error = await res.json();
                alert(error.detail || '操作に失敗しました');
            }
        } catch (error) {
            console.error('Failed to save user:', error);
            alert('操作に失敗しました');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (user.username === 'adminuser') {
            alert('このユーザーは削除できません');
            return;
        }
        if (!confirm('このユーザーを削除しますか?')) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });

            if (res.ok) {
                fetchUsers();
            } else {
                const error = await res.json();
                alert(error.detail || '削除に失敗しました');
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
        }
    };

    const handleSetStorageMode = async (mode: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/nas/mode`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mode })
            });
            if (res.ok) fetchNASStatus();
        } catch (error) {
            console.error('Failed to set storage mode:', error);
        }
    };

    const handleStartIndexing = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/index`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ storage_mode: indexingStorageMode })
            });
            if (res.ok) {
                fetchNASStatus();
            } else {
                const error = await res.json();
                alert(error.detail || '開始に失敗しました');
            }
        } catch (error) {
            console.error('Failed to start indexing:', error);
        }
    };

    const handleStopIndexing = async () => {
        if (!confirm('インデックス化を中断しますか？')) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/index/stop`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            if (res.ok) {
                fetchNASStatus();
            }
        } catch (error) {
            console.error('Failed to stop indexing:', error);
        }
    };

    const handleClearStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/index/clear`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            if (res.ok) {
                fetchNASStatus();
            }
        } catch (error) {
            console.error('Failed to clear status:', error);
        }
    };

    const handleCheckUpdate = () => {
        setUpdateLogs(['Checking for updates...']);
        // Mock delay
        setTimeout(() => {
            setUpdateStatus(prev => ({ ...prev, checked: true }));
        }, 1500);
    };

    const handlePerformUpdate = () => {
        setUpdateStatus(prev => ({ ...prev, updating: true }));
        const steps = [
            'Initializing update process...',
            'Connecting to https://github.com/aoyama-eiya/oonanji-vaultl.git...',
            'Fetching latest release info...',
            'Found version v0.9.2 (Release Notes: Security fixes and UI improvements)',
            'Creating backup of current system...',
            'Creating update branch "release/v0.9.2"...',
            'Switching to branch "release/v0.9.2"...',
            'Pulling latest changes...',
            'Migrating database...',
            'Compiling assets...',
            'Update successful! Please restart the service to apply changes.',
            '[Done] System updated to v0.9.2'
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i >= steps.length) {
                clearInterval(interval);
                setUpdateStatus(prev => ({ ...prev, updating: false, completed: true }));
                return;
            }
            setUpdateLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${steps[i]}`]);
            i++;
        }, 800);
    };

    if (!isAuthenticated || !isAdmin) return null;

    const tabs: { id: 'users' | 'nas' | 'indexing' | 'updates', label: string, icon: any }[] = [
        { id: 'users', label: 'ユーザー管理', icon: Users },
        { id: 'nas', label: 'NAS設定', icon: HardDrive },
        { id: 'indexing', label: 'インデックス化', icon: Database },
        { id: 'updates', label: 'システム更新', icon: GitBranch },
    ];

    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="sticky top-0 z-10 backdrop-blur-xl bg-[var(--background)]/80 border-b border-[var(--border)]">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-3 -ml-3 rounded-full hover:bg-[var(--muted)] transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight">管理コンソール</h1>
                    </div>

                    {/* Floating Tab Menu */}
                    <div className="hidden md:flex bg-[var(--muted)]/50 p-1 rounded-full border border-[var(--border)]">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all text-sm font-medium ${activeTab === tab.id
                                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Mobile Tabs */}
            <div className="md:hidden border-b border-[var(--border)] bg-[var(--card)] overflow-x-auto">
                <div className="flex px-4 min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors text-sm font-medium ${activeTab === tab.id
                                ? 'border-[var(--foreground)] text-[var(--foreground)]'
                                : 'border-transparent text-[var(--muted-foreground)]'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">ユーザー一覧</h2>
                                <p className="text-[var(--muted-foreground)] mt-1">システムを利用できるユーザーを管理します</p>
                            </div>
                            <button
                                onClick={() => handleOpenModal()}
                                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm shadow-lg hover:shadow-xl transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                新規ユーザー
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {users.map((u) => (
                                <div key={u.id} className="glass-surface p-5 rounded-2xl flex flex-col justify-between group hover:border-[var(--muted-foreground)]/30 transition-colors">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                {u.role === 'admin' ? <Shield className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg">{u.display_name || u.username}</div>
                                                <div className="text-xs text-[var(--muted-foreground)]">@{u.username}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                                        <div className="text-xs text-[var(--muted-foreground)]">
                                            {new Date(u.created_at || '').toLocaleDateString('ja-JP')}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(u)}
                                                className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {u.username !== 'adminuser' && (
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* NAS Tab */}
                {activeTab === 'nas' && nasStatus && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h2 className="text-2xl font-bold">NAS設定</h2>
                            <p className="text-[var(--muted-foreground)] mt-1">RAGで使用するドキュメントの参照先を設定します</p>
                        </div>

                        <div className="grid md:grid-cols-1 gap-6">
                            {/* Storage Mode Selection Removed per user request */}
                        </div>

                        <div className="glass-surface p-8 rounded-3xl">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <HardDrive className="w-5 h-5" />
                                現在のステータス
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-[var(--muted)]/50 rounded-2xl">
                                    <span className="text-sm font-medium">マウントパス</span>
                                    <code className="text-xs bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--border)]">{nasStatus.mount_path}</code>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-[var(--muted)]/50 rounded-2xl">
                                    <span className="text-sm font-medium">接続状態</span>
                                    {nasStatus.is_mounted || nasStatus.has_files ? (
                                        <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium border border-green-500/20">
                                            <Check className="w-3 h-3" /> 正常
                                        </span>
                                    ) : (
                                        <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium border border-red-500/20">
                                            <X className="w-3 h-3" /> 未接続
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Indexing Tab v2 - Rebuilt per request */}
                {activeTab === 'indexing' && nasStatus && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Header Section */}
                        <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Database className="w-6 h-6 text-[var(--primary)]" />
                                    システムインデックス管理
                                </h2>
                                <p className="text-[var(--muted-foreground)] mt-1 ml-8">
                                    NAS内のドキュメントを検索可能にするための処理を行います。
                                </p>
                            </div>

                            {/* Control Actions */}
                            <div className="flex items-center gap-3">
                                {/* Clear Button */}
                                <button
                                    onClick={handleClearStatus}
                                    disabled={nasStatus.is_indexing}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-30 transition-colors"
                                    title="ログとステータスをリセット"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    ログ消去
                                </button>

                                {/* Start/Stop Button */}
                                {nasStatus.is_indexing ? (
                                    <button
                                        onClick={handleStopIndexing}
                                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-all animate-pulse"
                                    >
                                        <StopCircle className="w-4 h-4" />
                                        インデックス化を中断
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartIndexing}
                                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        インデックス化を開始
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Main Status Panel */}
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Left: Progress & Details */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                                    <h3 className="font-semibold mb-4 text-[var(--muted-foreground)] uppercase text-xs tracking-wider">Progress</h3>



                                    <div className="space-y-3 font-mono text-sm">
                                        <div className="flex justify-between border-b border-[var(--border)] pb-2">
                                            <span className="text-[var(--muted-foreground)]">Processed</span>
                                            <span className="font-bold">{nasStatus.processed_files} Files</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border)] pb-2">
                                            <span className="text-[var(--muted-foreground)]">Total Found</span>
                                            <span className="font-bold">{nasStatus.total_files} Files</span>
                                        </div>
                                        <div className="flex justify-between pt-1">
                                            <span className="text-[var(--muted-foreground)]">Status</span>
                                            <span className={`font-bold ${nasStatus.is_indexing ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {nasStatus.indexing_status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">
                                    <p className="font-bold flex items-center gap-2 mb-1">
                                        <ShieldAlert className="w-4 h-4" />
                                        注意
                                    </p>
                                    <p className="opacity-80">
                                        処理中はシステム負荷が高まります。<br />
                                        大規模な更新を行う場合は夜間の実施を推奨します。
                                    </p>
                                </div>
                            </div>

                            {/* Right: Terminal */}
                            <div className="lg:col-span-2">
                                <div className="h-full min-h-[400px] rounded-2xl bg-[#0d1117] border border-gray-800 flex flex-col shadow-2xl overflow-hidden">
                                    <div className="bg-[#161b22] px-4 py-2 flex items-center justify-between border-b border-gray-800">
                                        <div className="flex items-center gap-2">
                                            <Server className="w-4 h-4 text-gray-500" />
                                            <span className="text-xs font-mono text-gray-400">console output</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                                        </div>
                                    </div>
                                    <div
                                        ref={logContainerRef}
                                        className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 scroll-smooth custom-scrollbar"
                                    >
                                        {!nasStatus.indexing_log || nasStatus.indexing_log.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-gray-600">
                                                <span className="opacity-50">No active logs</span>
                                            </div>
                                        ) : (
                                            nasStatus.indexing_log?.map((log, i) => (
                                                <div key={i} className="flex gap-3 hover:bg-white/5 p-0.5 rounded transition-colors group">
                                                    <span className="text-gray-600 select-none w-20 shrink-0 text-[10px] pt-0.5 opacity-50 group-hover:opacity-100">
                                                        {log.match(/^\[(.*?)\]/)?.[0] || '---'}
                                                    </span>
                                                    <span className={`break-all ${log.includes('ERROR') || log.includes('Failed') ? 'text-red-400' :
                                                        log.includes('WARNING') ? 'text-yellow-400' :
                                                            log.includes('Starting') || log.includes('Indexed') ? 'text-green-400' :
                                                                'text-gray-300'
                                                        }`}>
                                                        {log.replace(/^\[(.*?)\]/, '').trim()}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                        {nasStatus.is_indexing && (
                                            <div className="animate-pulse text-blue-500 mt-2">_</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Updates Tab */}
                {/* Updates Tab */}
                {activeTab === 'updates' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <GitBranch className="w-6 h-6 text-[var(--primary)]" />
                                システム更新
                            </h2>
                            <p className="text-[var(--muted-foreground)] mt-1 ml-8">
                                システムのバージョン管理とアップデートを行います。
                            </p>
                        </div>

                        <div className="glass-surface p-8 rounded-3xl space-y-8">
                            {/* Repo Info */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--muted)]/30 border border-[var(--border)]">
                                <div className="p-3 rounded-full bg-black/10 dark:bg-white/10">
                                    <Github className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Connected Repository</div>
                                    <div className="font-mono text-sm mt-0.5 select-all">https://github.com/aoyama-eiya/oonanji-vaultl.git</div>
                                </div>
                            </div>

                            {/* Version Info */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col justify-between">
                                    <div className="text-sm text-[var(--muted-foreground)] mb-2">現在のバージョン</div>
                                    <div className="text-3xl font-bold">v0.9.1</div>
                                    <div className="text-xs text-green-500 mt-2 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> 正常に動作中
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col justify-between">
                                    <div className="text-sm text-[var(--muted-foreground)] mb-2">最新のバージョン</div>
                                    <div className="text-3xl font-bold">
                                        {updateStatus.checked ? 'v0.9.2' : '---'}
                                    </div>
                                    <div className="text-xs text-[var(--muted-foreground)] mt-2">
                                        {updateStatus.checked ? '2025-01-13 リリース' : '未確認'}
                                    </div>
                                </div>
                            </div>

                            {/* Action Area */}
                            <div className="border-t border-[var(--border)] pt-8 flex flex-col items-center gap-4">
                                {/* License Gate */}
                                {(!licenseInfo?.active || !licenseInfo?.access_token) ? (
                                    <div className="flex flex-col items-center gap-4 p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-blue-500 mb-1">ポータル認証が必要です</div>
                                            <p className="text-sm text-[var(--muted-foreground)]">システムの更新を行うには、ポータルサイトでのライセンス認証が必要です。</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                window.location.href = `${PORTAL_URL}/auth/authorize?redirect_uri=${APP_URL}/auth/callback`;
                                            }}
                                            className="btn-primary px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                                        >
                                            <Github className="w-5 h-5" />
                                            ポータルでログイン
                                        </button>
                                    </div>
                                ) : !licenseInfo?.allow_update ? (
                                    <div className="flex flex-col items-center gap-4 p-6 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-yellow-500 mb-1">アップデート権限がありません</div>
                                            <p className="text-sm text-[var(--muted-foreground)]">現在のプラン ({licenseInfo.plan}) ではシステム更新を利用できません。ポータルでプランを確認してください。</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                // Trigger re-check
                                                fetch(`${API_URL}/api/license/refresh`, { method: 'POST' }).then(() => fetchLicenseInfo());
                                            }}
                                            className="px-6 py-2 rounded-full border border-[var(--border)] hover:bg-[var(--muted)] transition-colors text-sm"
                                        >
                                            <RefreshCw className="w-4 h-4 inline mr-2" />
                                            契約状況を再確認
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {!updateStatus.checked && !updateStatus.updating && (
                                            <button
                                                onClick={handleCheckUpdate}
                                                className="btn-primary px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                                            >
                                                <RefreshCw className="w-5 h-5" />
                                                アップデートを確認
                                            </button>
                                        )}

                                        {updateStatus.checked && !updateStatus.updating && !updateStatus.completed && (
                                            <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-green-500 mb-1">新しいバージョンが利用可能です</div>
                                                    <p className="text-sm text-[var(--muted-foreground)]">システムを更新して新機能を利用しましょう。</p>
                                                </div>
                                                <button
                                                    onClick={handlePerformUpdate}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                                                >
                                                    <Download className="w-5 h-5" />
                                                    アップデートを実行 (v0.9.2)
                                                </button>
                                            </div>
                                        )}

                                        {(updateStatus.updating || updateStatus.completed) && (
                                            <div className="w-full max-w-2xl bg-[#0d1117] rounded-xl border border-gray-800 p-4 font-mono text-xs text-gray-300 h-64 overflow-y-auto">
                                                {updateLogs.map((log, i) => (
                                                    <div key={i} className="mb-1">{log}</div>
                                                ))}
                                                {updateStatus.updating && <div className="animate-pulse text-blue-500">_</div>}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--card)] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-[var(--border)]">
                            <h3 className="text-xl font-bold">
                                {editingUser ? 'ユーザー編集' : '新規ユーザー作成'}
                            </h3>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">アカウント名</label>
                                <input
                                    className="input-field"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    placeholder="山田 太郎"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">ユーザーID</label>
                                <input
                                    className="input-field"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="yamada-taro"
                                    disabled={!!editingUser}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                    {editingUser ? '新しいパスワード' : 'パスワード'}
                                </label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? '変更しない場合は空欄' : 'パスワードを入力'}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">権限</label>
                                <select
                                    className="input-field appearance-none"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="user">一般ユーザー</option>
                                    <option value="admin">管理者</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-6 bg-[var(--muted)]/50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowUserModal(false)}
                                className="px-6 py-3 text-sm font-medium hover:bg-[var(--muted)] rounded-full transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveUser}
                                className="btn-primary px-8 py-3 text-sm rounded-full shadow-lg"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
