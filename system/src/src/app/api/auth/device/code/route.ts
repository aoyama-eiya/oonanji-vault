import { NextResponse } from 'next/server';

export async function POST() {
    const timestamp = Date.now().toString(36);
    const device_code = `dev_${timestamp}`;
    const user_code = "ABCD-1234";

    // Using relative path assuming browser context, but for API return usually absolute needed.
    // We use localhost:3000 as per requirement.
    const base_url = "http://localhost:3000";
    const verification_uri = `${base_url}/activate`;
    const verification_uri_complete = `${verification_uri}?user_code=${user_code}`;

    return NextResponse.json({
        device_code,
        user_code,
        verification_uri,
        verification_uri_complete,
        expires_in: 300,
        interval: 3
    });
}
