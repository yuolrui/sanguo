import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcryptjs from 'bcryptjs';

let db;

// Helper: Generate Koei-style Avatar URL based on attributes
const getAvatarUrl = (name, stars, country, keywords) => {
    // 1. Country Theme Colors & Atmosphere
    let theme = '';
    switch(country) {
        case '魏': 
            theme = 'main color majestic blue and purple, cold winter atmosphere, imposing palace background, noble aura'; 
            break;
        case '蜀': 
            theme = 'main color emerald green and gold, warm sunlight, bamboo forest or mountain background, benevolent aura'; 
            break;
        case '吴': 
            theme = 'main color crimson red and gold, fire particles, yangtze river background, fierce heroic aura'; 
            break;
        case '群': 
            theme = 'main color dark grey and black iron, chaotic battlefield smoke background, intimidating warlord aura'; 
            break;
        default:
            theme = 'ancient chinese warrior style';
    }

    // 2. Star Rating Quality & Detail Level
    let quality = '';
    switch(stars) {
        case 5: 
            quality = 'legendary masterpiece, god ray lighting, extremely intricate ornate armor with gold trim, glowing eyes, hyper-detailed face, 8k resolution, cinematic depth of field'; 
            break;
        case 4: 
            quality = 'epic hero portrait, highly detailed ornate armor, sharp focus, dynamic dramatic lighting, 4k resolution'; 
            break;
        case 3: 
            quality = 'veteran general, battle-worn realistic armor, gritty texture, serious expression, realistic lighting'; 
            break;
        default: 
            quality = 'common soldier, simple leather and iron armor, rough texture, muted colors'; 
            break;
    }

    // 3. Construct Prompt
    // "Koei Romance of the Three Kingdoms style" is the core anchor
    const prompt = encodeURIComponent(`Portrait of ${keywords}, ${name}, ${theme}, ${quality}, Koei Romance of the Three Kingdoms XIV art style, oil painting texture, hyper-realistic face`);
    
    // 4. Stable Seed based on name
    const seed = name.split('').reduce((a,b)=>a+b.charCodeAt(0), 0);
    
    return `https://image.pollinations.ai/prompt/${prompt}?width=300&height=450&nologo=true&seed=${seed}&model=flux`;
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
      name TEXT UNIQUE,
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

    CREATE TABLE IF NOT EXISTS user_shards (
      user_id INTEGER,
      general_id INTEGER,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, general_id),
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
  } catch (e) {}

  // Migration: Deduplicate generals if any exist from previous versions to allow unique index creation
  try {
      await db.run("DELETE FROM generals WHERE id NOT IN (SELECT MIN(id) FROM generals GROUP BY name)");
  } catch (e) {
      console.log("Deduplication step skipped or failed:", e.message);
  }

  // Migration: Ensure 'name' in 'generals' is unique
  try {
      await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_generals_name ON generals(name)");
  } catch (e) {
      console.warn("Warning: Could not create unique index on generals(name).", e.message);
  }

  // Raw General Data (without avatars)
  const rawGenerals = [
      // --- WEI (50) ---
      { name: '曹操', stars: 5, str: 85, int: 96, ldr: 99, luck: 80, country: '魏', description: '乱世枭雄，魏武帝。', keywords: 'Cao Cao, ambitious ruler, beard' },
      { name: '曹丕', stars: 4, str: 70, int: 85, ldr: 80, luck: 80, country: '魏', description: '魏文帝，曹操次子，篡汉建魏。', keywords: 'Cao Pi, emperor, cold gaze, crown' },
      { name: '曹叡', stars: 4, str: 60, int: 88, ldr: 85, luck: 70, country: '魏', description: '魏明帝，善于权谋。', keywords: 'Cao Rui, young emperor, intelligent' },
      { name: '曹植', stars: 3, str: 40, int: 92, ldr: 40, luck: 50, country: '魏', description: '七步成诗，才高八斗。', keywords: 'Cao Zhi, poet, drinking wine' },
      { name: '曹彰', stars: 4, str: 92, int: 40, ldr: 75, luck: 60, country: '魏', description: '黄须儿，手格猛兽。', keywords: 'Cao Zhang, yellow beard, barbarian armor' },
      { name: '曹仁', stars: 5, str: 88, int: 70, ldr: 92, luck: 75, country: '魏', description: '天人将军，铜墙铁壁。', keywords: 'Cao Ren, heavy defensive armor, shield' },
      { name: '曹洪', stars: 4, str: 82, int: 50, ldr: 75, luck: 80, country: '魏', description: '屡救曹操，福将。', keywords: 'Cao Hong, desperate defense' },
      { name: '曹休', stars: 4, str: 80, int: 60, ldr: 80, luck: 55, country: '魏', description: '曹家千里驹，大司马。', keywords: 'Cao Xiu, young commander, riding horse' },
      { name: '曹真', stars: 4, str: 82, int: 65, ldr: 85, luck: 60, country: '魏', description: '大将军，曾破诸葛北伐。', keywords: 'Cao Zhen, fat armor, commanding troops' },
      { name: '夏侯惇', stars: 5, str: 92, int: 60, ldr: 88, luck: 70, country: '魏', description: '魏国元老，拔矢啖睛。', keywords: 'Xiahou Dun, eyepatch, heavy armor, spear' },
      { name: '夏侯渊', stars: 5, str: 91, int: 55, ldr: 86, luck: 60, country: '魏', description: '虎步关右，擅长千里奔袭。', keywords: 'Xiahou Yuan, archer general, running' },
      { name: '夏侯霸', stars: 3, str: 80, int: 50, ldr: 70, luck: 40, country: '魏', description: '夏侯渊之子，后投蜀汉。', keywords: 'Xiahou Ba, conflicted general' },
      { name: '夏侯尚', stars: 3, str: 75, int: 75, ldr: 80, luck: 60, country: '魏', description: '征南大将军，平定上庸。', keywords: 'Xiahou Shang, strategic, map' },
      { name: '张辽', stars: 5, str: 94, int: 82, ldr: 95, luck: 70, country: '魏', description: '五子良将之首，威震逍遥津。', keywords: 'Zhang Liao, legendary commander, dual axes' },
      { name: '张郃', stars: 4, str: 90, int: 75, ldr: 88, luck: 65, country: '魏', description: '五子良将，巧变善战。', keywords: 'Zhang He, elegant armor, spear' },
      { name: '徐晃', stars: 4, str: 91, int: 70, ldr: 85, luck: 60, country: '魏', description: '五子良将，亚夫之风。', keywords: 'Xu Huang, battle axe, discipline' },
      { name: '于禁', stars: 4, str: 84, int: 72, ldr: 86, luck: 40, country: '魏', description: '五子良将，毅重统军。', keywords: 'Yu Jin, stern face, dark armor' },
      { name: '乐进', stars: 4, str: 86, int: 50, ldr: 78, luck: 70, country: '魏', description: '五子良将，先登陷阵。', keywords: 'Le Jin, short brave general, charging' },
      { name: '李典', stars: 3, str: 75, int: 78, ldr: 75, luck: 60, country: '魏', description: '深明大义，儒将。', keywords: 'Li Dian, scholar general, calm' },
      { name: '典韦', stars: 5, str: 98, int: 30, ldr: 60, luck: 40, country: '魏', description: '古之恶来，双戟护主。', keywords: 'Dian Wei, muscular giant, dual halberds' },
      { name: '许褚', stars: 5, str: 97, int: 35, ldr: 65, luck: 60, country: '魏', description: '虎痴，裸衣斗马超。', keywords: 'Xu Chu, shirtless warrior, hammer' },
      { name: '文聘', stars: 4, str: 82, int: 65, ldr: 85, luck: 70, country: '魏', description: '江夏名将，数退关羽。', keywords: 'Wen Pin, defensive stance' },
      { name: '庞德', stars: 4, str: 93, int: 50, ldr: 75, luck: 30, country: '魏', description: '白马将军，抬棺决战。', keywords: 'Pang De, coffin, fierce determination' },
      { name: '臧霸', stars: 3, str: 80, int: 60, ldr: 75, luck: 70, country: '魏', description: '泰山寇首，威震青徐。', keywords: 'Zang Ba, bandit leader style' },
      { name: '孙礼', stars: 3, str: 82, int: 60, ldr: 70, luck: 60, country: '魏', description: '刚毅勇猛，曾搏虎救主。', keywords: 'Sun Li, fighting tiger, brave' },
      { name: '郭淮', stars: 4, str: 75, int: 85, ldr: 88, luck: 70, country: '魏', description: '御蜀屏障，算无遗策。', keywords: 'Guo Huai, old strategist, border defense' },
      { name: '郝昭', stars: 4, str: 80, int: 82, ldr: 90, luck: 60, country: '魏', description: '陈仓铁壁，千兵拒诸葛。', keywords: 'Hao Zhao, burning siege ladders, wall' },
      { name: '王双', stars: 3, str: 88, int: 20, ldr: 60, luck: 40, country: '魏', description: '身长九尺，善使流星锤。', keywords: 'Wang Shuang, meteor hammer, giant' },
      { name: '诸葛诞', stars: 3, str: 75, int: 75, ldr: 80, luck: 40, country: '魏', description: '淮南三叛，功狗。', keywords: 'Zhuge Dan, ambitious, rebel' },
      { name: '钟会', stars: 5, str: 60, int: 94, ldr: 85, luck: 30, country: '魏', description: '精练策数，灭蜀主将。', keywords: 'Zhong Hui, young genius, arrogant' },
      { name: '邓艾', stars: 5, str: 85, int: 90, ldr: 88, luck: 60, country: '魏', description: '灭蜀奇功，偷渡阴平。', keywords: 'Deng Ai, mountain climbing, veteran' },
      { name: '陈泰', stars: 4, str: 75, int: 86, ldr: 85, luck: 70, country: '魏', description: '陈群之子，弘雅有风。', keywords: 'Chen Tai, refined general' },
      { name: '司马懿', stars: 5, str: 70, int: 99, ldr: 97, luck: 90, country: '魏', description: '冢虎，鹰视狼顾。', keywords: 'Sima Yi, dark aura, wolf shadow' },
      { name: '司马师', stars: 4, str: 75, int: 90, ldr: 88, luck: 70, country: '魏', description: '沉着冷静，废立皇帝。', keywords: 'Sima Shi, eye tumor mask, cruel' },
      { name: '司马昭', stars: 4, str: 70, int: 92, ldr: 85, luck: 80, country: '魏', description: '路人皆知，灭蜀元勋。', keywords: 'Sima Zhao, laughing, controlling puppet' },
      { name: '羊祜', stars: 5, str: 70, int: 92, ldr: 92, luck: 85, country: '魏', description: '德名遐迩，堕泪碑。', keywords: 'Yang Hu, gentle scholar general, white robes' },
      { name: '杜预', stars: 5, str: 30, int: 90, ldr: 90, luck: 80, country: '魏', description: '武库，灭吴主帅。', keywords: 'Du Yu, reading classics, weapons' },
      { name: '王濬', stars: 4, str: 80, int: 75, ldr: 85, luck: 70, country: '魏', description: '楼船下益州，金陵王气收。', keywords: 'Wang Jun, giant warship' },
      { name: '贾逵', stars: 3, str: 70, int: 80, ldr: 75, luck: 60, country: '魏', description: '据守弘农，忠臣。', keywords: 'Jia Kui, stern official' },
      { name: '满宠', stars: 4, str: 75, int: 88, ldr: 85, luck: 70, country: '魏', description: '酷吏，镇守合肥数十载。', keywords: 'Man Chong, torture devices, defensive' },
      { name: '田豫', stars: 4, str: 80, int: 82, ldr: 85, luck: 70, country: '魏', description: '威震北疆，曾随刘备。', keywords: 'Tian Yu, northern fur armor' },
      { name: '牵招', stars: 4, str: 80, int: 80, ldr: 85, luck: 70, country: '魏', description: '刎颈之交，镇守边陲。', keywords: 'Qian Zhao, serious, border patrol' },
      { name: '秦朗', stars: 3, str: 75, int: 60, ldr: 70, luck: 60, country: '魏', description: '曹操养子，低调骁勇。', keywords: 'Qin Lang, cautious, standard armor' },
      { name: '夏侯威', stars: 3, str: 70, int: 65, ldr: 60, luck: 60, country: '魏', description: '夏侯渊次子，颇有侠气。', keywords: 'Xiahou Wei, young noble' },
      { name: '夏侯惠', stars: 3, str: 50, int: 75, ldr: 60, luck: 60, country: '魏', description: '善属文，有才辩。', keywords: 'Xiahou Hui, scholar, writing' },
      { name: '曹爽', stars: 3, str: 60, int: 40, ldr: 50, luck: 20, country: '魏', description: '志大才疏，被司马懿诛杀。', keywords: 'Cao Shuang, luxurious clothes, foolish' },
      { name: '桓范', stars: 3, str: 30, int: 85, ldr: 50, luck: 20, country: '魏', description: '智囊，曹爽谋士。', keywords: 'Huan Fan, desperate advisor' },
      { name: '韩德', stars: 2, str: 75, int: 40, ldr: 60, luck: 30, country: '魏', description: '西凉大将，父子五人皆死。', keywords: 'Han De, battle axe, old warrior' },
      { name: '夏侯楙', stars: 2, str: 40, int: 30, ldr: 30, luck: 80, country: '魏', description: '怯懦驸马，无能之辈。', keywords: 'Xiahou Mao, scared, rich clothes' },
      { name: '王凌', stars: 3, str: 70, int: 75, ldr: 75, luck: 40, country: '魏', description: '淮南一叛，自杀谢罪。', keywords: 'Wang Ling, old general, suicide' },

      // --- SHU (50) ---
      { name: '刘备', stars: 5, str: 80, int: 85, ldr: 90, luck: 95, country: '蜀', description: '汉昭烈帝，仁德之君。', keywords: 'Liu Bei, benevolent ruler, dual swords' },
      { name: '刘禅', stars: 2, str: 20, int: 20, ldr: 30, luck: 90, country: '蜀', description: '乐不思蜀，后主。', keywords: 'Liu Chan, fat, eating, happy' },
      { name: '关羽', stars: 5, str: 98, int: 75, ldr: 95, luck: 60, country: '蜀', description: '武圣，义薄云天。', keywords: 'Guan Yu, green dragon blade, red face, long beard' },
      { name: '张飞', stars: 5, str: 99, int: 40, ldr: 85, luck: 50, country: '蜀', description: '万人敌，当阳喝断桥。', keywords: 'Zhang Fei, serpent spear, shouting' },
      { name: '赵云', stars: 5, str: 96, int: 75, ldr: 88, luck: 90, country: '蜀', description: '常山赵子龙，浑身是胆。', keywords: 'Zhao Yun, silver armor, baby on chest' },
      { name: '马超', stars: 5, str: 97, int: 50, ldr: 88, luck: 40, country: '蜀', description: '锦马超，神威天将军。', keywords: 'Ma Chao, lion helmet, silver armor' },
      { name: '黄忠', stars: 5, str: 93, int: 60, ldr: 85, luck: 60, country: '蜀', description: '老当益壮，箭无虚发。', keywords: 'Huang Zhong, old man, bow and arrow' },
      { name: '诸葛亮', stars: 5, str: 50, int: 100, ldr: 98, luck: 80, country: '蜀', description: '卧龙，千古贤相。', keywords: 'Zhuge Liang, feather fan, magic' },
      { name: '庞统', stars: 5, str: 40, int: 98, ldr: 85, luck: 30, country: '蜀', description: '凤雏，连环计。', keywords: 'Pang Tong, ugly face, phoenix aura' },
      { name: '法正', stars: 5, str: 40, int: 96, ldr: 80, luck: 50, country: '蜀', description: '蜀汉谋主，睚眦必报。', keywords: 'Fa Zheng, dark robes, scheming' },
      { name: '魏延', stars: 4, str: 92, int: 70, ldr: 85, luck: 20, country: '蜀', description: '脑后有反骨，子午谷奇谋。', keywords: 'Wei Yan, red mask, fierce' },
      { name: '姜维', stars: 5, str: 90, int: 92, ldr: 90, luck: 30, country: '蜀', description: '天水麒麟儿，继承遗志。', keywords: 'Jiang Wei, green armor, spear and book' },
      { name: '马岱', stars: 3, str: 82, int: 60, ldr: 70, luck: 60, country: '蜀', description: '斩杀魏延，久经沙场。', keywords: 'Ma Dai, assassin strike' },
      { name: '王平', stars: 4, str: 78, int: 70, ldr: 85, luck: 70, country: '蜀', description: '无当飞军，识字不满十。', keywords: 'Wang Ping, tribal armor, shield' },
      { name: '李严', stars: 4, str: 80, int: 80, ldr: 80, luck: 40, country: '蜀', description: '托孤大臣，运粮不力。', keywords: 'Li Yan, official robes, worried' },
      { name: '刘封', stars: 3, str: 85, int: 50, ldr: 70, luck: 30, country: '蜀', description: '刘备义子，刚猛。', keywords: 'Liu Feng, angry, denied entry' },
      { name: '关平', stars: 3, str: 84, int: 68, ldr: 75, luck: 50, country: '蜀', description: '关羽义子，烈考流芳。', keywords: 'Guan Ping, young general, big sword' },
      { name: '关兴', stars: 4, str: 86, int: 65, ldr: 75, luck: 60, country: '蜀', description: '关羽次子，名将之后。', keywords: 'Guan Xing, young hero, green armor' },
      { name: '张苞', stars: 4, str: 87, int: 40, ldr: 70, luck: 50, country: '蜀', description: '张飞长子，勇猛如父。', keywords: 'Zhang Bao, snake spear, black armor' },
      { name: '周仓', stars: 3, str: 85, int: 40, ldr: 60, luck: 50, country: '蜀', description: '关羽护卫，日行千里。', keywords: 'Zhou Cang, dark skin, curly hair' },
      { name: '廖化', stars: 3, str: 75, int: 65, ldr: 70, luck: 85, country: '蜀', description: '先锋，见证蜀汉兴衰。', keywords: 'Liao Hua, very old soldier' },
      { name: '张翼', stars: 3, str: 75, int: 65, ldr: 75, luck: 60, country: '蜀', description: '亢厉，敢于直言。', keywords: 'Zhang Yi, argumentative' },
      { name: '张嶷', stars: 4, str: 80, int: 75, ldr: 82, luck: 50, country: '蜀', description: '安抚南中，带病出征。', keywords: 'Zhang Ni, sickly but strong, rattan armor' },
      { name: '吴懿', stars: 3, str: 75, int: 70, ldr: 80, luck: 70, country: '蜀', description: '国舅，车骑将军。', keywords: 'Wu Yi, noble armor' },
      { name: '吴班', stars: 3, str: 75, int: 60, ldr: 70, luck: 60, country: '蜀', description: '豪爽，与张飞亲善。', keywords: 'Wu Ban, laughing, drinking' },
      { name: '陈到', stars: 4, str: 85, int: 60, ldr: 80, luck: 70, country: '蜀', description: '白毦兵统帅，仅次赵云。', keywords: 'Chen Dao, white feather armor, bodyguard' },
      { name: '霍峻', stars: 4, str: 78, int: 75, ldr: 85, luck: 60, country: '蜀', description: '孤城守将，以少胜多。', keywords: 'Huo Jun, fortress, defensive' },
      { name: '霍弋', stars: 3, str: 75, int: 70, ldr: 75, luck: 60, country: '蜀', description: '镇守南中，忠贞不二。', keywords: 'Huo Yi, southern background' },
      { name: '傅肜', stars: 3, str: 75, int: 50, ldr: 70, luck: 30, country: '蜀', description: '夷陵断后，死战不退。', keywords: 'Fu Tong, fire background, bleeding' },
      { name: '傅佥', stars: 3, str: 80, int: 60, ldr: 70, luck: 30, country: '蜀', description: '傅肜之子，亦战死沙场。', keywords: 'Fu Qian, dual swords, desperate' },
      { name: '冯习', stars: 3, str: 70, int: 60, ldr: 70, luck: 30, country: '蜀', description: '夷陵大都督，惨败。', keywords: 'Feng Xi, fire, regret' },
      { name: '张南', stars: 3, str: 72, int: 50, ldr: 65, luck: 30, country: '蜀', description: '夷陵前锋。', keywords: 'Zhang Nan, standard armor' },
      { name: '黄权', stars: 4, str: 60, int: 85, ldr: 80, luck: 50, country: '蜀', description: '良臣，被迫降魏。', keywords: 'Huang Quan, looking back, sad' },
      { name: '李恢', stars: 3, str: 60, int: 75, ldr: 70, luck: 60, country: '蜀', description: '口辩之才，平定南中。', keywords: 'Li Hui, talking, pointing' },
      { name: '马忠', stars: 3, str: 70, int: 70, ldr: 75, luck: 60, country: '蜀', description: '抚育百姓，深受爱戴。', keywords: 'Ma Zhong, kind general' },
      { name: '邓芝', stars: 3, str: 60, int: 80, ldr: 75, luck: 70, country: '蜀', description: '出使东吴，不辱使命。', keywords: 'Deng Zhi, diplomat, holding staff' },
      { name: '向宠', stars: 3, str: 60, int: 70, ldr: 75, luck: 60, country: '蜀', description: '性行淑均，晓畅军事。', keywords: 'Xiang Chong, calm, orderly' },
      { name: '赵统', stars: 3, str: 75, int: 60, ldr: 65, luck: 60, country: '蜀', description: '赵云长子，虎贲中郎。', keywords: 'Zhao Tong, white armor likeness' },
      { name: '赵广', stars: 3, str: 74, int: 50, ldr: 65, luck: 30, country: '蜀', description: '赵云次子，随姜维战死。', keywords: 'Zhao Guang, young warrior' },
      { name: '高翔', stars: 3, str: 70, int: 50, ldr: 65, luck: 50, country: '蜀', description: '北伐将领。', keywords: 'Gao Xiang, supply caravan' },
      { name: '辅匡', stars: 3, str: 65, int: 50, ldr: 60, luck: 50, country: '蜀', description: '蜀中旧臣，年长。', keywords: 'Fu Kuang, old armor' },
      { name: '刘琰', stars: 2, str: 40, int: 60, ldr: 30, luck: 20, country: '蜀', description: '与魏延不和，因妻见太后被杀。', keywords: 'Liu Yan, fancy clothes, arguing' },
      { name: '糜竺', stars: 3, str: 30, int: 75, ldr: 40, luck: 70, country: '蜀', description: '巨富，资助刘备。', keywords: 'Mi Zhu, merchant, coins' },
      { name: '糜芳', stars: 2, str: 60, int: 40, ldr: 50, luck: 20, country: '蜀', description: '背叛关羽，投降东吴。', keywords: 'Mi Fang, traitor, hiding face' },
      { name: '士仁', stars: 2, str: 55, int: 30, ldr: 45, luck: 20, country: '蜀', description: '与糜芳一同投降。', keywords: 'Shi Ren, cowardly' },
      { name: '孟达', stars: 3, str: 70, int: 75, ldr: 70, luck: 20, country: '蜀', description: '反复无常，被司马懿斩杀。', keywords: 'Meng Da, playing flute' },
      { name: '严颜', stars: 3, str: 83, int: 65, ldr: 75, luck: 60, country: '蜀', description: '断头将军，老将风骨。', keywords: 'Yan Yan, tied up, angry' },
      { name: '罗宪', stars: 4, str: 75, int: 80, ldr: 85, luck: 60, country: '蜀', description: '蜀亡后死守永安，抗击东吴。', keywords: 'Luo Xian, lone fortress, shield' },
      { name: '诸葛尚', stars: 3, str: 85, int: 70, ldr: 60, luck: 20, country: '蜀', description: '诸葛瞻之子，绵竹战死。', keywords: 'Zhuge Shang, young desperate charge' },

      // --- WU (50) ---
      { name: '孙坚', stars: 5, str: 94, int: 70, ldr: 92, luck: 40, country: '吴', description: '江东猛虎。', keywords: 'Sun Jian, red armor, tiger' },
      { name: '孙策', stars: 5, str: 95, int: 75, ldr: 94, luck: 30, country: '吴', description: '小霸王。', keywords: 'Sun Ce, red cape, spear' },
      { name: '孙权', stars: 5, str: 75, int: 85, ldr: 95, luck: 90, country: '吴', description: '千古大帝，坐断东南。', keywords: 'Sun Quan, green eyes, purple beard' },
      { name: '孙亮', stars: 2, str: 20, int: 60, ldr: 40, luck: 20, country: '吴', description: '吴废帝。', keywords: 'Sun Liang, child emperor' },
      { name: '孙休', stars: 3, str: 30, int: 75, ldr: 60, luck: 60, country: '吴', description: '吴景帝，除孙綝。', keywords: 'Sun Xiu, scholar emperor' },
      { name: '孙皓', stars: 2, str: 50, int: 40, ldr: 30, luck: 10, country: '吴', description: '暴君，亡国之君。', keywords: 'Sun Hao, cruel face, wine' },
      { name: '周瑜', stars: 5, str: 75, int: 98, ldr: 97, luck: 70, country: '吴', description: '美周郎，赤壁纵火。', keywords: 'Zhou Yu, fire, guqin' },
      { name: '鲁肃', stars: 5, str: 60, int: 94, ldr: 90, luck: 75, country: '吴', description: '战略大家，单刀赴会。', keywords: 'Lu Su, scholar, negotiation' },
      { name: '吕蒙', stars: 5, str: 85, int: 90, ldr: 93, luck: 60, country: '吴', description: '白衣渡江，克取荆州。', keywords: 'Lu Meng, white cloak, boat' },
      { name: '陆逊', stars: 5, str: 70, int: 97, ldr: 96, luck: 85, country: '吴', description: '夷陵之战，火烧连营。', keywords: 'Lu Xun, young scholar, fire' },
      { name: '陆抗', stars: 5, str: 75, int: 94, ldr: 95, luck: 80, country: '吴', description: '东吴最后的名将，羊陆之交。', keywords: 'Lu Kang, defensive wall, calm' },
      { name: '张昭', stars: 4, str: 20, int: 92, ldr: 60, luck: 70, country: '吴', description: '内事不决问张昭。', keywords: 'Zhang Zhao, old official, angry' },
      { name: '程普', stars: 4, str: 80, int: 70, ldr: 85, luck: 70, country: '吴', description: '三代老臣，副都督。', keywords: 'Cheng Pu, old general, iron spine snake spear' },
      { name: '黄盖', stars: 4, str: 83, int: 60, ldr: 80, luck: 60, country: '吴', description: '苦肉计，火攻先锋。', keywords: 'Huang Gai, old muscle, iron whip' },
      { name: '韩当', stars: 3, str: 81, int: 60, ldr: 75, luck: 65, country: '吴', description: '骑射骁勇，老将。', keywords: 'Han Dang, bow, boat' },
      { name: '蒋钦', stars: 4, str: 84, int: 65, ldr: 78, luck: 60, country: '吴', description: '公而忘私，江表虎臣。', keywords: 'Jiang Qin, clean armor, archer' },
      { name: '周泰', stars: 4, str: 90, int: 40, ldr: 65, luck: 80, country: '吴', description: '不屈战神，身如刻画。', keywords: 'Zhou Tai, scars, shield' },
      { name: '陈武', stars: 3, str: 85, int: 40, ldr: 70, luck: 30, country: '吴', description: '合肥战死，精锐统领。', keywords: 'Chen Wu, messy hair, fierce' },
      { name: '董袭', stars: 3, str: 86, int: 30, ldr: 60, luck: 20, country: '吴', description: '断绝船缆，以身殉国。', keywords: 'Dong Xi, drowning, heavy armor' },
      { name: '甘宁', stars: 5, str: 94, int: 60, ldr: 88, luck: 50, country: '吴', description: '锦帆贼，百骑劫营。', keywords: 'Gan Ning, bells, feathers, chain' },
      { name: '凌统', stars: 4, str: 86, int: 60, ldr: 75, luck: 55, country: '吴', description: '国士之风，与甘宁和解。', keywords: 'Ling Tong, dual swords, handsome' },
      { name: '徐盛', stars: 4, str: 82, int: 75, ldr: 85, luck: 60, country: '吴', description: '百里疑城，大破曹丕。', keywords: 'Xu Sheng, fake walls, fire' },
      { name: '潘璋', stars: 4, str: 80, int: 50, ldr: 75, luck: 60, country: '吴', description: '擒获关羽，贪财好杀。', keywords: 'Pan Zhang, hook weapon, ambush' },
      { name: '丁奉', stars: 4, str: 82, int: 65, ldr: 78, luck: 80, country: '吴', description: '雪中奋短兵。', keywords: 'Ding Feng, snow, dagger' },
      { name: '朱治', stars: 3, str: 60, int: 70, ldr: 75, luck: 70, country: '吴', description: '举荐孙权，老臣。', keywords: 'Zhu Zhi, official, badge' },
      { name: '朱然', stars: 4, str: 75, int: 80, ldr: 88, luck: 70, country: '吴', description: '坚守江陵，名震敌国。', keywords: 'Zhu Ran, fortress, defiant' },
      { name: '吕范', stars: 3, str: 60, int: 75, ldr: 80, luck: 60, country: '吴', description: '忠诚勤勉，大司马。', keywords: 'Lu Fan, dice, Go game' },
      { name: '太史慈', stars: 5, str: 93, int: 65, ldr: 85, luck: 50, country: '吴', description: '信义笃烈，神射手。', keywords: 'Taishi Ci, dual halberds, bow' },
      { name: '贺齐', stars: 3, str: 78, int: 70, ldr: 80, luck: 60, country: '吴', description: '平定山越，好尚华绮。', keywords: 'He Qi, colorful armor, gold' },
      { name: '全琮', stars: 3, str: 75, int: 70, ldr: 75, luck: 60, country: '吴', description: '孙权女婿，右大司马。', keywords: 'Quan Cong, noble, wedding' },
      { name: '朱桓', stars: 4, str: 85, int: 75, ldr: 82, luck: 60, country: '吴', description: '疯子将军，勇烈过人。', keywords: 'Zhu Huan, wide eyes, spear' },
      { name: '步骘', stars: 3, str: 60, int: 85, ldr: 80, luck: 70, country: '吴', description: '平定交州，宽厚长者。', keywords: 'Bu Zhi, elephant, jungle' },
      { name: '虞翻', stars: 3, str: 70, int: 85, ldr: 60, luck: 40, country: '吴', description: '狂直之士，精通易经。', keywords: 'Yu Fan, holding spear and book' },
      { name: '诸葛瑾', stars: 4, str: 50, int: 80, ldr: 75, luck: 80, country: '吴', description: '诸葛亮之兄，也是个老实人。', keywords: 'Zhuge Jin, donkey face, gentle' },
      { name: '诸葛恪', stars: 4, str: 60, int: 88, ldr: 70, luck: 20, country: '吴', description: '才气外露，刚愎自用。', keywords: 'Zhuge Ke, arrogant, young' },
      { name: '顾雍', stars: 3, str: 30, int: 85, ldr: 70, luck: 80, country: '吴', description: '沉默寡言，丞相。', keywords: 'Gu Yong, silent, playing guqin' },
      { name: '张纮', stars: 3, str: 20, int: 90, ldr: 50, luck: 70, country: '吴', description: '江东二张，战略规划。', keywords: 'Zhang Hong, writing, scroll' },
      { name: '阚泽', stars: 3, str: 30, int: 85, ldr: 40, luck: 60, country: '吴', description: '献诈降书，识破苦肉计。', keywords: 'Kan Ze, poor clothes, book' },
      { name: '孙桓', stars: 3, str: 80, int: 70, ldr: 75, luck: 60, country: '吴', description: '宗室名将，终身为将。', keywords: 'Sun Huan, young general' },
      { name: '孙韶', stars: 3, str: 78, int: 65, ldr: 70, luck: 60, country: '吴', description: '镇守徐陵，善于侦察。', keywords: 'Sun Shao, scout, night' },
      { name: '孙静', stars: 3, str: 60, int: 70, ldr: 60, luck: 60, country: '吴', description: '孙坚之弟，隐居。', keywords: 'Sun Jing, old, civilian clothes' },
      { name: '孙瑜', stars: 3, str: 70, int: 75, ldr: 70, luck: 60, country: '吴', description: '好学不倦，济养士卒。', keywords: 'Sun Yu, books and sword' },
      { name: '孙皎', stars: 3, str: 75, int: 65, ldr: 70, luck: 60, country: '吴', description: '轻财好施，统管夏口。', keywords: 'Sun Jiao, giving gold' },
      { name: '吕岱', stars: 3, str: 70, int: 75, ldr: 80, luck: 90, country: '吴', description: '九十岁挂帅，平定叛乱。', keywords: 'Lu Dai, extremely old, armor' },
      { name: '周鲂', stars: 3, str: 50, int: 82, ldr: 70, luck: 60, country: '吴', description: '断发诱敌，大破曹休。', keywords: 'Zhou Fang, cutting hair, trick' },
      { name: '钟离牧', stars: 3, str: 70, int: 65, ldr: 70, luck: 60, country: '吴', description: '不置产业，亲自种稻。', keywords: 'Zhongli Mu, farming tool, armor' },
      { name: '留赞', stars: 3, str: 85, int: 40, ldr: 70, luck: 30, country: '吴', description: '临阵高歌，白发猛将。', keywords: 'Liu Zan, singing, white hair' },
      { name: '唐咨', stars: 3, str: 70, int: 50, ldr: 60, luck: 50, country: '吴', description: '魏将降吴，制作战船。', keywords: 'Tang Zi, ship builder' },
      { name: '文鸯', stars: 5, str: 98, int: 50, ldr: 80, luck: 40, country: '吴', description: '七进七出，小赵云。', keywords: 'Wen Yang, steel whip, charging' },
      { name: '祖郎', stars: 3, str: 80, int: 30, ldr: 60, luck: 40, country: '吴', description: '山贼帅，曾擒孙策。', keywords: 'Zu Lang, bandit, mountain' },

      // --- OTHERS (50) ---
      { name: '吕布', stars: 5, str: 100, int: 30, ldr: 85, luck: 20, country: '群', description: '人中吕布，马中赤兔。', keywords: 'Lu Bu, pheasant tail, halberd, red horse' },
      { name: '董卓', stars: 4, str: 85, int: 70, ldr: 80, luck: 60, country: '群', description: '倒行逆施，火烧洛阳。', keywords: 'Dong Zhuo, fat, evil laugh' },
      { name: '袁绍', stars: 4, str: 70, int: 75, ldr: 90, luck: 50, country: '群', description: '四世三公，优柔寡断。', keywords: 'Yuan Shao, golden armor, noble' },
      { name: '袁术', stars: 3, str: 60, int: 60, ldr: 50, luck: 20, country: '群', description: '冢中枯骨，渴死。', keywords: 'Yuan Shu, honey water, skeleton' },
      { name: '刘表', stars: 3, str: 50, int: 80, ldr: 75, luck: 60, country: '群', description: '虚有其表，守户之犬。', keywords: 'Liu Biao, scholar robes, peaceful' },
      { name: '刘璋', stars: 3, str: 30, int: 50, ldr: 40, luck: 50, country: '群', description: '暗弱，引狼入室。', keywords: 'Liu Zhang, worried, weak' },
      { name: '公孙瓒', stars: 3, str: 82, int: 60, ldr: 80, luck: 40, country: '群', description: '白马义从，自焚。', keywords: 'Gongsun Zan, white horse, fire' },
      { name: '马腾', stars: 3, str: 80, int: 60, ldr: 85, luck: 40, country: '群', description: '西凉太守，马超之父。', keywords: 'Ma Teng, old warrior, fur' },
      { name: '韩遂', stars: 3, str: 75, int: 70, ldr: 80, luck: 50, country: '群', description: '九曲黄河，西凉军阀。', keywords: 'Han Sui, cunning old man' },
      { name: '张鲁', stars: 3, str: 50, int: 70, ldr: 80, luck: 70, country: '群', description: '五斗米道，师君。', keywords: 'Zhang Lu, taoist priest' },
      { name: '张绣', stars: 3, str: 80, int: 65, ldr: 75, luck: 50, country: '群', description: '北地枪王，杀典韦。', keywords: 'Zhang Xiu, spear, phoenix' },
      { name: '陶谦', stars: 3, str: 40, int: 70, ldr: 60, luck: 50, country: '群', description: '三让徐州，老好人。', keywords: 'Tao Qian, old kind man' },
      { name: '孔融', stars: 3, str: 20, int: 90, ldr: 40, luck: 30, country: '群', description: '孔子后代，让梨。', keywords: 'Kong Rong, scholar, pear' },
      { name: '王允', stars: 3, str: 30, int: 85, ldr: 60, luck: 20, country: '群', description: '连环计，除董卓。', keywords: 'Wang Yun, old official, plotting' },
      { name: '何进', stars: 2, str: 40, int: 20, ldr: 60, luck: 10, country: '群', description: '屠户大将军，引狼入室。', keywords: 'He Jin, butcher knife, expensive clothes' },
      { name: '卢植', stars: 4, str: 60, int: 90, ldr: 85, luck: 50, country: '群', description: '海内人望，刘备之师。', keywords: 'Lu Zhi, teacher, sword' },
      { name: '皇甫嵩', stars: 4, str: 80, int: 85, ldr: 90, luck: 60, country: '群', description: '平黄巾，一代名将。', keywords: 'Huangfu Song, burning grass, battlefield' },
      { name: '朱儁', stars: 4, str: 78, int: 80, ldr: 85, luck: 60, country: '群', description: '平黄巾，汉末名将。', keywords: 'Zhu Jun, stern commander' },
      { name: '丁原', stars: 3, str: 60, int: 50, ldr: 60, luck: 10, country: '群', description: '吕布义父，被杀。', keywords: 'Ding Yuan, shocked, backstab' },
      { name: '华雄', stars: 3, str: 88, int: 40, ldr: 70, luck: 10, country: '群', description: '温酒斩华雄。', keywords: 'Hua Xiong, head chopped, fierce' },
      { name: '李傕', stars: 2, str: 75, int: 50, ldr: 65, luck: 40, country: '群', description: '飞熊军，劫驾。', keywords: 'Li Jue, bandit, bear' },
      { name: '郭汜', stars: 2, str: 74, int: 45, ldr: 65, luck: 40, country: '群', description: '盗马贼，内斗。', keywords: 'Guo Si, scar face, thief' },
      { name: '樊稠', stars: 2, str: 70, int: 40, ldr: 60, luck: 30, country: '群', description: '董卓部将。', keywords: 'Fan Chou, brute' },
      { name: '张济', stars: 2, str: 65, int: 50, ldr: 60, luck: 40, country: '群', description: '张绣之叔，中流矢死。', keywords: 'Zhang Ji, old warrior' },
      { name: '牛辅', stars: 2, str: 60, int: 40, ldr: 50, luck: 30, country: '群', description: '董卓女婿，怯懦。', keywords: 'Niu Fu, gold coins, scared' },
      { name: '颜良', stars: 4, str: 93, int: 40, ldr: 80, luck: 20, country: '群', description: '插标卖首。', keywords: 'Yan Liang, charging, glaive' },
      { name: '文丑', stars: 4, str: 92, int: 35, ldr: 78, luck: 20, country: '群', description: '战赵云，死于关羽。', keywords: 'Wen Chou, ugly mask, spear' },
      { name: '张郃', stars: 4, str: 90, int: 75, ldr: 88, luck: 65, country: '群', description: '原袁绍将，后降曹。', keywords: 'Zhang He, surrender' },
      { name: '高览', stars: 3, str: 85, int: 60, ldr: 75, luck: 60, country: '群', description: '河北四庭柱，后降曹。', keywords: 'Gao Lan, heavy armor' },
      { name: '淳于琼', stars: 3, str: 60, int: 40, ldr: 50, luck: 10, country: '群', description: '乌巢酒鬼，割鼻。', keywords: 'Chunyu Qiong, drinking, nose cut' },
      { name: '审配', stars: 3, str: 40, int: 80, ldr: 70, luck: 20, country: '群', description: '死守邺城，向北而死。', keywords: 'Shen Pei, loyal, archer tower' },
      { name: '麴义', stars: 4, str: 85, int: 60, ldr: 85, luck: 20, country: '群', description: '先登死士，大破白马。', keywords: 'Qu Yi, crossbow, shield' },
      { name: '纪灵', stars: 3, str: 83, int: 50, ldr: 75, luck: 50, country: '群', description: '三尖两刃刀，辕门射戟背景。', keywords: 'Ji Ling, three pointed blade' },
      { name: '桥蕤', stars: 2, str: 60, int: 50, ldr: 60, luck: 30, country: '群', description: '袁术部将，战死。', keywords: 'Qiao Rui, fleeing' },
      { name: '张勋', stars: 2, str: 65, int: 40, ldr: 60, luck: 30, country: '群', description: '袁术大将军。', keywords: 'Zhang Xun, golden armor, weak' },
      { name: '刘繇', stars: 2, str: 40, int: 60, ldr: 50, luck: 30, country: '群', description: '扬州牧，被孙策击败。', keywords: 'Liu Yao, running away' },
      { name: '严白虎', stars: 2, str: 60, int: 30, ldr: 50, luck: 40, country: '群', description: '东吴德王，山贼。', keywords: 'Yan Baihu, tiger skin' },
      { name: '笮融', stars: 2, str: 50, int: 40, ldr: 40, luck: 10, country: '群', description: '聚众念佛，残暴。', keywords: 'Ze Rong, monk robes, blood' },
      { name: '蔡瑁', stars: 3, str: 60, int: 70, ldr: 80, luck: 40, country: '群', description: '水军大都督，献荆州。', keywords: 'Cai Mao, navy ship, traitor' },
      { name: '张允', stars: 3, str: 55, int: 60, ldr: 75, luck: 40, country: '群', description: '蔡瑁之党，水军副都督。', keywords: 'Zhang Yun, ship deck' },
      { name: '黄祖', stars: 3, str: 65, int: 60, ldr: 70, luck: 50, country: '群', description: '射杀孙坚，江夏死守。', keywords: 'Huang Zu, hidden archer' },
      { name: '文聘', stars: 4, str: 82, int: 65, ldr: 85, luck: 70, country: '群', description: '原刘表将，忠义。', keywords: 'Wen Pin, weeping' },
      { name: '庞羲', stars: 2, str: 40, int: 60, ldr: 50, luck: 50, country: '群', description: '刘璋亲家，守巴西。', keywords: 'Pang Xi, old guard' },
      { name: '张任', stars: 4, str: 88, int: 75, ldr: 85, luck: 40, country: '群', description: '落凤坡射死庞统，宁死不降。', keywords: 'Zhang Ren, ambush, forest' },
      { name: '李异', stars: 2, str: 60, int: 30, ldr: 50, luck: 30, country: '群', description: '益州武将，被张飞击败。', keywords: 'Li Yi, axe, falling' },
      { name: '刘璝', stars: 2, str: 65, int: 40, ldr: 60, luck: 30, country: '群', description: '益州武将，守雒城。', keywords: 'Liu Gui, wall defend' },
      { name: '泠苞', stars: 2, str: 70, int: 40, ldr: 60, luck: 20, country: '群', description: '决水淹军，被魏延擒。', keywords: 'Ling Bao, water dam' },
      { name: '邓贤', stars: 2, str: 65, int: 40, ldr: 60, luck: 30, country: '群', description: '益州武将。', keywords: 'Deng Xian, generic general' },
      { name: '公孙度', stars: 3, str: 60, int: 70, ldr: 80, luck: 70, country: '群', description: '辽东王，虽然中国乱，辽东平安。', keywords: 'Gongsun Du, king in north' },
      { name: '潘凤', stars: 3, str: 70, int: 40, ldr: 60, luck: 10, country: '群', description: '无双上将，大斧饥渴难耐。', keywords: 'Pan Feng, huge axe' }
  ];

  // Seed Generals
  console.log('Seeding Database with Generals...');
  for (const g of rawGenerals) {
    const avatarUrl = getAvatarUrl(g.name, g.stars, g.country, g.keywords);
    
    // Manual Upsert to avoid "ON CONFLICT" constraint errors if index creation failed
    const existing = await db.get('SELECT id FROM generals WHERE name = ?', [g.name]);
    
    if (existing) {
        await db.run(
            `UPDATE generals SET 
                stars = ?, str = ?, int = ?, ldr = ?, luck = ?, 
                country = ?, avatar = ?, description = ?
             WHERE id = ?`,
            [g.stars, g.str, g.int, g.ldr, g.luck, g.country, avatarUrl, g.description, existing.id]
        );
    } else {
        await db.run(
            `INSERT INTO generals (name, stars, str, int, ldr, luck, country, avatar, description) 
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [g.name, g.stars, g.str, g.int, g.ldr, g.luck, g.country, avatarUrl, g.description]
        );
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

  // Force Ensure Admin User
  try {
    console.log('Creating/Resetting admin user (admin/123456)...');
    const hashedPassword = await bcryptjs.hash('123456', 10);
    const existingAdmin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (existingAdmin) {
        await db.run('UPDATE users SET password = ?, gold = 999999, tokens = 9999 WHERE username = ?', [hashedPassword, 'admin']);
    } else {
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