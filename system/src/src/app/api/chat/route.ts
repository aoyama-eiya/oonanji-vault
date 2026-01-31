import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { message, modelId, sessionId } = await request.json();

        // In production, this would call the Python backend with llama.cpp
        // For now, return a mock response

        const response = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `これは${modelId}からの応答です。実際のLLM統合は、Pythonバックエンド（llama.cpp）を通じて実装されます。\n\nあなたのメッセージ: "${message}"`,
            timestamp: new Date().toISOString(),
        };

        return NextResponse.json({ response });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to process chat message' },
            { status: 500 }
        );
    }
}
