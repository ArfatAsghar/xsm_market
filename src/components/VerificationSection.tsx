import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, CheckCircle2, AlertCircle, Upload, FileText,
  Camera, X, Eye, AlertTriangle, Lock, Sparkles, RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { API_URL, getAuthToken } from '@/services/auth';

export interface VerificationSectionProps {
  initialStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  onStatusChange?: (newStatus: 'unverified' | 'pending' | 'verified' | 'rejected') => void;
}

const VerificationSection: React.FC<VerificationSectionProps> = ({
  initialStatus = 'unverified',
  onStatusChange
}) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>(initialStatus);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [verifiedIdNumber, setVerifiedIdNumber] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form states
  const [documentType, setDocumentType] = useState<string>('cnic');
  const [idNumber, setIdNumber] = useState<string>('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // Previews
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Refs for hidden file inputs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Fetch live KYC status on load
  const fetchKycStatus = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/user/kyc/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const raw = (data.kycStatus || data.data?.kyc_status || 'unverified').toLowerCase();
        let normalized: 'unverified' | 'pending' | 'verified' | 'rejected' = 'unverified';
        if (raw === 'verified' || raw === 'approved') normalized = 'verified';
        else if (raw === 'pending' || raw === 'kyc_pending') normalized = 'pending';
        else if (raw === 'rejected') normalized = 'rejected';

        setStatus(normalized);
        if (onStatusChange) onStatusChange(normalized);

        setVerifiedIdNumber(data.data?.id_number || null);
        setRejectionReason(data.data?.admin_notes || data.latestSubmission?.rejection_reason || null);
      }
    } catch (e) {
      console.error('Error fetching KYC status:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchKycStatus();
  }, []);

  // Handle file preview generators
  const handleFileSelect = (file: File | null, type: 'front' | 'back' | 'selfie') => {
    if (!file) return;

    // Check size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Images must be less than 10MB."
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'front') {
        setFrontFile(file);
        setFrontPreview(reader.result as string);
      } else if (type === 'back') {
        setBackFile(file);
        setBackPreview(reader.result as string);
      } else if (type === 'selfie') {
        setSelfieFile(file);
        setSelfiePreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentType) {
      toast({
        variant: "destructive",
        title: "Document Type Required",
        description: "Please select CNIC, Driving License, or Passport."
      });
      return;
    }

    if (!idNumber.trim()) {
      toast({
        variant: "destructive",
        title: "ID Number Required",
        description: "Please enter your CNIC / Document Identification Number."
      });
      return;
    }

    if (!frontFile) {
      toast({
        variant: "destructive",
        title: "Front Photo Missing",
        description: "Please upload the front-side photo of your document."
      });
      return;
    }

    if (documentType !== 'passport' && !backFile) {
      toast({
        variant: "destructive",
        title: "Back Photo Missing",
        description: "Back-side photo is required for CNIC and Driving License."
      });
      return;
    }

    if (!selfieFile) {
      toast({
        variant: "destructive",
        title: "Live Selfie Required",
        description: "Please upload a clear live selfie photo of your face."
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Please log in to submit identity verification."
        });
        setSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('idNumber', idNumber.trim());
      formData.append('frontImage', frontFile);
      if (backFile) formData.append('backImage', backFile);
      formData.append('selfieImage', selfieFile);

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
          title: "KYC Submitted Successfully! 🎉",
          description: "Your verification request has been locked to Pending. Our staff will review your submission shortly."
        });
        setStatus('pending');
        if (onStatusChange) onStatusChange('pending');
      } else {
        toast({
          variant: "destructive",
          title: "Submission Error",
          description: data.error || data.message || "Failed to submit verification."
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: e.message || "Could not connect to verification server."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getIdPlaceholder = () => {
    switch (documentType) {
      case 'cnic': return 'e.g. 35202-1234567-1';
      case 'driving_license': return 'e.g. DL-12345678';
      case 'passport': return 'e.g. PK1234567';
      default: return 'Enter official ID number';
    }
  };

  const getIdLabel = () => {
    switch (documentType) {
      case 'cnic': return 'CNIC / National ID Card Number';
      case 'driving_license': return 'Driving License Number';
      case 'passport': return 'Passport Number';
      default: return 'ID / Document Number';
    }
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 text-white shadow-xl overflow-hidden">
      <CardHeader className="border-b border-neutral-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Identity Verification (KYC)</span>
                {status === 'verified' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
                {status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-yellow-400 border border-amber-500/30 text-xs font-bold">
                    <Clock className="w-3 h-3" /> Review Pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                Government document verification unlocks high-trust badges, reduced escrow fees, and your Free 72-Hour Pin reward.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchKycStatus}
            className="self-start sm:self-auto px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* ── STATUS DISPLAY ── */}

        {/* 1. Verified Account */}
        {status === 'verified' && (
          <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-emerald-400">Account Identity Fully Verified! ✅</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Your identity documents have been inspected and confirmed by XSM Market verification staff.
                  Your profile now displays a verified badge and full escrow privileges.
                </p>
                {verifiedIdNumber && (
                  <div className="inline-block mt-2 px-3 py-1 rounded-lg bg-black/40 border border-emerald-500/30 text-xs font-mono text-emerald-300">
                    Verified ID: <strong>{verifiedIdNumber}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Re-upload locked for verified accounts
              </span>
              <span className="text-[11px] text-gray-500">Document permanently tied to account</span>
            </div>
          </div>
        )}

        {/* 2. Pending Review */}
        {status === 'pending' && (
          <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-yellow-400 flex-shrink-0">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-base font-black text-yellow-400">KYC Verification Under Staff Review ⏳</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  We have safely received your document scans (Front, Back, and Live Selfie). Our verification team reviews submissions within <strong>2 to 24 hours</strong>.
                </p>
                <p className="text-[11px] text-amber-300 font-medium">
                  🎉 Once approved, you and your inviter will automatically receive your <strong>Free 72-Hour Pin Reward</strong>!
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-amber-500/20 flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Form Locked
              </span>
              <span className="text-[11px] text-gray-400">Documents cannot be re-uploaded while pending review.</span>
            </div>
          </div>
        )}

        {/* 3. Rejected Notice */}
        {status === 'rejected' && (
          <div className="p-5 rounded-2xl bg-red-950/30 border border-red-500/40 space-y-2">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Identity Verification Notice</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Your previous submission could not be approved:
              <span className="block mt-1 p-2 rounded-lg bg-black/50 border border-red-500/30 text-red-300 font-medium">
                {rejectionReason || "Documents provided were unreadable or selfie face did not match the document."}
              </span>
            </p>
            <p className="text-[11px] text-gray-400">
              Please review the feedback above and submit fresh, well-lit photos below.
            </p>
          </div>
        )}

        {/* ── VERIFICATION FORM (Only visible when unverified or rejected) ── */}
        {(status === 'unverified' || status === 'rejected') && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert className="bg-blue-950/30 border-blue-500/30 text-blue-200">
              <FileText className="h-4 w-4 text-blue-400" />
              <AlertTitle className="text-xs font-bold text-blue-300 uppercase tracking-wider">Required Verification Files</AlertTitle>
              <AlertDescription className="text-xs text-neutral-300 mt-1">
                Please upload clear, uncropped color photos of your <strong>Front side</strong>, <strong>Back side</strong>, and a <strong>Live Selfie photo</strong>.
                Each document may only be registered to one XSM Market account.
              </AlertDescription>
            </Alert>

            {/* Document Type & ID Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                  Select Document Type <span className="text-red-400">*</span>
                </label>
                <Select value={documentType} onValueChange={(val) => setDocumentType(val)}>
                  <SelectTrigger className="w-full bg-neutral-950 text-white border-neutral-700 h-10 text-xs">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                    <SelectItem value="cnic">CNIC (National Identity Card)</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                  {getIdLabel()} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={getIdPlaceholder()}
                  className="w-full px-3 py-2 h-10 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono font-bold text-white placeholder-gray-500 focus:outline-none focus:border-xsm-yellow"
                />
              </div>
            </div>

            {/* 3 Dedicated Upload Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. FRONT SIDE */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-xsm-yellow" />
                      <span>Front Side</span>
                    </span>
                    <span className="text-[10px] text-red-400 font-bold">*Required</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight">Clear photo of front showing face, name & ID number.</p>
                </div>

                <input
                  type="file"
                  ref={frontInputRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'front')}
                  className="hidden"
                />

                {frontPreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-neutral-700 group bg-black">
                    <img src={frontPreview} alt="Front Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setFrontFile(null); setFrontPreview(null); }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-red-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-emerald-400 font-bold">
                      ✓ Front Loaded
                    </span>
                  </div>
                ) : (
                  <div
                    onClick={() => frontInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-neutral-700 hover:border-xsm-yellow rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-neutral-900/50 text-center"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-2" />
                    <span className="text-xs font-bold text-gray-300">Upload Front Side</span>
                    <span className="text-[10px] text-gray-500 mt-1">JPG, PNG, WEBP (Max 10MB)</span>
                  </div>
                )}
              </div>

              {/* 2. BACK SIDE */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-xsm-yellow" />
                      <span>Back Side</span>
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {documentType === 'passport' ? 'Optional' : '*Required'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight">Back side showing address and official barcode/seal.</p>
                </div>

                <input
                  type="file"
                  ref={backInputRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'back')}
                  className="hidden"
                />

                {backPreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-neutral-700 group bg-black">
                    <img src={backPreview} alt="Back Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setBackFile(null); setBackPreview(null); }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-red-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-emerald-400 font-bold">
                      ✓ Back Loaded
                    </span>
                  </div>
                ) : (
                  <div
                    onClick={() => backInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-neutral-700 hover:border-xsm-yellow rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-neutral-900/50 text-center"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-2" />
                    <span className="text-xs font-bold text-gray-300">Upload Back Side</span>
                    <span className="text-[10px] text-gray-500 mt-1">
                      {documentType === 'passport' ? 'Optional 2nd Page' : 'Required for CNIC/License'}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. LIVE SELFIE */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-amber-500/30 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Live Selfie</span>
                    </span>
                    <span className="text-[10px] text-red-400 font-bold">*Required</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight">Live selfie of your face (or holding ID) in good lighting.</p>
                </div>

                <input
                  type="file"
                  ref={selfieInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'selfie')}
                  className="hidden"
                />

                {selfiePreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-amber-500/50 group bg-black">
                    <img src={selfiePreview} alt="Selfie Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-red-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-amber-400 font-bold">
                      ✓ Selfie Captured
                    </span>
                  </div>
                ) : (
                  <div
                    onClick={() => selfieInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-amber-500/5 text-center"
                  >
                    <Camera className="w-6 h-6 text-amber-400 mb-2" />
                    <span className="text-xs font-bold text-amber-300">Take or Upload Selfie</span>
                    <span className="text-[10px] text-gray-500 mt-1">Hold ID card or face camera</span>
                  </div>
                )}
              </div>
            </div>

            {/* Submission Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-500" />
                <span>Encrypted & secure storage. Only reviewed by authorized compliance staff.</span>
              </span>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-2.5 bg-xsm-yellow hover:bg-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Uploading Documents...</span>
                  </span>
                ) : (
                  <span>Submit Identity Verification</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default VerificationSection;
