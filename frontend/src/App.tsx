import { useState, useEffect, createContext, useContext, ReactNode, FormEvent } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Sword, Users, Scroll, ShoppingBag, Landmark, LogOut, Gift } from 'lucide-react';
import { User, General, UserGeneral, Campaign, COUNTRY_COLORS } from './types';

// --- API Service ---
// Changed to relative path. Nginx or Vite Proxy will handle the forwarding to port 3000.
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
    signin: async (token: string) => {
        const res = await fetch(`${API_URL}/signin`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        return res.json();
    }
};

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
            <main className="pb-24 p-4 max-w-4xl mx-auto">
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

const GeneralCard = ({ general, action }: { general: UserGeneral, action?: ReactNode }) => (
    <div className="relative bg-stone-800 rounded-lg overflow-hidden border border-stone-700 shadow-lg group hover:border-amber-600 transition-all">
        <div className="relative h-48 w-full bg-stone-900">
            <img src={general.avatar} alt={general.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-bold text-white rounded ${COUNTRY_COLORS[general.country]}`}>
                {general.country}
            </div>
            {general.is_in_team && <div className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-amber-600 text-white rounded font-bold">出战中</div>}
        </div>
        <div className="p-3">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg text-amber-100">{general.name}</h3>
                <div className="flex text-yellow-500 text-xs">{'★'.repeat(general.stars)}</div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-stone-400 mb-3">
                <span>武: {general.str}</span>
                <span>智: {general.int}</span>
                <span>统: {general.ldr}</span>
                <span>运: {general.luck}</span>
            </div>
            {action}
        </div>
    </div>
);

// --- Pages ---
const Login = () => {
    const [isReg, setIsReg] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            if (isReg) {
                await api.register(form);
                alert('注册成功，请登录');
                setIsReg(false);
            } else {
                const res = await api.login(form);
                if (res.error) return alert(res.error);
                login(res.token);
                navigate('/');
            }
        } catch (err) { alert('Failed'); }
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
    const handleSignin = async () => {
        const token = localStorage.getItem('token');
        if(!token) return;
        try {
            const res = await api.signin(token);
            if(res.error) alert(res.error);
            else {
                alert(`签到成功! 获得 金币${res.rewards.gold}, 招募令${res.rewards.tokens}`);
                refreshUser();
            }
        } catch(e) { alert('Error'); }
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
    const [result, setResult] = useState<General | null>(null);

    const handleGacha = async () => {
        if (!token) return;
        const res = await api.gacha(token);
        if (res.error) return alert(res.error);
        setResult(res.general);
        refreshUser();
    };

    return (
        <div className="flex flex-col items-center space-y-8 py-8">
            <h2 className="text-2xl font-bold text-amber-500">聚贤庄招募</h2>
            <div className="text-stone-400 text-sm">保底进度: {user?.pity_counter}/60 (60抽必出5星)</div>
            
            {result ? (
                <div className="animate-fade-in-up text-center space-y-4 bg-stone-800 p-6 rounded-xl border border-amber-500/50 shadow-2xl">
                    <h3 className="text-xl text-amber-300">招募成功!</h3>
                    <img src={result.avatar} className="w-32 h-32 rounded-full border-4 border-amber-500 mx-auto" />
                    <div className="text-2xl font-bold">{result.name}</div>
                    <div className="text-yellow-500">{'★'.repeat(result.stars)}</div>
                    <button onClick={() => setResult(null)} className="px-6 py-2 bg-stone-700 rounded hover:bg-stone-600 mt-4">继续</button>
                </div>
            ) : (
                <div className="w-full max-w-sm h-80 bg-stone-800 rounded-xl border-2 border-dashed border-stone-700 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="text-6xl animate-bounce">🧧</div>
                    <p className="text-stone-500">消耗 1 招募令</p>
                    <button onClick={handleGacha} className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all">
                        招募武将
                    </button>
                </div>
            )}
        </div>
    );
};

const Barracks = () => {
    const { token } = useAuth();
    const [generals, setGenerals] = useState<UserGeneral[]>([]);

    useEffect(() => {
        if (token) api.getMyGenerals(token).then(setGenerals);
    }, [token]);

    const toggle = async (uid: number, isIn: boolean) => {
        if(!token) return;
        await api.toggleTeam(token, uid, isIn ? 'remove' : 'add');
        const updated = await api.getMyGenerals(token);
        setGenerals(updated);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold border-l-4 border-amber-500 pl-3">我的武将</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generals.map(g => (
                    <GeneralCard key={g.uid} general={g} 
                        action={
                            <button onClick={() => toggle(g.uid, g.is_in_team)} 
                                className={`w-full py-2 rounded text-sm font-bold ${g.is_in_team ? 'bg-red-900/50 text-red-400 border border-red-900' : 'bg-green-800 text-green-100 hover:bg-green-700'}`}>
                                {g.is_in_team ? '下阵' : '上阵'}
                            </button>
                        } 
                    />
                ))}
            </div>
        </div>
    );
};

const CampaignPage = () => {
    const { token, refreshUser } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    useEffect(() => {
        if(token) api.getCampaigns(token).then(setCampaigns);
    }, [token]);

    const fight = async (id: number) => {
        if(!token) return;
        const res = await api.battle(token, id);
        if(res.error) return alert(res.error);
        if(res.win) {
            alert(`胜利! 获得金币 ${res.rewards.gold}`);
            const updated = await api.getCampaigns(token);
            setCampaigns(updated);
            refreshUser();
        } else {
            alert('战斗失败，请提升战力');
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
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<Layout><Dashboard /></Layout>} />
                    <Route path="/gacha" element={<Layout><Gacha /></Layout>} />
                    <Route path="/barracks" element={<Layout><Barracks /></Layout>} />
                    <Route path="/campaign" element={<Layout><CampaignPage /></Layout>} />
                    <Route path="/inventory" element={<Layout><div className="text-center p-10 text-stone-500">仓库暂空</div></Layout>} />
                </Routes>
            </AuthProvider>
        </HashRouter>
    );
}