export const calculateGrade = (score: number): { label: 'Excellent' | 'Very Good' | 'Good' | 'Pass' | 'Fail', status: 'Pass' | 'Fail' } => {
  if (score >= 90) return { label: 'Excellent', status: 'Pass' };
  if (score >= 80) return { label: 'Very Good', status: 'Pass' };
  if (score >= 65) return { label: 'Good', status: 'Pass' };
  if (score >= 50) return { label: 'Pass', status: 'Pass' };
  return { label: 'Fail', status: 'Fail' };
};
