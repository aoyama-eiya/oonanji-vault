import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    try {
        // In production, this would check actual NAS connections
        const nasConfigs = [
            {
                id: '1',
                name: 'メインストレージ',
                host: '192.168.1.100',
                sharePath: '/share/data',
                mountPoint: '/opt/oonanji-vault/mnt/main',
                username: 'admin',
                isConnected: false,
            },
        ];

        return NextResponse.json({ nasConfigs });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch NAS configurations' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { id, action } = await request.json();

        // In production, this would execute mount/unmount commands
        // using child_process to run Ubuntu mount commands

        if (action === 'connect') {
            console.log('Connecting NAS:', id);
            // Example: mount -t cifs //host/share /mnt/point -o username=user
        } else if (action === 'disconnect') {
            console.log('Disconnecting NAS:', id);
            // Example: umount /mnt/point
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to manage NAS connection' },
            { status: 500 }
        );
    }
}
