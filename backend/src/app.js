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

// Get User Generals (with equipment and shards)
app.get('/api/user/generals', authenticateToken, async (req, res) => {
  const db = getDB();
  const generals = await db.all(`
    SELECT ug.id as uid, g.*, ug.level, ug.exp, ug.is_in_team, ug.evolution,
           COALESCE(us.count, 0) as shard_count
    FROM user_generals ug 
    JOIN generals g ON ug.general_id = g.id 
    LEFT JOIN user_shards us ON ug.user_id = us.user_id AND ug.general_id = us.general_id
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

// Get Gallery (All Generals & Equipment)
app.get('/api/gallery', authenticateToken, async (req, res) => {
    const db = getDB();
    const generals = await db.all('SELECT * FROM generals ORDER BY stars DESC, country, id');
    const equipments = await db.all('SELECT * FROM equipments ORDER BY stars DESC, type, id');
    res.json({ generals, equipments });
});

// Get User Collection (Owned IDs)
app.get('/api/user/collection', authenticateToken, async (req, res) => {
    const db = getDB();
    const userId = req.user.id;
    
    // Get owned generals
    const ownedGenerals = await db.all('SELECT DISTINCT general_id FROM user_generals WHERE user_id = ?', [userId]);
    
    // Get owned equipments and who they are assigned to
    const ownedEquipments = await db.all('SELECT equipment_id, general_id FROM user_equipments WHERE user_id = ?', [userId]);
    
    // Map assignments
    const assignmentsRaw = await db.all(`
        SELECT ue.equipment_id, g.name as general_name
        FROM user_equipments ue
        JOIN user_generals ug ON ue.general_id = ug.id
        JOIN generals g ON ug.general_id = g.id
        WHERE ue.user_id = ? AND ue.general_id IS NOT NULL
    `, [userId]);

    const assignments = {};
    assignmentsRaw.forEach(row => {
        if (!assignments[row.equipment_id]) assignments[row.equipment_id] = [];
        assignments[row.equipment_id].push(row.general_name);
    });
    
    res.json({
        generalIds: ownedGenerals.map(r => r.general_id),
        equipmentIds: ownedEquipments.map(r => r.equipment_id),
        assignments: assignments
    });
});

// Get All User Specific Items (Inventory)
app.get('/api/user/items', authenticateToken, async (req, res) => {
    const db = getDB();
    const items = await db.all(`
        SELECT ue.id, e.name, e.type, e.stars, e.stat_bonus, g.name as equipped_by
        FROM user_equipments ue
        JOIN equipments e ON ue.equipment_id = e.id
        LEFT JOIN user_generals ug ON ue.general_id = ug.id
        LEFT JOIN generals g ON ug.general_id = g.id
        WHERE ue.user_id = ?
        ORDER BY e.stars DESC, e.stat_bonus DESC
    `, [req.user.id]);
    res.json(items);
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

    // Check if user already has this general
    const existing = await db.get('SELECT id FROM user_generals WHERE user_id = ? AND general_id = ?', [userId, winner.id]);

    if (existing) {
        // Convert to shards
        await db.run(`INSERT INTO user_shards (user_id, general_id, count) VALUES (?, ?, 10)
                      ON CONFLICT(user_id, general_id) DO UPDATE SET count = count + 10`, [userId, winner.id]);
        return { winner, newPity, converted: true };
    } else {
        await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [userId, winner.id]);
        return { winner, newPity, converted: false };
    }
}

// Single Gacha
app.post('/api/gacha', authenticateToken, async (req, res) => {
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  
  if (user.tokens < 1) return res.status(400).json({ error: 'Not enough tokens' });
  
  await db.run('UPDATE users SET tokens = tokens - 1 WHERE id = ?', [req.user.id]);
  
  const { winner, newPity, converted } = await performSingleGacha(db, req.user.id, user.pity_counter);
  await db.run('UPDATE users SET pity_counter = ? WHERE id = ?', [newPity, req.user.id]);
  
  res.json({ general: { ...winner, converted } });
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
        const { winner, newPity, converted } = await performSingleGacha(db, req.user.id, currentPity);
        currentPity = newPity;
        results.push({ ...winner, converted });
    }
    
    await db.run('UPDATE users SET pity_counter = ? WHERE id = ?', [currentPity, req.user.id]);
    res.json({ generals: results });
});

// Auto Team
app.post('/api/team/auto', authenticateToken, async (req, res) => {
    const db = getDB();
    const userId = req.user.id;

    await db.run('UPDATE user_generals SET is_in_team = 0 WHERE user_id = ?', [userId]);

    const allGenerals = await db.all(`
        SELECT ug.id, ug.general_id, (g.str + g.int + g.ldr) * ug.level * (1 + (IFNULL(ug.evolution, 0) * 0.1)) as power 
        FROM user_generals ug
        JOIN generals g ON ug.general_id = g.id
        WHERE ug.user_id = ?
        ORDER BY power DESC
    `, [userId]);

    const team = [];
    const usedGeneralIds = new Set();

    for (const g of allGenerals) {
        if (team.length >= 5) break;
        if (!usedGeneralIds.has(g.general_id)) {
            team.push(g.id);
            usedGeneralIds.add(g.general_id);
        }
    }

    for (const uid of team) {
        await db.run('UPDATE user_generals SET is_in_team = 1 WHERE id = ?', [uid]);
    }

    res.json({ success: true, count: team.length });
});

// Auto Equip
app.post('/api/equip/auto', authenticateToken, async (req, res) => {
    const { generalUid } = req.body;
    const userId = req.user.id;
    const db = getDB();

    await db.run('UPDATE user_equipments SET general_id = NULL WHERE user_id = ? AND general_id = ?', [userId, generalUid]);

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

// Unequip
app.post('/api/equip/unequip', authenticateToken, async (req, res) => {
    const { generalUid } = req.body;
    const userId = req.user.id;
    const db = getDB();

    await db.run('UPDATE user_equipments SET general_id = NULL WHERE user_id = ? AND general_id = ?', [userId, generalUid]);
    res.json({ success: true });
});

// Evolve
app.post('/api/general/evolve', authenticateToken, async (req, res) => {
    const { targetUid } = req.body;
    const userId = req.user.id;
    const db = getDB();

    const target = await db.get('SELECT * FROM user_generals WHERE id = ? AND user_id = ?', [targetUid, userId]);
    if (!target) return res.status(404).json({ error: 'General not found' });

    const shards = await db.get('SELECT count FROM user_shards WHERE user_id = ? AND general_id = ?', [userId, target.general_id]);
    if (!shards || shards.count < 10) return res.status(400).json({ error: 'Not enough shards (Need 10)' });

    await db.run('UPDATE user_shards SET count = count - 10 WHERE user_id = ? AND general_id = ?', [userId, target.general_id]);
    await db.run('UPDATE user_generals SET evolution = evolution + 1 WHERE id = ?', [targetUid]);

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

// Battle Logic
app.post('/api/battle/:id', authenticateToken, async (req, res) => {
  const campaignId = req.params.id;
  const db = getDB();
  
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  
  const team = await db.all(`
    SELECT ug.id, g.name, g.country, g.str, g.int, g.ldr, ug.level, ug.exp, ug.evolution 
    FROM user_generals ug 
    JOIN generals g ON ug.general_id = g.id 
    WHERE ug.user_id = ? AND ug.is_in_team = 1`, [req.user.id]);
    
  if (team.length === 0) return res.status(400).json({error: 'Please form a team first'});

  let rawTotalPower = 0;

  for (const m of team) {
    let evolutionBonus = 1 + (m.evolution || 0) * 0.1; 
    let generalPower = (m.str + m.int + m.ldr) * m.level * evolutionBonus;
    
    const equips = await db.all(`
        SELECT e.stat_bonus 
        FROM user_equipments ue
        JOIN equipments e ON ue.equipment_id = e.id
        WHERE ue.general_id = ?
    `, [m.id]);
    equips.forEach(e => generalPower += e.stat_bonus);
    rawTotalPower += generalPower;
  }

  // --- ENHANCED BOND CALCULATION ---
  let bondMultiplier = 1.0;
  const names = team.map(g => g.name);
  const countries = team.map(g => g.country);
  const countryCounts = {};
  countries.forEach(c => countryCounts[c] = (countryCounts[c] || 0) + 1);

  // Helper: Count how many specific generals are in the team
  const countGenerals = (targetNames) => names.filter(n => targetNames.includes(n)).length;
  const hasGenerals = (targetNames) => targetNames.every(n => names.includes(n));

  // 1. Wei Bonds
  if (hasGenerals(['曹操', '夏侯惇', '夏侯渊', '曹仁', '曹洪'])) bondMultiplier += 0.20; // Cao Wei Foundation (Full)
  else if (countGenerals(['曹操', '夏侯惇', '夏侯渊', '曹仁', '曹洪']) >= 3) bondMultiplier += 0.12; // Foundation (Partial)

  if (countGenerals(['张辽', '张郃', '徐晃', '于禁', '乐进']) >= 5) bondMultiplier += 0.25; // Five Elites (Full)
  else if (countGenerals(['张辽', '张郃', '徐晃', '于禁', '乐进']) >= 3) bondMultiplier += 0.18; // Five Elites (Partial)

  if (hasGenerals(['典韦', '许褚'])) bondMultiplier += 0.30; // Tiger Guards (Strong Duo)

  if (countGenerals(['司马懿', '司马师', '司马昭', '邓艾', '钟会']) >= 5) bondMultiplier += 0.25; // Sima's Heart (Full)
  else if (countGenerals(['司马懿', '司马师', '司马昭', '邓艾', '钟会']) >= 3) bondMultiplier += 0.20; // Sima's Heart (Partial)

  // 2. Shu Bonds
  if (hasGenerals(['刘备', '关羽', '张飞'])) bondMultiplier += 0.25; // Peach Garden (Buffed)

  if (countGenerals(['关羽', '张飞', '赵云', '马超', '黄忠']) >= 5) bondMultiplier += 0.30; // Five Tigers (Full - Critical)
  else if (countGenerals(['关羽', '张飞', '赵云', '马超', '黄忠']) >= 3) bondMultiplier += 0.18;

  if (hasGenerals(['诸葛亮', '庞统'])) bondMultiplier += 0.25; // Wolong Fengchu

  if (countGenerals(['诸葛亮', '姜维', '魏延', '王平']) >= 4) bondMultiplier += 0.20; // Northern Expedition (Full)
  else if (countGenerals(['诸葛亮', '姜维', '魏延', '王平']) >= 3) bondMultiplier += 0.15;

  // 3. Wu Bonds
  if (hasGenerals(['孙策', '周瑜'])) bondMultiplier += 0.20; // Jiangdong Double Walls

  if (countGenerals(['周瑜', '鲁肃', '吕蒙', '陆逊']) >= 4) bondMultiplier += 0.40; // Four Heroes (Fire Strategy - Massive Boost)

  // Twelve Tiger Subjects (Sample of 4)
  const tigerSubjects = ['程普', '黄盖', '韩当', '周泰', '蒋钦', '陈武', '董袭', '甘宁', '凌统', '徐盛', '潘璋', '丁奉'];
  if (countGenerals(tigerSubjects) >= 4) bondMultiplier += 0.15;

  if (countGenerals(['孙坚', '孙策', '孙权', '孙桓', '孙韶']) >= 5) bondMultiplier += 0.20; // Sun Family
  else if (countGenerals(['孙坚', '孙策', '孙权', '孙桓', '孙韶']) >= 3) bondMultiplier += 0.10;

  // 4. Warlords (Qun)
  if (countGenerals(['董卓', '吕布', '华雄', '李傕', '郭汜']) >= 5) bondMultiplier += 0.25;
  else if (countGenerals(['董卓', '吕布', '华雄', '李傕', '郭汜']) >= 3) bondMultiplier += 0.15;

  if (countGenerals(['颜良', '文丑', '张郃', '高览']) >= 4) bondMultiplier += 0.30; // Hebei Pillars

  if (hasGenerals(['公孙瓒', '赵云'])) bondMultiplier += 0.15; // White Horse

  if (countGenerals(['卢植', '皇甫嵩', '朱儁']) >= 3) bondMultiplier += 0.30; // Han Echo (Strong vs Yellow Turbans/Qun)

  // 5. Cross Faction
  if (hasGenerals(['刘备', '诸葛亮'])) bondMultiplier += 0.15;
  if (hasGenerals(['关羽', '庞德'])) bondMultiplier += 0.20; // Fated Enemies (Aggressive)
  if (hasGenerals(['关羽', '张辽'])) bondMultiplier += 0.15; // Loyal Friends
  
  // Martial Peak (Lu Bu + 5 Tigers + Dian/Xu)
  const martialGods = ['吕布', '关羽', '张飞', '赵云', '马超', '典韦', '许褚'];
  if (countGenerals(martialGods) >= 5) bondMultiplier += 0.35;
  else if (countGenerals(martialGods) >= 3) bondMultiplier += 0.20;

  // 6. Simple Faction Bonus (Fallback)
  // If no specific major bond, give small faction boost
  if (bondMultiplier === 1.0) {
      if (Object.values(countryCounts).some(count => count >= 3)) {
          bondMultiplier += 0.10;
      }
  }

  const finalPower = Math.floor(rawTotalPower * bondMultiplier);
  // --- END BOND CALCULATION ---

  const win = finalPower >= campaign.req_power || Math.random() > 0.8; 
  
  if (win) {
    await db.run('UPDATE users SET gold = gold + ? WHERE id = ?', [campaign.gold_drop, req.user.id]);
    
    const expGain = campaign.exp_drop;
    const levelUps = [];

    for (const g of team) {
        let newExp = g.exp + expGain;
        let newLevel = g.level;
        let didLevelUp = false;
        let reqExp = newLevel * 100;

        while (newExp >= reqExp) {
            newExp -= reqExp;
            newLevel++;
            didLevelUp = true;
            reqExp = newLevel * 100;
        }

        await db.run('UPDATE user_generals SET level = ?, exp = ? WHERE id = ?', [newLevel, newExp, g.id]);

        if (didLevelUp) {
            levelUps.push({ name: g.name, from: g.level, to: newLevel });
        }
    }

    if (Math.random() < 0.2) {
        const eqPool = await db.all('SELECT * FROM equipments WHERE stars <= 3');
        const drop = eqPool[Math.floor(Math.random() * eqPool.length)];
        if (drop) {
            await db.run('INSERT INTO user_equipments (user_id, equipment_id) VALUES (?, ?)', [req.user.id, drop.id]);
        }
    }

    await db.run(`INSERT OR REPLACE INTO user_campaign_progress (user_id, campaign_id, stars) VALUES (?, ?, 3)`, [req.user.id, campaignId]);
    
    res.json({ 
        win: true, 
        rewards: { gold: campaign.gold_drop, exp: campaign.exp_drop },
        levelUps 
    });
  } else {
    res.json({ win: false });
  }
});

// Team Management
app.post('/api/team', authenticateToken, async (req, res) => {
  const { generalUid, action } = req.body;
  const db = getDB();
  const userId = req.user.id;

  if (action === 'add') {
      const currentTeam = await db.all(`
        SELECT ug.id, ug.general_id 
        FROM user_generals ug 
        WHERE ug.user_id = ? AND ug.is_in_team = 1`, [userId]);
      
      if (currentTeam.length >= 5) return res.status(400).json({ error: 'Team is full (Max 5)' });

      const target = await db.get('SELECT general_id FROM user_generals WHERE id = ? AND user_id = ?', [generalUid, userId]);
      if (!target) return res.status(404).json({ error: 'General not found' });

      const hasDuplicate = currentTeam.some(g => g.general_id === target.general_id);
      if (hasDuplicate) return res.status(400).json({ error: 'Cannot have duplicate generals in team' });
  }
  
  await db.run('UPDATE user_generals SET is_in_team = ? WHERE id = ? AND user_id = ?', [action === 'add' ? 1 : 0, generalUid, userId]);
  res.json({ success: true });
});

// Daily Signin
app.post('/api/signin', authenticateToken, async (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const user = await db.get('SELECT last_signin FROM users WHERE id = ?', [req.user.id]);
  
  if (user.last_signin === today) return res.status(400).json({ error: 'Already signed in today' });
  
  await db.run('UPDATE users SET gold = gold + 500, tokens = tokens + 10, last_signin = ? WHERE id = ?', [today, req.user.id]);
  res.json({ rewards: { gold: 500, tokens: 10 } });
});

// --- ADMIN ROUTES ---
app.get('/admin/v1/meta', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const generals = await db.all('SELECT * FROM generals');
    const equipments = await db.all('SELECT * FROM equipments');
    res.json({ generals, equipments });
});

app.post('/admin/v1/generals', authenticateToken, isAdmin, async (req, res) => {
    const { name, stars, str, int, ldr, luck, country, avatar, description } = req.body;
    const db = getDB();
    await db.run(
        `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) VALUES (?,?,?,?,?,?,?,?,?)`,
        [name, stars, str, int, ldr, luck, country, avatar, description]
    );
    res.json({ success: true });
});

app.get('/admin/v1/users', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const users = await db.all('SELECT id, username, gold, tokens FROM users ORDER BY id DESC');
    res.json(users);
});

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

app.post('/admin/v1/users/:id/currency', authenticateToken, isAdmin, async (req, res) => {
    const { gold, tokens } = req.body;
    const db = getDB();
    await db.run('UPDATE users SET gold = ?, tokens = ? WHERE id = ?', [gold, tokens, req.params.id]);
    res.json({ success: true });
});

app.post('/admin/v1/users/:id/general', authenticateToken, isAdmin, async (req, res) => {
    const { generalId, action, uid } = req.body;
    const db = getDB();
    const userId = req.params.id;
    if (action === 'add') {
        await db.run('INSERT INTO user_generals (user_id, general_id) VALUES (?, ?)', [userId, generalId]);
    } else {
        await db.run('DELETE FROM user_generals WHERE id = ? AND user_id = ?', [uid, userId]);
        await db.run('UPDATE user_equipments SET general_id = NULL WHERE general_id = ? AND user_id = ?', [uid, userId]);
    }
    res.json({ success: true });
});

app.post('/admin/v1/users/:id/equipment', authenticateToken, isAdmin, async (req, res) => {
    const { equipmentId, action, uid } = req.body;
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
  const server = app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n[FATAL ERROR] Port ${PORT} is already in use.`);
      console.error(`To fix this, find and kill the process using port ${PORT}.`);
      console.error(`Try running: lsof -i :${PORT} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
      process.exit(1);
    } else {
      throw e;
    }
  });
  const shutdown = () => {
    console.log('\nStopping server...');
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
