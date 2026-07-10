import React, { useState, useEffect } from 'react';
import { getPasswordChangeCooldownStatus, PasswordChangeCooldownStatus } from '@/services/auth';

interface PasswordChangeCooldownTimerProps {
  onCooldownEnd?: () => void;
  onCooldownStatusChange?: (isActive: boolean) => void;
  className?: string;
}

const PasswordChangeCooldownTimer: React.FC<PasswordChangeCooldownTimerProps> = ({
  onCooldownEnd,
  onCooldownStatusChange,
  className = ""
}) => {
  const [cooldownStatus, setCooldownStatus] = useState<PasswordChangeCooldownStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Function to update countdown
  const updateCountdown = (nextAllowedDate: string) => {
    const now = new Date();
    const targetDate = new Date(nextAllowedDate);
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
      setRemainingTime(null);
      if (onCooldownEnd) {
        onCooldownEnd();
      }
      if (onCooldownStatusChange) {
        onCooldownStatusChange(false);
      }
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setRemainingTime({ hours, minutes, seconds });
  };

  // Fetch cooldown status
  const fetchCooldownStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await getPasswordChangeCooldownStatus();
      setCooldownStatus(status);
      
      // Notify parent of cooldown status
      if (onCooldownStatusChange) {
        onCooldownStatusChange(status.cooldownActive);
      }
      
      if (status.cooldownActive && status.nextAllowedDate) {
        updateCountdown(status.nextAllowedDate);
      }
    } catch (err) {
      console.error('Failed to fetch password cooldown status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cooldown status');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCooldownStatus();
  }, []);

  // Setup countdown timer
  useEffect(() => {
    if (!cooldownStatus?.cooldownActive || !cooldownStatus.nextAllowedDate) {
      return;
    }

    const interval = setInterval(() => {
      updateCountdown(cooldownStatus.nextAllowedDate!);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownStatus, onCooldownEnd]);

  // Refresh status periodically
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchCooldownStatus();
    }, 60000); // Refresh every minute

    return () => clearInterval(refreshInterval);
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-600">Checking password change availability...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-sm text-red-600">⚠️ {error}</p>
        <button
          onClick={fetchCooldownStatus}
          className="mt-2 text-xs text-red-700 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!cooldownStatus?.cooldownActive) {
    return null; // No cooldown active
  }

  return (
    <div className={`p-4 bg-purple-50 border border-purple-200 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1">
          <h4 className="text-sm font-medium text-purple-800 mb-1">
            Password Change on Cooldown
          </h4>
          
          <p className="text-sm text-purple-700 mb-3">
            For security reasons, you can only change your password once every 48 hours.
          </p>
          
          {remainingTime && (
            <div className="space-y-2">
              <p className="text-xs text-purple-600">Time remaining:</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-lg p-2 border border-purple-200">
                  <div className="text-lg font-bold text-purple-800">{remainingTime.hours}</div>
                  <div className="text-xs text-purple-600">Hours</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-purple-200">
                  <div className="text-lg font-bold text-purple-800">{remainingTime.minutes}</div>
                  <div className="text-xs text-purple-600">Minutes</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-purple-200">
                  <div className="text-lg font-bold text-purple-800">{remainingTime.seconds}</div>
                  <div className="text-xs text-purple-600">Seconds</div>
                </div>
              </div>
            </div>
          )}
          
          {cooldownStatus.lastPasswordChange && (
            <p className="text-xs text-purple-600 mt-2">
              Last password change: {new Date(cooldownStatus.lastPasswordChange).toLocaleDateString()} {new Date(cooldownStatus.lastPasswordChange).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordChangeCooldownTimer;
