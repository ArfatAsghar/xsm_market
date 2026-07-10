import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import VerificationSection from '@/components/VerificationSection';

interface VerifyProps {
  // No longer need setCurrentPage
}

const Verify: React.FC<VerifyProps> = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleVerificationSubmit = async (documentType: string, file: File) => {
    // TODO: Implement actual verification submission logic
    console.log('Submitting verification:', { documentType, file });
    // Mock API call - In real implementation, this would be an API call to your backend
    setTimeout(() => {
      if (user?.username) {
        navigate(`/u/${user.username}`);
      } else {
        navigate('/profile'); // Fallback to redirect component
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => {
            if (user?.username) {
              navigate(`/u/${user.username}`);
            } else {
              navigate('/profile'); // Fallback to redirect component
            }
          }}
          className="flex items-center space-x-2 text-white hover:text-xsm-yellow mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Profile</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-xsm-yellow mb-4">Account Verification</h1>
          <p className="text-xl text-white">
            Verify your identity to unlock all features and build trust with other users
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <VerificationSection
            verificationStatus="unverified"
            onSubmitVerification={handleVerificationSubmit}
          />

          <div className="mt-8 bg-xsm-dark-gray border border-xsm-medium-gray rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Why verify your account?</h3>
            <ul className="space-y-3 text-xsm-light-gray">
              <li>• Gain access to premium features and higher selling limits</li>
              <li>• Build trust with potential buyers and sellers</li>
              <li>• Faster processing of your transactions</li>
              <li>• Priority support from our team</li>
              <li>• Verified badge on your profile and listings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verify;
