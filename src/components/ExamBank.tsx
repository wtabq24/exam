import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, FileText, Download, Calendar, Tag, Loader2 } from 'lucide-react';
import { db, collection, query, orderBy, onSnapshot, where, getDocs } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Exam, Grade } from '../types';
import { generatePDF } from '../lib/exportService';

const ExamBank: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exams');
    });
    return () => unsubscribe();
  }, []);

  const handleDownload = async (exam: Exam) => {
    // If it already has a PDF URL, prioritize it
    if (exam.pdf_url) {
      window.open(exam.pdf_url, '_blank');
      return;
    }

    if (!exam.id) return;
    setDownloadingId(exam.id);

    try {
      const gradesQ = query(collection(db, 'grades'), where('test_id', '==', exam.id));
      const snapshot = await getDocs(gradesQ);
      const grades = snapshot.docs.map(doc => doc.data() as Grade);

      if (grades.length === 0) {
        alert(t('noGradesFoundForExam'));
        setDownloadingId(null);
        return;
      }

      const headers = [
        t('studentName'),
        t('academicId'),
        t('score'),
        t('gradeLabel'),
        t('status')
      ];

      const body = grades.map(g => [
        g.student_name,
        g.academic_id,
        g.score.toString(),
        t(g.grade_label.toLowerCase().replace(/\s+/g, '')),
        t(g.status.toLowerCase())
      ]);

      await generatePDF(
        `${exam.subject_name} - ${t('resultReport')}`,
        headers,
        body,
        `${exam.subject_name}_Results`,
        t('dir') === 'rtl'
      );
    } catch (error) {
      console.error('Download failed:', error);
      handleFirestoreError(error, OperationType.GET, 'grades');
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredExams = exams.filter(exam => {
    const matchesSearch = 
      exam.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.year.includes(searchTerm) ||
      exam.semester.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'All' || exam.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="text-gray-400" size={20} />
          <select
            className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="All">{t('allTypes')}</option>
            <option value="Final">{t('final')}</option>
            <option value="Monthly">{t('monthly')}</option>
            <option value="Quiz">{t('quiz')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExams.map((exam, i) => (
          <motion.div
            key={exam.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FileText size={24} />
              </div>
              <button
                onClick={() => handleDownload(exam)}
                disabled={downloadingId === exam.id}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                {downloadingId === exam.id ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Download size={20} />
                )}
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-1">{exam.subject_name}</h3>
            <p className="text-sm text-gray-500 font-medium mb-4">{exam.code}</p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">
                {t(exam.type.toLowerCase())}
              </span>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">
                {t(exam.semester.toLowerCase())}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 border-t pt-4">
              <div className="flex items-center space-x-1">
                <Calendar size={14} />
                <span>{exam.year}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Tag size={14} />
                <span>{exam.department}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredExams.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <FileText className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">{t('noExamsFound')}</p>
        </div>
      )}
    </div>
  );
};

export default ExamBank;
