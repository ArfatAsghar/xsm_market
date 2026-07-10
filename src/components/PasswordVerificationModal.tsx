import React, { useState } from 'react';
import { X, Lock, Check } from 'lucide-react';
import { verifyPasswordChange } from '@/services/auth';
import { useNotifications } from '@/context/NotificationContext';

interface PasswordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, isGoogleUser: boolean) => void;
  email: string;
  verificationToken: string;
  isGoogleUser: boolean;
}

const PasswordVerificationModal: React.FC<PasswordVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  email,
  verificationToken,
  isGoogleUser
}) => {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const { showSuccess, showError } = useNotifications();

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');
      
      const result = await verifyPasswordChange(verificationToken, otp);
      
      const successTitle = isGoogleUser ? 'Password set successfully!' : 'Password changed successfully!';
      const successMessage = isGoogleUser 
        ? 'You can now login using both Google and email/password.'
        : 'Your password has been updated successfully.';
      
      showSuccess(successTitle, successMessage);
      onSuccess(result.message, result.isGoogleUser);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      showError('Verification failed', errorMessage);
      setError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-xsm-dark-gray rounded-lg border border-xsm-yellow/20 p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-xsm-yellow">
            {isGoogleUser ? 'Verify Password Setup' : 'Verify Password Change'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center mb-4">
          <div className={`${isGoogleUser ? 'bg-green-500/10' : 'bg-yellow-500/10'} rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center`}>
            <Lock className={`w-6 h-6 ${isGoogleUser ? 'text-green-400' : 'text-yellow-400'}`} />
          </div>
          <p className="text-white mb-2 text-sm">
            {isGoogleUser 
              ? 'We\'ve sent a verification code to confirm your password setup:'
              : 'We\'ve sent a verification code to confirm your password change:'
            }
          </p>
          <p className="text-xsm-yellow font-medium">
            {email}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Please check your email and enter the 6-digit code below.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-white font-medium mb-1 text-sm">
              Verification Code
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
                setError('');
              }}
              className="xsm-input w-full text-center text-lg tracking-widest py-2"
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
            <p className="text-amber-400 text-xs">
              ⏰ This verification code expires in 15 minutes.
            </p>
          </div>

          {isGoogleUser && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <p className="text-green-400 text-xs font-semibold mb-1">
                🔐 Setting Up Password
              </p>
              <p className="text-green-300 text-xs">
                This will add password login as an alternative to Google sign-in.
              </p>
            </div>
          )}

        </div>

        <div className="flex space-x-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={!otp || otp.length !== 6 || isVerifying}
            className="flex-1 px-3 py-2 bg-xsm-yellow text-xsm-black rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
          >
            {isVerifying ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-xsm-black border-t-transparent"></div>
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isGoogleUser ? 'Set Password' : 'Change Password'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordVerificationModal;
