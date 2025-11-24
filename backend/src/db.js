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

  // Comprehensive List of Generals
  const generalsList = [
      // --- WEI ---
      { name: '曹操', stars: 5, str: 85, int: 96, ldr: 99, luck: 80, country: '魏', description: '乱世枭雄，魏武帝。',
        avatar: getAvatar('Cao Cao, ambitious ruler, purple and blue ornate robes, holding sword, calculating expression, villain hero') },
      { name: '夏侯惇', stars: 5, str: 92, int: 60, ldr: 88, luck: 70, country: '魏', description: '魏国元老，独眼将军。',
        avatar: getAvatar('Xiahou Dun, one eyed general, eyepatch, heavy blue armor, holding spear, fierce loyalty') },
      { name: '夏侯渊', stars: 5, str: 91, int: 55, ldr: 86, luck: 60, country: '魏', description: '虎步关右，擅长奔袭。',
        avatar: getAvatar('Xiahou Yuan, archer general, blue armor, holding bow, running posture, dynamic') },
      { name: '曹仁', stars: 5, str: 88, int: 70, ldr: 92, luck: 75, country: '魏', description: '铜墙铁壁，善守名将。',
        avatar: getAvatar('Cao Ren, heavy defensive armor, shield and sword, fortress background, blue theme') },
      { name: '张辽', stars: 5, str: 94, int: 82, ldr: 95, luck: 70, country: '魏', description: '五子良将之首，威震逍遥津。',
        avatar: getAvatar('Zhang Liao, legendary commander, blue and gold armor, dual axes, mustache, calm strength') },
      { name: '张郃', stars: 4, str: 90, int: 75, ldr: 88, luck: 65, country: '魏', description: '用兵巧变，诸葛亮之劲敌。',
        avatar: getAvatar('Zhang He, elegant general, artistic armor, holding spear, intelligent look') },
      { name: '徐晃', stars: 4, str: 91, int: 70, ldr: 85, luck: 60, country: '魏', description: '治军严整，有周亚夫之风。',
        avatar: getAvatar('Xu Huang, disciplinarian general, holding battle axe, solid stance, blue cape') },
      { name: '于禁', stars: 4, str: 84, int: 72, ldr: 86, luck: 40, country: '魏', description: '五子良将，毅重统军。',
        avatar: getAvatar('Yu Jin, stern general, discipline, holding sword, dark blue armor') },
      { name: '乐进', stars: 4, str: 86, int: 50, ldr: 78, luck: 70, country: '魏', description: '先登陷阵，骁果显名。',
        avatar: getAvatar('Le Jin, short but brave general, charging forward, fearless, light armor') },
      { name: '典韦', stars: 5, str: 98, int: 30, ldr: 60, luck: 40, country: '魏', description: '古之恶来，双戟护主。',
        avatar: getAvatar('Dian Wei, muscular giant, dual halberds, savage strength, protecting lord, fierce') },
      { name: '许褚', stars: 5, str: 97, int: 35, ldr: 65, luck: 60, country: '魏', description: '虎痴，力大无穷。',
        avatar: getAvatar('Xu Chu, tiger fool, massive body, holding hammer, loyal gaze, thick armor') },
      { name: '曹真', stars: 4, str: 82, int: 65, ldr: 85, luck: 60, country: '魏', description: '宗室名将，曾破诸葛北伐。',
        avatar: getAvatar('Cao Zhen, noble general, fat armor, commanding troops, confident') },
      { name: '曹休', stars: 4, str: 80, int: 60, ldr: 80, luck: 55, country: '魏', description: '千里驹，大司马。',
        avatar: getAvatar('Cao Xiu, young commander, noble attire, riding horse, blue cloak') },
      { name: '司马懿', stars: 5, str: 70, int: 99, ldr: 97, luck: 90, country: '魏', description: '冢虎，善于隐忍，晋朝奠基。',
        avatar: getAvatar('Sima Yi, cunning strategist, wolf motif, dark purple robes, evil smirk, magical aura') },
      { name: '邓艾', stars: 4, str: 85, int: 90, ldr: 88, luck: 60, country: '魏', description: '灭蜀功臣，偷渡阴平。',
        avatar: getAvatar('Deng Ai, veteran general, looking at map, mountain background, strategic mind') },

      // --- SHU ---
      { name: '刘备', stars: 5, str: 80, int: 85, ldr: 90, luck: 95, country: '蜀', description: '汉昭烈帝，仁德之君。',
        avatar: getAvatar('Liu Bei, benevolent ruler, long earlobes, green and gold robes, dual swords, kind face') },
      { name: '关羽', stars: 5, str: 98, int: 75, ldr: 95, luck: 60, country: '蜀', description: '武圣，义薄云天。',
        avatar: getAvatar('Guan Yu, red face, long beautiful beard, green robe, holding Green Dragon Crescent Blade') },
      { name: '张飞', stars: 5, str: 99, int: 40, ldr: 85, luck: 50, country: '蜀', description: '万人敌，当阳喝断桥。',
        avatar: getAvatar('Zhang Fei, wild hair, round eyes, serpent spear, shouting, black armor') },
      { name: '赵云', stars: 5, str: 96, int: 75, ldr: 88, luck: 90, country: '蜀', description: '常山赵子龙，浑身是胆。',
        avatar: getAvatar('Zhao Yun, handsome hero, shining silver armor, white cape, holding silver spear, baby strapped to chest') },
      { name: '马超', stars: 5, str: 97, int: 50, ldr: 88, luck: 40, country: '蜀', description: '锦马超，西凉神威天将军。',
        avatar: getAvatar('Ma Chao, lion helmet, silver armor, holding spear, handsome face, revengeful look') },
      { name: '黄忠', stars: 5, str: 93, int: 60, ldr: 85, luck: 60, country: '蜀', description: '老当益壮，定军山斩夏侯。',
        avatar: getAvatar('Huang Zhong, old veteran general, white beard, holding great bow, golden armor') },
      { name: '诸葛亮', stars: 5, str: 50, int: 100, ldr: 98, luck: 80, country: '蜀', description: '卧龙，千古贤相。',
        avatar: getAvatar('Zhuge Liang, feather fan, taoist robes, crane motif, wisdom, starry sky') },
      { name: '魏延', stars: 4, str: 92, int: 70, ldr: 85, luck: 20, country: '蜀', description: '勇猛善战，子午谷奇谋。',
        avatar: getAvatar('Wei Yan, red face mask, fierce warrior, holding glaive, rebellious look') },
      { name: '姜维', stars: 4, str: 90, int: 92, ldr: 90, luck: 30, country: '蜀', description: '麒麟儿，九伐中原。',
        avatar: getAvatar('Jiang Wei, young successor, green armor, holding spear and book, determined') },
      { name: '马岱', stars: 3, str: 82, int: 60, ldr: 70, luck: 60, country: '蜀', description: '斩杀魏延，忠诚执行者。',
        avatar: getAvatar('Ma岱, reliable general, assassin strike, green armor') },
      { name: '王平', stars: 3, str: 78, int: 70, ldr: 82, luck: 70, country: '蜀', description: '无当飞军统领，稳重善守。',
        avatar: getAvatar('Wang Ping, stoic face, tribal armor elements, shield, defensive stance') },
      { name: '廖化', stars: 3, str: 75, int: 65, ldr: 70, luck: 85, country: '蜀', description: '蜀中无大将，廖化作先锋。',
        avatar: getAvatar('Liao Hua, very old soldier, survivor, weathered armor, loyal eyes') },
      { name: '关平', stars: 3, str: 84, int: 68, ldr: 75, luck: 50, country: '蜀', description: '关羽义子，烈考流芳。',
        avatar: getAvatar('Guan Ping, young general, holding great sword, green armor like father') },
      { name: '周仓', stars: 3, str: 85, int: 40, ldr: 60, luck: 50, country: '蜀', description: '关羽护卫，力大善泳。',
        avatar: getAvatar('Zhou Cang, dark skin, curly hair, holding massive weapon, shirtless warrior') },
      { name: '严颜', stars: 3, str: 83, int: 65, ldr: 75, luck: 60, country: '蜀', description: '断头将军，老将风骨。',
        avatar: getAvatar('Yan Yan, old general, white hair, angry expression, tied up but proud') },

      // --- WU ---
      { name: '孙坚', stars: 5, str: 94, int: 70, ldr: 92, luck: 40, country: '吴', description: '江东猛虎，汉末英杰。',
        avatar: getAvatar('Sun Jian, tiger spirit, red headband, red armor, ancient sword, fierce father') },
      { name: '孙策', stars: 5, str: 95, int: 75, ldr: 94, luck: 30, country: '吴', description: '小霸王，开拓江东。',
        avatar: getAvatar('Sun Ce, young conqueror, handsome, holding tonfa or spear, energetic, red cloak') },
      { name: '孙权', stars: 5, str: 75, int: 85, ldr: 95, luck: 90, country: '吴', description: '碧眼儿，坐断东南。',
        avatar: getAvatar('Sun Quan, green eyes, red beard, emperor robes, sword, calculating') },
      { name: '周瑜', stars: 5, str: 75, int: 98, ldr: 97, luck: 70, country: '吴', description: '美周郎，赤壁纵火。',
        avatar: getAvatar('Zhou Yu, beautiful man, playing guqin, fire background, elegant red armor') },
      { name: '鲁肃', stars: 4, str: 60, int: 94, ldr: 90, luck: 75, country: '吴', description: '榻上策，忠厚长者。',
        avatar: getAvatar('Lu Su, diplomat, scholar robes, holding scroll, kind face, rich') },
      { name: '吕蒙', stars: 5, str: 85, int: 90, ldr: 93, luck: 60, country: '吴', description: '白衣渡江，士别三日。',
        avatar: getAvatar('Lu Meng, studying book, white cloak, hidden armor, intelligent warrior') },
      { name: '陆逊', stars: 5, str: 70, int: 97, ldr: 96, luck: 85, country: '吴', description: '火烧连营，书生拜帅。',
        avatar: getAvatar('Lu Xun, young scholar, fire strategy, sword, elegant pose, red theme') },
      { name: '太史慈', stars: 4, str: 93, int: 65, ldr: 85, luck: 50, country: '吴', description: '信义笃烈，神射手。',
        avatar: getAvatar('Taishi Ci, dual short halberds, bow on back, heroic stance, loyal') },
      { name: '甘宁', stars: 4, str: 94, int: 60, ldr: 88, luck: 50, country: '吴', description: '锦帆贼，百骑劫营。',
        avatar: getAvatar('Gan Ning, pirate, bells, feathers, shirtless, chain weapon, wild') },
      { name: '黄盖', stars: 3, str: 83, int: 60, ldr: 80, luck: 60, country: '吴', description: '苦肉计，三世老臣。',
        avatar: getAvatar('Huang Gai, old muscular man, iron whip, scars, determination') },
      { name: '程普', stars: 3, str: 80, int: 70, ldr: 85, luck: 70, country: '吴', description: '江东元老，荡寇将军。',
        avatar: getAvatar('Cheng Pu, elderly general, snake spear, red armor, respected') },
      { name: '韩当', stars: 3, str: 81, int: 60, ldr: 75, luck: 65, country: '吴', description: '擅长水战，骑射骁勇。',
        avatar: getAvatar('Han Dang, naval commander, bow, on boat background') },
      { name: '周泰', stars: 4, str: 90, int: 40, ldr: 65, luck: 80, country: '吴', description: '不屈战神，身如刻画。',
        avatar: getAvatar('Zhou泰, scars all over body, heavy shield, katana like sword, protecting lord') },
      { name: '凌统', stars: 3, str: 86, int: 60, ldr: 75, luck: 55, country: '吴', description: '国士之风，少年英雄。',
        avatar: getAvatar('Ling Tong, handsome young general, agile, dual swords') },
      { name: '丁奉', stars: 3, str: 82, int: 65, ldr: 78, luck: 80, country: '吴', description: '雪中奋短兵，除权臣。',
        avatar: getAvatar('Ding Feng, snow background, taking off armor, holding dagger, old but strong') },

      // --- OTHERS (QUN) ---
      { name: '吕布', stars: 5, str: 100, int: 30, ldr: 85, luck: 20, country: '群', description: '飞将，天下无双。',
        avatar: getAvatar('Lu Bu, demon god warrior, pheasant tails, red hare horse, halberd, menacing') },
      { name: '董卓', stars: 4, str: 85, int: 70, ldr: 80, luck: 60, country: '群', description: '暴虐太师，祸乱天下。',
        avatar: getAvatar('Dong Zhuo, fat tyrant, holding wine cup, evil laugh, luxurious robes') },
      { name: '袁绍', stars: 4, str: 70, int: 75, ldr: 90, luck: 50, country: '群', description: '四世三公，河北霸主。',
        avatar: getAvatar('Yuan Shao, golden armor, noble arrogant face, commanding army, sword') },
      { name: '颜良', stars: 4, str: 93, int: 40, ldr: 80, luck: 20, country: '群', description: '河北四庭柱，骁勇善战。',
        avatar: getAvatar('Yan Liang, fierce face, heavy armor, holding glaive, charging') },
      { name: '文丑', stars: 4, str: 92, int: 35, ldr: 78, luck: 20, country: '群', description: '河北名将，与颜良齐名。',
        avatar: getAvatar('Wen Chou, ugly mask, bow and arrow, spear, dark armor') },
      { name: '高览', stars: 3, str: 85, int: 60, ldr: 75, luck: 60, country: '群', description: '河北四庭柱之一，后降曹。',
        avatar: getAvatar('Gao Lan, standard general armor, spear, serious face') },
      { name: '袁术', stars: 3, str: 60, int: 60, ldr: 50, luck: 20, country: '群', description: '冢中枯骨，妄自称帝。',
        avatar: getAvatar('Yuan Shu, skeleton throne, holding imperial seal, insane look, gaudy clothes') },
      { name: '纪灵', stars: 3, str: 83, int: 50, ldr: 75, luck: 50, country: '群', description: '袁术麾下第一大将，三尖两刃刀。',
        avatar: getAvatar('Ji Ling, three pointed double edged blade, heavy armor, loyal to Yuan Shu') },
      { name: '刘表', stars: 3, str: 50, int: 80, ldr: 75, luck: 60, country: '群', description: '八骏之一，坐谈客。',
        avatar: getAvatar('Liu Biao, old scholar, reading book, peaceful robes') },
      { name: '公孙瓒', stars: 3, str: 82, int: 60, ldr: 80, luck: 40, country: '群', description: '白马将军，威震塞外。',
        avatar: getAvatar('Gongsun Zan, white horse, white armor, cavalry commander') },
      { name: '华雄', stars: 3, str: 88, int: 40, ldr: 70, luck: 10, country: '群', description: '关西猛将，斩杀潘凤。',
        avatar: getAvatar('Hua Xiong, giant man, wolf fur, savage, holding head') },
      { name: '李傕', stars: 2, str: 75, int: 50, ldr: 65, luck: 40, country: '群', description: '董卓部将，祸乱长安。',
        avatar: getAvatar('Li Jue, bandit general, cunning look, looting') },
      { name: '郭汜', stars: 2, str: 74, int: 45, ldr: 65, luck: 40, country: '群', description: '董卓部将，李傕同党。',
        avatar: getAvatar('Guo Si, bandit look, scar face, horse thief') },
      { name: '张绣', stars: 3, str: 80, int: 65, ldr: 75, luck: 50, country: '群', description: '北地枪王，曾败曹操。',
        avatar: getAvatar('Zhang Xiu, master of spear, phoenix strike, determined') },
      { name: '马腾', stars: 3, str: 80, int: 60, ldr: 85, luck: 40, country: '群', description: '伏波将军之后，西凉太守。',
        avatar: getAvatar('Ma Teng, old beard, foreign armor style, father figure') },
      { name: '邢道荣', stars: 2, str: 60, int: 30, ldr: 50, luck: 20, country: '群', description: '零陵上将，口出狂言。',
        avatar: getAvatar('Xing Daorong, comedy face, axe, arrogant') },
      { name: '潘凤', stars: 3, str: 70, int: 40, ldr: 60, luck: 10, country: '群', description: '无双上将，我的大斧饥渴难耐。',
        avatar: getAvatar('Pan Feng, huge axe, confident but weak, heavy armor') },
  ];

  // Seed Logic: Upsert (Insert if not exists)
  console.log('Seeding Database with Generals...');
  for (const g of generalsList) {
    // Check if exists by name to prevent duplicates
    const existing = await db.get('SELECT id FROM generals WHERE name = ?', [g.name]);
    if (!existing) {
        await db.run(
          `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) VALUES (?,?,?,?,?,?,?,?,?)`,
          [g.name, g.stars, g.str, g.int, g.ldr, g.luck, g.country, g.avatar, g.description]
        );
        console.log(`Inserted ${g.name}`);
    } else {
        // Optional: Update stats/avatar if they changed in code (commented out to preserve user customization if any)
        // await db.run(`UPDATE generals SET stars=?, str=?, int=?, ldr=?, luck=?, country=?, avatar=?, description=? WHERE id=?`, 
        //   [g.stars, g.str, g.int, g.ldr, g.luck, g.country, g.avatar, g.description, existing.id]);
    }
  }

  // Seed Campaigns & Equipment (Only if table is empty)
  const campCount = await db.get('SELECT count(*) as c FROM campaigns');
  if (campCount.c === 0) {
    const campaigns = [
      { name: '黄巾之乱', req_power: 100, gold: 100, exp: 50 },
      { name: '虎牢关之战', req_power: 500, gold: 300, exp: 150 },
      { name: '官渡之战', req_power: 1500, gold: 800, exp: 400 },
      { name: '赤壁之战', req_power: 3000, gold: 2000, exp: 1000 },
      { name: '汉中之战', req_power: 5000, gold: 4000, exp: 2000 },
      { name: '夷陵之战', req_power: 8000, gold: 6000, exp: 3000 },
      { name: '五丈原', req_power: 12000, gold: 10000, exp: 5000 },
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
        { name: '青釭剑', type: 'weapon', stat_bonus: 45, stars: 5 },
        { name: '方天画戟', type: 'weapon', stat_bonus: 55, stars: 5 },
        { name: '雌雄双股剑', type: 'weapon', stat_bonus: 40, stars: 5 },
        { name: '古锭刀', type: 'weapon', stat_bonus: 28, stars: 4 },
        { name: '烂银枪', type: 'weapon', stat_bonus: 30, stars: 4 },
        { name: '铁脊蛇矛', type: 'weapon', stat_bonus: 20, stars: 3 },
        { name: '大斧', type: 'weapon', stat_bonus: 15, stars: 3 },
        { name: '铁剑', type: 'weapon', stat_bonus: 10, stars: 2 },
        
        { name: '兽面吞头铠', type: 'armor', stat_bonus: 40, stars: 5 },
        { name: '八卦袍', type: 'armor', stat_bonus: 35, stars: 5 },
        { name: '明光铠', type: 'armor', stat_bonus: 35, stars: 4 },
        { name: '锁子甲', type: 'armor', stat_bonus: 20, stars: 3 },
        { name: '皮甲', type: 'armor', stat_bonus: 10, stars: 2 },

        { name: '赤兔马', type: 'treasure', stat_bonus: 40, stars: 5 },
        { name: '的卢', type: 'treasure', stat_bonus: 35, stars: 4 },
        { name: '绝影', type: 'treasure', stat_bonus: 30, stars: 4 },
        { name: '爪黄飞电', type: 'treasure', stat_bonus: 30, stars: 4 },
        { name: '玉玺', type: 'treasure', stat_bonus: 50, stars: 5 },
        { name: '孟德新书', type: 'treasure', stat_bonus: 25, stars: 4 },
        { name: '孙子兵法', type: 'treasure', stat_bonus: 45, stars: 5 },
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