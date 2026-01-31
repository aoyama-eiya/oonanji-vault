'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { useTranslation } from '@/lib/use-translation';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import {
    Settings,
    Send,
    ChevronDown,
    ChevronRight,
    Shield,
    Database,
    MessageSquare,
    ArrowUp,
    Square,
    Menu,
    Plus,
    MoreVertical,
    Trash2,
    Edit2,
    Copy,
    Check,
    FileText,
    X,
    Loader2,
    Paperclip,
    Folder,
    File,
    HardDrive,
    Search,
    Download,
    LayoutGrid,
    List,
    Image as ImageIcon
} from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { CanvasPanel } from '@/components/CanvasPanel';
import { LicenseModal } from '@/components/LicenseModal';
import { AIModel, ChatMessage } from '@/types';
// NasFileExplorerModal is implemented inline or not needed as separate import yet





type ModelMode = 'Fast' | 'Agent';

type ChatSession = {
    id: string;
    title: string;
    updated_at: string;
};

type Canvas = {
    id: string;
    session_id: string;
    title: string;
    content: string;
    language: string;
    created_at: string;
    updated_at: string;
};

type AttachedFile = {
    id?: string;
    name: string;
    content?: string;
    status: 'uploading' | 'queued' | 'chunking' | 'embedding' | 'indexing' | 'ready' | 'error';
    progress: number;
    error?: string;
};

