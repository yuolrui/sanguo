import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcryptjs from 'bcryptjs';

let db;

// Helper to generate consistent, high-quality Koei-style art URLs
const getAvatar = (keywords) => {
    // Base style prompt
    const style = "hyper realistic digital art portrait, Koei Romance of the Three Kingdoms style, ancient chinese general, intricate armor, detailed face, cinematic lighting, 8k resolution, oil painting texture";
    const prompt = encodeURIComponent(`${keywords}, ${style}`);
    // Using a consistent seed based on the prompt length + first char code to keep it stable but unique per character
    const seed = keywords.length + keywords.charCodeAt(0);
    return `https://image.pollinations.ai/prompt/${prompt}?width=200&height=300&nologo=true&seed=${seed}`;
};

export async function initDB() {
  console.log('Initializing Database...');
  db = await open({
    filename: './sanguo.db',
    driver: sqlite3.Database
  });
  console.log('Database connected.');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      gold INTEGER DEFAULT 1000,
      tokens INTEGER DEFAULT 10,
      pity_counter INTEGER DEFAULT 0,
      last_signin TEXT
    );

    CREATE TABLE IF NOT EXISTS generals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      stars INTEGER,
      str INTEGER, -- 武力
      int INTEGER, -- 智力
      ldr INTEGER, -- 统率
      luck INTEGER, -- 运势
      country TEXT, -- 魏蜀吴群
      avatar TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS user_generals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      general_id INTEGER,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      is_in_team BOOLEAN DEFAULT 0,
      evolution INTEGER DEFAULT 0, -- 进阶等级
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(general_id) REFERENCES generals(id)
    );

    CREATE TABLE IF NOT EXISTS equipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT, -- weapon, armor, treasure
      stat_bonus INTEGER, -- 主属性加成值
      stars INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_equipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      equipment_id INTEGER,
      general_id INTEGER, -- 当前装备在哪位武将身上 (user_generals.id), NULL表示在仓库
      level INTEGER DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(equipment_id) REFERENCES equipments(id)
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      req_power INTEGER,
      gold_drop INTEGER,
      exp_drop INTEGER,
      can_sweep BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_campaign_progress (
      user_id INTEGER,
      campaign_id INTEGER,
      stars INTEGER,
      PRIMARY KEY (user_id, campaign_id)
    );
  `);

  // Migration: Ensure evolution column exists for old databases
  try {
      await db.exec("ALTER TABLE user_generals ADD COLUMN evolution INTEGER DEFAULT 0");
      console.log("Migrated: Added evolution column to user_generals");
  } catch (e) {
      // Column likely exists, ignore error
  }

  // Seed Data Definition
  const generalsList = [
      { 
        name: '关羽', stars: 5, str: 98, int: 75, ldr: 95, luck: 60, country: '蜀', 
        avatar: getAvatar('Guan Yu, red face, long black beard, green robe, holding Guandao weapon, fierce eyes'), 
        description: '五虎上将之首，义薄云天。' 
      },
      { 
        name: '曹操', stars: 5, str: 85, int: 96, ldr: 99, luck: 80, country: '魏', 
        avatar: getAvatar('Cao Cao, ambitious ruler, purple and blue ornate robes, holding sword, calculating expression, villain hero'), 
        description: '乱世枭雄，魏武帝。' 
      },
      { 
        name: '吕布', stars: 5, str: 100, int: 30, ldr: 80, luck: 40, country: '群', 
        avatar: getAvatar('Lu Bu, fearsome warrior, long pheasant tail feathers on helmet, black and gold armor, holding sky piercer halberd, intense gaze'), 
        description: '人中吕布，马中赤兔。' 
      },
      { 
        name: '周瑜', stars: 5, str: 70, int: 98, ldr: 96, luck: 70, country: '吴', 
        avatar: getAvatar('Zhou Yu, handsome strategist, red armor, playing musical instrument, fire in background, young commander'), 
        description: '火烧赤壁，英姿飒爽。' 
      },
      { 
        name: '赵云', stars: 4, str: 96, int: 70, ldr: 85, luck: 90, country: '蜀', 
        avatar: getAvatar('Zhao Yun, handsome general, shining silver armor, white robe, holding silver spear, brave expression'), 
        description: '常山赵子龙，浑身是胆。' 
      },
      { 
        name: '张辽', stars: 4, str: 92, int: 80, ldr: 93, luck: 70, country: '魏', 
        avatar: getAvatar('Zhang Liao, stoic general, blue and gold heavy armor, dual axes, wei kingdom commander, mustache'), 
        description: '威震逍遥津。' 
      },
      { 
        name: '甘宁', stars: 4, str: 94, int: 60, ldr: 88, luck: 50, country: '吴', 
        avatar: getAvatar('Gan Ning, pirate general, shirtless with tattoos, wearing bells, feathers in hair, wild look, holding sword'), 
        description: '百骑劫魏营。' 
      },
      { 
        name: '廖化', stars: 3, str: 75, int: 60, ldr: 70, luck: 80, country: '蜀', 
        avatar: getAvatar('Liao Hua, veteran old soldier, weathered face, standard shu leather armor, holding spear, loyal look'), 
        description: '蜀中无大将，廖化作先锋。' 
      },
      { 
        name: '潘凤', stars: 3, str: 70, int: 40, ldr: 60, luck: 10, country: '群', 
        avatar: getAvatar('General Pan Feng, holding huge axe, heavy bulky armor, confident face, mustache'), 
        description: '无双上将。' 
      },
      { 
        name: '邢道荣', stars: 2, str: 60, int: 30, ldr: 50, luck: 20, country: '群', 
        avatar: getAvatar('Xing Daorong, arrogant general, heavy armor, holding large battle axe, beard, laughing'), 
        description: '零陵上将。' 
      },
  ];

  // Check if generals exist
  const count = await db.get('SELECT count(*) as c FROM generals');
  
  if (count.c === 0) {
    console.log('Seeding Database with Generals...');
    for (const g of generalsList) {
      await db.run(
        `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) VALUES (?,?,?,?,?,?,?,?,?)`,
        [g.name, g.stars, g.str, g.int, g.ldr, g.luck, g.country, g.avatar, g.description]
      );
    }
  } else {
    // Update logic could be here if needed
  }

  // Seed Campaigns & Equipment (Only if table is empty to avoid dupes on restart)
  const campCount = await db.get('SELECT count(*) as c FROM campaigns');
  if (campCount.c === 0) {
    const campaigns = [
      { name: '黄巾之乱', req_power: 100, gold: 100, exp: 50 },
      { name: '虎牢关之战', req_power: 500, gold: 300, exp: 150 },
      { name: '官渡之战', req_power: 1500, gold: 800, exp: 400 },
      { name: '赤壁之战', req_power: 3000, gold: 2000, exp: 1000 },
    ];
    for (const c of campaigns) {
      await db.run(
        `INSERT INTO campaigns (name, req_power, gold_drop, exp_drop) VALUES (?,?,?,?)`,
        [c.name, c.req_power, c.gold, c.exp]
      );
    }
    
    // Seed Equipment
    const equipments = [
        { name: '青龙偃月刀', type: 'weapon', stat_bonus: 50, stars: 5 },
        { name: '丈八蛇矛', type: 'weapon', stat_bonus: 48, stars: 5 },
        { name: '倚天剑', type: 'weapon', stat_bonus: 45, stars: 5 },
        { name: '烂银枪', type: 'weapon', stat_bonus: 30, stars: 4 },
        { name: '古锭刀', type: 'weapon', stat_bonus: 28, stars: 4 },
        { name: '铁脊蛇矛', type: 'weapon', stat_bonus: 20, stars: 3 },
        { name: '铁剑', type: 'weapon', stat_bonus: 10, stars: 2 },
        
        { name: '兽面吞头铠', type: 'armor', stat_bonus: 40, stars: 5 },
        { name: '明光铠', type: 'armor', stat_bonus: 35, stars: 4 },
        { name: '锁子甲', type: 'armor', stat_bonus: 20, stars: 3 },
        { name: '皮甲', type: 'armor', stat_bonus: 10, stars: 2 },

        { name: '赤兔马', type: 'treasure', stat_bonus: 40, stars: 5 },
        { name: '的卢', type: 'treasure', stat_bonus: 35, stars: 4 },
        { name: '玉玺', type: 'treasure', stat_bonus: 50, stars: 5 },
        { name: '孟德新书', type: 'treasure', stat_bonus: 30, stars: 4 },
    ];
    for (const e of equipments) {
        await db.run(
            `INSERT INTO equipments (name, type, stat_bonus, stars) VALUES (?,?,?,?)`,
            [e.name, e.type, e.stat_bonus, e.stars]
        );
    }
  }

  // Force Ensure Admin User Exists with Known Password
  try {
    console.log('Creating/Resetting admin user (admin/123456)...');
    const hashedPassword = await bcryptjs.hash('123456', 10);
    
    const existingAdmin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    
    if (existingAdmin) {
        // Reset password if exists
        await db.run('UPDATE users SET password = ?, gold = 999999, tokens = 9999 WHERE username = ?', [hashedPassword, 'admin']);
    } else {
        // Create if not exists
        await db.run('INSERT INTO users (username, password, gold, tokens) VALUES (?, ?, ?, ?)', ['admin', hashedPassword, 999999, 9999]);
    }
    console.log('Admin user ensured.');
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
}

export function getDB() {
  return db;
}