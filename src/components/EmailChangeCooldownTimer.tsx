import React, { useState, useEffect } from 'react';
import { getEmailChangeCooldownStatus, EmailChangeCooldownStatus } from '@/services/auth';

interface EmailChangeCooldownTimerProps {
  onCooldownEnd?: () => void;
  onCooldownStatusChange?: (isActive: boolean) => void;
  className?: string;
}

const EmailChangeCooldownTimer: React.FC<EmailChangeCooldownTimerProps> = ({
  onCooldownEnd,
  onCooldownStatusChange,
  className = ""
}) => {
  const [cooldownStatus, setCooldownStatus] = useState<EmailChangeCooldownStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<{
    days: number;
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

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setRemainingTime({ days, hours, minutes, seconds });
  };

  // Fetch cooldown status
  const fetchCooldownStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await getEmailChangeCooldownStatus();
      setCooldownStatus(status);
      
      // Notify parent of cooldown status
      if (onCooldownStatusChange) {
        onCooldownStatusChange(status.cooldownActive);
      }
      
      if (status.cooldownActive && status.nextAllowedDate) {
        updateCountdown(status.nextAllowedDate);
      }
    } catch (err) {
      console.error('Failed to fetch cooldown status:', err);
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
        <span className="text-sm text-gray-600">Checking email change availability...</span>
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
    <div className={`p-4 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-800 mb-1">
            Email Change on Cooldown
          </h4>
          
          <p className="text-sm text-amber-700 mb-3">
            For security reasons, you can only change your email address once every 15 days.
          </p>
          
          {remainingTime && (
            <div className="space-y-2">
              <p className="text-xs text-amber-600">Time remaining:</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white rounded-lg p-2 border border-amber-200">
                  <div className="text-lg font-bold text-amber-800">{remainingTime.days}</div>
                  <div className="text-xs text-amber-600">Days</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200">
                  <div className="text-lg font-bold text-amber-800">{remainingTime.hours}</div>
                  <div className="text-xs text-amber-600">Hours</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200">
                  <div className="text-lg font-bold text-amber-800">{remainingTime.minutes}</div>
                  <div className="text-xs text-amber-600">Minutes</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200">
                  <div className="text-lg font-bold text-amber-800">{remainingTime.seconds}</div>
                  <div className="text-xs text-amber-600">Seconds</div>
                </div>
              </div>
            </div>
          )}
          
          {cooldownStatus.lastEmailChange && (
            <p className="text-xs text-amber-600 mt-2">
              Last email change: {new Date(cooldownStatus.lastEmailChange).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailChangeCooldownTimer;
