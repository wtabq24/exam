import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedExamData {
  subject_name: string;
  code: string;
  year: string;
  semester: string;
  students: {
    academic_id: string;
    name: string;
    score: number;
  }[];
}

export interface ExtractedExamData {
  subject_name: string;
  code: string;
  year: string;
  semester: string;
  students: {
    academic_id: string;
    name: string;
    score: number;
  }[];
}

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRpcError = error.message?.includes('Rpc failed') || error.message?.includes('xhr error');
      const isQuotaError = error.message?.includes('429') || error.message?.includes('Quota exceeded');
      
      if ((isRpcError || isQuotaError) && i < retries - 1) {
        console.warn(`Gemini API attempt ${i + 1} failed, retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries reached");
};

export const extractExamData = async (base64File: string, mimeType: string): Promise<ExtractedExamData> => {
  return withRetry(async () => {
    const model = "gemini-3.1-pro-preview";
    
    const prompt = `
      You are a precise data extraction specialist. Your task is to scan the entire provided document and extract student grade information.
      
      TARGETED SCANNING:
      Extract ONLY the following fields for EVERY student entry found in the document:
      - Student Name (Full Name)
      - Academic ID / Seat Number
      - Final Grade / Score
      
      EXTRACTION RULES:
      1. SCAN ALL PAGES: Do not stop after the first page or first few students. You must continue until the end of the file.
      2. NO OMISSIONS: Include every single student entry that matches the criteria.
      3. IGNORE IRRELEVANT INFO: Explicitly ignore headers, footers, institutional instructions, examiner signatures, or any data not directly related to the student list.
      4. CLEAN OUTPUT: Provide a clean JSON array of objects.
      
      Also extract the general exam metadata:
      - Subject Name
      - Subject Code
      - Academic Year
      - Semester
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64File,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject_name: { type: Type.STRING },
            code: { type: Type.STRING },
            year: { type: Type.STRING },
            semester: { type: Type.STRING },
            students: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  academic_id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                },
                required: ["academic_id", "name", "score"],
              },
            },
          },
          required: ["subject_name", "code", "year", "semester", "students"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data extracted from AI");
    
    return JSON.parse(text) as ExtractedExamData;
  });
};

export interface ExamPaperData {
  examRecord: {
    subjectName: string;
    academicYear: string;
    term: string;
    examType: 'Final' | 'Midterm';
    college: string;
    major: string;
    difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  };
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
  };
}

export const extractExamPaperData = async (base64File: string, mimeType: string): Promise<ExamPaperData> => {
  return withRetry(async () => {
    const model = "gemini-3.1-pro-preview";
    
    const prompt = `
      أنت خبير في تحليل البيانات التعليمية والأرشفة الرقمية. مهمتك هي استخراج البيانات من صورة "ورقة اختبار" وتحويلها إلى كائن JSON نظيف يتوافق تماماً مع هيكلية قاعدة بيانات Firestore الخاصة بنظام Intelligent Exam Archiving.

      🔍 تفاصيل الاستخراج (Extraction Logic):
      حلل الصورة واستخرج الحقول التالية بدقة:
      - Subject: اسم المادة.
      - College & Major: الكلية والتخصص.
      - Academic Year & Term: السنة الدراسية والفصل.
      - Exam Details: نوع الاختبار (Final/Midterm).
      - Questions Analysis: استخراج نص الأسئلة وتصنيفها.

      إذا كان الخط غير واضح، ضع علامة [Unclear] في الحقل المعني.
      حافظ على اللغة الأصلية للأسئلة (العربية) مع إبقاء مفاتيح JSON بالإنجليزية.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64File,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            examRecord: {
              type: Type.OBJECT,
              properties: {
                subjectName: { type: Type.STRING },
                academicYear: { type: Type.STRING },
                term: { type: Type.STRING },
                examType: { type: Type.STRING, enum: ["Final", "Midterm"] },
                college: { type: Type.STRING },
                major: { type: Type.STRING },
                difficultyLevel: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
              },
              required: ["subjectName", "academicYear", "term", "examType", "college", "major", "difficultyLevel"],
            },
            content: {
              type: Type.OBJECT,
              properties: {
                totalQuestions: { type: Type.NUMBER },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.NUMBER },
                      text: { type: Type.STRING },
                      points: { type: Type.NUMBER, nullable: true },
                    },
                    required: ["id", "text"],
                  },
                },
              },
              required: ["totalQuestions", "questions"],
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                processedAt: { type: Type.STRING },
                status: { type: Type.STRING },
                language: { type: Type.STRING, enum: ["Arabic", "English"] },
              },
              required: ["processedAt", "status", "language"],
            },
          },
          required: ["examRecord", "content", "metadata"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data extracted from AI");
    
    return JSON.parse(text) as ExamPaperData;
  });
};
