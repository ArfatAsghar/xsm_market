import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import VerificationSection from '@/components/VerificationSection';

const Verify: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [kycStatus, setKycStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified');

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-neutral-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => {
            if (user?.username) {
              navigate(`/u/${user.username}`);
            } else {
              navigate('/profile');
            }
          }}
          className="flex items-center space-x-2 text-gray-300 hover:text-xsm-yellow mb-8 transition-colors cursor-pointer text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Profile</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-xsm-yellow mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-xsm-yellow tracking-tight">Identity Verification (KYC)</h1>
          <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto mt-2 leading-relaxed">
            Verify your government ID (CNIC, Driving License, or Passport) with Front & Back photos and a Live Selfie to unlock platform trust badges and referral rewards.
          </p>
        </div>

        {/* KYC Referral Reward Banner */}
        <div className="max-w-3xl mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-yellow-500/30 flex items-start sm:items-center gap-3 shadow-lg">
          <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 flex-shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-yellow-300">Referral KYC Reward Activated 🎁</p>
            <p className="text-xs text-yellow-100/90 mt-0.5 leading-relaxed">
              When your identity is approved, <strong>1 Free Pin (valid for 72 hours)</strong> will be immediately credited to your account! If you were invited by a friend, they will also receive 1 Free Pin.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          <VerificationSection
            initialStatus={kycStatus}
            onStatusChange={(newStatus) => setKycStatus(newStatus)}
          />

          {/* Benefits Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-xsm-yellow" />
              <span>Why verify your identity on XSM Market?</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-300">
              <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                <span className="text-amber-400 font-bold block text-sm">🎁 Free 72-Hour Pin Reward</span>
                <span className="text-gray-400">Boost your marketplace listing to the #1 pinned spot for 72 hours free of charge.</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                <span className="text-emerald-400 font-bold block text-sm">✅ Official Verified Badge</span>
                <span className="text-gray-400">Display the official green verified badge on your profile and listings to increase buyer trust.</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                <span className="text-blue-400 font-bold block text-sm">⚡ Reduced Escrow Fees</span>
                <span className="text-gray-400">Verified members qualify for VIP discounts and reduced transaction escrow fees.</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                <span className="text-purple-400 font-bold block text-sm">🛡️ Expedited Dispute Handling</span>
                <span className="text-gray-400">Priority compliance review by senior moderators in case of buyer or seller disputes.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verify;
