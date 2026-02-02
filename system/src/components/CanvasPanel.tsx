'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from '@/lib/use-translation';
import { X, Copy, Check, Save, Code, Eye, Columns, Play, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { DOCS_APP_TEMPLATE } from '@/lib/docs-template';

type ViewMode = 'code' | 'preview' | 'split';

interface CanvasPanelProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    language: string;
    onContentChange: (newContent: string) => void;
    onSave?: () => void;
}

export function CanvasPanel({ isOpen, onClose, content, language, onContentChange, onSave }: CanvasPanelProps) {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<ViewMode>(language === 'document' ? 'preview' : 'code');
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [previewKey, setPreviewKey] = useState(0);

    // Auto-switch to preview for documents
    useEffect(() => {
        if (language === 'document') setViewMode('preview');
    }, [language]);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Determine if content is previewable (HTML-based)
    const isPreviewable = useMemo(() => {
        const lang = language?.toLowerCase() || '';
        return ['html', 'htm', 'svg', 'jsx', 'tsx', 'document', 'markdown'].includes(lang) ||
            content.includes('<html') ||
            content.includes('<!DOCTYPE') ||
            content.includes('<body') ||
            content.includes('<div');
    }, [language, content]);

    // Generate preview HTML with embedded styles
    const previewHTML = useMemo(() => {
        if (!isPreviewable) return '';

        const lang = language?.toLowerCase() || '';

        // Docs App Mode (Stable Template)
        if (lang === 'document') {
            return DOCS_APP_TEMPLATE.replace('{{BODY_CONTENT}}', '');
        }

        // If it's already a full HTML document, use as-is
        if (content.includes('<!DOCTYPE') || content.includes('<html')) {
            return content;
        }

        // Otherwise, wrap in a basic HTML structure with some default styles
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #1a1a1a;
            padding: 20px;
            min-height: 100vh;
        }
    </style>
</head>
<body>
${content}
</body>
</html>`;
    }, [content, language, isPreviewable]);

    // Docs Mode: Sync content to iframe (1-way to avoid reload loop)
    useEffect(() => {
        if (language === 'document' && iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage({ type: 'updateContent', content }, '*');
        }
    }, [content, language]);

    // Docs Mode: Receive content from iframe
    useEffect(() => {
        if (language !== 'document') return;
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'contentUpdate') {
                onContentChange(event.data.content);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [language, onContentChange]);

    // Disable auto-refresh for Docs to avoid reload
    useEffect(() => {
        if (language === 'document') return;
        if (autoRefresh && isPreviewable && iframeRef.current) {
            setPreviewKey(prev => prev + 1);
        }
    }, [content, autoRefresh, isPreviewable, language]);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = () => {
        const extensionMap: Record<string, string> = {
            'python': 'py',
            'javascript': 'js',
            'typescript': 'ts',
            'html': 'html',
            'css': 'css',
            'markdown': 'md',
            'json': 'json',
            'text': 'txt'
        };
        const ext = extensionMap[language?.toLowerCase()] || 'txt';
        const filename = `canvas_${Date.now()}.${ext}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleManualRefresh = () => {
        setPreviewKey(prev => prev + 1);
    };

    const renderCodeEditor = () => (
        <div className="h-full w-full bg-[#1e1e1e]">
            <Editor
                height="100%"
                language={language?.toLowerCase() || 'text'}
                value={content}
                theme="vs-dark"
                onChange={(value) => onContentChange(value || '')}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                    renderValidationDecorations: 'off'
                }}
            />
        </div>
    );

    const renderPreview = () => (
        <div className="h-full bg-white relative">
            {isPreviewable ? (
                <iframe
                    ref={iframeRef}
                    key={previewKey}
                    srcDoc={previewHTML}
                    className="w-full h-full border-0"
                    title="Canvas Preview"
                    sandbox="allow-scripts allow-same-origin"
                    onLoad={() => {
                        if (language === 'document' && iframeRef.current) {
                            iframeRef.current.contentWindow?.postMessage({ type: 'updateContent', content }, '*');
                        }
                    }}
                />
            ) : (
                renderCodeEditor()
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[var(--background)] relative w-full animate-in slide-in-from-right-2 duration-300">
            {/* Header - Hidden for Documents */}
            {language !== 'document' && (
                <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-base text-[var(--foreground)]">Canvas</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 uppercase font-mono">
                            {language || 'text'}
                        </span>
                        {/* Live Preview text removed */}
                    </div>

                    <div className="flex items-center gap-1">
                        {/* View Mode Toggles */}
                        <div className="flex items-center bg-[var(--muted)] rounded-md p-0.5">
                            <button
                                onClick={() => setViewMode('code')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'code' ? 'bg-[var(--background)] shadow-sm' : 'hover:bg-[var(--background)]/50'}`}
                                title="Code View"
                            >
                                <Code size={16} className={viewMode === 'code' ? 'text-blue-500' : 'text-[var(--muted-foreground)]'} />
                            </button>
                            {/* Split view removed */}
                            <button
                                onClick={() => setViewMode('preview')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'preview' ? 'bg-[var(--background)] shadow-sm' : 'hover:bg-[var(--background)]/50'}`}
                                title="Preview View"
                                disabled={!isPreviewable}
                            >
                                <Eye size={16} className={viewMode === 'preview' ? 'text-blue-500' : 'text-[var(--muted-foreground)]'} />
                            </button>
                        </div>

                        {/* Refresh, Save, Copy buttons removed */}

                        <button
                            onClick={onClose}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-md transition-colors ml-2"
                            title="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'code' && renderCodeEditor()}

                {viewMode === 'preview' && (
                    <div className="h-full">
                        {renderPreview()}
                    </div>
                )}
            </div>

            {/* Footer removed */}
        </div>
    );
}

