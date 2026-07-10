import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from "@/components/ui/button";
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Mail, Lock } from 'lucide-react';
import { forgotPassword } from '@/services/auth';

interface ForgotPasswordProps {
  onBack: () => void;
  onClose: () => void;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, onClose }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { toast } = useToast();

  const handleSendNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use the auth service method
      const result = await forgotPassword(email);
      
      setIsSuccess(true);
      toast({
        title: "Success!",
        description: result.message || "A new password has been sent to your email address.",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send new password';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="mr-3 text-xsm-light-gray hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-xsm-yellow">Password Sent!</h2>
        </div>

        <div className="text-center">
          <Mail className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Check Your Email</h3>
          <p className="text-sm text-xsm-light-gray mb-4">
            We've sent a new temporary password to <span className="text-white font-medium">{email}</span>
          </p>
          <p className="text-xs text-xsm-light-gray mb-6">
            Please check your email and use the new password to login. You can change this password later in your profile settings.
          </p>
          
          <Button 
            onClick={onClose}
            className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-4">
        <button
          onClick={onBack}
          className="mr-3 text-xsm-light-gray hover:text-white transition-colors"
          disabled={isLoading}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-xsm-yellow">Forgot Password</h2>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSendNewPassword} className="space-y-4">
        <div className="text-center mb-4">
          <Mail className="w-12 h-12 text-xsm-yellow mx-auto mb-3" />
          <p className="text-sm text-xsm-light-gray">
            Enter your email address and we'll send you a new temporary password.
          </p>
          <p className="text-xs text-xsm-light-gray mt-2">
            You can change this password later in your profile settings.
          </p>
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={isLoading}
            className="bg-xsm-black"
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black"
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send New Password'}
        </Button>
      </form>
    </div>
  );
};

export default ForgotPassword;
