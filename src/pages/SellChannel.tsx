import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, ChevronDown, Search, RefreshCw, X } from 'lucide-react';
import { createAd } from '../services/ads';
import { extractProfileData, detectPlatform, formatFollowerCount } from '../services/socialMedia';
import { uploadScreenshots } from '../services/uploadService';
import { useAuth } from '@/context/useAuth';
import { useToast } from "@/components/ui/use-toast";
import { getImageUrl } from '@/config/api';

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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); // Add extraction loading state
  const [extractedData, setExtractedData] = useState(null); // Store extracted data
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
  const contentTypeDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

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
        profilePicture: ad.thumbnail || ''
      });
      
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

  // Auto-extract profile data from URL
  const handleExtractProfile = async () => {
    if (!formData.channelUrl.trim()) {
      toast({
        variant: "destructive",
        title: "Missing URL",
        description: "Please enter a social media URL first",
      });
      return;
    }

    setIsExtracting(true);
    try {
      const result = await extractProfileData(formData.channelUrl);
      const profileData = result.data;
      
      setExtractedData(profileData);
      
      // Auto-fill the form with extracted data
      setFormData(prev => ({
        ...prev,
        title: profileData.title || prev.title,
        platform: profileData.platform || detectPlatform(formData.channelUrl) || prev.platform,
        subscribers: profileData.followers || profileData.subscribers || prev.subscribers,
        profilePicture: profileData.profilePicture || prev.profilePicture
      }));

      toast({
        title: "Profile Data Extracted Successfully! ✅",
        description: `Title: ${profileData.title}\nPlatform: ${profileData.platform}\nFollowers: ${formatFollowerCount(profileData.followers || profileData.subscribers || 0)}`,
      });
      
    } catch (error) {
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

      // Validation: Minimum subscribers 100
      const subscribers = parseInt(formData.subscribers);
      if (subscribers < 100) {
        toast({
          variant: "destructive",
          title: "Invalid Subscribers",
          description: "Minimum subscribers should be 100",
        });
        setIsSubmitting(false);
        return;
      }

      // Auto-detect platform from URL
      let platform = 'youtube'; // default
      if (formData.channelUrl.includes('facebook.com') || formData.channelUrl.includes('fb.com')) {
        platform = 'facebook';
      } else if (formData.channelUrl.includes('instagram.com')) {
        platform = 'instagram';
      } else if (formData.channelUrl.includes('twitter.com') || formData.channelUrl.includes('x.com')) {
        platform = 'twitter';
      } else if (formData.channelUrl.includes('tiktok.com')) {
        platform = 'tiktok';
      }

      // Upload new screenshots if any files are selected
      // Upload new screenshots if any files are selected.
// Existing screenshots and newly uploaded screenshots must be stored in ads.screenshots.
// Do not use screenshots as the product profile/listing image.
let screenshotData: any[] = existingScreenshots.map((item) =>
  typeof item === 'string' ? { url: item } : item
);

const profileImageData: string = formData.profilePicture || '';

if (files.length > 0) {
  try {
    console.log('Attempting to upload screenshots...');
    const uploadResult = await uploadScreenshots(files);

    const newScreenshots = uploadResult.screenshots || [];

    if (!Array.isArray(newScreenshots) || newScreenshots.length === 0) {
      throw new Error('Upload completed but no screenshot URLs were returned.');
    }

    screenshotData = [...screenshotData, ...newScreenshots];

    console.log('Screenshots uploaded and ready to save:', screenshotData);
  } catch (uploadError: any) {
    console.error('Error uploading screenshots:', uploadError);

    toast({
      variant: "destructive",
      title: "Screenshot Upload Failed",
      description: uploadError.message || "Screenshots could not be uploaded. Please try again.",
    });

    setIsSubmitting(false);
    return;
  }
}

      // Screenshots are supporting listing images only; the product profile image comes from the extracted channel/profile picture.

      // Prepare ad data with explicit null handling for ENUM fields
      const adData = {
        title: formData.title || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Channel`,
        channelUrl: formData.channelUrl,
        platform,
        category: formData.category,
        contentType: formData.contentType && formData.contentType.trim() !== '' ? formData.contentType : null,
        description: formData.description || '',
        price: parseFloat(formData.price) || 0,
        subscribers: formData.subscribers ? parseInt(formData.subscribers) : 0,
        isMonetized: formData.isMonetized ? 1 : 0, // Convert boolean to integer for MySQL
        incomeDetails: formData.incomeDetails || '',
        promotionDetails: formData.promotionDetails || '',
        // Use extracted channel/profile image for display. Never use screenshots as the listing profile image.
        thumbnail: profileImageData,
        primary_image: profileImageData,
        // Store screenshots separately from the listing profile image
        screenshots: screenshotData,
        tags: []
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
              <h1 className="text-3xl font-bold mb-8">
                {isEditMode ? 'EDIT LISTING' : 'CREATE NEW LISTING'}
              </h1>

          <div className="space-y-6">
            {/* Title Input */}
            <div>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="xsm-input w-full"
                placeholder="Listing title (e.g., 'Premium Gaming YouTube Channel')"
              />
            </div>

            {/* Profile Picture Preview */}
            {formData.profilePicture && (
              <div>
                <label className="block text-white font-medium mb-2">Profile Picture (Auto-extracted)</label>
                <div className="flex items-center gap-4">
                  <img 
                    src={formData.profilePicture} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="text-sm text-xsm-light-gray">
                    Profile picture automatically extracted from your social media URL
                  </div>
                </div>
              </div>
            )}

            {/* URL Input with Auto-Extract */}
            <div>
              <label className="block text-white font-medium mb-2">
                Social Media URL
                <span className="text-sm text-xsm-light-gray ml-2">(Instagram, YouTube, TikTok, Twitter, Facebook)</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  name="channelUrl"
                  value={formData.channelUrl}
                  onChange={handleInputChange}
                  className="xsm-input flex-1"
                  placeholder="Paste your Instagram, YouTube, TikTok, Twitter, or Facebook URL here"
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

            {/* Category Dropdown */}
            <div className="relative" ref={categoryDropdownRef}>
              <div 
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="xsm-input w-full flex items-center justify-between cursor-pointer"
              >
                <span className="text-white font-medium">
                {formData.category || "-- Select topic --"}
                </span>
                <ChevronDown className="w-5 h-5 text-xsm-yellow" />
              </div>
              
              {/* Dropdown menu */}
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
                          formData.category === cat ? 'bg-xsm-yellow text-black font-semibold' : 'text-white font-medium'
                        }`}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Price Input */}
            <div>
              <input
                type="text"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="xsm-input w-full"
                placeholder="Enter price ($)"
              />
            </div>

            {/* Subscribers Input */}
            <div>
              <input
                type="number"
                name="subscribers"
                value={formData.subscribers}
                onChange={handleInputChange}
                className="xsm-input w-full"
                placeholder="Number of subscribers/followers (optional)"
              />
            </div>

            {/* Monetization Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="mr-3 text-white">Channel Status:</span>
                <div className="flex items-center space-x-6">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="monetizationStatus"
                      className="sr-only"
                      checked={!formData.isMonetized}
                      onChange={() => setFormData(prev => ({ ...prev, isMonetized: false }))}
                    />
                    <div className={`flex items-center ${!formData.isMonetized ? 'text-xsm-yellow' : 'text-white'}`}>
                      <div className={`w-4 h-4 mr-2 rounded-full border ${!formData.isMonetized ? 'bg-xsm-yellow border-xsm-yellow' : 'border-white'} flex items-center justify-center`}>
                        {!formData.isMonetized && <div className="w-2 h-2 bg-xsm-black rounded-full"></div>}
                      </div>
                      Non Monetized
                    </div>
                  </label>
                  
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="monetizationStatus"
                      className="sr-only"
                      checked={formData.isMonetized}
                      onChange={() => setFormData(prev => ({ ...prev, isMonetized: true }))}
                    />
                    <div className={`flex items-center ${formData.isMonetized ? 'text-xsm-yellow' : 'text-white'}`}>
                      <div className={`w-4 h-4 mr-2 rounded-full border ${formData.isMonetized ? 'bg-xsm-yellow border-xsm-yellow' : 'border-white'} flex items-center justify-center`}>
                        {formData.isMonetized && <div className="w-2 h-2 bg-xsm-black rounded-full"></div>}
                      </div>
                      Monetized
                    </div>
                  </label>
                </div>
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

              {/* Content Type Dropdown */}
              <div className="mb-6 relative" ref={contentTypeDropdownRef}>
                <div 
                  onClick={() => setShowContentTypeDropdown(!showContentTypeDropdown)}
                  className="xsm-input w-full flex items-center justify-between cursor-pointer"
                >
                  <span className="text-white font-medium">
                  {formData.contentType || "-- Specify the primary content published --"}
                  </span>
                  <ChevronDown className="w-5 h-5 text-xsm-light-gray" />
                </div>
                
                {/* Dropdown menu */}
                {showContentTypeDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-xsm-black rounded-md shadow-lg border border-xsm-medium-gray overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      {contentTypes.map((type) => (
                        <div
                          key={type}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, contentType: type }));
                            setShowContentTypeDropdown(false);
                          }}
                          className={`px-4 py-3 cursor-pointer hover:bg-xsm-medium-gray/30 ${
                            formData.contentType === type ? 'bg-xsm-yellow text-black font-semibold' : 'text-white font-medium'}'
                          }`}
                        >
                          {type}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ways of Earning & Promotion */}
              <div className="mb-6">
                <textarea
                  name="incomeDetails"
                  value={formData.incomeDetails}
                  onChange={handleInputChange}
                  className="xsm-input w-full resize-none mb-4"
                  rows={4}
                  placeholder="Ways of Earning"
                />
                
                <textarea
                  name="promotionDetails"
                  value={formData.promotionDetails}
                  onChange={handleInputChange}
                  className="xsm-input w-full resize-none"
                  rows={4}
                  placeholder="Ways of Promotion"
                />
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
            </div>

            {/* Submit Button */}
            <div className="mt-8 text-center">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`bg-xsm-yellow text-black py-3 rounded-md font-medium hover:bg-yellow-400 transition-colors w-full ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting 
                  ? (isEditMode ? 'Updating Listing...' : 'Creating Listing...') 
                  : (isEditMode ? 'Update Listing' : 'Create Listing')
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