export default function DashboardPage() {
    const { user, isAuthenticated, isAdmin } = useAuth();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const router = useRouter();
    // useSearchParams is only available in Client Components, but we are one.
    // However, DashboardPage is typically rendered inside a Suspense boundary if using useSearchParams.
    // As we can't easily change the parent, we'll try to use window.location or assume it's safe.
    // Ideally use useSearchParams from next/navigation.
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Initialize sidebar state for mobile
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, []);

    const [historyOpen, setHistoryOpen] = useState(true);
    const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
    const [modelMenuPos, setModelMenuPos] = useState<{ top: number, right: number } | null>(null);
    const [dbSearchEnabled, setDbSearchEnabled] = useState(false);
    const [selectedMode, setSelectedMode] = useState<ModelMode>('Fast');

    // Check for settings param
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('settings') === 'true') {
                setSettingsOpen(true);
            }
        }
    }, []);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
    const [isComposing, setIsComposing] = useState(false); // For IME input handling
    const [currentAiMessageId, setCurrentAiMessageId] = useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [clipMenuOpen, setClipMenuOpen] = useState(false);
    const [nasModalOpen, setNasModalOpen] = useState(false);
    const [currentPath, setCurrentPath] = useState('');
    const [nasFiles, setNasFiles] = useState<any[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [driveModalOpen, setDriveModalOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [driveMode, setDriveMode] = useState<'chat_history' | 'nas' | 'canvases'>('chat_history');
    const [driveSearchQuery, setDriveSearchQuery] = useState('');

    useEffect(() => {
        // Force list view
        setViewMode('list');
    }, []);

    useEffect(() => {
        localStorage.setItem('driveViewMode', viewMode);
    }, [viewMode]);

    // Chat States
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // Delete Confirmation Modal State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'chat' | 'drive', name: string, id?: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Canvas State
    const [canvasOpen, setCanvasOpen] = useState(false);
    const [canvasContent, setCanvasContent] = useState('');
    const [canvasLanguage, setCanvasLanguage] = useState('');

    const [canvases, setCanvases] = useState<Canvas[]>([]);
    const [currentCanvas, setCurrentCanvas] = useState<Canvas | null>(null);
    const [licenseModalOpen, setLicenseModalOpen] = useState(false);

    const handleOpenCanvas = useCallback((content: string, language: string, canvas?: Canvas) => {
        setCanvasContent(content);
        setCanvasLanguage(language);
        setCurrentCanvas(canvas || null);
        setCanvasOpen(true);
        // Close sidebar when Canvas opens for more workspace
        setSidebarOpen(false);
    }, []);

    const persistCanvasState = async (content?: string, language?: string, sessionId?: string) => {
        const targetSessionId = sessionId || currentSessionId;
        const targetContent = content !== undefined ? content : canvasContent;
        const targetLanguage = language !== undefined ? language : canvasLanguage;

        if (!targetSessionId || !targetContent) return;

        try {
            const token = localStorage.getItem('access_token');
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

            let url = `${API_BASE_URL}/api/canvases`;
            let method = 'POST';
            let body: any = {
                session_id: targetSessionId,
                content: targetContent,
                language: targetLanguage,
                title: t('canvas_untitled')
            };

            // Use the Canvas Title if available (extract from content?)
            // For now, simple logic.

            if (currentCanvas && currentCanvas.session_id === targetSessionId) {
                url = `${API_BASE_URL}/api/canvases/${currentCanvas.id}`;
                method = 'PUT';
                body.title = currentCanvas.title; // Keep existing title
            }

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Failed to auto-save canvas:', res.status, errorText);
                return;
            }
            const saved = await res.json();

            setCurrentCanvas(saved);
            setCanvases(prev => {
                const exists = prev.find(c => c.id === saved.id);
                if (exists) return prev.map(c => c.id === saved.id ? saved : c);
                return [saved, ...prev];
            });
        } catch (e) {
            console.error("Auto-save failed", e);
        }
    };

    const fetchCanvases = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API_BASE_URL}/api/canvases`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCanvases(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (driveModalOpen && driveMode === 'canvases') {
            fetchCanvases();
        }
    }, [driveModalOpen, driveMode]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    // Fetch Drive Files (now fetches sessions if driveMode is 'chat_history')
    // Fetch Drive Files (now fetches sessions if driveMode is 'chat_history')
    const fetchDriveFiles = async () => {
        if (driveMode === 'chat_history') {
            fetchSessions();
        } else if (driveMode === 'nas') {
            fetchNasFiles('');
        } else if (driveMode === 'canvases') { // New mode for Canvases
            fetchCanvases();
        }
    };

    // Canvas list state (moved up)



    useEffect(() => {
        if (driveModalOpen) fetchDriveFiles();
    }, [driveModalOpen, driveMode]);

    const handleDriveFileSelect = async (file: any) => {
        // This function is now effectively for NAS files or future drive files
        // For chat history, selection means loading the session
        if (driveMode === 'chat_history' && file.id) {
            loadSession(file.id);
            setDriveModalOpen(false);
        }
    };

    const handleDeleteDriveFile = (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteTarget({ type: 'drive', name: filename });
        setDeleteConfirmOpen(true);
    };

    const handleNasFileSelect = async (file: any) => {
        // Single click just selects (maybe for details or preparation)
        // For now, only handle files for attachment if clicked?
        // User requested "Double click opens folder".
        // Let's implement double click via separate handler and keep single click for selection.
    };

    const [previewFile, setPreviewFile] = useState<{ name: string, content?: string, url?: string, type: 'text' | 'pdf' | 'image' | 'unsupported' } | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Clean up object URLs when modal closes
    useEffect(() => {
        if (!showPreviewModal && previewFile?.url) {
            URL.revokeObjectURL(previewFile.url);
            setPreviewFile(null);
        }
    }, [showPreviewModal]);

    const handleNasFileDoubleClick = async (file: any) => {
        if (file.is_dir) {
            const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
            fetchNasFiles(newPath, 'nas');
        } else {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const token = localStorage.getItem('access_token');
            const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

            if (['txt', 'md', 'json', 'py', 'js', 'ts', 'tsx', 'css', 'html', 'log', 'sh', 'csv', 'yml', 'yaml'].includes(ext)) {
                try {
                    const res = await fetch(`${API_URL}/api/nas/read?path=${encodeURIComponent(fullPath)}&source=nas`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setPreviewFile({ name: file.name, content: data.content, type: 'text' });
                        setShowPreviewModal(true);
                    }
                } catch (e) { console.error(e); }
            } else if (ext === 'pdf') {
                try {
                    const res = await fetch(`${API_URL}/api/nas/content?path=${encodeURIComponent(fullPath)}&source=nas`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        setPreviewFile({ name: file.name, url, type: 'pdf' });
                        setShowPreviewModal(true);
                    }
                } catch (e) { console.error(e); }
            } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                try {
                    const res = await fetch(`${API_URL}/api/nas/content?path=${encodeURIComponent(fullPath)}&source=nas`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        setPreviewFile({ name: file.name, url, type: 'image' });
                        setShowPreviewModal(true);
                    }
                } catch (e) { console.error(e); }
            } else {
                console.log("Unsupported file type for preview");
            }
        }
    }

    // Fetch NAS files
    const fetchNasFiles = async (path: string, source: 'nas' = 'nas') => {
        setLoadingFiles(true);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/nas/list?path=${encodeURIComponent(path)}&source=${source}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNasFiles(data);
                setCurrentPath(path);
            }
        } catch (error) {
            console.error('Failed to fetch NAS files:', error);
        } finally {
            setLoadingFiles(false);
        }
    };

    useEffect(() => {
        if (nasModalOpen) {
            fetchNasFiles('');
        }
    }, [nasModalOpen]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 9 * 24)}px`; // Approx 9 lines
        }
    }, [input]);

    // Fetch sessions on load
    useEffect(() => {
        if (isAuthenticated) {
            fetchSessions();
        }
    }, [isAuthenticated]);

    const fetchSessions = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API_URL}/api/chat/sessions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.map((s: any) => ({
                    ...s,
                    updated_at: s.updated_at,
                    createdAt: s.created_at || s.updated_at // Fallback
                })));
            }
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        }
    };

    const loadSession = async (sessionId: string) => {
        try {
            setLoading(true);
            setCurrentSessionId(sessionId);
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.map((msg: any) => ({
                    id: msg.id.toString(),
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp
                })));
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setLoading(false);
            if (window.innerWidth < 768) setSidebarOpen(false);
        }
    };

    const handleMenuClick = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (menuOpenId === sessionId) {
            setMenuOpenId(null);
            setMenuPosition(null);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setMenuPosition({ top: rect.bottom, left: rect.left });
            setMenuOpenId(sessionId);
        }
    };

    const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteTarget({ type: 'chat', id: sessionId, name: 'chat session' });
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

            if (deleteTarget.type === 'chat' && deleteTarget.id) {
                const res = await fetch(`${API_URL}/api/chat/sessions/${deleteTarget.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Delete failed');

                setSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
                if (currentSessionId === deleteTarget.id) {
                    setCurrentSessionId(null);
                    setMessages([]);
                }
                setMenuOpenId(null);
            } else if (deleteTarget.type === 'drive') {
                const res = await fetch(`${API_URL}/api/drive/delete/${encodeURIComponent(deleteTarget.name)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Delete failed');
                // If drive files were managed, this would trigger a re-fetch
                // For now, this branch is mostly for NAS files if they were to be deleted via 'drive' type
            }
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setDeleteConfirmOpen(false);
            setDeleteTarget(null);
        }
    };

    const handleExportPDF = async (sessionId: string, title: string) => {
        try {
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch session');
            const history = await res.json();

            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            const html = `
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                .message { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
                .role { font-weight: bold; margin-bottom: 5px; color: #333; }
                .role.user { color: #0066cc; }
                .role.assistant { color: #009900; }
                .content { white-space: pre-wrap; }
                h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <p style="font-size: 10px; color: #666;">Exported on ${new Date().toLocaleString()}</p>
              ${history.map((msg: any) => `
                <div class="message">
                  <div class="role ${msg.role}">${msg.role === 'user' ? 'User' : 'Assistant'}</div>
                  <div class="content">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
              `).join('')}
            </body>
          </html>
        `;

            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export PDF');
        }
    };

    const startRenaming = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSessionId(sessionId);
        setEditTitle(currentTitle);
        setMenuOpenId(null);
    };

    const saveRename = async (sessionId: string) => {
        if (!editTitle || !editTitle.trim()) {
            setEditingSessionId(null);
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: editTitle })
            });
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: editTitle } : s));
        } catch (error) {
            console.error('Failed to rename session:', error);
        } finally {
            setEditingSessionId(null);
        }
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const models: { [key in ModelMode]: AIModel } = {
        'Fast': { id: '2', name: 'Qwen2.5 3B', filename: 'qwen2.5-3b-instruct-q4_0.gguf', size: 2000000000, type: 'GGUF', isActive: true },
        'Agent': { id: 'agent', name: 'Oonanji Agent', filename: 'agent-core', size: 0, type: 'Agent', isActive: true },
    };

    const selectedModel = models[selectedMode];

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    // ESC key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isStreaming) {
                handleStopGeneration();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isStreaming]);

    // License Check
    useEffect(() => {
        const checkLicense = async () => {
            try {
                const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
                const res = await fetch(`${API_BASE_URL}/api/license/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.active) {
                        setLicenseModalOpen(true);
                    }
                }
            } catch (error) {
                console.error("License check failed", error);
            }
        };
        if (isAuthenticated) {
            checkLicense();
        }
    }, [isAuthenticated]);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset to calculate true height
            const maxHeight = 192; // max-h-48 (12rem * 16px)
            const newHeight = Math.min(textarea.scrollHeight, maxHeight);

            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [input]);

    const handleStopGeneration = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setIsStreaming(false);
            setLoading(false);
        }
    };

    // Polling for file status
    useEffect(() => {
        const pendingFiles = attachedFiles.filter(f => f.id && f.status !== 'ready' && f.status !== 'error');
        if (pendingFiles.length === 0) return;

        const timer = setInterval(async () => {
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

            let updated = false;
            const newFiles = [...attachedFiles];

            for (const file of pendingFiles) {
                if (!file.id) continue;
                try {
                    const res = await fetch(`${API_URL}/api/chat/file/${file.id}/status`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const statusData = await res.json();
                        // Find index in current state (state might have changed due to user deleting file)
                        const idx = newFiles.findIndex(f => f.id === file.id);
                        if (idx !== -1) {
                            if (newFiles[idx].status !== statusData.status || newFiles[idx].progress !== statusData.progress) {
                                newFiles[idx] = {
                                    ...newFiles[idx],
                                    status: statusData.status,
                                    progress: statusData.progress || 0,
                                    error: statusData.error
                                };
                                updated = true;
                            }
                        }
                    }
                } catch (e) { console.error("Status check failed", e); }
            }

            if (updated) {
                setAttachedFiles(newFiles);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [attachedFiles]);

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setClipMenuOpen(false); // Close menu immediately
        setIsUploading(true);
        console.log("Starting upload...", e.target.files);
        const token = localStorage.getItem('access_token');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

        try {
            // Process sequentially
            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i];
                // Optimistically add file to UI
                const tempId = Date.now().toString() + i;
                setAttachedFiles(prev => [...prev, {
                    name: file.name,
                    status: 'uploading',
                    progress: 0,
                    id: undefined // no server ID yet
                }]);

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const res = await fetch(`${API_URL}/api/chat/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    const responseText = await res.text();
                    console.log("Upload response:", responseText);

                    if (res.ok) {
                        const data = JSON.parse(responseText);
                        setAttachedFiles(prev => prev.map(f => {
                            if (f.name === file.name && f.status === 'uploading' && !f.id) {
                                return { ...f, id: data.file_id, status: 'queued', progress: 0 };
                            }
                            return f;
                        }));
                    } else {
                        console.error("Upload failed with status:", res.status);
                        // Mark as error
                        setAttachedFiles(prev => prev.map(f => {
                            if (f.name === file.name && f.status === 'uploading' && !f.id) {
                                return { ...f, status: 'error', progress: 0, error: 'Upload failed' };
                            }
                            return f;
                        }));
                        alert(`アップロードに失敗しました (Status: ${res.status})`);
                    }
                } catch (err) {
                    console.error("Upload error:", err);
                    setAttachedFiles(prev => prev.map(f => {
                        if (f.name === file.name && f.status === 'uploading' && !f.id) {
                            return { ...f, status: 'error', progress: 0, error: 'Network error' };
                        }
                        return f;
                    }));
                    alert('アップロード中にエラーが発生しました');
                }
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleChatDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleSendMessage = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || loading) return;

        // Block if files are not ready
        if (attachedFiles.some(f => f.status !== 'ready' && f.status !== 'error')) {
            alert('ファイルの分析が完了するまでお待ちください。');
            return;
        }

        let messageContent = input;
        const fileIds = attachedFiles.map(f => f.id).filter(Boolean);
        const fileTexts = attachedFiles.filter(f => !f.id && f.content).map(f => `--- File: ${f.name} ---\n${f.content}\n--- End File ---`).join('\n\n');

        if (fileTexts) {
            messageContent = `以下の添付ファイルの内容を参照して回答してください:\n\n${fileTexts}\n\n質問:\n${input}`;
        }

        // If we have file IDs, we don't append text to the message, we send IDs.
        // But for "User Interface", we still want to show that files were sent?
        // The messages list update is purely visual on the client side initially.
        // To keep the visual consistency, we can append "Attached Files: [Name]" to the stored user message content.

        const displayContent = messageContent + (fileIds.length > 0 ? `\n\n[Attached ${fileIds.length} file(s)]` : '');

        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: displayContent, timestamp: new Date().toISOString() };

        setMessages((prev) => [...prev, userMessage]);

        // For the actual request
        const requestMessage = messageContent;

        const currentInput = requestMessage;
        setInput('');
        setAttachedFiles([]);
        setLoading(true);
        setIsStreaming(true);
        setStreamingStatus(fileIds.length > 0 ? '添付ファイルを分析中...' : '準備中...');

        // Create AI message placeholder ID
        const aiMessageId = (Date.now() + 1).toString();
        setCurrentAiMessageId(aiMessageId);

        try {
            const token = localStorage.getItem('access_token');
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

            const controller = new AbortController();
            setAbortController(controller);

            const res = await fetch(`${API_URL}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: currentInput,
                    model_id: selectedModel.id,
                    use_nas: dbSearchEnabled,
                    session_id: currentSessionId,
                    attached_file_ids: fileIds,
                    canvas_mode: input.toLowerCase().includes('canvas') || input.includes('キャンバス') // Auto-enable if keyword found
                }),
                signal: controller.signal
            });

            if (!res.ok) {
                throw new Error('Failed to get response');
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';
            let newSessionId = currentSessionId;
            let newTitle = null;
            let finalCanvasContent: string | null = null;

            let finalCanvasLanguage: string = 'markdown';
            let hasOpenedCanvas = canvasOpen;

            while (true) {
                const { done, value } = await reader!.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.status) {
                                setStreamingStatus(data.status);
                            }

                            if (data.content !== undefined) {
                                fullResponse += data.content;


                                // CANVAS PARSING LOGIC
                                // 1. Open immediately if start tag found
                                if (!hasOpenedCanvas && fullResponse.includes('<<<CANVAS_START>>>')) {
                                    setCanvasOpen(true);
                                    hasOpenedCanvas = true;
                                }

                                // Check for Canvas protocol markers
                                // Use greedy match for content to capture everything until the end tag or EOF
                                const canvasStartRegex = /<<<CANVAS_START>>>\n(?:Title: (.*)\n)?(?:Language: (.*)\n)?<<<CONTENT_START>>>\n([\s\S]*)(?:<<<CANVAS_END>>>|$)/;
                                const match = canvasStartRegex.exec(fullResponse);

                                if (match) {
                                    // We found a canvas block! 
                                    // Extract data
                                    const title = match[1] || 'Untitled';
                                    const language = match[2] || 'markdown';
                                    let content = match[3];

                                    // Remove the closing tag from content if it was captured by the greedy match (because $ matches end of string, but if tag exists, greedy cleans up?)
                                    // Actually, if greedy match hits CANAVS_END, we need to strip it.
                                    const endTagIndex = content.indexOf('<<<CANVAS_END>>>');
                                    if (endTagIndex !== -1) {
                                        content = content.substring(0, endTagIndex);
                                    }

                                    // Auto-open logic handled above
                                    // if (!canvasOpen) setCanvasOpen(true);

                                    setCanvasContent(content);
                                    setCanvasLanguage(language);
                                    finalCanvasContent = content;
                                    finalCanvasLanguage = language;

                                    // TODO: We should probably save to DB here or at the end?
                                    // For now just local state.
                                }

                                setMessages((prev) => {
                                    const existing = prev.find(msg => msg.id === aiMessageId);
                                    if (existing) {
                                        return prev.map((msg) =>
                                            msg.id === aiMessageId ? { ...msg, content: fullResponse } : msg
                                        );
                                    } else {
                                        return [...prev, {
                                            id: aiMessageId,
                                            role: 'assistant' as const,
                                            content: fullResponse,
                                            timestamp: new Date().toISOString()
                                        }];
                                    }
                                });
                            }
                            if (data.status) {
                                setStreamingStatus(data.status);
                            }
                            if (data.session_id) {
                                newSessionId = data.session_id;
                            }
                            if (data.title) {
                                newTitle = data.title;
                            }
                            if (data.done) {
                                // Strip agent logs from final display (keeping only final answer)
                                // Logs are lines starting with "> 🧠", "> 🛠️", "> 🔍", "> ❌"
                                const logPattern = /^>\s*(?:🧠|🛠️|🔍|❌).*$/gm;
                                const cleanedResponse = fullResponse.replace(logPattern, '').replace(/\n{3,}/g, '\n\n').trim();
                                fullResponse = cleanedResponse;

                                // Update message with cleaned response
                                setMessages((prev) => {
                                    return prev.map((msg) =>
                                        msg.id === aiMessageId ? { ...msg, content: cleanedResponse } : msg
                                    );
                                });

                                // Update session list
                                if (newSessionId && !currentSessionId) {
                                    setCurrentSessionId(newSessionId);
                                    fetchSessions();
                                } else if (newSessionId) {
                                    setSessions(prev => {
                                        const others = prev.filter(s => s.id !== newSessionId);
                                        const current = prev.find(s => s.id === newSessionId);
                                        if (current) {
                                            return [{ ...current, updated_at: new Date().toISOString() }, ...others];
                                        }
                                        return prev;
                                    });
                                }
                            }
                            if (data.error) {
                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === aiMessageId ? { ...msg, content: `エラー: ${data.error}` } : msg
                                    )
                                );
                            }
                            // Handle Canvas content from agent
                            if (data.canvas_content) {
                                setCanvasContent(data.canvas_content);
                                setCanvasLanguage(data.canvas_language || 'html');
                                setCanvasOpen(true);
                                setSidebarOpen(false); // Close sidebar for canvas workspace
                                finalCanvasContent = data.canvas_content;
                                finalCanvasLanguage = data.canvas_language || 'html';
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e);
                        }
                    }
                }
            }

            if (finalCanvasContent) {
                await persistCanvasState(finalCanvasContent, finalCanvasLanguage, newSessionId || currentSessionId || undefined);
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Request aborted');
            } else {
                console.error('Chat error:', error);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId
                            ? { ...msg, content: 'エラーが発生しました。バックエンドサーバーが起動していることを確認してください。' }
                            : msg
                    )
                );
            }
        } finally {
            setLoading(false);
            setIsStreaming(false);
            setStreamingStatus(null);
            setCurrentAiMessageId(null);
            setAbortController(null);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="h-screen bg-[var(--background)] p-0 md:p-4 flex overflow-hidden relative">
            {/* Sidebar */}
            <div
                onClick={(e) => {
                    // Toggle if the click didn't originate from an interactive element
                    if (!(e.target as HTMLElement).closest('button')) {
                        setSidebarOpen(!sidebarOpen);
                    }
                }}
                className={`floating-panel h-full flex flex-col justify-between transition-all duration-300 md:mr-4 border-0 md:border cursor-ew-resize ${sidebarOpen
                    ? 'md:w-64 w-full fixed inset-0 z-50 md:relative md:inset-auto md:rounded-2xl rounded-none'
                    : 'md:w-16 hidden md:flex md:rounded-[2rem]' // Reduced width
                    }`}
            >
                {/* Top Section */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className={`p-3 ${!sidebarOpen && 'flex justify-center'}`}>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="px-3 py-2.5 rounded-lg hover:bg-[rgb(var(--muted))] transition-colors"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={`flex-1 flex flex-col p-3 min-h-0 ${!sidebarOpen ? 'items-center' : 'items-stretch'}`}>
                        {/* Action Buttons - Moved 'justify-center' logic to button level for collapsing */}
                        <div className={`flex flex-col gap-1 ${!sidebarOpen && 'items-center'}`}>
                            <button
                                onClick={startNewChat}
                                className={`flex items-center py-2.5 rounded-full hover:bg-[var(--muted)] hover:shadow-sm transition-all duration-200 text-left text-xs ${sidebarOpen ? 'gap-3 px-3' : 'justify-center w-full px-0'}`}
                            >
                                <Plus className="w-4 h-4 flex-shrink-0" />
                                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>{t('sidebar_chat')}</span>
                            </button>

                            <button
                                onClick={() => { setDriveModalOpen(true); fetchDriveFiles(); }}
                                className={`flex items-center py-2.5 rounded-full hover:bg-[var(--muted)] hover:shadow-sm transition-all duration-200 text-left text-xs ${sidebarOpen ? 'gap-3 px-3' : 'justify-center w-full px-0'}`}
                            >
                                <HardDrive className="w-4 h-4 flex-shrink-0" />
                                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>{t('sidebar_drive')}</span>
                            </button>

                            <div className="hidden"></div>
                        </div>

                        {sidebarOpen && (
                            <button
                                onClick={() => setHistoryOpen(!historyOpen)}
                                className="w-full group flex items-center justify-between mt-8 mb-2 px-3 transition-colors"
                            >
                                <h3 className="text-[10px] items-center flex font-bold text-[var(--muted-foreground)]/70 uppercase tracking-wider group-hover:text-[var(--foreground)] transition-colors">
                                    {t('history')}
                                </h3>
                                <div className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    {historyOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </div>
                            </button>
                        )}

                        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-0.5 min-h-0 custom-scrollbar">
                            {sidebarOpen && historyOpen && sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    className={`group relative flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-all cursor-pointer ${currentSessionId === session.id ? 'bg-[var(--muted)]' : ''}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {editingSessionId === session.id ? (
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                onBlur={() => saveRename(session.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveRename(session.id);
                                                    if (e.key === 'Escape') setEditingSessionId(null);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                                className="w-full bg-transparent border-none focus:outline-none text-xs p-0"
                                            />
                                        ) : (
                                            <span className="text-xs truncate">{session.title}</span>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={(e) => handleMenuClick(session.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--background)] rounded-full transition-all"
                                        >
                                            <MoreVertical className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Popup Menu (Fixed Position) */}
                {menuOpenId && menuPosition && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }} />
                        <div
                            className="fixed w-32 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1"
                            style={{ top: menuPosition.top, left: menuPosition.left }}
                        >
                            <button
                                onClick={(e) => startRenaming(menuOpenId, sessions.find(s => s.id === menuOpenId)?.title || '', e)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--muted)] flex items-center gap-2"
                            >
                                <Edit2 className="w-3 h-3" /> 名前変更
                            </button>
                            <button
                                onClick={(e) => deleteSession(menuOpenId, e)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--muted)] text-red-500 flex items-center gap-2"
                            >
                                <Trash2 className="w-3 h-3" /> 削除
                            </button>
                        </div>
                    </>
                )}

                {/* Bottom Section */}
                <div className={`p-3 ${!sidebarOpen && 'flex justify-center'}`}>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-full hover:bg-[var(--muted)] hover:shadow-md transition-all duration-200 text-left text-xs ${!sidebarOpen && 'w-auto justify-center'}`}
                    >
                        <Settings className="w-4 h-4" />
                        {sidebarOpen && <span>{t('settings')}</span>}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div
                className="floating-panel flex-1 flex flex-col h-full overflow-hidden relative min-w-0 md:rounded-2xl rounded-none border-0 md:border"
                onDrop={handleChatDrop}
                onDragOver={handleDragOver}
            >
                <header className="h-14 flex-shrink-0 flex items-center px-4 md:px-6 gap-3 bg-transparent relative z-10 justify-between">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="md:hidden p-2 -ml-2 text-[var(--foreground)] hover:bg-[var(--muted)] rounded-full transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <h1 className="text-base font-semibold">Oonanji Vault</h1>
                </header>

                <main className="flex-1 overflow-y-auto bg-transparent relative z-10 p-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="space-y-6">
                            {messages.length > 0 && (
                                <>
                                    {messages.map((message) => {
                                        const isCurrentAi = message.id === currentAiMessageId;
                                        const hasContent = message.content.trim().length > 0;
                                        if (isCurrentAi && !hasContent) return null;

                                        return (
                                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--muted)]'}`}>
                                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                                        {/* Custom Renderer to hide Canvas raw data and show button */}
                                                        {(() => {
                                                            const canvasStartRegex = /<<<CANVAS_START>>>[\s\S]*?<<<CANVAS_END>>>/g;
                                                            const parts = message.content.split(canvasStartRegex);
                                                            const matches = message.content.match(canvasStartRegex);

                                                            return (
                                                                <>
                                                                    {parts.map((part, i) => (
                                                                        <React.Fragment key={i}>
                                                                            <MarkdownRenderer content={part} onOpenCanvas={handleOpenCanvas} />
                                                                            {matches && matches[i] && (
                                                                                <div className="my-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm flex items-center justify-between group hover:border-[var(--foreground)] transition-colors cursor-pointer"
                                                                                    onClick={() => {
                                                                                        // Extract content to open
                                                                                        const m = matches[i];
                                                                                        const contentMatch = /<<<CONTENT_START>>>\n([\s\S]*?)<<<CANVAS_END>>>/.exec(m);
                                                                                        const langMatch = /Language: (.*)\n/.exec(m);
                                                                                        if (contentMatch) {
                                                                                            handleOpenCanvas(contentMatch[1], langMatch ? langMatch[1] : 'markdown');
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                                                                                            <Edit2 className="w-5 h-5" />
                                                                                        </div>
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-semibold text-[var(--foreground)]">Canvas Created</span>
                                                                                            <span className="text-xs text-[var(--muted-foreground)]">Click to open and edit</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] group-hover:translate-x-1 transition-transform" />
                                                                                </div>
                                                                            )}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                            {loading && (
                                !currentAiMessageId ||
                                !messages.find(m => m.id === currentAiMessageId) ||
                                !messages.find(m => m.id === currentAiMessageId)?.content.trim()
                            ) && (
                                    <div className="flex justify-start">
                                        <div className="message-bubble message-assistant flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="loading-dots">
                                                    <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
                                                </div>
                                                {streamingStatus && (
                                                    <span className="text-xs text-[var(--muted-foreground)] animate-pulse">
                                                        {streamingStatus}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </main>

                <div className="relative z-20 w-full px-4 pb-6">
                    <div
                        className={`w-full max-w-3xl mx-auto transition-all duration-1000 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${messages.length === 0 ? '-translate-y-[40vh]' : 'translate-y-0'
                            }`}
                    >
                        {messages.length === 0 && (
                            <div className="mb-8 text-center animate-in fade-in zoom-in-95 duration-700">
                                <h2 className="text-4xl font-bold text-[var(--muted-foreground)]/20 select-none">
                                    {t('welcome_message')}
                                </h2>
                            </div>
                        )}
                        <div className={`relative bg-[var(--card)] rounded-[2.5rem] shadow-lg border border-[var(--border)] transition-all duration-300 focus-within:shadow-2xl focus-within:ring-2 focus-within:ring-[var(--primary)]/20 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {(attachedFiles.length > 0 || isUploading) && (
                                <div className="flex flex-wrap gap-2 px-6 pt-3 pb-1">
                                    {attachedFiles.map((file, i) => (
                                        <div key={i} className={`group relative bg-[var(--background)] border border-[var(--border)] rounded-xl p-2 pr-2 flex items-center gap-3 animate-in zoom-in-50 duration-200 min-w-[200px] ${file.status === 'error' ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                                            <div className="p-1.5 bg-[var(--muted)] rounded-lg text-[var(--foreground)] relative overflow-hidden">
                                                {file.status === 'ready' ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : file.status === 'error' ? (
                                                    <X className="w-4 h-4 text-red-500" />
                                                ) : (
                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0 mr-6">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-semibold truncate" title={file.name}>{file.name}</span>
                                                    <span className="text-[9px] text-[var(--muted-foreground)] ml-2 whitespace-nowrap">
                                                        {file.status === 'ready' ? '完了' :
                                                            file.status === 'error' ? 'エラー' :
                                                                `${file.progress}%`}
                                                    </span>
                                                </div>
                                                {/* Progress Bar */}
                                                {file.status !== 'ready' && file.status !== 'error' && (
                                                    <div className="h-1 w-full bg-[var(--muted)] rounded-full mt-1 overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                                                            style={{ width: `${Math.max(5, file.progress)}%` }}
                                                        />
                                                    </div>
                                                )}
                                                {file.status === 'error' && (
                                                    <span className="text-[9px] text-red-500 truncate">{file.error || 'Failed'}</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute top-1.5 right-1.5 bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-red-500 hover:bg-[var(--card)] border border-[var(--border)] rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted-foreground)] animate-pulse">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Uploading...</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center pl-2 pr-3 py-2 gap-2">
                                {/* Clip Button */}
                                <div className="relative flex-shrink-0">
                                    <button
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setMenuPosition({ top: rect.top - 10, left: rect.left }); // Adjust position slightly up
                                            setClipMenuOpen(!clipMenuOpen);
                                        }}
                                        className="p-2.5 hover:bg-[var(--muted)] rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                        {dbSearchEnabled && (
                                            <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[var(--card)] shadow-sm" />
                                        )}
                                    </button>

                                    {/* Popover Menu - Portal to body to escape transform contexts */}
                                    {clipMenuOpen && typeof document !== 'undefined' && createPortal(
                                        <>
                                            {/* Backdrop */}
                                            <div
                                                className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[1px]"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setClipMenuOpen(false);
                                                }}
                                            />
                                            {/* Menu */}
                                            <div
                                                className="fixed w-60 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl z-[9999] overflow-hidden animate-in zoom-in-95 duration-200"
                                                style={{
                                                    top: (menuPosition?.top || 0) + 0, // Position relative to button
                                                    left: menuPosition?.left || 0,
                                                    transform: 'translateY(-100%) translateY(-10px)' // Move up by 100% of height + 10px gap
                                                }}
                                            >
                                                <div className="p-1.5 space-y-0.5">
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        onChange={handleFileUpload}
                                                    />
                                                    <button
                                                        onClick={triggerFileUpload}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--muted)] transition-colors text-left group"
                                                    >
                                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors shrink-0">
                                                            <File className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-sm font-medium whitespace-nowrap">{t('upload_file_action')}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setDbSearchEnabled(!dbSearchEnabled); setClipMenuOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--muted)] transition-colors text-left group"
                                                    >
                                                        <div className={`p-2 rounded-lg transition-colors shrink-0 ${dbSearchEnabled ? 'bg-green-500/10 text-green-500' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                                                            <Database className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium whitespace-nowrap">{t('db_search')}</span>
                                                        </div>
                                                        {dbSearchEnabled && <Check className="w-3 h-3 text-green-500 ml-auto" />}
                                                    </button>

                                                </div>
                                            </div>
                                        </>,
                                        document.body
                                    )}
                                </div>

                                {/* Text Area */}
                                <div className="flex-1 flex items-center relative min-h-[44px]">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onCompositionStart={() => setIsComposing(true)}
                                        onCompositionEnd={(e) => {
                                            setIsComposing(false);
                                            // Ensure the final composed text is captured
                                            setInput((e.target as HTMLTextAreaElement).value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isComposing) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder={t('input_placeholder')}
                                        rows={1}
                                        className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-48 py-2 text-sm placeholder:text-xs placeholder:text-[var(--muted-foreground)] leading-tight self-center shadow-none ring-0"
                                        style={{ minHeight: '24px' }}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Model Selector */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setModelMenuPos({ top: rect.top, right: window.innerWidth - rect.right });
                                                setModelSelectorOpen(!modelSelectorOpen);
                                            }}
                                            className="flex items-center gap-2 pl-2 pr-1.5 h-9 rounded-full bg-[var(--muted)]/50 hover:bg-[var(--muted)] transition-all text-xs font-medium border border-transparent hover:border-[var(--border)]"
                                        >
                                            <span className="-translate-y-px">
                                                {settings.language === 'ja'
                                                    ? (selectedMode === 'Fast' ? '高速' : '秘書モード')
                                                    : selectedMode}
                                            </span>
                                            <ChevronDown className="w-3 h-3 opacity-50" />
                                        </button>

                                        {modelSelectorOpen && typeof document !== 'undefined' && createPortal(
                                            <>
                                                <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setModelSelectorOpen(false); }} />
                                                <div
                                                    className="fixed w-56 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl z-[70] overflow-hidden animate-in zoom-in-95 duration-200"
                                                    style={{
                                                        top: (modelMenuPos?.top || 0) + 0,
                                                        right: (modelMenuPos?.right || 0) + 0,
                                                        transform: 'translateY(-100%) translateY(-10px)'
                                                    }}
                                                >
                                                    <div className="p-2 space-y-1">
                                                        {(Object.keys(models) as ModelMode[]).map((mode) => (
                                                            <button
                                                                key={mode}
                                                                onClick={() => { setSelectedMode(mode); setModelSelectorOpen(false); }}
                                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left ${selectedMode === mode ? 'bg-[var(--muted)]' : 'hover:bg-[var(--muted)]/50'}`}
                                                            >
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-sm font-medium">
                                                                        {settings.language === 'ja'
                                                                            ? (mode === 'Fast' ? '高速' : '秘書モード')
                                                                            : mode}
                                                                    </span>
                                                                    {settings.language !== 'ja' && (
                                                                        <span className="text-[10px] text-[var(--muted-foreground)]">{models[mode].name}</span>
                                                                    )}
                                                                </div>
                                                                {selectedMode === mode && <Check className="w-3 h-3" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>,
                                            document.body
                                        )}
                                    </div>

                                    {/* Send Button */}
                                    <button
                                        onClick={isStreaming ? handleStopGeneration : handleSendMessage}
                                        title={isStreaming ? t('stop_generation') : t('send_message')}
                                        disabled={(!input.trim() && attachedFiles.length === 0) && !isStreaming || attachedFiles.some(f => f.status !== 'ready' && f.status !== 'error')}
                                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${(input.trim() || attachedFiles.length > 0 || isStreaming) && !attachedFiles.some(f => f.status !== 'ready' && f.status !== 'error')
                                            ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md hover:scale-105 hover:shadow-lg'
                                            : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed opacity-50'
                                            }`}
                                    >
                                        {isStreaming ? (
                                            <Square className="w-3.5 h-3.5 fill-current" />
                                        ) : (
                                            <ArrowUp className="w-4 h-4" strokeWidth={3} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* NAS File Explorer Modal */}
                {nasModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setNasModalOpen(false)}>
                        <div className="bg-[var(--card)] w-[600px] h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-[var(--foreground)] text-[var(--background)] rounded">
                                        <Folder className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold">NAS Explorer</span>
                                </div>
                                <div className="text-xs text-[var(--muted-foreground)]">
                                    {currentPath || 'Root'}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {currentPath && (
                                    <button
                                        onClick={() => {
                                            const parent = currentPath.split('/').slice(0, -1).join('/');
                                            fetchNasFiles(parent);
                                        }}
                                        className="flex items-center gap-3 w-full p-3 hover:bg-[var(--muted)] rounded-lg text-sm text-[var(--muted-foreground)]"
                                    >
                                        <div className="w-8 flex justify-center"><Folder className="w-4 h-4" /></div>
                                        <span>.. (Up)</span>
                                    </button>
                                )}
                                {loadingFiles ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                                ) : (
                                    nasFiles.map((file, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleNasFileSelect(file)}
                                            className="flex items-center gap-3 w-full p-3 hover:bg-[var(--muted)] rounded-lg text-sm transition-colors text-left group"
                                        >
                                            <div className="w-8 flex justify-center text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                                                {file.is_dir ? <Folder className="w-4 h-4 fill-current" /> : <File className="w-4 h-4" />}
                                            </div>
                                            <span className="flex-1 truncate">{file.name}</span>
                                            {!file.is_dir && <span className="text-xs text-[var(--muted-foreground)]">{file.size ? (file.size / 1024).toFixed(1) + ' KB' : ''}</span>}
                                        </button>
                                    ))
                                )}
                                {!loadingFiles && nasFiles.length === 0 && (
                                    <div className="text-center p-8 text-[var(--muted-foreground)]">{t('no_files_found')}</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Drive Modal (macOS Finder Style - Refined) */}
                {driveModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-8" onClick={() => setDriveModalOpen(false)}>
                        <div className="w-[960px] h-[600px] rounded-xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10 bg-[#1e1e1e]/95 backdrop-blur-xl text-[13px] font-sans text-gray-200 ring-1 ring-black/50" onClick={e => e.stopPropagation()}>
                            {/* Sidebar */}
                            <div className="w-[200px] flex-none bg-[#2c2c2c]/50 border-r border-white/5 flex flex-col pt-3 pb-2 backdrop-blur-md">
                                <div className="flex flex-col gap-1 p-2">
                                    <button
                                        onClick={() => setDriveMode('chat_history')}
                                        className={`px-3 py-2 text-left rounded-lg text-sm font-medium transition-colors ${driveMode === 'chat_history' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {t('chat_history')}
                                    </button>
                                    <button
                                        onClick={() => setDriveMode('canvases')}
                                        className={`px-3 py-2 text-left rounded-lg text-sm font-medium transition-colors ${driveMode === 'canvases' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {t('all_canvases')}
                                    </button>
                                    <button
                                        onClick={() => setDriveMode('nas')}
                                        className={`px-3 py-2 text-left rounded-lg text-sm font-medium transition-colors ${driveMode === 'nas' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {t('nas_storage')}
                                    </button>
                                </div>
                                <div className="mt-auto p-4 border-t border-white/10">
                                    <div className="text-xs text-gray-500">{t('storage_usage')}</div>
                                    <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                                        <div className="h-full bg-blue-500 w-1/3" />
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                                {/* Header */}
                                <div className="h-14 border-b border-white/10 flex items-center justify-between px-6">
                                    <div className="text-lg font-medium text-white">
                                        {driveMode === 'chat_history' ? 'チャット履歴' : driveMode === 'canvases' ? 'すべてのキャンバス' : '内部ストレージ'}
                                    </div>
                                </div>

                                {/* File List */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {driveMode === 'chat_history' ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {sessions.map((session) => (
                                                <div
                                                    key={session.id}
                                                    onClick={() => { loadSession(session.id); setDriveModalOpen(false); }}
                                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                                                >
                                                    <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400">
                                                        <MessageSquare className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{session.title}</h3>
                                                        <p className="text-xs text-gray-500 mt-1">{new Date(session.updated_at).toLocaleString()}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : driveMode === 'canvases' ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {canvases.length === 0 && <div className="text-center text-gray-500 py-10">キャンバスが見つかりません</div>}
                                            {canvases.map((canvas) => (
                                                <div
                                                    key={canvas.id}
                                                    onClick={() => {
                                                        loadSession(canvas.session_id);
                                                        setDriveModalOpen(false);
                                                        setDriveModalOpen(false);
                                                        setTimeout(() => handleOpenCanvas(canvas.content, canvas.language, canvas), 500);
                                                    }}
                                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                                                >
                                                    <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400">
                                                        <Edit2 className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{canvas.title || '無題のキャンバス'}</h3>
                                                        <p className="text-xs text-gray-500 mt-1">{canvas.language} • {new Date(canvas.updated_at).toLocaleString()}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        // NAS / Internal View
                                        <div className={viewMode === 'grid' ? 'grid grid-cols-4 gap-4' : 'flex flex-col gap-2'}>
                                            {nasFiles.map((file, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => !file.is_dir ? handleNasFileSelect(file) : null}
                                                    onDoubleClick={() => handleNasFileDoubleClick(file)}
                                                    className={`
                                                    ${viewMode === 'grid'
                                                            ? 'p-4 flex flex-col gap-3 items-center text-center aspect-square justify-center'
                                                            : 'flex items-center gap-4 p-4'
                                                        }
                                                    rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer group
                                                `}
                                                >
                                                    <div className={`
                                                    ${viewMode === 'grid' ? 'p-4 rounded-2xl' : 'p-3 rounded-lg'} 
                                                    bg-[#2a2a2a] text-gray-400 group-hover:text-white transition-colors
                                                `}>
                                                        {file.is_dir ? <Folder className={viewMode === 'grid' ? 'w-8 h-8' : 'w-5 h-5'} /> : <File className={viewMode === 'grid' ? 'w-8 h-8' : 'w-5 h-5'} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{file.name}</h3>
                                                        <p className="text-xs text-gray-500 mt-1">{file.is_dir ? 'フォルダ' : (file.size ? (file.size / 1024).toFixed(1) + ' KB' : '')}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* File Preview Modal */}
                {showPreviewModal && previewFile && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-8" onClick={() => setShowPreviewModal(false)}>
                        <div className="w-[90vw] h-[90vh] bg-[#1e1e1e] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
                            <div className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-[#252526]">
                                <div className="font-medium text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    {previewFile.name}
                                </div>
                                <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto bg-[#1e1e1e] p-0 relative">
                                {previewFile.type === 'image' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-[url('/checkerboard.png')]">
                                        <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain" />
                                    </div>
                                ) : previewFile.type === 'pdf' ? (
                                    <iframe src={previewFile.url} className="w-full h-full border-none" />
                                ) : (
                                    <pre className="p-6 text-sm font-mono text-gray-300 whitespace-pre-wrap">{previewFile.content}</pre>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirmOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[var(--card)] w-[400px] rounded-3xl shadow-2xl border border-[var(--border)] p-6 animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold mb-2">削除の確認</h3>
                            <p className="text-sm text-[var(--muted-foreground)] mb-6">
                                {deleteTarget?.type === 'chat' && 'このチャットを削除しますか？'}
                                {deleteTarget?.type === 'drive' && `「${deleteTarget.name}」を削除しますか？`}
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setDeleteConfirmOpen(false);
                                        setDeleteTarget(null);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-[var(--muted)] hover:bg-[var(--muted)]/80 transition-colors font-medium text-sm"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm"
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

            </div>

            {/* Canvas Panel (Right Side) */}
            <div className={`
                floating-panel transition-all duration-300 ease-in-out flex-shrink-0
                ${canvasOpen ? 'w-[500px] xl:w-[700px] opacity-100 ml-4' : 'w-0 opacity-0 ml-0 overflow-hidden'}
            `}>
                <div className="h-full w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
                    <CanvasPanel
                        isOpen={canvasOpen}
                        onClose={() => setCanvasOpen(false)}
                        content={canvasContent}
                        language={canvasLanguage}
                        onContentChange={(newContent) => setCanvasContent(newContent)}

                    />
                </div>
            </div>
        </div>
    );
}
