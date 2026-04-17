import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, GraduationCap, CheckCircle, XCircle, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { db, collection, query, where, onSnapshot, orderBy, Query, QuerySnapshot, DocumentData } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Grade } from '../types';
import { cn } from '../lib/utils';

const GradeList: React.FC = () => {
  const { user, isStudent, isStaff, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [indexError, setIndexError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let q: Query<DocumentData>;
    if (isStudent) {
      // Students only see their own grades (by academic_id or student_id)
      q = query(
        collection(db, 'grades'), 
        where('academic_id', '==', user.academic_id || ''),
        orderBy('year', 'desc')
      );
    } else if (isStaff && !isAdmin) {
      // Staff see grades in their department
      q = query(
        collection(db, 'grades'),
        where('department', '==', user.department || ''),
        orderBy('year', 'desc')
      );
    } else {
      // Admins see everything
      q = query(collection(db, 'grades'), orderBy('year', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const gradeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      setGrades(gradeData);
      setIndexError(null);
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
      if (error.code === 'failed-precondition') {
        const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        if (urlMatch) {
          setIndexError(urlMatch[0]);
        } else {
          setIndexError("This view requires a database index. Please check the console for the creation link or contact your administrator.");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isStudent, isStaff, isAdmin]);

  const filteredGrades = grades.filter(grade => 
    grade.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grade.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grade.academic_id.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
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

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('gradeSearchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-bottom border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{t('student')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{t('subject')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{t('score')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{t('grade')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{t('yearSem')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredGrades.map((grade, i) => (
                <motion.tr
                  key={grade.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <GraduationCap size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{grade.student_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-bold">{grade.academic_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{grade.subject_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{grade.department}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{grade.score}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      grade.grade_label === 'Excellent' ? "bg-green-100 text-green-700" :
                      grade.grade_label === 'Very Good' ? "bg-blue-100 text-blue-700" :
                      grade.grade_label === 'Good' ? "bg-indigo-100 text-indigo-700" :
                      grade.grade_label === 'Pass' ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {t(grade.grade_label.toLowerCase().replace(' ', ''))}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1">
                      {grade.status === 'Pass' ? (
                        <CheckCircle className="text-green-500" size={16} />
                      ) : (
                        <XCircle className="text-red-500" size={16} />
                      )}
                      <span className={cn(
                        "text-xs font-bold",
                        grade.status === 'Pass' ? "text-green-600" : "text-red-600"
                      )}>
                        {t(grade.status.toLowerCase())}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-gray-600">{grade.year}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t(grade.semester.toLowerCase())}</p>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredGrades.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-200 mb-2" size={40} />
            <p className="text-gray-400 text-sm">{t('noGradesFound')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeList;
