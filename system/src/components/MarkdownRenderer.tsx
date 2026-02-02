import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Edit2 } from 'lucide-react'; // Added Edit2

interface MarkdownRendererProps {
    content: string;
    onOpenCanvas?: (code: string, language: string) => void;
    onShowCanvas?: () => void; // Added prop
}

export function MarkdownRenderer({ content, onOpenCanvas, onShowCanvas }: MarkdownRendererProps) {
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const copyToClipboard = (code: string, language: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(language);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, className, children, ...props }: any) {
                    const match = /language-([\w-]+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    const isInline = !className;

                    // Button Renderer
                    if (language === 'canvas-button') {
                        return (
                            <button
                                onClick={() => onShowCanvas && onShowCanvas()}
                                className="group w-full my-3 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-900/30 to-purple-900/30 hover:from-blue-800/40 hover:to-purple-800/40 border border-blue-500/30 hover:border-blue-400/50 rounded-xl transition-all duration-300 shadow-lg hover:shadow-blue-500/10"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:text-blue-300 transition-colors">
                                        <Edit2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                                            {codeString || "Open Canvas"}
                                        </span>
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Click to Edit</span>
                                    </div>
                                </div>
                                <div className="text-gray-500 group-hover:text-blue-400 transition-colors transform group-hover:translate-x-1 duration-300">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                </div>
                            </button>
                        );
                    }

                    if (!isInline && language) {
                        return (
                            <div className="relative group my-4">
                                <div className="absolute right-2 top-2 z-10 flex gap-2">
                                    {/* Edit Button Removed per user request */}
                                    <button
                                        onClick={() => copyToClipboard(codeString, language)}
                                        className="p-2 rounded-lg bg-[var(--muted)] hover:bg-[var(--background)] transition-colors opacity-0 group-hover:opacity-100 border border-transparent hover:border-[var(--border)]"
                                        title="Copy code"
                                    >
                                        {copiedCode === language ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-[var(--foreground)]" />
                                        )}
                                    </button>
                                </div>
                                <SyntaxHighlighter
                                    style={vscDarkPlus as any}
                                    language={language}
                                    PreTag="div"
                                    customStyle={{ margin: 0, borderRadius: '0.75rem', fontSize: '0.875rem' }}
                                    {...props}
                                >
                                    {codeString}
                                </SyntaxHighlighter>
                            </div>
                        );
                    }

                    return (
                        <code
                            className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-sm font-mono"
                            {...props}
                        >
                            {children}
                        </code>
                    );
                },
                blockquote({ children }) {
                    return (
                        <details open className="my-2 border-l-2 border-[var(--border)] pl-2">
                            <summary className="cursor-pointer text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] select-none list-none flex items-center gap-2">
                                <span className="opacity-70">Thinking Process...</span>
                            </summary>
                            <div className="mt-1 text-xs text-[var(--muted-foreground)]/70 italic leading-relaxed">
                                {children}
                            </div>
                        </details>
                    );
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
