import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { register, googleSignIn } from '@/services/auth';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/useAuth';
import { GoogleLogin } from '@react-oauth/google';
import OTPVerification from '@/components/OTPVerification';
import { Eye, EyeOff } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';

// Email validation helper function
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

interface SignupProps {
  // No longer need setCurrentPage
}

const Signup: React.FC<SignupProps> = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      setError("Passwords don't match");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords don't match",
      });
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Password must be at least 6 characters long",
      });
      return;
    }
    
    // Email validation is already done above, no need for duplicate check

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
        // Direct login (for backwards compatibility)
        setUser(response.user);
        setIsLoggedIn(true);
        
        toast({
          title: "Account Created!",
          description: `Welcome to XSM Market, ${response.user.username}!`,
        });
        
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        toast({
          title: "Success with Warning",
          description: "Account created but user data incomplete. Please try logging in.",
        });
        
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      // Reset reCAPTCHA on error
      resetRecaptcha();
      
      console.error("Registration failed:", err);
      let errorMessage = err instanceof Error ? err.message : 'Failed to register';
      
      // Normalize error messages to user-friendly format
      const lowerError = errorMessage.toLowerCase();
      
      if (lowerError.includes('email') && (lowerError.includes('already') || lowerError.includes('registered') || lowerError.includes('taken'))) {
        errorMessage = 'This email address is already registered. Please use a different email or try logging in.';
      } else if (lowerError.includes('username') && (lowerError.includes('already') || lowerError.includes('taken'))) {
        errorMessage = 'This username is already taken. Please choose a different username.';
      } else if (lowerError.includes('network') || lowerError.includes('connect') || lowerError.includes('server')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (lowerError.includes('recaptcha') || lowerError.includes('verification')) {
        errorMessage = 'Security verification failed. Please complete the reCAPTCHA and try again.';
      } else if (lowerError.includes('password')) {
        errorMessage = 'Password does not meet requirements. Please use at least 6 characters.';
      } else if (lowerError.includes('email') && lowerError.includes('invalid')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (lowerError.includes('database') || lowerError.includes('sql')) {
        errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
      } else if (lowerError.includes('duplicate') || lowerError.includes('constraint')) {
        errorMessage = 'This username or email is already taken. Please try different values.';
      } else if (errorMessage.length > 100) {
        // If error message is too long/technical, use a generic friendly message
        errorMessage = 'Registration failed. Please check your information and try again.';
      }
      
      setError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: errorMessage,
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
      description: `Your email has been verified successfully. Welcome, ${user.username}!`,
    });
    
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const handleBackToSignup = () => {
    setShowOTPVerification(false);
    setRegistrationEmail('');
  };

  // Show OTP verification screen if needed
  if (showOTPVerification) {
    return (
      <OTPVerification
        email={registrationEmail}
        onVerificationSuccess={handleOTPVerificationSuccess}
        onBack={handleBackToSignup}
      />
    );
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    setError('');
    
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }
      
      const response = await googleSignIn(credentialResponse.credential);
      
      if (response.user) {
        setUser(response.user);
        setIsLoggedIn(true);
        toast({
          title: "Welcome!",
          description: `Welcome ${response.user.username}! Your account has been created with Google.`,
        });
        navigate('/');
      } else {
        throw new Error('Google sign-up succeeded but user data is missing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google');
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to sign up with Google',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-up was cancelled or failed');
    toast({
      variant: "destructive",
      title: "Error",
      description: 'Google sign-up was cancelled or failed',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-xsm-black py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md space-y-8 bg-xsm-dark-gray border-xsm-medium-gray">
        <CardHeader>
          <h2 className="text-center text-3xl font-bold tracking-tight text-xsm-yellow">
            Create your account
          </h2>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-6" onSubmit={handleSignup} noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
                placeholder="Choose a username"
                disabled={isLoading}
              />
            </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 pr-10"
                  placeholder="Create a password"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
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
                  className="mt-1 pr-10"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
                onClick={(e) => {
                  if (!isLoading) {
                    console.log("Sign up button clicked");
                    // Don't call handleSignup here, as the form's onSubmit will handle it
                  }
                }}
              >
                {isLoading ? 'Creating account...' : 'Sign up'}
              </Button>
            </div>

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
                text="signup_with"
                shape="rectangular"
                width="100%"
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-sm text-xsm-light-gray">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-medium text-xsm-yellow hover:text-yellow-500"
              disabled={isLoading}
            >
              Sign in
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Signup;
