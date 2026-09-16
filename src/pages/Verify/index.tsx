import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, Gift, Shield } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useToast } from "@/components/ui/use-toast";
import { API_URL, getAuthToken } from '@/services/auth';
import VerificationSection from '@/components/VerificationSection';

const Verify: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [kycStatus, setKycStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState<string | null>(null);

  const fetchKycStatus = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/user/kyc/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setKycStatus(data.data.kyc_status || 'none');
        setAdminNotes(data.data.admin_notes || null);
      }
    } catch (e) {
      console.error('Failed to load KYC status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycStatus();
  }, []);

  const handleVerificationSubmit = async (documentType: string, file: File) => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Please log in to submit identity verification.",
        });
        return;
      }

      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('fullName', user?.username || '');
      formData.append('document', file);

      const res = await fetch(`${API_URL}/user/kyc/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Verification Submitted! 🎉",
          description: "Your documents have been received and are pending staff review. Once approved, you will automatically unlock your Free 72-Hour Pin reward!",
        });
        setKycStatus('pending');
      } else {
        toast({
          variant: "destructive",
          title: "Submission Error",
          description: data.error || data.message || "Failed to submit verification.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: e.message || "Failed to submit verification.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => {
            if (user?.username) {
              navigate(`/u/${user.username}`);
            } else {
              navigate('/profile');
            }
          }}
          className="flex items-center space-x-2 text-white hover:text-xsm-yellow mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Profile</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-xsm-yellow mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-xsm-yellow tracking-tight">Identity Verification (KYC)</h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-xl mx-auto mt-2">
            Verify your identity to qualify for higher trading trust, unlock exclusive features, and claim your referral rewards.
          </p>
        </div>

        {/* KYC Referral Reward Banner */}
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-yellow-500/30 flex items-start sm:items-center gap-3 shadow-lg">
          <div className="p-2.5 rounded-lg bg-yellow-500/20 text-yellow-400 flex-shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-yellow-300">Referral KYC Reward Activated 🎁</p>
            <p className="text-xs text-yellow-100/90 mt-0.5 leading-relaxed">
              When your identity is approved, <strong>1 Free Pin (valid for 72 hours)</strong> will be immediately credited to your account! If you were invited by a friend, they will also receive 1 Free Pin.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400 bg-xsm-dark-gray border border-xsm-medium-gray rounded-xl">
              <div className="w-8 h-8 border-3 border-xsm-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Checking verification records...</p>
            </div>
          ) : (
            <VerificationSection
              verificationStatus={kycStatus === 'approved' ? 'verified' : kycStatus === 'pending' ? 'pending' : 'unverified'}
              onSubmitVerification={handleVerificationSubmit}
            />
          )}

          {kycStatus === 'rejected' && adminNotes && (
            <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-left">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-1">
                <AlertCircle className="w-4 h-4" />
                <span>Previous Application Feedback</span>
              </div>
              <p className="text-xs text-red-200">{adminNotes}</p>
              <p className="text-[11px] text-gray-400 mt-2">Please review the reason above and submit updated documents.</p>
            </div>
          )}

          <div className="mt-8 bg-xsm-dark-gray border border-xsm-medium-gray rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>Why verify your account?</span>
            </h3>
            <ul className="space-y-3 text-sm text-xsm-light-gray">
              <li className="flex items-start gap-2">
                <span className="text-xsm-yellow font-bold">✓</span>
                <span><strong>1 Free Pin (72 Hours)</strong> unlocked instantly upon approval.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xsm-yellow font-bold">✓</span>
                <span><strong>Verified Badge</strong> on your seller profile and all marketplace listings.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xsm-yellow font-bold">✓</span>
                <span><strong>Higher Escrow Limits</strong> and expedited payout approvals.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-xsm-yellow font-bold">✓</span>
                <span><strong>Priority Dispute Resolution</strong> by senior platform agents.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verify;
