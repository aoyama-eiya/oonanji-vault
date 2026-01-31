import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DRIVE_DIR = path.join(process.cwd(), 'internal_storage', 'drive');

// DELETE /api/drive/delete/[filename] - Delete a specific file
export async function DELETE(
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

        await fs.unlink(filePath);

        return NextResponse.json({ success: true, name: filename });
    } catch (error) {
        console.error('Error deleting file:', error);
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }
}
