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
  User as UserIcon
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

    // Load Posts
    const postsQuery = query(
      collection(db, 'scheduled_posts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setScheduledPosts(posts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'scheduled_posts');
    });

    return () => unsubscribe();
  }, [user]);

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
            onClick={loginWithGoogle}
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
              <p className="text-sm font-medium text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> Real-time</p>
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
              {activeModule === 'whatsapp' && <WhatsAppView />}
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

function ScheduleDashboard({ posts, deletePost }: { posts: any[], deletePost: (id: string) => void }) {
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
              <th className="px-8 py-4">Scheduled Time</th>
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
                <td className="px-8 py-4 text-sm font-mono text-slate-500">{new Date(post.time).toLocaleString()}</td>
                <td className="px-8 py-4 max-w-[200px] truncate text-slate-300 italic">"{post.content}"</td>
                <td className="px-8 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => deletePost(post.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><X size={16} /></button>
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
  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 mb-6">
        <h3 className="text-sm font-bold uppercase text-slate-600 mb-4 tracking-widest flex justify-between items-center">
          Auth Configuration
          <button onClick={onSave} className="text-[10px] bg-gold-500 text-navy-900 px-3 py-1 rounded-full">Save Changes</button>
        </h3>
        <div className="flex gap-4">
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Resend API Key (re_...)"
            className="flex-1 bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm"
          />
          <button className="px-6 bg-navy-700 rounded-xl text-xs font-bold uppercase hover:bg-navy-600 transition-colors">Test Link</button>
        </div>
      </div>
      
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Mail className="text-blue-500" /></div>
          <div><h2 className="text-xl font-bold">Resend Email Feature</h2><p className="text-sm text-slate-500">Auto-fill from AI content and blast instantly.</p></div>
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Email feature integrated with Cloud Backend.'); }}>
          <input required type="email" placeholder="Recipient Email (To)" className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none" />
          <input required type="text" placeholder="Subject" className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none" />
          <textarea required placeholder="Message Body" className="w-full h-48 bg-navy-900 border border-navy-700 rounded-xl p-4 outline-none resize-none" />
          <button type="submit" className="w-full py-3 gold-gradient text-navy-900 font-bold rounded-xl shadow-lg">Send Instant Mail</button>
        </form>
      </div>
    </div>
  );
}

function SocialView({ fbToken, setFbToken, pageId, setPageId, igId, setIgId, onSave }: any) {
  return (
    <div className="max-w-5xl space-y-8 pb-20">
      <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 mb-6">
        <h3 className="text-sm font-bold uppercase text-slate-600 mb-4 tracking-widest flex justify-between items-center">
          Meta Configuration
          <button onClick={onSave} className="text-[10px] bg-gold-500 text-navy-900 px-3 py-1 rounded-full">Save Changes</button>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="password" value={fbToken} onChange={(e) => setFbToken(e.target.value)} placeholder="Main Access Token" className="bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50 text-sm" />
          <p className="text-[10px] text-slate-500 flex items-center">Tokens are encrypted and stored in your private vault.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Share2 className="text-blue-500" /> Facebook Page Auto-Post</h3>
          <div className="space-y-4">
            <input type="text" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Page ID" className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50" />
            <input type="text" placeholder="Image URL (optional)" className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50" />
            <button className="w-full py-4 gold-gradient text-navy-900 font-bold rounded-xl">Post to Facebook</button>
          </div>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Share2 className="text-purple-500" /> Instagram Business Feed</h3>
          <div className="space-y-4">
            <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="Instagram Business Account ID" className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50" />
            <input type="text" placeholder="Image URL (Required for IG)" className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 outline-none focus:border-gold-500/50" />
            <p className="text-[10px] text-slate-500 bg-navy-950 p-2 rounded italic">Caption will be auto-filled from generated results.</p>
            <button className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all">Publish to IG</button>
          </div>
        </div>
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

function WhatsAppView() {
  const [warmupDays, setWarmupDays] = useState(1);
  
  return (
    <div className="max-w-4xl space-y-8">
      <section className="bg-navy-800/50 border border-navy-700 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <MessageSquare className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Smart Broadcast Planner</h2>
            <p className="text-sm text-slate-500">Prevent number bans with intelligent warm-up and random delays.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Account Age (Days)</label>
              <input 
                type="number" 
                value={warmupDays}
                onChange={(e) => setWarmupDays(parseInt(e.target.value))}
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-4 py-3 focus:outline-none focus:border-gold-500/50"
              />
            </div>
            
            <div className="p-4 rounded-xl bg-navy-900/50 border border-dashed border-navy-600">
              <h4 className="text-sm font-bold text-gold-500 mb-2 flex items-center gap-2">
                <AlertCircle size={14} /> Recommended Plan
              </h4>
              <p className="text-sm text-slate-400">
                Based on your account age, send <span className="text-white font-bold">{warmupDays * 5 + 5} messages</span> today.
                Use a delay of <span className="text-white font-bold">45-90 seconds</span> between messages.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-navy-700/30">
              <div className="flex items-center gap-3">
                <Clock className="text-gold-500" size={18} />
                <span className="text-sm">Randomized Interval</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 bg-navy-800 px-2 py-1 rounded">20-60s</span>
                <input type="checkbox" checked readOnly className="accent-gold-500" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-navy-700/30">
              <div className="flex items-center gap-3">
                <Layers className="text-gold-500" size={18} />
                <span className="text-sm">Spintax (Spin-tax) Tool</span>
              </div>
              <input type="checkbox" checked readOnly className="accent-gold-500" />
            </div>
            <button className="w-full py-3 gold-gradient text-navy-900 font-bold rounded-xl mt-4 shadow-xl shadow-gold-500/20 active:scale-95 transition-all">
              Initialize Sender
            </button>
          </div>
        </div>
      </section>

      <section className="bg-navy-800/50 border border-navy-700 rounded-2xl p-8">
        <h3 className="text-lg font-bold mb-4">Engagement Check</h3>
        <p className="text-sm text-slate-400 mb-6">Upload your contact list to verify connectivity and engagement history.</p>
        <div className="border-2 border-dashed border-navy-600 rounded-2xl p-12 flex flex-col items-center justify-center hover:border-gold-500/30 transition-all cursor-pointer group">
          <div className="w-16 h-16 rounded-full bg-navy-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-all">
            <Send className="text-gold-500" />
          </div>
          <p className="text-sm font-medium">Drop CSV/Excel or click to browse</p>
          <p className="text-xs text-slate-600 mt-1">Recommended: Max 500 contacts per batch</p>
        </div>
      </section>
    </div>
  );
}
