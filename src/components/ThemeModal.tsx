import React, { useEffect, useRef } from 'react';
import { useTheme, THEMES } from '../context/ThemeContext';
import { FaPalette, FaCheck, FaTimes, FaMoon, FaSun } from 'react-icons/fa';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
  const { currentTheme, setTheme, activeTheme } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'var(--xsm-dark-gray)',
          border: '1px solid var(--xsm-border)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.5), 0 0 0 1px var(--xsm-border)',
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4.5"
          style={{ borderBottom: '1px solid var(--xsm-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{
                background: `${activeTheme.primaryColor}18`,
                border: `1px solid ${activeTheme.primaryColor}40`,
              }}
            >
              <FaPalette className="text-base" style={{ color: activeTheme.primaryColor }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-wide flex items-center gap-2">
                Appearance Settings
              </h3>
              <p className="text-xs text-muted-foreground">
                Choose between dark mode and low-brightness soft light
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Close"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Modal Body - 2 Theme Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setTheme(theme.id)}
                  className="relative flex flex-col p-4 rounded-xl text-left transition-all duration-200 group cursor-pointer"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${theme.primaryColor}15 0%, rgba(255,255,255,0.02) 100%)`
                      : 'rgba(128, 128, 128, 0.05)',
                    border: isSelected
                      ? `2px solid ${theme.primaryColor}`
                      : '1px solid var(--xsm-border)',
                    boxShadow: isSelected
                      ? `0 6px 20px ${theme.accentGlow}`
                      : 'none',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    {/* Icon bubble */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                      style={{
                        background: theme.bgColor,
                        border: `1.5px solid ${theme.primaryColor}50`,
                      }}
                    >
                      {theme.id === 'light' ? (
                        <FaSun className="text-base text-amber-600" />
                      ) : (
                        <FaMoon className="text-base text-yellow-400" />
                      )}
                    </div>

                    {/* Radio / Check Badge */}
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: isSelected ? theme.primaryColor : 'transparent',
                        border: isSelected ? 'none' : '1.5px solid rgba(128,128,128,0.3)',
                      }}
                    >
                      {isSelected && (
                        <FaCheck className="text-[10px] text-black stroke-[2]" />
                      )}
                    </div>
                  </div>

                  {/* Text */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      {theme.category}
                    </span>
                    <p className="text-sm font-bold leading-tight mt-0.5 text-foreground">
                      {theme.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-1">
                      {theme.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderTop: '1px solid var(--xsm-border)',
            background: 'rgba(128,128,128,0.03)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: activeTheme.primaryColor }}
            />
            <span className="text-xs text-muted-foreground">
              Current: <strong className="text-foreground">{activeTheme.name}</strong>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-black transition-transform duration-150 hover:scale-105 active:scale-95"
            style={{
              background: activeTheme.gradient,
              boxShadow: `0 4px 15px ${activeTheme.accentGlow}`,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
