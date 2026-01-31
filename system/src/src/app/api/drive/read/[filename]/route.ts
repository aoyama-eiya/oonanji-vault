import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DRIVE_DIR = path.join(process.cwd(), 'internal_storage', 'drive');

// GET /api/drive/read/[filename] - Read a specific file
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename: rawFilename } = await params;
        const filename = decodeURIComponent(rawFilename);
        const filePath = path.join(DRIVE_DIR, filename);

        // Security check: ensure the file is within DRIVE_DIR
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(DRIVE_DIR)) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        const content = await fs.readFile(filePath, 'utf-8');

        return NextResponse.json({ content, name: filename });
    } catch (error) {
        console.error('Error reading file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
