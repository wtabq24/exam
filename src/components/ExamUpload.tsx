import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Upload, FileText, Plus, Trash2, CheckCircle, AlertCircle, 
  Loader2, X, Eye, FileImage, File as FileIcon, 
  ArrowRight, ShieldAlert, Edit3, Save, Database, Keyboard
} from 'lucide-react';
import { db, storage, ref, uploadBytes, getDownloadURL, collection, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { calculateGrade } from '../lib/gradeLogic';
import { ExamType, Semester, ExamStatus } from '../types';
import { extractExamData, ExtractedExamData, extractExamPaperData, ExamPaperData } from '../services/geminiService';
import { cn } from '../lib/utils';

type UploadStep = 'upload' | 'processing' | 'review' | 'success';
type UploadMode = 'grades' | 'archive';

interface QueuedFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  extractedData?: ExtractedExamData;
  examPaperData?: ExamPaperData;
  pdfUrl?: string;
  error?: string;
}

const ExamUpload: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<UploadStep>('upload');
  const [mode, setMode] = useState<UploadMode>('grades');
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const addFilesToQueue = (files: FileList | null) => {
    if (!files) return;
    const newFiles: QueuedFile[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }));
    setQueue(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(f => f.id !== id));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const processQueue = async () => {
    if (queue.length === 0) return;
    setStep('processing');
    
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setActiveFileIndex(i);
      
      try {
        setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', progress: 10 } : f));
        setProcessingStatus(t('ocrReading'));
        await new Promise(r => setTimeout(r, 1000));
        
        setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 40 } : f));
        setProcessingStatus(t('dataAnalysis'));
        
        const base64 = await fileToBase64(item.file);
        
        if (mode === 'grades') {
          const extracted = await extractExamData(base64, item.file.type);
          setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 80, extractedData: extracted } : f));
        } else {
          const extracted = await extractExamPaperData(base64, item.file.type);
          setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 80, examPaperData: extracted } : f));
        }
        
        setProcessingStatus(t('extraction'));
        await new Promise(r => setTimeout(r, 500));
        
        setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f));
      } catch (error: any) {
        console.error(`Extraction error for ${item.file.name}:`, error);
        let errorMessage = t('extractionError');
        if (error.message?.includes('Quota exceeded')) {
          errorMessage = "AI Quota exceeded. Please try again in a few minutes.";
        } else if (error.message?.includes('Rpc failed') || error.message?.includes('xhr error')) {
          errorMessage = "Network error during AI analysis. Retrying might help.";
        }
        
        setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: errorMessage } : f));
      }
    }
    
    setStep('review');
    setActiveFileIndex(0);
  };

  const [finalizing, setFinalizing] = useState(false);
  const [backgroundNotification, setBackgroundNotification] = useState<string | null>(null);

  const handleFinalize = async () => {
    if (!user) return;
    setFinalizing(true);
    setProcessingStatus(t('archiving'));
    
    try {
      // 1. Save Data to Firestore FIRST (Parallelized with individual error handling)
      const results = await Promise.all(queue.map(async (item) => {
        if (item.status !== 'done') return null;
        
        try {
          if (mode === 'grades' && item.extractedData) {
            const examRef = await addDoc(collection(db, 'exams'), {
              type: 'Final',
              subject_name: item.extractedData.subject_name,
              code: item.extractedData.code,
              year: item.extractedData.year,
              semester: item.extractedData.semester,
              pdf_url: '', 
              department: user.department || 'General',
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              status: 'Pending',
            });
            
            const batch = writeBatch(db);
            item.extractedData.students.forEach(s => {
              const { label, status } = calculateGrade(s.score);
              const gradeRef = doc(collection(db, 'grades'));
              batch.set(gradeRef, {
                student_id: '',
                academic_id: s.academic_id,
                student_name: s.name,
                test_id: examRef.id,
                subject_name: item.extractedData!.subject_name,
                score: s.score,
                grade_label: label,
                status: status,
                department: user.department || 'General',
                year: item.extractedData!.year,
                semester: item.extractedData!.semester,
                createdAt: serverTimestamp(),
              });
            });
            try {
              await batch.commit();
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, 'grades_batch');
              throw err;
            }
            return { item, docId: examRef.id, collectionName: 'exams' };
          } else if (mode === 'archive' && item.examPaperData) {
            const recordRef = await addDoc(collection(db, 'examRecords'), {
              ...item.examPaperData.examRecord,
              content: item.examPaperData.content,
              metadata: {
                ...item.examPaperData.metadata,
                pdfUrl: '', 
                createdBy: user.uid,
                createdAt: serverTimestamp(),
              }
            });
            return { item, docId: recordRef.id, collectionName: 'examRecords' };
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, mode === 'grades' ? 'exams' : 'examRecords');
          console.error(`Failed to save item ${item.file.name} to Firestore:`, err);
          return null;
        }
        return null;
      }));

      const uploadTasks = results.filter(Boolean) as { item: QueuedFile, docId: string, collectionName: string }[];
      
      if (uploadTasks.length === 0 && queue.some(i => i.status === 'done')) {
        throw new Error("Failed to save any records to the database.");
      }

      // 2. Instant UI Transition & Cleanup
      setStep('success');
      setFinalizing(false);
      setProcessingStatus('');
      // Clear queue after success to prevent double archiving if they go back
      // But maybe keep it for "Archive another" logic? 
      // The user said "option to 'Archive another exam'", which usually means resetting the state.

      // 3. Background File Upload (Non-blocking & Silent)
      uploadTasks.forEach(({ item, docId, collectionName }) => {
        const currentFile = item.file;
        // Skip empty files (like manual entry placeholders)
        if (currentFile.size === 0) return;

        (async () => {
          try {
            const storageRef = ref(storage, `exams/${Date.now()}_${currentFile.name}`);
            const uploadResult = await uploadBytes(storageRef, currentFile);
            const pdfUrl = await getDownloadURL(uploadResult.ref);
            
            if (collectionName === 'exams') {
              await updateDoc(doc(db, 'exams', docId), { pdf_url: pdfUrl });
            } else {
              await updateDoc(doc(db, 'examRecords', docId), { 'metadata.pdfUrl': pdfUrl });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${docId}`);
            console.warn(`Background upload failed for ${currentFile.name}:`, err);
            setBackgroundNotification(t('uploadLater'));
            setTimeout(() => setBackgroundNotification(null), 6000);
          }
        })();
      });

    } catch (error: any) {
      console.error("Finalize Error:", error);
      alert(error.message || t('finalizeError'));
      setFinalizing(false);
    }
  };

  const updateExtractedData = (field: keyof ExtractedExamData, value: any) => {
    setQueue(prev => prev.map((f, idx) => {
      if (idx === activeFileIndex && f.extractedData) {
        return { ...f, extractedData: { ...f.extractedData, [field]: value } };
      }
      return f;
    }));
  };

  const updateStudent = (sIdx: number, field: string, value: any) => {
    setQueue(prev => prev.map((f, idx) => {
      if (idx === activeFileIndex && f.extractedData) {
        const newStudents = [...f.extractedData.students];
        newStudents[sIdx] = { ...newStudents[sIdx], [field]: value };
        return { ...f, extractedData: { ...f.extractedData, students: newStudents } };
      }
      return f;
    }));
  };

  const addManualStudent = () => {
    setQueue(prev => prev.map((f, idx) => {
      if (idx === activeFileIndex && f.extractedData) {
        return { 
          ...f, 
          extractedData: { 
            ...f.extractedData, 
            students: [...f.extractedData.students, { academic_id: '', name: '', score: 0 }] 
          } 
        };
      }
      return f;
    }));
  };

  const skipToManualEntry = () => {
    const manualFile: QueuedFile = {
      id: 'manual-' + Math.random().toString(36).substr(2, 9),
      file: new File([], "manual_entry.pdf", { type: "application/pdf" }),
      status: 'done',
      progress: 100,
      extractedData: {
        subject_name: '',
        code: '',
        year: new Date().getFullYear().toString(),
        semester: 'First',
        students: [{ academic_id: '', name: '', score: 0 }]
      }
    };
    setQueue([manualFile]);
    setActiveFileIndex(0);
    setStep('review');
  };

  const activeFile = queue[activeFileIndex];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Step Header */}
      <div className="flex items-center justify-center mb-12">
        {[
          { id: 'upload', label: t('upload') },
          { id: 'processing', label: t('aiProcessing') },
          { id: 'review', label: t('review') },
          { id: 'success', label: t('done') }
        ].map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                step === s.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : 
                (i < ['upload', 'processing', 'review', 'success'].indexOf(step) ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500")
              )}>
                {i < ['upload', 'processing', 'review', 'success'].indexOf(step) ? <CheckCircle size={20} /> : i + 1}
              </div>
              <span className={cn("text-xs font-bold mt-2", step === s.id ? "text-indigo-600" : "text-gray-400")}>{s.label}</span>
            </div>
            {i < 3 && <div className={cn("w-20 h-[2px] mx-4 -mt-6", i < ['upload', 'processing', 'review', 'success'].indexOf(step) ? "bg-green-500" : "bg-gray-200")} />}
          </React.Fragment>
        ))}
      </div>

      {step === 'upload' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Mode Selector */}
          <div className="flex justify-center mb-8">
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-1">
              <button 
                onClick={() => setMode('grades')}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center space-x-2",
                  mode === 'grades' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Database size={18} />
                <span>{t('extractGrades')}</span>
              </button>
              <button 
                onClick={() => setMode('archive')}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center space-x-2",
                  mode === 'archive' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <FileText size={18} />
                <span>{t('examArchiving')}</span>
              </button>
            </div>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-4 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer group",
              isDragging ? "border-indigo-600 bg-indigo-50" : "border-gray-200 hover:border-indigo-400 hover:bg-gray-50"
            )}
          >
            <input type="file" multiple accept="application/pdf,image/*" className="hidden" ref={fileInputRef} onChange={(e) => addFilesToQueue(e.target.files)} />
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <Upload size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">{t('dragDropExams')}</h3>
              <p className="text-gray-500 font-medium mb-6">{t('supportFormats')}</p>
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  {t('browseFiles')}
                </button>
                <div className="w-[1px] h-8 bg-gray-200"></div>
                <button 
                  onClick={(e) => { e.stopPropagation(); skipToManualEntry(); }}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center space-x-2"
                >
                  <Keyboard size={18} />
                  <span>{t('manualEntry')}</span>
                </button>
              </div>
            </div>
          </div>

          {queue.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h4 className="font-bold text-gray-900">{t('uploadQueue')} ({queue.length})</h4>
                <button onClick={processQueue} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center space-x-2">
                  <span>{t('startAiExtraction')}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {queue.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-gray-100 rounded-xl text-gray-500">
                        {item.file.type.includes('pdf') ? <FileText size={24} /> : <FileImage size={24} />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{item.file.name}</p>
                        <p className="text-xs text-gray-400">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button onClick={() => removeFromQueue(item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">{t('aiCoreProcessing')}</h3>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{processingStatus}</span>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Loader2 className="animate-spin" size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{activeFile?.file.name}</p>
                  <p className="text-xs text-gray-400">{t('fileOf')} {activeFileIndex + 1} {t('of')} {queue.length}</p>
                </div>
              </div>

              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${activeFile?.progress}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[t('ocrReading'), t('dataAnalysis'), t('extraction')].map((s, i) => (
                  <div key={s} className="flex flex-col items-center">
                    <div className={cn(
                      "w-2 h-2 rounded-full mb-2",
                      activeFile?.progress > (i * 33) ? "bg-indigo-600" : "bg-gray-200"
                    )} />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'review' && activeFile && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[700px]">
          {/* Split View: Original Document */}
          <div className="bg-gray-900 rounded-3xl overflow-hidden relative flex flex-col">
            <div className="p-4 bg-gray-800 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <Eye size={18} className="text-indigo-400" />
                <span className="text-sm font-bold">{t('originalDocument')}</span>
              </div>
              <span className="text-xs font-medium text-gray-400">{activeFile.file.name}</span>
            </div>
            <div className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-gray-950">
              {activeFile.file.type.includes('image') ? (
                <img src={URL.createObjectURL(activeFile.file)} alt="preview" className="max-w-full shadow-2xl" />
              ) : activeFile.file.type === 'application/pdf' ? (
                <iframe 
                  src={`${URL.createObjectURL(activeFile.file)}#toolbar=0`} 
                  className="w-full h-full rounded-xl border-none bg-white"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <FileText size={100} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold">{t('previewUnavailable')}</p>
                  <p className="text-sm">{t('reviewExtractedData')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Split View: Editable Data Form */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center space-x-2">
                <Edit3 size={18} className="text-indigo-600" />
                <span className="text-sm font-bold text-gray-900">{t('extractedDataVerification')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  disabled={activeFileIndex === 0}
                  onClick={() => setActiveFileIndex(prev => prev - 1)}
                  className="p-2 text-gray-400 hover:bg-white rounded-lg disabled:opacity-30"
                >
                  <ArrowRight size={18} className="rotate-180" />
                </button>
                <span className="text-xs font-bold text-gray-500">{activeFileIndex + 1} / {queue.length}</span>
                <button 
                  disabled={activeFileIndex === queue.length - 1}
                  onClick={() => setActiveFileIndex(prev => prev + 1)}
                  className="p-2 text-gray-400 hover:bg-white rounded-lg disabled:opacity-30"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeFile.status === 'error' ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle size={40} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">{t('extractionError')}</h3>
                  <p className="text-gray-500 mb-8 max-w-xs">{activeFile.error || t('extractionErrorDesc')}</p>
                  <button 
                    onClick={() => {
                      setStep('upload');
                      setQueue(prev => prev.map(f => f.id === activeFile.id ? { ...f, status: 'pending', progress: 0 } : f));
                    }}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    {t('tryAgain')}
                  </button>
                </div>
              ) : mode === 'grades' && activeFile.extractedData ? (
                <>
                  {/* Intelligent Alerts */}
                  {activeFile.extractedData.students.some(s => s.score > 100) && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 text-red-700">
                      <ShieldAlert size={20} className="shrink-0" />
                      <div>
                        <p className="text-sm font-bold">{t('logicalErrorDetected')}</p>
                        <p className="text-xs opacity-80">{t('scoreExceedLimit')}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('subjectName')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.extractedData.subject_name || ''}
                        onChange={(e) => updateExtractedData('subject_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('subjectCode')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.extractedData.code || ''}
                        onChange={(e) => updateExtractedData('code', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('academicYear')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.extractedData.year || ''}
                        onChange={(e) => updateExtractedData('year', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('studentScores')}</h5>
                      <button 
                        onClick={addManualStudent}
                        className="text-indigo-600 font-bold text-xs flex items-center space-x-1 hover:underline"
                      >
                        <Plus size={14} />
                        <span>{t('addStudent')}</span>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {activeFile.extractedData.students.map((student, sIdx) => (
                        <div key={sIdx} className={cn(
                          "p-3 rounded-2xl flex items-center space-x-3 transition-all",
                          student.score > 100 ? "bg-red-50 border border-red-100" : "bg-gray-50"
                        )}>
                          <input 
                            className="w-24 bg-transparent border-none font-bold text-sm text-gray-900 focus:ring-0"
                            value={student.academic_id || ''}
                            onChange={(e) => updateStudent(sIdx, 'academic_id', e.target.value)}
                          />
                          <input 
                            className="flex-1 bg-transparent border-none font-bold text-sm text-gray-900 focus:ring-0"
                            value={student.name || ''}
                            onChange={(e) => updateStudent(sIdx, 'name', e.target.value)}
                          />
                          <input 
                            type="number"
                            className={cn(
                              "w-16 bg-transparent border-none font-black text-sm text-right focus:ring-0",
                              student.score > 100 ? "text-red-600" : "text-indigo-600"
                            )}
                            value={student.score ?? 0}
                            onChange={(e) => updateStudent(sIdx, 'score', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : activeFile.examPaperData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('subjectName')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.examPaperData.examRecord.subjectName || ''}
                        onChange={(e) => setQueue(prev => prev.map((f, idx) => idx === activeFileIndex ? { ...f, examPaperData: { ...f.examPaperData!, examRecord: { ...f.examPaperData!.examRecord, subjectName: e.target.value } } } : f))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('college')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.examPaperData.examRecord.college || ''}
                        onChange={(e) => setQueue(prev => prev.map((f, idx) => idx === activeFileIndex ? { ...f, examPaperData: { ...f.examPaperData!, examRecord: { ...f.examPaperData!.examRecord, college: e.target.value } } } : f))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('major')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.examPaperData.examRecord.major || ''}
                        onChange={(e) => setQueue(prev => prev.map((f, idx) => idx === activeFileIndex ? { ...f, examPaperData: { ...f.examPaperData!, examRecord: { ...f.examPaperData!.examRecord, major: e.target.value } } } : f))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('academicYear')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.examPaperData.examRecord.academicYear || ''}
                        onChange={(e) => setQueue(prev => prev.map((f, idx) => idx === activeFileIndex ? { ...f, examPaperData: { ...f.examPaperData!, examRecord: { ...f.examPaperData!.examRecord, academicYear: e.target.value } } } : f))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t('term')}</label>
                      <input 
                        className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                        value={activeFile.examPaperData.examRecord.term || ''}
                        onChange={(e) => setQueue(prev => prev.map((f, idx) => idx === activeFileIndex ? { ...f, examPaperData: { ...f.examPaperData!, examRecord: { ...f.examPaperData!.examRecord, term: e.target.value } } } : f))}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('extractedQuestions')} ({activeFile.examPaperData.content.totalQuestions})</h5>
                    <div className="space-y-2">
                      {activeFile.examPaperData.content.questions.map((q, qIdx) => (
                        <div key={q.id} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-600 uppercase">{t('question')} {q.id}</span>
                            <span className="text-[10px] font-bold text-gray-400">{q.points} {t('points')}</span>
                          </div>
                          <p className="text-sm text-gray-700 font-medium leading-relaxed">{q.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-6 border-t border-gray-50 bg-gray-50/30">
              <button 
                onClick={handleFinalize}
                disabled={finalizing}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {finalizing ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>{t('archiving')}</span>
                  </>
                ) : (
                  <>
                    <Database size={24} />
                    <span>{t('finalizeArchive')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-green-50">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4">{t('archiveSuccessful')}</h2>
          <p className="text-gray-500 max-w-md mb-12 font-medium">{t('archiveSuccessDesc')}</p>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                setQueue([]);
                setStep('upload');
              }} 
              className="px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 hover:bg-gray-50 transition-all"
            >
              {t('uploadMore')}
            </button>
            <Link to="/archive" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
              {t('viewArchiveHub')}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Background Notification */}
      <AnimatePresence>
        {backgroundNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 bg-amber-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 z-50 border border-amber-500"
          >
            <AlertCircle size={20} />
            <span className="font-bold text-sm">{backgroundNotification}</span>
            <button onClick={() => setBackgroundNotification(null)} className="p-1 hover:bg-amber-500 rounded-lg">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExamUpload;
