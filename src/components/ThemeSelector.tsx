import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES } from '../context/ThemeContext';

interface ThemeSelectorProps {
  /** 'menu-item' = renders as a dropdown list item trigger with a side panel */
  variant?: 'menu-item' | 'compact';
  onClose?: () => void;
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  variant = 'menu-item',
  onClose,
  className = '',
}) => {
  const { currentTheme, setTheme, activeTheme } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [panelOpen]);

  // Compact horizontal grid for mobile drawer
  if (variant === 'compact') {
    return (
      <div className={`px-3 py-2 ${className}`}>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">🎨 App Theme</p>
        <div className="grid grid-cols-3 gap-1.5">
          {THEMES.map(theme => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setTheme(theme.id); }}
                title={theme.name}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 ${
                  isSelected ? 'scale-105' : 'border-white/10 bg-white/5 hover:border-white/25'
                }`}
                style={isSelected ? {
                  border: `1px solid ${theme.primaryColor}70`,
                  background: `${theme.primaryColor}15`,
                } : {}}
              >
                <div
                  className="w-6 h-6 rounded-lg shadow-inner flex items-center justify-center"
                  style={{ background: theme.bgColor === '#f8fafc' ? '#e2e8f0' : theme.bgColor, border: `1.5px solid ${theme.primaryColor}50` }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.primaryColor, boxShadow: `0 0 6px ${theme.primaryColor}80` }} />
                </div>
                <span className={`text-[9px] font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                  {theme.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Menu-item mode: button that opens floating side panel
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger - looks like a dropdown menu item */}
      <button
        type="button"
        onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setPanelOpen(p => !p); }}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.05] text-gray-300 hover:text-white group"
      >
        {/* Live color preview dot */}
        <div
          className="w-4 h-4 rounded-full flex-shrink-0 shadow-md relative"
          style={{ backgroundColor: activeTheme.primaryColor, boxShadow: `0 0 8px ${activeTheme.accentGlow}` }}
        >
          <div className="absolute inset-0.5 rounded-full" style={{ background: activeTheme.bgColor === '#f8fafc' ? '#e2e8f0' : activeTheme.bgColor, opacity: 0.6 }} />
        </div>
        <span className="text-sm font-medium flex-1 text-left">Themes</span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${activeTheme.primaryColor}20`, color: activeTheme.primaryColor }}
          >
            {activeTheme.name.split(' ')[0]}
          </span>
          <svg className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${panelOpen ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="currentColor">
            <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </button>

      {/* Floating theme panel — positioned to the left of the dropdown */}
      {panelOpen && (
        <div
          className="absolute right-full top-0 mr-2 w-[270px] rounded-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150"
          style={{
            background: 'linear-gradient(160deg, #141414 0%, #0d0d0d 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 0 0.5px rgba(255,255,255,0.04)',
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${activeTheme.primaryColor}20` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={activeTheme.primaryColor} strokeWidth="1.8" strokeLinecap="round" className="w-3.5 h-3.5">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white uppercase tracking-wider">App Theme</p>
              <p className="text-[9px] text-gray-500">Active: {activeTheme.name}</p>
            </div>
          </div>

          {/* Theme list */}
          <div className="p-2 space-y-1">
            {THEMES.map(theme => {
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setTheme(theme.id); if (onClose) onClose(); setPanelOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${theme.primaryColor}18, ${theme.primaryColor}06)`
                      : 'transparent',
                    border: isSelected
                      ? `1px solid ${theme.primaryColor}45`
                      : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {/* Color swatch */}
                  <div
                    className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-inner relative overflow-hidden"
                    style={{
                      background: theme.bgColor === '#f8fafc' ? '#e8ecf0' : theme.bgColor,
                      border: `1.5px solid ${theme.primaryColor}40`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: theme.gradient,
                        boxShadow: `0 0 10px ${theme.accentGlow}`,
                      }}
                    />
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-bold leading-none mb-0.5 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                      {theme.name}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-none truncate">{theme.tagline}</p>
                  </div>

                  {/* Check or indicator */}
                  {isSelected ? (
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: theme.gradient, boxShadow: `0 0 8px ${theme.accentGlow}` }}
                    >
                      <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="flex-shrink-0 w-4 h-4 rounded-full border border-white/10 group-hover:border-white/30 transition-colors"
                      style={{ backgroundColor: theme.primaryColor + '30' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] text-gray-600 text-center">Changes apply instantly & are saved</p>
          </div>
        </div>
      )}
    </div>
  );
};
