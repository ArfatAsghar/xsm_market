import { createContext, Dispatch, SetStateAction } from 'react';

// Define user type based on your backend User model
export interface User {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
  description?: string;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
}

// Create the context with a default undefined value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
