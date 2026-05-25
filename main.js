const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const mammoth = require('mammoth');
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;

const isDev = process.argv.includes('--dev');

const YOUDAO_APP_ID = '4ea572a8a9098b4b';
const YOUDAO_APP_KEY = 'vw1sPyt93KakySh09pNL6EdW9gRq0mo4';

let mainWindow;
let db;
let dbFilePath;
let audioCachePath;

// 网络请求配置
const axiosConfig = {
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// 获取例句和短语的网络请求函数
async function fetchWordDetails(word) {
  try {
    // 这里使用模拟数据，实际项目中可以替换为真实API
    console.log(`搜索单词 ${word} 的例句和短语...`);
    
    // 模拟API响应
    const mockExamples = [
      { example_text: `The ${word} is very important.`, translation: `${word} 非常重要。` },
      { example_text: `I like to use ${word} every day.`, translation: `我喜欢每天使用 ${word}。` },
      { example_text: `This is a good example of ${word}.`, translation: `这是 ${word} 的一个好例子。` }
    ];
    
    const mockPhrases = [
      { phrase: `${word} example`, translation: `${word} 例子` },
      { phrase: `use ${word}`, translation: `使用 ${word}` },
      { phrase: `${word} usage`, translation: `${word} 用法` }
    ];
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      examples: mockExamples,
      phrases: mockPhrases
    };
  } catch (error) {
    console.error(`获取单词 ${word} 详情失败:`, error);
    return {
      examples: [],
      phrases: []
    };
  }
}

async function initDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    dbFilePath = path.join(userDataPath, 'wordword.db');
    audioCachePath = path.join(userDataPath, 'audio_cache');
    
    console.log('数据库路径:', dbFilePath);
    console.log('音频缓存路径:', audioCachePath);
    
    if (!fs.existsSync(audioCachePath)) {
      fs.mkdirSync(audioCachePath, { recursive: true });
      console.log('创建音频缓存目录');
    }
    
    const SQL = await initSqlJs();
    
    if (fs.existsSync(dbFilePath)) {
      console.log('加载现有数据库...');
      const fileBuffer = fs.readFileSync(dbFilePath);
      db = new SQL.Database(fileBuffer);
      
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tables[0] ? tables[0].values.map(row => row[0]) : [];
      
      if (!tableNames.includes('review_settings')) {
        console.log('添加review_settings表...');
        db.run(`
          CREATE TABLE review_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            error_days_map TEXT DEFAULT '{"1":1,"2":1,"3":2,"4":3","5":3}',
            use_custom_settings INTEGER DEFAULT 0
          );
        `);
        
        db.run(`INSERT INTO review_settings (id, error_days_map, use_custom_settings) VALUES (1, '{"1":1","2":1","3":2","4":3","5":3}', 0)`);
        saveDatabase();
      }
      
      if (!tableNames.includes('blur_settings')) {
        console.log('添加blur_settings表...');
        db.run(`
          CREATE TABLE blur_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            button_blur INTEGER DEFAULT 20,
            card_blur INTEGER DEFAULT 20,
            search_blur INTEGER DEFAULT 20,
            other_blur INTEGER DEFAULT 20,
            background_blur INTEGER DEFAULT 0
          );
        `);
        saveDatabase();
      } else {
        console.log('检查blur_settings表结构...');
        const columns = db.exec("PRAGMA table_info(blur_settings)");
        const columnNames = columns[0] ? columns[0].values.map(row => row[1]) : [];
        
        if (!columnNames.includes('background_blur')) {
          console.log('添加background_blur列...');
          db.run(`ALTER TABLE blur_settings ADD COLUMN background_blur INTEGER DEFAULT 0`);
          saveDatabase();
        }
        
        if (columnNames.includes('background_opacity')) {
          console.log('删除background_opacity列...');
          db.run(`CREATE TABLE blur_settings_new AS SELECT id, button_blur, card_blur, search_blur, other_blur, background_blur FROM blur_settings`);
          db.run(`DROP TABLE blur_settings`);
          db.run(`ALTER TABLE blur_settings_new RENAME TO blur_settings`);
          saveDatabase();
        }
      }
      
      // 添加word_examples表
      if (!tableNames.includes('word_examples')) {
        console.log('添加word_examples表...');
        db.run(`
          CREATE TABLE word_examples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER,
            example_text TEXT,
            translation TEXT,
            source TEXT DEFAULT 'api',
            FOREIGN KEY (word_id) REFERENCES word(word_id)
          );
        `);
        saveDatabase();
      }
      
      // 添加word_phrases表
      if (!tableNames.includes('word_phrases')) {
        console.log('添加word_phrases表...');
        db.run(`
          CREATE TABLE word_phrases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER,
            phrase TEXT,
            translation TEXT,
            source TEXT DEFAULT 'api',
            FOREIGN KEY (word_id) REFERENCES word(word_id)
          );
        `);
        saveDatabase();
      }
      
      // 添加音乐收藏表
      if (!tableNames.includes('music_favorites')) {
        console.log('添加music_favorites表...');
        db.run(`
          CREATE TABLE music_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            song_name TEXT NOT NULL,
            artist TEXT NOT NULL,
            source TEXT NOT NULL,
            source_type TEXT NOT NULL,
            url_id TEXT NOT NULL,
            pic_id TEXT,
            lyric_id TEXT,
            added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
          );
        `);
        saveDatabase();
      }
      
      // 添加音乐播放历史表
      if (!tableNames.includes('music_history')) {
        console.log('添加music_history表...');
        db.run(`
          CREATE TABLE music_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            song_name TEXT NOT NULL,
            artist TEXT NOT NULL,
            source TEXT NOT NULL,
            source_type TEXT NOT NULL,
            url_id TEXT NOT NULL,
            pic_id TEXT,
            lyric_id TEXT,
            played_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            play_count INTEGER NOT NULL DEFAULT 1
          );
        `);
        saveDatabase();
      }
      
      // 检查word表是否有is_local和last_updated列
      if (tableNames.includes('word')) {
        const wordColumns = db.exec("PRAGMA table_info(word)");
        const wordColumnNames = wordColumns[0] ? wordColumns[0].values.map(row => row[1]) : [];
        
        if (!wordColumnNames.includes('is_local')) {
          console.log('添加is_local列到word表...');
          db.run(`ALTER TABLE word ADD COLUMN is_local INTEGER DEFAULT 1`);
          saveDatabase();
        }
        
        if (!wordColumnNames.includes('last_updated')) {
          console.log('添加last_updated列到word表...');
          // SQLite不允许添加带有非恒定默认值的列，所以先添加列，再更新默认值
          db.run(`ALTER TABLE word ADD COLUMN last_updated TEXT DEFAULT ''`);
          // 为现有行设置默认值
          db.run(`UPDATE word SET last_updated = CURRENT_TIMESTAMP WHERE last_updated = ''`);
          saveDatabase();
        }
      }
      
      // 添加theme_settings表
      if (!tableNames.includes('theme_settings')) {
        console.log('添加theme_settings表...');
        db.run(`
          CREATE TABLE theme_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            light_text_primary TEXT DEFAULT '#000000',
            light_text_secondary TEXT DEFAULT '#333333',
            dark_text_primary TEXT DEFAULT '#ffffff',
            dark_text_secondary TEXT DEFAULT '#b0b0b0'
          );
        `);
        
        db.run(`INSERT INTO theme_settings (id, light_text_primary, light_text_secondary, dark_text_primary, dark_text_secondary) VALUES (1, '#000000', '#333333', '#ffffff', '#b0b0b0')`);
      }
      
      // 添加learn_settings表
      if (!tableNames.includes('learn_settings')) {
        console.log('添加learn_settings表...');
        db.run(`
          CREATE TABLE learn_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            default_learn_count INTEGER DEFAULT 20,
            show_learn_count_popup INTEGER DEFAULT 0
          );
        `);
        
        db.run(`INSERT INTO learn_settings (id, default_learn_count, show_learn_count_popup) VALUES (1, 20, 0)`);
        saveDatabase();
      }
      
      const wordbookResult = db.exec('SELECT COUNT(*) as count FROM word_book');
      const wordbookCount = wordbookResult[0] && wordbookResult[0].values[0] && wordbookResult[0].values[0][0];
      
      if (wordbookCount === 0) {
        console.log('数据库为空，开始导入默认词书...');
        await importDefaultWordbooks();
        saveDatabase();
      }
    } else {
      console.log('创建新数据库...');
      db = new SQL.Database();
      
      db.run(`
        CREATE TABLE IF NOT EXISTS word_book (
          book_id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_name TEXT NOT NULL,
          cover_url TEXT,
          source_type INTEGER DEFAULT 1,
          total_count INTEGER DEFAULT 0,
          mastered_count INTEGER DEFAULT 0,
          create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          update_time DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS word (
          word_id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          english TEXT NOT NULL,
          chinese TEXT NOT NULL,
          part_of_speech TEXT,
          phonetic_uk TEXT,
          phonetic_us TEXT,
          audio_uk_url TEXT,
          audio_us_url TEXT,
          sentence TEXT,
          mastery_status INTEGER DEFAULT 0,
          next_review_time DATETIME,
          review_count INTEGER DEFAULT 0,
          FOREIGN KEY (book_id) REFERENCES word_book(book_id)
        );
      `);
      
      db.run(`
        CREATE TABLE review_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          error_days_map TEXT DEFAULT '{"1":1,"2":1,"3":2,"4":3,"5":3}',
          use_custom_settings INTEGER DEFAULT 0,
          enable_today_review INTEGER DEFAULT 0
        );
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS blur_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          button_blur INTEGER DEFAULT 20,
          card_blur INTEGER DEFAULT 20,
          search_blur INTEGER DEFAULT 20,
          other_blur INTEGER DEFAULT 20,
          background_blur INTEGER DEFAULT 0
        );
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS word_examples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER,
          example_text TEXT,
          translation TEXT,
          source TEXT DEFAULT 'api',
          FOREIGN KEY (word_id) REFERENCES word(word_id)
        );
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS word_phrases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER,
          phrase TEXT,
          translation TEXT,
          source TEXT DEFAULT 'api',
          FOREIGN KEY (word_id) REFERENCES word(word_id)
        );
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS theme_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          light_text_primary TEXT DEFAULT '#000000',
          light_text_secondary TEXT DEFAULT '#333333',
          dark_text_primary TEXT DEFAULT '#ffffff',
          dark_text_secondary TEXT DEFAULT '#b0b0b0'
        );
      `);
      
      db.run(`INSERT INTO theme_settings (id, light_text_primary, light_text_secondary, dark_text_primary, dark_text_secondary) VALUES (1, '#000000', '#333333', '#ffffff', '#b0b0b0')`);
      
      await importDefaultWordbooks();
      saveDatabase();
    }
    
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}

