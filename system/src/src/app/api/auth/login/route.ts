
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Mock Authentication Logic
        // Accept any login with non-empty password
        if (!email || !password) {
            return NextResponse.json({ error: 'invalid_request', error_description: 'Email and password required' }, { status: 400 });
        }

        // Simulate "Enterprise" plan for any user
        return NextResponse.json({
            access_token: 'mock_access_token_' + crypto.randomUUID(),
            refresh_token: 'mock_refresh_token_' + crypto.randomUUID(),
            expires_in: 3600,
            token_type: 'Bearer',
            plan: 'enterprise',
            email: email
        });

    } catch (e) {
        return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
}
