import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';

type Language = 'EN' | 'AR';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('archivio_language');
    if (saved === 'AR' || saved === 'EN') return saved;
    
    // Check settings in localStorage if language isn't explicitly set
    const settings = localStorage.getItem('archivio_settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        if (parsed.defaultLanguage) return parsed.defaultLanguage;
      } catch (e) {}
    }
    
    return i18n.language?.toUpperCase().startsWith('AR') ? 'AR' : 'EN';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('archivio_language', lang);
    i18n.changeLanguage(lang.toLowerCase());
    
    // Also update settings if they exist to keep in sync
    const settings = localStorage.getItem('archivio_settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        parsed.defaultLanguage = lang;
        localStorage.setItem('archivio_settings', JSON.stringify(parsed));
      } catch (e) {}
    }

    // Update document attributes
    if (lang === 'AR') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
  };

  useEffect(() => {
    // Initial application of language attributes
    const lang = language.toLowerCase();
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }

    if (language === 'AR') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
