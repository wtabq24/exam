import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  LogOut, 
  Database, 
  Search, 
  Bell,
  User as UserIcon,
  Menu,
  X,
  GraduationCap,
  School,
  BarChart3,
  Settings,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { auth, signOut } from '../firebase';
import { cn } from '../lib/utils';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isStaff, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([
    { id: 1, title: 'New Exam Uploaded', message: 'Math 101 exam paper has been archived.', time: '2 mins ago', read: false },
    { id: 2, title: 'Grade Verification', message: 'Your recent grade upload is pending review.', time: '1 hour ago', read: false },
    { id: 3, title: 'System Update', message: 'Intelligent Archiving v2.0 is now live.', time: '5 hours ago', read: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Clear all local state
      localStorage.clear();
      sessionStorage.clear();
      // Explicit redirect to ensure clean state reset
      window.location.href = '/login';
    } catch (error) {
      console.error("Logout failed:", error);
      // Fallback redirect
      window.location.href = '/login';
    }
  };

  const navItems = [
    { label: t('dashboard'), path: '/', icon: LayoutDashboard, show: true },
    { label: t('archiveHub'), path: '/archive', icon: Database, show: isStaff || isAdmin },
    { label: t('erpManagement'), path: '/erp', icon: School, show: isStaff || isAdmin },
    { label: t('analytics'), path: '/analytics', icon: BarChart3, show: isStaff || isAdmin },
    { label: t('systemSettings'), path: '/settings', icon: Settings, show: isAdmin },
    { label: t('examBank'), path: '/exams', icon: FileText, show: true },
    { label: t('uploadExam'), path: '/upload', icon: Upload, show: isStaff || isAdmin },
    { label: t('grades'), path: '/grades', icon: GraduationCap, show: true },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col sticky top-0 h-screen transition-colors duration-300">
        <div className="p-8 flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <Database size={24} />
          </div>
          <span className="font-black text-xl tracking-tight text-gray-900 dark:text-white">Archivio</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.filter(item => item.show).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold transition-all",
                location.pathname === item.path 
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-50 dark:border-gray-800">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl mb-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="bg-white dark:bg-gray-700 p-2 rounded-xl shadow-sm">
                <UserIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.displayName}</p>
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 text-red-500 hover:text-red-600 font-bold text-sm py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <LogOut size={16} />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300">
        {/* Header */}
        <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 px-4 lg:px-8 flex items-center justify-between transition-colors duration-300">
          <button 
            className="lg:hidden p-2 text-gray-500 dark:text-gray-400"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input 
                placeholder={t('quickSearch')} 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-xl transition-all shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all relative",
                  isNotificationsOpen ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-800"
                )}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                      <h3 className="font-black text-gray-900 dark:text-white">{t('notifications')}</h3>
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:text-indigo-700 dark:hover:text-indigo-300"
                      >
                        {t('markAllRead')}
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={cn(
                              "p-4 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer",
                              !n.read && "bg-indigo-50/30 dark:bg-indigo-900/10"
                            )}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{n.title}</p>
                              <span className="text-[10px] text-gray-400">{n.time}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" />
                          <p className="text-sm text-gray-400 uppercase tracking-widest">{t('noNotifications')}</p>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 text-center">
                      <button className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        {t('viewAllNotifications')}
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
            <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-800"></div>
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{user?.displayName}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{user?.department || t('general')}</p>
              </div>
              <img 
                src={`https://ui-avatars.com/api/?name=${user?.displayName}&background=6366f1&color=fff`} 
                className="w-10 h-10 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
                alt="avatar"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8 flex-1">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <motion.aside 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-gray-900 flex flex-col transition-colors duration-300"
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white">
                  <Database size={24} />
                </div>
                <span className="font-black text-xl tracking-tight text-gray-900 dark:text-white">Archivio</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X size={24} className="text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 px-4 space-y-2">
              {navItems.filter(item => item.show).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold transition-all",
                    location.pathname === item.path 
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </motion.aside>
        </div>
      )}
    </div>
  );
};

export default Layout;
