import React, { useState } from 'react';
import { X, Mail, Check, ArrowRight } from 'lucide-react';
import { verifyCurrentEmail, verifyNewEmail } from '@/services/auth';
import { useNotifications } from '@/context/NotificationContext';

interface DualEmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEmail: string) => void;
  currentEmail: string;
  newEmail: string;
  verificationToken: string;
}

type VerificationStep = 'current_email' | 'new_email';

const DualEmailVerificationModal: React.FC<DualEmailVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentEmail,
  newEmail,
  verificationToken
}) => {
  const [step, setStep] = useState<VerificationStep>('current_email');
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState(verificationToken);
  const { showSuccess, showError } = useNotifications();

  const handleVerifyCurrentEmail = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');
      
      const result = await verifyCurrentEmail(token, otp);
      
      showSuccess('Current email verified!', 'Now check your new email for the final verification code');
      
      // Move to step 2
      setStep('new_email');
      setOtp('');
      setToken(result.verificationToken);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      showError('Verification failed', errorMessage);
      setError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyNewEmail = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');
      
      const result = await verifyNewEmail(token, otp);
      
      showSuccess('Email changed successfully!', `Your email has been changed to ${result.newEmail}`);
      onSuccess(result.newEmail);
      onClose();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      showError('Verification failed', errorMessage);
      setError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = () => {
    if (step === 'current_email') {
      handleVerifyCurrentEmail();
    } else {
      handleVerifyNewEmail();
    }
  };

  const resetAndClose = () => {
    setStep('current_email');
    setOtp('');
    setError('');
    setToken(verificationToken);
    onClose();
  };

  if (!isOpen) return null;

  const isCurrentEmailStep = step === 'current_email';
  const targetEmail = isCurrentEmailStep ? currentEmail : newEmail;
  const stepNumber = isCurrentEmailStep ? 1 : 2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-xsm-dark-gray rounded-lg border border-xsm-yellow/20 p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-xsm-yellow">
            Email Verification
          </h3>
          <button
            onClick={resetAndClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isCurrentEmailStep 
                ? 'bg-xsm-yellow text-xsm-black' 
                : 'bg-green-500 text-white'
            }`}>
              {isCurrentEmailStep ? '1' : '✓'}
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'new_email' 
                ? 'bg-xsm-yellow text-xsm-black' 
                : 'bg-gray-600 text-gray-400'
            }`}>
              2
            </div>
          </div>
        </div>

        <div className="text-center mb-4">
          <div className={`rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center ${
            isCurrentEmailStep 
              ? 'bg-blue-500/10' 
              : 'bg-green-500/10'
          }`}>
            <Mail className={`w-6 h-6 ${
              isCurrentEmailStep ? 'text-blue-400' : 'text-green-400'
            }`} />
          </div>
          
          <h4 className="text-white font-medium mb-2">
            {isCurrentEmailStep 
              ? 'Verify Current Email (Step 1 of 2)' 
              : 'Verify New Email (Step 2 of 2)'
            }
          </h4>
          
          <p className="text-gray-400 text-xs mb-2">
            {isCurrentEmailStep 
              ? 'We sent a verification code to your current email:' 
              : 'We sent a verification code to your new email:'
            }
          </p>
          
          <p className="text-xsm-yellow font-medium text-sm">
            {targetEmail}
          </p>
          
          {isCurrentEmailStep && (
            <p className="text-gray-400 text-xs mt-2">
              After verifying this, you'll get another code at your new email.
            </p>
          )}
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

          {!isCurrentEmailStep && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <p className="text-green-400 text-xs">
                ✅ Current email verified! Complete this final step to change your email.
              </p>
            </div>
          )}
        </div>

        <div className="flex space-x-2 mt-4">
          <button
            onClick={resetAndClose}
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
                <span>
                  {isCurrentEmailStep ? 'Verify Current' : 'Complete Change'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DualEmailVerificationModal;
