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

  // Scheduling State
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);

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
      // Sort locally to ensure consistency without manual index creation
      posts.sort((a: any, b: any) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
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
        
        const scheduledTime = new Date(post.time);
        if (now >= scheduledTime) {
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
              success = true; // WhatsApp/Instagram placeholder
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
        igAccountId
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
          <NavItem icon={<MessageSquare size={20} />} label="WhatsApp Planner" active={activeModule === 'whatsapp'} onClick={() => setActiveModule('whatsapp')} isOpen={isSidebarOpen} />
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
              <span className={`text-sm font-medium flex items-center gap-1 ${
                syncStatus === 'real-time' ? 'text-emerald-500' : 
                syncStatus === 'error' ? 'text-red-500' : 'text-gold-500'
              }`}>
                {syncStatus === 'real-time' ? <CheckCircle2 size={12} /> : <div className="w-2 h-2 rounded-full bg-current animate-pulse" />}
                {syncStatus === 'real-time' ? 'Real-time' : syncStatus === 'error' ? 'Sync Error' : 'Connecting...'}
              </span>
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
                />
              )}
              {activeModule === 'email' && <EmailView apiKey={resendApiKey} setApiKey={setResendApiKey} onSave={saveSettings} />}
              {activeModule === 'social' && <SocialView fbToken={fbAccessToken} setFbToken={setFbAccessToken} pageId={pageId} setPageId={setPageId} igId={igAccountId} setIgId={setIgAccountId} onSave={saveSettings} />}
              {activeModule === 'ai' && (
                <AIView 
                  prompt={aiPrompt} setPrompt={setAiPrompt}
                  channel={aiChannel} setChannel={setAiChannel}
                  language={aiLanguage} setLanguage={setAiLanguage}
                  result={aiResult} onGenerate={handleGenerateAI} isLoading={isGenerating}
                  onSchedule={saveScheduledPost}
                />
              )}
              {activeModule === 'settings' && <ScheduleDashboard posts={scheduledPosts} deletePost={deletePost} />}
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
                  onSchedule({ content: result, platform: channel, time: scheduleTime });
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

  const completeTask = async (id: string) => {
    try {
      await setDoc(doc(db, 'scheduled_posts', id), { status: 'sent', updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  function ScheduleDashboard({ posts, deletePost }: { posts: any[], deletePost: (id: string) => void }) {
  const executeWhatsApp = (post: any) => {
    const encodedMsg = encodeURIComponent(post.content);
    if (post.mediaUrl) {
      navigator.clipboard.writeText(post.mediaUrl);
      alert('Image URL copied to clipboard! Now paste it in the WhatsApp chat.');
    }
    window.open(`https://web.whatsapp.com/send?phone=${post.target}&text=${encodedMsg}`, '_blank');
    completeTask(post.id);
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

function EmailView({ apiKey, setApiKey, onSave }: any) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !to || !subject || !body) {
      alert('Missing API Key, Recipient, Subject or Body');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: 'Digicoup <onboarding@resend.dev>', // Resend default for free plan
          to: [to],
          subject: subject,
          html: body.replace(/\n/g, '<br/>')
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Email sent successfully! ID: ' + data.id);
        setTo('');
        setSubject('');
        setBody('');
      } else {
        throw new Error(data.message || 'Failed to send email');
      }
    } catch (error: any) {
      console.error("Resend Error:", error);
      alert('Error: ' + error.message + '. (Note: Free plans often require domain verification)');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 mb-6">
        <h3 className="text-sm font-bold uppercase text-slate-600 mb-4 tracking-widest flex justify-between items-center">
          Resend Configuration
          <button onClick={onSave} className="text-[10px] bg-gold-500 text-navy-900 px-3 py-1 rounded-full hover:scale-105 transition-all">Save Key</button>
        </h3>
        <div className="flex gap-4">
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Resend API Key (re_...)"
            className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm"
          />
        </div>
      </div>
      
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Mail className="text-blue-500" /></div>
          <div><h2 className="text-xl font-bold">Resend Email Campaign</h2><p className="text-sm text-slate-500">Direct integration with Resend.com infrastructure.</p></div>
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

function SocialView({ fbToken, setFbToken, pageId, setPageId, igId, setIgId, onSave }: any) {
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
      <section className="bg-navy-800 border border-navy-700 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
          <input 
            type="password" 
            value={fbToken} 
            onChange={(e) => setFbToken(e.target.value)} 
            placeholder="Meta Access Token (v18.0)" 
            className="bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm" 
          />
          <div className="flex gap-2">
             <input type="text" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="FB Page ID" className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none text-sm" />
             <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="IG Account ID" className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none text-sm" />
          </div>
        </div>
        <button onClick={onSave} className="bg-gold-500 text-navy-900 px-8 py-3 rounded-xl font-bold hover:scale-105 transition-all text-sm shrink-0 shadow-lg shadow-gold-500/20">Save Keys</button>
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

function NavItem({ icon, label, active, onClick, isOpen }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isOpen: boolean }) {
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
      {isOpen && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
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

function WhatsAppView({ onSchedule, posts, deletePost }: { onSchedule: (post: any) => void, posts: any[], deletePost: (id: string) => void }) {
  const [accountAge, setAccountAge] = useState(1);
  const [contacts, setContacts] = useState<string>('');
  const [rawMessage, setRawMessage] = useState('');
  const [imageUrl, setImageUrl] = useState(''); 
  const [minDelay, setMinDelay] = useState(20);
  const [maxDelay, setMaxDelay] = useState(60);

  const whatsappPosts = posts.filter(p => p.platform === 'whatsapp');

  // Warm-up logic: Start with 5, add 5 more every day
  const dailyLimit = accountAge * 5 + 5;

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

    if (contactList.length > dailyLimit) {
      alert(`Warning: Your suggested daily limit is ${dailyLimit}. You are trying to send to ${contactList.length} contacts. This might risk a ban!`);
    }

    // Schedule each contact with randomized delay
    let currentTime = new Date();
    contactList.forEach((contact, index) => {
      const personalizedMsg = parseSpintax(rawMessage).replace(/\[Name\]/g, contact.split(',')[1] || 'Customer');
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
      
      currentTime = new Date(currentTime.getTime() + delay * 1000);

      onSchedule({
        content: personalizedMsg,
        mediaUrl: imageUrl,
        platform: 'whatsapp',
        time: currentTime.toISOString(),
        target: contact.split(',')[0],
        status: 'pending'
      });
    });

    alert(`${contactList.length} messages added to schedule!`);
    setContacts('');
    setRawMessage('');
    setImageUrl('');
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
                  placeholder="880170000000,Neaz&#10;880180000000,Tamim"
                  className="w-full h-40 bg-navy-900 border border-navy-700 rounded-2xl p-4 outline-none focus:border-gold-500/50 resize-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Message with Spintax</label>
                <textarea 
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
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
                <p className="text-[10px] text-slate-600 mt-2 italic">Note: WhatsApp Web requires manual attachment, we will auto-copy the link for you.</p>
              </div>

              <button 
                onClick={handleScheduleMarketing}
                className="w-full py-4 gold-gradient text-navy-900 font-bold rounded-2xl shadow-xl shadow-gold-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Send size={20} /> Deploy Secured Campaign
              </button>
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
                   <span className="text-[10px] bg-navy-900 px-3 py-1 rounded-full text-slate-500 uppercase tracking-widest font-black">
                     {whatsappPosts.filter(p => p.status === 'pending').length} Pending
                   </span>
                </div>
             </div>
             
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
                                onClick={() => {
                                  const encodedMsg = encodeURIComponent(post.content);
                                  if (post.mediaUrl) {
                                    navigator.clipboard.writeText(post.mediaUrl);
                                  }
                                  window.open(`https://web.whatsapp.com/send?phone=${post.target}&text=${encodedMsg}`, '_blank');
                                }}
                                className="px-3 py-2 bg-emerald-500 text-navy-900 text-xs font-black rounded-lg hover:brightness-110 transition-all flex items-center gap-1"
                              >
                                SEND
                              </button>
                              <button 
                                onClick={() => {
                                  const url = `https://web.whatsapp.com/send?phone=${post.target}&text=${encodeURIComponent(post.content)}`;
                                  navigator.clipboard.writeText(url);
                                  alert('Direct WhatsApp link copied!');
                                }}
                                className="p-2 bg-navy-700 text-slate-300 rounded-lg hover:text-gold-500 transition-colors" 
                                title="Copy direct link"
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
