import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
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

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.sendStatus(403);
    }
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const hashedPassword = await bcryptjs.hash(password, 10);
  
  try {
    const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    // Give starter general
    await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [result.lastID, 8]); // Give Liao Hua
    // Give starter weapon
    await db.run('INSERT INTO user_equipments (user_id, equipment_id) VALUES (?, ?)', [result.lastID, 7]); // Iron Sword
    res.json({ message: 'User registered' });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (user && await bcryptjs.compare(password, user.password)) {
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

// Get User Generals (with equipment)
app.get('/api/user/generals', authenticateToken, async (req, res) => {
  const db = getDB();
  const generals = await db.all(`
    SELECT ug.id as uid, g.*, ug.level, ug.exp, ug.is_in_team 
    FROM user_generals ug 
    JOIN generals g ON ug.general_id = g.id 
    WHERE ug.user_id = ?`, [req.user.id]);

  // Fetch equipments for these generals
  const equipments = await db.all(`
    SELECT ue.*, e.name, e.type, e.stat_bonus, e.stars
    FROM user_equipments ue
    JOIN equipments e ON ue.equipment_id = e.id
    WHERE ue.user_id = ? AND ue.general_id IS NOT NULL
  `, [req.user.id]);

  const result = generals.map(g => {
    const equips = equipments.filter(e => e.general_id === g.uid);
    return { ...g, equipments: equips };
  });

  res.json(result);
});

// Helper for Gacha Logic
async function performSingleGacha(db, userId, userPity) {
    const roll = Math.random() * 100;
    let star = 3;
    let newPity = userPity + 1;
    
    if (newPity >= 60 || roll < 2) {
        star = 5;
        newPity = 0;
    } else if (roll < 12) {
        star = 4;
    } else {
        star = 3;
    }

    const pool = await db.all('SELECT * FROM generals WHERE stars = ?', [star]);
    const winner = pool[Math.floor(Math.random() * pool.length)] || pool[0];

    await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [userId, winner.id]);
    
    return { winner, newPity };
}

// Single Gacha
app.post('/api/gacha', authenticateToken, async (req, res) => {
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
  if (user.tokens < 1) return res.status(400).json({ error: 'Not enough tokens' });
  
  await db.run('UPDATE users SET tokens = tokens - 1 WHERE id = ?', [req.user.id]);
  
  const { winner, newPity } = await performSingleGacha(db, req.user.id, user.pity_counter);
  await db.run('UPDATE users SET pity_counter = ? WHERE id = ?', [newPity, req.user.id]);
  
  res.json({ general: winner });
});

// 10x Gacha
app.post('/api/gacha/ten', authenticateToken, async (req, res) => {
    const db = getDB();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    if (user.tokens < 10) return res.status(400).json({ error: 'Not enough tokens' });
    
    await db.run('UPDATE users SET tokens = tokens - 10 WHERE id = ?', [req.user.id]);
    
    let currentPity = user.pity_counter;
    const results = [];

    for (let i = 0; i < 10; i++) {
        const { winner, newPity } = await performSingleGacha(db, req.user.id, currentPity);
        currentPity = newPity;
        results.push(winner);
    }
    
    await db.run('UPDATE users SET pity_counter = ? WHERE id = ?', [currentPity, req.user.id]);
    res.json({ generals: results });
});

// Auto Team (One-click)
app.post('/api/team/auto', authenticateToken, async (req, res) => {
    const db = getDB();
    const userId = req.user.id;

    // Reset current team
    await db.run('UPDATE user_generals SET is_in_team = 0 WHERE user_id = ?', [userId]);

    // Get top 5 generals by base stats
    const allGenerals = await db.all(`
        SELECT ug.id, (g.str + g.int + g.ldr) as power 
        FROM user_generals ug
        JOIN generals g ON ug.general_id = g.id
        WHERE ug.user_id = ?
        ORDER BY power DESC
        LIMIT 5
    `, [userId]);

    for (const g of allGenerals) {
        await db.run('UPDATE user_generals SET is_in_team = 1 WHERE id = ?', [g.id]);
    }

    res.json({ success: true, count: allGenerals.length });
});

// Auto Equip (One-click Equip)
app.post('/api/equip/auto', authenticateToken, async (req, res) => {
    const { generalUid } = req.body;
    const userId = req.user.id;
    const db = getDB();

    // 1. Unequip all items from this general first
    await db.run('UPDATE user_equipments SET general_id = NULL WHERE user_id = ? AND general_id = ?', [userId, generalUid]);

    // 2. Find best available Weapon, Armor, Treasure
    const types = ['weapon', 'armor', 'treasure'];
    for (const type of types) {
        const bestItem = await db.get(`
            SELECT ue.id 
            FROM user_equipments ue
            JOIN equipments e ON ue.equipment_id = e.id
            WHERE ue.user_id = ? AND ue.general_id IS NULL AND e.type = ?
            ORDER BY e.stat_bonus DESC, e.stars DESC
            LIMIT 1
        `, [userId, type]);

        if (bestItem) {
            await db.run('UPDATE user_equipments SET general_id = ? WHERE id = ?', [generalUid, bestItem.id]);
        }
    }
    res.json({ success: true });
});

