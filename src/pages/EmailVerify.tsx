import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { useToast } from "@/components/ui/use-toast";
import OTPVerification from '@/components/OTPVerification';
import { scrollToTop } from '@/utils/navigation';

interface EmailVerifyProps {
  email?: string;
}

const EmailVerify: React.FC<EmailVerifyProps> = ({ email }) => {
  const navigate = useNavigate();
  const { setIsLoggedIn, setUser } = useAuth();
  const { toast } = useToast();
  
  // Get email from props, localStorage, or empty string
  const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('pendingVerificationEmail') : null;
  const [verificationEmail, setVerificationEmail] = useState(email || storedEmail || '');

  const handleVerificationSuccess = (token: string, user: any) => {
    // Clear stored email after successful verification
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pendingVerificationEmail');
    }
    
    setUser(user);
    setIsLoggedIn(true);
    
    toast({
      title: "Email Verified!",
      description: `Welcome to XSM Market, ${user.username}! Your email has been successfully verified.`,
    });
    
    setTimeout(() => {
      navigate('/');
      scrollToTop();
    }, 2000);
  };

  const handleBackToLogin = () => {
    navigate('/login');
    scrollToTop();
  };

  return (
    <OTPVerification
      email={verificationEmail}
      onVerificationSuccess={handleVerificationSuccess}
      onBack={handleBackToLogin}
    />
  );
};

export default EmailVerify;
