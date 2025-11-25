import { useState, useEffect, createContext, useContext, ReactNode, FormEvent } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Sword, Users, Scroll, ShoppingBag, Landmark, LogOut, Gift, Zap, Trash2, Shield, CheckCircle, XCircle, Info, ChevronUp, Link as LinkIcon, BookOpen, Sparkles, Star, Box, Compass, Trophy, Skull } from 'lucide-react';
import { User, General, UserGeneral, Campaign, COUNTRY_COLORS, STAR_STYLES, Equipment } from './types';

// --- API Service ---
const API_URL = '/api';

const api = {
    login: async (data: any) => {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        return res.json();
    },
    register: async (data: any) => {
        const res = await fetch(`${API_URL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        return res.json();
    },
    getMe: async (token: string) => {
        const res = await fetch(`${API_URL}/user/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    getMyGenerals: async (token: string) => {
        const res = await fetch(`${API_URL}/user/generals`, { headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    getGallery: async (token: string) => {
        const res = await fetch(`${API_URL}/gallery`, { headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    getCollection: async (token: string) => {
        const res = await fetch(`${API_URL}/user/collection`, { headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    getUserItems: async (token: string) => {
        const res = await fetch(`${API_URL}/user/items`, { headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    gacha: async (token: string) => {
        const res = await fetch(`${API_URL}/gacha`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    gachaTen: async (token: string) => {
        const res = await fetch(`${API_URL}/gacha/ten`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    getCampaigns: async (token: string) => {
        const res = await fetch(`${API_URL}/campaigns`, { headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    battle: async (token: string, id: number) => {
        const res = await fetch(`${API_URL}/battle/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    toggleTeam: async (token: string, generalUid: number, action: 'add'|'remove') => {
        const res = await fetch(`${API_URL}/team`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ generalUid, action }) });
        return res.json();
    },
    autoTeam: async (token: string) => {
        const res = await fetch(`${API_URL}/team/auto`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    signin: async (token: string) => {
        const res = await fetch(`${API_URL}/signin`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    autoEquip: async (token: string, generalUid: number) => {
        const res = await fetch(`${API_URL}/equip/auto`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ generalUid }) });
        return res.json();
    },
    unequipAll: async (token: string, generalUid: number) => {
        const res = await fetch(`${API_URL}/equip/unequip`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ generalUid }) });
        return res.json();
    },
    evolve: async (token: string, targetUid: number) => {
        const res = await fetch(`${API_URL}/general/evolve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid }) });
        return res.json();
    }
};

// --- Toast System ---
interface ToastMsg {
    id: number;
    text: string;
    type: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{ show: (text: string, type?: 'success'|'error'|'info') => void }>(null as any);

const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastMsg[]>([]);

    const show = (text: string, type: 'success'|'error'|'info' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    return (
        <ToastContext.Provider value={{ show }}>
            {children}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .toast-enter {
                    animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-card-appear {
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.2); }
                    50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.8); }
                }
                .animate-pulse-glow {
                    animation: pulse-glow 1s infinite;
                }
                @keyframes shake-hard {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
                .animate-shake-hard {
                    animation: shake-hard 0.5s ease-in-out infinite;
                }
                @keyframes flash-white {
                    0% { opacity: 0; }
                    50% { opacity: 1; }
                    100% { opacity: 0; }
                }
                .animate-flash {
                    animation: flash-white 0.5s ease-out forwards;
                }
                @keyframes pop-in {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-pop-in {
                    animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
            `}</style>
            <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`
                        toast-enter pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white min-w-[300px] max-w-md backdrop-blur-md border-l-4
                        ${t.type === 'success' ? 'bg-stone-800/95 border-green-500' : 
                          t.type === 'error' ? 'bg-stone-800/95 border-red-500' : 
                          'bg-stone-800/95 border-blue-500'}
                    `}>
                        <div className="shrink-0">
                            {t.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
                            {t.type === 'error' && <XCircle size={20} className="text-red-500" />}
                            {t.type === 'info' && <Info size={20} className="text-blue-500" />}
                        </div>
                        <span className="text-sm font-medium tracking-wide text-stone-100">{t.text}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const useToast = () => useContext(ToastContext);

// --- Context ---
const AuthContext = createContext<any>(null);

const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        if (token) {
            api.getMe(token).then(u => setUser(u)).catch(() => logout());
        }
    }, [token]);

    const login = (newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const refreshUser = () => {
        if (token) api.getMe(token).then(setUser);
    };

    return (
        <AuthContext.Provider value={{ token, user, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- Components ---
const Layout = ({ children }: { children: ReactNode }) => {
    const { user, logout } = useAuth();
    if (!user) return <Navigate to="/login" />;

    return (
        <div className="min-h-screen bg-stone-900 text-stone-200 font-sans pb-safe">
            <header className="bg-stone-800 border-b border-stone-700 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-amber-500 tracking-wider">三国志</div>
                    <span className="text-xs text-stone-400 bg-stone-900 px-2 py-1 rounded">霸业</span>
                </div>
                <div className="flex gap-4 items-center text-sm">
                    <div className="flex flex-col text-right">
                        <span className="text-amber-400 font-bold max-w-[100px] truncate">{user.username}</span>
                        <div className="flex gap-2 text-xs">
                            <span className="text-yellow-500">💰 {user.gold}</span>
                            <span className="text-green-500">📜 {user.tokens}</span>
                        </div>
                    </div>
                    <button onClick={logout} className="p-2 hover:bg-stone-700 rounded"><LogOut size={18} /></button>
                </div>
            </header>
            <main className="pb-24 p-4 max-w-5xl mx-auto">
                {children}
            </main>
            <nav className="fixed bottom-0 left-0 w-full bg-stone-900 border-t border-stone-800 flex justify-around p-2 pb-safe-bottom text-[10px] z-50">
                <Link to="/" className="flex flex-col items-center gap-1 p-2 text-stone-400 hover:text-amber-500 active:scale-95 transition"><Landmark size={20} /><span>主城</span></Link>
                <Link to="/campaign" className="flex flex-col items-center gap-1 p-2 text-stone-400 hover:text-amber-500 active:scale-95 transition"><Sword size={20} /><span>征战</span></Link>
                <Link to="/gacha" className="flex flex-col items-center gap-1 p-2 text-stone-400 hover:text-amber-500 active:scale-95 transition"><Gift size={20} /><span>招募</span></Link>
                <Link to="/gallery" className="flex flex-col items-center gap-1 p-2 text-stone-400 hover:text-amber-500 active:scale-95 transition"><BookOpen size={20} /><span>图鉴</span></Link>
                <Link to="/barracks" className="flex flex-col items-center gap-1 p-2 text-stone-400 hover:text-amber-500 active:scale-95 transition"><Users size={20} /><span>军营</span></Link>
                <Link to="/inventory" className="flex flex-col items-center gap-1 p-2 text-stone-400 hover:text-amber-500 active:scale-95 transition"><ShoppingBag size={20} /><span>仓库</span></Link>
            </nav>
        </div>
    );
};

// --- Pages ---
const Login = () => {
    const [isReg, setIsReg] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const { login } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            if (isReg) {
                await api.register(form);
                toast.show('注册成功，请登录', 'success');
                setIsReg(false);
            } else {
                const res = await api.login(form);
                if (res.error) return toast.show(res.error, 'error');
                login(res.token);
                navigate('/');
            }
        } catch (err) { 
            toast.show('请求失败，请检查网络', 'error'); 
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-950 bg-[url('https://picsum.photos/1920/1080?blur=5')] bg-cover px-4">
            <div className="bg-stone-900/90 p-8 rounded-xl border border-stone-700 shadow-2xl w-full max-w-md backdrop-blur-sm">
                <h1 className="text-3xl font-bold text-center text-amber-500 mb-6">三国志 · 霸业</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input className="w-full bg-stone-800 border border-stone-600 p-3 rounded text-stone-200 outline-none focus:border-amber-500" placeholder="账号" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                    <input className="w-full bg-stone-800 border border-stone-600 p-3 rounded text-stone-200 outline-none focus:border-amber-500" type="password" placeholder="密码" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                    <button className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 rounded transition-colors shadow-lg active:scale-95">{isReg ? '注册' : '登录'}</button>
                </form>
                <div className="mt-4 text-center text-stone-400 text-sm cursor-pointer hover:text-amber-400 p-2" onClick={() => setIsReg(!isReg)}>
                    {isReg ? '已有账号？去登录' : '没有账号？去注册'}
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { refreshUser } = useAuth();
    const toast = useToast();

    const handleSignin = async () => {
        const token = localStorage.getItem('token');
        if(!token) return;
        try {
            const res = await api.signin(token);
            if(res.error) toast.show(res.error, 'info');
            else {
                toast.show(`签到成功! 金币+${res.rewards.gold}, 招募令+${res.rewards.tokens}`, 'success');
                refreshUser();
            }
        } catch(e) { toast.show('签到请求失败', 'error'); }
    };

    return (
        <div className="space-y-6">
            <div className="relative h-48 md:h-64 rounded-xl overflow-hidden shadow-2xl border border-stone-600">
                <img src="https://picsum.photos/seed/city/800/400" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent flex items-end p-6">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-amber-500 drop-shadow-md">洛阳城</h2>
                        <p className="text-sm md:text-base text-stone-300">天下一统，在此一举。</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={handleSignin} className="bg-stone-800 p-4 md:p-6 rounded-lg border border-stone-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-stone-700 transition active:scale-95 active:bg-stone-700">
                    <Scroll size={32} className="text-amber-500" />
                    <span className="font-bold text-sm md:text-base">每日签到</span>
                </div>
                <Link to="/barracks" className="bg-stone-800 p-4 md:p-6 rounded-lg border border-stone-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-stone-700 transition active:scale-95 active:bg-stone-700">
                    <Users size={32} className="text-blue-500" />
                    <span className="font-bold text-sm md:text-base">整顿军马</span>
                </Link>
                <Link to="/gallery" className="bg-stone-800 p-4 md:p-6 rounded-lg border border-stone-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-stone-700 transition active:scale-95 active:bg-stone-700">
                    <BookOpen size={32} className="text-purple-500" />
                    <span className="font-bold text-sm md:text-base">武将图鉴</span>
                </Link>
            </div>
        </div>
    );
};

const Gacha = () => {
    const { token, refreshUser, user } = useAuth();
    const [result, setResult] = useState<General[] | null>(null);
    // Phase: idle -> charging -> flash -> reveal
    const [phase, setPhase] = useState<'idle' | 'charging' | 'flash' | 'reveal'>('idle');
    const toast = useToast();

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const performGacha = async (isTen: boolean) => {
        if (!token || phase !== 'idle') return;
        
        // 1. Charging Phase
        setPhase('charging');
        setResult(null);

        // Fetch in background while animating
        const gachaPromise = isTen ? api.gachaTen(token) : api.gacha(token);
        
        // Wait for charge animation (2s)
        await wait(2000);
        
        // 2. Flash Phase
        setPhase('flash');
        await wait(250); // Short bright flash
        
        // 3. Resolve & Reveal
        const res = await gachaPromise;
        if (res.error) {
            setPhase('idle');
            return toast.show(res.error, 'error');
        }
        
        setResult(isTen ? res.generals : [res.general]);
        setPhase('reveal');
        refreshUser();
    };

    const hasLegendary = result?.some(g => g.stars === 5);

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] py-4 relative overflow-hidden">
             {/* Screen Flash Overlay */}
             {phase === 'flash' && (
                <div className="fixed inset-0 z-[100] bg-white animate-flash pointer-events-none"></div>
            )}

             {/* Header Section */}
             <div className={`text-center mb-8 relative z-10 transition-opacity duration-500 ${phase !== 'idle' ? 'opacity-50' : 'opacity-100'}`}>
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300 animate-pulse drop-shadow-sm flex items-center justify-center gap-2">
                    <Sparkles className="text-amber-400" /> 聚贤庄 <Sparkles className="text-amber-400" />
                </h2>
                <div className="mt-4 inline-flex items-center gap-3 bg-stone-900/80 px-4 py-1.5 rounded-full border border-stone-700 shadow-inner backdrop-blur-sm">
                    <span className="text-stone-400 text-xs uppercase tracking-wider font-bold">保底进度</span>
                    <div className="w-24 h-2 bg-stone-800 rounded-full overflow-hidden border border-stone-700/50">
                        <div 
                            className="h-full bg-amber-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                            style={{ width: `${(user?.pity_counter || 0) / 60 * 100}%` }}
                        ></div>
                    </div>
                    <span className="text-amber-500 font-mono font-bold text-xs">{user?.pity_counter}/60</span>
                </div>
             </div>

             {/* Main Altar Area */}
             {phase === 'reveal' && result ? (
                 <div className={`w-full max-w-2xl animate-fade-in-up text-center space-y-4 md:space-y-6 bg-stone-800/90 backdrop-blur-md p-4 md:p-8 rounded-xl border-2 shadow-2xl relative overflow-hidden ${hasLegendary ? 'border-amber-400/80 shadow-amber-900/50' : 'border-stone-600'}`}>
                    {hasLegendary && (
                        <div className="absolute inset-0 bg-amber-500/10 animate-pulse pointer-events-none"></div>
                    )}
                    <div className="relative z-10">
                        <h3 className={`text-xl md:text-2xl font-bold mb-4 md:mb-6 ${hasLegendary ? 'text-amber-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-stone-300'}`}>
                            {hasLegendary ? '✨ 传说降临! ✨' : '招募完成'}
                        </h3>
                        <div className="grid grid-cols-5 gap-1.5 md:grid-cols-5 md:gap-4 overflow-hidden">
                            {result.map((g, i) => {
                                 const style = STAR_STYLES[g.stars] || STAR_STYLES[1];
                                 const isFiveStar = g.stars === 5;
                                 return (
                                    <div key={i} style={{ animationDelay: `${i * 100}ms` }} className={`animate-card-appear flex flex-col items-center p-0.5 md:p-2 bg-stone-900 rounded border ${style.border} relative overflow-hidden group transform transition-all duration-300 ${isFiveStar ? 'shadow-[0_0_15px_rgba(251,191,36,0.6)] z-10 scale-105' : ''}`}>
                                        <div className={`absolute inset-0 opacity-10 ${style.bg}`}></div>
                                        {isFiveStar && <div className="absolute inset-0 bg-gradient-to-t from-amber-500/30 to-transparent animate-pulse"></div>}
                                        {g.converted && <div className="absolute top-0 right-0 bg-blue-600/90 text-white text-[8px] px-1 rounded-bl z-20 font-bold">碎片 x10</div>}
                                        <div className="relative w-full aspect-[2/3] overflow-hidden rounded-[2px] border border-stone-800">
                                            <img src={g.avatar} className="w-full h-full object-cover" />
                                        </div>
                                        <div className={`text-[8px] md:text-sm font-bold mt-0.5 md:mt-2 ${style.text} truncate w-full text-center leading-none`}>{g.name}</div>
                                        <div className="flex items-center justify-center gap-px mt-0.5">
                                            {Array.from({length: g.stars}).map((_, si) => (
                                                <Star key={si} size={isFiveStar ? 6 : 5} className={`${isFiveStar ? 'text-amber-400 fill-amber-400' : 'text-stone-600 fill-stone-600'}`} />
                                            ))}
                                        </div>
                                    </div>
                                 );
                            })}
                        </div>
                        <button onClick={() => { setPhase('idle'); setResult(null); }} className="mt-6 md:mt-8 px-8 py-3 bg-stone-700 rounded-full hover:bg-stone-600 text-white font-bold w-full md:w-auto border border-stone-500 active:scale-95 transition text-sm md:text-base">
                            继续招募
                        </button>
                    </div>
                </div>
             ) : (
                 // Altar View
                 <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center transition-all duration-500">
                    {/* Background Layers */}
                    <div className="absolute inset-0 bg-stone-900/40 rounded-full blur-3xl"></div>
                    
                    {/* Magic Circles */}
                    {/* Outer Rotating Ring */}
                    <div className={`absolute inset-0 border-[3px] border-dashed border-stone-700/30 rounded-full ${phase === 'charging' ? 'animate-spin-slow duration-[3s]' : 'animate-spin-slow'}`}></div>
                    
                    {/* Middle Ring with Runes */}
                    <div className={`absolute inset-4 border border-stone-600/50 rounded-full flex items-center justify-center ${phase === 'charging' ? 'animate-spin duration-[3s]' : 'rotate-45 transition-transform duration-[20s]'}`}>
                        <div className="absolute top-0 w-3 h-3 bg-stone-800 border border-stone-600 rounded-full transform -translate-y-1/2"></div>
                        <div className="absolute bottom-0 w-3 h-3 bg-stone-800 border border-stone-600 rounded-full transform translate-y-1/2"></div>
                        <div className="absolute left-0 w-3 h-3 bg-stone-800 border border-stone-600 rounded-full transform -translate-x-1/2"></div>
                        <div className="absolute right-0 w-3 h-3 bg-stone-800 border border-stone-600 rounded-full transform translate-x-1/2"></div>
                    </div>

                    {/* Core Altar */}
                    <div className={`relative z-10 w-40 h-40 bg-gradient-to-b from-stone-800 to-stone-900 rounded-full border-4 border-stone-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-500
                        ${phase === 'charging' ? 'scale-110 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.5)] animate-shake-hard' : ''}
                    `}>
                        {phase === 'charging' ? (
                            <Compass size={64} className="text-amber-400 animate-spin duration-1000" />
                        ) : (
                            <div className="text-stone-600 relative">
                                <Box size={56} strokeWidth={1.5} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Star size={24} className="text-stone-700 fill-stone-700" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Charging Particles */}
                    {phase === 'charging' && (
                        <div className="absolute inset-0 z-0">
                            <div className="absolute top-1/2 left-1/2 w-full h-1 bg-amber-500/20 -translate-x-1/2 -translate-y-1/2 blur-sm animate-pulse"></div>
                            <div className="absolute top-1/2 left-1/2 w-1 h-full bg-amber-500/20 -translate-x-1/2 -translate-y-1/2 blur-sm animate-pulse"></div>
                        </div>
                    )}
                 </div>
             )}

             {/* Controls */}
             {phase === 'idle' && (
                 <div className="mt-12 grid grid-cols-2 gap-6 w-full max-w-sm px-6">
                    {/* Single Pull Button */}
                    <button 
                        onClick={() => performGacha(false)}
                        className="group relative bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-red-500/50 rounded-xl p-1 transition-all duration-300 shadow-lg active:scale-95"
                    >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900 text-stone-400 text-[10px] px-2 py-0.5 rounded-full border border-stone-700 whitespace-nowrap group-hover:text-red-400 transition-colors shadow-sm">
                            1 招募令
                        </div>
                        <div className="h-full w-full bg-gradient-to-b from-stone-800 to-stone-900 rounded-lg py-3 flex flex-col items-center justify-center gap-1 group-hover:from-red-900/20 group-hover:to-stone-900 transition-all">
                            <span className="text-stone-200 font-bold text-lg group-hover:text-red-100 flex items-center gap-2"><Gift size={16} /> 单次招募</span>
                            <span className="text-[10px] text-stone-500 group-hover:text-red-300/70">普通概率</span>
                        </div>
                    </button>

                    {/* Ten Pull Button */}
                    <button 
                        onClick={() => performGacha(true)}
                        className="group relative bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-500/50 rounded-xl p-1 transition-all duration-300 shadow-lg active:scale-95"
                    >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900 text-stone-400 text-[10px] px-2 py-0.5 rounded-full border border-stone-700 whitespace-nowrap group-hover:text-amber-400 transition-colors shadow-sm">
                            10 招募令
                        </div>
                        <div className="h-full w-full bg-gradient-to-b from-stone-800 to-stone-900 rounded-lg py-3 flex flex-col items-center justify-center gap-1 group-hover:from-amber-900/20 group-hover:to-stone-900 transition-all">
                            <span className="text-amber-400 font-bold text-lg group-hover:text-amber-100 flex items-center gap-2"><Sparkles size={16} /> 十连招募</span>
                            <span className="text-[10px] text-amber-600/70 group-hover:text-amber-400/70">必出3星+</span>
                        </div>
                    </button>
                 </div>
             )}

             {/* Status Text */}
             {phase === 'charging' && (
                <div className="absolute bottom-20 text-amber-500 font-bold tracking-[0.5em] text-sm animate-pulse drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">
                    天命召唤中...
                </div>
             )}
        </div>
    );
};

// --- Helper: Calculate Total Power ---
const calculatePower = (g: UserGeneral) => {
    const baseAttr = g.str + g.int + g.ldr;
    // 10% bonus per evolution level
    const evolutionBonus = 1 + (g.evolution || 0) * 0.1;
    const basePower = baseAttr * g.level * evolutionBonus;
    
    // Sum equipment stats
    const equipPower = g.equipments ? g.equipments.reduce((acc, e) => acc + e.stat_bonus, 0) : 0;
    
    return Math.floor(basePower + equipPower);
};

// --- Bond Logic Definitions ---
interface BondDef {
    name: string;
    desc: string;
    boost: string;
    condition: (names: string[], countries: string[]) => boolean;
    generals?: string[];
    country?: string;
}

const BONDS: BondDef[] = [
    { 
        name: '桃园结义', 
        desc: '刘备、关羽、张飞同时上阵', 
        boost: '战力+20%', 
        generals: ['刘备', '关羽', '张飞'],
        condition: (names) => ['刘备', '关羽', '张飞'].every(n => names.includes(n)) 
    },
    { 
        name: '五虎上将', 
        desc: '关羽/张飞/赵云/马超/黄忠 (≥3人)', 
        boost: '战力+15%', 
        generals: ['关羽', '张飞', '赵云', '马超', '黄忠'],
        condition: (names) => ['关羽', '张飞', '赵云', '马超', '黄忠'].filter(n => names.includes(n)).length >= 3 
    },
    { 
        name: '五子良将', 
        desc: '张辽/张郃/徐晃/于禁/乐进 (≥3人)', 
        boost: '战力+15%', 
        generals: ['张辽', '张郃', '徐晃', '于禁', '乐进'],
        condition: (names) => ['张辽', '张郃', '徐晃', '于禁', '乐进'].filter(n => names.includes(n)).length >= 3 
    },
    { 
        name: '魏国精锐', 
        desc: '魏国武将 ≥ 3人', 
        boost: '战力+10%', 
        country: '魏',
        condition: (_, countries) => countries.filter(c => c === '魏').length >= 3 
    },
    { 
        name: '蜀汉英杰', 
        desc: '蜀国武将 ≥ 3人', 
        boost: '战力+10%', 
        country: '蜀',
        condition: (_, countries) => countries.filter(c => c === '蜀').length >= 3 
    },
    { 
        name: '江东虎臣', 
        desc: '吴国武将 ≥ 3人', 
        boost: '战力+10%', 
        country: '吴',
        condition: (_, countries) => countries.filter(c => c === '吴').length >= 3 
    },
    { 
        name: '群雄割据', 
        desc: '群雄武将 ≥ 3人', 
        boost: '战力+10%', 
        country: '群',
        condition: (_, countries) => countries.filter(c => c === '群').length >= 3 
    },
];

const getActiveBonds = (team: UserGeneral[]) => {
    const names = team.map(g => g.name);
    const countries = team.map(g => g.country);
    return BONDS.filter(b => b.condition(names, countries));
};

const getGeneralBonds = (g: General) => {
    return BONDS.filter(b => {
        if (b.generals && b.generals.includes(g.name)) return true;
        if (b.country && b.country === g.country) return true;
        return false;
    });
};

// --- Inventory View ---
const Inventory = () => {
    const { token } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [filter, setFilter] = useState('all'); // all, weapon, armor, treasure

    useEffect(() => {
        if(token) {
            api.getUserItems(token).then(data => {
                if(Array.isArray(data)) setItems(data);
            });
        }
    }, [token]);

    const filteredItems = filter === 'all' ? items : items.filter(i => i.type === filter);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold border-l-4 border-blue-500 pl-3 flex items-center gap-2">
                <ShoppingBag size={24}/> 仓库物资
            </h2>

            {/* Filters */}
            <div className="flex gap-2 bg-stone-800 p-1 rounded-lg border border-stone-700">
                {['all', 'weapon', 'armor', 'treasure'].map(t => (
                    <button
                        key={t}
                        onClick={() => setFilter(t)}
                        className={`flex-1 py-1.5 text-xs md:text-sm font-bold rounded capitalize transition-colors ${filter === t ? 'bg-stone-600 text-white shadow' : 'text-stone-400 hover:text-stone-300'}`}
                    >
                        {t === 'all' ? '全部' : t === 'weapon' ? '武器' : t === 'armor' ? '防具' : '宝物'}
                    </button>
                ))}
            </div>

            {/* Item Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredItems.map(item => {
                    const style = STAR_STYLES[item.stars] || STAR_STYLES[1];
                    return (
                        <div key={item.id} className="bg-stone-800 rounded-lg p-3 border border-stone-700 flex gap-3 shadow-md relative overflow-hidden">
                            {/* Icon */}
                            <div className={`w-16 h-16 shrink-0 rounded border-2 ${style.border} bg-stone-900 flex items-center justify-center relative`}>
                                <div className={`absolute inset-0 opacity-10 ${style.bg}`}></div>
                                {item.type === 'weapon' && <Sword size={24} className={style.text} />}
                                {item.type === 'armor' && <Shield size={24} className={style.text} />}
                                {item.type === 'treasure' && <Box size={24} className={style.text} />}
                            </div>

                            {/* Details */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className={`font-bold text-sm ${style.text}`}>{item.name}</div>
                                        <div className="text-xs text-stone-500 uppercase">{item.type === 'weapon' ? '武器' : item.type === 'armor' ? '防具' : '宝物'}</div>
                                    </div>
                                    <div className="text-xs font-bold bg-stone-900 px-1.5 py-0.5 rounded text-stone-400">
                                        {item.stars}★
                                    </div>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <div className="text-xs text-stone-300 bg-stone-900/50 px-2 py-1 rounded">
                                        加成 <span className="text-amber-500 font-mono">+{item.stat_bonus}</span>
                                    </div>
                                    {item.equipped_by && (
                                        <div className="text-[10px] px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-800 flex items-center gap-1">
                                            <Users size={10}/> {item.equipped_by}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredItems.length === 0 && (
                    <div className="col-span-full text-center py-10 text-stone-500 text-sm italic">
                        暂无此类物品
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Gallery View ---
const Gallery = () => {
    const { token } = useAuth();
    const [meta, setMeta] = useState<{ generals: General[], equipments: Equipment[] }>({ generals: [], equipments: [] });
    const [collection, setCollection] = useState<{ generalIds: number[], equipmentIds: number[], assignments?: Record<number, string[]> }>({ generalIds: [], equipmentIds: [] });
    const [tab, setTab] = useState<'generals' | 'equipments'>('generals');
    const [filter, setFilter] = useState('全部'); // For generals
    
    useEffect(() => {
        if(token) {
            api.getGallery(token).then(setMeta);
            api.getCollection(token).then(setCollection);
        }
    }, [token]);

    const filteredGenerals = filter === '全部' ? meta.generals : meta.generals.filter(g => g.country === filter);

    const getProb = (stars: number) => {
        if (stars === 5) return '2%';
        if (stars === 4) return '10%';
        return '88%';
    };

    const isOwned = (id: number, type: 'general' | 'equip') => {
        if (type === 'general') return collection.generalIds.includes(id);
        return collection.equipmentIds.includes(id);
    };

    const ownedCount = tab === 'generals' ? collection.generalIds.length : collection.equipmentIds.length;
    const totalCount = tab === 'generals' ? meta.generals.length : meta.equipments.length;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold border-l-4 border-purple-500 pl-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><BookOpen size={24}/> 图鉴</div>
                <div className="text-sm font-normal text-stone-400">
                    收集进度: <span className="text-amber-500 font-bold">{ownedCount}</span> / {totalCount}
                </div>
            </h2>
            
            {/* Tabs */}
            <div className="flex bg-stone-800 rounded-lg p-1 border border-stone-700">
                <button 
                    onClick={() => setTab('generals')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${tab === 'generals' ? 'bg-stone-700 text-white shadow' : 'text-stone-400 hover:text-stone-200'}`}
                >
                    武将
                </button>
                <button 
                    onClick={() => setTab('equipments')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${tab === 'equipments' ? 'bg-stone-700 text-white shadow' : 'text-stone-400 hover:text-stone-200'}`}
                >
                    装备
                </button>
            </div>

            {/* General Filters */}
            {tab === 'generals' && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {['全部', '魏', '蜀', '吴', '群'].map(c => (
                        <button 
                            key={c}
                            onClick={() => setFilter(c)}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter === c ? 'bg-amber-600 text-white' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* GENERALS GRID */}
                {tab === 'generals' && filteredGenerals.map(g => {
                    const style = STAR_STYLES[g.stars] || STAR_STYLES[1];
                    const bonds = getGeneralBonds(g);
                    const owned = isOwned(g.id, 'general');

                    return (
                        <div key={g.id} className={`bg-stone-800 rounded-lg p-3 border flex gap-4 shadow-lg transition-all ${owned ? 'border-stone-700' : 'border-stone-800 opacity-60 grayscale'}`}>
                            {/* Avatar */}
                            <div className="relative w-20 h-28 shrink-0">
                                <img src={g.avatar} className={`w-full h-full object-cover rounded border-2 ${style.border}`} />
                                <div className={`absolute -top-1 -left-1 px-1.5 py-0.5 text-[10px] font-bold text-white rounded-full ${COUNTRY_COLORS[g.country]}`}>
                                    {g.country}
                                </div>
                                {!owned && <div className="absolute inset-0 bg-black/50 flex items-center justify-center font-bold text-xs text-white">未获取</div>}
                            </div>

                            {/* Info */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className={`font-bold ${style.text}`}>{g.name}</div>
                                        <div className="text-xs font-bold bg-stone-900 px-1.5 py-0.5 rounded text-stone-400">
                                            {g.stars}★
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-stone-500 line-clamp-2 mt-1 italic">{g.description}</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono my-2 text-stone-300 bg-stone-900/50 p-1 rounded">
                                    <div title="武力">武:{g.str}</div>
                                    <div title="智力">智:{g.int}</div>
                                    <div title="统率">统:{g.ldr}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-[10px] text-stone-400">
                                        <Gift size={10} className="text-stone-500" />
                                        <span>获取: <span className="text-amber-500 font-bold">聚贤庄</span> ({getProb(g.stars)})</span>
                                    </div>
                                    
                                    {/* Bonds Mini View */}
                                    <div className="flex flex-wrap gap-1">
                                        {bonds.map(b => (
                                            <span key={b.name} className="px-1.5 py-0.5 bg-blue-900/30 text-blue-300 text-[9px] rounded border border-blue-900/50">
                                                {b.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* EQUIPMENTS GRID */}
                {tab === 'equipments' && meta.equipments.map(e => {
                    const style = STAR_STYLES[e.stars] || STAR_STYLES[1];
                    const owned = isOwned(e.id, 'equip');
                    const assignedTo = collection.assignments && collection.assignments[e.id];

                    return (
                        <div key={e.id} className={`bg-stone-800 rounded-lg p-3 border flex gap-4 shadow-lg transition-all ${owned ? 'border-stone-700' : 'border-stone-800 opacity-60 grayscale'}`}>
                            {/* Icon */}
                            <div className={`w-20 h-20 shrink-0 rounded border-2 ${style.border} bg-stone-900 flex items-center justify-center relative overflow-hidden`}>
                                <div className={`absolute inset-0 opacity-10 ${style.bg}`}></div>
                                {e.type === 'weapon' && <Sword size={32} className={style.text} />}
                                {e.type === 'armor' && <Shield size={32} className={style.text} />}
                                {e.type === 'treasure' && <Box size={32} className={style.text} />}
                                {!owned && <div className="absolute inset-0 bg-black/50 flex items-center justify-center font-bold text-xs text-white">未获取</div>}
                            </div>

                            {/* Info */}
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className={`font-bold ${style.text}`}>{e.name}</div>
                                        <div className="text-xs font-bold bg-stone-900 px-1.5 py-0.5 rounded text-stone-400">
                                            {e.stars}★
                                        </div>
                                    </div>
                                    <div className="text-xs text-stone-500 mt-1 uppercase tracking-wider">{e.type === 'weapon' ? '武器' : e.type === 'armor' ? '防具' : '宝物'}</div>
                                </div>

                                <div className="mt-2 bg-stone-900/50 p-2 rounded text-xs text-stone-300 flex justify-between items-center">
                                    <span>主属性加成</span>
                                    <span className="font-mono text-amber-500 font-bold">+{e.stat_bonus}</span>
                                </div>
                                
                                {assignedTo && assignedTo.length > 0 && (
                                    <div className="mt-1 text-[10px] text-stone-400 flex items-start gap-1">
                                        <Users size={10} className="mt-0.5 text-blue-400" />
                                        <span className="line-clamp-1">当前装备: <span className="text-blue-300">{assignedTo.join(', ')}</span></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- New Barracks View (Koei Style) ---
const Barracks = () => {
    const { token } = useAuth();
    const [generals, setGenerals] = useState<UserGeneral[]>([]);
    const toast = useToast();

    const load = () => {
        if (token) api.getMyGenerals(token).then(setGenerals);
    };

    useEffect(() => {
        load();
    }, [token]);

    const toggle = async (uid: number, isIn: boolean) => {
        if(!token) return;
        
        // Client-side pre-check for better UX
        if (!isIn) {
            const currentTeam = generals.filter(g => g.is_in_team);
            if (currentTeam.length >= 5) return toast.show('部队已满 (5人)', 'error');
            
            const target = generals.find(g => g.uid === uid);
            if (target && currentTeam.some(g => g.id === target.id)) return toast.show('同名武将不可重复上阵', 'error');
        }

        const res = await api.toggleTeam(token, uid, isIn ? 'remove' : 'add');
        if (res.error) {
            toast.show(res.error, 'error');
        } else {
            load();
        }
    };

    const autoTeam = async () => {
        if(!token) return;
        await api.autoTeam(token);
        toast.show('部队已自动编制 (已过滤重复武将)', 'success');
        load();
    };

    const handleEquip = async (uid: number) => {
        if(!token) return;
        await api.autoEquip(token, uid);
        toast.show('已自动穿戴最佳装备', 'success');
        load();
    };

    const handleUnequip = async (uid: number) => {
        if(!token) return;
        await api.unequipAll(token, uid);
        toast.show('已卸下所有装备', 'info');
        load();
    };

    const handleEvolve = async (targetUid: number) => {
        if(!token) return;
        
        // No longer need to find duplicate instances
        // API handles shard consumption
        
        const res = await api.evolve(token, targetUid);
        if (res.error) return toast.show(res.error, 'error');
        
        toast.show('武将进阶成功！战力大幅提升！', 'success');
        load();
    };

    // Sort Team by Power (Descending)
    const team = generals
        .filter(g => g.is_in_team)
        .sort((a, b) => calculatePower(b) - calculatePower(a));

    // Calculate Active Bonds
    const activeBonds = getActiveBonds(team);
    
    // Sort Roster by Stars (desc) then Power (desc)
    const sortedGenerals = [...generals].sort((a, b) => {
        if (b.stars !== a.stars) return b.stars - a.stars;
        return calculatePower(b) - calculatePower(a);
    });

    return (
        <div className="space-y-4 md:space-y-6">
            {/* 1. Header & Auto Team */}
            <div className="flex justify-between items-center border-l-4 border-amber-600 pl-4 bg-stone-800/50 p-2 rounded-r">
                <h2 className="text-lg md:text-xl font-bold text-amber-100">出征部队</h2>
                <button onClick={autoTeam} className="bg-amber-700 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded shadow flex items-center gap-1 transition active:bg-amber-800">
                    <Users size={14}/> 一键编制
                </button>
            </div>

            {/* 2. Team View (Row) */}
            <div className="bg-stone-900 border border-stone-700 p-3 md:p-4 rounded-lg shadow-inner overflow-x-auto scrollbar-hide">
                <div className="flex gap-3 md:gap-4 min-w-max">
                    {team.length === 0 ? (
                        <div className="text-stone-500 text-sm italic w-full text-center py-4">暂无武将出战，请在下方列表选择上阵</div>
                    ) : (
                        team.map(g => {
                            const style = STAR_STYLES[g.stars] || STAR_STYLES[1];
                            return (
                                <div key={g.uid} className={`relative w-16 md:w-24 h-24 md:h-40 bg-stone-800 rounded border-2 ${style.border} flex flex-col ${style.shadow} shrink-0 overflow-hidden`}>
                                    <div className="h-full overflow-hidden relative">
                                        <div className={`absolute inset-0 opacity-20 ${style.bg}`}></div>
                                        <img src={g.avatar} className="w-full h-full object-cover" />
                                        <div className={`absolute top-0 left-0 px-1 py-0.5 text-[8px] md:text-[10px] font-bold text-white ${COUNTRY_COLORS[g.country]}`}>
                                            {g.country}
                                        </div>
                                        {g.evolution > 0 && <div className="absolute top-0 right-0 px-1 py-0.5 text-[8px] md:text-[10px] font-bold text-red-400 bg-black/50">+{g.evolution}</div>}
                                    </div>
                                    <div className="bg-gradient-to-t from-black to-transparent absolute bottom-0 w-full p-1 pt-3">
                                        <div className={`font-bold text-[8px] md:text-xs text-center drop-shadow-md truncate ${style.text}`}>{g.name}</div>
                                        <div className="flex justify-between items-end text-[8px] md:text-[10px] text-stone-300 px-0.5 mt-0.5">
                                            <span>Lv.{g.level}</span>
                                            <span className="text-amber-400">{calculatePower(g)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bond Display */}
            {team.length > 0 && (
                <div className="bg-stone-800/50 rounded-lg p-3 border border-stone-700 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-stone-400 text-xs uppercase font-bold tracking-wider">
                        <LinkIcon size={12} /> 激活羁绊
                    </div>
                    {activeBonds.length === 0 ? (
                        <div className="text-stone-600 text-xs md:text-sm italic">暂无激活羁绊 (尝试组合特定武将或同阵营)</div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {activeBonds.map((b, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-amber-900/30 border border-amber-700/50 px-2 py-1 rounded text-xs text-amber-200">
                                    <Zap size={10} className="text-amber-400" />
                                    <span className="font-bold">{b.name}</span>
                                    <span className="text-amber-400/70">({b.boost})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 3. General List (Responsive Card Grid) */}
            <div className="space-y-2">
                <div className="px-2 font-bold text-stone-300 text-sm border-b border-stone-700 pb-2">
                    武将名鉴 ({generals.length})
                </div>
                
                {/* Mobile & Desktop Friendly Card List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sortedGenerals.map(g => {
                        const power = calculatePower(g);
                        const style = STAR_STYLES[g.stars] || STAR_STYLES[1];
                        const shardCount = g.shard_count || 0;
                        const canEvolve = shardCount >= 10;

                        return (
                            <div key={g.uid} className={`bg-stone-800 rounded-lg p-3 border border-stone-700 flex gap-3 shadow-md ${g.is_in_team ? 'bg-amber-900/10 border-amber-800/50 ring-1 ring-amber-800/30' : ''}`}>
                                {/* Avatar */}
                                <div className="relative w-16 h-20 shrink-0">
                                    <div className={`absolute inset-0 border-2 ${style.border} rounded pointer-events-none z-10`}></div>
                                    <img src={g.avatar} className="w-full h-full rounded object-cover" />
                                    <div className={`absolute -top-1 -left-1 px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full ${COUNTRY_COLORS[g.country]} z-20`}>
                                        {g.country}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                         <div>
                                            <div className="font-bold text-stone-100 text-sm flex items-center gap-1">
                                                <span className={style.text}>{g.name}</span>
                                                {g.evolution > 0 && <span className="text-red-400 text-xs">+{g.evolution}</span>}
                                                {g.is_in_team && <Shield size={12} className="text-amber-500 fill-amber-500/20"/>}
                                            </div>
                                            <div className="text-xs text-yellow-600/80 font-medium">{'★'.repeat(g.stars)} <span className="text-stone-500 ml-1">Lv.{g.level}</span></div>
                                         </div>
                                         <div className="text-amber-500 font-bold text-sm">
                                            <span className="text-[10px] text-stone-500 mr-1 font-normal">战力</span>{power}
                                         </div>
                                    </div>

                                    {/* Shard Progress */}
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-stone-900 rounded-full overflow-hidden border border-stone-600/50">
                                            <div className="h-full bg-purple-500 transition-all duration-300" style={{width: `${Math.min(shardCount * 10, 100)}%`}}></div>
                                        </div>
                                        <div className="text-[9px] text-stone-400 font-mono whitespace-nowrap">
                                            碎片: {shardCount}/10
                                        </div>
                                    </div>

                                    {/* Middle: Stats & Equip Icons */}
                                    <div className="flex justify-between items-end mt-1">
                                         <div className="text-[10px] font-mono opacity-80 space-x-2 text-stone-300">
                                            <span className="text-red-300">武{g.str}</span>
                                            <span className="text-blue-300">智{g.int}</span>
                                            <span className="text-green-300">统{g.ldr}</span>
                                         </div>
                                         <div className="flex gap-1">
                                            {['weapon', 'armor', 'treasure'].map(type => {
                                                const eq = g.equipments.find(e => e.type === type);
                                                return (
                                                    <div key={type} 
                                                         className={`w-5 h-5 rounded flex items-center justify-center text-[9px] border ${eq ? 'bg-amber-900/40 border-amber-600 text-amber-200' : 'bg-stone-900 border-stone-700 text-stone-600'}`}
                                                         title={eq ? eq.name : '空'}>
                                                        {eq ? eq.name[0] : type[0].toUpperCase()}
                                                    </div>
                                                );
                                            })}
                                         </div>
                                    </div>

                                    {/* Bottom: Actions */}
                                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-stone-700/50">
                                        <button 
                                            onClick={() => canEvolve ? handleEvolve(g.uid) : toast.show(`需要10个碎片才能进阶 (当前: ${shardCount})`, 'info')} 
                                            className={`px-2 py-1 rounded text-xs border flex items-center gap-1 transition ${
                                                canEvolve 
                                                ? 'bg-purple-900/50 hover:bg-purple-800 text-purple-200 border-purple-700 animate-pulse active:scale-95' 
                                                : 'bg-stone-800 text-stone-600 border-stone-700 opacity-50 cursor-not-allowed'
                                            }`}
                                        >
                                            <ChevronUp size={12}/> 进阶
                                        </button>
                                        
                                        <button onClick={() => toggle(g.uid, g.is_in_team)} 
                                            className={`px-3 py-1 rounded text-xs border active:scale-95 transition ${g.is_in_team ? 'border-red-800 text-red-400 bg-red-900/10' : 'border-green-800 text-green-400 bg-green-900/10'}`}>
                                            {g.is_in_team ? '下阵' : '上阵'}
                                        </button>
                                        <div className="flex border border-stone-600 rounded overflow-hidden">
                                            <button onClick={() => handleEquip(g.uid)} className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-amber-500 active:bg-stone-800 transition" title="一键装备">
                                                <Zap size={14}/>
                                            </button>
                                            <div className="w-[1px] bg-stone-600"></div>
                                            <button onClick={() => handleUnequip(g.uid)} className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-stone-400 active:bg-stone-800 transition" title="一键卸载">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const CampaignPage = () => {
    const { token, refreshUser } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [battleResult, setBattleResult] = useState<{win: boolean, rewards?: {gold: number, exp: number}} | null>(null);
    const toast = useToast();

    useEffect(() => {
        if(token) api.getCampaigns(token).then(setCampaigns);
    }, [token]);

    const fight = async (id: number) => {
        if(!token) return;
        const res = await api.battle(token, id);
        if(res.error) return toast.show(res.error, 'error');
        
        if(res.win) {
            const updated = await api.getCampaigns(token);
            setCampaigns(updated);
            refreshUser();
        }
        
        setBattleResult(res);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold border-l-4 border-red-500 pl-3">史诗战役</h2>
            <div className="space-y-3">
                {campaigns.map(c => (
                    <div key={c.id} className="bg-stone-800 p-4 rounded-lg flex justify-between items-center border border-stone-700 shadow-sm">
                        <div>
                            <div className="font-bold text-base md:text-lg text-stone-200">{c.name}</div>
                            <div className="text-xs text-stone-500">推荐战力: <span className="text-amber-600 font-mono">{c.req_power}</span></div>
                        </div>
                        <div className="flex gap-2">
                             {c.passed && c.stars === 3 && 
                                <button onClick={() => fight(c.id)} className="px-3 py-1.5 bg-blue-900/50 text-blue-200 text-xs rounded border border-blue-700 active:scale-95 transition">扫荡</button>
                             }
                             <button onClick={() => fight(c.id)} className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white font-bold rounded shadow-md flex items-center gap-2 active:scale-95 transition text-sm">
                                <Sword size={16} /> 出征
                             </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Battle Result Modal */}
            {battleResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in px-4">
                    {/* Victory Light Effects */}
                    {battleResult.win && (
                        <div className="absolute pointer-events-none overflow-hidden inset-0 flex items-center justify-center">
                            <div className="w-[800px] h-[800px] bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 rotate-45 blur-3xl animate-pulse"></div>
                            <div className="absolute w-[600px] h-[600px] border-[50px] border-dashed border-amber-500/10 rounded-full animate-spin-slow"></div>
                        </div>
                    )}

                    <div className={`relative w-full max-w-sm rounded-2xl border-y-4 ${battleResult.win ? 'border-amber-500 bg-stone-900/90' : 'border-stone-600 bg-stone-950/90'} p-1 shadow-2xl transform animate-pop-in`}>
                        <div className={`rounded-xl p-6 flex flex-col items-center relative overflow-hidden ${battleResult.win ? 'bg-gradient-to-b from-amber-900/20 to-stone-900' : 'bg-stone-900'}`}>
                            
                            {/* Header Icon & Title */}
                            <div className="mb-6 relative">
                                {battleResult.win ? (
                                    <>
                                        <div className="absolute inset-0 bg-amber-500 blur-[40px] opacity-40 animate-pulse"></div>
                                        <Trophy size={80} className="text-amber-300 relative z-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] animate-bounce" />
                                    </>
                                ) : (
                                    <Skull size={80} className="text-stone-500 relative z-10 drop-shadow-lg" />
                                )}
                            </div>

                            <h2 className={`text-4xl font-black tracking-widest uppercase mb-2 ${battleResult.win ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-600 drop-shadow-sm' : 'text-stone-500'}`}>
                                {battleResult.win ? '大获全胜' : '战斗失败'}
                            </h2>
                            
                            <div className="w-24 h-1 rounded-full bg-gradient-to-r from-transparent via-current to-transparent opacity-50 mb-6 text-stone-500"></div>

                            {/* Rewards Section */}
                            {battleResult.win ? (
                                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                                    <div className="bg-stone-800/80 border border-amber-500/30 rounded-lg p-3 flex flex-col items-center gap-1 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition"></div>
                                        <div className="p-2 bg-stone-900 rounded-full border border-stone-700">
                                            <div className="text-yellow-500">💰</div>
                                        </div>
                                        <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">金币</span>
                                        <span className="text-xl font-bold text-yellow-400">+{battleResult.rewards?.gold}</span>
                                    </div>
                                    <div className="bg-stone-800/80 border border-blue-500/30 rounded-lg p-3 flex flex-col items-center gap-1 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition"></div>
                                        <div className="p-2 bg-stone-900 rounded-full border border-stone-700">
                                            <div className="text-blue-500">✨</div>
                                        </div>
                                        <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">经验</span>
                                        <span className="text-xl font-bold text-blue-300">+{battleResult.rewards?.exp}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-stone-800/50 rounded-lg p-4 mb-8 border border-stone-700/50 text-center w-full">
                                    <p className="text-stone-400 text-sm leading-relaxed">
                                        胜败乃兵家常事。<br/>
                                        <span className="text-stone-500 text-xs">强化武将或调整阵型后再战！</span>
                                    </p>
                                </div>
                            )}

                            {/* Action Button */}
                            <button 
                                onClick={() => setBattleResult(null)}
                                className={`w-full py-3.5 rounded-lg font-bold text-white shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-lg
                                    ${battleResult.win 
                                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 border-t border-amber-400/50 shadow-[0_4px_20px_rgba(245,158,11,0.4)]' 
                                        : 'bg-stone-700 hover:bg-stone-600 border-t border-stone-500/50'
                                    }`}
                            >
                                <span>{battleResult.win ? '收入囊中' : '重整旗鼓'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- App Router ---
export default function App() {
    return (
        <HashRouter>
            <ToastProvider>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<Layout><Dashboard /></Layout>} />
                        <Route path="/gacha" element={<Layout><Gacha /></Layout>} />
                        <Route path="/gallery" element={<Layout><Gallery /></Layout>} />
                        <Route path="/barracks" element={<Layout><Barracks /></Layout>} />
                        <Route path="/campaign" element={<Layout><CampaignPage /></Layout>} />
                        <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </HashRouter>
    );
}