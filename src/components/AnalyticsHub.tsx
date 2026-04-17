import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  BarChart3, 
  Download, 
  DownloadCloud,
  Filter, 
  User, 
  BookOpen, 
  GraduationCap, 
  TrendingUp, 
  AlertCircle,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  orderBy,
  db 
} from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Cell, 
  Pie,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { generateCSV, generatePDF } from '../lib/exportService';

import { 
  Grade, 
  UserProfile 
} from '../types';

// Types
interface Student {
  id: string;
  name: string;
  email: string;
  academic_id: string;
  major_id: string;
  college_id: string;
  academic_year: string;
  status: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  major_id: string;
  college_id: string;
  credits: number;
}

interface Major {
  id: string;
  name: string;
  code: string;
  college_id: string;
}

interface College {
  id: string;
  name: string;
  code: string;
}

interface AcademicPeriod {
  id: string;
  year: number;
  semester: string;
  is_active: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsHub() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
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

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedCollege, setSelectedCollege] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [gradeRange, setGradeRange] = useState({ min: 0, max: 100 });

  // View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'reports'>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });
    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    });
    const unsubMajors = onSnapshot(collection(db, 'majors'), (snapshot) => {
      setMajors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Major)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'majors');
    });
    const unsubColleges = onSnapshot(collection(db, 'colleges'), (snapshot) => {
      setColleges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as College)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'colleges');
    });
    const unsubPeriods = onSnapshot(collection(db, 'academic_periods'), (snapshot) => {
      setPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicPeriod)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'academic_periods');
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubGrades();
      unsubSubjects();
      unsubMajors();
      unsubColleges();
      unsubPeriods();
    };
  }, []);

  // Memoized Analytics
  const analytics = useMemo(() => {
    if (loading) return null;

    const avgGrade = grades.length > 0 
      ? grades.reduce((acc, g) => acc + g.score, 0) / grades.length 
      : 0;

    const passRate = grades.length > 0
      ? (grades.filter(g => g.score >= 50).length / grades.length) * 100
      : 0;

    // Subject Difficulty (Average grade per subject)
    const subjectStats = subjects.map(s => {
      const subjectGrades = grades.filter(g => g.subject_name === s.name);
      const avg = subjectGrades.length > 0
        ? subjectGrades.reduce((acc, g) => acc + g.score, 0) / subjectGrades.length
        : 0;
      return {
        name: s.name,
        code: s.code,
        avg: Math.round(avg * 10) / 10,
        count: subjectGrades.length
      };
    }).sort((a, b) => a.avg - b.avg);

    // Major Performance
    const majorStats = majors.map(m => {
      const majorStudents = students.filter(s => s.major_id === m.id);
      const studentAcademicIds = majorStudents.map(s => s.academic_id);
      const majorGrades = grades.filter(g => studentAcademicIds.includes(g.academic_id));
      const avg = majorGrades.length > 0
        ? majorGrades.reduce((acc, g) => acc + g.score, 0) / majorGrades.length
        : 0;
      return {
        name: m.name,
        avg: Math.round(avg * 10) / 10,
        studentCount: majorStudents.length
      };
    });

    // Grade Distribution
    const distribution = [
      { name: '0-49 (F)', value: grades.filter(g => g.score < 50).length },
      { name: '50-59 (D)', value: grades.filter(g => g.score >= 50 && g.score < 60).length },
      { name: '60-69 (C)', value: grades.filter(g => g.score >= 60 && g.score < 70).length },
      { name: '70-79 (B)', value: grades.filter(g => g.score >= 70 && g.score < 80).length },
      { name: '80-89 (A)', value: grades.filter(g => g.score >= 80 && g.score < 90).length },
      { name: '90-100 (A+)', value: grades.filter(g => g.score >= 90).length },
    ];

    return {
      avgGrade: Math.round(avgGrade * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      subjectStats,
      majorStats,
      distribution,
      totalStudents: students.length,
      totalGrades: grades.length
    };
  }, [loading, students, grades, subjects, majors]);

  // Filtered Results
  const filteredResults = useMemo(() => {
    return grades.filter(g => {
      const student = students.find(s => s.academic_id === g.academic_id);
      const subject = subjects.find(s => s.name === g.subject_name);
      
      const studentName = student?.name || (g as any).studentName || g.student_name || '';
      
      if (!student && searchTerm && !studentName.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      const matchesSearch = 
        studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (subject?.code || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMajor = selectedMajor === 'all' || student?.major_id === selectedMajor;
      const matchesCollege = selectedCollege === 'all' || student?.college_id === selectedCollege;
      const matchesPeriod = selectedPeriod === 'all' || (g.year === selectedPeriod.split('_')[0] && g.semester === selectedPeriod.split('_')[1]);
      const matchesGrade = g.score >= gradeRange.min && g.score <= gradeRange.max;

      return matchesSearch && matchesMajor && matchesCollege && matchesPeriod && matchesGrade;
    });
  }, [grades, students, subjects, searchTerm, selectedMajor, selectedCollege, selectedPeriod, gradeRange]);

  const handleExportResults = async (format: 'pdf' | 'excel' | 'csv') => {
    // 1. Centralized Data Mapping Logic (Maintain single source of truth for all formats)
    const getMappedData = () => {
      return filteredResults.map(g => {
        const student = students.find(s => s.academic_id === g.academic_id);
        const studentName = student?.name || (g as any).studentName || g.student_name || 'N/A';
        return {
          student: studentName,
          subject: g.subject_name,
          grade: g.score.toString(),
          period: `${g.year} - ${t(g.semester.toLowerCase())}`,
          status: t(g.status.toLowerCase())
        };
      });
    };

    const exportData = getMappedData();
    const headers = [t('student'), t('subject'), t('grade'), t('period'), t('status')];
    const filename = `Academic_Results_${new Date().toISOString().split('T')[0]}`;

    console.log(`[Architect] Dispatching ${format.toUpperCase()} export task...`);

    try {
      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } 
      else if (format === 'csv') {
        // Bulletproof CSV with BOM and sep=,
        generateCSV(exportData, headers, filename);
      } 
      else {
        // PDF Export with Unicode/Arabic Fixes
        const tableData = exportData.map(item => Object.values(item));
        await generatePDF(
          t('analyticsReporting'),
          headers,
          tableData,
          filename.replace('Academic_Results', 'Student_Report'),
          t('dir') === 'rtl'
        );
      }
    } catch (error) {
      console.error(`[Architect] Critical Fail in ${format.toUpperCase()} export pipeline:`, error);
      alert(t('errorInExport') || 'خطأ في عملية التصدير. يرجى مراجعة سجلات النظام.');
    }
  };

  const selectedStudentData = useMemo(() => {
    if (!selectedStudentId) return null;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return null;

    const studentGrades = grades.filter(g => g.academic_id === student.academic_id);
    const major = majors.find(m => m.id === student.major_id);
    const college = colleges.find(c => c.id === student.college_id);

    const performanceOverTime = studentGrades
      .map(g => {
        return {
          period: `${g.year} ${g.semester}`,
          grade: g.score,
          timestamp: parseInt(g.year.split('-')[0]) * 10 + (g.semester.includes('1') ? 1 : 2)
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const subjectPerformance = studentGrades.map(g => {
      return {
        subject: g.subject_name,
        grade: g.score
      };
    });

    return {
      student,
      grades: studentGrades,
      major,
      college,
      performanceOverTime,
      subjectPerformance,
      gpa: studentGrades.length > 0 
        ? Math.round((studentGrades.reduce((acc, g) => acc + g.score, 0) / studentGrades.length) * 10) / 10
        : 0
    };
  }, [selectedStudentId, students, grades, majors, colleges, subjects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('analyticsReporting')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('analyticsDesc')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-2" />
            {t('dashboard')}
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <Search className="w-4 h-4 inline-block mr-2" />
            {t('advancedSearch')}
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <Download className="w-4 h-4 inline-block mr-2" />
            {t('reports')}
          </button>
        </div>
      </div>

      {/* Dashboard View */}
      {activeTab === 'dashboard' && analytics && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +2.4%
                </span>
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t('averageGrade')}</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{analytics.avgGrade}</p>
              <div className="mt-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${analytics.avgGrade}%` }}></div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +1.2%
                </span>
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t('passRate')}</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{analytics.passRate}%</p>
              <div className="mt-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${analytics.passRate}%` }}></div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t('totalStudents')}</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{analytics.totalStudents}</p>
              <p className="text-xs text-gray-400 mt-2">{t('activeInCurrentPeriod')}</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm font-medium">{t('totalRecords')}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.totalGrades}</p>
              <p className="text-xs text-gray-400 mt-2">{t('verifiedExamResults')}</p>
            </motion.div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={containerRef}>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <PieChartIcon className="w-5 h-5 mr-2 text-blue-600" />
                {t('gradeDistribution')}
              </h3>
              <div className="h-80">
                {isReady && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={analytics.distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analytics.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                {t('majorPerformance')}
              </h3>
              <div className="h-80">
                {isReady && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={analytics.majorStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Subject Difficulty Row */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
              {t('subjectDifficultyAnalysis')}
            </h3>
            <div className="h-80">
              {isReady && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={analytics.subjectStats.slice(0, 10)}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="code" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg" stroke="#ef4444" fillOpacity={1} fill="url(#colorAvg)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-4 italic">
              {t('subjectDifficultyDesc')}
            </p>
          </div>
        </div>
      )}

      {/* Advanced Search View */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Filters Panel */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">{t('search')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    placeholder={t('studentSubjectCode')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">{t('major')}</label>
                <select 
                  value={selectedMajor}
                  onChange={(e) => setSelectedMajor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="all">{t('allMajors')}</option>
                  {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">{t('academicPeriod')}</label>
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="all">{t('allPeriods')}</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.year} - {t('semester')} {p.semester}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">{t('gradeRange')} {gradeRange.min} - {gradeRange.max}</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={gradeRange.min}
                    onChange={(e) => setGradeRange(prev => ({ ...prev, min: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={gradeRange.max}
                    onChange={(e) => setGradeRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden pdf-export-container" ref={tableRef}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">{t('searchResults')} ({filteredResults.length})</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleExportResults('excel')}
                  className="p-2 text-gray-600 hover:bg-white hover:text-blue-600 rounded-lg transition-all border border-transparent hover:border-gray-200"
                  title={t('exportToExcel')}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleExportResults('pdf')}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                  title={t('exportToPdf')}
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleExportResults('csv')}
                  className="p-2 text-gray-600 hover:bg-white hover:text-green-600 rounded-lg transition-all border border-transparent hover:border-gray-200"
                  title={t('exportCsv')}
                >
                  <DownloadCloud className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('student')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('subject')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('grade')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('period')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredResults.map((g) => {
                    const student = students.find(s => s.academic_id === g.academic_id);
                    const subject = subjects.find(s => s.name === g.subject_name);
                    return (
                      <tr key={g.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-xs mr-3">
                              {(student?.name || (g as any).studentName || g.student_name || 'N').charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{student?.name || (g as any).studentName || g.student_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{student?.email || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{subject?.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{subject?.code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${g.score >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {g.score}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{g.year}</div>
                          <div className="text-xs text-gray-500">{t(g.semester.toLowerCase())}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            g.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {t(g.status.toLowerCase())}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                const student = students.find(s => s.academic_id === g.academic_id);
                                if (student) setSelectedStudentId(student.id);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                            >
                              {t('viewProfile')}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p>{t('noResultsFound')}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reports View */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="p-3 bg-blue-50 rounded-xl w-fit mb-4 group-hover:bg-blue-600 transition-colors">
              <User className="w-6 h-6 text-blue-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('studentPerformanceReports')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('studentPerformanceReportsDesc')}</p>
            <button 
              onClick={() => setActiveTab('search')}
              className="w-full py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-blue-600 hover:text-white transition-all"
            >
              {t('selectStudent')}
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="p-3 bg-green-50 rounded-xl w-fit mb-4 group-hover:bg-green-600 transition-colors">
              <BookOpen className="w-6 h-6 text-green-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('subjectDifficultyAnalysis')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('subjectDifficultyAnalysisDesc')}</p>
            <button 
              onClick={() => handleExportResults('excel')}
              className="w-full py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-green-600 hover:text-white transition-all"
            >
              {t('exportExcel')}
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="p-3 bg-purple-50 rounded-xl w-fit mb-4 group-hover:bg-purple-600 transition-colors">
              <GraduationCap className="w-6 h-6 text-purple-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('institutionalKpiSummary')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('institutionalKpiSummaryDesc')}</p>
            <button 
              onClick={() => analytics && generatePDF(
                t('institutionalKpiSummary'),
                ['KPI', 'Value'],
                [
                  [t('averageGrade'), analytics.avgGrade.toString()],
                  [t('passRate'), `${analytics.passRate}%`],
                  [t('totalStudents'), analytics.totalStudents.toString()],
                  [t('totalRecords'), analytics.totalGrades.toString()]
                ],
                'KPI_Summary',
                t('dir') === 'rtl'
              )}
              className="w-full py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-purple-600 dark:hover:bg-purple-500 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4" />
              {t('generatePdf')}
            </button>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      <AnimatePresence>
        {selectedStudentId && selectedStudentData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                    {selectedStudentData.student?.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedStudentData.student?.name}</h2>
                    <p className="text-sm text-gray-500">{selectedStudentData.major?.name} • {selectedStudentData.college?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const tableData = selectedStudentData.grades.map(g => {
                        const subject = subjects.find(s => s.name === g.subject_name);
                        return [
                          g.subject_name,
                          subject?.code || 'N/A',
                          g.score.toString(),
                          `${g.year} ${g.semester}`,
                          g.status
                        ];
                      });
                      generatePDF(
                        `${selectedStudentData.student?.name} ${t('academicTranscript')}`,
                        ['Subject', 'Code', 'Grade', 'Period', 'Status'],
                        tableData,
                        `${selectedStudentData.student?.name}_Transcript`,
                        t('dir') === 'rtl'
                      );
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setSelectedStudentId(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <ChevronRight className={cn("w-6 h-6 rotate-90", t('dir') === 'rtl' && "-rotate-90")} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Profile KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs font-medium text-blue-600 uppercase mb-1">Cumulative GPA</p>
                    <p className="text-2xl font-bold text-blue-900">{selectedStudentData.gpa}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <p className="text-xs font-medium text-green-600 uppercase mb-1">Credits Completed</p>
                    <p className="text-2xl font-bold text-green-900">
                      {selectedStudentData.grades.reduce((acc, g) => {
                        const subject = subjects.find(s => s.name === g.subject_name);
                        return acc + (g.score >= 50 ? (subject?.credits || 0) : 0);
                      }, 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <p className="text-xs font-medium text-purple-600 uppercase mb-1">Academic Status</p>
                    <p className="text-2xl font-bold text-purple-900 capitalize">{selectedStudentData.student?.status}</p>
                  </div>
                </div>

                {/* Profile Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Performance Over Time</h3>
                    <div className="h-64">
                      {isReady && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                          <LineChart data={selectedStudentData.performanceOverTime}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="period" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="grade" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6, fill: '#3b82f6' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Subject Performance</h3>
                    <div className="h-64">
                      {isReady && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                          <BarChart data={selectedStudentData.subjectPerformance} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis dataKey="subject" type="category" width={100} />
                            <Tooltip />
                            <Bar dataKey="grade" fill="#10b981" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grade History Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900">Academic History</h3>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Period</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedStudentData.grades.map(g => {
                        const subject = subjects.find(s => s.name === g.subject_name);
                        return (
                          <tr key={g.id}>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{g.subject_name}</div>
                              <div className="text-xs text-gray-500 font-mono">{subject?.code || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-bold ${g.score >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                {g.score}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{g.year}</div>
                              <div className="text-xs text-gray-500">{g.semester}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                g.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {g.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
