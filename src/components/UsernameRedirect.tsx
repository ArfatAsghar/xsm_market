import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublicProfile } from '@/services/auth';

const UsernameRedirect: React.FC = () => {
  const { possibleUsername } = useParams<{ possibleUsername: string }>();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!possibleUsername) {
        navigate('/404', { replace: true });
        return;
      }

      // List of known routes that should not be treated as usernames
      const knownRoutes = [
        'api', 'admin', 'assets', 'static', 'public', 'images', 
        'favicon', 'robots', 'sitemap', 'manifest'
      ];

      // If this is a known route, go to 404
      if (knownRoutes.includes(possibleUsername.toLowerCase())) {
        navigate('/404', { replace: true });
        return;
      }

      // Username validation - basic check for valid username pattern
      const usernamePattern = /^[a-zA-Z0-9_]{3,50}$/;
      if (!usernamePattern.test(possibleUsername)) {
        navigate('/404', { replace: true });
        return;
      }

      try {
        // Try to fetch the user profile to see if this username exists
        await getPublicProfile(possibleUsername);
        
        // If successful, redirect to the proper profile URL
        navigate(`/u/${possibleUsername}`, { replace: true });
      } catch (error) {
        // If user doesn't exist, show 404
        navigate('/404', { replace: true });
      }
    };

    checkAndRedirect();
  }, [possibleUsername, navigate]);

  // Show loading while checking
  return (
    <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-xsm-yellow mx-auto mb-4"></div>
        <p className="text-xsm-light-gray">Checking profile...</p>
      </div>
    </div>
  );
};

export default UsernameRedirect;