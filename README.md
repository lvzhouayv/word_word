# WordWord - 单词学习应用

一个基于 Electron 的单词学习应用，支持学习、复习、单词总览等功能。

## 功能特性

- 学习模式：默写模式和选择题模式
- 复习模式：基于间隔重复算法的智能复习
- 单词总览：查看学习进度和单词列表
- 主题配置：支持浅色、深色和自定义背景
- 本地数据存储：使用 SQLite 数据库

## 安装依赖

```bash
npm install
```

## 运行应用

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## 打包应用

```bash
npm run build
```

## 项目结构

```
word_word/
├── main.js              # Electron 主进程
├── index.html           # 主页面
├── renderer.js          # 渲染进程逻辑
├── styles.css           # 样式文件
├── package.json         # 项目配置
├── data/                # 数据目录（自动创建）
│   └── wordword.db     # SQLite 数据库
└── assets/              # 资源文件
    └── default-cover.png
```

## 数据库结构

### word_book 表（单词书）
- book_id: 主键
- book_name: 词书名称
- cover_url: 封面路径
- source_type: 来源类型
- total_count: 单词总数
- mastered_count: 已掌握数
- create_time: 创建时间
- update_time: 更新时间

### word 表（单词）
- word_id: 主键
- book_id: 词书ID（外键）
- english: 英文单词
- chinese: 中文释义
- phonetic_uk: 英式音标
- phonetic_us: 美式音标
- audio_uk_url: 英式音频路径
- audio_us_url: 美式音频路径
- sentence: 例句
- mastery_status: 掌握状态
- next_review_time: 下次复习时间
- review_count: 复习次数

## 使用说明

1. 首次运行会自动创建示例词书和示例单词
2. 在左上角选择词书
3. 点击"学习"开始学习新单词
4. 点击"复习"复习已学习的单词
5. 点击"单词总览"查看学习进度

## 技术栈

- Electron: 桌面应用框架
- SQLite: 本地数据库
- HTML/CSS/JavaScript: 前端技术
- better-sqlite3: SQLite 驱动
