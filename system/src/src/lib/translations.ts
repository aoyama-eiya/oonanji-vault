
export const translations = {
    ja: {
        // Common
        cancel: "キャンセル",
        save: "保存",
        delete: "削除",
        edit: "編集",
        close: "閉じる",
        error: "エラー",
        success: "成功",

        // Login
        login_title: "Oonanji Vaultへようこそ",
        login_subtitle: "高度なセキュリティとパフォーマンスを提供するオンプレミスLLMプラットフォーム",
        username: "ユーザーID",
        password: "パスワード",
        login_button: "ログイン",
        login_processing: "認証中...",
        login_failed: "ログインに失敗しました",
        welcome_message: "ようこそ",

        // Dashboard - Mix
        new_chat: "新しいチャット",
        search_placeholder: "チャット履歴を検索...",
        chat_history: "チャット履歴",
        input_placeholder: "メッセージを入力してください...",
        stop_generation: "生成を停止",
        model_thinking: "思考プロセスモデル",
        model_fast: "高速応答モデル",
        upload_files: "ファイルを添付",
        clip_menu: "クリップメニュー",

        // Sidebar / Drive
        my_drive: "マイドライブ",
        nas_storage: "NASストレージ",
        all_canvases: "すべてのキャンバス",
        storage_usage: "ストレージ使用量",

        // Settings
        settings: "設定",
        logout: "ログアウト",
        admin_section: "管理者",
        display_name: "表示名",
        role: "権限",
        role_admin: "管理者",
        role_user: "一般ユーザー",
        password_hint: "パスワード (変更する場合のみ)",
        create_user: "新規ユーザー",
        edit_user: "ユーザー編集",
        sidebar_chat: "チャット",
        sidebar_drive: "ドライブ",
        preview: "プレビュー",
        copy: "コピー",
        history: "履歴",
        no_files_found: "ファイルが見つかりません",
        canvas_mode: "Canvasモード",
        canvas_mode_desc: "回答をCanvasで生成",
        upload_file_action: "ファイルアップロード",
        db_search: "DB検索",
        send_message: "送信",
        general_settings: "一般設定",
        license_info: "ライセンス情報",
        user_management: "ユーザー管理",
        nas_info: "NAS情報",
        indexing: "インデックス化",

        // Theme & Appearance
        theme: "テーマ",
        font_size: "フォントサイズ",
        language: "言語 (Language)",
        animations: "アニメーション",
        theme_light: "ライト",
        theme_dark: "ダーク",
        size_small: "小",
        size_medium: "標準",
        size_large: "大",

        // NAS & Admin
        nas_status: "現在のステータス",
        mount_path: "マウントパス",
        status_connected: "接続OK",
        status_disconnected: "未接続",
        indexing_process: "インデックス化プロセス",
        start_indexing: "開始",
        stop_indexing: "中断",
        last_indexed: "最終インデックス日時",
        indexed_docs: "インデックス済みドキュメント",

        // Canvas
        canvas_title: "Canvas",
        canvas_untitled: "無題のキャンバス",
        canvas_save_local: "PCに保存 (Download)",

    },
    en: {
        // Common
        cancel: "Cancel",
        save: "Save",
        delete: "Delete",
        edit: "Edit",
        close: "Close",
        error: "Error",
        success: "Success",

        // Login
        login_title: "Welcome to Oonanji Vault",
        login_subtitle: "Secure and high-performance on-premise LLM platform",
        username: "User ID",
        password: "Password",
        login_button: "Login",
        login_processing: "Authenticating...",
        login_failed: "Login failed",
        welcome_message: "Welcome",

        // Dashboard - Mix
        new_chat: "New Chat",
        search_placeholder: "Search history...",
        chat_history: "Chat History",
        input_placeholder: 'Type here...',
        // License
        license_verification: 'License Verification',
        enter_license_key: 'Please enter your license key',
        license_key: 'License Key',
        verify: 'Verify',
        verifying: 'Verifying...',
        license_active: 'License is active',
        license_invalid: 'Invalid license key',
        license_expired: 'License has expired',
        contact_support: 'Contact Support',
        purchase_license: 'Purchase License',
        stop_generation: "Stop Generation",
        model_thinking: "Reasoning Model",
        model_fast: "Fast Model",
        upload_files: "Attach Files",
        clip_menu: "Clip Menu",

        // Sidebar / Drive
        my_drive: "My Drive",
        nas_storage: "NAS Storage",
        all_canvases: "All Canvases",
        storage_usage: "Storage Usage",

        // Settings
        settings: "Settings",
        logout: "Logout",
        admin_section: "Admin",
        display_name: "Display Name",
        role: "Role",
        role_admin: "Administrator",
        role_user: "User",
        password_hint: "Password (leave empty to keep)",
        create_user: "New User",
        edit_user: "Edit User",
        sidebar_chat: "Chat",
        sidebar_drive: "Drive",
        preview: "Preview",
        copy: "Copy",
        history: "History",
        no_files_found: "No files found",
        canvas_mode: "Canvas Mode",
        canvas_mode_desc: "Generate response in Canvas",
        upload_file_action: "Upload File",
        db_search: "DB Search",
        send_message: "Send",
        general_settings: "General",
        license_info: "Licenses",
        user_management: "User Management",
        nas_info: "NAS Info",
        indexing: "Indexing",

        // Theme & Appearance
        theme: "Theme",
        font_size: "Font Size",
        language: "Language",
        animations: "Animations",
        theme_light: "Light",
        theme_dark: "Dark",
        size_small: "Small",
        size_medium: "Medium",
        size_large: "Large",

        // NAS & Admin
        nas_status: "Current Status",
        mount_path: "Mount Path",
        status_connected: "Connected",
        status_disconnected: "Disconnected",
        indexing_process: "Indexing Process",
        start_indexing: "Start",
        stop_indexing: "Stop",
        last_indexed: "Last Indexed At",
        indexed_docs: "Indexed Documents",

        // Canvas
        canvas_title: "Canvas",
        canvas_untitled: "Untitled Canvas",
        canvas_save_local: "Save to PC (Download)",
    }
};

export type TranslationKey = keyof typeof translations.ja;
