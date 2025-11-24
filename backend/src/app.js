import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { initDB, getDB } from './db.js';

const app = express();
const PORT = 3000;
const SECRET_KEY = 'sanguo_secret_key_123';

app.use(cors());
app.use(express.json());

// Middleware for Auth
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    // Give starter general
    await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [result.lastID, 8]); // Give Liao Hua
    res.json({ message: 'User registered' });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user.id, username: user.username, role: username === 'admin' ? 'admin' : 'user' }, SECRET_KEY);
    res.json({ token, role: user.username === 'admin' ? 'admin' : 'user' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- GAME ROUTES ---

// Get User Info
app.get('/api/user/me', authenticateToken, async (req, res) => {
  const db = getDB();
  const user = await db.get('SELECT id, username, gold, tokens, pity_counter FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

// Get User Generals
app.get('/api/user/generals', authenticateToken, async (req, res) => {
  const db = getDB();
  const generals = await db.all(`
    SELECT ug.id as uid, g.*, ug.level, ug.exp, ug.is_in_team 
    FROM user_generals ug 
    JOIN generals g ON ug.general_id = g.id 
    WHERE ug.user_id = ?`, [req.user.id]);
  res.json(generals);
});

// Gacha
app.post('/api/gacha', authenticateToken, async (req, res) => {
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
  if (user.tokens < 1) return res.status(400).json({ error: 'Not enough tokens' });
  
  await db.run('UPDATE users SET tokens = tokens - 1, pity_counter = pity_counter + 1 WHERE id = ?', [req.user.id]);
  
  // Logic
  const roll = Math.random() * 100;
  let star = 3;
  if (user.pity_counter >= 59 || roll < 2) star = 5; // Pity or 2%
  else if (roll < 12) star = 4; // 10%
  else star = 3; // 88%

  if (star === 5) {
     await db.run('UPDATE users SET pity_counter = 0 WHERE id = ?', [req.user.id]);
  }

  // Pick random general of that star
  const pool = await db.all('SELECT * FROM generals WHERE stars = ?', [star]);
  const winner = pool[Math.floor(Math.random() * pool.length)] || pool[0]; // Fallback if empty pool

  await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [req.user.id, winner.id]);
  
  res.json({ general: winner, pity_reset: star === 5 });
});

// Campaign List
app.get('/api/campaigns', authenticateToken, async (req, res) => {
  const db = getDB();
  const campaigns = await db.all('SELECT * FROM campaigns');
  const progress = await db.all('SELECT * FROM user_campaign_progress WHERE user_id = ?', [req.user.id]);
  
  const result = campaigns.map(c => {
    const p = progress.find(pr => pr.campaign_id === c.id);
    return { ...c, passed: !!p, stars: p ? p.stars : 0 };
  });
  res.json(result);
});

// Battle
app.post('/api/battle/:id', authenticateToken, async (req, res) => {
  const campaignId = req.params.id;
  const db = getDB();
  
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  
  // Calculate user power
  const team = await db.all(`
    SELECT g.str, g.int, g.ldr, ug.level 
    FROM user_generals ug 
    JOIN generals g ON ug.general_id = g.id 
    WHERE ug.user_id = ? AND ug.is_in_team = 1`, [req.user.id]);
    
  let totalPower = 0;
  if (team.length === 0) return res.status(400).json({error: 'Please form a team first'});

  team.forEach(m => {
    totalPower += (m.str + m.int + m.ldr) * m.level;
  });

  const win = totalPower >= campaign.req_power || Math.random() > 0.8; // 20% luck if weak
  
  if (win) {
    await db.run('UPDATE users SET gold = gold + ? WHERE id = ?', [campaign.gold_drop, req.user.id]);
    await db.run(`INSERT OR REPLACE INTO user_campaign_progress (user_id, campaign_id, stars) VALUES (?, ?, 3)`, [req.user.id, campaignId]);
    res.json({ win: true, rewards: { gold: campaign.gold_drop, exp: campaign.exp_drop } });
  } else {
    res.json({ win: false });
  }
});

// Team Management
app.post('/api/team', authenticateToken, async (req, res) => {
  const { generalUid, action } = req.body; // action: 'add' | 'remove'
  const db = getDB();
  await db.run('UPDATE user_generals SET is_in_team = ? WHERE id = ? AND user_id = ?', [action === 'add' ? 1 : 0, generalUid, req.user.id]);
  res.json({ success: true });
});

// Daily Signin
app.post('/api/signin', authenticateToken, async (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const user = await db.get('SELECT last_signin FROM users WHERE id = ?', [req.user.id]);
  
  if (user.last_signin === today) return res.status(400).json({ error: 'Already signed in today' });
  
  await db.run('UPDATE users SET gold = gold + 500, tokens = tokens + 1, last_signin = ? WHERE id = ?', [today, req.user.id]);
  res.json({ rewards: { gold: 500, tokens: 1 } });
});

// --- ADMIN ROUTES ---
app.get('/admin/v1/generals', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const db = getDB();
  const generals = await db.all('SELECT * FROM generals');
  res.json(generals);
});

app.post('/admin/v1/generals', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, stars, str, int, ldr, luck, country, avatar, description } = req.body;
    const db = getDB();
    await db.run(
        `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) VALUES (?,?,?,?,?,?,?,?,?)`,
        [name, stars, str, int, ldr, luck, country, avatar, description]
    );
    res.json({ success: true });
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
});