function createSampleData() {
  const result = db.exec('SELECT COUNT(*) as count FROM word_book');
  if (result[0] && result[0].values[0] && result[0].values[0][0] > 0) {
    return;
  }
  
  db.run(`
    INSERT INTO word_book (book_name, cover_url, total_count, mastered_count)
    VALUES ('示例词书', 'assets/default-cover.svg', 0, 0)
  `);
  
  const bookId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  
  const sampleWords = [
    { english: 'hello', chinese: '你好', phonetic_uk: '/həˈləʊ/', phonetic_us: '/həˈloʊ/' },
    { english: 'world', chinese: '世界', phonetic_uk: '/wɜːld/', phonetic_us: '/wɜːrld/' },
    { english: 'computer', chinese: '计算机', phonetic_uk: '/kəmˈpjuːtə/', phonetic_us: '/kəmˈpjuːtər/' },
    { english: 'software', chinese: '软件', phonetic_uk: '/ˈsɒftweə/', phonetic_us: '/ˈsɔːftwer/' },
    { english: 'development', chinese: '开发', phonetic_uk: '/dɪˈveləpmənt/', phonetic_us: '/dɪˈveləpmənt/' },
    { english: 'application', chinese: '应用程序', phonetic_uk: '/ˌæplɪˈkeɪʃn/', phonetic_us: '/ˌæplɪˈkeɪʃn/' },
    { english: 'interface', chinese: '接口', phonetic_uk: '/ˈɪntəfeɪs/', phonetic_us: '/ˈɪntərfeɪs/' },
    { english: 'database', chinese: '数据库', phonetic_uk: '/ˈdeɪtəbeɪs/', phonetic_us: '/ˈdeɪtəbeɪs/' },
    { english: 'algorithm', chinese: '算法', phonetic_uk: '/ˈælɡərɪðəm/', phonetic_us: '/ˈælɡərɪðəm/' },
    { english: 'programming', chinese: '编程', phonetic_uk: '/ˈprəʊɡræmɪŋ/', phonetic_us: '/ˈproʊɡræmɪŋ/' }
  ];
  
  sampleWords.forEach(word => {
    db.run(`
      INSERT INTO word (book_id, english, chinese, mastery_status)
      VALUES (?, ?, ?, 0)
    `, [bookId, word.english, word.chinese]);
  });
  
  updateWordbookStats(bookId);
  saveDatabase();
  console.log('示例数据创建完成');
}

