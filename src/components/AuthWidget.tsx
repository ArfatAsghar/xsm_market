import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from "@/components/ui/button";
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/useAuth';
import { login, register, googleSignIn } from '@/services/auth';
import { User, Mail, Lock, X, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import OTPVerification from './OTPVerification';
import ForgotPassword from './ForgotPassword';

interface AuthWidgetProps {
  onClose: () => void;
  onNavigate?: (page: string) => void;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};



const AuthWidget: React.FC<AuthWidgetProps> = ({ onClose, onNavigate }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  
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

    try {
      const response = await login(email, password, recaptchaToken);
      
      if (response.user) {
        setIsLoggedIn(true);
        setUser(response.user);
        toast({
          title: "Success!",
          description: "You have successfully logged in.",
        });
        onClose();
      } else {
        throw new Error('Login succeeded but user data is missing');
      }
    } catch (err) {
      // Reset reCAPTCHA on error
      resetRecaptcha();
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to login';
      
      // Check if it's an email verification error
      if (errorMessage.includes('verify your email')) {
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Email Verification Required",
          description: errorMessage + " Click the button below to verify your email.",
        });
        
        // Add a verification button to the error display
        setTimeout(() => {
          setError(errorMessage + " Click 'Verify Email' below to verify now.");
        }, 100);
      } else {
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Signup form submitted");
    setError('');

    // Validate reCAPTCHA
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please complete the reCAPTCHA verification",
      });
      return;
    }

    // Form validation
    if (!username || !email || !password || !confirmPassword) {
      const errorMsg = "Username, email, password, and confirm password are required";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }

    // Check if user agreed to terms
    if (!agreeToTerms) {
      const errorMsg = "Please agree to the Terms and Conditions to continue";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      const errorMsg = "Please enter a valid email address";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }
    
    // Username validation
    if (username.length < 3) {
      const errorMsg = "Username must be at least 3 characters long";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }

    if (password !== confirmPassword) {
      const errorMsg = "Passwords don't match";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }

    if (password.length < 6) {
      const errorMsg = "Password must be at least 6 characters long";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }

    setIsLoading(true);
    console.log("Attempting to register user:", { username, email });

    try {
      console.log("Sending registration request to backend...");
      const response = await register(username, email, password, recaptchaToken);
      console.log("Registration response:", response);
      
      // Check if response indicates verification is required
      if (response && response.requiresVerification) {
        setRegistrationEmail(email);
        setShowOTPVerification(true);
        toast({
          title: "Registration Successful!",
          description: "Please check your email for verification code.",
        });
      } else if (response && response.user) {
        // Direct login
        setUser(response.user);
        setIsLoggedIn(true);
        toast({
          title: "Account Created!",
          description: `Welcome to XSM Market, ${response.user.username}!`,
        });
        onClose();
      } else {
        toast({
          title: "Success with Warning",
          description: "Account created but user data incomplete. Please try logging in.",
        });
        setIsLogin(true);
      }
    } catch (err) {
      // Reset reCAPTCHA on error
      resetRecaptcha();
      
      console.error("Registration failed:", err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to register';
      
      // Check for common registration errors
      if (errorMessage.includes('Email already registered')) {
        setError('This email is already registered. Please use a different email or try logging in.');
      } else if (errorMessage.includes('Username already taken')) {
        setError('This username is already taken. Please choose a different username.');
      } else if (errorMessage.includes('Network error')) {
        setError('Cannot connect to the server. Please check your connection.');
      } else {
        setError(errorMessage);
      }
      
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error,
      });
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
        onClose();
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

  const handleOTPVerificationSuccess = (token: string, user: any) => {
    setUser(user);
    setIsLoggedIn(true);
    toast({
      title: "Welcome to XSM Market!",
      description: "Your email has been verified successfully!",
    });
    onClose();
  };

  if (showForgotPassword) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-[9999] animate-fadeIn px-3 py-4 sm:p-6 overflow-y-auto min-h-[100dvh]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <Card className="w-full max-w-sm mx-4 bg-xsm-dark-gray border-xsm-medium-gray relative animate-scaleIn max-h-[90dvh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <ForgotPassword 
            onBack={() => setShowForgotPassword(false)}
            onClose={onClose}
          />
        </Card>
      </div>
    );
  }

  if (showOTPVerification) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-fadeIn"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-xsm-dark-gray rounded-lg p-6 max-w-md w-full mx-4 animate-scaleIn">
          <OTPVerification
            email={registrationEmail}
            onVerificationSuccess={handleOTPVerificationSuccess}
            onBack={() => setShowOTPVerification(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-[9999] animate-fadeIn px-3 py-4 sm:p-6 overflow-y-auto min-h-[100dvh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-[min(92vw,560px)] mx-auto bg-xsm-dark-gray border-xsm-medium-gray relative animate-scaleIn max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white z-10"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="p-5 sm:p-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-xsm-yellow mb-6 text-center">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>

          {error && (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4" noValidate>
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-white mb-2">
                    Username
                  </label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    disabled={isLoading}
                    className="bg-xsm-black h-12 text-base"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
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
                placeholder="Enter your email"
                disabled={isLoading}
                className="bg-xsm-black h-12 text-base"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? "Enter your password" : "Create a password"}
                  disabled={isLoading}
                  className="bg-xsm-black pr-10 h-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    disabled={isLoading}
                    className="bg-xsm-black pr-10 h-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="agreeToTerms"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-xsm-yellow focus:ring-xsm-yellow"
                  disabled={isLoading}
                  required
                />
                <label htmlFor="agreeToTerms" className="text-sm text-white">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate('terms');
                        onClose();
                      }
                    }}
                    className="text-xsm-yellow hover:text-yellow-500 underline"
                  >
                    Terms and Conditions
                  </button>
                </label>
              </div>
            )}

            {isLogin && (
              <div className="text-center pt-3 pb-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-xsm-light-gray hover:text-xsm-yellow transition-colors"
                  disabled={isLoading}
                >
                  Forgot your password?
                </button>
              </div>
            )}
            {/* reCAPTCHA */}
            <div className="flex justify-center py-2">
              <div className="relative w-[304px] h-[78px] overflow-hidden">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                  onChange={handleRecaptchaChange}
                  theme="dark"
                />

                {/* Hide only Google test-key red warning text. The checkbox and reCAPTCHA logo still work. */}
                {import.meta.env.DEV && import.meta.env.VITE_RECAPTCHA_SITE_KEY === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' && (
                  <>
                    <div
                      className="pointer-events-none absolute left-[1px] right-[1px] top-[1px] h-[15px] bg-[#1f1f1f] z-10"
                      aria-hidden="true"
                    />
                    <div
                      className="pointer-events-none absolute left-[1px] right-[92px] top-[1px] h-[26px] bg-[#1f1f1f] z-10"
                      aria-hidden="true"
                    />
                  </>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black h-14 text-lg"
              disabled={isLoading || !recaptchaToken}
            >
              {isLoading ? (
                isLogin ? 'Signing in...' : 'Creating account...'
              ) : (
                isLogin ? 'Sign in' : 'Sign up'
              )}
            </Button>

            {/* Show verify email button if there's a verification error */}
            {error && error.includes('verify your email') && (
              <div>
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                  onClick={() => setShowOTPVerification(true)}
                  disabled={isLoading}
                >
                  Verify Email Now
                </Button>
              </div>
            )}

            <div className="relative my-4">
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
                onError={() => {
                  setError('Google sign-in was cancelled or failed');
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: 'Google sign-in was cancelled or failed',
                  });
                }}
                useOneTap={false}
                theme="filled_black"
                size="large"
                text={isLogin ? "signin_with" : "signup_with"}
                shape="rectangular"
                width="100%"
              />
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-xsm-light-gray">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-xsm-yellow hover:text-yellow-500"
                disabled={isLoading}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AuthWidget;