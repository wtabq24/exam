import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Key, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { auth, sendPasswordResetEmail } from '../firebase';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

const PasswordReset: React.FC = () => {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send reset link. Please check the email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 border border-indigo-50"
        >
          <Link to="/" className="inline-flex items-center space-x-2 text-gray-400 hover:text-indigo-600 transition-colors mb-8 group">
            <ArrowLeft size={18} className={cn("group-hover:-translate-x-1 transition-transform", language === 'AR' && "rotate-180 group-hover:translate-x-1")} />
            <span className="text-sm font-bold">{t('backToLogin')}</span>
          </Link>

          <div className={cn("mb-8", language === 'AR' && "text-right")}>
            <h2 className="text-2xl font-black text-gray-900 mb-2">{t('resetPassword')}</h2>
            <p className="text-gray-500 text-sm font-medium">
              {t('resetPasswordDesc')}
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className={cn("block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1", language === 'AR' && "text-right mr-1")}>
                {t('email')}
              </label>
              <div className="relative">
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400", language === 'AR' ? "right-4" : "left-4")} size={18} />
                <input
                  type="email"
                  required
                  placeholder="name@university.edu"
                  className={cn(
                    "w-full py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all",
                    language === 'AR' ? "pr-12 pl-4 text-right" : "pl-12 pr-4"
                  )}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <span>{t('sendResetLink')}</span>}
            </button>
          </form>

          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn("mt-6 p-4 bg-green-50 text-green-700 rounded-2xl flex items-start space-x-3", language === 'AR' && "space-x-reverse text-right")}
              >
                <CheckCircle className="mt-0.5 shrink-0" size={18} />
                <p className="text-xs font-medium leading-relaxed">
                  {t('resetLinkSent')}
                </p>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn("mt-6 p-4 bg-red-50 text-red-700 rounded-2xl flex items-start space-x-3", language === 'AR' && "space-x-reverse text-right")}
              >
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <p className="text-xs font-medium leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default PasswordReset;
