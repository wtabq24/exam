import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Filter, ChevronDown, ChevronUp, MoreVertical, 
  Eye, Download, Trash2, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, DownloadCloud, FileText,
  Calendar, BookOpen, GraduationCap, Building2, AlertCircle
} from 'lucide-react';
import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Exam, ExamStatus, ExamRecord } from '../types';
import { generateCSV } from '../lib/exportService';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const ArchiveHub: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'detailed'>('quick');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'All'>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  
  const [sortField, setSortField] = useState<keyof Exam>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const qExams = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
    const unsubExams = onSnapshot(qExams, (snapshot) => {
      const examData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Exam[];
      setExams(examData);
      setIndexError(null);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'exams');
      if (error.code === 'failed-precondition') {
        const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        setIndexError(urlMatch ? urlMatch[0] : "Index required for exams.");
      }
    });

    const qRecords = query(collection(db, 'examRecords'), orderBy('metadata.createdAt', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      const recordData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExamRecord[];
      setExamRecords(recordData);
      setLoading(false);
      setIndexError(null);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'examRecords');
      if (error.code === 'failed-precondition') {
        const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        setIndexError(urlMatch ? urlMatch[0] : "Index required for exam records.");
      }
      setLoading(false);
    });

    return () => {
      unsubExams();
      unsubRecords();
    };
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(exams.map(e => e.department));
    return ['All', ...Array.from(depts)];
  }, [exams]);

  const years = useMemo(() => {
    const yrs = new Set(exams.map(e => e.year));
    return ['All', ...Array.from(yrs)].sort((a, b) => (b as string).localeCompare(a as string));
  }, [exams]);

  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const matchesSearch = 
        exam.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || exam.status === statusFilter;
      const matchesDept = deptFilter === 'All' || exam.department === deptFilter;
      const matchesYear = yearFilter === 'All' || exam.year === yearFilter;
      
      return matchesSearch && matchesStatus && matchesDept && matchesYear;
    }).sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  }, [exams, searchTerm, statusFilter, deptFilter, yearFilter, sortField, sortOrder]);

  const paginatedExams = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExams.slice(start, start + itemsPerPage);
  }, [filteredExams, currentPage]);

  const totalPages = Math.ceil(filteredExams.length / itemsPerPage);

  const handleSort = (field: keyof Exam) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const updateStatus = async (id: string, status: ExamStatus) => {
    try {
      await updateDoc(doc(db, 'exams', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exams/${id}`);
    }
  };

  const deleteExam = async (id: string) => {
    if (window.confirm(t('deleteArchiveConfirm'))) {
      try {
        await deleteDoc(doc(db, 'exams', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `exams/${id}`);
      }
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      if (typeof date.toDate === 'function') {
        return format(date.toDate(), 'MMM d, yyyy');
      }
      return format(new Date(date), 'MMM d, yyyy');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const handleExportCSV = () => {
    const dataToExport = activeTab === 'quick' ? filteredExams : examRecords;
    if (dataToExport.length === 0) return;

    if (activeTab === 'quick') {
      const headers = [t('subject'), t('code'), t('type'), t('department'), t('year'), t('semester'), t('status'), t('added')];
      const exportData = filteredExams.map(exam => ({
        subject: exam.subject_name,
        code: exam.code,
        type: exam.type,
        department: exam.department,
        year: exam.year,
        semester: exam.semester,
        status: exam.status,
        added: formatDate(exam.createdAt)
      }));
      generateCSV(exportData, headers, `academic_archive_quick_${new Date().toISOString().split('T')[0]}`);
    } else {
      const headers = [t('subject'), t('college'), t('major'), t('type'), t('year'), t('term'), t('questions'), t('difficulty'), t('processedAt')];
      const exportData = examRecords.map(record => ({
        subject: record.subjectName,
        college: record.college,
        major: record.major,
        type: record.examType,
        year: record.academicYear,
        term: record.term,
        questions: record.content.totalQuestions,
        difficulty: record.difficultyLevel,
        processed: record.metadata.processedAt
      }));
      generateCSV(exportData, headers, `academic_archive_detailed_${new Date().toISOString().split('T')[0]}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">{t('archiveHub')}</h1>
          <p className="text-gray-500 font-medium mt-1">{t('archiveHubDesc')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-all active:scale-95"
          >
            <DownloadCloud size={18} />
            <span>{t('exportCsv')}</span>
          </button>
        </div>
      </div>

      {indexError && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3 text-amber-800">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <div className="text-sm">
            <p className="font-bold">{t('indexRequired')}</p>
            {indexError.startsWith('http') ? (
              <>
                <p className="opacity-90 mb-2">{t('indexDesc')}</p>
                <a 
                  href={indexError} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                >
                  <span>{t('createIndex')}</span>
                  <ChevronRight size={14} />
                </a>
              </>
            ) : (
              <p className="opacity-90">{indexError}</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-white p-1 rounded-2xl border border-gray-100 w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab('quick')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all",
            activeTab === 'quick' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
          )}
        >
          {t('quickArchives')}
        </button>
        <button 
          onClick={() => setActiveTab('detailed')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold text-sm transition-all",
            activeTab === 'detailed' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
          )}
        >
          {t('detailedArchives')}
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative col-span-1 md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder={t('searchSubjectCode')}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              className="w-full pl-12 pr-10 py-3 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-indigo-500"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="All">{t('allDepartments')}</option>
              {departments.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>

          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              className="w-full pl-12 pr-10 py-3 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-indigo-500"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="All">{t('allYears')}</option>
              {years.filter(y => y !== 'All').map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">{t('quickStatus')}</span>
          {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                statusFilter === status 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                  : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
              )}
            >
              {status === 'All' ? t('all') : t(status.toLowerCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'quick' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-50">
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('subject_name')}>
                    <div className="flex items-center space-x-1">
                      <span>{t('subject')}</span>
                      {sortField === 'subject_name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('code')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('type')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dept')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('year')}>
                    <div className="flex items-center space-x-1">
                      <span>{t('yearSem')}</span>
                      {sortField === 'year' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('status')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence mode="popLayout">
                  {paginatedExams.map((exam) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={exam.id} 
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="p-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{exam.subject_name}</p>
                            <p className="text-xs text-gray-400">{t('added')} {formatDate(exam.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-black text-gray-500 uppercase">{exam.code}</span>
                      </td>
                      <td className="p-5">
                        <span className="text-sm font-medium text-gray-600">{t(exam.type.toLowerCase())}</span>
                      </td>
                      <td className="p-5">
                        <span className="text-sm font-medium text-gray-600">{exam.department}</span>
                      </td>
                      <td className="p-5">
                        <div className="text-sm">
                          <p className="font-bold text-gray-900">{exam.year}</p>
                          <p className="text-xs text-gray-400">{t(exam.semester.toLowerCase())}</p>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          exam.status === 'Approved' ? "bg-green-100 text-green-700" :
                          exam.status === 'Rejected' ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {t(exam.status.toLowerCase())}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center justify-end space-x-2">
                          <a 
                            href={exam.pdf_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View PDF"
                          >
                            <Eye size={18} />
                          </a>
                          <button 
                            onClick={() => updateStatus(exam.id!, 'Approved')}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Approve"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => updateStatus(exam.id!, 'Rejected')}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Reject"
                          >
                            <XCircle size={18} />
                          </button>
                          <button 
                            onClick={() => deleteExam(exam.id!)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {paginatedExams.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                          <Search size={32} />
                        </div>
                        <p className="text-gray-500 font-bold">{t('noArchivesFound')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-50">
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('subject')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('collegeMajor')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('type')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('yearSem')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('questions')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('difficulty')}</th>
                  <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {examRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{record.subjectName}</p>
                          <p className="text-xs text-gray-400">{t('processed')} {record.metadata.processedAt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="text-sm">
                        <p className="font-bold text-gray-900">{record.college}</p>
                        <p className="text-xs text-gray-400">{record.major}</p>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="text-sm font-medium text-gray-600">{t(record.examType.toLowerCase())}</span>
                    </td>
                    <td className="p-5">
                      <div className="text-sm">
                        <p className="font-bold text-gray-900">{record.academicYear}</p>
                        <p className="text-xs text-gray-400">{t(record.term.toLowerCase())}</p>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="px-2 py-1 bg-indigo-50 rounded text-[10px] font-black text-indigo-600 uppercase">{record.content.totalQuestions} {t('questions')}</span>
                    </td>
                    <td className="p-5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        record.difficultyLevel === 'Easy' ? "bg-green-100 text-green-700" :
                        record.difficultyLevel === 'Medium' ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {t(record.difficultyLevel.toLowerCase())}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center justify-end space-x-2">
                        <a 
                          href={record.metadata.pdfUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Eye size={18} />
                        </a>
                        <button 
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'examRecords', record.id!));
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, `examRecords/${record.id}`);
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {examRecords.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-20 text-center">
                      <p className="text-gray-500 font-bold">{t('noArchivesFound')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-5 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
            <p className="text-xs font-bold text-gray-400">
              {t('showing')} <span className="text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> {t('to')} <span className="text-gray-900">{Math.min(currentPage * itemsPerPage, filteredExams.length)}</span> {t('of')} <span className="text-gray-900">{filteredExams.length}</span> {t('ofRecords')}
            </p>
            <div className="flex items-center space-x-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 text-gray-400 hover:bg-white rounded-lg disabled:opacity-30 transition-all border border-transparent hover:border-gray-200"
              >
                <ChevronLeft size={18} />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    currentPage === i + 1 ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-gray-500 hover:bg-white border border-transparent hover:border-gray-200"
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 text-gray-400 hover:bg-white rounded-lg disabled:opacity-30 transition-all border border-transparent hover:border-gray-200"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveHub;
