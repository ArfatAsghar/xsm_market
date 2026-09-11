import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface DealAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  details?: Array<{ label: string; value: string | number }>;
  actionText?: string;
  onAction?: () => void;
  cancelText?: string;
  onCancel?: () => void;
  isDestructive?: boolean;
}

const DealAlertModal: React.FC<DealAlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'success',
  details,
  actionText = 'OK',
  onAction,
  cancelText,
  onCancel,
  isDestructive = false
}) => {
  if (!isOpen) return null;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="rounded-2xl max-w-md w-full border shadow-2xl overflow-hidden transition-all duration-200 transform scale-100"
        style={{
          background: 'var(--xsm-dark-gray)',
          borderColor: 'var(--xsm-border)',
          color: 'var(--xsm-text)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Stripe */}
        <div
          className="h-1.5 w-full"
          style={{
            background: isSuccess
              ? 'linear-gradient(90deg, #10b981, #059669)'
              : isError || isDestructive
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : isWarning
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : 'linear-gradient(90deg, var(--xsm-primary), #f59e0b)'
          }}
        />

        <div className="p-6">
          {/* Icon and Close Button */}
          <div className="flex items-start justify-between mb-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isError || isDestructive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-6 h-6" />}
              {(isError || isDestructive || isWarning) && <AlertTriangle className="w-6 h-6" />}
              {!isSuccess && !isError && !isDestructive && !isWarning && <Info className="w-6 h-6" />}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--xsm-border)',
                color: 'var(--xsm-light-gray)'
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Title */}
          <h3
            className="text-xl font-bold mb-2"
            style={{ color: 'var(--xsm-heading, var(--xsm-text))' }}
          >
            {title}
          </h3>

          {/* Message */}
          <div className="space-y-2 text-sm leading-relaxed mb-5 opacity-90">
            {message.split('\n\n').map((paragraph, i) => (
              <p key={i} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Optional Details Box */}
          {details && details.length > 0 && (
            <div
              className="rounded-xl p-3.5 mb-5 border space-y-2 text-xs"
              style={{
                background: 'var(--xsm-bg)',
                borderColor: 'var(--xsm-border)'
              }}
            >
              {details.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="opacity-70 font-medium">{item.label}</span>
                  <span className="font-semibold font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {cancelText ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel || onClose}
                className="flex-1 py-3 px-5 rounded-xl font-semibold text-sm transition-all duration-150 border hover:opacity-90 active:scale-[0.99]"
                style={{
                  background: 'var(--xsm-medium-gray)',
                  borderColor: 'var(--xsm-border)',
                  color: 'var(--xsm-text)'
                }}
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleAction}
                className="flex-1 py-3 px-5 rounded-xl font-bold text-sm transition-all duration-150 shadow-md flex items-center justify-center hover:brightness-105 active:scale-[0.99]"
                style={{
                  background: isDestructive || isError ? '#ef4444' : 'var(--xsm-primary)',
                  color: isDestructive || isError ? '#ffffff' : '#000000'
                }}
              >
                {actionText}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAction}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-150 shadow-md flex items-center justify-center hover:brightness-105 active:scale-[0.99]"
              style={{
                background: isDestructive || isError ? '#ef4444' : 'var(--xsm-primary)',
                color: isDestructive || isError ? '#ffffff' : '#000000'
              }}
            >
              {actionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealAlertModal;
