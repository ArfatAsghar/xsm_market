import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/useAuth';
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { login, googleSignIn } from '@/services/auth';
import { useToast } from "@/components/ui/use-toast";
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';

interface LoginProps {
  // No longer need setCurrentPage
}

const Login: React.FC<LoginProps> = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { toast } = useToast();
  const { setIsLoggedIn, setUser } = useAuth();

  const handleRecaptchaChange = (token: string | null) => {
    setRecaptchaToken(token);
  };

  const resetRecaptcha = () => {
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
    setRecaptchaToken(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate reCAPTCHA
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please complete the reCAPTCHA verification",
      });
      setIsLoading(false);
      return;
    }

    console.log('🚀 Starting login process...');

    try {
      const response = await login(email, password, recaptchaToken);
      console.log('📡 Login response:', response);
      
      // Handle special cases that don't have user data
      if (response.requiresVerification) {
        console.log('⚠️ Email verification required, navigating to OTP screen');
        
        // Store email for EmailVerify component
        localStorage.setItem('pendingVerificationEmail', response.email || email);
        
        toast({
          variant: "destructive",
          title: "Email Verification Required",
          description: "Please verify your email using the OTP sent to your inbox.",
        });
        
        // Navigate directly to email-verify page for OTP verification
        navigate('/email-verify');
        setIsLoading(false);
        return;
      }
      
      if (response.authProvider === 'google') {
        console.log('⚠️ Google OAuth account detected');
        setError('This account was created with Google OAuth. Please use "Sign in with Google" instead.');
        toast({
          variant: "destructive",
          title: "Account Created with Google",
          description: "This account was created with Google OAuth. Please use 'Sign in with Google' instead.",
        });
        setIsLoading(false);
        return;
      }
      
      if (response.user) {
        console.log('✅ Login successful, setting auth state...');
        setIsLoggedIn(true);
        setUser(response.user);
        toast({
          title: "Success!",
          description: "You have successfully logged in.",
        });
        console.log('🏠 Redirecting to home page...');
        navigate('/');
      } else {
        throw new Error('Login succeeded but user data is missing');
      }
    } catch (err) {
      // Reset reCAPTCHA on error
      resetRecaptcha();
      
      console.error('❌ Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to login';
      
      // Check if this is an email verification error
      if (errorMessage.includes('verify your email')) {
        // Store email for EmailVerify component
        localStorage.setItem('pendingVerificationEmail', email);
        
        toast({
          variant: "destructive",
          title: "Email Verification Required",
          description: "Please verify your email using the OTP sent to your inbox.",
        });
        
        // Navigate directly to email-verify page for OTP verification
        navigate('/email-verify');
      } else {
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    console.log('Google Sign-In Success:', credentialResponse);
    setIsLoading(true);
    setError('');
    
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }
      
      const response = await googleSignIn(credentialResponse.credential);
      
      if (response.user) {
        setIsLoggedIn(true);
        setUser(response.user);
        toast({
          title: "Success!",
          description: `Welcome ${response.user.username}! You have successfully signed in with Google.`,
        });
        navigate('/');
      } else {
        throw new Error('Google sign-in succeeded but user data is missing');
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to sign in with Google',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google Sign-In Error: Authentication failed or was cancelled');
    setError('Google sign-in was cancelled or failed');
    toast({
      variant: "destructive",
      title: "Error",
      description: 'Google sign-in was cancelled or failed',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-xsm-black py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md space-y-8 bg-xsm-dark-gray border-xsm-medium-gray">
        <CardHeader>
          <h2 className="text-center text-3xl font-bold tracking-tight text-xsm-yellow">
            Sign in to your account
          </h2>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 pr-10"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-xsm-light-gray hover:text-xsm-yellow transition-colors"
                disabled={isLoading}
              >
                Forgot your password?
              </button>
            </div>

            {/* reCAPTCHA */}
            <div className="flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={handleRecaptchaChange}
                theme="dark"
              />
            </div>

            <div>
              <Button 
                type="submit" 
                className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black"
                disabled={isLoading || !recaptchaToken}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>

            {/* Show verify email button if there's a verification error */}
            {error && error.includes('verify your email') && (
              <div>
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                  onClick={() => navigate('/email-verify')}
                  disabled={isLoading}
                >
                  Verify Email Now
                </Button>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-xsm-medium-gray" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-xsm-dark-gray px-2 text-xsm-light-gray">Or continue with</span>
              </div>
            </div>

            <div className="w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                theme="filled_black"
                size="large"
                text="signin_with"
                shape="rectangular"
                width="100%"
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-sm text-xsm-light-gray">
            Don't have an account?{' '}
            <button
              onClick={() => {
                console.log('Signup button clicked, navigating to signup page');
                navigate('/signup');
              }}
              className="font-medium text-xsm-yellow hover:text-yellow-500"
              disabled={isLoading}
            >
              Sign up
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
