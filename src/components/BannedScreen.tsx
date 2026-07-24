import React from 'react';
import { Ban, Clock, LogIn } from 'lucide-react';
import { BanData, clearBanData } from '@/services/auth';

interface BannedScreenProps {
  banData: BanData;
  onDismiss: () => void;
}

const BannedScreen: React.FC<BannedScreenProps> = ({ banData, onDismiss }) => {
  const isPermanent = !banData.banExpires;
  
  const expiresText = (): string => {
    if (!banData.banExpires) return 'This ban is permanent.';
    const expires = new Date(banData.banExpires);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    if (diffMs <= 0) return 'Your ban has expired. Please refresh the page.';
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const dateStr = expires.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return `Your ban expires in ${diffDays} day${diffDays === 1 ? '' : 's'} (${dateStr}).`;
  };

  const handleGoToLogin = () => {
    clearBanData();
    onDismiss();
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-red-900/20 blur-[120px] animate-pulse" />
      </div>

      <div className="relative max-w-md w-full mx-4">
        {/* Card */}
        <div className="bg-[#0d0d0d] border border-red-900/60 rounded-2xl p-8 shadow-2xl shadow-red-950/50 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-950/60 border-2 border-red-700 flex items-center justify-center shadow-lg shadow-red-900/40">
              <Ban className="w-10 h-10 text-red-500" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">Account Suspended</h1>
          <p className="text-red-400 text-sm font-medium mb-6">
            Your account has been suspended by the platform moderators.
          </p>

          {/* Divider */}
          <div className="border-t border-red-900/40 mb-6" />

          {/* Details */}
          <div className="space-y-4 text-left mb-8">
            {banData.banReason && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-4">
                <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">Reason</p>
                <p className="text-white text-sm leading-relaxed">{banData.banReason}</p>
              </div>
            )}

            <div className={`border rounded-lg p-4 flex items-start gap-3 ${isPermanent ? 'bg-red-950/20 border-red-900/40' : 'bg-amber-950/20 border-amber-900/40'}`}>
              <Clock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPermanent ? 'text-red-400' : 'text-amber-400'}`} />
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isPermanent ? 'text-red-400' : 'text-amber-400'}`}>
                  {isPermanent ? 'Permanent Ban' : 'Temporary Ban'}
                </p>
                <p className="text-white text-sm leading-relaxed">{expiresText()}</p>
              </div>
            </div>
          </div>

          {/* Info text */}
          <p className="text-gray-500 text-xs mb-6 leading-relaxed">
            If you believe this is a mistake, please contact our support team via the contact page.
          </p>

          {/* Actions */}
          <button
            onClick={handleGoToLogin}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-xsm-yellow hover:bg-yellow-400 text-black font-bold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-yellow-500/20"
          >
            <LogIn className="w-4 h-4" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannedScreen;
