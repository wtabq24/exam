import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, getRedirectResult } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isStudent: boolean;
  connectionError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Handle redirect result with retry logic
    const handleRedirect = async () => {
      const maxRetries = 3;
      let attempt = 0;
      
      while (attempt < maxRetries) {
        try {
          await getRedirectResult(auth);
          break; // Success
        } catch (error: any) {
          attempt++;
          console.error(`AuthContext: Redirect result attempt ${attempt} failed:`, error);
          
          if (error.code === 'auth/network-request-failed' && attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          if (error.code === 'auth/unauthorized-domain') {
            setConnectionError(`This domain (${window.location.hostname}) is not authorized. Please add it to Firebase Console.`);
          }
          break;
        }
      }
    };

    handleRedirect();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Use getDoc which works offline if data is cached
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserProfile);
          } else {
            // Create new student profile by default if not exists
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Anonymous',
              role: firebaseUser.email === 'wlydtll9641@gmail.com' ? 'admin' : 'student',
            };
            // setDoc will be queued if offline
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
            setUser(newProfile);
          }
          setConnectionError(null);
        } else {
          setUser(null);
        }
      } catch (error: any) {
        console.warn("AuthContext: Firestore interaction issue:", error.message);
        if (error.message?.includes('the client is offline')) {
          // Don't block the whole app if offline, just log it
          console.log("AuthContext: Operating in offline mode.");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff' || user?.role === 'admin',
    isStudent: user?.role === 'student',
    connectionError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
