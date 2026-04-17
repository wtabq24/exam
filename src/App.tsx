import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ExamBank from './components/ExamBank';
import ExamUpload from './components/ExamUpload';
import GradeList from './components/GradeList';
import ArchiveHub from './components/ArchiveHub';
import ERPManager from './components/ERPManager';
import AnalyticsHub from './components/AnalyticsHub';
import AdminSettings from './components/AdminSettings';
import Login from './components/Login';
import SplashScreen from './components/SplashScreen';
import PasswordReset from './components/PasswordReset';
import { db, collection, onSnapshot, query, isFirebaseConfigured } from './firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';
import { Grade, Exam } from './types';
import { AlertCircle, Settings } from 'lucide-react';

const FirebaseConfigError: React.FC<{ message?: string }> = ({ message }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6 border border-red-100">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
        <AlertCircle size={48} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-gray-900">Configuration Required</h1>
        <p className="text-gray-500 font-medium">
          {message || "Firebase is not configured. Please set your Firebase credentials in the Settings > Secrets panel."}
        </p>
      </div>
      {!message && (
        <div className="bg-gray-50 p-4 rounded-2xl text-left space-y-3">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Required Secrets:</p>
          <ul className="text-xs font-mono text-gray-600 space-y-1">
            <li>• VITE_FIREBASE_API_KEY</li>
            <li>• VITE_FIREBASE_AUTH_DOMAIN</li>
            <li>• VITE_FIREBASE_PROJECT_ID</li>
            <li>• VITE_FIREBASE_APP_ID</li>
          </ul>
        </div>
      )}
      <p className="text-[10px] text-gray-400 font-medium">
        Automated setup failed due to project creation quota limits on your account.
      </p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl font-bold">Verifying Identity...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

import ErrorBoundary from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { user, loading, isStaff, isAdmin, connectionError } = useAuth();
  const { t } = useLanguage();
  const [allGrades, setAllGrades] = useState<Grade[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        setShowSplash(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    
    const gradesQ = query(collection(db, 'grades'));
    const unsubscribeGrades = onSnapshot(gradesQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      setAllGrades(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });

    const examsQ = query(collection(db, 'exams'));
    const unsubscribeExams = onSnapshot(examsQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setAllExams(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exams');
    });

    return () => {
      unsubscribeGrades();
      unsubscribeExams();
    };
  }, [user]);

  if (!isFirebaseConfigured) {
    return <FirebaseConfigError />;
  }

  // Show splash or loading spinner while auth is initializing
  if (loading || showSplash) {
    return <SplashScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={<PasswordReset />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Dashboard grades={allGrades} exams={allExams} />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/exams" element={
          <ProtectedRoute>
            <Layout>
              <ExamBank />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/grades" element={
          <ProtectedRoute>
            <Layout>
              <GradeList />
            </Layout>
          </ProtectedRoute>
        } />

        {(isStaff || isAdmin) && (
          <>
            <Route path="/upload" element={
              <ProtectedRoute>
                <Layout>
                  <ExamUpload />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/archive" element={
              <ProtectedRoute>
                <Layout>
                  <ArchiveHub />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/erp" element={
              <ProtectedRoute>
                <Layout>
                  <ERPManager />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Layout>
                  <AnalyticsHub />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout>
                  <AdminSettings />
                </Layout>
              </ProtectedRoute>
            } />
          </>
        )}
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
