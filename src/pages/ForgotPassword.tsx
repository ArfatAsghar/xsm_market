import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { forgotPassword } from '@/services/auth';

interface ForgotPasswordProps {
  // No longer need setCurrentPage
}

const ForgotPassword: React.FC<ForgotPasswordProps> = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await forgotPassword(email);
      setSuccess(response.message);
      setIsSubmitted(true);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      setError(error.message || 'Failed to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const handleTryAgain = () => {
    setIsSubmitted(false);
    setEmail('');
    setSuccess('');
    setError('');
  };

  if (isSubmitted && success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-xsm-black p-4">
        <Card className="w-full max-w-md bg-xsm-dark-gray border-xsm-medium-gray">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-xsm-yellow">Email Sent!</CardTitle>
            <CardDescription className="text-xsm-light-gray">
              Check your inbox for your new password
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Alert className="bg-green-900/20 border-green-700">
              <AlertDescription className="text-green-300">{success}</AlertDescription>
            </Alert>

            <div className="bg-blue-500/10 rounded-lg p-4">
              <h4 className="text-blue-400 font-semibold mb-2">Next Steps:</h4>
              <ol className="text-sm text-xsm-light-gray space-y-1 list-decimal list-inside">
                <li>Check your email inbox (and spam folder)</li>
                <li>Copy the temporary password from the email</li>
                <li>Return to login and use the temporary password</li>
                <li>Change your password immediately after logging in</li>
              </ol>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleBackToLogin}
                className="w-full bg-xsm-yellow text-black hover:bg-yellow-400"
              >
                Go to Login
              </Button>
              
              <Button
                onClick={handleTryAgain}
                variant="ghost"
                className="w-full text-xsm-light-gray hover:text-white hover:bg-xsm-medium-gray"
              >
                Send Another Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-xsm-black p-4">
      <Card className="w-full max-w-md bg-xsm-dark-gray border-xsm-medium-gray">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-xsm-yellow/20 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-xsm-yellow" />
          </div>
          <CardTitle className="text-2xl font-bold text-xsm-yellow">Forgot Password</CardTitle>
          <CardDescription className="text-xsm-light-gray">
            Enter your email address and we'll send you a new temporary password
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-700">
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="bg-xsm-dark-gray border-xsm-medium-gray text-white focus:border-xsm-yellow"
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-xsm-yellow text-black hover:bg-yellow-400"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Email...
                </>
              ) : (
                'Send New Password'
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button
              onClick={handleBackToLogin}
              variant="ghost"
              className="text-xsm-light-gray hover:text-white hover:bg-xsm-medium-gray"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>

          <div className="bg-yellow-500/10 rounded-lg p-4">
            <h4 className="text-yellow-400 font-semibold mb-2">How it works:</h4>
            <ul className="text-sm text-xsm-light-gray space-y-1">
              <li>• We'll generate a secure temporary password</li>
              <li>• You'll receive it via email within a few minutes</li>
              <li>• Use it to log in, then change it immediately</li>
              <li>• For security, temporary passwords expire in 24 hours</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
