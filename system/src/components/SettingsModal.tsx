import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/lib/settings-context';
import { useTranslation } from '@/lib/use-translation';
import { useAuth } from '@/lib/auth-context';
import {
    Users, HardDrive, Database, Server,
    RefreshCw, StopCircle, Check, Loader2, Shield,
    Plus, Edit2, Trash2, FileText, X, Key,
    GitBranch, Github, Download, Power
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean, onChange: (enabled: boolean) => void }) => (
    <button
        onClick={() => onChange(!enabled)}
        className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'}`}
    >
        <div
            className={`absolute top-0.5 w-5 h-5 bg-[var(--background)] rounded-full transition-transform shadow-sm ${enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
        />
    </button>
);

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { settings, updateSettings } = useSettings();
    const { t } = useTranslation();
    const { logout, isAdmin } = useAuth();

    // Tab State
    const [activeTab, setActiveTab] = useState('general');
    const [showSystemLicense, setShowSystemLicense] = useState(false);

    // Admin State
    const [users, setUsers] = useState<any[]>([]);
    const [nasStatus, setNasStatus] = useState<any>(null);
    const [indexingStorageMode, setIndexingStorageMode] = useState<'nas'>('nas');
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [formData, setFormData] = useState({ username: '', display_name: '', password: '', role: 'user' });
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [pendingIndexingAction, setPendingIndexingAction] = useState<'start' | 'stop' | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // License State
    const [licenseInfo, setLicenseInfo] = useState<any>(null);
    const [isUpdatingLicense, setIsUpdatingLicense] = useState(false);
    const [updatingLicenseStatus, setUpdatingLicenseStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
    const [licenseError, setLicenseError] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');

    // Update State
    const [updateStatus, setUpdateStatus] = useState({
        checked: false,
        updating: false,
        completed: false,
        channel: 'stable' // 'stable' | 'beta'
    });
    const [updateLogs, setUpdateLogs] = useState<string[]>([]);

    // Model Management State
    const [modelFiles, setModelFiles] = useState<any[]>([]);
    const [downloadTasks, setDownloadTasks] = useState<{ [key: string]: any }>({}); // task_id -> status

    const AVAILABLE_MODELS = [
        { name: 'nomic-embed-text-v1.5.f16.gguf', url: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/18d1044f4866e224159fce8c6fc5c4f3920176e7/nomic-embed-text-v1.5.f16.gguf', desc: 'Embedding Model (Recommended)' },
        { name: 'Qwen2-VL-2B-Instruct-Q4_0.gguf', url: 'https://huggingface.co/bartowski/Qwen2-VL-2B-Instruct-GGUF/resolve/main/Qwen2-VL-2B-Instruct-Q4_0.gguf', desc: 'Vision Language Model (Lightweight)' },
        { name: 'qwen2.5-3b-instruct-q4_0.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_0.gguf', desc: 'Standard Instruct Model' },
        { name: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Triangle104/Qwen2.5-Coder-7B-Instruct-Q4_K_M-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf', desc: 'Coding Specialized Model' },
        { name: 'qwen2-1.5b-instruct-q8_0.gguf', url: 'https://huggingface.co/Yolozh/Qwen2-1.5B-Instruct-Q8_0-GGUF/resolve/main/qwen2-1.5b-instruct-q8_0.gguf', desc: 'Ultra Lightweight' }
    ];

    const fetchModelFiles = async () => {
        try {
            const res = await fetch(`${API_URL}/api/models/list`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (res.ok) setModelFiles(await res.json());
        } catch (e) {
            console.error("Failed to fetch models", e);
        }
    };

    const startDownload = async (model: any) => {
        try {
            const res = await fetch(`${API_URL}/api/models/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                body: JSON.stringify({ url: model.url, filename: model.name })
            });
            if (res.ok) {
                const data = await res.json();
                setDownloadTasks(prev => ({ ...prev, [model.name]: { taskId: data.task_id, status: 'started', progress: 0 } }));
                pollDownloadStatus(model.name, data.task_id);
            }
        } catch (e) {
            console.error("Download start failed", e);
        }
    };

    const pollDownloadStatus = (modelName: string, taskId: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/models/download/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                });
                if (res.ok) {
                    const status = await res.json();
                    setDownloadTasks(prev => ({ ...prev, [modelName]: { ...prev[modelName], ...status } }));

                    if (status.status === 'completed' || status.status === 'error') {
                        clearInterval(interval);
                        fetchModelFiles(); // Refresh list
                    }
                }
            } catch (e) {
                clearInterval(interval);
            }
        }, 1000);
    };

    useEffect(() => {
        if (activeTab === 'models') {
            fetchModelFiles();
        }
    }, [activeTab]);



    const handleCheckUpdate = () => {
        setUpdateLogs([`Checking for updates in ${updateStatus.channel} channel...`]);
        // Mock delay
        setTimeout(() => {
            setUpdateStatus(prev => ({ ...prev, checked: true }));
        }, 1500);
    };

    const handlePerformUpdate = () => {
        setUpdateStatus(prev => ({ ...prev, updating: true }));
        const steps = updateStatus.channel === 'beta' ? [
            'Initializing BETA update process...',
            'Connecting to https://github.com/oonanji/ooanji-vault.git...',
            'Switching to usage of "main" branch (Developer Mode)...',
            'Fetching latest commits...',
            'Pulling latest changes from main...',
            'Migrating database...',
            'Compiling assets...',
            'Update successful! Please restart.',
            '[Done] System updated to latest source (Beta)'
        ] : [
            'Initializing update process...',
            'Connecting to https://github.com/oonanji/ooanji-vault.git...',
            'Fetching latest Release Tags...',
            'Found latest tag: v1.0.0 (Initial Public Release)',
            'Checking out tag "v1.0.0"...',
            'Pulling latest changes...',
            'Migrating database...',
            'Compiling assets...',
            'Update successful! Please restart the service to apply changes.',
            '[Done] System updated to v1.0.0'
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

    const handleDirectLogin = async () => {
        setUpdatingLicenseStatus('verifying');
        setLicenseError('');
        try {
            const res = await fetch(`${API_URL}/api/license/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, password: authPassword })
            });
            const data = await res.json();

            if (res.ok && data.valid) {
                setUpdatingLicenseStatus('success');
                console.log("License Linked:", data);
                setTimeout(() => {
                    setIsUpdatingLicense(false);
                    setAuthPassword(''); // Clear sensitive data
                }, 2000);
            } else {
                setUpdatingLicenseStatus('error');
                setLicenseError(data.error || 'ログインに失敗しました。');
            }
        } catch (e) {
            setUpdatingLicenseStatus('error');
            setLicenseError('通信エラーが発生しました。');
            console.error(e);
        }
    };

    // Fetch Data
    const getToken = () => localStorage.getItem('access_token');

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (error) { console.error(error); }
    };

    const fetchNASStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/nas/status`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNasStatus(data);
            }
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (isOpen && isAdmin) {
            if (activeTab === 'users') fetchUsers();
            if (activeTab === 'nas' || activeTab === 'indexing') {
                fetchNASStatus();
                const interval = setInterval(fetchNASStatus, 2000);
                return () => clearInterval(interval);
            }
            if (activeTab === 'license' || activeTab === 'updates') {
                fetchLicenseInfo();
            }
        }
    }, [isOpen, isAdmin, activeTab]);

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

    // Scroll logs
    // Smart Scroll for logs
    useEffect(() => {
        const el = logContainerRef.current;
        if (el) {
            // Check if user is near bottom (within 100px)
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            if (isNearBottom) {
                el.scrollTop = el.scrollHeight;
            }
        }
    }, [nasStatus?.indexing_log]);

    if (!isOpen) return null;

    const handleLogout = () => {
        logout();
        onClose();
    };

    // User Management Handlers
    const handleOpenUserModal = (u?: any) => {
        setEditingUser(u);
        setFormData(u ? { ...u, password: '' } : { username: '', display_name: '', password: '', role: 'user' });
        setShowUserModal(true);
    };

    const handleSaveUser = async () => {
        try {
            const url = editingUser ? `${API_URL}/api/admin/users/${editingUser.id}` : `${API_URL}/api/admin/users`;
            const method = editingUser ? 'PUT' : 'POST';
            const body: any = { display_name: formData.display_name, role: formData.role };
            if (!editingUser) { body.username = formData.username; body.password = formData.password; }
            else if (formData.password) body.password = formData.password;

            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) { setShowUserModal(false); fetchUsers(); }
            else alert('Error saving user');
        } catch (e) { console.error(e); }
    };

    const handleDeleteUser = async (u: any) => {
        if (!confirm('Delete user?')) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${u.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) fetchUsers();
        } catch (e) { console.error(e); }
    };

    // NAS Handlers
    const handleSetStorageMode = async (mode: string) => {
        try {
            await fetch(`${API_URL}/api/admin/nas/mode`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            fetchNASStatus();
        } catch (e) { console.error(e); }
    };



    const handleIndexing = async (action: 'start' | 'stop') => {
        if (action === 'stop') {
            setShowStopConfirm(true);
            setPendingIndexingAction('stop');
            return;
        }
        executeIndexing(action);
    };

    const confirmStopIndexing = () => {
        if (pendingIndexingAction) {
            executeIndexing(pendingIndexingAction);
            setShowStopConfirm(false);
            setPendingIndexingAction(null);
        }
    };

    const executeIndexing = async (action: 'start' | 'stop') => {
        try {
            await fetch(`${API_URL}/api/admin/index${action === 'stop' ? '/stop' : ''}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
                body: action === 'start' ? JSON.stringify({ storage_mode: indexingStorageMode }) : undefined
            });
            fetchNASStatus();
        } catch (e) { console.error(e); }
    };
    const handleClearIndexing = async () => {
        if (!confirm('本当にデータベースを削除しますか？\n全てのインデックス情報が削除され、検索には再インデックスが必要になります。')) return;

        try {
            await fetch(`${API_URL}/api/admin/index/clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            fetchNASStatus();
            alert('データベースを削除しました。');
        } catch (e) {
            console.error(e);
            alert('削除に失敗しました。');
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 animate-fade-in modal-overlay bg-black/50 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />

            <div className="relative w-full h-full md:max-w-4xl md:h-[80vh] rounded-none md:rounded-3xl bg-[var(--card)] border-0 md:border border-[var(--border)] shadow-2xl flex flex-col md:flex-row overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 bg-[var(--muted)]/30 border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-row md:flex-col p-4 gap-2 overflow-x-auto md:overflow-visible shrink-0 items-center md:items-stretch">
                    <h2 className="text-xl font-bold px-4 mb-0 md:mb-4 hidden md:block">{t('settings')}</h2>

                    {/* Mobile Close Button */}
                    <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-[var(--muted)] mr-2 shrink-0">
                        <X className="w-5 h-5" />
                    </button>

                    <button onClick={() => setActiveTab('general')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-[var(--background)] shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'}`}>
                        {t('general_settings')}
                    </button>

                    {isAdmin && (
                        <>
                            <div className="text-xs font-bold text-[var(--muted-foreground)] uppercase mt-6 mb-2 px-3">
                                {t('admin_section')}
                            </div>
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors mb-1
                                    ${activeTab === 'users' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}
                                `}
                            >
                                <Users size={16} />
                                <span>{t('user_management')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('nas')}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors mb-1
                                    ${activeTab === 'nas' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}
                                `}
                            >
                                <HardDrive size={16} />
                                <span>{t('nas_storage')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('license')}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors mb-1
                                    ${activeTab === 'license' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}
                                `}
                            >
                                <Key size={16} />
                                <span>アカウント連携</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('indexing')}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors mb-1
                                    ${activeTab === 'indexing' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}
                                `}
                            >
                                <Database size={16} />
                                <span>{t('indexing')}</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('updates')}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors mb-1
                                    ${activeTab === 'updates' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}
                                `}
                            >
                                <GitBranch size={16} />
                                <span>システム更新</span>
                            </button>
                        </>
                    )}

                    <div className="mt-0 md:mt-auto hidden md:block">
                        <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                            {t('logout')}
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-8 relative">


                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-lg font-bold mb-6">{t('general_settings')}</h3>

                            <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
                                <span className="text-sm font-medium">{t('theme')}</span>
                                <div className="flex items-center gap-2 p-1 rounded-full bg-[var(--muted)]">
                                    <button onClick={() => updateSettings({ theme: 'light' })} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${settings.theme === 'light' ? 'bg-[var(--background)] shadow-sm' : ''}`}>{t('theme_light')}</button>
                                    <button onClick={() => updateSettings({ theme: 'dark' })} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${settings.theme === 'dark' ? 'bg-[var(--background)] shadow-sm' : ''}`}>{t('theme_dark')}</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
                                <span className="text-sm font-medium">{t('language')}</span>
                                <div className="flex items-center gap-2 p-1 rounded-full bg-[var(--muted)]">
                                    <button onClick={() => updateSettings({ language: 'ja' })} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${settings.language === 'ja' ? 'bg-[var(--background)] shadow-sm' : ''}`}>日本語</button>
                                    <button onClick={() => updateSettings({ language: 'en' })} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${settings.language === 'en' ? 'bg-[var(--background)] shadow-sm' : ''}`}>English</button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
                                <span className="text-sm font-medium">{t('font_size')}</span>
                                <div className="flex items-center gap-2 p-1 rounded-full bg-[var(--muted)]">
                                    {([['small', t('size_small')], ['medium', t('size_medium')], ['large', t('size_large')]] as const).map(([size, label]) => (
                                        <button key={size} onClick={() => updateSettings({ fontSize: size })} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${settings.fontSize === size ? 'bg-[var(--background)] shadow-sm' : ''}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
                                <span className="text-sm font-medium">{t('animations')}</span>
                                <ToggleSwitch enabled={settings.animationsEnabled} onChange={(value) => updateSettings({ animationsEnabled: value })} />
                            </div>

                            <div>
                                <button
                                    onClick={() => setShowSystemLicense(true)}
                                    className="w-full py-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs transition-colors flex items-center justify-center gap-2 hover:underline"
                                >
                                    このシステムについて
                                </button>
                            </div>

                        </div>
                    )}



                    {activeTab === 'users' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold">ユーザー管理</h3>
                                <button onClick={() => handleOpenUserModal()} className="flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm hover:opacity-90">
                                    <Plus className="w-4 h-4" /> 新規ユーザー
                                </button>
                            </div>
                            <div className="grid gap-4">
                                {users.map((u) => (
                                    <div key={u.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <div className="font-bold text-sm">{u.display_name}</div>
                                                <div className="text-xs text-[var(--muted-foreground)]">@{u.username}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleOpenUserModal(u)} className="p-2 hover:bg-[var(--muted)] rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                            {u.username !== 'adminuser' && <button onClick={() => handleDeleteUser(u)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-lg font-bold">システム設定</h3>

                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            <Power className="w-5 h-5" />
                                            自動起動 (Ubuntu)
                                        </div>
                                        <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                            PC起動時にOonanji Vaultサーバーを自動的に開始します。
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-[var(--muted)]/30 p-4 rounded-lg space-y-4">
                                    <div className="text-sm">
                                        以下のコマンドをUbuntuのターミナルで実行して設定してください。
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-[var(--muted-foreground)]">方法1: Docker (推奨)</div>
                                        <div className="bg-black/80 text-white p-3 rounded font-mono text-xs overflow-x-auto">
                                            # 自動起動を有効化<br />
                                            docker update --restart unless-stopped oonanji-vault-backend-1<br />
                                            docker update --restart unless-stopped oonanji-vault-frontend-1
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-[var(--muted-foreground)]">方法2: Systemd (スクリプト管理)</div>
                                        <div className="bg-black/80 text-white p-3 rounded font-mono text-xs overflow-x-auto">
                                            # 以下のファイルを作成: /etc/systemd/system/oonanji-vault.service<br />
                                            <br />
                                            [Unit]<br />
                                            Description=Oonanji Vault Service<br />
                                            After=network.target<br />
                                            <br />
                                            [Service]<br />
                                            Type=simple<br />
                                            User={'{'}USER{'}'}<br />
                                            WorkingDirectory=/path/to/oonanji-vault<br />
                                            ExecStart=/path/to/oonanji-vault/start.sh<br />
                                            Restart=always<br />
                                            <br />
                                            [Install]<br />
                                            WantedBy=multi-user.target
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'nas' && nasStatus && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-lg font-bold">NAS情報</h3>

                            {/* Storage Mode Selection Removed */}



                            <div className="p-6 rounded-2xl bg-[var(--muted)]/30 border border-[var(--border)] space-y-3">
                                <div className="text-sm font-bold flex items-center gap-2"><HardDrive className="w-4 h-4" /> 現在のステータス</div>
                                <div className="flex justify-between text-sm"><span>マウントパス</span><code className="bg-[var(--background)] px-2 py-1 rounded">{nasStatus.mount_path}</code></div>
                                <div className="flex justify-between text-sm"><span>状態</span>
                                    {nasStatus.is_mounted ? <span className="text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> 接続OK</span> : <span className="text-red-500">未接続</span>}
                                </div>
                            </div>
                        </div>
                    )}




                    {activeTab === 'indexing' && nasStatus && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-lg font-bold">システムインデックス管理</h3>

                            {/* Control Bar */}
                            <div className="flex items-center gap-4 bg-[var(--muted)]/30 p-4 rounded-2xl">
                                <div className="flex-1">
                                    <p className="text-sm text-[var(--muted-foreground)]">ドキュメントのインデックス化プロセスを管理します。</p>
                                </div>
                                <button onClick={() => handleIndexing(nasStatus.is_indexing ? 'stop' : 'start')} className={`px-6 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 ${nasStatus.is_indexing ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-[var(--foreground)] text-[var(--background)]'}`}>
                                    {nasStatus.is_indexing ? <><StopCircle className="w-4 h-4" /> 中断</> : <><RefreshCw className="w-4 h-4" /> 開始</>}
                                </button>
                                <button
                                    onClick={handleClearIndexing}
                                    className="px-4 py-2.5 rounded-full text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                                    title="古いインデックス情報を削除します"
                                >
                                    <Trash2 className="w-4 h-4" /> データベースを削除
                                </button>
                            </div>

                            {/* Status Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                                    <div className="text-xs text-[var(--muted-foreground)] mb-1">最終インデックス日時</div>
                                    <div className="font-bold text-sm">
                                        {nasStatus.last_indexed_at ? new Date(nasStatus.last_indexed_at).toLocaleString('ja-JP') : '未実行'}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                                    <div className="text-xs text-[var(--muted-foreground)] mb-1">インデックス済みドキュメント</div>
                                    <div className="font-bold text-sm flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-blue-500" />
                                        {nasStatus.total_indexed_documents || 0} 件
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                                    <div className="text-xs text-[var(--muted-foreground)] mb-1">ストレージ使用量 (DB)</div>
                                    <div className="font-bold text-sm flex items-center gap-2">
                                        <Database className="w-4 h-4 text-purple-500" />
                                        {(() => {
                                            const bytes = nasStatus.chroma_usage || 0;
                                            if (bytes === 0) return '0 B';
                                            const k = 1024;
                                            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                                            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                        })()}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                                    <div className="text-xs text-[var(--muted-foreground)] mb-1">ステータス</div>
                                    <div className={`font-bold text-sm flex items-center gap-2 ${nasStatus.is_indexing ? 'text-blue-500' : 'text-[var(--foreground)]'}`}>
                                        {nasStatus.is_indexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-gray-400" />}
                                        {nasStatus.indexing_status}
                                    </div>
                                </div>
                            </div>

                            {/* Progress & Logs */}
                            <div className="p-6 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">進捗状況</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-mono">{nasStatus.processed_files} / {nasStatus.total_files} Files</div>
                                    </div>
                                </div>

                                <div className="relative w-full bg-[var(--muted)] h-4 rounded-full overflow-hidden border border-[var(--border)]">
                                    <div
                                        className={`absolute top-0 left-0 h-full transition-all duration-300 ${nasStatus.is_indexing ? 'bg-blue-500 striped-bar-animation' : 'bg-[var(--foreground)]'}`}
                                        style={{ width: `${nasStatus.indexing_progress}%` }}
                                    />
                                    {/* Text inside bar if enough space, or center */}
                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">
                                        {Math.round(nasStatus.indexing_progress)}%
                                    </div>
                                </div>

                                <div
                                    ref={logContainerRef}
                                    className="bg-[#1e1e1e] text-gray-300 p-4 rounded-xl h-48 overflow-y-auto font-mono text-xs space-y-1 scroll-smooth custom-scrollbar"
                                >
                                    {nasStatus.indexing_log?.length ? nasStatus.indexing_log.map((l: string, i: number) => (
                                        <div key={i} className="break-all border-b border-white/5 pb-0.5 mb-0.5 last:border-0 hover:bg-white/5 transition-colors">
                                            {l.replace(/^\[(.*?)\]/, '').trim()}
                                        </div>
                                    )) : <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50"><Server className="w-8 h-8 mb-2" /><p>ログはありません</p></div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'license' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-[var(--card)] p-6 rounded-xl border border-[var(--border)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-blue-500/10 blur-[64px] rounded-full pointer-events-none" />
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                                    アカウント連携・ライセンス
                                </h3>

                                <div className="flex items-center gap-4 mb-6 relative z-10">
                                    <div>
                                        <div className="text-sm text-[var(--muted-foreground)] mb-1">現在のエディション</div>
                                        <div className={`font-bold text-lg ${(licenseInfo?.active && licenseInfo?.plan) ? 'text-green-400' : 'text-gray-400'}`}>
                                            {licenseInfo?.plan ? licenseInfo.plan.toUpperCase() : '未認証 / Free'}
                                        </div>
                                        <div className="text-xs text-[var(--muted-foreground)] mt-1 opacity-70">
                                            ステータス: {licenseInfo?.active ? '有効' : '未認証'}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-[var(--border)] relative z-10">
                                    <h4 className="text-sm font-bold mb-2">ライセンス認証</h4>
                                    {!isUpdatingLicense ? (
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-[var(--muted-foreground)]">
                                                ポータルサイトのアカウントでログインしてください。
                                            </p>
                                            <button
                                                onClick={() => {
                                                    const PORTAL_URL = 'https://oonanji-vault.com';
                                                    const APP_URL = window.location.origin;
                                                    window.open(`${PORTAL_URL}/auth/authorize?redirect_uri=${APP_URL}/auth/callback`, '_blank');
                                                }}
                                                className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] text-sm transition-colors whitespace-nowrap shrink-0"
                                            >
                                                ポータルを開く
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                                            {updatingLicenseStatus === 'idle' || updatingLicenseStatus === 'error' ? (
                                                <div className="p-4 bg-[var(--muted)]/30 rounded-lg border border-[var(--border)]">
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs font-bold text-[var(--muted-foreground)] block mb-1">メールアドレス</label>
                                                            <input
                                                                type="email"
                                                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 text-sm"
                                                                placeholder="user@example.com"
                                                                value={authEmail}
                                                                onChange={(e) => setAuthEmail(e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-[var(--muted-foreground)] block mb-1">パスワード</label>
                                                            <input
                                                                type="password"
                                                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 text-sm"
                                                                placeholder="••••••••"
                                                                value={authPassword}
                                                                onChange={(e) => setAuthPassword(e.target.value)}
                                                            />
                                                        </div>

                                                        {licenseError && (
                                                            <p className="text-red-400 text-xs flex items-center gap-1">
                                                                <X className="w-3 h-3" /> {licenseError}
                                                            </p>
                                                        )}

                                                        <button
                                                            onClick={handleDirectLogin}
                                                            disabled={!authEmail || !authPassword}
                                                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                                                        >
                                                            ログインして連携
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 bg-green-500/10 rounded-lg border border-green-500/20">
                                                    <Check className="w-8 h-8 mx-auto text-green-500 mb-2" />
                                                    <p className="font-bold text-green-500">認証完了！</p>
                                                    <p className="text-xs text-[var(--muted-foreground)]">アカウントが正常に連携されました。</p>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setIsUpdatingLicense(false);
                                                    setUpdatingLicenseStatus('idle');
                                                    setAuthPassword('');
                                                    setLicenseError('');
                                                }}
                                                className="w-full py-2 hover:bg-[var(--muted)] rounded-lg text-xs text-[var(--muted-foreground)]"
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    {activeTab === 'updates' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <GitBranch className="w-5 h-5 text-[var(--primary)]" />
                                    システム更新
                                </h2>
                                <p className="text-[var(--muted-foreground)] mt-1 ml-7 text-sm">
                                    システムのバージョン管理とアップデートを行います。
                                </p>
                            </div>

                            <div className="bg-[var(--muted)]/20 p-6 rounded-2xl border border-[var(--border)] space-y-6">
                                {/* Beta Toggle moved to top */}
                                <div className="flex items-center gap-3 w-full justify-end">
                                    <label className="text-xs font-bold text-[var(--muted-foreground)] flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={updateStatus.channel === 'beta'}
                                            onChange={(e) => setUpdateStatus(prev => ({ ...prev, channel: e.target.checked ? 'beta' : 'stable', checked: false }))}
                                            className="rounded border-[var(--border)]"
                                        />
                                        ベータ版 (Developer Mode)を表示
                                    </label>
                                </div>

                                {/* Version Info */}
                                <div className={`grid gap-4 ${updateStatus.channel === 'beta' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2'}`}>
                                    <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] flex flex-col justify-between">
                                        <div className="text-xs text-[var(--muted-foreground)] mb-1">現在のバージョン</div>
                                        <div className="text-xl font-bold">v1.0.0</div>
                                        <div className="text-[10px] text-green-500 mt-1 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> 正常
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] flex flex-col justify-between">
                                        <div className="text-xs text-[var(--muted-foreground)] mb-1">最新の安定版 (Stable)</div>
                                        <div className="text-xl font-bold">
                                            {updateStatus.checked ? 'v1.0.0' : '---'}
                                        </div>
                                        <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                                            {updateStatus.checked ? 'Latest Release Tag' : '未確認'}
                                        </div>
                                    </div>
                                    {updateStatus.channel === 'beta' && (
                                        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 flex flex-col justify-between">
                                            <div className="text-xs text-purple-500 font-bold mb-1">最新のベータ版 (Dev)</div>
                                            <div className="text-xl font-bold text-purple-400">
                                                {updateStatus.checked ? 'Latest (Main)' : '---'}
                                            </div>
                                            <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                                                Main Branch
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Area */}
                                <div className="border-t border-[var(--border)] pt-6 flex flex-col items-center gap-4">
                                    {/* Beta Toggle removed from here, moved to top */}

                                    {/* License Gate - More permissive check */}
                                    {(!licenseInfo?.active) ? (
                                        <div className="flex flex-col items-center gap-3 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 w-full">
                                            <div className="text-center">
                                                <div className="text-sm font-bold text-blue-500 mb-0.5">認証が必要です</div>
                                                <p className="text-xs text-[var(--muted-foreground)]">更新を行うにはライセンス認証が必要です。</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const PORTAL_URL = 'https://oonanji-vault.com';
                                                    const APP_URL = window.location.origin;
                                                    window.open(`${PORTAL_URL}/auth/authorize?redirect_uri=${APP_URL}/auth/callback`, '_blank');
                                                }}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center gap-2 shadow-sm transition-all text-sm"
                                            >
                                                <Github className="w-4 h-4" />
                                                ポータルでログイン
                                            </button>
                                        </div>
                                    ) : (!licenseInfo?.allow_update && !['starter', 'enterprise', 'corporate_subscribed', 'free', 'personal'].includes(licenseInfo?.plan?.toLowerCase())) ? (
                                        <div className="flex flex-col items-center gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20 w-full">
                                            <div className="text-center">
                                                <div className="text-sm font-bold text-yellow-500 mb-0.5">権限がありません</div>
                                                <p className="text-xs text-[var(--muted-foreground)]">プラン({licenseInfo.plan})を確認してください。</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    fetch(`${API_URL}/api/license/refresh`, { method: 'POST' }).then(() => fetchLicenseInfo());
                                                }}
                                                className="px-4 py-1.5 rounded-full border border-[var(--border)] hover:bg-[var(--muted)] transition-colors text-xs"
                                            >
                                                <RefreshCw className="w-3 h-3 inline mr-1" />
                                                再確認
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {!updateStatus.checked && !updateStatus.updating && (
                                                <button
                                                    onClick={handleCheckUpdate}
                                                    className="px-6 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-full flex items-center gap-2 shadow-sm hover:opacity-90 transition-all text-sm font-medium"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    アップデートを確認
                                                </button>
                                            )}

                                            {updateStatus.checked && !updateStatus.updating && !updateStatus.completed && (
                                                <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2 w-full">
                                                    <div className="text-center">
                                                        <div className="text-sm font-bold text-green-500 mb-0.5">新しいバージョンが利用可能です</div>
                                                        <p className="text-xs text-[var(--muted-foreground)]">
                                                            {updateStatus.channel === 'beta' ? 'Updating to latest Main branch' : 'Current -> v1.0.0'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={handlePerformUpdate}
                                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-full flex items-center gap-2 shadow-md transition-all text-sm font-medium"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        アップデートを実行
                                                    </button>
                                                </div>
                                            )}

                                            {(updateStatus.updating || updateStatus.completed) && (
                                                <div className="w-full bg-[#0d1117] rounded-xl border border-gray-800 p-3 font-mono text-[10px] text-gray-300 h-48 overflow-y-auto">
                                                    {updateLogs.map((log, i) => (
                                                        <div key={i} className="mb-0.5">{log}</div>
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
            </div >

            {/* User Edit Modal Layer */}
            {
                showUserModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-[var(--card)] w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold mb-4">{editingUser ? 'ユーザー編集' : '新規ユーザー'}</h3>
                            <div className="space-y-4">
                                <input className="w-full bg-[var(--muted)] p-3 rounded-lg text-sm" placeholder="表示名" value={formData.display_name} onChange={e => setFormData({ ...formData, display_name: e.target.value })} />
                                <input className="w-full bg-[var(--muted)] p-3 rounded-lg text-sm" placeholder="ユーザーID" value={formData.username} disabled={!!editingUser} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                                <input className="w-full bg-[var(--muted)] p-3 rounded-lg text-sm" type="password" placeholder={editingUser ? 'パスワード (変更する場合のみ)' : 'パスワード'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                <select className="w-full bg-[var(--muted)] p-3 rounded-lg text-sm" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    <option value="user">一般ユーザー</option>
                                    <option value="admin">管理者</option>
                                </select>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => setShowUserModal(false)} className="px-4 py-2 hover:bg-[var(--muted)] rounded-lg text-sm">キャンセル</button>
                                    <button onClick={handleSaveUser} className="px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg text-sm">保存</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Indexing Stop Confirmation Modal */}
            {
                showStopConfirm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-[var(--card)] w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold mb-2">インデックス化を中断しますか？</h3>
                            <p className="text-sm text-[var(--muted-foreground)] mb-6">
                                現在進行中の処理は停止されますが、これまでにインデックス化されたデータは保持されます。
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowStopConfirm(false)}
                                    className="px-4 py-2 rounded-xl bg-[var(--muted)] hover:bg-[var(--muted)]/80 transition-colors font-medium text-sm"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={confirmStopIndexing}
                                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm"
                                >
                                    中断する
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* System License Modal */}
            {
                showSystemLicense && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowSystemLicense(false)}>
                        <div className="bg-[var(--card)] w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border)]" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/50">
                                <h3 className="font-bold text-lg">System License</h3>
                                <button onClick={() => setShowSystemLicense(false)} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <pre className="text-xs font-mono whitespace-pre-wrap text-[var(--muted-foreground)] bg-[var(--muted)]/30 p-4 rounded-xl border border-[var(--border)] leading-relaxed">
                                    {`Business Source License 1.1

Parameters

Licensor:           Oonanji-Vault Project
Licensed Work:      Oonanji Vault (the software and source code and documentation in this repository)
Additional Use Grant:
                    Personal and non-commercial use of the Licensed Work is permitted free of charge.
                    This includes permanent use, provided that any updates to the software are 
                    performed manually by the user.
                    
                    Any use of the Licensed Work for commercial purposes, including but not 
                    limited to internal business operations within a corporation or entity, 
                    is permitted only with a valid paid license agreement from the Licensor.
Change Date:        2030-01-01
Change License:     Apache License, Version 2.0

--------------------------------------------------------------------------------

Business Source License 1.1

License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved.
"Business Source License" is a trademark of MariaDB Corporation Ab.

Terms

The Licensor hereby grants you the right to copy, modify, create derivative works, 
redistribute, and make non-production use of the Licensed Work. The Licensor may 
make an Additional Use Grant, above, permitting limited production use.

Effective on the Change Date, or the fourth anniversary of the first publicly 
available distribution of a specific version of the Licensed Work under this 
License, whichever comes first, the Licensor hereby grants you rights under the 
terms of the Change License, and the rights granted in the paragraph above 
terminate.

If your use of the Licensed Work does not comply with the requirements in 
effect prior to the Change Date, you must purchase a commercial license from 
the Licensor, or refrain from using the Licensed Work.

All copies of the original and modified Licensed Work, and derivative works of 
the Licensed Work, are subject to this License. This License applies to all 
versions of the Licensed Work that are not yet subject to the Change License 
due to the passage of time.

You must conspicuously display this License on each original or modified copy of 
the Licensed Work.

The Licensed Work is provided "as is". Except as required by law or as expressly 
provided in this License, the Licensor makes no representations or warranties of 
any kind concerning the Licensed Work, express, implied, statutory or otherwise, 
including, without limitation, warranties of title, merchantability, fitness for 
a particular purpose, non-infringement, or the absence of latent or other 
defects, accuracy, or the presence or absence of errors, whether or not 
discoverable.

Covenants of Licensor

The Licensor covenants that, as of the Change Date, the Licensed Work will 
become available under the Change License. The Licensor will take all steps 
necessary to ensure that the Licensed Work is available under the Change 
License on the Change Date.`}
                                </pre>
                                <div className="mt-6">
                                    <h4 className="font-bold mb-3 text-sm">Included Software</h4>
                                    <ul className="space-y-2 text-xs text-[var(--muted-foreground)]">
                                        <li>• Qwen2.5 (Apache 2.0) - Alibaba Cloud</li>
                                        <li>• Nomic Embed (Apache 2.0) - Nomic AI</li>
                                        <li>• llama.cpp (MIT) - Georgi Gerganov</li>
                                        <li>• Next.js, React, TailwindCSS (MIT)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )

            }
        </div>
    );
}