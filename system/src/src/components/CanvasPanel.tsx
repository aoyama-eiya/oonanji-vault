'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/use-translation';
import { X, Copy, Check, Save } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
    const [isEditing, setIsEditing] = React.useState(true);
    const [copied, setCopied] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // If not open, we render nothing or hide it - but for split view we want it to animate width?
    // The parent controls the layout. This component just fills the space provided.
    // However, if we want it to be a flexible panel, we should perhaps just return the div content.

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = () => {
        // Local File Download Logic
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

    return (
        <div className="h-full flex flex-col bg-inherit relative w-full">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur z-20">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-lg text-[var(--foreground)]">{t('canvas_title')}</span>
                    <span className="text-xs px-2 py-1 rounded bg-[var(--muted)] text-[var(--foreground)] uppercase font-mono">
                        {language || 'text'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isEditing
                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
                            }`}
                    >
                        {isEditing ? t('edit') : t('preview')}
                    </button>
                    <div className="w-px h-4 bg-[var(--border)] mx-1" />

                    {onSave && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="p-2 text-[var(--foreground)] hover:bg-[var(--muted)] rounded-md transition-colors disabled:opacity-50"
                            title={t('save')}
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                        </button>
                    )}

                    <button
                        onClick={handleCopy}
                        className="p-2 text-[var(--foreground)] hover:bg-[var(--muted)] rounded-md transition-colors"
                        title={t('copy')}
                    >
                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--foreground)] hover:bg-[var(--muted)] rounded-md transition-colors"
                        title={t('close')}
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden relative group bg-[#1e1e1e]">
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => onContentChange(e.target.value)}
                        className="w-full h-full resize-none p-6 font-mono text-sm bg-[#1e1e1e] text-gray-300 focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar"
                        placeholder="Waiting for content..."
                        spellCheck={false}
                    />
                ) : (
                    <div className="h-full overflow-auto p-0 custom-scrollbar">
                        <SyntaxHighlighter
                            style={vscDarkPlus as any}
                            language={language || 'text'}
                            customStyle={{ margin: 0, height: '100%', padding: '1.5rem', fontSize: '0.875rem' }}
                            showLineNumbers={true}
                            wrapLines={true}
                        >
                            {content}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>

            {/* Footer / Status Bar - Optional */}
            <div className="flex-none px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted-foreground)] flex justify-between bg-[var(--background)]">
                <span>{content.length} characters</span>
                <span>{content.split('\n').length} lines</span>
            </div>
        </div>
    );
}
