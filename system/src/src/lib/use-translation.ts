
import { useSettings } from '@/lib/settings-context';
import { translations, TranslationKey } from '@/lib/translations';

export function useTranslation() {
    const { settings } = useSettings();
    // Default to 'ja' if settings is not yet loaded or invalid
    const lang = settings?.language || 'ja';

    const t = (key: TranslationKey) => {
        const text = translations[lang][key];
        if (!text) {
            // Fallback to japanese if key missing in English
            return translations['ja'][key] || key;
        }
        return text;
    };

    return { t, lang };
}
