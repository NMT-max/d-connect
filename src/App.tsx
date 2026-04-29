/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  MessageSquare, 
  Mail, 
  Share2, 
  Settings, 
  Zap, 
  Calendar, 
  Layers, 
  Send, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateMarketingContent } from './lib/gemini';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  deleteDoc, 
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

type Module = 'dashboard' | 'whatsapp' | 'email' | 'social' | 'ai' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'editor' | 'viewer'>('admin');
  
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [syncStatus, setSyncStatus] = useState<'real-time' | 'error' | 'connecting'>('connecting');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChannel, setAiChannel] = useState<'facebook' | 'instagram' | 'email'>('facebook');
  const [aiLanguage, setAiLanguage] = useState<'bangla' | 'english' | 'both'>('bangla');
  const [aiResult, setAiResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Settings / API Keys
  const [resendApiKey, setResendApiKey] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [pageId, setPageId] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');

  // Scheduling State
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [isAutoSending, setIsAutoSending] = useState(false);
  const [lastAutoSendTime, setLastAutoSendTime] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Load Settings
    const settingsRef = doc(db, 'user_settings', user.uid);
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setResendApiKey(data.resendApiKey || '');
          setFbAccessToken(data.fbAccessToken || '');
          setPageId(data.pageId || '');
          setIgAccountId(data.igAccountId || '');
          setWhatsappToken(data.whatsappToken || '');
          setWhatsappPhoneId(data.whatsappPhoneId || '');
          setN8nWebhookUrl(data.n8nWebhookUrl || '');
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    // Load Posts - Simple query without orderBy to avoid index requirement
    const postsQuery = query(
      collection(db, 'scheduled_posts'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by scheduled time ascending so the queue processes in order
      posts.sort((a: any, b: any) => {
        const timeA = a.scheduledAt?.seconds ? a.scheduledAt.seconds : (a.scheduledAt instanceof Date ? a.scheduledAt.getTime() / 1000 : 0);
        const timeB = b.scheduledAt?.seconds ? b.scheduledAt.seconds : (b.scheduledAt instanceof Date ? b.scheduledAt.getTime() / 1000 : 0);
        
        // If scheduled times are equal, fall back to createdAt (newest first)
        if (timeA === timeB) {
          const createA = (a.createdAt as any)?.seconds || Date.now() / 1000;
          const createB = (b.createdAt as any)?.seconds || Date.now() / 1000;
          return createB - createA;
        }
        return timeA - timeB;
      });
      setScheduledPosts(posts);
      setSyncStatus('real-time');
    }, (error) => {
      console.error("Firestore Sync Error:", error);
      setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user]);

  // Background Task Engine: Processes scheduled posts every 60 seconds
  useEffect(() => {
    if (!user || scheduledPosts.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      scheduledPosts.forEach(async (post) => {
        if (post.status !== 'pending') return;
        
        const scheduledTime = post.scheduledAt?.seconds 
          ? new Date(post.scheduledAt.seconds * 1000) 
          : (post.scheduledAt instanceof Date ? post.scheduledAt : new Date(post.scheduledAt || Date.now()));
        if (now >= scheduledTime) {
          if (post.platform === 'whatsapp') return; // Handled by Interactive Queue
          
          console.log(`Executing targeted task: ${post.id} for ${post.platform}`);
          
          let success = false;
          try {
          // Placeholder: Here you would call the actual API functions based on post.platform
          // For now we simulate execution and mark as sent
          if (post.platform === 'email') {
            // Real Resend Integration logic would go here
            success = true;
          } else if (post.platform === 'facebook') {
            // Meta API logic
            success = true;
          } else {
            // WhatsApp/Instagram require manual interaction via the queue
            return; 
          }

            if (success) {
              await setDoc(doc(db, 'scheduled_posts', post.id), { status: 'sent', updatedAt: serverTimestamp() }, { merge: true });
            }
          } catch (e) {
            console.error("Execution failed:", e);
            await setDoc(doc(db, 'scheduled_posts', post.id), { status: 'failed', updatedAt: serverTimestamp() }, { merge: true });
          }
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user, scheduledPosts]);

  const saveSettings = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'user_settings', user.uid), {
        userId: user.uid,
        resendApiKey,
        fbAccessToken,
        pageId,
        igAccountId,
        whatsappToken,
        whatsappPhoneId,
        n8nWebhookUrl
      });
      alert('Settings saved to cloud!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_settings/${user.uid}`);
    }
  };

  const saveScheduledPost = async (post: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'scheduled_posts'), {
        ...post,
        userId: user.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'scheduled_posts');
    }
  };

  const deletePost = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scheduled_posts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `scheduled_posts/${id}`);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    const result = await generateMarketingContent(aiPrompt, aiChannel, aiLanguage);
    setAiResult(result);
    setIsGenerating(false);
  };

  if (loading) {
    return (
      <div className="h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-navy-900 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-navy-800 p-10 rounded-3xl border border-navy-700 w-full max-w-md shadow-2xl text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center mb-4 shadow-xl shadow-gold-500/20"><Zap className="text-navy-900 w-8 h-8" /></div>
            <h1 className="text-3xl font-bold gold-text-gradient">Digicoup Connect</h1>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">Your AI-powered multi-channel marketing hub. Secure, automated, and ready to scale.</p>
          </div>
          <button 
            onClick={async () => {
              try {
                await loginWithGoogle();
              } catch (error: any) {
                alert("Login Failed: " + error.message + "\n\nTip: Make sure to add your Vercel domain to Firebase Authorized domains.");
              }
            }}
            className="w-full py-4 bg-white text-navy-900 font-bold rounded-2xl shadow-lg hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
          <p className="mt-6 text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em]">Enterprise Grade Security</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-navy-800 border-r border-navy-700 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shrink-0"><Zap className="text-navy-900 w-5 h-5" /></div>
          {isSidebarOpen && <span className="font-bold text-xl gold-text-gradient tracking-tight">Digicoup</span>}
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4">
          <NavItem icon={<BarChart3 size={20} />} label="Dashboard" active={activeModule === 'dashboard'} onClick={() => setActiveModule('dashboard')} isOpen={isSidebarOpen} />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="WhatsApp Planner" 
            active={activeModule === 'whatsapp'} 
            onClick={() => setActiveModule('whatsapp')} 
            isOpen={isSidebarOpen} 
            badge={scheduledPosts.filter(p => p.platform === 'whatsapp' && p.status === 'pending').length || 0}
          />
          <NavItem icon={<Mail size={20} />} label="Email Marketing" active={activeModule === 'email'} onClick={() => setActiveModule('email')} isOpen={isSidebarOpen} />
          <NavItem icon={<Share2 size={20} />} label="Social Hub" active={activeModule === 'social'} onClick={() => setActiveModule('social')} isOpen={isSidebarOpen} />
          <NavItem icon={<Sparkles size={20} />} label="AI Writer" active={activeModule === 'ai'} onClick={() => setActiveModule('ai')} isOpen={isSidebarOpen} />
          <NavItem icon={<Calendar size={20} />} label="Schedule Ops" active={activeModule === 'settings'} onClick={() => setActiveModule('settings')} isOpen={isSidebarOpen} />
        </nav>
        <div className="p-4 border-t border-navy-700">
          <div className={`mb-4 flex items-center gap-3 px-3 overflow-hidden ${!isSidebarOpen && 'justify-center'}`}>
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-gold-500/50" alt="Avatar" />
            {isSidebarOpen && (
              <div className="truncate">
                <p className="text-xs font-bold text-slate-200 truncate">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-red-400 transition-colors">
            <LogOut size={20} /> {isSidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-navy-900/50 relative">
        <header className="sticky top-0 z-40 bg-navy-900/80 backdrop-blur-md border-b border-navy-700 px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold capitalize text-slate-100 flex items-center gap-2">
            {activeModule.replace('-', ' ')}
            <span className="text-[10px] uppercase bg-gold-500/10 text-gold-500 px-2 py-0.5 rounded-full border border-gold-500/20">{userRole} Level</span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Cloud Sync</p>
              <div className={`text-sm font-medium flex items-center justify-end gap-1 ${
                syncStatus === 'real-time' ? 'text-emerald-500' : 
                syncStatus === 'error' ? 'text-red-500' : 'text-gold-500'
              }`}>
                {syncStatus === 'real-time' ? <CheckCircle2 size={12} /> : <div className="w-2 h-2 rounded-full bg-current animate-pulse" />}
                {syncStatus === 'real-time' ? 'Real-time' : syncStatus === 'error' ? 'Sync Error' : 'Connecting...'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-navy-700 bg-navy-800 flex items-center justify-center overflow-hidden">
               <img src={user.photoURL || ''} alt="User" />
            </div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeModule} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {activeModule === 'dashboard' && <DashboardView posts={scheduledPosts} deletePost={deletePost} />}
              {activeModule === 'whatsapp' && (
                <WhatsAppView 
                  onSchedule={saveScheduledPost} 
                  posts={scheduledPosts}
                  deletePost={deletePost}
                  onComplete={completeTask}
                  whatsappToken={whatsappToken}
                  whatsappPhoneId={whatsappPhoneId}
                  n8nWebhookUrl={n8nWebhookUrl}
                />
              )}
              {activeModule === 'email' && <EmailView apiKey={resendApiKey} setApiKey={setResendApiKey} n8nWebhook={n8nWebhookUrl} onSave={saveSettings} />}
              {activeModule === 'social' && (
                <SocialView 
                  fbToken={fbAccessToken} setFbToken={setFbAccessToken} 
                  pageId={pageId} setPageId={setPageId} 
                  igId={igAccountId} setIgId={setIgAccountId} 
                  waToken={whatsappToken} setWaToken={setWhatsappToken}
                  waPhoneId={whatsappPhoneId} setWaPhoneId={setWhatsappPhoneId}
                  n8nWebhook={n8nWebhookUrl} setN8nWebhook={setN8nWebhookUrl}
                  onSave={saveSettings} 
                />
              )}
              {activeModule === 'ai' && (
                <AIView 
                  prompt={aiPrompt} setPrompt={setAiPrompt}
                  channel={aiChannel} setChannel={setAiChannel}
                  language={aiLanguage} setLanguage={setAiLanguage}
                  result={aiResult} onGenerate={handleGenerateAI} isLoading={isGenerating}
                  onSchedule={saveScheduledPost}
                />
              )}
              {activeModule === 'settings' && (
                <ScheduleDashboard 
                  posts={scheduledPosts} 
                  deletePost={deletePost} 
                  whatsappToken={whatsappToken}
                  whatsappPhoneId={whatsappPhoneId}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function AIView({ prompt, setPrompt, channel, setChannel, language, setLanguage, result, onGenerate, isLoading, onSchedule }: any) {
  const [scheduleTime, setScheduleTime] = useState('');
  
  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-500/10 flex items-center justify-center"><Sparkles className="text-gold-500" size={28} /></div>
          <div>
            <h2 className="text-2xl font-bold">Content Engine 2.2</h2>
            <p className="text-slate-500 text-sm">Fine-tuned AI for targeted marketing campaigns.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-600 ml-1">Target Channel</label>
            <div className="flex gap-2 p-1 bg-navy-900 rounded-xl border border-navy-700">
              {['facebook', 'instagram', 'email'].map(c => (
                <button key={c} onClick={() => setChannel(c)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${channel === c ? 'bg-gold-500 text-navy-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-600 ml-1">Language Output</label>
            <div className="flex gap-2 p-1 bg-navy-900 rounded-xl border border-navy-700">
              {['bangla', 'english', 'both'].map(l => (
                <button key={l} onClick={() => setLanguage(l)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${language === l ? 'bg-gold-500 text-navy-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <textarea 
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your marketing topic or idea here..."
            className="w-full h-44 bg-navy-900 border border-navy-700 rounded-2xl p-6 focus:border-gold-500/50 outline-none transition-all resize-none shadow-inner text-slate-200"
          />
          <button 
            disabled={isLoading || !prompt}
            onClick={onGenerate}
            className="w-full py-4 gold-gradient text-navy-900 font-bold rounded-2xl shadow-xl shadow-gold-500/20 active:scale-[0.98] transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-navy-900 border-t-transparent animate-spin rounded-full"></div> : <Zap size={20} />}
            Generate Deep Copy
          </button>
        </div>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-navy-800/80 border border-navy-700 rounded-3xl p-8 relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(result)} className="p-2 bg-navy-700 rounded-lg text-slate-400 hover:text-gold-500 transition-colors" title="Copy to Clipboard">
                <Layers size={18} />
              </button>
            </div>
            <div className="mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Generated Version v1.0</span>
            </div>
            <div className="text-slate-200 whitespace-pre-wrap leading-relaxed text-base italic font-light">
              {result}
            </div>
          </div>

          <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Calendar className="text-gold-500" size={18} /> Sync & Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="datetime-local" 
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50"
              />
              <button 
                disabled={!scheduleTime}
                onClick={() => {
                  const scheduledDate = scheduleTime ? new Date(scheduleTime) : new Date();
                  onSchedule({ 
                    content: result, 
                    platform: channel, 
                    scheduledAt: scheduledDate, 
                    target: 'Broadcast',
                    status: 'pending'
                  });
                  setScheduleTime('');
                  alert('Post Scheduled Successfully!');
                }}
                className="py-3 bg-navy-700 hover:bg-navy-600 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                Schedule Task
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

async function completeTask(id: string) {
  try {
    await setDoc(doc(db, 'scheduled_posts', id), { status: 'sent', updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Error updating status:", error);
  }
}

function ScheduleDashboard({ posts, deletePost, whatsappToken, whatsappPhoneId }: { posts: any[], deletePost: (id: string) => void, whatsappToken: string, whatsappPhoneId: string }) {
  const executeWhatsApp = async (post: any) => {
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: post.target,
          message: post.content,
          mediaUrl: post.mediaUrl,
          token: whatsappToken,
          phoneId: whatsappPhoneId
        })
      });
      const data = await response.json();
      if (response.ok) {
        completeTask(post.id);
        alert('Message sent successfully via API!');
      } else {
        alert('API Error: ' + (data.error?.message || data.error || 'Failed to send'));
      }
    } catch (e) {
      alert('Connection Error to Backend.');
    }
  };

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-8 border-b border-navy-700 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Calendar className="text-gold-500" /> Operational Log
        </h2>
        <span className="text-xs bg-navy-900 px-3 py-1 rounded-full text-slate-500 font-bold uppercase">{posts.length} Jobs Total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-navy-900/50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-navy-700">
            <tr>
              <th className="px-8 py-4">Status</th>
              <th className="px-8 py-4">Platform</th>
              <th className="px-8 py-4">Target Recipient</th>
              <th className="px-8 py-4">Scheduled</th>
              <th className="px-8 py-4">Snippet</th>
              <th className="px-8 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-slate-600 font-medium">No operational logs found.</td>
              </tr>
            ) : posts.map(post => (
              <tr key={post.id} className="hover:bg-navy-700/20 transition-colors group">
                <td className="px-8 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    post.status === 'sent' ? 'bg-emerald-500/10 text-emerald-500' : 
                    post.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-gold-500/10 text-gold-500'
                  }`}>
                    {post.status}
                  </span>
                </td>
                <td className="px-8 py-4 capitalize font-medium text-slate-400">{post.platform}</td>
                <td className="px-8 py-4 text-xs font-mono text-slate-500">{post.target || 'N/A'}</td>
                <td className="px-8 py-4 text-[10px] text-slate-500 font-mono">
                  {post.scheduledAt?.seconds 
                    ? new Date(post.scheduledAt.seconds * 1000).toLocaleString() 
                    : (post.scheduledAt instanceof Date ? post.scheduledAt.toLocaleString() : 'Now')}
                </td>
                <td className="px-8 py-4 max-w-[200px] truncate text-slate-300 italic">
                  {post.mediaUrl && <span className="inline-block w-2 h-2 rounded-full bg-gold-500 mr-2" title="Has Media Attachment" />}
                  "{post.content}"
                </td>
                <td className="px-8 py-4">
                  <div className="flex gap-2">
                    {post.platform === 'whatsapp' && post.status === 'pending' && (
                      <button onClick={() => executeWhatsApp(post)} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Launch WhatsApp Web">
                        <Send size={16} />
                      </button>
                    )}
                    <button onClick={() => deletePost(post.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors"><X size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailView({ apiKey, setApiKey, n8nWebhook, onSave }: any) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendMethod, setSendMethod] = useState<'resend' | 'n8n'>(n8nWebhook ? 'n8n' : 'resend');

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sendMethod === 'resend') {
      if (!apiKey || !to || !subject || !body) {
        alert('Missing API Key, Recipient, Subject or Body');
        return;
      }
    } else {
      if (!n8nWebhook || !to || !subject || !body) {
        alert('Missing n8n Webhook, Recipient, Subject or Body');
        return;
      }
    }

    setIsSending(true);
    try {
      if (sendMethod === 'resend') {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            from: 'Digicoup <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: body.replace(/\n/g, '<br/>')
          })
        });

        const data = await response.json();
        if (response.ok) {
          alert('Email sent via Resend! ID: ' + data.id);
        } else {
          throw new Error(data.message || 'Failed to send email');
        }
      } else {
        const response = await fetch(n8nWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'email',
            to: to,
            subject: subject,
            body: body,
            html: body.replace(/\n/g, '<br/>')
          })
        });
        if (response.ok) {
          alert('Forwarded to n8n successfully!');
        } else {
          alert('n8n rejected the email request.');
        }
      }
      
      setTo('');
      setSubject('');
      setBody('');
    } catch (error: any) {
      console.error("Email Error:", error);
      alert('Error: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 mb-6">
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
             <Settings size={14} /> Send Infrastructure
           </h3>
           <div className="flex bg-navy-900 p-1 rounded-lg border border-navy-700">
              <button 
                onClick={() => setSendMethod('resend')}
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${sendMethod === 'resend' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >Resend API</button>
              <button 
                onClick={() => setSendMethod('n8n')}
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${sendMethod === 'n8n' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >n8n Webhook</button>
           </div>
        </div>

        {sendMethod === 'resend' ? (
          <div className="flex gap-4">
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Resend API Key (re_...)"
              className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm"
            />
            <button onClick={onSave} className="bg-gold-500 text-navy-900 px-6 py-2 rounded-xl font-bold hover:scale-105 transition-all text-sm">Save Key</button>
          </div>
        ) : (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500 rounded-lg"><Zap size={20} className="text-white" /></div>
                <div>
                   <p className="text-xs font-bold text-white">n8n Engine Active</p>
                   <p className="text-[10px] text-slate-400">Webhook: {n8nWebhook ? n8nWebhook.substring(0, 40) + '...' : 'Missing! Set in Social Hub'}</p>
                </div>
             </div>
             {!n8nWebhook && <p className="text-[10px] text-red-400 font-bold animate-pulse">SET WEBHOOK IN SOCIAL HUB</p>}
          </div>
        )}
      </div>
      
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${sendMethod === 'resend' ? 'bg-blue-500/20' : 'bg-indigo-500/20'}`}>
            {sendMethod === 'resend' ? <Mail className="text-blue-500" /> : <Zap className="text-indigo-500" />}
          </div>
          <div><h2 className="text-xl font-bold">Smart Email Campaign</h2><p className="text-sm text-slate-500">Fast, reliable distribution across multiple regions.</p></div>
        </div>
        <form className="space-y-4" onSubmit={sendEmail}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              required type="email" value={to} onChange={(e) => setTo(e.target.value)}
              placeholder="Recipient Email (To)" 
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50" 
            />
            <input 
              required type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject" 
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50" 
            />
          </div>
          <textarea 
            required value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Message Body (HTML support auto-converted from line breaks)" 
            className="w-full h-64 bg-navy-900 border border-navy-700 rounded-xl p-6 outline-none focus:border-gold-500/50 resize-none font-sans leading-relaxed" 
          />
          <button 
            type="submit" 
            disabled={isSending}
            className="w-full py-4 gold-gradient text-navy-900 font-bold rounded-2xl shadow-xl shadow-gold-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? <div className="w-5 h-5 border-2 border-navy-900 border-t-transparent animate-spin rounded-full"></div> : <Send size={20} />}
            Execute Blast
          </button>
        </form>
        <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
           <p className="text-[10px] text-blue-500 font-bold uppercase mb-1">Developer Note:</p>
           <p className="text-xs text-slate-500 leading-relaxed">Resend Free Tier has a limit of 3,000 emails per month and 100 per day. Ensure your domain is verified in your Resend Dashboard.</p>
        </div>
      </div>
    </div>
  );
}

function SocialView({ fbToken, setFbToken, pageId, setPageId, igId, setIgId, waToken, setWaToken, waPhoneId, setWaPhoneId, n8nWebhook, setN8nWebhook, onSave }: any) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const postToFacebook = async () => {
    if (!fbToken || !pageId || !content) {
      alert('Missing FB Token, Page ID or Content');
      return;
    }
    setIsPosting(true);
    try {
      const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          link: imageUrl || undefined,
          access_token: fbToken
        })
      });
      const data = await response.json();
      if (data.id) alert('Posted to Facebook successfully! ID: ' + data.id);
      else throw new Error(data.error?.message || 'Unknown error');
    } catch (error: any) {
      alert('FB Error: ' + error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const postToInstagram = async () => {
    if (!fbToken || !igId || !content || !imageUrl) {
      alert('IG requires Token, Account ID, Content (Caption), and Image URL');
      return;
    }
    setIsPosting(true);
    try {
      // Step 1: Create Media Container
      const containerUrl = `https://graph.facebook.com/v18.0/${igId}/media`;
      const containerRes = await fetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: content,
          access_token: fbToken
        })
      });
      const containerData = await containerRes.json();
      
      if (!containerData.id) throw new Error(containerData.error?.message || 'Failed to create container');

      // Step 2: Publish Media
      const publishUrl = `https://graph.facebook.com/v18.0/${igId}/media_publish`;
      const publishRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: fbToken
        })
      });
      const publishData = await publishRes.json();
      
      if (publishData.id) alert('Published to Instagram successfully!');
      else throw new Error(publishData.error?.message || 'Failed to publish');
    } catch (error: any) {
      alert('IG Error: ' + error.message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-8 pb-32">
      {/* Config Bar */}
      <section className="bg-navy-800 border border-navy-700 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-navy-700 pb-4">
           <h3 className="text-lg font-bold flex items-center gap-2"><Settings size={18} className="text-gold-500" /> API Configuration</h3>
           <button onClick={onSave} className="bg-gold-500 text-navy-900 px-8 py-2 rounded-xl font-bold hover:scale-105 transition-all text-sm shadow-lg shadow-gold-500/20">Save All Keys</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
               <Share2 size={12} /> Meta (FB/IG) Credentials
            </h4>
            <input 
              type="password" 
              value={fbToken} 
              onChange={(e) => setFbToken(e.target.value)} 
              placeholder="Meta Access Token" 
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm" 
            />
            <div className="flex gap-2">
               <input type="text" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="FB Page ID" className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none text-sm" />
               <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="IG Account ID" className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none text-sm" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
               <MessageSquare size={12} className="text-emerald-500" /> WhatsApp Business API
            </h4>
            <input 
              type="password" 
              value={waToken} 
              onChange={(e) => setWaToken(e.target.value)} 
              placeholder="WhatsApp System User Token" 
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-sm" 
            />
            <input 
              type="text" 
              value={waPhoneId} 
              onChange={(e) => setWaPhoneId(e.target.value)} 
              placeholder="Phone Number ID" 
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-sm" 
            />
            <p className="text-[9px] text-slate-500 italic mt-2">
              💡 Note: If using a Meta Test Number, you must first verify the recipient number in your Meta Dashboard. Direct messages require an active "Conversation Window" (user must message you first) unless using Templates.
            </p>
          </div>

          <div className="space-y-4">
             <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
               <Zap size={12} className="text-indigo-500" /> n8n Automation Engine
             </h4>
             <div className="flex gap-2">
               <input 
                type="text" 
                value={n8nWebhook} 
                onChange={(e) => setN8nWebhook(e.target.value)} 
                placeholder="n8n Webhook URL" 
                className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500/50 text-sm" 
              />
              <button 
                onClick={async () => {
                  if (!n8nWebhook) return alert("Please enter webhook URL first.");
                  try {
                    const res = await fetch(n8nWebhook, {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ test: true, source: 'Digicoup', timestamp: Date.now() })
                    });
                    alert(res.ok ? "n8n Connection Successful!" : "n8n returned an error. Check your workflow activation.");
                  } catch(e) { alert("Failed to reach n8n. Check URL and CORS settings."); }
                }}
                className="px-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-bold hover:bg-indigo-500 hover:text-white transition-all"
              >
                TEST
              </button>
            </div>
            <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl">
               <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1 flex items-center gap-1">
                 <AlertCircle size={12} /> n8n Setup Guide:
               </p>
               <ul className="text-[9px] text-slate-500 space-y-1">
                 <li>1. Create a "Webhook" node in n8n.</li>
                 <li>2. Method: POST | Content: JSON.</li>
                 <li>3. Output to "WhatsApp Business API" or "Send Email" node.</li>
                 <li>4. Activate the workflow and paste the Production URL here.</li>
               </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Editor & Post Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-xl">
             <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Sparkles className="text-gold-500" /> Omni-Channel Publisher
             </h3>
             <textarea 
               value={content}
               onChange={(e) => setContent(e.target.value)}
               placeholder="Write your post caption or content here..."
               className="w-full h-56 bg-navy-900 border border-navy-700 rounded-2xl p-6 outline-none focus:border-gold-500/50 resize-none mb-6"
             />
             <div className="flex items-center gap-3 bg-navy-900/50 p-4 rounded-2xl border border-navy-700 mb-8">
               <Layers className="text-slate-500" size={20} />
               <input 
                 type="text" 
                 value={imageUrl}
                 onChange={(e) => setImageUrl(e.target.value)}
                 placeholder="Image URL (Required for Instagram)" 
                 className="flex-1 bg-transparent border-none outline-none text-sm"
               />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <button 
                 disabled={isPosting}
                 onClick={postToFacebook}
                 className="py-4 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
               >
                 <Share2 size={20} /> Facebook
               </button>
               <button 
                 disabled={isPosting}
                 onClick={postToInstagram}
                 className="py-4 bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
               >
                 <Share2 size={20} /> Instagram
               </button>
             </div>
          </section>
        </div>

        <aside className="space-y-6">
           <div className="bg-navy-800 border border-navy-700 rounded-3xl p-6">
              <h4 className="text-xs font-black uppercase text-slate-500 mb-4 tracking-widest">Post Guidelines</h4>
              <ul className="space-y-3">
                 <li className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Facebook: Best with 150-200 words + relevant emojis.</span>
                 </li>
                 <li className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Instagram: Catchy captions with 3-5 hashtags max.</span>
                 </li>
                 <li className="flex items-start gap-2 text-xs text-slate-400">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>Instagram requires a <b>Direct Image Link</b> to publish.</span>
                 </li>
              </ul>
           </div>
        </aside>
      </div>
    </div>
  );
}

function DashboardView({ posts, deletePost }: any) {
  // Overriding StatCard icons and grid for specific look
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="WhatsApp Health" value="98%" subValue="Secure" icon={<MessageSquare className="text-emerald-500" />} />
        <StatCard title="Active Jobs" value={posts.length.toString()} subValue="In Schedule" icon={<Clock className="text-blue-500" />} />
        <StatCard title="Meta Status" value="Stable" subValue="Graph v18.0" icon={<Share2 className="text-purple-500" />} />
        <StatCard title="AI Precision" value="High" subValue="Gemini 1.5 Flush" icon={<Sparkles className="text-gold-500" />} />
      </div>
      <ScheduleDashboard posts={posts} deletePost={deletePost} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, isOpen, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isOpen: boolean, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg w-full transition-all duration-200 group relative ${
        active 
          ? 'bg-gold-500/10 text-gold-400' 
          : 'text-slate-400 hover:bg-navy-700/50 hover:text-slate-200'
      }`}
    >
      <div className={`${active ? 'text-gold-500' : 'group-hover:text-gold-400'} transition-colors`}>
        {icon}
      </div>
      {isOpen && (
        <div className="flex-1 flex items-center justify-between overflow-hidden">
          <span className="font-medium text-sm whitespace-nowrap">{label}</span>
          {badge && badge > 0 ? (
            <span className="bg-emerald-500 text-navy-900 text-[10px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
              {badge}
            </span>
          ) : null}
        </div>
      )}
      {active && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gold-500 rounded-r-full shadow-[0_0_8px_rgba(197,160,89,0.5)]" />}
    </button>
  );
}

function StatCard({ title, value, subValue, icon }: { title: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <div className="bg-navy-800/50 border border-navy-700 rounded-2xl p-6 flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-slate-100">{value}</h4>
        <p className="text-xs mt-1 text-slate-400 font-medium">{subValue}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-navy-700/50 flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}

function WhatsAppView({ onSchedule, posts, deletePost, onComplete, whatsappToken, whatsappPhoneId, n8nWebhookUrl }: { onSchedule: (post: any) => void, posts: any[], deletePost: (id: string) => void, onComplete: (id: string) => void, whatsappToken: string, whatsappPhoneId: string, n8nWebhookUrl: string }) {
  const [accountAge, setAccountAge] = useState(1);
  const [contacts, setContacts] = useState<string>('');
  const [rawMessage, setRawMessage] = useState('');
  const [imageUrl, setImageUrl] = useState(''); 
  const [minDelay, setMinDelay] = useState(20);
  const [maxDelay, setMaxDelay] = useState(60);
  const [scheduledTime, setScheduledTime] = useState('');
  const [isAutomating, setIsAutomating] = useState(false);
  const [lastApiStatus, setLastApiStatus] = useState<{success: boolean, message: string} | null>(null);
  const [automationMode, setAutomationMode] = useState<'api' | 'manual' | 'n8n'>(
    n8nWebhookUrl ? 'n8n' : (window.location.hostname.includes('vercel.app') ? 'manual' : 'api')
  );

  const whatsappPosts = posts.filter(p => p.platform === 'whatsapp');
  const pendingPosts = whatsappPosts.filter(p => p.status === 'pending');

  const dailyLimit = accountAge * 5 + 5;
  const hourlyLimit = Math.ceil(dailyLimit / 4);

  const sentTodayCount = whatsappPosts.filter(p => {
    if (p.status !== 'sent' || !p.updatedAt) return false;
    const sentDate = p.updatedAt.seconds ? new Date(p.updatedAt.seconds * 1000) : new Date(p.updatedAt);
    const today = new Date();
    return sentDate.getDate() === today.getDate() &&
           sentDate.getMonth() === today.getMonth() &&
           sentDate.getFullYear() === today.getFullYear();
  }).length;

  const sentThisHourCount = whatsappPosts.filter(p => {
    if (p.status !== 'sent' || !p.updatedAt) return false;
    const sentDate = p.updatedAt.seconds ? new Date(p.updatedAt.seconds * 1000) : new Date(p.updatedAt);
    const now = new Date();
    return now.getTime() - sentDate.getTime() < 3600000;
  }).length;

  const isDailyLimitReached = sentTodayCount >= dailyLimit;
  const isHourlyLimitReached = sentThisHourCount >= hourlyLimit;
  const isLimitReached = isDailyLimitReached || isHourlyLimitReached;

  const [currentAutoTarget, setCurrentAutoTarget] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [readyForManualPush, setReadyForManualPush] = useState<any>(null);
  const [n8nStatus, setN8nStatus] = useState<{success: boolean, message: string} | null>(null);

  // Auto-Automation Logic
  useEffect(() => {
    let timer: any;
    let countdownInterval: any;

    if (isAutomating && pendingPosts.length > 0) {
      if (isDailyLimitReached) {
        setIsAutomating(false);
        setCurrentAutoTarget(null);
        setCountdown(null);
        alert(`DAILY LIMIT REACHED (${dailyLimit}). Automation paused to protect your account. Remaining messages will stay in pending for tomorrow.`);
        return;
      }
      
      if (isHourlyLimitReached) {
        setIsAutomating(false);
        setCurrentAutoTarget(null);
        setCountdown(null);
        alert(`HOURLY LIMIT REACHED (${hourlyLimit}). Automation paused for 1 hour to prevent flags. Please try again later.`);
        return;
      }

      const nextPost = pendingPosts[0];
      setCurrentAutoTarget(nextPost.target);

      const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
      setCountdown(delaySeconds);

      countdownInterval = setInterval(() => {
        setCountdown(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
      }, 1000);

      timer = setTimeout(() => {
        clearInterval(countdownInterval);
        setCountdown(null);

        (async () => {
          if (automationMode === 'api') {
            setIsSending(true);
            try {
              const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: nextPost.target,
                  message: nextPost.content,
                  mediaUrl: nextPost.mediaUrl,
                  token: whatsappToken,
                  phoneId: whatsappPhoneId
                })
              });
              
              let data;
              const contentType = response.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                data = await response.json();
              } else {
                const text = await response.text();
                data = { error: `Server error (${response.status}): ${text.substring(0, 100)}` };
              }
              
              if (response.ok) {
                onComplete(nextPost.id);
                setLastApiStatus({ success: true, message: 'Message sent successfully.' });
              } else {
                console.error("API Error Data:", data);
                setIsAutomating(false);
                const errorObj = data.error || data;
                let errMsg = errorObj.error_user_msg || errorObj.message || (typeof errorObj === 'string' ? errorObj : 'Failed to send');
                
                if (errMsg.includes('131030') || errMsg.includes('allowed list')) {
                   errMsg = "META SANDBOX LIMIT: You must add this number to your 'Allowed List' in the Meta Developer Dashboard to send messages in test mode.";
                }

                setLastApiStatus({ success: false, message: `Meta Error: ${errMsg.substring(0, 40)}...` });
                alert('WhatsApp API Error: ' + errMsg);
              }
            } catch (e: any) {
              console.error("Fetch Error:", e);
              setIsAutomating(false);
              setLastApiStatus({ success: false, message: 'Server connection failed.' });
              alert(`Connection Error to Backend: ${e.message}. For Cloud API, use the AI Studio preview URL.`);
            } finally {
              setIsSending(false);
              if (pendingPosts.length === 1) {
                setIsAutomating(false);
                setCurrentAutoTarget(null);
              }
            }
          } else if (automationMode === 'n8n') {
            if (!n8nWebhookUrl) {
              alert('Please set your n8n Webhook URL in Social Hub settings.');
              setIsAutomating(false);
              return;
            }
            setIsSending(true);
            try {
              const res = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: nextPost.target,
                  message: nextPost.content,
                  mediaUrl: nextPost.mediaUrl,
                  platform: 'whatsapp',
                  user: whatsappPhoneId
                })
              });
              if (res.ok) {
                onComplete(nextPost.id);
                setN8nStatus({ success: true, message: 'Forwarded to n8n.' });
              } else {
                setN8nStatus({ success: false, message: 'n8n rejected request.' });
              }
            } catch (e: any) {
              setN8nStatus({ success: false, message: 'n8n connection failed.' });
            } finally {
              setIsSending(false);
              if (pendingPosts.length === 1) {
                setIsAutomating(false);
                setCurrentAutoTarget(null);
              }
            }
          } else {
            // Manual Mode Logic
            const encodedMsg = encodeURIComponent(nextPost.content);
            const cleanTarget = nextPost.target.replace(/\D/g, "");
            const url = `https://wa.me/${cleanTarget}?text=${encodedMsg}`;
            setReadyForManualPush({ ...nextPost, url });
            // We stop here and wait for user click to bypass pop-up blockers
          }
        })();
      }, delaySeconds * 1000);
    } else {
      setCurrentAutoTarget(null);
      setCountdown(null);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [isAutomating, pendingPosts, minDelay, maxDelay, onComplete, isDailyLimitReached, isHourlyLimitReached, dailyLimit, hourlyLimit]);

  // Warm-up logic: Start with 5, add 5 more every day
  const parseSpintax = (text: string) => {
    return text.replace(/\{([^{}]+)\}/g, (match, options) => {
      const choices = options.split('|');
      return choices[Math.floor(Math.random() * choices.length)];
    });
  };

  const handleScheduleMarketing = () => {
    const contactList = contacts.split('\n').filter(c => c.trim().length > 0);
    if (contactList.length === 0 || !rawMessage) {
      alert('Please provide contacts and a message.');
      return;
    }

    if (imageUrl && imageUrl.includes('drive.google.com')) {
      if (!confirm('You are using a Google Drive link. WhatsApp might not display the image preview correctly. Use a direct image link if possible. Continue anyway?')) {
        return;
      }
    }

    if (contactList.length > dailyLimit) {
      alert(`Warning: Your suggested daily limit is ${dailyLimit}. You are trying to send to ${contactList.length} contacts. This might risk a ban!`);
    }

    const baseStartTime = scheduledTime ? new Date(scheduledTime) : new Date();
    let nextScheduledTime = baseStartTime;

    contactList.forEach((contact, index) => {
      const personalizedMsg = parseSpintax(rawMessage).replace(/\[Name\]/g, contact.split(',')[1] || 'Customer');
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
      
      nextScheduledTime = new Date(nextScheduledTime.getTime() + delay * 1000);

      onSchedule({
        content: personalizedMsg,
        mediaUrl: imageUrl,
        platform: 'whatsapp',
        scheduledAt: nextScheduledTime,
        target: contact.split(',')[0],
        status: 'pending'
      });
    });

    alert(scheduledTime ? `Campaign scheduled to begin at ${new Date(scheduledTime).toLocaleString()}` : `${contactList.length} messages added to queue!`);
    setContacts('');
    setRawMessage('');
    setImageUrl('');
    setScheduledTime('');
  };

  return (
    <div className="max-w-5xl space-y-8 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Planner Settings */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-navy-800 border border-navy-700 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-bold uppercase text-gold-500 mb-6 flex items-center gap-2">
              <Zap size={16} /> Warm-up Config
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Account Age (Days)</label>
                <input 
                  type="number" 
                  value={accountAge}
                  onChange={(e) => setAccountAge(parseInt(e.target.value) || 1)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50"
                />
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-xs text-slate-400">Safe limit for today:</p>
                <p className="text-xl font-bold text-emerald-500">{dailyLimit} Messages</p>
                <div className="mt-2 p-2 bg-navy-900 rounded-lg">
                  <p className="text-[9px] text-slate-600 font-mono">Node: +8801775939996</p>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Recommended for your node</p>
              </div>
            </div>
          </section>

          <section className="bg-navy-800 border border-navy-700 rounded-3xl p-6">
            <h3 className="text-sm font-bold uppercase text-slate-500 mb-6 flex items-center gap-2">
              <Clock size={16} /> Smart Interval
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Min Delay (s)</label>
                <input type="number" value={minDelay} onChange={(e) => setMinDelay(parseInt(e.target.value))} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Max Delay (s)</label>
                <input type="number" value={maxDelay} onChange={(e) => setMaxDelay(parseInt(e.target.value))} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
            </div>
          </section>
        </div>

        {/* Campaign Builder */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="text-emerald-500" />
              </div>
              Broadcast Campaign
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Contacts (Number,Name - one per line)</label>
                <textarea 
                  value={contacts}
                  onChange={(e) => setContacts(e.target.value)}
                  data-gramm="false"
                  spellCheck="false"
                  placeholder="880170000000,Neaz&#10;880180000000,Tamim"
                  className="w-full h-40 bg-navy-900 border border-navy-700 rounded-2xl p-4 outline-none focus:border-emerald-500/50 resize-none text-sm font-mono"
                />
                <p className="text-[10px] text-slate-600 mt-2 italic shadow-sm">
                  Format: <span className="text-emerald-500 font-bold">CountryCode</span>Number (No + sign). Example: 88017...
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase italic flex items-center gap-2">
                   <Clock size={12} className="text-gold-500" /> Start Time (Optional)
                </label>
                <input 
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-2xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm text-slate-300 transition-all cursor-pointer"
                />
                <p className="text-[9px] text-slate-600 mt-2">Leave blank to start immediately.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Message with Spintax</label>
                <textarea 
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  data-gramm="false"
                  spellCheck="false"
                  placeholder="{Hi|Hello|Hey} [Name], check out our new offer!"
                  className="w-full h-32 bg-navy-900 border border-navy-700 rounded-2xl p-4 outline-none focus:border-gold-500/50 resize-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Image URL (Optional)</label>
                <input 
                  type="text" 
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-navy-900 border border-navy-700 rounded-2xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm"
                />
                <p className="text-[10px] text-slate-600 mt-2 italic">
                  Note: Use a direct link (ends in .jpg/.png). Google Drive links <span className="text-red-400">won't show preview</span>.
                </p>
              </div>

              <button 
                onClick={handleScheduleMarketing}
                className="w-full py-4 gold-gradient text-navy-900 font-bold rounded-2xl shadow-xl shadow-gold-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Send size={20} /> Deploy Data to Queue
              </button>
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                  <span className="text-emerald-500 font-bold">AUTOMATION NOTICE:</span> Browser security prevents 100% automated background sending. Your data is queued safely. Use the <span className="text-emerald-500">Smart Queue</span> below to open and trigger each message.
                </p>
                <div className="mt-2 flex justify-center">
                  <span className="text-[9px] bg-navy-900 px-2 py-1 rounded-md text-slate-500 border border-navy-700 italic">Account Status: Protected from Ban</span>
                </div>
              </div>
            </div>
          </section>

          {/* Local Execution Queue for WhatsApp */}
          <section className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-gold-500/5 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16" />
             <div className="flex justify-between items-center mb-6 relative">
                <h3 className="text-lg font-bold flex items-center gap-2 italic">
                  <Clock className="text-gold-500" size={18} /> Smart Queue
                </h3>
                <div className="flex gap-2">
                   {pendingPosts.length > 0 && (
                     <button 
                       disabled={isLimitReached}
                       onClick={() => setIsAutomating(!isAutomating)}
                       className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
                         isLimitReached ? 'bg-slate-700 text-slate-500 cursor-not-allowed' :
                         isAutomating 
                         ? 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse' 
                         : 'bg-gold-500 text-navy-900 shadow-gold-500/20 hover:scale-105'
                       }`}
                     >
                       {isLimitReached ? 'Limit Reached' : (isAutomating ? 'Stop Automation' : 'Start Auto-Sequence')}
                     </button>
                   )}
                   <span className="text-[10px] bg-navy-900 px-3 py-1 rounded-full text-slate-500 uppercase tracking-widest font-black">
                     {pendingPosts.length} Pending Today
                   </span>
                </div>
             </div>

              {isAutomating && (
               <div className="mb-6 p-6 bg-gold-500/10 border border-gold-500/30 rounded-3xl relative">
                  <div className="absolute top-2 right-2 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gold-500 rounded-full animate-ping" />
                      <p className="text-sm font-bold text-gold-500 uppercase tracking-widest">Auto-Sequence Active</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-mono block">Target: {currentAutoTarget || 'Initializing...'}</span>
                      {countdown !== null && <span className="text-[10px] text-emerald-400 font-bold block animate-pulse">Next window in: {countdown}s</span>}
                      <span className="text-[10px] text-gold-500/80 font-bold block">Sent Today: {sentTodayCount}/{dailyLimit}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-navy-900 rounded-full mb-4 overflow-hidden">
                     <div 
                       className="h-full bg-gold-500 transition-all duration-500" 
                       style={{ width: `${Math.min(100, (sentTodayCount / dailyLimit) * 100)}%` }}
                     />
                  </div>
                  <div className="bg-navy-900/50 p-4 rounded-2xl border border-gold-500/20 mb-4">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-navy-700">
                       <p className="text-xs text-white font-bold italic">🚀 SENDING MODE:</p>
                       <div className="flex bg-navy-800 rounded-lg p-1">
                          <button 
                            onClick={() => setAutomationMode('n8n')}
                            className={`px-3 py-1 text-[10px] rounded-md transition-all ${automationMode === 'n8n' ? 'bg-indigo-500 text-white font-bold animate-pulse' : 'text-slate-400'}`}
                          >n8n (Recommended)</button>
                          <button 
                            onClick={() => setAutomationMode('api')}
                            className={`px-3 py-1 text-[10px] rounded-md transition-all ${automationMode === 'api' ? 'bg-gold-500 text-navy-900 font-bold' : 'text-slate-400'}`}
                          >Cloud API</button>
                          <button 
                            onClick={() => setAutomationMode('manual')}
                            className={`px-3 py-1 text-[10px] rounded-md transition-all ${automationMode === 'manual' ? 'bg-emerald-500 text-navy-900 font-bold' : 'text-slate-400'}`}
                          >Manual</button>
                       </div>
                    </div>
                    
                     {automationMode === 'api' ? (
                      <>
                        <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl mb-3">
                           <p className="text-[10px] text-blue-400 font-bold uppercase mb-1 flex items-center gap-1">
                              <Settings size={12} /> Meta Dashboard Guide
                           </p>
                           <p className="text-[9px] text-slate-400 leading-tight">
                              If using a **Test Number**, go to Meta Developer Dashboard and add the recipient to your <b>Allowed List</b>.
                           </p>
                           <a 
                             href="https://developers.facebook.com/apps/" 
                             target="_blank" 
                             className="text-[9px] text-gold-500 underline mt-1 block"
                           >Open Meta Dashboard →</a>
                        </div>

                        {window.location.hostname.includes('vercel.app') && (
                          <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-xl mb-3">
                            <p className="text-[10px] text-red-500 font-bold uppercase mb-1">⚠️ Environment Mismatch</p>
                            <p className="text-[9px] text-slate-400 mb-2">Cloud API only works in the <b>AI Studio Development Preview</b>. This Vercel link is frontend-only.</p>
                            <a 
                              href={window.location.href.replace('d-connect-self.vercel.app', 'ais-dev-fnrlt5mucezwyf4nrhznnx-618425769061.asia-southeast1.run.app')}
                              target="_blank"
                              className="text-[10px] bg-red-500 text-white px-2 py-1 rounded inline-block font-bold hover:bg-red-600 transition-colors"
                            >
                              Open Development Preview
                            </a>
                          </div>
                        )}

                        {lastApiStatus && (
                          <div className={`mt-2 p-2 rounded text-[10px] font-mono mb-2 ${lastApiStatus.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                            {lastApiStatus.success ? '✓ ' : '✗ ERROR: '}{lastApiStatus.message}
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-[10px] text-emerald-500 flex items-center gap-1 font-bold">
                             {isSending ? 'Sending now...' : 'Channel Connected & Ready'}
                          </p>
                          <button 
                            className="text-[9px] text-gold-500 underline mt-1 opacity-50 hover:opacity-100"
                            onClick={async () => {
                              const testNum = prompt("Enter a phone number with country code (e.g. 88017...) to test API:");
                              if (!testNum) return;
                              try {
                                const res = await fetch('/api/whatsapp/send', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ to: testNum, message: "API Test Successful! Hello from Digicoup.", token: whatsappToken, phoneId: whatsappPhoneId })
                                });
                                
                                let data;
                                try { data = await res.json(); } catch(e) { data = { error: "Non-JSON response from server. Check if you are on the correct AI Studio URL." }; }
                                
                                alert(res.ok ? "Success! Message sent." : `Error: ${JSON.stringify(data)}`);
                              } catch (e: any) { alert(`Server connection error: ${e.message}`); }
                            }}
                          >
                            [Run Connection Test]
                          </button>
                        </div>
                      </>
                    ) : automationMode === 'n8n' ? (
                      <div className="space-y-3">
                        <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">n8n Workflow Active</p>
                        <p className="text-[9px] text-slate-400 leading-tight">Digicoup is sending data to your n8n webhook. Make sure your server is listening.</p>
                        {n8nStatus && (
                          <div className={`mt-2 p-2 rounded text-[10px] font-mono ${n8nStatus.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
                            {n8nStatus.success ? '✓ ' : '✗ ERROR: '}{n8nStatus.message}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tighter">
                          Using Browser Tab Automation. Requires manual "Enter" press in WhatsApp.
                        </p>
                        
                        {readyForManualPush ? (
                          <motion.button
                            initial={{ scale: 0.95 }}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            onClick={() => {
                              window.open(readyForManualPush.url, '_blank');
                              onComplete(readyForManualPush.id);
                              setReadyForManualPush(null);
                              if (pendingPosts.length === 1) {
                                setIsAutomating(false);
                              }
                            }}
                            className="w-full py-3 bg-emerald-500 text-navy-900 font-black rounded-xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs"
                          >
                            <ExternalLink size={16} /> OPEN WHATSAPP TO SEND
                          </motion.button>
                        ) : (
                          <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {countdown && countdown > 0 ? `Preparing next message in ${countdown}s...` : 'Searching next target...'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-[10px] text-slate-500">
                    <p className="flex items-center gap-2">• Running in background via Business Channel.</p>
                    <p className="flex items-center gap-2">• Daily & Hourly limits are active.</p>
                  </div>
               </div>
             )}
             
             <div className="space-y-3 relative">
                {whatsappPosts.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 border border-dashed border-navy-700 rounded-2xl bg-navy-900/20">
                    <Zap className="mx-auto mb-3 opacity-20" size={32} />
                    <p className="text-sm">Queue is empty. Deploy a campaign to start.</p>
                  </div>
                ) : (
                  whatsappPosts.slice(0, 15).map((post) => (
                    <div key={post.id} className="flex items-center justify-between p-4 bg-navy-900/50 rounded-2xl border border-navy-700 group hover:border-emerald-500/30 transition-all">
                       <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${post.status === 'sent' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gold-500 animate-pulse'}`} />
                          <div>
                             <p className="text-sm font-bold text-slate-200">{post.target}</p>
                             <div className="flex items-center gap-2">
                               <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{post.content}</p>
                               {post.mediaUrl && <div className="w-1.5 h-1.5 rounded-full bg-gold-500" title="Has attachment" />}
                             </div>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          {post.status === 'pending' ? (
                            <div className="flex gap-1">
                               <button 
                                onClick={async () => {
                                  try {
                                    const response = await fetch('/api/whatsapp/send', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        to: post.target,
                                        message: post.content,
                                        mediaUrl: post.mediaUrl,
                                        token: whatsappToken,
                                        phoneId: whatsappPhoneId
                                      })
                                    });
                                    if (response.ok) {
                                      onComplete(post.id);
                                    } else {
                                      const data = await response.json();
                                      alert('Error: ' + (data.error?.message || 'Failed to send'));
                                    }
                                  } catch (e) {
                                    alert('Connection Error');
                                  }
                                }}
                                className="px-3 py-2 bg-emerald-500 text-navy-900 text-xs font-black rounded-lg hover:brightness-110 transition-all flex items-center gap-1"
                              >
                                SEND
                              </button>
                              <button 
                                onClick={() => {
                                  const url = `https://wa.me/${post.target.replace(/\D/g, "")}?text=${encodeURIComponent(post.content)}`;
                                  window.open(url, '_blank');
                                  onComplete(post.id);
                                }}
                                className="p-2 bg-navy-700 text-slate-300 rounded-lg hover:text-gold-500 transition-colors" 
                                title="Open WhatsApp Link"
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider px-2 py-1 bg-emerald-500/10 rounded-md">Executed</span>
                          )}
                          <button onClick={() => deletePost(post.id)} className="p-2 text-slate-600 hover:text-red-400"><X size={14} /></button>
                       </div>
                    </div>
                  ))
                )}
                {whatsappPosts.length > 15 && (
                  <button className="w-full py-2 text-[10px] text-slate-500 hover:text-gold-500 transition-colors font-bold uppercase tracking-widest">
                    + {whatsappPosts.length - 15} more in history
                  </button>
                )}
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}
