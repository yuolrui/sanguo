import { useState, useEffect, createContext, useContext, ReactNode, FormEvent } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Sword, Users, Scroll, ShoppingBag, Landmark, LogOut, Gift, Zap, Trash2, Shield, CheckCircle, XCircle, Info, ChevronUp } from 'lucide-react';
import { User, General, UserGeneral, Campaign, COUNTRY_COLORS } from './types';

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
    evolve: async (token: string, targetUid: number, materialUid: number) => {
        const res = await fetch(`${API_URL}/general/evolve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid, materialUid }) });
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
        <div className="min-h-screen bg-stone-900 text-stone-200 font-sans">
            <header className="bg-stone-800 border-b border-stone-700 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-amber-500 tracking-wider">三国志</div>
                    <span className="text-xs text-stone-400 bg-stone-900 px-2 py-1 rounded">霸业</span>
                </div>
                <div className="flex gap-4 items-center text-sm">
                    <div className="flex flex-col text-right">
                        <span className="text-amber-400 font-bold">{user.username}</span>
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
            <nav className="fixed bottom-0 left-0 w-full bg-stone-900 border-t border-stone-800 flex justify-around p-3 text-xs z-50">
                <Link to="/" className="flex flex-col items-center gap-1 text-stone-400 hover:text-amber-500"><Landmark size={20} /><span>主城</span></Link>
                <Link to="/campaign" className="flex flex-col items-center gap-1 text-stone-400 hover:text-amber-500"><Sword size={20} /><span>征战</span></Link>
                <Link to="/gacha" className="flex flex-col items-center gap-1 text-stone-400 hover:text-amber-500"><Gift size={20} /><span>招募</span></Link>
                <Link to="/barracks" className="flex flex-col items-center gap-1 text-stone-400 hover:text-amber-500"><Users size={20} /><span>军营</span></Link>
                <Link to="/inventory" className="flex flex-col items-center gap-1 text-stone-400 hover:text-amber-500"><ShoppingBag size={20} /><span>仓库</span></Link>
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
        <div className="min-h-screen flex items-center justify-center bg-stone-950 bg-[url('https://picsum.photos/1920/1080?blur=5')] bg-cover">
            <div className="bg-stone-900/90 p-8 rounded-xl border border-stone-700 shadow-2xl w-full max-w-md backdrop-blur-sm">
                <h1 className="text-3xl font-bold text-center text-amber-500 mb-6">三国志 · 霸业</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input className="w-full bg-stone-800 border border-stone-600 p-3 rounded text-stone-200 outline-none focus:border-amber-500" placeholder="账号" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                    <input className="w-full bg-stone-800 border border-stone-600 p-3 rounded text-stone-200 outline-none focus:border-amber-500" type="password" placeholder="密码" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                    <button className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 rounded transition-colors shadow-lg">{isReg ? '注册' : '登录'}</button>
                </form>
                <div className="mt-4 text-center text-stone-400 text-sm cursor-pointer hover:text-amber-400" onClick={() => setIsReg(!isReg)}>
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
            <div className="relative h-64 rounded-xl overflow-hidden shadow-2xl border border-stone-600">
                <img src="https://picsum.photos/seed/city/800/400" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent flex items-end p-6">
                    <div>
                        <h2 className="text-3xl font-bold text-amber-500 drop-shadow-md">洛阳城</h2>
                        <p className="text-stone-300">天下一统，在此一举。</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div onClick={handleSignin} className="bg-stone-800 p-6 rounded-lg border border-stone-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-stone-700 transition active:scale-95">
                    <Scroll size={32} className="text-amber-500" />
                    <span className="font-bold">每日签到</span>
                </div>
                <Link to="/barracks" className="bg-stone-800 p-6 rounded-lg border border-stone-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-stone-700 transition">
                    <Users size={32} className="text-blue-500" />
                    <span className="font-bold">整顿军马</span>
                </Link>
            </div>
        </div>
    );
};

const Gacha = () => {
    const { token, refreshUser, user } = useAuth();
    const [result, setResult] = useState<General[] | null>(null);
    const toast = useToast();

    const handleGacha = async () => {
        if (!token) return;
        const res = await api.gacha(token);
        if (res.error) return toast.show(res.error, 'error');
        setResult([res.general]);
        refreshUser();
    };

    const handleGachaTen = async () => {
        if (!token) return;
        const res = await api.gachaTen(token);
        if (res.error) return toast.show(res.error, 'error');
        setResult(res.generals);
        refreshUser();
    }

    return (
        <div className="flex flex-col items-center space-y-8 py-8">
            <h2 className="text-2xl font-bold text-amber-500">聚贤庄招募</h2>
            <div className="text-stone-400 text-sm">保底进度: {user?.pity_counter}/60 (60抽必出5星)</div>
            
            {result ? (
                <div className="w-full animate-fade-in-up text-center space-y-4 bg-stone-800 p-6 rounded-xl border border-amber-500/50 shadow-2xl">
                    <h3 className="text-xl text-amber-300">招募成功!</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {result.map((g, i) => (
                            <div key={i} className="flex flex-col items-center p-2 bg-stone-900 rounded border border-stone-700">
                                <img src={g.avatar} className="w-16 h-24 object-cover rounded border-2 border-amber-500" />
                                <div className="text-sm font-bold mt-1">{g.name}</div>
                                <div className="text-yellow-500 text-xs">{'★'.repeat(g.stars)}</div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setResult(null)} className="px-6 py-2 bg-stone-700 rounded hover:bg-stone-600 mt-4">继续</button>
                </div>
            ) : (
                <div className="w-full max-w-sm bg-stone-800 rounded-xl border-2 border-dashed border-stone-700 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="text-6xl animate-bounce">🧧</div>
                    <div className="flex flex-col gap-2 w-full">
                        <button onClick={handleGacha} className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all">
                            单次招募 (1令)
                        </button>
                        <button onClick={handleGachaTen} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all">
                            十连招募 (10令)
                        </button>
                    </div>
                </div>
            )}
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
            // Check if ANY general in the team has the same 'id' (General template ID) as the target
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

    const handleEvolve = async (targetUid: number, generalId: number) => {
        if(!token) return;
        // Find a duplicate that is NOT the target and preferably NOT in team
        // We prioritize those not in team first
        const duplicate = generals.find(g => g.uid !== targetUid && g.id === generalId && !g.is_in_team)
                       || generals.find(g => g.uid !== targetUid && g.id === generalId);
        
        if (!duplicate) {
            return toast.show('需要相同的武将作为素材', 'error');
        }
        
        if (duplicate.is_in_team) {
             if(!confirm('素材武将正在队伍中，确定要消耗吗？')) return;
        }

        const res = await api.evolve(token, targetUid, duplicate.uid);
        if (res.error) return toast.show(res.error, 'error');
        
        toast.show('武将进阶成功！战力大幅提升！', 'success');
        load();
    };

    const team = generals.filter(g => g.is_in_team);

    return (
        <div className="space-y-6">
            {/* 1. Header & Auto Team */}
            <div className="flex justify-between items-center border-l-4 border-amber-600 pl-4 bg-stone-800/50 p-2 rounded-r">
                <h2 className="text-xl font-bold text-amber-100">出征部队</h2>
                <button onClick={autoTeam} className="bg-amber-700 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded shadow flex items-center gap-1 transition">
                    <Users size={14}/> 一键编制
                </button>
            </div>

            {/* 2. Team View (Row) */}
            <div className="bg-stone-900 border border-stone-700 p-4 rounded-lg shadow-inner overflow-x-auto">
                <div className="flex gap-4 min-w-max">
                    {team.length === 0 ? (
                        <div className="text-stone-500 text-sm italic w-full text-center py-4">暂无武将出战，请在下方列表选择上阵</div>
                    ) : (
                        team.map(g => (
                            <div key={g.uid} className="relative w-24 h-40 bg-stone-800 rounded border border-amber-600/50 flex flex-col shadow-lg shrink-0">
                                <div className="h-full overflow-hidden relative">
                                    <img src={g.avatar} className="w-full h-full object-cover" />
                                    <div className={`absolute top-0 left-0 px-1.5 py-0.5 text-[10px] font-bold text-white ${COUNTRY_COLORS[g.country]}`}>
                                        {g.country}
                                    </div>
                                    {g.evolution > 0 && <div className="absolute top-0 right-0 px-1.5 py-0.5 text-[10px] font-bold text-red-400 bg-black/50">+{g.evolution}</div>}
                                </div>
                                <div className="bg-gradient-to-t from-black to-transparent absolute bottom-0 w-full p-1 pt-4">
                                    <div className="text-white font-bold text-xs text-center drop-shadow-md">{g.name}</div>
                                    <div className="flex justify-between items-end text-[10px] text-stone-300 px-1 mt-1">
                                        <span>Lv.{g.level}</span>
                                        <span className="text-amber-400">{(g.str+g.int+g.ldr)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 3. General List (Table) */}
            <div className="bg-stone-800 rounded-lg shadow border border-stone-700 overflow-hidden">
                <div className="px-4 py-3 bg-stone-800 border-b border-stone-700 font-bold text-stone-300">
                    武将名鉴 ({generals.length})
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-stone-300">
                        <thead className="bg-stone-900 text-stone-500 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">武将</th>
                                <th className="px-4 py-3">属性 (武/智/统)</th>
                                <th className="px-4 py-3 hidden md:table-cell">装备</th>
                                <th className="px-4 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-700">
                            {generals.map(g => (
                                <tr key={g.uid} className={`hover:bg-stone-700/50 transition ${g.is_in_team ? 'bg-amber-900/10' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 shrink-0">
                                                <img src={g.avatar} className="w-10 h-10 rounded object-cover border border-stone-500" />
                                                <div className={`absolute -top-1 -left-1 w-4 h-4 flex items-center justify-center text-[10px] text-white rounded-full ${COUNTRY_COLORS[g.country]}`}>
                                                    {g.country}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-bold text-stone-100 flex items-center gap-1">
                                                    {g.name} 
                                                    {g.evolution > 0 && <span className="text-red-400">+{g.evolution}</span>}
                                                    {g.is_in_team && <Shield size={10} className="text-amber-500"/>}
                                                </div>
                                                <div className="text-xs text-yellow-600">{'★'.repeat(g.stars)} <span className="text-stone-500 ml-1">Lv.{g.level}</span></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 text-xs font-mono">
                                            <span className="text-red-400" title="武力">{g.str}</span>/
                                            <span className="text-blue-400" title="智力">{g.int}</span>/
                                            <span className="text-green-400" title="统率">{g.ldr}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <div className="flex gap-1">
                                            {['weapon', 'armor', 'treasure'].map(type => {
                                                const eq = g.equipments.find(e => e.type === type);
                                                return (
                                                    <div key={type} 
                                                         className={`w-6 h-6 rounded flex items-center justify-center text-[10px] border ${eq ? 'bg-amber-900/40 border-amber-600 text-amber-200' : 'bg-stone-900 border-stone-700 text-stone-600'}`}
                                                         title={eq ? eq.name : '空'}>
                                                        {eq ? eq.name[0] : type[0].toUpperCase()}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button onClick={() => handleEvolve(g.uid, g.id)} className="px-2 py-1 bg-purple-900 hover:bg-purple-800 text-purple-200 rounded text-xs border border-purple-700 flex items-center gap-1" title="消耗相同武将进阶">
                                                <ChevronUp size={12}/> 进阶
                                            </button>
                                            <button onClick={() => toggle(g.uid, g.is_in_team)} 
                                                className={`px-2 py-1 rounded text-xs border ${g.is_in_team ? 'border-red-800 text-red-400 hover:bg-red-900/30' : 'border-green-800 text-green-400 hover:bg-green-900/30'}`}>
                                                {g.is_in_team ? '下阵' : '上阵'}
                                            </button>
                                            <div className="flex border border-stone-600 rounded overflow-hidden">
                                                <button onClick={() => handleEquip(g.uid)} className="px-2 py-1 bg-stone-700 hover:bg-stone-600 text-amber-500" title="一键装备">
                                                    <Zap size={14}/>
                                                </button>
                                                <div className="w-[1px] bg-stone-600"></div>
                                                <button onClick={() => handleUnequip(g.uid)} className="px-2 py-1 bg-stone-700 hover:bg-stone-600 text-stone-400" title="一键卸载">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const CampaignPage = () => {
    const { token, refreshUser } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const toast = useToast();

    useEffect(() => {
        if(token) api.getCampaigns(token).then(setCampaigns);
    }, [token]);

    const fight = async (id: number) => {
        if(!token) return;
        const res = await api.battle(token, id);
        if(res.error) return toast.show(res.error, 'error');
        if(res.win) {
            toast.show(`战役胜利! 获得金币 ${res.rewards.gold}`, 'success');
            const updated = await api.getCampaigns(token);
            setCampaigns(updated);
            refreshUser();
        } else {
            toast.show('战斗失败，请提升武将战力', 'info');
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold border-l-4 border-red-500 pl-3">史诗战役</h2>
            <div className="space-y-3">
                {campaigns.map(c => (
                    <div key={c.id} className="bg-stone-800 p-4 rounded flex justify-between items-center border border-stone-700">
                        <div>
                            <div className="font-bold text-lg">{c.name}</div>
                            <div className="text-xs text-stone-500">推荐战力: {c.req_power}</div>
                        </div>
                        <div className="flex gap-2">
                             {c.passed && c.stars === 3 && 
                                <button onClick={() => fight(c.id)} className="px-3 py-1 bg-blue-900 text-blue-200 text-xs rounded border border-blue-700">扫荡</button>
                             }
                             <button onClick={() => fight(c.id)} className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white font-bold rounded shadow-md flex items-center gap-2">
                                <Sword size={16} /> 出征
                             </button>
                        </div>
                    </div>
                ))}
            </div>
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
                        <Route path="/barracks" element={<Layout><Barracks /></Layout>} />
                        <Route path="/campaign" element={<Layout><CampaignPage /></Layout>} />
                        <Route path="/inventory" element={<Layout><div className="text-center p-10 text-stone-500">装备在军营中管理</div></Layout>} />
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </HashRouter>
    );
}