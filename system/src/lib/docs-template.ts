
export const DOCS_APP_TEMPLATE = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docs</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');

        :root {
            --a4-width: 210mm;
            --a4-height: 297mm;
        }

        body {
            font-family: 'Noto Sans JP', sans-serif;
            background-color: #f0f2f5;
            margin: 0;
            overflow-y: scroll;
            background-image: radial-gradient(#dfe1e5 1px, transparent 1px);
            background-size: 20px 20px;
        }

        #zoom-wrapper {
            transition: transform 0.2s ease;
            transform-origin: top center;
            padding-bottom: 100px;
        }

        .page-container {
            width: var(--a4-width);
            min-height: var(--a4-height);
            background: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            margin: 0 auto;
            position: relative;
            background-image: linear-gradient(to bottom, transparent calc(297mm - 1px), #ff3b30 calc(297mm - 1px), #ff3b30 297mm);
            background-size: 100% 297mm;
        }

        #document-editor {
            width: 100%;
            min-height: var(--a4-height);
            padding: 25mm 20mm;
            outline: none;
            box-sizing: border-box;
            line-height: 1.8;
            color: #1d1d1f;
            white-space: pre-wrap; 
            overflow-wrap: break-word;
            font-size: 11pt; /* Explicit standard size */
        }

        /* 文字サイズを調整（少し小さくしました） */
        #document-editor h1 { font-size: 24pt; font-weight: 700; margin: 0.5em 0; line-height: 1.1; }
        #document-editor h2 { font-size: 18pt; font-weight: 600; margin: 1em 0 0.5em; /* border removed */ }
        #document-editor h3 { font-size: 14pt; font-weight: 600; margin: 0.8em 0 0.4em; }
        #document-editor ul { list-style-type: disc; padding-left: 1.5em; }
        #document-editor ol { list-style-type: decimal; padding-left: 1.5em; }
        #document-editor blockquote { border-left: 3px solid #007aff; padding-left: 1em; color: #86868b; margin: 1em 0; }
        #document-editor img { max-width: 100%; height: auto; cursor: pointer; border: 2px solid transparent; transition: border 0.2s; }
        #document-editor img.selected { border: 2px solid #007aff; }
        
        /* Table Styles */
        #document-editor table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            table-layout: fixed;
        }
        #document-editor th, #document-editor td {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            min-width: 50px;
            vertical-align: top;
            position: relative;
        }
        #document-editor th {
            background-color: #f3f4f6;
            font-weight: 700;
            text-align: left;
        }
        
        /* Floating Header */
        .floating-header {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border-radius: 9999px;
            margin-top: 16px;
        }

        .divider { width: 1px; height: 24px; background-color: #e5e7eb; margin: 0 8px; }

        .tool-btn {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            color: #555;
            transition: all 0.2s;
            cursor: pointer;
            border: none;
            background: transparent;
        }
        .tool-btn:hover { background-color: rgba(0,0,0,0.05); color: #000; }
        .tool-btn:active { background-color: rgba(0,0,0,0.1); }
        .tool-btn i { font-size: 14px; }
        
        .tool-btn-wide {
            width: auto;
            padding: 0 12px;
            border-radius: 18px;
            font-size: 12px;
            gap: 4px;
        }

        @media print {
            body { background: white; margin: 0; padding: 0; overflow: visible; }
            .no-print { display: none !important; }
            .page-container { box-shadow: none; margin: 0; width: 100%; background-image: none; }
            #document-editor { padding: 0; }
            #document-editor img { border: none !important; }
        }
    </style>
</head>
<body class="flex flex-col items-center min-h-screen">

    <!-- Floating Header -->
    <header class="fixed top-0 z-50 flex justify-center w-full px-4 no-print pointer-events-none">
        <div class="floating-header px-6 py-2 flex items-center pointer-events-auto max-w-5xl w-full justify-between gap-2 overflow-x-auto">
            
            <!-- Left: Title -->
            <div class="flex items-center gap-4 shrink-0">
                <div class="font-bold text-gray-800 tracking-tight text-lg">
                    Docs
                </div>
            </div>

            <!-- Center: Editor Tools -->
            <div class="flex items-center gap-1 shrink-0">
                
                <button class="tool-btn" onclick="execCmd('justifyLeft')" title="左寄せ">
                    <i class="fa-solid fa-align-left"></i>
                </button>
                <button class="tool-btn" onclick="execCmd('justifyCenter')" title="中央寄せ">
                    <i class="fa-solid fa-align-center"></i>
                </button>
                <button class="tool-btn" onclick="execCmd('justifyRight')" title="右寄せ">
                    <i class="fa-solid fa-align-right"></i>
                </button>

                <div class="divider"></div>

                <div class="relative group">
                    <button class="tool-btn relative" title="文字色">
                        <i class="fa-solid fa-font"></i>
                        <div id="current-color-indicator" class="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-black border border-white"></div>
                    </button>
                    <input type="color" id="color-input" class="absolute opacity-0 top-0 left-0 w-full h-full cursor-pointer" value="#000000">
                </div>

                <div class="divider"></div>

                <button class="tool-btn" onclick="document.getElementById('img-upload').click()" title="画像を挿入">
                    <i class="fa-regular fa-image"></i>
                </button>
                <input type="file" id="img-upload" accept="image/*" class="hidden" onchange="insertImage(this)">
                
                <button class="tool-btn" onclick="insertTable()" title="表を挿入">
                    <i class="fa-solid fa-table"></i>
                </button>

                <!-- Table Tools (Hidden by default, shown when table active) -->
                <div id="table-tools" class="hidden items-center ml-2 bg-blue-50 rounded-full px-2 border border-blue-100">
                    <div class="text-[10px] text-blue-500 font-bold mr-2 uppercase tracking-wider">表編集</div>
                    
                    <button class="tool-btn tool-btn-wide hover:bg-blue-100 text-blue-700" onclick="tableOp('addRow')" title="下に行を追加">
                        <i class="fa-solid fa-plus"></i>行
                    </button>
                    <button class="tool-btn tool-btn-wide hover:bg-red-100 text-red-600" onclick="tableOp('delRow')" title="行を削除">
                        <i class="fa-solid fa-minus"></i>行
                    </button>
                    <div class="w-px h-4 bg-blue-200 mx-1"></div>
                    <button class="tool-btn tool-btn-wide hover:bg-blue-100 text-blue-700" onclick="tableOp('addCol')" title="右に列を追加">
                        <i class="fa-solid fa-plus"></i>列
                    </button>
                    <button class="tool-btn tool-btn-wide hover:bg-red-100 text-red-600" onclick="tableOp('delCol')" title="列を削除">
                        <i class="fa-solid fa-minus"></i>列
                    </button>
                </div>

            </div>

            <!-- Right: View & Export -->
            <div class="flex items-center gap-2 shrink-0">
                
                <div class="divider"></div>

                <div class="flex items-center bg-gray-100 rounded-full px-1">
                    <button class="tool-btn w-8 h-8" onclick="changeZoom(-0.1)">
                        <i class="fa-solid fa-minus text-xs"></i>
                    </button>
                    <span id="zoom-level" class="text-xs font-mono text-gray-500 w-10 text-center">100%</span>
                    <button class="tool-btn w-8 h-8" onclick="changeZoom(0.1)">
                        <i class="fa-solid fa-plus text-xs"></i>
                    </button>
                </div>

                <button onclick="downloadPDF()" class="bg-gray-900 hover:bg-black text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md ml-2 transition hover:scale-105 active:scale-95" title="PDFとして保存">
                    <i class="fa-solid fa-floppy-disk"></i>
                </button>

            </div>
        </div>
    </header>

    <main class="w-full pt-28 flex justify-center px-4 overflow-hidden">
        <div id="zoom-wrapper">
            <div id="page-container" class="page-container">
                <!-- 初期テキストを普通の文字に変更しました -->
                <div id="document-editor" contenteditable="true" spellcheck="false">
{{BODY_CONTENT}}
                </div>
            </div>
            <div class="text-center text-gray-400 text-xs mt-4 no-print select-none">
                赤い線はA4ページの区切り線です
            </div>
        </div>
    </main>

    <script>
        const editor = document.getElementById('document-editor');
        const zoomWrapper = document.getElementById('zoom-wrapper');
        const zoomLevelDisplay = document.getElementById('zoom-level');
        const colorInput = document.getElementById('color-input');
        const colorIndicator = document.getElementById('current-color-indicator');
        const tableTools = document.getElementById('table-tools');
        
        // --- 2-Way Sync Listener ---
        window.addEventListener('message', (e) => {
             if (e.data && e.data.type === 'updateContent') {
                 // Only update if content is different to avoid cursor reset
                 if (editor.innerHTML !== e.data.content) {
                     editor.innerHTML = e.data.content;
                 }
             }
        });
        // ------------------------

        // ------------------------
        
        // Ensure default is paragraph if empty
        if (!editor.innerHTML.trim()) {
            editor.innerHTML = '<p><br></p>';
        }

        let currentZoom = 1.0;
        let lastSelectedImage = null;

        function execCmd(command, value = null) {
            document.execCommand(command, false, value);
            editor.focus();
        }

        colorInput.addEventListener('input', (e) => {
            const color = e.target.value;
            colorIndicator.style.backgroundColor = color;
            execCmd('foreColor', color);
        });

        function insertImage(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgHtml = \`<img src="\${e.target.result}" style="width: 80%; display: inline-block;">\`;
                    document.execCommand('insertHTML', false, imgHtml);
                    input.value = '';
                };
                reader.readAsDataURL(input.files[0]);
            }
        }
        
        function insertTable() {
            const tableHtml = \`
                <table style="width:100%; border-collapse: collapse; margin: 1em 0;">
                    <thead>
                        <tr>
                            <th style="border:1px solid #d1d5db; padding:8px;">Header 1</th>
                            <th style="border:1px solid #d1d5db; padding:8px;">Header 2</th>
                            <th style="border:1px solid #d1d5db; padding:8px;">Header 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border:1px solid #d1d5db; padding:8px;"><br></td>
                            <td style="border:1px solid #d1d5db; padding:8px;"><br></td>
                            <td style="border:1px solid #d1d5db; padding:8px;"><br></td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #d1d5db; padding:8px;"><br></td>
                            <td style="border:1px solid #d1d5db; padding:8px;"><br></td>
                            <td style="border:1px solid #d1d5db; padding:8px;"><br></td>
                        </tr>
                    </tbody>
                </table>
                <p><br></p>
            \`;
            document.execCommand('insertHTML', false, tableHtml);
            editor.focus();
        }

        // --- Table Operations ---
        function getTableInfo() {
            const sel = window.getSelection();
            if (!sel.rangeCount) return { table: null, row: null, cell: null }; 
            let node = sel.anchorNode;
            let cell = null;
            let row = null;
            let table = null;

            // Traverse up
            while (node && node !== editor) {
                if (node.nodeName === 'TD' || node.nodeName === 'TH') cell = node;
                if (node.nodeName === 'TR') row = node;
                if (node.nodeName === 'TABLE') { table = node; break; }
                node = node.parentNode;
            }
            return { table, row, cell };
        }

        function tableOp(action) {
            const { table, row, cell } = getTableInfo();
            if (!table || !row || !cell) return;

            if (action === 'addRow') {
                const newRow = table.insertRow(row.rowIndex + 1);
                // Copy cell structure (count)
                const cellCount = row.cells.length;
                for (let i = 0; i < cellCount; i++) {
                    const newCell = newRow.insertCell(i);
                    newCell.style.border = '1px solid #d1d5db';
                    newCell.style.padding = '8px';
                    newCell.innerHTML = '<br>';
                }
            } else if (action === 'delRow') {
                if (table.rows.length > 1) {
                    table.deleteRow(row.rowIndex);
                } else {
                    if(confirm('表を削除しますか？')) table.remove();
                }
            } else if (action === 'addCol') {
                const index = cell.cellIndex;
                for (let i = 0; i < table.rows.length; i++) {
                    const tr = table.rows[i];
                    // Check if th or td
                    const isHead = tr.parentNode.nodeName === 'THEAD';
                    const newCell = tr.insertCell(index + 1);
                    newCell.outerHTML = isHead 
                        ? '<th style="border:1px solid #d1d5db; padding:8px; background-color:#f3f4f6;">Header</th>'
                        : '<td style="border:1px solid #d1d5db; padding:8px;"><br></td>';
                }
            } else if (action === 'delCol') {
                const index = cell.cellIndex;
                const rowCount = table.rows.length;
                if (row.cells.length <= 1) {
                    if(confirm('表を削除しますか？')) table.remove();
                    return;
                }
                for (let i = 0; i < rowCount; i++) {
                    table.rows[i].deleteCell(index);
                }
            }
        }

        // Monitor selection to toggle Table Tools
        document.addEventListener('selectionchange', () => {
            const { table } = getTableInfo();
            if (table) {
                tableTools.classList.remove('hidden');
                tableTools.classList.add('flex');
            } else {
                tableTools.classList.add('hidden');
                tableTools.classList.remove('flex');
            }
        });


        editor.addEventListener('click', (e) => {
            if (lastSelectedImage && lastSelectedImage !== e.target) {
                lastSelectedImage.classList.remove('selected');
                lastSelectedImage = null;
            }
            if (e.target.tagName === 'IMG') {
                lastSelectedImage = e.target;
                lastSelectedImage.classList.add('selected');
            }
        });

        function changeZoom(delta) {
            currentZoom += delta;
            if (currentZoom < 0.5) currentZoom = 0.5;
            if (currentZoom > 2.0) currentZoom = 2.0;
            currentZoom = Math.round(currentZoom * 10) / 10;
            zoomWrapper.style.transform = \`scale(\${currentZoom})\`;
            zoomLevelDisplay.innerText = \`\${Math.round(currentZoom * 100)}%\`;
        }

        editor.addEventListener('input', (e) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const node = selection.anchorNode;
            if (node.nodeType === Node.TEXT_NODE) {
                // Get full text
                const text = node.textContent;
                
                let tag = '';
                let removeLen = 0;

                if (text.startsWith('# ')) { tag = 'H1'; removeLen = 2; }
                else if (text.startsWith('## ')) { tag = 'H2'; removeLen = 3; }
                else if (text.startsWith('### ')) { tag = 'H3'; removeLen = 4; }
                else if (text.startsWith('- ')) { 
                    // List is special, execCommand handles it well usually, but let's do manually to be safe
                    node.textContent = text.substring(2);
                    document.execCommand('insertUnorderedList');
                    return;
                }

                if (tag) {
                     // Safe transformation to avoid warping
                     // 1. Remove the markdown characters (# ) using Range to preserve Undo/history better than text replacement
                     const range = document.createRange();
                     range.setStart(node, 0);
                     range.setEnd(node, removeLen);
                     range.deleteContents();

                     // 2. Clean any existing format (bold etc)
                     document.execCommand('removeFormat');

                     // 3. Apply Block
                     document.execCommand('formatBlock', false, tag);
                }
            }
            
            // Notify parent if possible for auto-save (simple postMessage)
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'contentUpdate', content: editor.innerHTML }, '*');
            }
        });

        editor.addEventListener('keydown', (e) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const node = selection.anchorNode;
            
            // Robust Header Detection (Handle nested tags like <b>)
            let headerNode = null;
            let curr = node.nodeType === 3 ? node.parentElement : node;
            while (curr && curr !== editor) {
                if (['H1', 'H2', 'H3'].includes(curr.tagName)) {
                    headerNode = curr;
                    break;
                }
                curr = curr.parentElement;
            }

            if (e.key === 'Enter') {
                if (headerNode) {
                    e.preventDefault();
                    // Force a completely clean paragraph break
                    document.execCommand('insertHTML', false, '<p><br></p>');
                }
            } else if (e.key === 'Backspace') {
                if (headerNode && selection.isCollapsed) {
                     // Check if at start of the header content
                     const range = selection.getRangeAt(0);
                     const preCaretRange = range.cloneRange();
                     preCaretRange.selectNodeContents(headerNode);
                     preCaretRange.setEnd(range.endContainer, range.endOffset);
                     
                     // If text content before caret is empty (ignoring zero-width space), we are at start
                     const textBefore = preCaretRange.toString();
                     if (textBefore.replace(/\u200B/g, '').length === 0) {
                         e.preventDefault();
                         
                         let prefix = '';
                         if (headerNode.tagName === 'H1') prefix = '# ';
                         else if (headerNode.tagName === 'H2') prefix = '## ';
                         else if (headerNode.tagName === 'H3') prefix = '### ';

                         // Revert to Paragraph
                         document.execCommand('formatBlock', false, 'p');
                         
                         // Remove any \u200B artifacts to clean up
                         // (Format block might leave them)
                         
                         // Insert prefix
                         document.execCommand('insertText', false, prefix);
                     }
                }
            }
        });

        function downloadPDF() {
            if (lastSelectedImage) lastSelectedImage.classList.remove('selected');
            const element = document.getElementById('page-container');
            const originalShadow = element.style.boxShadow;
            element.style.boxShadow = 'none';

            const opt = {
                margin:       0,
                filename:     'docs.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:    { mode: ['css', 'legacy'] }
            };

            const btn = document.querySelector('button[onclick="downloadPDF()"]');
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
            html2pdf().set(opt).from(element).save().then(() => {
                element.style.boxShadow = originalShadow;
                btn.innerHTML = originalIcon;
            });
        }
    </script>
</body>
</html>`;
