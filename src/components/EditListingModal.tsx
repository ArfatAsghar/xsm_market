import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, ChevronDown, Search, RefreshCw, Save, Loader2 } from 'lucide-react';
import { updateAd } from '../services/ads';
import { extractProfileData, detectPlatform, formatFollowerCount } from '../services/socialMedia';
import { uploadScreenshots } from '../services/uploadService';
import { useToast } from "@/components/ui/use-toast";
import { getImageUrl } from "@/config/api";
import { compressImage } from '../utils/imageCompressor';

interface UserAd {
  id: number;
  title: string;
  platform: string;
  category: string;
  price: number;
  subscribers: number;
  isMonetized: boolean;
  status: 'active' | 'pending' | 'sold' | 'suspended' | 'rejected';
  views: number;
  createdAt: string;
  updatedAt: string;
  channelUrl: string;
  description: string;
  contentType?: string;
  incomeDetails: string;
  promotionDetails: string;
  thumbnail?: string;
  primary_image?: string;
  screenshots?: any[] | string;
  tags?: string[];
  seller?: {
    id: number;
    username: string;
    profilePicture?: string;
  };
}

const MAX_SCREENSHOTS = 20;

interface EditListingModalProps {
  ad: UserAd;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedAd: UserAd) => void;
}

const normalizeScreenshots = (screenshots: any): string[] => {
  if (!screenshots || screenshots === '0' || screenshots === 'NULL') {
    return [];
  }

  let parsed = screenshots;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return parsed && parsed !== '0' ? [parsed] : [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((screenshot: any) => {
      if (!screenshot || screenshot === '0') return '';

      if (typeof screenshot === 'string') {
        return screenshot;
      }

      return screenshot.url || screenshot.data || screenshot.thumbnail || screenshot.path || '';
    })
    .filter(Boolean);
};

const AVAILABLE_PAYMENT_METHODS = [
  { id: 'bank-transfer', name: 'Bank Transfer', icon: '🏦' },
  { id: 'paypal', name: 'PayPal', icon: '💳' },
  { id: 'crypto-usdt', name: 'Crypto / USDT', icon: '₮' },
  { id: 'crypto-btc', name: 'Bitcoin (BTC)', icon: '₿' },
  { id: 'wise', name: 'Wise', icon: '🌍' },
  { id: 'payoneer', name: 'Payoneer', icon: '💼' },
  { id: 'cashapp', name: 'Cash App', icon: '💰' },
  { id: 'zelle', name: 'Zelle', icon: '⚡' },
  { id: 'venmo', name: 'Venmo', icon: '💸' },
  { id: 'western-union', name: 'Western Union', icon: '🌐' },
  { id: 'skrill', name: 'Skrill', icon: '💵' },
  { id: 'perfect-money', name: 'Perfect Money', icon: '💎' },
  { id: 'other', name: 'Other', icon: '📋' }
];

const EditListingModal: React.FC<EditListingModalProps> = ({ ad, isOpen, onClose, onUpdate }) => {
  const contentTypes = ["Unique content", "Rewritten", "Not unique content", "Mixed"];

  const contentCategories = [
    "Cars & Bikes",
    "Luxury & Motivation",
    "Pets & Animals",
    "Games",
    "Movies & Music",
    "Fashion & Style",
    "Education & Q&A",
    "Food",
    "Nature & Travel",
    "Fitness & Sports",
    "Models & Celebs",
    "Reviews & How-To",
    "YT Shorts & FB Reels",
    "Crypto & NFT",
    "Cartoon & Funny",
    "Religious & Spiritual"
  ];

  const [formData, setFormData] = useState({
    title: '',
    channelUrl: '',
    platform: '',
    price: '',
    category: '',
    contentType: '',
    description: '',
    incomeDetails: '',
    promotionDetails: '',
    isMonetized: false,
    subscribers: '',
    thumbnail: '',
    preferredPaymentMethods: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [showContentTypeDropdown, setShowContentTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);

  const contentTypeDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ad && isOpen) {
      const existingPreviewUrls = normalizeScreenshots(ad.screenshots);

      setFormData({
        title: ad.title || '',
        channelUrl: ad.channelUrl || '',
        platform: ad.platform || '',
        price: ad.price?.toString() || '',
        category: ad.category || '',
        contentType: ad.contentType || '',
        description: ad.description || '',
        incomeDetails: ad.incomeDetails || '',
        promotionDetails: ad.promotionDetails || '',
        isMonetized: Boolean(ad.isMonetized),
        subscribers: ad.subscribers?.toString() || '',
        thumbnail: ad.thumbnail || ad.primary_image || '',
        preferredPaymentMethods: Array.isArray((ad as any).preferredPaymentMethods)
          ? (ad as any).preferredPaymentMethods
          : typeof (ad as any).preferredPaymentMethods === 'string'
          ? (function() { try { return JSON.parse((ad as any).preferredPaymentMethods); } catch { return []; } })()
          : []
      });

      setExistingScreenshots(existingPreviewUrls);
      setImagePreviews(existingPreviewUrls);
      setFiles([]);
    }
  }, [ad, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentTypeDropdownRef.current && !contentTypeDropdownRef.current.contains(event.target as Node)) {
        setShowContentTypeDropdown(false);
      }

      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => {
        if (preview.startsWith('blob:')) {
          URL.revokeObjectURL(preview);
        }
      });
    };
  }, [imagePreviews]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;

    if (selectedFiles) {
      const fileArray = Array.from(selectedFiles);
      processFiles(fileArray);
    }

    e.target.value = '';
  };

  const processFiles = (fileArray: File[]) => {
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length !== fileArray.length) {
      toast({
        variant: "destructive",
        title: "Invalid files",
        description: "Only image files are allowed.",
      });
    }

    if (imageFiles.length === 0) {
      return;
    }

    const totalImages = existingScreenshots.length + files.length + imageFiles.length;

    if (totalImages > MAX_SCREENSHOTS) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `You can upload up to ${MAX_SCREENSHOTS} screenshots total. Currently have ${existingScreenshots.length + files.length}, trying to add ${imageFiles.length}.`,
      });
      return;
    }

    setFiles(prev => [...prev, ...imageFiles]);

    const previews = imageFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const removeImage = (index: number) => {
    const isExisting = index < existingScreenshots.length;

    if (isExisting) {
      setExistingScreenshots(prev => prev.filter((_, i) => i !== index));
    } else {
      const fileIndex = index - existingScreenshots.length;
      const previewUrl = imagePreviews[index];

      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      setFiles(prev => prev.filter((_, i) => i !== fileIndex));
    }

    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    imagePreviews.forEach((preview) => {
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    });

    setImagePreviews([]);
    setExistingScreenshots([]);
    setFiles([]);
  };

  const handleDragStart = (index: number) => {
    setDraggedImageIndex(index);
  };

  const handleDragOverImage = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropImage = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
      setDraggedImageIndex(null);
      return;
    }

    const newPreviews = [...imagePreviews];
    const [draggedPreview] = newPreviews.splice(draggedImageIndex, 1);
    newPreviews.splice(dropIndex, 0, draggedPreview);
    setImagePreviews(newPreviews);

    const dragIsExisting = draggedImageIndex < existingScreenshots.length;
    const dropIsExisting = dropIndex < existingScreenshots.length;

    if (dragIsExisting && dropIsExisting) {
      const newExisting = [...existingScreenshots];
      const [draggedItem] = newExisting.splice(draggedImageIndex, 1);
      newExisting.splice(dropIndex, 0, draggedItem);
      setExistingScreenshots(newExisting);
    } else if (!dragIsExisting && !dropIsExisting) {
      const dragFileIndex = draggedImageIndex - existingScreenshots.length;
      const dropFileIndex = dropIndex - existingScreenshots.length;
      const newFiles = [...files];
      const [draggedFile] = newFiles.splice(dragFileIndex, 1);
      newFiles.splice(dropFileIndex, 0, draggedFile);
      setFiles(newFiles);
    } else {
      const newExisting: string[] = [];
      const newFiles: File[] = [];

      newPreviews.forEach((preview) => {
        const originalIndex = imagePreviews.indexOf(preview);

        if (originalIndex < existingScreenshots.length) {
          newExisting.push(preview);
        } else {
          const fileIdx = originalIndex - existingScreenshots.length;

          if (fileIdx >= 0 && fileIdx < files.length) {
            newFiles.push(files[fileIdx]);
          }
        }
      });

      setExistingScreenshots(newExisting);
      setFiles(newFiles);
    }

    setDraggedImageIndex(null);
  };

  const handleExtractProfile = async () => {
    if (!formData.channelUrl.trim()) {
      toast({
        variant: "destructive",
        title: "URL Required",
        description: "Please enter a social media URL first.",
      });
      return;
    }

    const cleanUrl = formData.channelUrl.trim().toLowerCase();
    const isYouTube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');

    if (!isYouTube) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Invalid URL. Currently, only YouTube URLs are supported.",
      });
      return;
    }

    setIsExtracting(true);
    setExtractedData(null);

    try {
      const data = await extractProfileData(formData.channelUrl);

      if (data) {
        setExtractedData(data);

        setFormData(prev => ({
          ...prev,
          title: data.title || prev.title,
          platform: 'youtube',
          subscribers: data.followers?.toString() || data.subscribers?.toString() || prev.subscribers,
          thumbnail: data.profilePicture || prev.thumbnail,
        }));

        toast({
          title: "Profile Extracted! ✨",
          description: `Successfully extracted data from YouTube`,
        });
      }
    } catch (error: any) {
      console.error('Profile extraction failed:', error);
      toast({
        variant: "destructive",
        title: "Extraction Failed",
        description: error.message || "Failed to extract profile data. Please fill manually.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUrl = formData.channelUrl.trim().toLowerCase();
    const isYouTube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');

    if (!isYouTube) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Invalid URL. Currently, only YouTube URLs are supported.",
      });
      return;
    }

    if (!formData.title.trim() || !formData.channelUrl.trim() || !formData.platform || !formData.category || !formData.price) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields (title, URL, platform, category, price).",
      });
      return;
    }

    if (parseFloat(formData.price) < 5) {
      toast({
        variant: "destructive",
        title: "Invalid Price",
        description: "Minimum price should be $5.",
      });
      return;
    }

    const subscribers = formData.subscribers ? parseInt(formData.subscribers, 10) : 0;

    if (subscribers < 100) {
      toast({
        variant: "destructive",
        title: "Invalid Subscribers",
        description: "Minimum subscribers should be 100.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotData: any[] = existingScreenshots.map((url) => ({ url }));
      const profileImageData = formData.thumbnail || ad.thumbnail || ad.primary_image || '';

      if (files.length > 0) {
        try {
          console.log('Compressing new screenshots client-side...');
          const compressedFiles: File[] = [];
          const compressionToast = toast({
            title: "Compressing images... ⚙️",
            description: `Preparing ${files.length} screenshots for upload...`,
          });

          for (const file of files) {
            try {
              const compressed = await compressImage(file, 1200, 1200, 0.75);
              compressedFiles.push(compressed);
            } catch (e) {
              console.warn('Failed to compress file, using original:', file.name, e);
              compressedFiles.push(file);
            }
          }

          compressionToast.dismiss();

          console.log('Uploading new screenshots...', compressedFiles.length, 'files');
          const uploadToast = toast({
            title: "Uploading screenshots... ⬆️",
            description: `0 of ${compressedFiles.length} uploaded...`,
          });

          const uploadResult = await uploadScreenshots(compressedFiles, (current, total) => {
            uploadToast.update({
              id: uploadToast.id,
              title: "Uploading screenshots... ⬆️",
              description: `${current} of ${total} uploaded...`,
            });
          });
          const newScreenshots = uploadResult.screenshots || [];

          if (!Array.isArray(newScreenshots) || newScreenshots.length === 0) {
            throw new Error('Upload completed but no screenshot URLs were returned.');
          }

          screenshotData = [...screenshotData, ...newScreenshots];

          console.log('Screenshots uploaded successfully:', newScreenshots);
          uploadToast.dismiss();
        } catch (uploadError: any) {
          console.error('Error uploading screenshots:', uploadError);

          toast({
            variant: "destructive",
            title: "Screenshot Upload Failed",
            description: uploadError.message || "Failed to upload new screenshots. Please try again.",
          });

          setIsSubmitting(false);
          return;
        }
      }

      const updateData = {
        title: formData.title.trim(),
        channelUrl: formData.channelUrl.trim(),
        platform: formData.platform,
        category: formData.category,
        contentType: formData.contentType && formData.contentType.trim() !== '' ? formData.contentType : null,
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        subscribers,
        isMonetized: formData.isMonetized ? 1 : 0,
        incomeDetails: formData.incomeDetails.trim(),
        promotionDetails: formData.promotionDetails.trim(),
        preferredPaymentMethods: formData.preferredPaymentMethods,
        thumbnail: profileImageData,
        primary_image: profileImageData,
        screenshots: screenshotData.length > 0 ? screenshotData : [],
      };

      console.log('Updating ad with data:', updateData);

      const result = await updateAd(ad.id, updateData);
      console.log('Ad update result:', result);

      toast({
        title: "Listing Updated Successfully! 🎉",
        description: "Your listing has been updated and is live on the marketplace.",
      });

      if (result.ad) {
        onUpdate(result.ad);
      }

      onClose();
    } catch (error: any) {
      console.error('Error updating ad:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update listing. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-xsm-dark-gray rounded-lg border border-xsm-yellow/20 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-xsm-medium-gray/20">
          <h2 className="text-2xl font-bold text-xsm-yellow">Edit Listing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-white font-medium mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="xsm-input w-full"
              placeholder="Enter listing title"
              required
            />
          </div>

          {/* Social Media Availability Indicator */}
          <div className="p-4 bg-xsm-black/70 border border-xsm-medium-gray/40 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-xsm-yellow uppercase tracking-wider">
                Social Media Platform Availability
              </h4>
              <span className="text-[11px] text-xsm-light-gray">Currently supporting YouTube</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
              <div className="flex items-center gap-2 bg-green-950/70 text-green-400 border border-green-700/60 px-2.5 py-1.5 rounded-lg font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                <span>YouTube — Available</span>
              </div>
              <div className="flex items-center gap-2 bg-xsm-dark-gray text-gray-400 border border-gray-700/40 px-2.5 py-1.5 rounded-lg font-medium opacity-75">
                <span className="w-2 h-2 rounded-full bg-amber-500/60"></span>
                <span>Instagram — Coming Soon</span>
              </div>
              <div className="flex items-center gap-2 bg-xsm-dark-gray text-gray-400 border border-gray-700/40 px-2.5 py-1.5 rounded-lg font-medium opacity-75">
                <span className="w-2 h-2 rounded-full bg-amber-500/60"></span>
                <span>TikTok — Coming Soon</span>
              </div>
              <div className="flex items-center gap-2 bg-xsm-dark-gray text-gray-400 border border-gray-700/40 px-2.5 py-1.5 rounded-lg font-medium opacity-75">
                <span className="w-2 h-2 rounded-full bg-amber-500/60"></span>
                <span>Facebook — Coming Soon</span>
              </div>
              <div className="flex items-center gap-2 bg-xsm-dark-gray text-gray-400 border border-gray-700/40 px-2.5 py-1.5 rounded-lg font-medium opacity-75">
                <span className="w-2 h-2 rounded-full bg-amber-500/60"></span>
                <span>Twitter/X — Coming Soon</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white font-medium mb-2">
              YouTube Channel URL <span className="text-red-400">*</span>
              <span className="text-sm text-xsm-yellow ml-2">(Only YouTube URLs supported)</span>
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                name="channelUrl"
                value={formData.channelUrl}
                onChange={handleInputChange}
                className="xsm-input flex-1"
                placeholder="Paste your YouTube channel URL (e.g., https://www.youtube.com/@channel)"
                required
              />
              <button
                type="button"
                onClick={handleExtractProfile}
                disabled={isExtracting || !formData.channelUrl.trim()}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${
                  isExtracting || !formData.channelUrl.trim()
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-xsm-yellow text-black hover:bg-yellow-400'
                }`}
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Auto-Fill
                  </>
                )}
              </button>
            </div>

            {extractedData && (
              <div className="mt-3 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
                <p className="text-green-400 text-sm">
                  ✅ Extracted: <strong>{extractedData.title}</strong>
                  {(extractedData.followers || extractedData.subscribers) && (
                    <span> • {formatFollowerCount(extractedData.followers || extractedData.subscribers)} followers</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-white font-medium mb-2">
              Platform <span className="text-red-400">*</span>
            </label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleInputChange}
              className="xsm-input w-full"
              required
            >
              <option value="">Select Platform</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>

          <div className="relative" ref={categoryDropdownRef}>
            <label className="block text-white font-medium mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <div
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="xsm-input w-full flex items-center justify-between cursor-pointer"
            >
              <span className="text-white font-medium">
                {formData.category || "-- Select category --"}
              </span>
              <ChevronDown className="w-5 h-5 text-xsm-yellow" />
            </div>

            {showCategoryDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-xsm-black rounded-md shadow-lg border border-xsm-medium-gray overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {contentCategories.map((cat) => (
                    <div
                      key={cat}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, category: cat }));
                        setShowCategoryDropdown(false);
                      }}
                      className={`px-4 py-3 cursor-pointer hover:bg-xsm-medium-gray/30 ${
                        formData.category === cat
                          ? 'bg-xsm-yellow text-black font-semibold'
                          : 'text-white font-medium'
                      }`}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={contentTypeDropdownRef}>
            <label className="block text-white font-medium mb-2">Content Type</label>
            <div
              onClick={() => setShowContentTypeDropdown(!showContentTypeDropdown)}
              className="xsm-input w-full flex items-center justify-between cursor-pointer"
            >
              <span className="text-white font-medium">
                {formData.contentType || "-- Select content type --"}
              </span>
              <ChevronDown className="w-5 h-5 text-xsm-yellow" />
            </div>

            {showContentTypeDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-xsm-black rounded-md shadow-lg border border-xsm-medium-gray overflow-hidden">
                {contentTypes.map((type) => (
                  <div
                    key={type}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, contentType: type }));
                      setShowContentTypeDropdown(false);
                    }}
                    className={`px-4 py-3 cursor-pointer hover:bg-xsm-medium-gray/30 ${
                      formData.contentType === type
                        ? 'bg-xsm-yellow text-black font-semibold'
                        : 'text-white font-medium'
                    }`}
                  >
                    {type}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-white font-medium mb-2">
              Price ($) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              className="xsm-input w-full"
              placeholder="Enter price"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-white font-medium mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="xsm-input w-full min-h-[120px] resize-y"
              placeholder="Describe your channel, content type, audience, and what makes it valuable..."
              rows={4}
            />
          </div>

          {/* Ways of Earning — Platform Specific Method Selection Chips */}
          <div>
            <label className="block text-white font-medium mb-1.5">Ways of Earning</label>
            <p className="text-xs text-xsm-light-gray mb-2.5">
              Select monetization and revenue methods used for this account:
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {[
                'AdSense Monetization',
                'Brand Sponsorships',
                'Affiliate Marketing',
                'Channel Memberships',
                'Merch & Digital Products',
                'Sponsored Posts',
                'Creator Rewards Program',
                'LIVE Gifting & Tips'
              ].map((method) => {
                const isSelected = (formData.incomeDetails || '').includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      const current = (formData.incomeDetails || '')
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);

                      let updated: string[];
                      if (current.includes(method)) {
                        updated = current.filter(m => m !== method);
                      } else {
                        updated = [...current, method];
                      }
                      setFormData(prev => ({ ...prev, incomeDetails: updated.join(', ') }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-xsm-yellow text-black border-xsm-yellow shadow-md'
                        : 'bg-xsm-black/80 text-gray-300 border-xsm-medium-gray/40 hover:border-xsm-yellow/50 hover:text-white'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{method}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              name="incomeDetails"
              value={formData.incomeDetails}
              onChange={handleInputChange}
              className="xsm-input w-full text-xs"
              placeholder="Or type custom earning methods (e.g., AdSense, Sponsorships)"
            />
          </div>

          {/* Preferred Payment Methods Selector */}
          <div className="p-4 bg-xsm-black/50 border border-xsm-medium-gray/30 rounded-xl space-y-3">
            <label className="block text-white font-semibold text-sm">
              Preferred Payment Methods <span className="text-xsm-light-gray font-normal text-xs">(Select options you accept)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PAYMENT_METHODS.map((pm) => {
                const isSelected = (formData.preferredPaymentMethods || []).includes(pm.name);
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const current = prev.preferredPaymentMethods || [];
                        const next = current.includes(pm.name)
                          ? current.filter(m => m !== pm.name)
                          : [...current, pm.name];
                        return { ...prev, preferredPaymentMethods: next };
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-xsm-yellow text-xsm-black border-xsm-yellow shadow-md'
                        : 'bg-xsm-dark-gray text-xsm-light-gray border-xsm-medium-gray/40 hover:border-xsm-yellow/50 hover:text-white'
                    }`}
                  >
                    <span>{pm.icon}</span>
                    <span>{pm.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-white font-medium mb-2">Screenshots (Optional)</label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragOver
                  ? 'border-xsm-yellow bg-xsm-yellow/10'
                  : 'border-xsm-medium-gray/50 hover:border-xsm-medium-gray'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('screenshot-upload')?.click()}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="screenshot-upload"
              />

              {imagePreviews.length === 0 ? (
                <>
                  <Upload className="w-8 h-8 text-xsm-medium-gray mx-auto mb-3" />
                  <p className="text-xsm-medium-gray mb-2">
                    Drag and drop images here, or click to select
                  </p>
                  <div className="bg-xsm-yellow text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-400 transition-colors inline-block">
                    Choose Files
                  </div>
                  <p className="text-xs text-xsm-light-gray mt-3">
                    PNG, JPG, JPEG • Max {MAX_SCREENSHOTS} images • 10MB each
                  </p>
                </>
              ) : (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-xsm-yellow rounded-full"></div>
                      <p className="text-sm font-medium text-white">
                        {imagePreviews.length} image{imagePreviews.length !== 1 ? 's' : ''} loaded
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllImages();
                      }}
                      className="text-sm text-red-400 hover:text-red-300 underline transition-colors"
                      type="button"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                    {imagePreviews.map((preview, index) => {
                      const isExistingImage = index < existingScreenshots.length;
                      const imageUrl = getImageUrl(preview) || preview || '/default-avatar.png';

                      return (
                        <div
                          key={`${preview}-${index}`}
                          className="relative group cursor-move"
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOverImage(e, index)}
                          onDrop={(e) => handleDropImage(e, index)}
                        >
                          <div className="absolute -top-2 -left-2 w-6 h-6 bg-xsm-yellow text-black rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-lg">
                            {index + 1}
                          </div>

                          <div className="aspect-square rounded-lg overflow-hidden bg-black border border-xsm-medium-gray group-hover:border-xsm-yellow transition-all duration-300 group-hover:shadow-lg group-hover:shadow-xsm-yellow/20">
                            <img
                              src={imageUrl}
                              alt={`Screenshot ${index + 1}`}
                              className="w-full h-full object-contain bg-black group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.currentTarget.src = '/default-avatar.png';
                              }}
                            />

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <div className="text-center text-white">
                                <div className="text-xs font-medium">
                                  {isExistingImage ? 'Existing Image' : 'New Image'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-all duration-200 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:scale-110"
                            type="button"
                            title="Remove image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="border-2 border-dashed border-xsm-medium-gray rounded-lg p-4 hover:border-xsm-yellow transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('file-upload-modal')?.click();
                    }}
                  >
                    <Upload className="mx-auto mb-2 text-xsm-medium-gray hover:text-xsm-yellow transition-colors" size={24} />
                    <p className="text-sm text-xsm-medium-gray hover:text-white transition-colors text-center">
                      Click to add more images
                    </p>
                  </div>

                  <div className="mt-4 p-3 bg-xsm-black/30 rounded-lg border border-xsm-medium-gray">
                    <p className="text-xs text-xsm-light-gray">
                      💡 <strong>Tips:</strong> Drag images to reorder. Screenshots are shown in the listing gallery only and will not change the profile picture. Max {MAX_SCREENSHOTS} screenshots.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload-modal"
            />
          </div>

          <div className="flex space-x-4 pt-6 border-t border-xsm-medium-gray/20">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`xsm-button flex items-center gap-2 flex-1 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Listing
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="xsm-button-secondary flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditListingModal;