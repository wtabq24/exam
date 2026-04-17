import React, { useRef, useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';
import { 
  FileText, Users, GraduationCap, CheckCircle, XCircle, 
  TrendingUp, Upload, Clock, Activity, ArrowRight, Star, Database
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Grade, Exam } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface DashboardProps {
  grades: Grade[];
  exams: Exam[];
}

const Dashboard: React.FC<DashboardProps> = ({ grades, exams }) => {
  const { user, isAdmin, isStaff, isStudent } = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) {
          setIsReady(true);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Admin Stats
  const passCount = grades.filter(g => g.status === 'Pass').length;
  const failCount = grades.filter(g => g.status === 'Fail').length;
  const totalGrades = grades.length;
  const totalExams = exams.length;

  // Archivist Stats
  const myUploads = exams.filter(e => e.createdBy === user?.uid).length;
  
  // Student Stats & GPA
  const myGrades = grades.filter(g => g.student_id === user?.uid || g.academic_id === user?.academic_id);
  const calculateGPA = (studentGrades: Grade[]) => {
    if (studentGrades.length === 0) return 0;
    const points: Record<string, number> = {
      'Excellent': 4.0,
      'Very Good': 3.0,
      'Good': 2.0,
      'Pass': 1.0,
      'Fail': 0.0
    };
    const totalPoints = studentGrades.reduce((acc, g) => acc + (points[g.grade_label] || 0), 0);
    return (totalPoints / studentGrades.length).toFixed(2);
  };
  const gpa = calculateGPA(myGrades);

  // Charts Data
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  const gradeDistribution = [
    { name: t('excellent'), count: grades.filter(g => g.grade_label === 'Excellent').length },
    { name: t('veryGood'), count: grades.filter(g => g.grade_label === 'Very Good').length },
    { name: t('good'), count: grades.filter(g => g.grade_label === 'Good').length },
    { name: t('pass'), count: grades.filter(g => g.grade_label === 'Pass').length },
    { name: t('fail'), count: grades.filter(g => g.grade_label === 'Fail').length },
  ];

  const studentTrendData = myGrades
    .sort((a, b) => a.year.localeCompare(b.year))
    .map(g => ({
      name: `${g.year} ${g.semester}`,
      score: g.score
    }));

  const subjectPerformance = Array.from(new Set(grades.map(g => g.subject_name))).map(subject => {
    const subjectGrades = grades.filter(g => g.subject_name === subject);
    const avgScore = subjectGrades.reduce((acc, g) => acc + g.score, 0) / subjectGrades.length;
    return { name: subject, avg: Math.round(avgScore) };
  }).slice(0, 5);

  const recentActivity = [
    ...exams.map(e => ({ type: 'exam', title: `${t('newExam')} ${e.subject_name}`, date: e.createdAt, icon: FileText, color: 'text-blue-500' })),
    ...grades.map(g => ({ type: 'grade', title: `${t('gradePosted')} ${g.student_name}`, date: g.createdAt, icon: Star, color: 'text-indigo-500' }))
  ].sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return dateB.getTime() - dateA.getTime();
  }).slice(0, 5);

  if (isAdmin) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('totalExams'), value: totalExams, icon: FileText, color: 'bg-blue-500' },
            { label: t('totalStudents'), value: new Set(grades.map(g => g.academic_id)).size, icon: Users, color: 'bg-indigo-500' },
            { label: t('passRate'), value: totalGrades ? `${((passCount / totalGrades) * 100).toFixed(1)}%` : '0%', icon: CheckCircle, color: 'bg-green-500' },
            { label: t('systemActivity'), value: t('high'), icon: Activity, color: 'bg-orange-500' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center space-x-4 transition-colors duration-300">
              <div className={`${stat.color} p-3 rounded-xl text-white`}><stat.icon size={24} /></div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors duration-300" ref={containerRef}>
            <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-white">{t('subjectPerformance')}</h3>
            <div className="h-80">
              {isReady && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={subjectPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={theme === 'dark' ? '#374151' : '#f3f4f6'} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                    <Tooltip 
                      cursor={{ fill: theme === 'dark' ? '#1f2937' : '#f9fafb' }} 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#111827' : '#fff',
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        color: theme === 'dark' ? '#fff' : '#1f2937'
                      }} 
                    />
                    <Bar dataKey="avg" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors duration-300">
            <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-white">{t('recentActivity')}</h3>
            <div className="space-y-6">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className={cn("p-2 rounded-lg bg-gray-50 dark:bg-gray-800", activity.color)}><activity.icon size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{activity.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('justNow')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none relative overflow-hidden transition-colors duration-300">
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-2">{t('welcomeBackUser')} {user?.displayName}</h2>
              <p className="text-indigo-100 text-sm mb-6">{t('readyToArchive')}</p>
              <Link to="/upload" className="inline-flex items-center space-x-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all">
                <Upload size={18} />
                <span>{t('quickUpload')}</span>
              </Link>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12"><Database size={200} /></div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center transition-colors duration-300">
            <p className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">{t('totalUploads')}</p>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{myUploads}</p>
            <div className="mt-4 flex items-center text-green-500 text-xs font-bold">
              <TrendingUp size={14} className="mr-1" />
              <span>+12% {t('fromLastMonth')}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center transition-colors duration-300">
            <p className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">{t('pendingReview')}</p>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{exams.filter(e => e.status === 'Pending').length}</p>
            <p className="mt-4 text-gray-400 dark:text-gray-500 text-xs font-medium">
              {exams.filter(e => e.status === 'Pending').length > 0 ? t('requiresAdminApproval') : t('allRecordsUpToDate')}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300" ref={containerRef}>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('departmentPerformance')}</h3>
            <Link to="/grades" className="text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center">
              {t('viewAll')} <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>
          <div className="h-80">
            {isReady && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={gradeDistribution}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#f3f4f6'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#111827' : '#fff',
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      color: theme === 'dark' ? '#fff' : '#1f2937'
                    }} 
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden transition-colors duration-300">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <GraduationCap size={48} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{t('cumulativeGPA')}</h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400">{gpa}</span>
                <span className="text-gray-400 dark:text-gray-500 font-bold">/ 4.00</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center text-center transition-colors duration-300">
          <p className="text-gray-400 dark:text-gray-500 font-bold text-xs uppercase tracking-widest mb-2">{t('academicStanding')}</p>
          <div className="inline-flex items-center justify-center space-x-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-full mx-auto">
            <CheckCircle size={18} />
            <span className="font-bold">{t('goodStanding')}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300" ref={containerRef}>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8">{t('academicPerformanceTrend')}</h3>
        <div className="h-80">
          {isReady && (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={studentTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#f3f4f6'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#111827' : '#fff',
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    color: theme === 'dark' ? '#fff' : '#1f2937'
                  }} 
                />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: theme === 'dark' ? '#111827' : '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
