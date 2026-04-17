export type UserRole = 'admin' | 'staff' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  academic_id?: string;
}

export type ExamType = 'Final' | 'Monthly' | 'Quiz';
export type Semester = 'Semester 1' | 'Semester 2' | 'Summer';

export type ExamStatus = 'Pending' | 'Approved' | 'Rejected';

export interface Exam {
  id?: string;
  type: ExamType;
  subject_name: string;
  code: string;
  year: string;
  semester: Semester;
  pdf_url: string;
  department: string;
  createdBy: string;
  createdAt: any;
  status: ExamStatus;
}

export type GradeLabel = 'Excellent' | 'Very Good' | 'Good' | 'Pass' | 'Fail';
export type PassStatus = 'Pass' | 'Fail';

export interface Grade {
  id?: string;
  student_id: string;
  academic_id: string;
  student_name: string;
  test_id: string;
  subject_name: string;
  score: number;
  grade_label: GradeLabel;
  status: PassStatus;
  department: string;
  year: string;
  semester: string;
  createdAt?: any;
}

export interface ExamRecord {
  id?: string;
  subjectName: string;
  academicYear: string;
  term: string;
  examType: 'Final' | 'Midterm';
  college: string;
  major: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  content: {
    totalQuestions: number;
    questions: {
      id: number;
      text: string;
      points: number | null;
    }[];
  };
  metadata: {
    processedAt: string;
    status: 'archived';
    language: 'Arabic' | 'English';
    pdfUrl: string;
    createdBy: string;
    createdAt: any;
  };
}

export interface Statistics {
  id?: string;
  subjectId: string;
  subjectName: string;
  majorId: string;
  majorName: string;
  academicYear: string;
  termName: string;
  totalStudents: number;
  highestScore: number;
  lowestScore: number;
  averageScore: number;
  successRate: number;
  updatedAt: any;
}

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}
