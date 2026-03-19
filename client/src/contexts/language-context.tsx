import { createContext, useContext } from 'react';
import { dict, type Translations } from '@/lib/i18n';

interface LanguageContextValue {
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({ t: dict.fr });

export function LanguageProvider({ children }: { children: React.ReactNode; }) {
  return (
    <LanguageContext.Provider value={{ t: dict.fr }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
