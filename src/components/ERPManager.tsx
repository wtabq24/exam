import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  BookOpen, 
  School, 
  Layers, 
  Calendar, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  Check, 
  X,
  Filter,
  MoreVertical,
  ArrowUpDown,
  Save,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  db, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  where
} from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { useLanguage } from '../contexts/LanguageContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TabType = 'students' | 'subjects' | 'majors' | 'colleges' | 'periods';

export default function ERPManager() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Data States
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [majors, setMajors] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubStudents = onSnapshot(query(collection(db, 'students'), orderBy('full_name')), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });
    const unsubSubjects = onSnapshot(query(collection(db, 'subjects'), orderBy('name')), (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    });
    const unsubMajors = onSnapshot(query(collection(db, 'majors'), orderBy('name')), (snapshot) => {
      setMajors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'majors');
    });
    const unsubColleges = onSnapshot(query(collection(db, 'colleges'), orderBy('name')), (snapshot) => {
      setColleges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'colleges');
    });
    const unsubPeriods = onSnapshot(query(collection(db, 'academic_periods'), orderBy('year', 'desc')), (snapshot) => {
      setPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'academic_periods');
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubSubjects();
      unsubMajors();
      unsubColleges();
      unsubPeriods();
    };
  }, []);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    switch (activeTab) {
      case 'students':
        return students.filter(s => 
          s.full_name?.toLowerCase().includes(term) || 
          s.academic_id?.toLowerCase().includes(term) ||
          s.email?.toLowerCase().includes(term)
        );
      case 'subjects':
        return subjects.filter(s => 
          s.name?.toLowerCase().includes(term) || 
          s.code?.toLowerCase().includes(term)
        );
      case 'majors':
        return majors.filter(m => m.name?.toLowerCase().includes(term));
      case 'colleges':
        return colleges.filter(c => c.name?.toLowerCase().includes(term));
      case 'periods':
        return periods.filter(p => p.year?.toLowerCase().includes(term));
      default:
        return [];
    }
  }, [activeTab, searchTerm, students, subjects, majors, colleges, periods]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    
    // Convert numeric fields
    if (data.credits) data.credits = Number(data.credits);
    if (data.isActive) data.isActive = data.isActive === 'true';

    const collectionName = activeTab === 'periods' ? 'academic_periods' : activeTab;

    try {
      if (editingItem) {
        await updateDoc(doc(db, collectionName, editingItem.id), data);
      } else {
        if (activeTab === 'students') data.createdAt = new Date().toISOString();
        await addDoc(collection(db, collectionName), data);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, `${collectionName}${editingItem ? '/' + editingItem.id : ''}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('deleteRecordConfirm'))) return;
    const collectionName = activeTab === 'periods' ? 'academic_periods' : activeTab;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  const tabs = [
    { id: 'students', label: t('students'), icon: Users },
    { id: 'subjects', label: t('subjects'), icon: BookOpen },
    { id: 'majors', label: t('majors'), icon: Layers },
    { id: 'colleges', label: t('colleges'), icon: School },
    { id: 'periods', label: t('academicPeriods'), icon: Calendar },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('erpResourceManager')}</h1>
          <p className="text-gray-500">{t('erpDesc')}</p>
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('addNew')} {t(activeTab.slice(0, -1))}
        </button>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as TabType); setSearchTerm(''); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white border-t border-x border-gray-200 text-indigo-600 -mb-px" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={`${t('search')} ${t(activeTab)}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">{t('loadingResources')}</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-2">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">{t('noRecordsFound')}</h3>
            <p className="text-gray-500">{t('adjustSearch')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {activeTab === 'students' && (
                    <>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('student')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('academicId')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('major')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                    </>
                  )}
                  {activeTab === 'subjects' && (
                    <>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('code')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('subjectName')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('credits')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('major')}</th>
                    </>
                  )}
                  {activeTab === 'majors' && (
                    <>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('majorCode')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('college')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('studentsCount')}</th>
                    </>
                  )}
                  {activeTab === 'colleges' && (
                    <>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('collegeCode')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('departmentsMajors')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('hierarchy')}</th>
                    </>
                  )}
                  {activeTab === 'periods' && (
                    <>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('year')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('semester')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                    </>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    {activeTab === 'students' && (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{item.full_name}</span>
                            <span className="text-xs text-gray-500">{item.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.academic_id}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {majors.find(m => m.id === item.major_id)?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            item.status === 'Active' ? "bg-green-100 text-green-700" :
                            item.status === 'Graduated' ? "bg-blue-100 text-blue-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {t(item.status.toLowerCase())}
                          </span>
                        </td>
                      </>
                    )}
                    {activeTab === 'subjects' && (
                      <>
                        <td className="px-6 py-4 font-mono text-sm text-indigo-600">{item.code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.credits}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {majors.find(m => m.id === item.major_id)?.name || 'Unknown'}
                        </td>
                      </>
                    )}
                    {activeTab === 'majors' && (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                            <span className="text-xs text-gray-500 font-mono">{item.code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {colleges.find(c => c.id === item.college_id)?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <button 
                            onClick={() => { setActiveTab('students'); setSearchTerm(item.name); }}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-xs flex items-center gap-1"
                          >
                            {t('viewStudents')} <ChevronRight className={cn("w-3 h-3", t('dir') === 'rtl' && "rotate-180")} />
                          </button>
                        </td>
                      </>
                    )}
                    {activeTab === 'colleges' && (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                            <span className="text-xs text-gray-500 font-mono">{item.code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {majors.filter(m => m.college_id === item.id).map(m => (
                              <span key={m.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-md border border-gray-200">
                                {m.name}
                              </span>
                            ))}
                            {majors.filter(m => m.college_id === item.id).length === 0 && (
                              <span className="text-xs text-gray-400 italic">No departments linked</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <button 
                            onClick={() => { setActiveTab('majors'); setSearchTerm(item.name); }}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-xs flex items-center gap-1"
                          >
                            {t('manageMajors')} <ChevronRight className={cn("w-3 h-3", t('dir') === 'rtl' && "rotate-180")} />
                          </button>
                        </td>
                      </>
                    )}
                    {activeTab === 'periods' && (
                      <>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.year}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{t(item.semester.toLowerCase().replace(' ', ''))}</td>
                        <td className="px-6 py-4">
                          {item.isActive ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full w-fit">
                              <Check className="w-3 h-3" /> {t('active')}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full w-fit">
                              {t('inactive')}
                            </span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem ? t('edit') : t('addNew')} {t(activeTab.slice(0, -1))}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {activeTab === 'students' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('fullName')}</label>
                        <input name="full_name" defaultValue={editingItem?.full_name} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('academicId')}</label>
                        <input name="academic_id" defaultValue={editingItem?.academic_id} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{t('email')}</label>
                      <input name="email" type="email" defaultValue={editingItem?.email} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('college')}</label>
                        <select name="college_id" defaultValue={editingItem?.college_id} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">{t('selectCollege')}</option>
                          {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('major')}</label>
                        <select name="major_id" defaultValue={editingItem?.major_id} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">{t('selectMajor')}</option>
                          {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{t('status')}</label>
                      <select name="status" defaultValue={editingItem?.status || 'Active'} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="Active">{t('active')}</option>
                        <option value="Graduated">{t('graduated')}</option>
                        <option value="Suspended">{t('suspended')}</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'subjects' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('code')}</label>
                        <input name="code" defaultValue={editingItem?.code} required placeholder="e.g., CS101" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('credits')}</label>
                        <input name="credits" type="number" defaultValue={editingItem?.credits} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{t('subjectName')}</label>
                      <input name="name" defaultValue={editingItem?.name} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('college')}</label>
                        <select name="college_id" defaultValue={editingItem?.college_id} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">{t('selectCollege')}</option>
                          {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('major')}</label>
                        <select name="major_id" defaultValue={editingItem?.major_id} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">{t('selectMajor')}</option>
                          {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'majors' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{t('majorName')}</label>
                      <input name="name" defaultValue={editingItem?.name} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('code')}</label>
                        <input name="code" defaultValue={editingItem?.code} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('college')}</label>
                        <select name="college_id" defaultValue={editingItem?.college_id} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">{t('selectCollege')}</option>
                          {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'colleges' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{t('collegeName')}</label>
                      <input name="name" defaultValue={editingItem?.name} required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{t('code')}</label>
                      <input name="code" defaultValue={editingItem?.code} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </>
                )}

                {activeTab === 'periods' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('year')}</label>
                        <input name="year" defaultValue={editingItem?.year} required placeholder="e.g., 2026" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('semester')}</label>
                        <select name="semester" defaultValue={editingItem?.semester || 'Semester 1'} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="Semester 1">{t('semester1')}</option>
                          <option value="Semester 2">{t('semester2')}</option>
                          <option value="Summer">{t('summer')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" name="isActive" id="isActive" defaultChecked={editingItem?.isActive} value="true" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                      <label htmlFor="isActive" className="text-sm font-medium text-gray-700">{t('setActivePeriod')}</label>
                    </div>
                  </>
                )}

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    {t('cancel')}
                  </button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />
                    {t('saveChanges')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
