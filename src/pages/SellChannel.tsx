import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, ChevronDown, Search, RefreshCw, X, DollarSign, CheckCircle2, XCircle, Plus, Sparkles, ShieldCheck } from 'lucide-react';
import { createAd } from '../services/ads';
import { extractProfileData, detectPlatform, formatFollowerCount, normalizeSocialUrl, SUPPORTED_PLATFORMS, PLATFORM_EARNING_METHODS } from '../services/socialMedia';
import { uploadScreenshots } from '../services/uploadService';
import { useAuth } from '@/context/useAuth';
import { useToast } from "@/components/ui/use-toast";
import { getImageUrl } from '@/config/api';
import { compressImage } from '../utils/imageCompressor';

// Get API URL from environment variables
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://xsmmarket.com/api');
};
const MAX_SCREENSHOTS = 20;
const API_URL = getApiUrl();

interface SellChannelProps {
  // No longer need setCurrentPage
}

const SellChannel: React.FC<SellChannelProps> = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editAdId = searchParams.get('edit');
  const isEditMode = !!editAdId;
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

  const generateUniqueVerificationCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'XSM';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const [verificationCode, setVerificationCode] = useState<string>(() => generateUniqueVerificationCode());
  const [isCodeVerified, setIsCodeVerified] = useState<boolean | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const [customEarningInput, setCustomEarningInput] = useState<string>('');

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
    profilePicture: '', // Add profile picture field
    preferredPaymentMethods: [] as string[],
  });

  const handleAddCustomEarningMethod = () => {
    const trimmed = customEarningInput.trim();
    if (!trimmed) return;
    const current = formData.incomeDetails
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      setFormData(prev => ({ ...prev, incomeDetails: updated.join(', ') }));
    }
    setCustomEarningInput('');
  };

  const [isFreshlyMonetized, setIsFreshlyMonetized] = useState<boolean>(false);
  const [hasAdsenseChangeButton, setHasAdsenseChangeButton] = useState<boolean>(false);

  const toggleFreshlyMonetized = () => {
    const nextVal = !isFreshlyMonetized;
    setIsFreshlyMonetized(nextVal);
    const current = formData.incomeDetails
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    let updated: string[];
    if (nextVal) {
      if (!current.some(m => m.toLowerCase() === 'freshly monetized')) {
        updated = ['Freshly Monetized', ...current];
      } else {
        updated = current;
      }
    } else {
      updated = current.filter(m => m.toLowerCase() !== 'freshly monetized');
    }
    setFormData(prev => ({ ...prev, incomeDetails: updated.join(', ') }));
  };

  const toggleAdsenseChangeButton = () => {
    const nextVal = !hasAdsenseChangeButton;
    setHasAdsenseChangeButton(nextVal);
    const current = formData.incomeDetails
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    let updated: string[];
    if (nextVal) {
      if (!current.some(m => m.toLowerCase().includes('adsense change'))) {
        updated = ['AdSense Change Button On', ...current];
      } else {
        updated = current;
      }
    } else {
      updated = current.filter(m => !m.toLowerCase().includes('adsense change'));
    }
    setFormData(prev => ({ ...prev, incomeDetails: updated.join(', ') }));
  };

  const handleRemoveEarningMethod = (methodToRemove: string) => {
    const current = formData.incomeDetails
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const updated = current.filter(m => m !== methodToRemove);
    if (methodToRemove.toLowerCase() === 'freshly monetized') {
      setIsFreshlyMonetized(false);
    }
    if (methodToRemove.toLowerCase().includes('adsense change')) {
      setHasAdsenseChangeButton(false);
    }
    setFormData(prev => ({ ...prev, incomeDetails: updated.join(', ') }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); // Add extraction loading state
  const [extractedData, setExtractedData] = useState<any>(null); // Store extracted data
  const [showContentTypeDropdown, setShowContentTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>([]); // For edit mode
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);

  // Title and subscribers come from auto-extraction; required before creating listing
  // Note: formData.subscribers = "" means never extracted; "0" = extracted 0 followers (valid)
  const isFieldsValid = 
    formData.channelUrl.trim().length > 0 &&
    formData.category.trim().length > 0 &&
    formData.price.trim().length > 0 && parseFloat(formData.price) >= 5 &&
    formData.subscribers !== '' && !isNaN(parseInt(formData.subscribers));

  // For new listings verification is required; edit mode skips verification
  const isFormValid = isFieldsValid && (isEditMode || isCodeVerified === true);

  const getValidationMissingReason = (): string | null => {
    if (!formData.channelUrl.trim()) return '🔗 Please enter your profile / channel URL';
    if (!isEditMode && isCodeVerified === null) return '⚡ Click "Auto-Fill" to extract profile details & verify ownership code';
    if (!isEditMode && isCodeVerified === false) return '❌ Ownership code not found in bio. Add code to bio and click "Auto-Fill"';
    if (formData.subscribers === '' || isNaN(parseInt(formData.subscribers))) return '📊 Followers / Subscribers must be auto-extracted — click "Auto-Fill" on your profile URL';
    if (!formData.category.trim()) return '📌 Please select a Topic / Category';
    if (!formData.price.trim() || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 5) return '💰 Please enter listing price (minimum $5)';
    return null;
  };
  const contentTypeDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const checkBioContainsCode = (text: string, code: string): boolean => {
    if (!text || !code) return false;
    const cleanText = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return Boolean(cleanCode && cleanText.includes(cleanCode));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Auto-verify if the user enters or pastes their bio / description containing the verification code
    if (name === 'description' && typeof value === 'string' && verificationCode) {
      if (checkBioContainsCode(value, verificationCode)) {
        setIsCodeVerified(true);
        toast({
          title: "Account Ownership Verified! ✅",
          description: `Verification code ${verificationCode} verified in description.`,
        });
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileArray = Array.from(selectedFiles);
      processFiles(fileArray);
    }
  };

  const processFiles = (fileArray: File[]) => {
    // Filter for image files only
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== fileArray.length) {
      toast({
        variant: "destructive",
        title: "Invalid files",
        description: "Only image files are allowed.",
      });
    }

    // Check if adding these files would exceed the limit
    const totalFiles = existingScreenshots.length + files.length + imageFiles.length;
    if (totalFiles > MAX_SCREENSHOTS) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `You can only upload up to ${MAX_SCREENSHOTS} images total. You currently have ${existingScreenshots.length + files.length} images.`,
      });
      return;
    }

    // Add to existing files instead of replacing
    const newFiles = [...files, ...imageFiles];
    setFiles(newFiles);
    
    // Create preview URLs for all new files and combine with existing
    const newFilePreviews = newFiles.map(file => URL.createObjectURL(file));
    setImagePreviews([...existingScreenshots, ...newFilePreviews]);
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
    // Check if it's an existing screenshot or a new file
    if (index < existingScreenshots.length) {
      // Remove from existing screenshots
      const newExistingScreenshots = existingScreenshots.filter((_, i) => i !== index);
      setExistingScreenshots(newExistingScreenshots);
      
      // Update previews to combine existing and new
      const newFilePreviews = files.map(file => URL.createObjectURL(file));
      setImagePreviews([...newExistingScreenshots, ...newFilePreviews]);
    } else {
      // Remove from new files
      const fileIndex = index - existingScreenshots.length;
      
      // Clean up the URL object for new files
      const previewUrl = imagePreviews[index];
      if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      
      const newFiles = files.filter((_, i) => i !== fileIndex);
      setFiles(newFiles);
      
      // Update previews
      const newFilePreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews([...existingScreenshots, ...newFilePreviews]);
    }
  };

  // Handle drag start for image reordering
  const handleDragStart = (index: number) => {
    setDraggedImageIndex(index);
  };

  // Handle drag over for image reordering
  const handleDragOverImage = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle drop for image reordering
  const handleDropImage = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
      setDraggedImageIndex(null);
      return;
    }

    // Reorder image previews
    const newPreviews = [...imagePreviews];
    const [draggedPreview] = newPreviews.splice(draggedImageIndex, 1);
    newPreviews.splice(dropIndex, 0, draggedPreview);
    setImagePreviews(newPreviews);

    // Determine if we're moving existing or new images
    const dragIsExisting = draggedImageIndex < existingScreenshots.length;
    const dropIsExisting = dropIndex < existingScreenshots.length;

    if (dragIsExisting && dropIsExisting) {
      // Both are existing images
      const newExisting = [...existingScreenshots];
      const [draggedItem] = newExisting.splice(draggedImageIndex, 1);
      newExisting.splice(dropIndex, 0, draggedItem);
      setExistingScreenshots(newExisting);
    } else if (!dragIsExisting && !dropIsExisting) {
      // Both are new files
      const dragFileIndex = draggedImageIndex - existingScreenshots.length;
      const dropFileIndex = dropIndex - existingScreenshots.length;
      const newFiles = [...files];
      const [draggedFile] = newFiles.splice(dragFileIndex, 1);
      newFiles.splice(dropFileIndex, 0, draggedFile);
      setFiles(newFiles);
    } else {
      // Mixed: moving between existing and new - reorganize based on new preview order
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

  // Clean up preview URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => {
        // Only revoke blob URLs, not http/https URLs
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imagePreviews]);

  // Load ad data in edit mode
  useEffect(() => {
    if (isEditMode && editAdId) {
      loadAdData(editAdId);
    }
  }, [isEditMode, editAdId]);

  const loadAdData = async (adId: string) => {
    setIsLoadingAd(true);
    try {
      const response = await fetch(`${API_URL}/ads/${adId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load ad data');
      }
      
      const ad = await response.json();
      
      // Pre-fill form data
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
        isMonetized: ad.isMonetized || ad.monthlyIncome > 0 || false,
        subscribers: ad.subscribers?.toString() || '',
        profilePicture: ad.thumbnail || '',
        preferredPaymentMethods: Array.isArray(ad.preferredPaymentMethods)
          ? ad.preferredPaymentMethods
          : typeof ad.preferredPaymentMethods === 'string'
          ? (function() { try { return JSON.parse(ad.preferredPaymentMethods); } catch { return []; } })()
          : []
      });

      if (ad.verificationCode) {
        setVerificationCode(ad.verificationCode);
      }
      setIsCodeVerified(true);

      // Pre-fill Freshly Monetized & AdSense Change Button states
      const incStr = (ad.incomeDetails || '').toLowerCase();
      const tagsList = Array.isArray(ad.tags) ? ad.tags.map((t: any) => String(t).toLowerCase()) : [];
      setIsFreshlyMonetized(incStr.includes('freshly monetized') || tagsList.some((t: string) => t.includes('freshly')));
      setHasAdsenseChangeButton(incStr.includes('adsense change') || tagsList.some((t: string) => t.includes('adsense change')));
      
      // Load existing screenshots - all images from screenshots field
      const allImages = [];
      
      // Parse and add screenshots
      if (ad.screenshots) {
        let screenshots = [];
        try {
          screenshots = typeof ad.screenshots === 'string' 
            ? JSON.parse(ad.screenshots) 
            : ad.screenshots;
        } catch (e) {
          console.warn('Failed to parse screenshots:', e);
          screenshots = [];
        }
        
        if (Array.isArray(screenshots) && screenshots.length > 0) {
          screenshots.forEach(img => {
            const imgUrl = typeof img === 'string' ? img : (img.data || img.url);
            if (imgUrl) {
              allImages.push(imgUrl);
            }
          });
        }
      }
      
      console.log('Loaded screenshots in edit mode:', allImages);
      
      if (allImages.length > 0) {
        setExistingScreenshots(allImages);
        setImagePreviews(allImages);
      } else {
        console.warn('No screenshots found for this ad');
      }
      
      toast({
        title: "Ad data loaded",
        description: "You can now edit your listing",
      });
      
    } catch (error) {
      console.error('Error loading ad data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load ad data. Please try again.",
      });
      // Navigate back on error
      navigate('/');
    } finally {
      setIsLoadingAd(false);
    }
  };

  const toggleMonetization = () => {
    setFormData(prev => ({
      ...prev,
      isMonetized: !prev.isMonetized
    }));
  };

  // Helper to verify Supported Social Media URL (handles @handle and short domains)
  const isSupportedSocialUrl = (url: string): boolean => {
    if (!url) return false;
    const clean = url.trim().toLowerCase();
    if (clean.startsWith('@')) return true;
    return /youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok|vt\.tiktok|instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.watch|twitter\.com|x\.com|t\.me|telegram\.me|telegram\.dog/.test(clean);
  };

  // Auto-extract when a valid social media URL is detected (debounced 1.5s after typing stops)
  useEffect(() => {
    const url = formData.channelUrl.trim();
    if (!url) return;
    if (!isSupportedSocialUrl(url)) {
      return;
    }

    const timer = setTimeout(async () => {
      if (isExtracting) return;
      setIsExtracting(true);
      try {
        const result = await extractProfileData(url, verificationCode);
        const profileData = result.data;
        setExtractedData(profileData);
        const subCount = profileData.followers || profileData.subscribers || 0;
        const detectedPlat = profileData.platform || detectPlatform(url) || 'youtube';

        if (profileData.codeVerified) {
          setIsCodeVerified(true);
        } else {
          setIsCodeVerified(false);
        }

        setFormData(prev => ({
          ...prev,
          title: profileData.title || prev.title,
          platform: detectedPlat,
          subscribers: String(subCount),
          profilePicture: profileData.profilePicture || prev.profilePicture,
          description: profileData.description || prev.description,
        }));

        if (profileData.title) {
          const platformLabel = detectedPlat === 'twitter' ? 'Twitter / X' : detectedPlat.charAt(0).toUpperCase() + detectedPlat.slice(1);
          if (profileData.codeVerified) {
            toast({
              title: '✅ Account Ownership Verified!',
              description: `Verification code ${verificationCode} found in ${platformLabel} bio.`,
            });
          } else {
            toast({
              variant: "destructive",
              title: `⚠️ Code Not Found in ${platformLabel} Bio`,
              description: `Please add code ${verificationCode} to your ${platformLabel} account bio/description to verify ownership.`,
            });
          }
        }
      } catch (err) {
        console.warn('Auto-extract failed:', err);
      } finally {
        setIsExtracting(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [formData.channelUrl, verificationCode]);

  // Manual extract button handler
  const handleExtractProfile = async () => {
    const url = formData.channelUrl.trim();
    if (!url) {
      toast({
        variant: "destructive",
        title: "Missing URL",
        description: "Please enter a valid social media URL first",
      });
      return;
    }

    if (!isSupportedSocialUrl(url)) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Please enter a valid YouTube, TikTok, Instagram, Facebook, Twitter/X, or Telegram link.",
      });
      return;
    }

    setIsExtracting(true);
    try {
      const result = await extractProfileData(url, verificationCode);
      const profileData = result.data;
      
      setExtractedData(profileData);
      
      const subCount = profileData.followers || profileData.subscribers || 0;
      const detectedPlat = profileData.platform || detectPlatform(url) || 'youtube';

      if (profileData.codeVerified) {
        setIsCodeVerified(true);
      } else {
        setIsCodeVerified(false);
      }

      setFormData(prev => ({
        ...prev,
        title: profileData.title || prev.title,
        platform: detectedPlat,
        subscribers: String(subCount),
        profilePicture: profileData.profilePicture || prev.profilePicture,
        description: profileData.description || prev.description,
      }));

      if (profileData.codeVerified) {
        toast({
          title: "Profile Extracted & Code Verified! ✅",
          description: `Verification code ${verificationCode} verified in profile details.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "❌ Verification Code Missing",
          description: `Verification code ${verificationCode} was NOT found in your profile description/bio. Please add it to your bio and try again.`,
        });
      }
      
    } catch (error: any) {
      console.error('Profile extraction error:', error);
      toast({
        variant: "destructive",
        title: "Extraction Failed",
        description: `Failed to extract profile data: ${error.message}. Please fill in the information manually.`,
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Verification Guard (New listings only)
      if (!isEditMode && !isCodeVerified) {
        toast({
          variant: "destructive",
          title: "Channel Ownership Not Verified ❌",
          description: `You must add verification code ${verificationCode} to your profile description/bio and extract details before publishing.`,
        });
        setIsSubmitting(false);
        return;
      }

      // Validation: Social Media URL check
      if (!isSupportedSocialUrl(formData.channelUrl)) {
        toast({
          variant: "destructive",
          title: "Invalid URL",
          description: "Please enter a valid YouTube, TikTok, Instagram, Facebook, Twitter/X, or Telegram link.",
        });
        setIsSubmitting(false);
        return;
      }

      // Validation: Minimum price $5
      const price = parseFloat(formData.price);
      if (price < 5) {
        toast({
          variant: "destructive",
          title: "Invalid Price",
          description: "Minimum price should be $5",
        });
        setIsSubmitting(false);
        return;
      }

      // Validation: Non-negative subscribers
      const subscribers = parseInt(formData.subscribers);
      if (isNaN(subscribers) || subscribers < 0) {
        toast({
          variant: "destructive",
          title: "Invalid Subscribers",
          description: "Subscribers cannot be negative",
        });
        setIsSubmitting(false);
        return;
      }

      // Detect platform dynamically
      let platform = formData.platform || detectPlatform(formData.channelUrl) || 'youtube';

      // Upload new screenshots if any files are selected
      let screenshotData: any[] = existingScreenshots.map((item) => {
        const url = typeof item === 'string' ? item : (item?.url || item?.data || item?.thumbnail || item?.path || '');
        return { url };
      }).filter(item => Boolean(item.url));

      const profileImageData: string = formData.profilePicture || '';

      if (files.length > 0) {
        try {
          console.log('Compressing screenshots client-side...');
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

          console.log('Attempting to upload compressed screenshots...');
          const uploadToast = toast({
            title: "Uploading screenshots... ⬆️",
            description: `0 of ${compressedFiles.length} uploaded...`,
          });

          const uploadResult = await uploadScreenshots(compressedFiles, (progress, currentFile, totalFiles) => {
            uploadToast.update({
              id: uploadToast.id,
              title: "Uploading screenshots... ⬆️",
              description: `Uploading screenshot ${currentFile} of ${totalFiles} (${progress}%)...`,
            });
          });

          uploadToast.dismiss();

          const newScreenshots = uploadResult?.screenshots || [];
          if (Array.isArray(newScreenshots) && newScreenshots.length > 0) {
            newScreenshots.forEach(item => {
              const url = typeof item === 'string' ? item : (item?.url || item?.data || item?.thumbnail || item?.path || '');
              if (url) {
                screenshotData.push({ url });
              }
            });

            toast({
              title: "Screenshots Uploaded! 🖼️",
              description: `Successfully uploaded ${newScreenshots.length} screenshots.`,
            });
          }
        } catch (uploadErr: any) {
          console.warn('Failed to upload screenshots:', uploadErr);
          toast({
            variant: "destructive",
            title: "Screenshot Upload Warning",
            description: `Some screenshots failed to upload: ${uploadErr.message || 'Server error'}. Publishing ad without failed screenshots.`,
          });
        }
      }

      const activeTags: string[] = [];
      if (formData.isMonetized) {
        if (isFreshlyMonetized) activeTags.push('Freshly Monetized');
        if (hasAdsenseChangeButton) activeTags.push('AdSense Change Button On');
      }

      // Prepare ad data
      const adData = {
        title: formData.title || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Channel`,
        channelUrl: formData.channelUrl,
        platform,
        category: formData.category,
        contentType: formData.contentType && formData.contentType.trim() !== '' ? formData.contentType : null,
        description: formData.description || '',
        price: parseFloat(formData.price) || 0,
        subscribers: formData.subscribers ? parseInt(formData.subscribers) : 0,
        isMonetized: formData.isMonetized ? 1 : 0,
        incomeDetails: formData.incomeDetails || '',
        promotionDetails: formData.promotionDetails || '',
        preferredPaymentMethods: formData.preferredPaymentMethods,
        thumbnail: profileImageData,
        primary_image: profileImageData,
        screenshots: screenshotData,
        tags: activeTags,
        verificationCode
      };

      console.log(isEditMode ? 'Updating ad data:' : 'Creating ad data:', adData);

      let result;
      if (isEditMode && editAdId) {
        // Update existing ad
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ads/${editAdId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(adData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update ad');
        }

        result = await response.json();
        
        toast({
          title: "Listing Updated Successfully! ✅",
          description: "Your listing has been updated. Redirecting...",
        });
      } else {
        // Create new ad
        result = await createAd(adData);
        
        toast({
          title: "Listing Created Successfully! 🎉",
          description: "Your listing is now live on the marketplace! Redirecting to your profile...",
        });
      }
      
      console.log('Ad operation result:', result);
      
      // Only reset form if creating new ad, not editing
      if (!isEditMode) {
        setFormData({
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
          profilePicture: '',
        });
        
        // Clean up image previews
        imagePreviews.forEach(url => {
          if (typeof url === 'string' && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        setFiles([]);
        setImagePreviews([]);
        setExistingScreenshots([]);
        setVerificationCode(generateUniqueVerificationCode());
        setIsCodeVerified(null);
      }

      // Small delay before redirect to let user see the success message
      setTimeout(() => {
        // Redirect to profile page to see the listing
        if (user?.username) {
          navigate(`/u/${user.username}`);
        } else {
          navigate('/profile'); // Fallback to redirect component
        }
        // Ensure we scroll to top of the profile page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: isEditMode ? "Failed to Update Listing" : "Failed to Create Listing",
        description: error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close dropdowns when clicking outside
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="xsm-card">
          {/* Loading State */}
          {isLoadingAd ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-xsm-yellow mx-auto mb-4"></div>
              <p className="text-xsm-light-gray">Loading ad data...</p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-8 text-foreground">
                {isEditMode ? 'EDIT LISTING' : 'CREATE NEW LISTING'}
              </h1>

          <div className="space-y-6">
            {/* Auto-extracted Channel Info (read-only display) */}
            {(formData.profilePicture || formData.title) && (
              <div className="flex items-center gap-4 p-4 bg-xsm-dark-gray/60 rounded-lg border border-xsm-medium-gray/30">
                {formData.profilePicture && (
                  <img
                    src={formData.profilePicture}
                    alt="Channel Profile"
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0 ring-2 ring-xsm-yellow/40"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  {formData.title && (
                    <p className="text-foreground font-semibold text-base truncate">{formData.title}</p>
                  )}
                  {formData.subscribers !== '' && (
                    <p className="text-xsm-light-gray text-sm mt-0.5 font-medium">
                      {formatFollowerCount(parseInt(formData.subscribers) || 0)}{' '}
                      {(formData.platform === 'youtube' || formData.platform === 'telegram') ? 'subscribers' : 'followers'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Supported Social Media Platforms Bar & Auto-Detection */}
            {(() => {
              const platformConfigs: Record<string, { id: string; name: string; label: string; placeholder: string; bioInstruction: string }> = {
                youtube: {
                  id: 'youtube',
                  name: 'YouTube',
                  label: 'YouTube Channel Link / Handle',
                  placeholder: 'youtube.com/@channel, @handle, or channel URL',
                  bioInstruction: 'YouTube channel description / bio'
                },
                tiktok: {
                  id: 'tiktok',
                  name: 'TikTok',
                  label: 'TikTok Profile Link / Handle',
                  placeholder: 'tiktok.com/@username, @username, or profile link',
                  bioInstruction: 'TikTok profile Bio'
                },
                instagram: {
                  id: 'instagram',
                  name: 'Instagram',
                  label: 'Instagram Profile Link / Handle',
                  placeholder: 'instagram.com/username or @username',
                  bioInstruction: 'Instagram profile Bio'
                },
                facebook: {
                  id: 'facebook',
                  name: 'Facebook',
                  label: 'Facebook Page / Profile Link',
                  placeholder: 'facebook.com/pagename or fb.com/profile',
                  bioInstruction: 'Facebook Page About / Intro'
                },
                twitter: {
                  id: 'twitter',
                  name: 'Twitter / X',
                  label: 'Twitter / X Profile Link / Handle',
                  placeholder: 'x.com/username or twitter.com/username',
                  bioInstruction: 'Twitter / X account Bio'
                },
                telegram: {
                  id: 'telegram',
                  name: 'Telegram',
                  label: 'Telegram Channel / Group Link',
                  placeholder: 't.me/channelname or @channelname',
                  bioInstruction: 'Telegram channel description'
                }
              };

              const detectedPlatKey = detectPlatform(formData.channelUrl) || formData.platform || 'youtube';
              const activeConfig = platformConfigs[detectedPlatKey] || platformConfigs['youtube'];
              const currentEarningList = formData.incomeDetails
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
              const presetMethods = PLATFORM_EARNING_METHODS[detectedPlatKey] || PLATFORM_EARNING_METHODS.default;
              const customSelectedMethods = currentEarningList.filter(m => !presetMethods.includes(m));

              return (
                <>
                  {/* Supported Social Media Platforms Overview Bar */}
                  <div className="p-4 bg-xsm-black/70 border border-xsm-medium-gray/40 rounded-xl mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold text-xsm-yellow uppercase tracking-wider flex items-center gap-1.5">
                        <span>🌐</span> Available Platforms for Selling
                      </h4>
                      <span className="text-[11px] text-green-400 font-semibold">
                        Auto-detected from link: <strong className="text-white uppercase">{activeConfig.name}</strong>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                      {SUPPORTED_PLATFORMS.map(plat => {
                        const isDetected = detectedPlatKey === plat.id;
                        return (
                          <div
                            key={plat.id}
                            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl font-bold transition-all border ${
                              isDetected
                                ? 'bg-xsm-yellow text-black border-xsm-yellow ring-2 ring-xsm-yellow/50 shadow-lg scale-105'
                                : 'bg-xsm-dark-gray/60 text-gray-400 border-xsm-medium-gray/30'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isDetected ? 'bg-black animate-ping' : 'bg-gray-500'}`}></span>
                            <span>{plat.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Channel Ownership Verification Banner */}
                  {!isEditMode && (
                    <div className="p-5 bg-gradient-to-r from-amber-950/60 via-xsm-black to-xsm-dark-gray border border-amber-500/40 rounded-xl shadow-lg mb-6">
                      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">🔐</span>
                            <h3 className="text-white font-bold text-base">{activeConfig.name} Ownership Verification</h3>
                          </div>
                          <p className="text-xsm-light-gray text-xs leading-relaxed mb-3">
                            To verify ownership, add this unique 10-character code into your <strong className="text-xsm-yellow">{activeConfig.bioInstruction}</strong> before extracting.
                          </p>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="bg-xsm-black border border-amber-500/50 rounded-lg px-4 py-2 font-mono text-amber-400 font-bold tracking-widest text-lg select-all shadow-inner">
                              {verificationCode}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(verificationCode);
                                setIsCopied(true);
                                toast({ title: "Code Copied! 📋", description: `${verificationCode} copied to clipboard.` });
                                setTimeout(() => setIsCopied(false), 2000);
                              }}
                              className="px-3.5 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              {isCopied ? 'Copied! ✅' : '📋 Copy Code'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const bioToCheck = (formData.description || '') + ' ' + (extractedData?.description || '');
                                if (checkBioContainsCode(bioToCheck, verificationCode)) {
                                  setIsCodeVerified(true);
                                  toast({
                                    title: "Account Ownership Verified! ✅",
                                    description: `Code ${verificationCode} verified successfully.`,
                                  });
                                } else {
                                  // Re-trigger extraction
                                  if (formData.channelUrl.trim()) {
                                    handleExtractProfile();
                                  } else {
                                    toast({
                                      variant: "destructive",
                                      title: "Code Not Detected Yet",
                                      description: `Please add code ${verificationCode} to your bio or paste your bio into the Description field below.`,
                                    });
                                  }
                                }
                              }}
                              className="px-3.5 py-2 bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            >
                              🔍 Verify Code
                            </button>
                          </div>
                        </div>
                        
                        {/* Status indicator */}
                        <div className="self-stretch sm:self-center flex flex-col items-center sm:items-end justify-center min-w-[150px] pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-500/20">
                          {isCodeVerified === true && (
                            <div className="bg-green-950/80 border border-green-500/60 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                              <span>Code Verified ✅</span>
                            </div>
                          )}
                          {isCodeVerified === false && (
                            <div className="bg-red-950/80 border border-red-500/60 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                              <span>Code Missing ❌</span>
                            </div>
                          )}
                          {isCodeVerified === null && (
                            <div className="bg-amber-950/80 border border-amber-500/60 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                              <span>Pending Extract ⏳</span>
                            </div>
                          )}
                          <p className="text-[10px] text-xsm-medium-gray mt-1 text-center sm:text-right">
                            {isCodeVerified === true
                              ? 'Found in profile bio'
                              : isCodeVerified === false
                              ? 'Not found in profile bio'
                              : 'Add code to bio & extract'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* URL / Link Input with Auto-Detection & Auto-Extract */}
                  <div>
                    <label className="block text-foreground font-medium mb-2">
                      {activeConfig.label}
                      <span className="text-sm text-xsm-yellow ml-2">(Auto-detects platform, bio & followers)</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        name="channelUrl"
                        value={formData.channelUrl}
                        onChange={handleInputChange}
                        className="xsm-input flex-1"
                        placeholder={activeConfig.placeholder}
                      />
                      <button
                        type="button"
                        onClick={handleExtractProfile}
                        disabled={isExtracting || !formData.channelUrl.trim()}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${
                          isExtracting || !formData.channelUrl.trim()
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-xsm-yellow text-black hover:bg-yellow-400 cursor-pointer'
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
                      <div className="mt-3 p-3.5 bg-green-900/30 border border-green-500/50 rounded-xl flex items-center justify-between flex-wrap gap-2">
                        <p className="text-green-400 text-sm font-semibold flex items-center gap-2">
                          <span>✅ Extracted:</span>
                          <strong className="text-white">{extractedData.title || extractedData.channelName}</strong>
                          {Boolean(extractedData.followers || extractedData.subscribers) && (
                            <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full text-xs font-bold border border-green-500/40">
                              • {formatFollowerCount(extractedData.followers || extractedData.subscribers)} {(detectedPlatKey === 'youtube' || detectedPlatKey === 'telegram') ? 'subscribers' : 'followers'}
                            </span>
                          )}
                        </p>
                        {extractedData.description && (
                          <p className="text-gray-300 text-xs mt-1 line-clamp-2 w-full">
                            {extractedData.description}
                          </p>
                        )}
                        <span className="text-[11px] text-gray-300 uppercase font-mono tracking-wider bg-black/40 px-2 py-1 rounded">
                          {activeConfig.name}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Category Dropdown */}
            <div className="relative" ref={categoryDropdownRef}>
              <label className="block text-foreground font-medium mb-1.5 text-sm">
                Topic / Category
              </label>
              <div 
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="xsm-input w-full flex items-center justify-between cursor-pointer"
              >
                <span className="text-foreground font-medium">
                  {formData.category || "-- Select topic --"}
                </span>
                <ChevronDown className="w-5 h-5 text-xsm-yellow" />
              </div>
              
              {/* Dropdown menu */}
              {showCategoryDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-xsm-dark-gray rounded-md shadow-lg border border-xsm-medium-gray overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {contentCategories.map((cat) => (
                      <div
                        key={cat}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, category: cat }));
                          setShowCategoryDropdown(false);
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-xsm-medium-gray/30 ${
                          formData.category === cat ? 'bg-xsm-yellow text-black font-semibold' : 'text-foreground font-medium'
                        }`}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Listing Price Input (Follower Count input removed — auto-displayed above) */}
            <div>
              <label className="block text-foreground font-medium mb-1.5 text-sm">
                Listing Price ($ USD)
                <span className="text-xsm-yellow text-xs ml-2">(Minimum $5)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">$</span>
                <input
                  type="number"
                  min="5"
                  step="1"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="xsm-input w-full pl-8"
                  placeholder="Enter listing price in USD (e.g. 50)"
                />
              </div>
            </div>

            {/* Optional Fields Section */}
            <div className="pt-6">
              <h2 className="text-xl font-medium mb-4">Optional fields</h2>
              
              {/* Description */}
              <div className="mb-6">
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="xsm-input w-full resize-none"
                  rows={4}
                  placeholder="Listing description (posting contacts is prohibited)"
                />
              </div>

              {/* Monetization Status — Interactive Cards */}
              <div className="mb-6">
                <label className="block text-white font-medium mb-2.5">
                  Monetization Status
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isMonetized: true }))}
                    className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex items-start gap-3.5 cursor-pointer ${
                      formData.isMonetized
                        ? 'border-green-500 bg-gradient-to-br from-green-950/40 via-green-900/20 to-xsm-dark-gray text-white ring-2 ring-green-500/80 shadow-lg shadow-green-500/10'
                        : 'border-xsm-medium-gray/40 bg-xsm-black/60 text-gray-300 hover:border-green-500/50 hover:text-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      formData.isMonetized ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-inner' : 'bg-xsm-dark-gray text-gray-400 border border-xsm-medium-gray/30'
                    }`}>
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white">Monetized</span>
                        {formData.isMonetized && (
                          <span className="bg-green-500/20 text-green-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 inline" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Channel is approved for monetization and actively eligible to earn revenue
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, isMonetized: false }));
                      setIsFreshlyMonetized(false);
                      setHasAdsenseChangeButton(false);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex items-start gap-3.5 cursor-pointer ${
                      !formData.isMonetized
                        ? 'border-xsm-yellow bg-gradient-to-br from-amber-950/30 via-xsm-yellow/10 to-xsm-dark-gray text-white ring-2 ring-xsm-yellow/80 shadow-lg shadow-yellow-500/10'
                        : 'border-xsm-medium-gray/40 bg-xsm-black/60 text-gray-300 hover:border-xsm-yellow/50 hover:text-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      !formData.isMonetized ? 'bg-xsm-yellow/20 text-xsm-yellow border border-xsm-yellow/40 shadow-inner' : 'bg-xsm-dark-gray text-gray-400 border border-xsm-medium-gray/30'
                    }`}>
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white">Not Monetized</span>
                        {!formData.isMonetized && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 inline" /> Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Not yet monetized or ready to apply for monetization once requirements are met
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Monetization Details & Ways of Earning — Rendered ONLY when Monetized */}
              {formData.isMonetized && (() => {
                const detectedPlatKey = detectPlatform(formData.channelUrl) || formData.platform || 'youtube';
                const currentEarningList = formData.incomeDetails
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean);
                const presetMethods = PLATFORM_EARNING_METHODS[detectedPlatKey] || PLATFORM_EARNING_METHODS.default;
                const customSelectedMethods = currentEarningList.filter(
                  m => !presetMethods.includes(m) && m.toLowerCase() !== 'freshly monetized' && !m.toLowerCase().includes('adsense change')
                );

                return (
                  <div className="mb-6 space-y-4">
                    {/* 2 Monetization Specifications: Freshly Monetized & AdSense Change Button On */}
                    <div className="p-4 rounded-xl border transition-all" style={{ background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                          <label className="block font-bold text-sm" style={{ color: 'var(--xsm-text)' }}>
                            Monetization Options
                          </label>
                        </div>
                        <span className="text-xs text-xsm-yellow font-semibold">Select applicable details</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Option 1: Freshly Monetized */}
                        <button
                          type="button"
                          onClick={toggleFreshlyMonetized}
                          className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex items-start gap-3 cursor-pointer group ${
                            isFreshlyMonetized
                              ? 'border-emerald-500 bg-gradient-to-br from-emerald-950/60 via-emerald-900/30 to-xsm-dark-gray text-white ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-500/20'
                              : 'hover:border-emerald-500/50'
                          }`}
                          style={!isFreshlyMonetized ? { background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' } : undefined}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                            isFreshlyMonetized
                              ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/50 shadow-inner'
                              : 'border group-hover:text-emerald-400'
                          }`}
                          style={!isFreshlyMonetized ? { background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)', color: 'var(--xsm-light-gray)' } : undefined}
                          >
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-sm flex items-center gap-1.5" style={{ color: isFreshlyMonetized ? '#ffffff' : 'var(--xsm-text)' }}>
                                Freshly Monetized
                              </span>
                              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                                isFreshlyMonetized
                                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm font-bold'
                                  : 'border'
                              }`}
                              style={!isFreshlyMonetized ? { background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)', color: 'var(--xsm-light-gray)' } : undefined}
                              >
                                {isFreshlyMonetized ? '✓ Active' : 'Off'}
                              </span>
                            </div>
                            <p className="text-xs leading-snug" style={{ color: 'var(--xsm-light-gray)' }}>
                              Recently approved for monetization with clean history and 0 policy strikes
                            </p>
                          </div>
                        </button>

                        {/* Option 2: AdSense Change Button On */}
                        <button
                          type="button"
                          onClick={toggleAdsenseChangeButton}
                          className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex items-start gap-3 cursor-pointer group ${
                            hasAdsenseChangeButton
                              ? 'border-cyan-500 bg-gradient-to-br from-cyan-950/60 via-cyan-900/30 to-xsm-dark-gray text-white ring-2 ring-cyan-500/80 shadow-lg shadow-cyan-500/20'
                              : 'hover:border-cyan-500/50'
                          }`}
                          style={!hasAdsenseChangeButton ? { background: 'var(--xsm-bg)', borderColor: 'var(--xsm-border)' } : undefined}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                            hasAdsenseChangeButton
                              ? 'bg-cyan-500/25 text-cyan-400 border border-cyan-500/50 shadow-inner'
                              : 'border group-hover:text-cyan-400'
                          }`}
                          style={!hasAdsenseChangeButton ? { background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)', color: 'var(--xsm-light-gray)' } : undefined}
                          >
                            <RefreshCw className={`w-5 h-5 ${hasAdsenseChangeButton ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-sm flex items-center gap-1.5" style={{ color: hasAdsenseChangeButton ? '#ffffff' : 'var(--xsm-text)' }}>
                                AdSense Change Button On
                              </span>
                              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                                hasAdsenseChangeButton
                                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm font-bold'
                                  : 'border'
                              }`}
                              style={!hasAdsenseChangeButton ? { background: 'var(--xsm-dark-gray)', borderColor: 'var(--xsm-border)', color: 'var(--xsm-light-gray)' } : undefined}
                              >
                                {hasAdsenseChangeButton ? '✓ On / Ready' : 'Off'}
                              </span>
                            </div>
                            <p className="text-xs leading-snug" style={{ color: 'var(--xsm-light-gray)' }}>
                              YouTube Studio 'Change' button is active. Buyer can link their AdSense immediately
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Ways of Earning Panel */}
                    <div className="p-4 rounded-xl border transition-all" style={{ background: 'var(--xsm-dark-gray)', borderColor: 'rgba(34,197,94,0.3)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block font-bold text-sm" style={{ color: 'var(--xsm-text)' }}>
                          Ways of Earning ({detectedPlatKey.charAt(0).toUpperCase() + detectedPlatKey.slice(1)} Monetization)
                        </label>
                        <span className="text-xs text-emerald-500 font-semibold">Select all that apply</span>
                      </div>
                      <p className="text-xs mb-3" style={{ color: 'var(--xsm-light-gray)' }}>
                        Select monetization and revenue methods used for this channel/account:
                      </p>

                      {/* Preset platform-specific chips */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {presetMethods.map((method) => {
                          const isSelected = currentEarningList.includes(method);
                          return (
                            <button
                              key={method}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  handleRemoveEarningMethod(method);
                                } else {
                                  const updated = [...currentEarningList, method];
                                  setFormData(prev => ({ ...prev, incomeDetails: updated.join(', ') }));
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-xsm-yellow text-black border-xsm-yellow shadow-md scale-105'
                                  : 'hover:border-xsm-yellow/50'
                              }`}
                              style={!isSelected ? { background: 'var(--xsm-bg)', color: 'var(--xsm-text)', borderColor: 'var(--xsm-border)' } : undefined}
                            >
                              {isSelected ? '✓ ' : '+ '}{method}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Selected Chips */}
                      {customSelectedMethods.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2 items-center">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--xsm-light-gray)' }}>Custom Methods:</span>
                          {customSelectedMethods.map(method => (
                            <span
                              key={method}
                              className="px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border"
                              style={{ background: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.4)', color: 'var(--xsm-text)' }}
                            >
                              <span>✓ {method}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveEarningMethod(method)}
                                className="hover:text-red-400 transition-colors cursor-pointer"
                                style={{ color: 'var(--xsm-light-gray)' }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dedicated Custom Earning Input with + Add Button */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customEarningInput}
                          onChange={(e) => setCustomEarningInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomEarningMethod();
                            }
                          }}
                          className="xsm-input flex-1 text-xs"
                          placeholder="Type custom earning method and click Add (e.g. Brand Sponsorship, Affiliate, Merchandise)..."
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomEarningMethod}
                          disabled={!customEarningInput.trim()}
                          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                            customEarningInput.trim()
                              ? 'bg-xsm-yellow text-black hover:bg-yellow-400 cursor-pointer shadow-md'
                              : 'border cursor-not-allowed opacity-60'
                          }`}
                          style={!customEarningInput.trim() ? { background: 'var(--xsm-bg)', color: 'var(--xsm-light-gray)', borderColor: 'var(--xsm-border)' } : undefined}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Specify Primary Content Published — Compact Selection Cards */}
              <div className="mb-6">
                <label className="block text-white font-medium mb-2.5">
                  Specify Primary Content Published
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'Unique content', label: 'Unique Content', icon: '✨', desc: '100% Original' },
                    { id: 'Rewritten', label: 'Rewritten', icon: '✍️', desc: 'Edited / Remixed' },
                    { id: 'Not unique content', label: 'Not Unique', icon: '📋', desc: 'Reuploaded / Curated' },
                    { id: 'Mixed', label: 'Mixed Content', icon: '🔀', desc: 'Original & Reused' },
                  ].map((item) => {
                    const isSelected = formData.contentType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, contentType: item.id }))}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-xsm-yellow bg-xsm-yellow/10 text-xsm-yellow ring-1 ring-xsm-yellow shadow-md'
                            : 'border-xsm-medium-gray/40 bg-xsm-black/60 text-gray-300 hover:border-xsm-yellow/50 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{item.icon}</span>
                          <span className="font-bold text-xs">{item.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Screenshot Upload */}
              <div className="mt-6">
                <h3 className="text-base font-medium mb-3 text-white">Screenshots (Optional)</h3>
                <p className="text-sm text-xsm-light-gray mb-4">
                  Add screenshots to showcase your channel (proof of income, analytics, etc.)
                </p>
                
                <div 
                  className={`border-2 border-dashed rounded-lg text-center transition-all duration-300 cursor-pointer ${
                    isDragOver 
                      ? 'border-xsm-yellow bg-xsm-yellow/10 scale-105' 
                      : files.length > 0 
                        ? 'border-xsm-yellow/50 bg-xsm-dark-gray' 
                        : 'border-xsm-medium-gray hover:border-xsm-yellow hover:bg-xsm-dark-gray/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  {imagePreviews.length === 0 ? (
                    // Show upload prompt when no files
                    <div className="p-8">
                      <Upload className={`mx-auto mb-3 transition-colors ${
                        isDragOver ? 'text-xsm-yellow animate-bounce' : 'text-xsm-medium-gray'
                      }`} size={32} />
                      
                      <p className={`mb-3 font-medium transition-colors ${
                        isDragOver ? 'text-xsm-yellow' : 'text-xsm-medium-gray'
                      }`}>
                        {isDragOver ? 'Drop your images here!' : 'Drag and drop images here, or click to select'}
                      </p>
                      
                      <div className="bg-xsm-yellow text-black px-6 py-3 rounded-lg font-medium hover:bg-yellow-400 transition-colors inline-block">
                        Choose Files
                      </div>
                      
                      <p className="text-xs text-xsm-light-gray mt-3">
                        PNG, JPG, JPEG • Max 20 images • 10MB each
                      </p>
                    </div>
                  ) : (
                    // Show thumbnails inside the box when files are uploaded
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-xsm-yellow rounded-full"></div>
                          <p className="text-sm font-medium text-white">
                            {imagePreviews.length} image{imagePreviews.length !== 1 ? 's' : ''} {existingScreenshots.length > 0 && files.length > 0 ? `(${existingScreenshots.length} existing + ${files.length} new)` : existingScreenshots.length > 0 ? 'loaded' : 'ready to upload'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the file chooser
                            imagePreviews.forEach(url => {
                              if (typeof url === 'string' && url.startsWith('blob:')) {
                                URL.revokeObjectURL(url);
                              }
                            });
                            setFiles([]);
                            setImagePreviews([]);
                            setExistingScreenshots([]);
                          }}
                          className="text-sm text-red-400 hover:text-red-300 underline transition-colors"
                          type="button"
                        >
                          Clear all
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                        {imagePreviews.map((preview, index) => {
                          const isExisting = index < existingScreenshots.length;
                          const file = isExisting ? null : files[index - existingScreenshots.length];
                          const imageUrl = getImageUrl(preview);
                          
                          return (
                            <div 
                              key={index} 
                              className="relative group cursor-move"
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOverImage(e, index)}
                              onDrop={(e) => handleDropImage(e, index)}
                            >
                              {/* Number Badge */}
                              <div className="absolute -top-2 -left-2 w-6 h-6 bg-xsm-yellow text-black rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-lg">
                                {index + 1}
                              </div>
                              
                              {/* Square Thumbnail Container */}
                              <div className="aspect-square rounded-lg overflow-hidden bg-xsm-dark-gray border border-xsm-medium-gray group-hover:border-xsm-yellow transition-all duration-300 group-hover:shadow-lg group-hover:shadow-xsm-yellow/20">
                                <img
                                  src={imageUrl || preview}
                                  alt={`Screenshot ${index + 1}`}
                                  className="w-full h-full object-contain bg-black group-hover:scale-105 transition-transform duration-300"                                />
                                
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                  <div className="text-center text-white">
                                    {file && (
                                      <>
                                        <div className="text-xs font-medium mb-1">
                                          {(file.size / 1024 / 1024).toFixed(1)} MB
                                        </div>
                                        <div className="text-xs text-gray-300 truncate max-w-20">
                                          {file.name}
                                        </div>
                                      </>
                                    )}
                                    {isExisting && (
                                      <div className="text-xs font-medium">
                                        Existing Image
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Remove Button - Always visible on mobile, hover on desktop */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the file chooser
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
                      
                      {/* Add more button */}
                      <div className="border-2 border-dashed border-xsm-medium-gray rounded-lg p-4 hover:border-xsm-yellow transition-colors">
                        <Upload className="mx-auto mb-2 text-xsm-medium-gray hover:text-xsm-yellow transition-colors" size={24} />
                        <p className="text-sm text-xsm-medium-gray hover:text-white transition-colors">
                          Click to add more images
                        </p>
                      </div>
                      
                      {/* Upload Tips */}
                      <div className="mt-4 p-3 bg-xsm-black/30 rounded-lg border border-xsm-medium-gray">
                        <p className="text-xs text-xsm-light-gray">
                          💡 <strong>Tips:</strong> Include analytics screenshots, income proof, or channel highlights to attract more buyers
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                </div>
              </div>

              {/* Preferred Payment Methods Selector — Moved to end of form */}
              <div className="mt-8 p-4 bg-xsm-black/50 border border-xsm-medium-gray/30 rounded-xl space-y-3">
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
            </div>

             {/* Submit Button */}
            <div className="mt-8 text-center">
              {/* Helpful diagnostic hint when form is incomplete or verification is pending */}
              {getValidationMissingReason() && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl mb-4 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 shadow-inner">
                  <span>{getValidationMissingReason()}</span>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className={`bg-xsm-yellow text-black py-3.5 rounded-xl font-bold text-base hover:bg-yellow-400 transition-all w-full cursor-pointer shadow-lg ${isSubmitting || !isFormValid ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'}`}
              >
                {isSubmitting 
                  ? (isEditMode ? 'Updating Listing...' : 'Creating Listing...') 
                  : isFormValid
                  ? (isEditMode ? 'Update Listing ✅' : 'Create Listing ✅')
                  : 'Complete Required Fields Above'
                }
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellChannel;
