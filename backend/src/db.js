import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcryptjs from 'bcryptjs';

let db;

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

  // Seed Data
  const count = await db.get('SELECT count(*) as c FROM generals');
  if (count.c === 0) {
    console.log('Seeding Database...');
    // Using 200x300 for portrait style cards to match Koei style
    const generals = [
      { name: '关羽', stars: 5, str: 98, int: 75, ldr: 95, luck: 60, country: '蜀', avatar: 'https://picsum.photos/seed/guanyu_v2/200/300', description: '五虎上将之首，义薄云天。' },
      { name: '曹操', stars: 5, str: 85, int: 96, ldr: 99, luck: 80, country: '魏', avatar: 'https://picsum.photos/seed/caocao_v2/200/300', description: '乱世枭雄，魏武帝。' },
      { name: '吕布', stars: 5, str: 100, int: 30, ldr: 80, luck: 40, country: '群', avatar: 'https://picsum.photos/seed/lubu_v2/200/300', description: '人中吕布，马中赤兔。' },
      { name: '周瑜', stars: 5, str: 70, int: 98, ldr: 96, luck: 70, country: '吴', avatar: 'https://picsum.photos/seed/zhouyu_v2/200/300', description: '火烧赤壁，英姿飒爽。' },
      { name: '赵云', stars: 4, str: 96, int: 70, ldr: 85, luck: 90, country: '蜀', avatar: 'https://picsum.photos/seed/zhaoyun_v2/200/300', description: '常山赵子龙，浑身是胆。' },
      { name: '张辽', stars: 4, str: 92, int: 80, ldr: 93, luck: 70, country: '魏', avatar: 'https://picsum.photos/seed/zhangliao_v2/200/300', description: '威震逍遥津。' },
      { name: '甘宁', stars: 4, str: 94, int: 60, ldr: 88, luck: 50, country: '吴', avatar: 'https://picsum.photos/seed/ganning_v2/200/300', description: '百骑劫魏营。' },
      { name: '廖化', stars: 3, str: 75, int: 60, ldr: 70, luck: 80, country: '蜀', avatar: 'https://picsum.photos/seed/liaohua_v2/200/300', description: '蜀中无大将，廖化作先锋。' },
      { name: '潘凤', stars: 3, str: 70, int: 40, ldr: 60, luck: 10, country: '群', avatar: 'https://picsum.photos/seed/panfeng_v2/200/300', description: '无双上将。' },
      { name: '邢道荣', stars: 2, str: 60, int: 30, ldr: 50, luck: 20, country: '群', avatar: 'https://picsum.photos/seed/xingdaorong_v2/200/300', description: '零陵上将。' },
    ];

    for (const g of generals) {
      await db.run(
        `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) VALUES (?,?,?,?,?,?,?,?,?)`,
        [g.name, g.stars, g.str, g.int, g.ldr, g.luck, g.country, g.avatar, g.description]
      );
    }

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