async function importDefaultWordbooks() {
  const jsonPath = 'D:\\wordhome';
  const wordbooks = [
    { file: 'CET4luan_2.json', name: 'CET4乱序版' },
    { file: 'CET6_2.json', name: 'CET6' },
    { file: 'KaoYan_2.json', name: '考研' }
  ];
  
  for (const wb of wordbooks) {
    const filePath = path.join(jsonPath, wb.file);
    if (!fs.existsSync(filePath)) {
      console.log(`文件不存在: ${filePath}`);
      continue;
    }
    
    console.log(`正在导入: ${wb.name}`);
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      let words = [];
      
      try {
        words = JSON.parse(fileContent);
        if (!Array.isArray(words)) {
          console.log(`文件格式不是数组，尝试按行解析`);
          words = fileContent.trim().split('\n').filter(line => line.trim()).map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              console.error(`解析行失败: ${e.message}`);
              return null;
            }
          }).filter(w => w !== null);
        }
      } catch (e) {
        console.log(`JSON解析失败，尝试按行解析: ${e.message}`);
        words = fileContent.trim().split('\n').filter(line => line.trim()).map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.error(`解析行失败: ${e.message}`);
            return null;
          }
        }).filter(w => w !== null);
      }
      
      console.log(`找到 ${words.length} 个单词数据`);
      
      let wordCount = 0;
      
      db.run(`
        INSERT INTO word_book (book_name, total_count, mastered_count)
        VALUES (?, ?, 0)
      `, [wb.name, 0]);
      
      const bookId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
      
      for (const data of words) {
        try {
          let wordData;
          if (data.content && data.content.word) {
            wordData = data.content.word;
          } else if (data.wordHead) {
            wordData = data;
          } else {
            continue;
          }
          
          const english = wordData.wordHead;
          const content = wordData.content;
          
          let chinese = '';
          let partOfSpeech = '';
          let phoneticUk = content.ukphone || '';
          let phoneticUs = content.usphone || '';
          let sentence = '';
          
          if (content.trans && content.trans.length > 0) {
            const trans = content.trans[0];
            chinese = trans.tranCn || '';
            partOfSpeech = trans.pos || '';
          }
          
          if (content.sentence && content.sentence.sentences && content.sentence.sentences.length > 0) {
            sentence = content.sentence.sentences[0].sContent || '';
          }
          
          if (english && chinese) {
            db.run(`
              INSERT INTO word (book_id, english, chinese, part_of_speech, phonetic_uk, phonetic_us, sentence, mastery_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `, [bookId, english, chinese, partOfSpeech, phoneticUk, phoneticUs, sentence]);
            wordCount++;
          }
        } catch (e) {
          console.error(`解析单词失败: ${e.message}`);
        }
      }
      
      if (wordCount > 0) {
        db.run(`
          UPDATE word_book SET total_count = ? WHERE book_id = ?
        `, [wordCount, bookId]);
        
        console.log(`${wb.name} 导入完成，共 ${wordCount} 个单词`);
      } else {
        db.run(`DELETE FROM word_book WHERE book_id = ${bookId}`);
      }
    } catch (error) {
      console.error(`导入 ${wb.name} 失败:`, error);
    }
  }
}

