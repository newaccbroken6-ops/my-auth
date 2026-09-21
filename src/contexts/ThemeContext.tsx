import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'cyan' | 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'emerald' | 'teal' | 'indigo' | 'violet' | 'rose' | 'slate';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const themes = {
  cyan: {
    name: 'Cyan',
    primary: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/20',
    bg: 'bg-cyan-500',
    text: 'text-cyan-400',
    border: 'border-cyan-500',
    hover: 'hover:border-cyan-500',
  },
  blue: {
    name: 'Blue',
    primary: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/20',
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    border: 'border-blue-500',
    hover: 'hover:border-blue-500',
  },
  purple: {
    name: 'Purple',
    primary: '#a855f7',
    gradient: 'from-purple-500 to-pink-600',
    glow: 'shadow-purple-500/20',
    bg: 'bg-purple-500',
    text: 'text-purple-400',
    border: 'border-purple-500',
    hover: 'hover:border-purple-500',
  },
  pink: {
    name: 'Pink',
    primary: '#ec4899',
    gradient: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/20',
    bg: 'bg-pink-500',
    text: 'text-pink-400',
    border: 'border-pink-500',
    hover: 'hover:border-pink-500',
  },
  red: {
    name: 'Red',
    primary: '#ef4444',
    gradient: 'from-red-500 to-rose-600',
    glow: 'shadow-red-500/20',
    bg: 'bg-red-500',
    text: 'text-red-400',
    border: 'border-red-500',
    hover: 'hover:border-red-500',
  },
  orange: {
    name: 'Orange',
    primary: '#f97316',
    gradient: 'from-orange-500 to-amber-600',
    glow: 'shadow-orange-500/20',
    bg: 'bg-orange-500',
    text: 'text-orange-400',
    border: 'border-orange-500',
    hover: 'hover:border-orange-500',
  },
  yellow: {
    name: 'Yellow',
    primary: '#eab308',
    gradient: 'from-yellow-500 to-amber-600',
    glow: 'shadow-yellow-500/20',
    bg: 'bg-yellow-500',
    text: 'text-yellow-400',
    border: 'border-yellow-500',
    hover: 'hover:border-yellow-500',
  },
  green: {
    name: 'Green',
    primary: '#22c55e',
    gradient: 'from-green-500 to-emerald-600',
    glow: 'shadow-green-500/20',
    bg: 'bg-green-500',
    text: 'text-green-400',
    border: 'border-green-500',
    hover: 'hover:border-green-500',
  },
  emerald: {
    name: 'Emerald',
    primary: '#10b981',
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/20',
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500',
    hover: 'hover:border-emerald-500',
  },
  teal: {
    name: 'Teal',
    primary: '#14b8a6',
    gradient: 'from-teal-500 to-cyan-600',
    glow: 'shadow-teal-500/20',
    bg: 'bg-teal-500',
    text: 'text-teal-400',
    border: 'border-teal-500',
    hover: 'hover:border-teal-500',
  },
  indigo: {
    name: 'Indigo',
    primary: '#6366f1',
    gradient: 'from-indigo-500 to-purple-600',
    glow: 'shadow-indigo-500/20',
    bg: 'bg-indigo-500',
    text: 'text-indigo-400',
    border: 'border-indigo-500',
    hover: 'hover:border-indigo-500',
  },
  violet: {
    name: 'Violet',
    primary: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/20',
    bg: 'bg-violet-500',
    text: 'text-violet-400',
    border: 'border-violet-500',
    hover: 'hover:border-violet-500',
  },
  rose: {
    name: 'Rose',
    primary: '#f43f5e',
    gradient: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/20',
    bg: 'bg-rose-500',
    text: 'text-rose-400',
    border: 'border-rose-500',
    hover: 'hover:border-rose-500',
  },
  slate: {
    name: 'Slate',
    primary: '#64748b',
    gradient: 'from-slate-500 to-gray-600',
    glow: 'shadow-slate-500/20',
    bg: 'bg-slate-500',
    text: 'text-slate-400',
    border: 'border-slate-500',
    hover: 'hover:border-slate-500',
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'cyan';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
