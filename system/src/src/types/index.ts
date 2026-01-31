export interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    createdAt: string;
}

export interface AIModel {
    id: string;
    name: string;
    filename: string;
    size: number;
    type: 'GGUF' | 'Agent';
    isActive: boolean;
}

export interface NASConfig {
    id: string;
    name: string;
    host: string;
    sharePath: string;
    mountPoint: string;
    username?: string;
    isConnected: boolean;
}

export interface NetworkConfig {
    hostname: string;
    ipAddress: string;
    port: number;
    enableSSL: boolean;
}

export interface AppSettings {
    theme: 'light' | 'dark';
    language: 'ja' | 'en';
    fontSize: 'small' | 'medium' | 'large';
    enableNotifications: boolean;
    animationsEnabled: boolean;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface ChatSession {
    id: string;
    userId: string;
    modelId: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}
