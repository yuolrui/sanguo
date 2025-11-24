import { useState, useEffect } from 'react';

// Changed to relative paths. Nginx or Vite Proxy will handle the forwarding to port 3000.
const API = '/api';
const ADMIN_API = '/admin/v1';

export default function AdminApp() {
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
    const [view, setView] = useState('login'); // login, list
    const [generals, setGenerals] = useState<any[]>([]);
    
    // Login Form State
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState(''); // Empty by default

    // Add General State
    const [newG, setNewG] = useState({ name: '', stars: 3, str: 50, int: 50, ldr: 50, luck: 50, country: '群', avatar: 'https://picsum.photos/200', description: '' });

    // Initial check for token to auto-login (Fixes unused useEffect and logic bug)
    useEffect(() => {
        if (token) {
            setView('list');
            fetchGenerals(token).catch(() => {
                // If fetch fails (invalid token), logout
                setToken('');
                localStorage.removeItem('adminToken');
                setView('login');
            });
        }
    }, [token]);

    const login = async () => {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.role === 'admin') {
            setToken(data.token);
            localStorage.setItem('adminToken', data.token);
            // View will update via useEffect
        } else {
            alert('Invalid admin credentials');
        }
    };

    const fetchGenerals = async (t: string) => {
        const res = await fetch(`${ADMIN_API}/generals`, { headers: { 'Authorization': `Bearer ${t}` } });
        if (res.ok) {
            setGenerals(await res.json());
        } else {
            throw new Error('Failed to fetch');
        }
    };

    const addGeneral = async () => {
        await fetch(`${ADMIN_API}/generals`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(newG)
        });
        fetchGenerals(token);
        alert('Added');
    };

    if (view === 'login') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded shadow-md w-96">
                    <h1 className="text-2xl font-bold mb-4">GM 后台管理</h1>
                    <input className="block w-full border p-2 mb-2" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
                    <input className="block w-full border p-2 mb-4" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
                    <button onClick={login} className="w-full bg-blue-600 text-white p-2 rounded">登录</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gray-50">
            <aside className="w-64 bg-slate-800 text-white p-4">
                <h1 className="text-xl font-bold mb-8">三国 GM 平台</h1>
                <ul className="space-y-2">
                    <li className="p-2 bg-slate-700 rounded cursor-pointer">武将管理</li>
                    <li className="p-2 hover:bg-slate-700 rounded cursor-not-allowed opacity-50">装备配置</li>
                    <li className="p-2 hover:bg-slate-700 rounded cursor-not-allowed opacity-50">关卡配置</li>
                    <li className="p-2 hover:bg-slate-700 rounded cursor-pointer text-red-400" onClick={() => {
                        setToken('');
                        localStorage.removeItem('adminToken');
                        setView('login');
                    }}>退出登录</li>
                </ul>
            </aside>
            <main className="flex-1 p-8">
                <h2 className="text-2xl font-bold mb-6">武将列表</h2>
                
                <div className="bg-white p-4 rounded shadow mb-8">
                    <h3 className="font-bold mb-4">新增武将</h3>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <input className="border p-1" placeholder="Name" value={newG.name} onChange={e=>setNewG({...newG, name: e.target.value})} />
                        <select className="border p-1" value={newG.country} onChange={e=>setNewG({...newG, country: e.target.value})}>
                            <option>魏</option><option>蜀</option><option>吴</option><option>群</option>
                        </select>
                        <input className="border p-1" type="number" placeholder="Stars" value={newG.stars} onChange={e=>setNewG({...newG, stars: +e.target.value})} />
                        <input className="border p-1" placeholder="Avatar URL" value={newG.avatar} onChange={e=>setNewG({...newG, avatar: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <input className="border p-1" type="number" placeholder="Str" value={newG.str} onChange={e=>setNewG({...newG, str: +e.target.value})} />
                        <input className="border p-1" type="number" placeholder="Int" value={newG.int} onChange={e=>setNewG({...newG, int: +e.target.value})} />
                        <input className="border p-1" type="number" placeholder="Ldr" value={newG.ldr} onChange={e=>setNewG({...newG, ldr: +e.target.value})} />
                        <input className="border p-1" type="number" placeholder="Luck" value={newG.luck} onChange={e=>setNewG({...newG, luck: +e.target.value})} />
                    </div>
                    <button onClick={addGeneral} className="bg-green-600 text-white px-4 py-2 rounded">添加武将</button>
                </div>

                <div className="bg-white rounded shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-3">ID</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">Country</th>
                                <th className="p-3">Stars</th>
                                <th className="p-3">Stats (S/I/L)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {generals.map(g => (
                                <tr key={g.id} className="border-t hover:bg-gray-50">
                                    <td className="p-3">{g.id}</td>
                                    <td className="p-3 flex items-center gap-2">
                                        <img src={g.avatar} className="w-8 h-8 rounded-full" />
                                        {g.name}
                                    </td>
                                    <td className="p-3">{g.country}</td>
                                    <td className="p-3 text-yellow-600">{'★'.repeat(g.stars)}</td>
                                    <td className="p-3">{g.str} / {g.int} / {g.ldr}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}