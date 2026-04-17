import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const SplashScreen: React.FC = () => {
  const { t } = useLanguage();
  
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-indigo-200 rotate-3">
          <Database className="text-white" size={48} />
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight font-sans">
          {t('loginTitle')}
        </h1>
        <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">
          {t('loginSubtitle')}
        </p>

        <div className="mt-12 flex flex-col items-center">
          <Loader2 className="text-indigo-600 animate-spin mb-4" size={32} />
          <p className="text-sm text-gray-400 font-medium animate-pulse">{t('initializingSession')}</p>
        </div>
      </motion.div>
      
      <div className="absolute bottom-12 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em]">
        Academic Infrastructure v1.0
      </div>
    </div>
  );
};

export default SplashScreen;
