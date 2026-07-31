
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, MessageCircle, Clock } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

// API URL configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://xsmmarket.com/api';

interface ContactProps {
  // No longer need setCurrentPage
}

const Contact: React.FC<ContactProps> = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const categories = [
    'General Inquiry',
    'Technical Support',
    'Account Issues',
    'Transaction Support',
    'Report a Problem',
    'Partnership Inquiry',
    'Press/Media',
    'Other',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.name || !formData.email || !formData.subject || !formData.category || !formData.message) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/contact/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Message Sent Successfully! ✅",
          description: "We'll get back to you within 24 hours. Thank you for contacting us!",
        });
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          subject: '',
          category: '',
          message: '',
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Send Message",
          description: result.message || 'Something went wrong. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Unable to send message. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-xsm-yellow mb-4">Contact Us</h1>
          <p className="text-xl text-white max-w-3xl mx-auto">
            Have questions or need support? We're here to help. Get in touch with our team 
            and we'll respond as quickly as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Information per Revision 29 */}
          <div className="space-y-6">
            <div className="xsm-card">
              <h3 className="text-xl font-bold text-xsm-yellow mb-6">Get in Touch</h3>
              <div className="space-y-5">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-xsm-yellow flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Email Address</div>
                    <div className="text-xsm-light-gray">support@xsmmarket.com</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MessageCircle className="w-5 h-5 text-xsm-yellow flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Help & Support</div>
                    <div className="text-xsm-light-gray">Available via live chat & ticket support</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xsm-card">
              <h3 className="text-xl font-bold text-xsm-yellow mb-4">Response Time</h3>
              <div className="p-3.5 bg-xsm-black/50 rounded-lg">
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-xsm-yellow" />
                  <span className="text-white font-medium">Fast Support Turnaround</span>
                </div>
                <p className="text-xs text-xsm-light-gray mt-1.5 leading-relaxed">
                  Our team typical responds within 24 hours. 24/7 priority support is available for active transaction escrows.
                </p>
              </div>
            </div>

            <div className="xsm-card">
              <h3 className="text-xl font-bold text-xsm-yellow mb-4">Quick Help</h3>
              <div>
                <button className="w-full text-left p-3 bg-xsm-black/50 rounded-lg hover:bg-xsm-medium-gray transition-colors">
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="w-5 h-5 text-xsm-yellow" />
                    <div>
                      <div className="text-white font-medium">Live Chat</div>
                      <div className="text-xs text-xsm-light-gray">Get instant help</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="xsm-card">
              <h3 className="text-2xl font-bold text-xsm-yellow mb-6">Send us a Message</h3>
              
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="xsm-input w-full"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="xsm-input w-full"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="xsm-input w-full"
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      className="xsm-input w-full"
                      placeholder="Brief subject line"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={6}
                    className="xsm-input w-full resize-none"
                    placeholder="Please provide as much detail as possible to help us assist you better..."
                    required
                  />
                </div>

                <div className="bg-xsm-black/50 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Response Time</h4>
                  <ul className="text-sm text-xsm-light-gray space-y-1">
                    <li>• General inquiries: Within 24 hours</li>
                    <li>• Technical support: Within 4-8 hours</li>
                    <li>• Transaction issues: Within 2 hours</li>
                    <li>• Emergency support: Immediate response</li>
                  </ul>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`w-full xsm-button text-lg py-4 flex items-center justify-center space-x-2 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Send className="w-5 h-5" />
                  <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                </button>

                <p className="text-sm text-xsm-light-gray text-center">
                  By sending this message, you agree to our Privacy Policy and Terms of Service
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Contact;
