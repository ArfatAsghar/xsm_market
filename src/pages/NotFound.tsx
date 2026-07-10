import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from "react";
import { Home, AlertCircle } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        {/* 404 Icon */}
        <div className="w-24 h-24 bg-xsm-medium-gray rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-12 h-12 text-xsm-yellow" />
        </div>
        
        {/* Main Message */}
        <h1 className="text-4xl font-bold mb-4 text-xsm-yellow">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-xsm-light-gray mb-8 leading-relaxed">
          The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL.
        </p>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-xsm-yellow text-black px-6 py-3 rounded-lg hover:bg-yellow-500 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-xsm-medium-gray hover:bg-xsm-light-gray/20 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
        
        {/* Helpful Links */}
        <div className="mt-8 pt-6 border-t border-xsm-medium-gray/30">
          <p className="text-sm text-xsm-medium-gray mb-3">Looking for something specific?</p>
          <div className="flex justify-center space-x-4 text-sm">
            <button
              onClick={() => navigate('/about')}
              className="text-xsm-light-gray hover:text-xsm-yellow transition-colors"
            >
              About Us
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="text-xsm-light-gray hover:text-xsm-yellow transition-colors"
            >
              Contact
            </button>
            <button
              onClick={() => navigate('/sell')}
              className="text-xsm-light-gray hover:text-xsm-yellow transition-colors"
            >
              Start Selling
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
