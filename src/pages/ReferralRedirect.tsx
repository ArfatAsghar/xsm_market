import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ReferralRedirect: React.FC = () => {
  const { referralCode } = useParams<{ referralCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (referralCode) {
      const cleanCode = referralCode.trim();
      localStorage.setItem('xsm_referrer', cleanCode);
      localStorage.setItem('referral_code', cleanCode);
    }
    // Redirect to home with signup modal or to signup page
    navigate('/signup', { replace: true });
  }, [referralCode, navigate]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 border-4 border-xsm-yellow border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="text-xl font-bold text-foreground">Welcome to XSM Market!</h2>
      <p className="text-muted-foreground mt-2 text-sm">Applying referral invite code: <span className="text-xsm-yellow font-semibold">{referralCode}</span>...</p>
    </div>
  );
};

export default ReferralRedirect;
