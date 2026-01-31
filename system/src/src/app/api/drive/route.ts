import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DRIVE_DIR = path.join(process.cwd(), 'internal_storage', 'drive');

// Ensure drive directory exists
async function ensureDriveDir() {
    try {
        await fs.access(DRIVE_DIR);
    } catch {
        await fs.mkdir(DRIVE_DIR, { recursive: true });
    }
}

// GET /api/drive/list - List all files
export async function GET(request: NextRequest) {
    try {
        await ensureDriveDir();

        const files = await fs.readdir(DRIVE_DIR);
        const fileDetails = await Promise.all(
            files.map(async (filename) => {
                const filePath = path.join(DRIVE_DIR, filename);
                const stats = await fs.stat(filePath);
                return {
                    name: filename,
                    date: stats.mtime.toLocaleDateString('ja-JP'),
                    size: stats.size,
                };
            })
        );

        return NextResponse.json(fileDetails);
    } catch (error) {
        console.error('Error listing drive files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}

// POST /api/drive/save - Save a file
export async function POST(request: NextRequest) {
    try {
        await ensureDriveDir();

        const body = await request.json();
        const { name, data } = body;

        if (!name || data === undefined) {
            return NextResponse.json({ error: 'Missing name or data' }, { status: 400 });
        }

        const filePath = path.join(DRIVE_DIR, name);
        await fs.writeFile(filePath, data, 'utf-8');

        return NextResponse.json({ success: true, name });
    } catch (error) {
        console.error('Error saving file:', error);
        return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
    }
}
