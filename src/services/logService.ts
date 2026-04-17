import { db, collection, addDoc } from '../firebase';
import { auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export interface AuditLog {
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}

export const logAction = async (action: string, resource: string, details: string) => {
  const user = auth.currentUser;
  if (!user) return;

  const log: AuditLog = {
    userId: user.uid,
    userName: user.displayName || user.email || 'Unknown User',
    action,
    resource,
    details,
    timestamp: new Date().toISOString(),
  };

  try {
    await addDoc(collection(db, 'audit_logs'), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
  }
};
