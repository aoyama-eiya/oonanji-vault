import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { device_code } = body;

        if (!device_code || !device_code.startsWith('dev_')) {
            return NextResponse.json({ error: 'expired_token' }, { status: 400 });
        }

        // Extract timestamp from device_code (format: dev_[timestamp_base36])
        const timestampStr = device_code.split('_')[1];
        const timestamp = parseInt(timestampStr, 36);

        // Safety check for invalid timestamp
        if (isNaN(timestamp)) {
            return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
        }

        // Check if 5 seconds have elapsed since code generation
        // This simulates the user taking time to "approve" on the /activate page
        if (Date.now() - timestamp < 5000) {
            return NextResponse.json({ error: 'authorization_pending' }, { status: 400 });
        }

        // Success response
        return NextResponse.json({
            access_token: `mock_jwt_${Date.now()}`,
            token_type: 'Bearer',
            license_key: `ONJ-PORTAL-${device_code.substring(4, 12).toUpperCase()}`,
            plan: 'enterprise',
            expires_in: 3600
        });
    } catch (error) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
}
