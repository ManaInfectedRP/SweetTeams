import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => {
        // Check localStorage first, default to English
        return localStorage.getItem('language') || 'en';
    });

    useEffect(() => {
        // Save to localStorage whenever language changes
        localStorage.setItem('language', language);
        // Set HTML lang attribute for accessibility
        document.documentElement.lang = language;
    }, [language]);

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[language];
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                // Fallback to English if translation not found
                value = translations.en;
                for (const fallbackKey of keys) {
                    if (value && typeof value === 'object') {
                        value = value[fallbackKey];
                    } else {
                        return key; // Return key if translation not found
                    }
                }
                break;
            }
        }
        
        return value || key;
    };

    const changeLanguage = (newLanguage) => {
        if (translations[newLanguage]) {
            setLanguage(newLanguage);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