function updateWordbookStats(bookId) {
  const result = db.exec(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN mastery_status = 2 THEN 1 ELSE 0 END) as mastered
    FROM word WHERE book_id = ${bookId}
  `);
  
  const stats = result[0].values[0];
  
  db.run(`
    UPDATE word_book 
    SET total_count = ?, mastered_count = ?, update_time = CURRENT_TIMESTAMP
    WHERE book_id = ?
  `, [stats[0], stats[1], bookId]);
}

function queryToArray(query, params = []) {
  const result = db.exec(query, params);
  if (!result || result.length === 0) return [];
  
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function queryToObject(query, params = []) {
  const result = queryToArray(query, params);
  return result.length > 0 ? result[0] : null;
}

function generateYoudaoSign(query) {
  const curtime = Math.round(new Date().getTime() / 1000);
  const salt = crypto.randomBytes(16).toString('hex');
  const signStr = YOUDAO_APP_ID + query + salt + curtime + YOUDAO_APP_KEY;
  const sign = crypto.createHash('md5').update(signStr).digest('hex');
  
  return {
    appKey: YOUDAO_APP_ID,
    salt: salt,
    sign: sign,
    curtime: curtime
  };
}

function fetchYoudaoDictionary(word) {
  return new Promise((resolve, reject) => {
    const signData = generateYoudaoSign(word);
    const url = `https://openapi.youdao.com/api?appKey=${signData.appKey}&q=${encodeURIComponent(word)}&salt=${signData.salt}&sign=${signData.sign}&signType=v3&curtime=${signData.curtime}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.errorCode === '0') {
            resolve(response);
          } else {
            console.error('有道词典API错误:', response);
            reject(new Error(response.errorCode));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function downloadAudio(url, wordId, type) {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve(null);
      return;
    }
    
    const filename = `${wordId}_${type}.mp3`;
    const filepath = path.join(audioCachePath, filename);
    
    if (fs.existsSync(filepath)) {
      console.log(`音频已缓存: ${filename}`);
      resolve(filepath);
      return;
    }
    
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (res) => {
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`音频下载完成: ${filename}`);
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function updateWordWithYoudaoData(wordId, word) {
  try {
    const youdaoData = await fetchYoudaoDictionary(word);
    
    let phoneticUk = '';
    let phoneticUs = '';
    let audioUkUrl = '';
    let audioUsUrl = '';
    let sentence = '';
    
    if (youdaoData.basic) {
      const basic = youdaoData.basic;
      phoneticUk = basic['uk-phonetic'] || '';
      phoneticUs = basic['us-phonetic'] || '';
      
      if (basic.speakUrl) {
        audioUkUrl = basic.speakUrl;
      }
      if (basic['us-speak']) {
        audioUsUrl = basic['us-speak'];
      }
      
      if (basic.explains && basic.explains.length > 0) {
        const firstExplains = basic.explains[0];
        if (Array.isArray(firstExplains)) {
          sentence = firstExplains[0] || '';
        } else {
          sentence = firstExplains || '';
        }
      }
    }
    
    if (youdaoData.web && youdaoData.web.length > 0) {
      const webTrans = youdaoData.web[0];
      if (webTrans.value && webTrans.value.length > 0) {
        sentence = webTrans.value[0].key + ': ' + webTrans.value[0].value[0];
      }
    }
    
    db.run(`
      UPDATE word 
      SET phonetic_uk = ?, phonetic_us = ?, audio_uk_url = ?, audio_us_url = ?, sentence = ?
      WHERE word_id = ?
    `, [phoneticUk, phoneticUs, audioUkUrl, audioUsUrl, sentence, wordId]);
    
    saveDatabase();
    
    return {
      phonetic_uk: phoneticUk,
      phonetic_us: phoneticUs,
      audio_uk_url: audioUkUrl,
      audio_us_url: audioUsUrl,
      sentence: sentence
    };
  } catch (error) {
    console.error('获取有道数据失败:', error);
    return null;
  }
}

ipcMain.handle('get-wordbooks', () => {
  return queryToArray('SELECT * FROM word_book ORDER BY create_time DESC');
});

ipcMain.handle('get-words', async (event, bookId, search, status, sort) => {
  let query = `SELECT * FROM word WHERE book_id = ${bookId}`;
  const params = [];
  
  if (search) {
    query += ` AND english LIKE '%${search}%'`;
  }
  
  if (status && status !== 'all') {
    query += ` AND mastery_status = '${status}'`;
  }
  
  if (sort === 'alphabet') {
    query += ' ORDER BY english COLLATE NOCASE ASC';
  } else {
    query += ' ORDER BY mastery_status ASC, english COLLATE NOCASE ASC';
  }
  
  return queryToArray(query, params);
});

ipcMain.handle('get-today-learned-words', async (event, bookId) => {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  
  return queryToArray(`
    SELECT * FROM word 
    WHERE book_id = ${bookId} 
      AND mastery_status > 0 
      AND next_review_time >= '${todayStart}'
    ORDER BY english COLLATE NOCASE ASC
  `);
});

ipcMain.handle('get-today-review-words', async (event, bookId) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  
  return queryToArray(`
    SELECT * FROM word 
    WHERE book_id = ${bookId} 
      AND mastery_status IN (1, 2)
      AND next_review_time >= '${todayStart}'
      AND next_review_time < '${tomorrow}'
    ORDER BY next_review_time ASC
  `);
});

ipcMain.handle('get-learning-words', async (event, bookId) => {
  return queryToArray(`
    SELECT * FROM word 
    WHERE book_id = ${bookId} 
      AND mastery_status = 1
    ORDER BY english COLLATE NOCASE ASC
  `);
});

