import React, { createContext, useContext, useEffect, useState } from 'react';

export interface ThemeOption {
  id: string;
  name: string;
  category: string;
  tagline: string;
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  accentGlow: string;
  gradient: string;
  badgeBg: string;
  badgeText: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'gold',
    name: 'Dark Mode',
    category: 'Signature Dark',
    tagline: 'Deep Midnight Obsidian (Low Glare)',
    primaryColor: '#F5C518',
    bgColor: '#080808',
    cardColor: '#121214',
    accentGlow: 'rgba(245, 197, 24, 0.25)',
    gradient: 'linear-gradient(135deg, #F5C518 0%, #D4A017 100%)',
    badgeBg: 'rgba(245, 197, 24, 0.15)',
    badgeText: '#F5C518',
  },
  {
    id: 'light',
    name: 'Soft Light Mode',
    category: 'Low Brightness',
    tagline: 'Muted Daylight (Zero Eye Strain)',
    primaryColor: '#D97706',
    bgColor: '#e8ebef',
    cardColor: '#f5f7fa',
    accentGlow: 'rgba(217, 119, 6, 0.22)',
    gradient: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
    badgeBg: 'rgba(217, 119, 6, 0.14)',
    badgeText: '#D97706',
  },
];

interface ThemeContextType {
  currentTheme: string;
  setTheme: (themeId: string) => void;
  toggleTheme: () => void;
  activeTheme: ThemeOption;
  themes: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentThemeState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xsm_theme');
      if (saved === 'light') return 'light';
      return 'gold';
    }
    return 'gold';
  });

  const setTheme = (themeId: string) => {
    const validId = themeId === 'light' ? 'light' : 'gold';
    setCurrentThemeState(validId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('xsm_theme', validId);
    }
  };

  const toggleTheme = () => {
    setTheme(currentTheme === 'light' ? 'gold' : 'light');
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [currentTheme]);

  const activeTheme = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, toggleTheme, activeTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
