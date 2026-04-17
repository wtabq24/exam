import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, GraduationCap, ShieldCheck, Database, Mail, Lock, Eye, EyeOff, Globe, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

const Login: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      // Try popup first as it's often more reliable in desktop preview environments
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Login failed", err);
      
      // If popup is blocked or fails, try redirect as a fallback
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // Redirect will happen, so we don't need to clear loading
        } catch (redirErr: any) {
          setError('Authentication redirect failed. Please check your browser settings.');
        }
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network request failed. This is often caused by ad-blockers, VPNs, or browser privacy settings. Please disable them and try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase project.');
      } else {
        setError(err.message || 'An error occurred during Google sign-in.');
      }
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const maxRetries = 3;
    let attempt = 0;
    
    const performAuth = async () => {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    };

    while (attempt < maxRetries) {
      try {
        await performAuth();
        break; // Success
      } catch (err: any) {
        attempt++;
        console.error(`Auth attempt ${attempt} failed:`, err);
        
        if (err.code === 'auth/network-request-failed' && attempt < maxRetries) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (err.code === 'auth/invalid-credential') {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          setError('Invalid email or password.');
        } else if (err.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please sign in instead.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password should be at least 6 characters.');
        } else if (err.code === 'auth/network-request-failed') {
          setError('Network request failed. This can be caused by ad-blockers, VPNs, or poor connection. Please disable any blockers and try again.');
        } else {
          setError(err.message || 'Authentication failed. Please check your credentials.');
        }
        break; // Don't retry for other errors
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 dark:shadow-none border border-indigo-50 dark:border-gray-800 text-center relative overflow-hidden transition-colors duration-300"
        >
          {/* Language Switcher */}
          <button 
            onClick={() => setLanguage(language === 'AR' ? 'EN' : 'AR')}
            className="absolute top-6 right-6 flex items-center space-x-2 text-gray-400 hover:text-indigo-600 transition-colors font-bold text-xs"
          >
            <Globe size={14} />
            <span>{language === 'AR' ? 'English' : 'العربية'}</span>
          </button>

          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200 rotate-3">
            <Database className="text-white" size={32} />
          </div>
          
          <h1 className={cn(
            "text-2xl font-black text-gray-900 dark:text-white mb-1 tracking-tight",
            language === 'AR' ? 'font-sans' : 'font-sans'
          )}>
            {isRegistering ? t('register') : t('loginTitle')}
          </h1>
          <p className="text-gray-400 dark:text-gray-500 mb-8 font-bold text-[10px] uppercase tracking-widest">
            {isRegistering ? t('secureAccess') : t('loginSubtitle')}
          </p>

          {!isOnline && (
            <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl flex items-center justify-center space-x-2 text-[10px] font-bold uppercase tracking-wider border border-amber-100 dark:border-amber-900/30">
              <AlertCircle size={14} />
              <span>{t('offlineMessage')}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div>
              <label className={cn(
                "block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 ml-1",
                language === 'AR' && 'text-right mr-1'
              )}>
                {t('email')}
              </label>
              <div className="relative">
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500", language === 'AR' ? 'right-4' : 'left-4')} size={18} />
                <input
                  type="email"
                  required
                  placeholder="name@university.edu"
                  className={cn(
                    "w-full py-3.5 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600",
                    language === 'AR' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4'
                  )}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={cn(
                "block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 ml-1",
                language === 'AR' && 'text-right mr-1'
              )}>
                {t('password')}
              </label>
              <div className="relative">
                <Lock className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500", language === 'AR' ? 'right-4' : 'left-4')} size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className={cn(
                    "w-full py-3.5 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600",
                    language === 'AR' ? 'pr-12 pl-12 text-right' : 'pl-12 pr-12'
                  )}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600", language === 'AR' ? 'left-4' : 'right-4')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isRegistering && (
              <div className={cn(
                "flex justify-end",
                language === 'AR' && 'justify-start'
              )}>
                <Link to="/reset-password" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                  {t('forgotPassword')}
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />)}
              <span>{isRegistering ? t('register') : t('login')}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
              className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors"
            >
              {isRegistering ? t('hasAccount') : t('noAccount')}{' '}
              <span className="text-indigo-600 underline">
                {isRegistering ? t('login') : t('register')}
              </span>
            </button>
          </div>

          <div className="my-6 flex items-center">
            <div className="flex-1 h-[1px] bg-gray-100 dark:bg-gray-800"></div>
            <span className="px-4 text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">OR</span>
            <div className="flex-1 h-[1px] bg-gray-100 dark:bg-gray-800"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-4 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center space-x-3 shadow-sm active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                <span>{t('googleSignIn')}</span>
              </>
            )}
          </button>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl flex flex-col items-start space-y-3 text-left border border-red-100 dark:border-red-900/30"
              >
                <div className="flex items-start space-x-3">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <p className="text-xs font-medium leading-relaxed">{error}</p>
                </div>
                {error.includes('Network') && (
                  <button 
                    onClick={() => { setError(null); setLoading(false); }}
                    className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors ml-7"
                  >
                    Try Again
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-8 text-[10px] text-gray-400 font-bold leading-relaxed uppercase tracking-tighter">
            {t('loginPolicy')}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