ipcMain.handle('search-word', async (event, keyword) => {
  if (!keyword || keyword.trim() === '') {
    return { entries: [] };
  }
  
  return new Promise((resolve, reject) => {
    const url = `https://dict.youdao.com/suggest?num=5&ver=3.0&doctype=json&cache=false&le=en&q=${encodeURIComponent(keyword)}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
});

ipcMain.handle('get-learn-words', async (event, bookId, count) => {
  return queryToArray(`
    SELECT * FROM word 
    WHERE book_id = ${bookId} AND mastery_status = 0
    ORDER BY RANDOM()
    LIMIT ${count}
  `);
});

ipcMain.handle('get-review-words', async (event, bookId) => {
  const settings = queryToObject(`SELECT * FROM review_settings WHERE id = 1`);
  const enableTodayReview = settings ? settings.enable_today_review === 1 : false;
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  if (enableTodayReview) {
    return queryToArray(`
      SELECT * FROM word 
      WHERE book_id = ${bookId} 
        AND mastery_status IN (1, 2)
        AND next_review_time <= '${todayEnd.toISOString()}'
      ORDER BY next_review_time ASC
    `);
  } else {
    return queryToArray(`
      SELECT * FROM word 
      WHERE book_id = ${bookId} 
        AND mastery_status IN (1, 2)
        AND next_review_time <= '${now.toISOString()}'
      ORDER BY next_review_time ASC
    `);
  }
});

ipcMain.handle('mark-word-learned', async (event, wordId) => {
  const now = new Date();
  const nextReview = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  db.run(`
    UPDATE word 
    SET mastery_status = 1,
        next_review_time = ?,
        review_count = 1
    WHERE word_id = ${wordId}
  `, [nextReview.toISOString()]);
  
  const word = queryToObject(`SELECT book_id FROM word WHERE word_id = ${wordId}`);
  if (word) {
    updateWordbookStats(word.book_id);
  }
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('review-word', async (event, wordId, remembered) => {
  const word = queryToObject(`SELECT * FROM word WHERE word_id = ${wordId}`);
  if (!word) return { success: false };
  
  const now = new Date();
  
  if (remembered) {
    const reviewCount = word.review_count || 0;
    let nextReview;
    
    switch (reviewCount) {
      case 1:
        nextReview = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 2:
        nextReview = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
        break;
      case 3:
        nextReview = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        break;
      default:
        nextReview = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        db.run(`UPDATE word SET mastery_status = 2 WHERE word_id = ${wordId}`);
    }
    
    db.run(`
      UPDATE word 
      SET next_review_time = ?, review_count = review_count + 1
      WHERE word_id = ${wordId}
    `, [nextReview.toISOString()]);
  } else {
    const nextReview = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    db.run(`
      UPDATE word 
      SET next_review_time = ?, review_count = MAX(1, review_count - 1)
      WHERE word_id = ${wordId}
    `, [nextReview.toISOString()]);
  }
  
  updateWordbookStats(word.book_id);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('review-word-custom', async (event, wordId, remembered, errorCount) => {
  const word = queryToObject(`SELECT * FROM word WHERE word_id = ${wordId}`);
  if (!word) return { success: false };
  
  const settings = queryToObject(`SELECT * FROM review_settings WHERE id = 1`);
  const errorDaysMap = settings ? JSON.parse(settings.error_days_map || '{}') : {};
  
  const now = new Date();
  
  if (remembered) {
    const reviewCount = word.review_count || 0;
    let nextReview;
    
    switch (reviewCount) {
      case 1:
        nextReview = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 2:
        nextReview = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
        break;
      case 3:
        nextReview = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        break;
      default:
        nextReview = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        db.run(`UPDATE word SET mastery_status = 2 WHERE word_id = ${wordId}`);
    }
    
    db.run(`
      UPDATE word 
      SET next_review_time = ?, review_count = review_count + 1
      WHERE word_id = ${wordId}
    `, [nextReview.toISOString()]);
  } else {
    const errorCountKey = errorCount.toString();
    const days = errorDaysMap[errorCountKey] || 1;
    const nextReview = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    db.run(`
      UPDATE word 
      SET next_review_time = ?, review_count = MAX(1, review_count - 1)
      WHERE word_id = ${wordId}
    `, [nextReview.toISOString()]);
  }
  
  updateWordbookStats(word.book_id);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('get-stats', async (event, bookId) => {
  const result = db.exec(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN mastery_status = 0 THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN mastery_status = 1 THEN 1 ELSE 0 END) as learning,
      SUM(CASE WHEN mastery_status = 2 THEN 1 ELSE 0 END) as mastered
    FROM word WHERE book_id = ${bookId}
  `);
  
  const values = result[0].values[0];
  return {
    total: values[0],
    new: values[1],
    learning: values[2],
    mastered: values[3]
  };
});

ipcMain.handle('get-options', async (event, bookId, wordId) => {
  return queryToArray(`
    SELECT word_id, english, chinese, part_of_speech FROM word 
    WHERE book_id = ${bookId} AND word_id != ${wordId}
    ORDER BY RANDOM()
    LIMIT 3
  `);
});

ipcMain.handle('get-word-detail', async (event, wordId) => {
  const word = queryToObject(`SELECT * FROM word WHERE word_id = ${wordId}`);
  if (!word) return null;
  
  return word;
});

ipcMain.handle('download-audio', async (event, wordId, type) => {
  const word = queryToObject(`SELECT * FROM word WHERE word_id = ${wordId}`);
  if (!word) return null;
  
  const url = type === 'uk' ? word.audio_uk_url : word.audio_us_url;
  if (!url) return null;
  
  try {
    const filepath = await downloadAudio(url, wordId, type);
    return filepath;
  } catch (error) {
    console.error('下载音频失败:', error);
    return null;
  }
});

ipcMain.handle('get-review-settings', async () => {
  const settings = queryToObject(`SELECT * FROM review_settings WHERE id = 1`);
  if (!settings) {
    return {
      error_days_map: '{"1":1,"2":1,"3":2,"4":3,"5":3}',
      use_custom_settings: 0,
      enable_today_review: 0
    };
  }
  return settings;
});

ipcMain.handle('update-review-settings', async (event, errorDaysMap, useCustomSettings, enableTodayReview) => {
  const existing = queryToObject(`SELECT * FROM review_settings WHERE id = 1`);
  
  if (existing) {
    db.run(`
      UPDATE review_settings 
      SET error_days_map = ?, use_custom_settings = ?, enable_today_review = ?
      WHERE id = 1
    `, [JSON.stringify(errorDaysMap), useCustomSettings ? 1 : 0, enableTodayReview ? 1 : 0]);
  } else {
    db.run(`
      INSERT INTO review_settings (id, error_days_map, use_custom_settings, enable_today_review)
      VALUES (1, ?, ?, ?)
    `, [JSON.stringify(errorDaysMap), useCustomSettings ? 1 : 0, enableTodayReview ? 1 : 0]);
  }
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('get-blur-settings', async () => {
  try {
    const settings = queryToObject(`SELECT * FROM blur_settings WHERE id = 1`);
    if (!settings) {
      return {
        button_blur: 20,
        card_blur: 20,
        search_blur: 20,
        other_blur: 20,
        background_blur: 0
      };
    }
    return settings;
  } catch (error) {
    console.error('获取毛玻璃设置失败:', error);
    return {
      button_blur: 20,
      card_blur: 20,
      search_blur: 20,
      other_blur: 20,
      background_blur: 0
    };
  }
});

ipcMain.handle('update-blur-settings', async (event, buttonBlur, cardBlur, searchBlur, otherBlur, backgroundBlur) => {
  const existing = queryToObject(`SELECT * FROM blur_settings WHERE id = 1`);
  
  if (existing) {
    db.run(`
      UPDATE blur_settings 
      SET button_blur = ?, card_blur = ?, search_blur = ?, other_blur = ?, background_blur = ?
      WHERE id = 1
    `, [buttonBlur, cardBlur, searchBlur, otherBlur, backgroundBlur]);
  } else {
    db.run(`
      INSERT INTO blur_settings (id, button_blur, card_blur, search_blur, other_blur, background_blur)
      VALUES (1, ?, ?, ?, ?, ?)
    `, [buttonBlur, cardBlur, searchBlur, otherBlur, backgroundBlur]);
  }
  
  saveDatabase();
  return { success: true };
});

// 获取主题设置
ipcMain.handle('get-theme-settings', async () => {
  try {
    const settings = queryToObject(`SELECT * FROM theme_settings WHERE id = 1`);
    if (!settings) {
      return {
        light_text_primary: '#000000',
        light_text_secondary: '#333333',
        dark_text_primary: '#ffffff',
        dark_text_secondary: '#b0b0b0'
      };
    }
    return settings;
  } catch (error) {
    console.error('获取主题设置失败:', error);
    return {
      light_text_primary: '#000000',
      light_text_secondary: '#333333',
      dark_text_primary: '#ffffff',
      dark_text_secondary: '#b0b0b0'
    };
  }
});

// 保存主题设置
ipcMain.handle('save-theme-settings', async (event, settings) => {
  try {
    const existing = queryToObject(`SELECT * FROM theme_settings WHERE id = 1`);
    
    if (existing) {
      db.run(`
        UPDATE theme_settings 
        SET light_text_primary = ?, light_text_secondary = ?, dark_text_primary = ?, dark_text_secondary = ?
        WHERE id = 1
      `, [settings.light_text_primary, settings.light_text_secondary, settings.dark_text_primary, settings.dark_text_secondary]);
    } else {
      db.run(`
        INSERT INTO theme_settings (id, light_text_primary, light_text_secondary, dark_text_primary, dark_text_secondary)
        VALUES (1, ?, ?, ?, ?)
      `, [settings.light_text_primary, settings.light_text_secondary, settings.dark_text_primary, settings.dark_text_secondary]);
    }
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('保存主题设置失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-learn-settings', async () => {
  try {
    const settings = queryToObject(`SELECT * FROM learn_settings WHERE id = 1`);
    if (!settings) {
      return {
        default_learn_count: 20,
        show_learn_count_popup: 1
      };
    }
    return settings;
  } catch (error) {
    console.error('获取学习设置失败:', error);
    return {
      default_learn_count: 20,
      show_learn_count_popup: 1
    };
  }
});

ipcMain.handle('update-learn-settings', async (event, defaultLearnCount) => {
  try {
    const existing = queryToObject(`SELECT * FROM learn_settings WHERE id = 1`);
    
    if (existing) {
      db.run(`
        UPDATE learn_settings 
        SET default_learn_count = ?
        WHERE id = 1
      `, [defaultLearnCount]);
    } else {
      db.run(`
        INSERT INTO learn_settings (id, default_learn_count, show_learn_count_popup)
        VALUES (1, ?, 1)
      `, [defaultLearnCount]);
    }
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('更新学习设置失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disable-learn-count-popup', async () => {
  try {
    const existing = queryToObject(`SELECT * FROM learn_settings WHERE id = 1`);
    
    if (existing) {
      db.run(`
        UPDATE learn_settings 
        SET show_learn_count_popup = 0
        WHERE id = 1
      `);
    } else {
      db.run(`
        INSERT INTO learn_settings (id, default_learn_count, show_learn_count_popup)
        VALUES (1, 20, 0)
      `);
    }
    
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('禁用学习数量弹窗失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-wordbook', async (event, bookName, coverUrl, sourceType) => {
  db.run(`
    INSERT INTO word_book (book_name, cover_url, source_type, total_count, mastered_count)
    VALUES (?, ?, ?, 0, 0)
  `, [bookName, coverUrl, sourceType]);
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('update-wordbook', async (event, bookId, bookName, coverUrl) => {
  db.run(`
    UPDATE word_book 
    SET book_name = ?, cover_url = ?, update_time = CURRENT_TIMESTAMP
    WHERE book_id = ?
  `, [bookName, coverUrl, bookId]);
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('delete-wordbook', async (event, bookId) => {
  db.run(`DELETE FROM word WHERE book_id = ${bookId}`);
  db.run(`DELETE FROM word_book WHERE book_id = ${bookId}`);
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('reset-database', async () => {
  try {
    if (fs.existsSync(dbFilePath)) {
      fs.unlinkSync(dbFilePath);
      console.log('已删除旧数据库');
    }
    
    if (fs.existsSync(audioCachePath)) {
      const files = fs.readdirSync(audioCachePath);
      files.forEach(file => {
        fs.unlinkSync(path.join(audioCachePath, file));
      });
      console.log('已清空音频缓存');
    }
    
    await initDatabase();
    return { success: true };
  } catch (error) {
    console.error('重置数据库失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-word', async (event, bookId, english, chinese) => {
  db.run(`
    INSERT INTO word (book_id, english, chinese, mastery_status)
    VALUES (?, ?, ?, 0)
  `, [bookId, english, chinese]);
  
  updateWordbookStats(bookId);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('update-word', async (event, wordId, english, chinese) => {
  const word = queryToObject(`SELECT book_id FROM word WHERE word_id = ${wordId}`);
  
  db.run(`
    UPDATE word 
    SET english = ?, chinese = ?
    WHERE word_id = ?
  `, [english, chinese, wordId]);
  
  if (word) {
    updateWordbookStats(word.book_id);
  }
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('delete-word', async (event, wordId) => {
  const word = queryToObject(`SELECT book_id FROM word WHERE word_id = ${wordId}`);
  
  db.run(`DELETE FROM word WHERE word_id = ${wordId}`);
  
  if (word) {
    updateWordbookStats(word.book_id);
  }
  
  saveDatabase();
  return { success: true };
});

ipcMain.handle('parse-document', async (event, type) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        type === 'word' 
          ? { name: 'Word Documents', extensions: ['doc', 'docx'] }
          : { name: 'PDF Documents', extensions: ['pdf'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('未选择文件');
    }

    const filePath = result.filePaths[0];
    let text = '';
    
    if (type === 'word') {
      const dataBuffer = fs.readFileSync(filePath);
      const parseResult = await mammoth.extractRawText({ buffer: dataBuffer });
      text = parseResult.value;
    } else if (type === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      
      const pdfParser = require('pdf-parse');
      console.log('pdfParser type:', typeof pdfParser);
      console.log('pdfParser keys:', Object.keys(pdfParser));
      
      if (typeof pdfParser === 'function') {
        text = await new Promise((resolve, reject) => {
          pdfParser(dataBuffer, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data.text);
            }
          });
        });
      } else if (pdfParser.default && typeof pdfParser.default === 'function') {
        text = await new Promise((resolve, reject) => {
          pdfParser.default(dataBuffer, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data.text);
            }
          });
        });
      } else {
        throw new Error('pdf-parse 模块结构不正确');
      }
    }
    
    const words = parseTextToWords(text);
    return words;
  } catch (error) {
    console.error('解析文档失败:', error);
    throw new Error('解析文档失败: ' + error.message);
  }
});

ipcMain.handle('create-custom-wordbook', async (event, bookName, words) => {
  try {
    db.run(`
      INSERT INTO word_book (book_name, cover_url, source_type, total_count, mastered_count)
      VALUES (?, ?, ?, ?, 0)
    `, [bookName, '', 0]);
    
    const bookId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    
    for (const word of words) {
      db.run(`
        INSERT INTO word (book_id, english, chinese, part_of_speech, mastery_status)
        VALUES (?, ?, ?, ?, 0)
      `, [bookId, word.english, word.chinese, word.part_of_speech || '']);
    }
    
    updateWordbookStats(bookId);
    saveDatabase();
    
    return { success: true, bookId };
  } catch (error) {
    console.error('创建自定义单词书失败:', error);
    throw new Error('创建失败: ' + error.message);
  }
});

function parseTextToWords(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const words = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const parts = trimmedLine.split(/[|│|]/).map(p => p.trim());
    
    if (parts.length >= 4) {
      const index = parts[0];
      const english = parts[1];
      const chinese = parts[3] || '';
      
      if (english && chinese) {
        words.push({
          english,
          chinese
        });
      }
    } else {
      const match = trimmedLine.match(/^([a-zA-Z\s-]+)[\s\t]+([a-zA-Z\.]+\.)[\s\t]+([\u4e00-\u9fa5\s,，。、；：！？]+)$/);
      if (match) {
        const english = match[1].trim();
        const partOfSpeech = match[2].trim();
        const chinese = match[3].trim();
        
        if (english && chinese) {
          words.push({
            english,
            chinese,
            part_of_speech: partOfSpeech
          });
        }
      } else {
        const fallbackMatch = trimmedLine.match(/^([a-zA-Z\s-]+)[\s\t]+([\u4e00-\u9fa5\s,，。、；：！？]+)$/);
        if (fallbackMatch) {
          const english = fallbackMatch[1].trim();
          const chinese = fallbackMatch[2].trim();
          
          if (english && chinese) {
            words.push({
              english,
              chinese
            });
          }
        }
      }
    }
  }
  
  return words;
}

ipcMain.handle('fetch-phonetic', async (event, word) => {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().getTime();
    const salt = timestamp.toString();
    const sign = crypto.createHash('md5').update(`4ea572a8a9098b4b${word}${salt}vw1sPyt93KakySh09pNL6EdW9gRq0mo4`).digest('hex');
    
    const url = `https://openapi.youdao.com/api?appKey=4ea572a8a9098b4b&salt=${salt}&sign=${sign}&q=${encodeURIComponent(word)}&type=1`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.basic && json.basic.phonetic) {
            resolve({
              uk: json.basic['uk-phonetic'] || '',
              us: json.basic['us-phonetic'] || ''
            });
          } else {
            resolve({ uk: '', us: '' });
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('获取音标失败:', error);
      resolve({ uk: '', us: '' });
    });
  });
});

ipcMain.handle('get-background-images', async (event, theme) => {
  const isDev = !app.isPackaged;
  let backgroundPath;
  
  if (isDev) {
    backgroundPath = path.join(__dirname, 'assets', 'background', theme);
  } else {
    backgroundPath = path.join(process.resourcesPath, 'app.asar', 'assets', 'background', theme);
  }
  
  try {
    if (fs.existsSync(backgroundPath)) {
      const files = fs.readdirSync(backgroundPath);
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });
      return imageFiles;
    }
    return [];
  } catch (error) {
    console.error('读取背景图片失败:', error);
    return [];
  }
});

ipcMain.handle('get-background-url', async (event, theme, imageName) => {
  const isDev = !app.isPackaged;
  let backgroundPath;
  
  if (isDev) {
    backgroundPath = path.join(__dirname, 'assets', 'background', theme, imageName);
  } else {
    backgroundPath = path.join(process.resourcesPath, 'app.asar', 'assets', 'background', theme, imageName);
  }
  
  try {
    if (fs.existsSync(backgroundPath)) {
      const imageData = fs.readFileSync(backgroundPath);
      const base64 = imageData.toString('base64');
      const ext = path.extname(imageName).toLowerCase().substring(1);
      return `data:image/${ext};base64,${base64}`;
    }
    return '';
  } catch (error) {
    console.error('读取背景图片失败:', error);
    return '';
  }
});

// 搜索单词的例句和短语
ipcMain.handle('search-word-details', async (event, word, wordId) => {
  try {
    // 先检查本地是否已有数据
    const localExamplesResult = db.exec(`SELECT * FROM word_examples WHERE word_id = ${wordId}`);
    const localPhrasesResult = db.exec(`SELECT * FROM word_phrases WHERE word_id = ${wordId}`);
    
    const localExamples = localExamplesResult[0] ? localExamplesResult[0].values.map(row => ({
      id: row[0],
      word_id: row[1],
      example_text: row[2],
      translation: row[3],
      source: row[4]
    })) : [];
    
    const localPhrases = localPhrasesResult[0] ? localPhrasesResult[0].values.map(row => ({
      id: row[0],
      word_id: row[1],
      phrase: row[2],
      translation: row[3],
      source: row[4]
    })) : [];
    
    // 如果本地有数据，直接返回
    if (localExamples.length > 0 && localPhrases.length > 0) {
      return {
        examples: localExamples,
        phrases: localPhrases,
        source: 'local'
      };
    }
    
    // 本地没有数据，从网络获取
    const wordDetails = await fetchWordDetails(word);
    
    // 保存到本地数据库
    const examples = wordDetails.examples;
    const phrases = wordDetails.phrases;
    
    // 保存例句
    examples.forEach(example => {
      // 转义单引号
      const escapedExample = example.example_text.replace(/'/g, "''");
      const escapedTranslation = example.translation.replace(/'/g, "''");
      db.run(`
        INSERT INTO word_examples (word_id, example_text, translation, source)
        VALUES (${wordId}, '${escapedExample}', '${escapedTranslation}', 'api')
      `);
    });
    
    // 保存短语
    phrases.forEach(phrase => {
      // 转义单引号
      const escapedPhrase = phrase.phrase.replace(/'/g, "''");
      const escapedTranslation = phrase.translation.replace(/'/g, "''");
      db.run(`
        INSERT INTO word_phrases (word_id, phrase, translation, source)
        VALUES (${wordId}, '${escapedPhrase}', '${escapedTranslation}', 'api')
      `);
    });
    
    // 更新word表的is_local和last_updated
    db.run(`
      UPDATE word SET is_local = 0, last_updated = CURRENT_TIMESTAMP WHERE word_id = ${wordId}
    `);
    
    saveDatabase();
    
    return {
      examples: examples.map((example, index) => ({
        id: index + 1,
        word_id: wordId,
        ...example,
        source: 'api'
      })),
      phrases: phrases.map((phrase, index) => ({
        id: index + 1,
        word_id: wordId,
        ...phrase,
        source: 'api'
      })),
      source: 'api'
    };
  } catch (error) {
    console.error('搜索单词详情失败:', error);
    return {
      examples: [],
      phrases: [],
      source: 'error'
    };
  }
});

// 获取本地保存的例句
ipcMain.handle('get-local-examples', async (event, wordId) => {
  try {
    const result = db.exec(`SELECT * FROM word_examples WHERE word_id = ${wordId}`);
    return result[0] ? result[0].values.map(row => ({
      id: row[0],
      word_id: row[1],
      example_text: row[2],
      translation: row[3],
      source: row[4]
    })) : [];
  } catch (error) {
    console.error('获取本地例句失败:', error);
    return [];
  }
});

// 获取本地保存的短语
ipcMain.handle('get-local-phrases', async (event, wordId) => {
  try {
    const result = db.exec(`SELECT * FROM word_phrases WHERE word_id = ${wordId}`);
    return result[0] ? result[0].values.map(row => ({
      id: row[0],
      word_id: row[1],
      phrase: row[2],
      translation: row[3],
      source: row[4]
    })) : [];
  } catch (error) {
    console.error('获取本地短语失败:', error);
    return [];
  }
});

// 保存例句到本地
ipcMain.handle('save-word-examples', async (event, wordId, examples) => {
  try {
    examples.forEach(example => {
      // 转义单引号
      const escapedExample = example.example_text.replace(/'/g, "''");
      const escapedTranslation = example.translation.replace(/'/g, "''");
      db.run(`
        INSERT INTO word_examples (word_id, example_text, translation, source)
        VALUES (${wordId}, '${escapedExample}', '${escapedTranslation}', 'api')
      `);
    });
    saveDatabase();
    return true;
  } catch (error) {
    console.error('保存例句失败:', error);
    return false;
  }
});

// 音乐收藏相关IPC处理

// 添加音乐到收藏
ipcMain.handle('add-music-favorite', async (event, music) => {
  try {
    // 检查是否已存在
    const existing = db.exec(`SELECT id FROM music_favorites WHERE song_id = '${music.song_id}' AND source = '${music.source}'`);
    if (existing[0] && existing[0].values.length > 0) {
      return { success: true, message: '已存在于收藏中' };
    }
    
    // 转义单引号
    const escapedSongName = music.song_name.replace(/'/g, "''");
    const escapedArtist = music.artist.replace(/'/g, "''");
    
    db.run(`
      INSERT INTO music_favorites (song_id, song_name, artist, source, source_type, url_id, pic_id, lyric_id)
      VALUES ('${music.song_id}', '${escapedSongName}', '${escapedArtist}', '${music.source}', '${music.source_type}', '${music.url_id}', '${music.pic_id || ''}', '${music.lyric_id || ''}')
    `);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('添加音乐收藏失败:', error);
    return { success: false, error: error.message };
  }
});

// 移除音乐收藏
ipcMain.handle('remove-music-favorite', async (event, songId, source) => {
  try {
    db.run(`DELETE FROM music_favorites WHERE song_id = '${songId}' AND source = '${source}'`);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('移除音乐收藏失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取收藏的音乐列表
ipcMain.handle('get-music-favorites', async () => {
  try {
    const result = db.exec('SELECT * FROM music_favorites ORDER BY added_at DESC');
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  } catch (error) {
    console.error('获取音乐收藏失败:', error);
    return [];
  }
});

// 检查音乐是否已收藏
ipcMain.handle('check-music-favorite', async (event, songId, source) => {
  try {
    const result = db.exec(`SELECT id FROM music_favorites WHERE song_id = '${songId}' AND source = '${source}'`);
    return result[0] && result[0].values.length > 0;
  } catch (error) {
    console.error('检查音乐收藏失败:', error);
    return false;
  }
});

// 音乐播放历史相关IPC处理

// 添加音乐播放历史
ipcMain.handle('add-music-history', async (event, music) => {
  try {
    // 检查是否已存在，如果存在则更新播放次数和时间
    const existing = db.exec(`SELECT id, play_count FROM music_history WHERE song_id = '${music.song_id}' AND source = '${music.source}'`);
    
    // 转义单引号
    const escapedSongName = music.song_name.replace(/'/g, "''");
    const escapedArtist = music.artist.replace(/'/g, "''");
    
    if (existing[0] && existing[0].values.length > 0) {
      const id = existing[0].values[0][0];
      const playCount = existing[0].values[0][1] + 1;
      db.run(`
        UPDATE music_history 
        SET play_count = ${playCount}, played_at = strftime('%s', 'now') 
        WHERE id = ${id}
      `);
    } else {
      db.run(`
        INSERT INTO music_history (song_id, song_name, artist, source, source_type, url_id, pic_id, lyric_id)
        VALUES ('${music.song_id}', '${escapedSongName}', '${escapedArtist}', '${music.source}', '${music.source_type}', '${music.url_id}', '${music.pic_id || ''}', '${music.lyric_id || ''}')
      `);
    }
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('添加音乐播放历史失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取音乐播放历史
ipcMain.handle('get-music-history', async (event, limit = 100) => {
  try {
    const result = db.exec(`SELECT * FROM music_history ORDER BY played_at DESC LIMIT ${limit}`);
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  } catch (error) {
    console.error('获取音乐播放历史失败:', error);
    return [];
  }
});

// 清空音乐播放历史
ipcMain.handle('clear-music-history', async () => {
  try {
    db.run('DELETE FROM music_history');
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('清空音乐播放历史失败:', error);
    return { success: false, error: error.message };
  }
});

// 保存短语到本地
ipcMain.handle('save-word-phrases', async (event, wordId, phrases) => {
  try {
    phrases.forEach(phrase => {
      // 转义单引号
      const escapedPhrase = phrase.phrase.replace(/'/g, "''");
      const escapedTranslation = phrase.translation.replace(/'/g, "''");
      db.run(`
        INSERT INTO word_phrases (word_id, phrase, translation, source)
        VALUES (${wordId}, '${escapedPhrase}', '${escapedTranslation}', 'api')
      `);
    });
    saveDatabase();
    return true;
  } catch (error) {
    console.error('保存短语失败:', error);
    return false;
  }
});

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'assets', 'icon.svg')
    });

    mainWindow.loadFile('index.html');

    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      console.log('窗口已关闭');
      mainWindow = null;
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('页面加载完成');
    });
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('页面加载失败:', errorCode, errorDescription);
    });
  } catch (error) {
    console.error('创建窗口失败:', error);
  }
}

app.whenReady().then(async () => {
  await initDatabase();
  createSampleData();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
