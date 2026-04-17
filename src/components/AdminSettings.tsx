import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  History, 
  Settings as SettingsIcon, 
  UserPlus, 
  Search, 
  Filter,
  Save,
  RefreshCw,
  Database,
  Globe,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit3,
  Activity
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  orderBy,
  limit,
  db,
  setDoc
} from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { logAction } from '../services/logService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { seedDatabase } from '../services/seedService';
import { Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff' | 'student';
  department?: string;
  academic_id?: string;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}

interface SystemSettings {
  id: string;
  aiApiKey: string;
  defaultLanguage: 'EN' | 'AR';
  backupFrequency: 'Daily' | 'Weekly' | 'Monthly';
  lastBackup?: string;
}

export default function AdminSettings() {
  const { user: currentUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'settings'>('users');
  
  // Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(() => {
    const local = localStorage.getItem('archivio_settings');
    return local ? JSON.parse(local) : null;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    role: 'student' as const,
    department: '',
    academic_id: ''
  });

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const logsQuery = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    });

    const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudSettings = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SystemSettings;
        setSettings(cloudSettings);
        // Sync global language if it differs from cloud
        if (cloudSettings.defaultLanguage !== language) {
          setLanguage(cloudSettings.defaultLanguage);
        }
        localStorage.setItem('archivio_settings', JSON.stringify(cloudSettings));
      } else {
        // Initialize default settings if none exist
        const defaultSettings: SystemSettings = {
          id: 'default',
          aiApiKey: '',
          defaultLanguage: 'EN',
          backupFrequency: 'Weekly'
        };
        setSettings(defaultSettings);
        localStorage.setItem('archivio_settings', JSON.stringify(defaultSettings));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'settings');
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubLogs();
      unsubSettings();
    };
  }, []);

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'staff' | 'student') => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      await logAction('UPDATE_ROLE', 'User', `Changed role for ${userToUpdate?.email} to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      const { id, ...data } = settings;
      
      // 1. Save to LocalStorage for immediate persistence
      localStorage.setItem('archivio_settings', JSON.stringify(settings));
      
      // 2. Update global language state
      setLanguage(settings.defaultLanguage);

      // 3. Save to Firestore (system_configs collection as requested)
      // We use setDoc with merge: true on 'global_settings' for auto-initialization
      try {
        await setDoc(doc(db, 'system_configs', 'global_settings'), data, { merge: true });
        
        // Also update the 'settings' collection used by the listener if it's different
        if (id !== 'default') {
          await updateDoc(doc(db, 'settings', id), data);
        } else {
          // If it was default, we might want to create a real doc in 'settings' too
          const newDoc = await addDoc(collection(db, 'settings'), data);
          setSettings({ ...settings, id: newDoc.id });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings');
        throw err;
      }

      await logAction('UPDATE_SETTINGS', 'System', 'Updated global system settings');
      
      // 4. Show success feedback
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDatabase = async () => {
    if (!window.confirm(t('confirmSeed'))) return;
    
    setSeeding(true);
    try {
      await seedDatabase();
      alert(t('seedSuccess'));
    } catch (error) {
      alert(t('seedError'));
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!window.confirm(t('confirmDeleteUser'))) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      await logAction('DELETE_USER', 'User', `Deleted user: ${userToDelete?.email}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        const { id, ...data } = editingUser;
        await updateDoc(doc(db, 'users', id), data);
        await logAction('UPDATE_USER', 'User', `Updated user: ${editingUser.email}`);
        setEditingUser(null);
      } else {
        await addDoc(collection(db, 'users'), { ...newUser, uid: '' });
        await logAction('ADD_USER', 'User', `Added new user: ${newUser.email} with role ${newUser.role}`);
        setShowAddUser(false);
        setNewUser({ email: '', displayName: '', role: 'student', department: '', academic_id: '' });
      }
    } catch (error) {
      handleFirestoreError(error, editingUser ? OperationType.UPDATE : OperationType.CREATE, editingUser ? `users/${editingUser.id}` : 'users');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.academic_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">{t('systemAdministration')}</h1>
          <p className="text-gray-500 font-medium">{t('manageUsersLogsConfig')}</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
          {[
            { id: 'users', label: t('users'), icon: Users },
            { id: 'logs', label: t('auditTrail'), icon: History },
            { id: 'settings', label: t('settings'), icon: SettingsIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
        {activeTab === 'users' && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder={t('searchUsers')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                />
              </div>
              <button 
                onClick={() => setShowAddUser(true)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <UserPlus size={18} />
                <span>{t('addUser')}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-50">
                    <th className="pb-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t('user')}</th>
                    <th className="pb-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t('role')}</th>
                    <th className="pb-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t('department')}</th>
                    <th className="pb-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                            {u.displayName?.charAt(0) || u.email?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{u.displayName || 'Unnamed User'}</p>
                            <p className="text-xs text-gray-400 font-medium">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <select 
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as any)}
                          className={cn(
                            "text-xs font-bold px-3 py-1.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-indigo-500",
                            u.role === 'admin' ? "bg-red-50 text-red-600" :
                            u.role === 'staff' ? "bg-blue-50 text-blue-600" :
                            "bg-green-50 text-green-600"
                          )}
                        >
                          <option value="admin">{t('admin')}</option>
                          <option value="staff">{t('staff')}</option>
                          <option value="student">{t('student')}</option>
                        </select>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-500 font-medium">{u.department || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingUser(u)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-gray-100"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-gray-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{t('auditTrail')}</h3>
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <History size={14} />
                <span>{t('last100Transactions')}</span>
              </div>
            </div>

            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-100 transition-all">
                  <div className={cn(
                    "p-2 rounded-xl text-white",
                    log.action.includes('DELETE') ? "bg-red-500" :
                    log.action.includes('UPDATE') ? "bg-blue-500" :
                    "bg-green-500"
                  )}>
                    <Activity size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900">
                        {log.userName} <span className="text-gray-400 font-medium">performed</span> {log.action}
                      </p>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium italic">
                      Resource: {log.resource} • {log.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && settings && (
          <form onSubmit={handleSaveSettings} className="p-8 max-w-2xl space-y-8">
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-indigo-600 mb-2">
                <Key size={20} />
                <h3 className="font-bold">{t('aiApiConfig')}</h3>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('geminiApiKey')}</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="password"
                    value={settings.aiApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    placeholder={t('aiApiKeyPlaceholder')}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">{t('aiApiKeyDesc')}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-indigo-600 mb-2">
                <Globe size={20} />
                <h3 className="font-bold">{t('localizationLanguage')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultLanguage: 'EN' })}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-2xl border-2 transition-all",
                    settings.defaultLanguage === 'EN' ? "border-indigo-600 bg-indigo-50" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <span className="text-lg font-bold text-gray-900">{t('english')}</span>
                  <span className="text-xs text-gray-400 font-medium">{t('defaultLTR')}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultLanguage: 'AR' })}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-2xl border-2 transition-all",
                    settings.defaultLanguage === 'AR' ? "border-indigo-600 bg-indigo-50" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <span className="text-lg font-bold text-gray-900">{t('arabic')}</span>
                  <span className="text-xs text-gray-400 font-medium">{t('defaultRTL')}</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-indigo-600 mb-2">
                <Database size={20} />
                <h3 className="font-bold">{t('dataMaintenanceBackup')}</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('backupFrequency')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Daily', 'Weekly', 'Monthly'].map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setSettings({ ...settings, backupFrequency: freq as any })}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-bold border-2 transition-all",
                          settings.backupFrequency === freq ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        {freq === 'Daily' ? t('daily') : freq === 'Weekly' ? t('weekly') : t('monthly')}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-50">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">{t('databaseInitialization')}</label>
                  <button
                    type="button"
                    onClick={handleSeedDatabase}
                    disabled={seeding}
                    className="flex items-center space-x-2 px-6 py-3 bg-amber-50 text-amber-700 rounded-2xl font-bold hover:bg-amber-100 transition-all border border-amber-200 disabled:opacity-50"
                  >
                    {seeding ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    <span>{t('seedDatabase')}</span>
                  </button>
                  <p className="text-[10px] text-gray-400 font-medium mt-2">{t('seedDatabaseDesc')}</p>
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-start space-x-3">
                <AlertTriangle className="text-orange-500 shrink-0" size={18} />
                <div>
                  <p className="text-xs font-bold text-orange-700">{t('automatedBackupProtocol')}</p>
                  <p className="text-[10px] text-orange-600 font-medium">{t('automatedBackupDesc')}</p>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{t('savingChanges')}</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{t('saveChanges')}</span>
                </>
              )}
            </button>

            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center justify-center space-x-2 text-green-600 font-bold text-sm mt-4"
                >
                  <CheckCircle2 size={18} />
                  <span>{t('settingsPersisted')}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <AnimatePresence>
        {(showAddUser || editingUser) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                <button onClick={() => { setShowAddUser(false); setEditingUser(null); }} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text"
                    value={editingUser ? editingUser.displayName : newUser.displayName}
                    onChange={(e) => editingUser 
                      ? setEditingUser({ ...editingUser, displayName: e.target.value })
                      : setNewUser({ ...newUser, displayName: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email"
                    value={editingUser ? editingUser.email : newUser.email}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, email: e.target.value })
                      : setNewUser({ ...newUser, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Department</label>
                  <input 
                    type="text"
                    value={editingUser ? (editingUser.department || '') : newUser.department}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, department: e.target.value })
                      : setNewUser({ ...newUser, department: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    placeholder="Computer Science"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Academic ID</label>
                  <input 
                    type="text"
                    value={editingUser ? (editingUser.academic_id || '') : newUser.academic_id}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, academic_id: e.target.value })
                      : setNewUser({ ...newUser, academic_id: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    placeholder="2024-001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">System Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['admin', 'staff', 'student'].map((r) => (
                      <button
                        key={r}
                        onClick={() => editingUser
                          ? setEditingUser({ ...editingUser, role: r as any })
                          : setNewUser({ ...newUser, role: r as any })
                        }
                        className={cn(
                          "py-2 rounded-xl text-[10px] font-bold border-2 transition-all uppercase tracking-widest",
                          (editingUser ? editingUser.role : newUser.role) === r ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start space-x-3">
                <Shield className="text-blue-500 shrink-0" size={18} />
                <p className="text-[10px] text-blue-600 font-medium">
                  {editingUser 
                    ? "Updating user details will take effect immediately across the system."
                    : "Users added here will be granted system access upon their first login with the specified email."}
                </p>
              </div>

              <button 
                onClick={handleSaveUser}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                {editingUser ? 'Update User Account' : 'Create User Account'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
