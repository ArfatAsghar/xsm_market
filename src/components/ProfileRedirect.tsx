import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';

const ProfileRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn && user?.username) {
      // Redirect to public profile
      navigate(`/u/${user.username}`, { replace: true });
    } else {
      // Redirect to login if not logged in
      navigate('/login', { replace: true });
    }
  }, [isLoggedIn, user, navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-xsm-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-xsm-yellow mx-auto mb-4"></div>
        <p className="text-xsm-light-gray">Redirecting to your profile...</p>
      </div>
    </div>
  );
};

export default ProfileRedirect;