// Unequip All
app.post('/api/equip/unequip', authenticateToken, async (req, res) => {
    const { generalUid } = req.body;
    const userId = req.user.id;
    const db = getDB();

    await db.run('UPDATE user_equipments SET general_id = NULL WHERE user_id = ? AND general_id = ?', [userId, generalUid]);
    res.json({ success: true });
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
  
  // Calculate user power (Base + Equipment)
  const team = await db.all(`
    SELECT ug.id, g.str, g.int, g.ldr, ug.level 
    FROM user_generals ug 
    JOIN generals g ON ug.general_id = g.id 
    WHERE ug.user_id = ? AND ug.is_in_team = 1`, [req.user.id]);
    
  let totalPower = 0;
  if (team.length === 0) return res.status(400).json({error: 'Please form a team first'});

  for (const m of team) {
    let generalPower = (m.str + m.int + m.ldr) * m.level;
    // Add equipment bonus
    const equips = await db.all(`
        SELECT e.stat_bonus 
        FROM user_equipments ue
        JOIN equipments e ON ue.equipment_id = e.id
        WHERE ue.general_id = ?
    `, [m.id]);
    equips.forEach(e => generalPower += e.stat_bonus);
    totalPower += generalPower;
  }

  const win = totalPower >= campaign.req_power || Math.random() > 0.8; // 20% luck
  
  if (win) {
    await db.run('UPDATE users SET gold = gold + ? WHERE id = ?', [campaign.gold_drop, req.user.id]);
    
    // Chance to drop equipment (20%)
    if (Math.random() < 0.2) {
        const eqPool = await db.all('SELECT * FROM equipments WHERE stars <= 3'); // Low level drop
        const drop = eqPool[Math.floor(Math.random() * eqPool.length)];
        if (drop) {
            await db.run('INSERT INTO user_equipments (user_id, equipment_id) VALUES (?, ?)', [req.user.id, drop.id]);
        }
    }

    await db.run(`INSERT OR REPLACE INTO user_campaign_progress (user_id, campaign_id, stars) VALUES (?, ?, 3)`, [req.user.id, campaignId]);
    res.json({ win: true, rewards: { gold: campaign.gold_drop, exp: campaign.exp_drop } });
  } else {
    res.json({ win: false });
  }
});

// Team Management (Manual)
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
  
  await db.run('UPDATE users SET gold = gold + 500, tokens = tokens + 10, last_signin = ? WHERE id = ?', [today, req.user.id]); // Increased tokens for testing
  res.json({ rewards: { gold: 500, tokens: 10 } });
});

// --- ADMIN ROUTES ---

// 1. Get Base Data (For Dropdowns)
app.get('/admin/v1/meta', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const generals = await db.all('SELECT * FROM generals');
    const equipments = await db.all('SELECT * FROM equipments');
    res.json({ generals, equipments });
});

// 2. Add Base General
app.post('/admin/v1/generals', authenticateToken, isAdmin, async (req, res) => {
    const { name, stars, str, int, ldr, luck, country, avatar, description } = req.body;
    const db = getDB();
    await db.run(
        `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) VALUES (?,?,?,?,?,?,?,?,?)`,
        [name, stars, str, int, ldr, luck, country, avatar, description]
    );
    res.json({ success: true });
});

// 3. User Management - List Users
app.get('/admin/v1/users', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const users = await db.all('SELECT id, username, gold, tokens FROM users ORDER BY id DESC');
    res.json(users);
});

// 4. User Management - Get User Detail
app.get('/admin/v1/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const userId = req.params.id;
    
    const user = await db.get('SELECT id, username, gold, tokens FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({error: 'User not found'});

    const generals = await db.all(`
        SELECT ug.id as uid, g.name, g.stars, g.avatar, ug.level 
        FROM user_generals ug 
        JOIN generals g ON ug.general_id = g.id 
        WHERE ug.user_id = ?`, [userId]);

    const equipments = await db.all(`
        SELECT ue.id as uid, e.name, e.type, e.stars 
        FROM user_equipments ue 
        JOIN equipments e ON ue.equipment_id = e.id 
        WHERE ue.user_id = ?`, [userId]);

    res.json({ user, generals, equipments });
});

// 5. Update User Currency
app.post('/admin/v1/users/:id/currency', authenticateToken, isAdmin, async (req, res) => {
    const { gold, tokens } = req.body;
    const db = getDB();
    await db.run('UPDATE users SET gold = ?, tokens = ? WHERE id = ?', [gold, tokens, req.params.id]);
    res.json({ success: true });
});

// 6. Grant/Revoke General
app.post('/admin/v1/users/:id/general', authenticateToken, isAdmin, async (req, res) => {
    const { generalId, action, uid } = req.body; // action: 'add' | 'remove'
    const db = getDB();
    const userId = req.params.id;
    
    if (action === 'add') {
        await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [userId, generalId]);
    } else {
        await db.run('DELETE FROM user_generals WHERE id = ? AND user_id = ?', [uid, userId]);
        // Also remove equipments from this general
        await db.run('UPDATE user_equipments SET general_id = NULL WHERE general_id = ? AND user_id = ?', [uid, userId]);
    }
    res.json({ success: true });
});

// 7. Grant/Revoke Equipment
app.post('/admin/v1/users/:id/equipment', authenticateToken, isAdmin, async (req, res) => {
    const { equipmentId, action, uid } = req.body; // action: 'add' | 'remove'
    const db = getDB();
    const userId = req.params.id;

    if (action === 'add') {
        await db.run('INSERT INTO user_equipments (user_id, equipment_id) VALUES (?, ?)', [userId, equipmentId]);
    } else {
        await db.run('DELETE FROM user_equipments WHERE id = ? AND user_id = ?', [uid, userId]);
    }
    res.json({ success: true });
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
});