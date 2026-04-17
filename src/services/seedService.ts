import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  db, 
  serverTimestamp 
} from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export async function seedDatabase() {
  try {
    console.log("🚀 Starting database initialization...");

    // 1. Static Reference Data (Colleges, Majors, Subjects)
    const collegeId = 'comp_science';
    await setDoc(doc(db, 'colleges', collegeId), { 
      name: "كلية الحاسوب",
      code: "CS"
    });

    const majorId = 'mis_dept';
    await setDoc(doc(db, 'majors', majorId), {
      name: "نظم معلومات",
      college_id: collegeId,
      code: "MIS"
    });

    const subjectId = 'db_101';
    await setDoc(doc(db, 'subjects', subjectId), {
      name: "قواعد البيانات",
      code: "DB101",
      major_id: majorId,
      college_id: collegeId,
      credits: 3,
      description: "Introduction to Database Systems"
    });

    // 2. Academic Calendar (Academic Periods)
    const periodId = 'period_2026_1';
    await setDoc(doc(db, 'academic_periods', periodId), {
      year: "2026",
      semester: "Semester 1",
      isActive: true
    });

    // 3. User & Student Profiles
    const adminId = 'admin_01';
    await setDoc(doc(db, 'users', adminId), {
      displayName: "محمد احمد",
      email: "admin@test.com",
      role: "admin",
      department: "MIS",
      uid: adminId
    });

    const studentId = 'std_20201234';
    await setDoc(doc(db, 'students', studentId), {
      full_name: "احمد علي",
      academic_id: "20201234",
      college_id: collegeId,
      major_id: majorId,
      current_year: "2026",
      current_semester: "Semester 1",
      status: "Active",
      email: "student@test.com",
      searchKeywords: ["احمد", "علي", "20201234"],
      createdAt: serverTimestamp()
    });

    // 4. Archive Record (Exam)
    const examId = 'exam_archived_01';
    await setDoc(doc(db, 'exams', examId), {
      type: "Final",
      subject_name: "قواعد البيانات",
      code: "DB101",
      year: "2026",
      semester: "Semester 1",
      pdf_url: "https://picsum.photos/seed/exam/800/1200",
      department: "MIS",
      createdBy: adminId,
      createdAt: serverTimestamp(),
      status: "Approved"
    });

    // 5. Exam Records (Detailed Archive)
    const recordId = 'record_01';
    await setDoc(doc(db, 'examRecords', recordId), {
      subjectName: "قواعد البيانات",
      academicYear: "2026",
      term: "Semester 1",
      examType: "Final",
      college: "كلية الحاسوب",
      major: "نظم معلومات",
      difficultyLevel: "Medium",
      searchKeywords: ["احمد", "علي", "20201234", "قواعد", "البيانات"],
      content: {
        totalQuestions: 4,
        questions: [
          { id: 1, text: "ما هي لغة SQL؟", points: 10 },
          { id: 2, text: "اشرح مفهوم الـ Normalization.", points: 20 },
          { id: 3, text: "ما هو الفرق بين DDL و DML؟", points: 10 },
          { id: 4, text: "قم بتصميم مخطط ERD لنظام مكتبة.", points: 60 }
        ]
      },
      metadata: {
        processedAt: new Date().toISOString(),
        status: "archived",
        language: "Arabic",
        pdfUrl: "https://picsum.photos/seed/exam/800/1200",
        createdBy: adminId,
        createdAt: serverTimestamp()
      }
    });

    // 6. Logs & Statistics
    await addDoc(collection(db, 'audit_logs'), {
      userId: adminId,
      userName: "محمد احمد",
      action: "SEED_DATABASE",
      resource: "System",
      details: "تم تهيئة قاعدة البيانات ببيانات تجريبية",
      timestamp: new Date().toISOString()
    });

    const statId = 'stats_db_101_2026';
    await setDoc(doc(db, 'statistics', statId), {
      subjectId: subjectId,
      subjectName: "قواعد البيانات",
      majorId: majorId,
      majorName: "نظم معلومات",
      academicYear: "2026",
      termName: "Semester 1",
      totalStudents: 120,
      highestScore: 100,
      lowestScore: 45,
      averageScore: 78.5,
      successRate: 85,
      updatedAt: serverTimestamp()
    });

    console.log("✅ Database initialized successfully!");
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_database');
    throw error;
  }
}
