import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, Shield, FileText } from 'lucide-react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VerificationSectionProps {
  verificationStatus: 'unverified' | 'pending' | 'verified';
  onSubmitVerification: (documentType: string, file: File) => void;
}

const VerificationSection: React.FC<VerificationSectionProps> = ({
  verificationStatus,
  onSubmitVerification,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile && documentType) {
      onSubmitVerification(documentType, selectedFile);
    }
  };

  return (
    <Card className="bg-xsm-dark-gray border-xsm-medium-gray">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-xsm-yellow" />
          <h2 className="text-xl font-semibold text-white">Account Verification</h2>
        </div>
      </CardHeader>
      <CardContent>
        {verificationStatus === 'verified' ? (
          <Alert className="bg-green-900/20 border-green-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>Verified Account</AlertTitle>
            <AlertDescription>
              Your account has been verified. You now have access to all platform features.
            </AlertDescription>
          </Alert>
        ) : verificationStatus === 'pending' ? (
          <Alert className="bg-yellow-900/20 border-yellow-500">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertTitle>Verification Pending</AlertTitle>
            <AlertDescription>
              Your documents are being reviewed. This usually takes 24-48 hours.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="bg-blue-900/20 border-blue-500 mb-4">
              <FileText className="h-4 w-4 text-blue-500" />
              <AlertTitle>Verify Your Identity</AlertTitle>
              <AlertDescription>
                To ensure platform security, please verify your identity by uploading a government-issued ID.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Document Type
                </label>
                <Select onValueChange={setDocumentType}>
                  <SelectTrigger className="w-full bg-xsm-black text-white border-xsm-medium-gray">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent className="bg-xsm-dark-gray border-xsm-medium-gray">
                    <SelectItem value="national_id">National ID Card</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                  dragActive ? 'border-xsm-yellow bg-xsm-yellow/10' : 'border-xsm-medium-gray'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <Upload className="w-10 h-10 mx-auto text-xsm-yellow" />
                  <div>
                    <p className="text-white">
                      {selectedFile ? selectedFile.name : 'Drag and drop your document here, or click to select'}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Supported formats: JPG, PNG, PDF (max 5MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileChange}
                    id="file-upload"
                  />
                  <Button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    variant="outline"
                    className="border-xsm-medium-gray text-white hover:text-xsm-yellow"
                  >
                    Select File
                  </Button>
                </div>
              </div>

              {selectedFile && documentType && (
                <Button
                  onClick={handleSubmit}
                  className="w-full bg-xsm-yellow hover:bg-yellow-500 text-black"
                >
                  Submit for Verification
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VerificationSection;
