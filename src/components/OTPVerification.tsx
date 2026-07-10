import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { verifyOTP, resendOTP } from '@/services/auth';

interface OTPVerificationProps {
  email: string;
  onVerificationSuccess: (token: string, user: any) => void;
  onBack?: () => void;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({
  email,
  onVerificationSuccess,
  onBack
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Countdown timer
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple characters

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      // Focus last filled input or next empty one
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await verifyOTP(email, otpString);
      
      setSuccess('Email verified successfully!');
      
      // Call success callback with token and user data
      if (onVerificationSuccess) {
        onVerificationSuccess(response.token, response.user);
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setError(error.message || 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    setError('');

    try {
      await resendOTP(email);
      setSuccess('New OTP sent to your email');
      setTimeLeft(300); // Reset timer
      setOtp(['', '', '', '', '', '']); // Clear OTP inputs
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      setError(error.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-xsm-black p-4">
      <Card className="w-full max-w-md bg-xsm-dark-gray border-xsm-medium-gray">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-xsm-yellow/20 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-xsm-yellow" />
          </div>
          <CardTitle className="text-2xl font-bold text-xsm-yellow">Verify Your Email</CardTitle>
          <CardDescription className="text-xsm-light-gray">
            We've sent a 6-digit verification code to
            <br />
            <span className="font-medium text-white">{email}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-700">
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-900/20 border-green-700">
              <AlertDescription className="text-green-300">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Enter verification code</label>
              <div className="flex justify-between space-x-2" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-12 text-center text-lg font-bold bg-xsm-dark-gray border-xsm-medium-gray text-white focus:border-xsm-yellow"
                    disabled={isLoading}
                  />
                ))}
              </div>
            </div>

            {/* Timer */}
            <div className="text-center">
              <p className="text-sm text-xsm-light-gray">
                {timeLeft > 0 ? (
                  <>Code expires in <span className="font-mono text-xsm-yellow">{formatTime(timeLeft)}</span></>
                ) : (
                  <span className="text-red-400">Code has expired</span>
                )}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-xsm-yellow text-black hover:bg-yellow-400"
              disabled={isLoading || otp.join('').length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>
          </form>

          {/* Resend OTP */}
          <div className="text-center space-y-2">
            <p className="text-sm text-xsm-light-gray">Didn't receive the code?</p>
            <Button
              type="button"
              variant="ghost"
              onClick={handleResendOTP}
              disabled={isResending || timeLeft > 240} // Allow resend after 1 minute
              className="text-xsm-yellow hover:text-yellow-400 hover:bg-xsm-medium-gray"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend Code'
              )}
            </Button>
          </div>

          {/* Back Button */}
          {onBack && (
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="text-xsm-light-gray hover:text-white hover:bg-xsm-medium-gray"
              >
                Back to Registration
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OTPVerification;
