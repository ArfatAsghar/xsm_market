import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle, XCircle, Clock,
  Eye, Search, ExternalLink, RefreshCw, Filter, User,
  FileText, Camera, AlertOctagon, Check, X, ShieldAlert
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { API_URL, getAuthToken } from '@/services/auth';

interface KycSubmission {
  id: number;
  user_id: number;
  username: string;
  email: string;
  profilePicture?: string | null;
  document_type: string;
  id_number?: string | null;
  document_url: string;
  front_image_url?: string | null;
  back_image_url?: string | null;
  selfie_image_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  submitted_at?: string;
  reviewed_at?: string | null;
  user_verified_id?: string | null;
  referred_by_username?: string | null;
  is_duplicate?: boolean;
  duplicate_user?: {
    user_id: number;
    username: string;
    email: string;
    kyc_id: number;
  } | null;
}

interface DuplicateModalData {
  isOpen: boolean;
  applicantUsername: string;
  idNumber: string;
  conflictingUser: {
    user_id: number;
    username: string;
    email?: string;
    kyc_id?: number;
  };
}

const AdminKycManagement: React.FC = () => {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Editable ID number per applicant
  const [editedIdNumbers, setEditedIdNumbers] = useState<{ [kycId: number]: string }>({});

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Duplicate Warning Modal
  const [duplicateModal, setDuplicateModal] = useState<DuplicateModalData>({
    isOpen: false,
    applicantUsername: '',
    idNumber: '',
    conflictingUser: { user_id: 0, username: '' }
  });

  // Rejection Reason Modal
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    kycId: number | null;
    applicantUsername: string;
    reason: string;
  }>({
    isOpen: false,
    kycId: null,
    applicantUsername: '',
    reason: ''
  });

  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/admin/kyc/all?status=${filterStatus}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSubmissions(data.data);
        // Initialize editable ID numbers
        const initialMap: { [kycId: number]: string } = {};
        data.data.forEach((s: KycSubmission) => {
          initialMap[s.id] = s.id_number || s.user_verified_id || '';
        });
        setEditedIdNumbers(initialMap);
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Load KYC",
          description: data.error || data.message || "Could not retrieve KYC submissions."
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: e.message || "Failed to contact KYC API."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [filterStatus]);

  const handleIdNumberChange = (kycId: number, val: string) => {
    setEditedIdNumbers(prev => ({ ...prev, [kycId]: val }));
  };

  const handleApprove = async (sub: KycSubmission) => {
    const finalId = (editedIdNumbers[sub.id] ?? sub.id_number ?? '').trim();
    if (!finalId) {
      toast({
        variant: "destructive",
        title: "CNIC / ID Number Required",
        description: "Please enter and confirm the applicant's unique CNIC or ID Number before approving."
      });
      return;
    }

    setProcessingId(sub.id);
    try {
      const token = getAuthToken();

      // Step 1: Pre-check duplicate CNIC
      const dupCheckRes = await fetch(`${API_URL}/admin/kyc/check-duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          idNumber: finalId,
          userId: sub.user_id
        })
      });
      const dupCheckData = await dupCheckRes.json();

      if (dupCheckData.isDuplicate && dupCheckData.duplicateUser) {
        // Trigger Duplicate Popup Modal
        setDuplicateModal({
          isOpen: true,
          applicantUsername: sub.username,
          idNumber: finalId,
          conflictingUser: dupCheckData.duplicateUser
        });
        setProcessingId(null);
        return;
      }

      // Step 2: Approve
      const res = await fetch(`${API_URL}/admin/kyc/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          kycId: sub.id,
          action: 'approve',
          idNumber: finalId
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "KYC Approved! ✅",
          description: `User @${sub.username} verified successfully. CNIC ${finalId} saved and referral rewards unlocked.`
        });
        fetchSubmissions();
      } else if (data.isDuplicate) {
        setDuplicateModal({
          isOpen: true,
          applicantUsername: sub.username,
          idNumber: finalId,
          conflictingUser: data.duplicateUser
        });
      } else {
        toast({
          variant: "destructive",
          title: "Approval Failed",
          description: data.error || data.message || "Could not approve verification."
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Server Error",
        description: e.message || "Failed to approve KYC."
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (sub: KycSubmission) => {
    setRejectionModal({
      isOpen: true,
      kycId: sub.id,
      applicantUsername: sub.username,
      reason: 'Documents provided are unreadable or identity verification could not be confirmed.'
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectionModal.kycId) return;

    setProcessingId(rejectionModal.kycId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/admin/kyc/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          kycId: rejectionModal.kycId,
          action: 'reject',
          reason: rejectionModal.reason
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "KYC Application Rejected",
          description: `Applicant @${rejectionModal.applicantUsername} was notified with the rejection reason.`
        });
        setRejectionModal({ isOpen: false, kycId: null, applicantUsername: '', reason: '' });
        fetchSubmissions();
      } else {
        toast({
          variant: "destructive",
          title: "Rejection Failed",
          description: data.error || data.message || "Could not reject submission."
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Server Error",
        description: e.message || "Failed to submit rejection."
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const q = searchQuery.toLowerCase();
    const idVal = (editedIdNumbers[sub.id] || sub.id_number || '').toLowerCase();
    return sub.username.toLowerCase().includes(q) ||
           sub.email.toLowerCase().includes(q) ||
           idVal.includes(q) ||
           sub.document_type.toLowerCase().includes(q);
  });

  const counts = {
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-yellow-400 text-xs font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Identity & Anti-Fraud Center</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">KYC Identity Verification Requests</h2>
          <p className="text-xs text-gray-400 mt-1">
            Review applicant documents (CNIC, Driving License, Passport), front & back scans, and live selfie photos.
            Enforces strict CNIC uniqueness to prevent multi-accounting.
          </p>
        </div>

        <button
          onClick={fetchSubmissions}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-bold border border-neutral-700 transition-all cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-neutral-900 border border-neutral-800">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                filterStatus === tab
                  ? 'bg-xsm-yellow text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab} {tab !== 'all' && counts[tab as keyof typeof counts] !== undefined && `(${counts[tab as keyof typeof counts]})`}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by username, email, CNIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-xsm-yellow"
          />
        </div>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-neutral-900/50 rounded-2xl border border-neutral-800">
          <div className="w-8 h-8 border-2 border-xsm-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium">Loading verification submissions...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-neutral-900/50 rounded-2xl border border-neutral-800">
          <CheckCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-300">No KYC submissions found</p>
          <p className="text-xs text-gray-500 mt-1">There are currently no verification applications matching your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSubmissions.map((sub) => {
            const currentIdNumber = editedIdNumbers[sub.id] ?? sub.id_number ?? '';
            const isPending = sub.status === 'pending';
            const isApproved = sub.status === 'approved';
            const isRejected = sub.status === 'rejected';

            return (
              <div
                key={sub.id}
                className={`p-5 rounded-2xl bg-neutral-900/90 border transition-all ${
                  sub.is_duplicate
                    ? 'border-red-500/60 bg-red-950/10'
                    : isPending
                    ? 'border-neutral-800 hover:border-neutral-700'
                    : isApproved
                    ? 'border-emerald-500/30'
                    : 'border-neutral-800/80 opacity-80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* Left: User Profile & Details */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0">
                        {sub.profilePicture ? (
                          <img src={sub.profilePicture} alt={sub.username} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-white">@{sub.username}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/20 text-yellow-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{sub.email}</p>
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700 text-gray-300">
                        <span className="text-gray-500 mr-1">Type:</span>
                        <strong className="text-white uppercase">{sub.document_type}</strong>
                      </div>
                      {sub.referred_by_username && (
                        <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                          Referred by: <strong>@{sub.referred_by_username}</strong>
                        </div>
                      )}
                      <div className="px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700 text-gray-400 text-[11px]">
                        Submitted: {new Date(sub.created_at || sub.submitted_at || '').toLocaleString()}
                      </div>
                    </div>

                    {/* CNIC / ID Number Input & Uniqueness Check */}
                    <div className="p-3 rounded-xl bg-black/40 border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-xsm-yellow" />
                          <span>CNIC / National ID / Passport Number:</span>
                        </label>
                        {sub.is_duplicate && (
                          <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            DUPLICATE CNIC DETECTED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled={!isPending}
                          value={currentIdNumber}
                          onChange={(e) => handleIdNumberChange(sub.id, e.target.value)}
                          placeholder="e.g. 35202-1234567-1 or Passport Number"
                          className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold text-white placeholder-gray-600 focus:outline-none focus:border-xsm-yellow"
                        />
                        {sub.is_duplicate && sub.duplicate_user && (
                          <button
                            type="button"
                            onClick={() => setDuplicateModal({
                              isOpen: true,
                              applicantUsername: sub.username,
                              idNumber: currentIdNumber,
                              conflictingUser: sub.duplicate_user!
                            })}
                            className="px-2.5 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold hover:bg-red-500/30 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <AlertOctagon className="w-3.5 h-3.5" />
                            <span>View Match</span>
                          </button>
                        )}
                      </div>

                      {sub.is_duplicate && sub.duplicate_user && (
                        <p className="text-[11px] text-red-400 leading-tight">
                          ⚠️ This ID is already registered to user <strong>@{sub.duplicate_user.username}</strong> ({sub.duplicate_user.email}). Approving this will be blocked.
                        </p>
                      )}
                    </div>

                    {isRejected && sub.rejection_reason && (
                      <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-300">
                        <strong>Rejection Reason:</strong> {sub.rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* Center/Right: Uploaded Images Review */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Front Image */}
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-gray-400 mb-1">Front Document</span>
                      <div
                        onClick={() => sub.front_image_url && setPreviewImage({ url: sub.front_image_url, title: `Front Document (@${sub.username})` })}
                        className="w-28 h-24 rounded-xl bg-black/60 border border-neutral-700 overflow-hidden relative group cursor-pointer flex items-center justify-center"
                      >
                        {sub.front_image_url ? (
                          <>
                            <img src={sub.front_image_url} alt="Front" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500">Not provided</span>
                        )}
                      </div>
                    </div>

                    {/* Back Image */}
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-gray-400 mb-1">Back Document</span>
                      <div
                        onClick={() => sub.back_image_url && setPreviewImage({ url: sub.back_image_url, title: `Back Document (@${sub.username})` })}
                        className="w-28 h-24 rounded-xl bg-black/60 border border-neutral-700 overflow-hidden relative group cursor-pointer flex items-center justify-center"
                      >
                        {sub.back_image_url ? (
                          <>
                            <img src={sub.back_image_url} alt="Back" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500">N/A</span>
                        )}
                      </div>
                    </div>

                    {/* Live Selfie Image */}
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Live Selfie
                      </span>
                      <div
                        onClick={() => sub.selfie_image_url && setPreviewImage({ url: sub.selfie_image_url, title: `Live Selfie (@${sub.username})` })}
                        className="w-28 h-24 rounded-xl bg-black/60 border border-amber-500/40 overflow-hidden relative group cursor-pointer flex items-center justify-center ring-2 ring-amber-500/20"
                      >
                        {sub.selfie_image_url ? (
                          <>
                            <img src={sub.selfie_image_url} alt="Live Selfie" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-red-400">Missing selfie</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  {isPending && (
                    <div className="flex flex-row lg:flex-col items-center gap-2 self-end lg:self-center">
                      <button
                        onClick={() => handleApprove(sub)}
                        disabled={processingId === sub.id}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve & Verify</span>
                      </button>

                      <button
                        onClick={() => handleOpenReject(sub)}
                        disabled={processingId === sub.id}
                        className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-neutral-700 hover:border-red-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DUPLICATE CNIC WARNING MODAL ── */}
      {duplicateModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-900 border-2 border-red-500 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Duplicate CNIC Detected</h3>
                <p className="text-xs text-red-400 font-semibold">Anti-Fraud Protection Triggered</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 space-y-2">
              <p className="text-xs text-gray-300 leading-relaxed">
                The CNIC / ID Number <strong className="text-white font-mono">{duplicateModal.idNumber}</strong> is already registered and verified on another user account.
              </p>
              <div className="p-3 rounded-xl bg-black/50 border border-red-500/20 text-xs">
                <span className="text-gray-400 block text-[11px]">Existing Verified Account:</span>
                <span className="text-sm font-extrabold text-white">@{duplicateModal.conflictingUser.username}</span>
                {duplicateModal.conflictingUser.email && (
                  <span className="text-gray-400 text-xs block">{duplicateModal.conflictingUser.email}</span>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              XSM Market policy strictly limits each government ID to one account. This prevents referral farming and duplicate rewards.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <a
                href={`/u/${duplicateModal.conflictingUser.username}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold border border-neutral-700 transition-all"
              >
                <span>View Existing Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setDuplicateModal({ ...duplicateModal, isOpen: false })}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Close & Reject Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECTION REASON MODAL ── */}
      {rejectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white">Reject KYC for @{rejectionModal.applicantUsername}</h3>
            <p className="text-xs text-gray-400">
              Select or type the reason for rejection. This explanation will be sent to the user in an in-app notification so they can correct it.
            </p>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Blurry or unreadable document photo',
                'Live selfie does not match ID document face',
                'Document has expired',
                'CNIC number does not match image',
                'Back side of document is missing'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRejectionModal(prev => ({ ...prev, reason: preset }))}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] text-gray-300 border border-neutral-700 cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Explain why this verification was rejected..."
              className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-700 text-xs text-white focus:outline-none focus:border-xsm-yellow"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModal({ isOpen: false, kycId: null, applicantUsername: '', reason: '' })}
                className="px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionModal.reason.trim() || processingId !== null}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL IMAGE ZOOM PREVIEW MODAL ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full px-2">
              <span className="text-sm font-bold text-white">{previewImage.title}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full bg-neutral-800 text-gray-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt="Document Preview"
              className="max-w-full max-h-[80vh] rounded-2xl border border-neutral-700 object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminKycManagement;
