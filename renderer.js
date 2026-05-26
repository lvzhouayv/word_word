let currentWordbook = null;
let currentLearnWords = [];
let currentReviewWords = [];
let currentLearnIndex = 0;
let currentReviewIndex = 0;
let currentLearnMode = 'dictation';
let inputModalResolve = null;
let showWordDetail = false;
let reviewSettings = null;
let blurSettings = null;
let wordLearnProgress = {};
let currentLearnType = 1;
let currentLearnStage = 1;
let choiceQuestionQueue = [];
let dictationWordQueue = [];
let totalChoiceQuestions = 0;
let completedChoiceQuestions = 0;
let skippedChoiceQuestions = 0;
let totalDictationWords = 0;
let completedDictationWords = 0;

// 加载词书列表
async function loadWordbooks() {
  const wordbooks = api.getWordbooks();
  
  // 更新当前词书显示
  if (currentWordbook) {
    const selectedBook = wordbooks.find(book => book.book_id === currentWordbook.book_id);
    if (selectedBook) {
      updateCurrentWordbookDisplay(selectedBook);
    }
  }
  
  // 渲染书本样式的单词书卡片到书架
  renderWordbookBooks(wordbooks);
}

// 更新当前词书显示
function updateCurrentWordbookDisplay(book) {
  // 更新封面
  const coverElement = document.querySelector('.book-cover');
  const nameElement = document.getElementById('currentWordbookName');
  const statsElement = document.getElementById('currentWordbookStats');
  
  if (coverElement && nameElement && statsElement) {
    // 更新封面（这里使用默认封面，实际可以根据需要加载自定义封面）
    coverElement.src = 'assets/default-cover.svg';
    coverElement.alt = book.book_name;
    
    // 更新名称和统计信息
    nameElement.textContent = book.book_name;
    statsElement.textContent = `${book.mastered_count}/${book.total_count}`;
  }
}

// 渲染书本样式的单词书卡片到书架
function renderWordbookBooks(wordbooks) {
  const shelf = document.getElementById('wordbookShelf');
  shelf.innerHTML = '';
  
  wordbooks.forEach(book => {
    const bookElement = document.createElement('div');
    bookElement.className = `wordbook-book ${currentWordbook && currentWordbook.book_id === book.book_id ? 'active' : ''}`;
    bookElement.dataset.bookId = book.book_id;
    bookElement.dataset.bookName = book.book_name;
    
    // 生成书本封面（使用书名的首字母）
    const initials = book.book_name.substring(0, 2).toUpperCase();
    
    bookElement.innerHTML = `
      <div class="wordbook-book-cover">${initials}</div>
      <div class="wordbook-book-info">
        <div class="wordbook-book-name">${book.book_name}</div>
        <div class="wordbook-book-stats">${book.mastered_count}/${book.total_count}</div>
      </div>
    `;
    
    // 添加点击事件
    bookElement.addEventListener('click', () => selectWordbookFromBook(book));
    
    shelf.appendChild(bookElement);
  });
}

// 从书本卡片选择词书
function selectWordbookFromBook(book) {
  currentWordbook = {
    book_id: book.book_id,
    book_name: book.book_name
  };

  localStorage.setItem('current_wordbook_id', book.book_id.toString());

  // 更新当前词书显示
  updateCurrentWordbookDisplay(book);
  
  // 更新所有书本的激活状态
  document.querySelectorAll('.wordbook-book').forEach(bookElement => {
    bookElement.classList.remove('active');
    if (parseInt(bookElement.dataset.bookId) === book.book_id) {
      bookElement.classList.add('active');
    }
  });
  
  // 直接跳转到该单词本的单词总览页面
  showOverview();
  
  console.log('当前词书:', currentWordbook);
}

// 更新当前词书显示
function updateCurrentWordbookDisplay(book) {
  const nameElement = document.getElementById('currentWordbookName');
  const statsElement = document.getElementById('currentWordbookStats');
  const coverElement = document.querySelector('.book-cover');
  
  // 更新封面（这里使用默认封面，实际可以根据需要加载自定义封面）
  coverElement.src = 'assets/default-cover.svg';
  coverElement.alt = book.book_name;
  
  // 更新名称和统计信息
  nameElement.textContent = book.book_name;
  statsElement.textContent = `${book.mastered_count}/${book.total_count}`;
}

// 跳转到单词书选择页面
function goToWordbookPage() {
  showPage('wordbookPage');
  loadWordbooks();
}

async function loadReviewSettings() {
  try {
    reviewSettings = api.getReviewSettings();
    
    if (!reviewSettings) {
      reviewSettings = {
        error_days_map: '{"1":1,"2":1,"3":2,"4":3,"5":3}',
        use_custom_settings: 0,
        enable_today_review: 0
      };
    }
    
    const useCustomCheckbox = document.getElementById('useCustomReviewSettings');
    const customSettingsDiv = document.getElementById('customReviewSettings');
    const enableTodayReviewCheckbox = document.getElementById('enableTodayReview');
    
    if (useCustomCheckbox && customSettingsDiv && enableTodayReviewCheckbox) {
      useCustomCheckbox.checked = reviewSettings.use_custom_settings === 1;
      customSettingsDiv.style.display = reviewSettings.use_custom_settings === 1 ? 'block' : 'none';
      enableTodayReviewCheckbox.checked = reviewSettings.enable_today_review === 1;
      
      const errorDaysMap = JSON.parse(reviewSettings.error_days_map || '{}');
      document.getElementById('error1Days').value = errorDaysMap['1'] || 1;
      document.getElementById('error2Days').value = errorDaysMap['2'] || 1;
      document.getElementById('error3Days').value = errorDaysMap['3'] || 2;
      document.getElementById('error4Days').value = errorDaysMap['4'] || 3;
      document.getElementById('error5Days').value = errorDaysMap['5'] || 3;
    }
  } catch (error) {
    console.error('加载复习设置失败:', error);
    reviewSettings = {
      error_days_map: '{"1":1,"2":1,"3":2,"4":3","5":3}',
      use_custom_settings: 0,
      enable_today_review: 0
    };
  }
}

async function saveReviewSettings() {
  const errorDaysMap = {
    '1': parseInt(document.getElementById('error1Days').value) || 1,
    '2': parseInt(document.getElementById('error2Days').value) || 1,
    '3': parseInt(document.getElementById('error3Days').value) || 2,
    '4': parseInt(document.getElementById('error4Days').value) || 3,
    '5': parseInt(document.getElementById('error5Days').value) || 3
  };
  
  const useCustomSettings = document.getElementById('useCustomReviewSettings').checked;
  const enableTodayReview = document.getElementById('enableTodayReview').checked;

  api.updateReviewSettings(errorDaysMap, useCustomSettings, enableTodayReview);
  await loadReviewSettings();
  
  alert('复习设置已保存');
}

async function loadBlurSettings() {
  try {
    blurSettings = api.getBlurSettings();
    
    if (!blurSettings) {
      blurSettings = {
        button_blur: 20,
        card_blur: 20,
        search_blur: 20,
        other_blur: 20,
        background_blur: 0
      };
    }
    
    const buttonBlurInput = document.getElementById('buttonBlurIntensity');
    const cardBlurInput = document.getElementById('cardBlurIntensity');
    const searchBlurInput = document.getElementById('searchBlurIntensity');
    const otherBlurInput = document.getElementById('otherBlurIntensity');
    const backgroundBlurInput = document.getElementById('backgroundBlurIntensity');
    
    const buttonBlurValue = document.getElementById('buttonBlurValue');
    const cardBlurValue = document.getElementById('cardBlurValue');
    const searchBlurValue = document.getElementById('searchBlurValue');
    const otherBlurValue = document.getElementById('otherBlurValue');
    const backgroundBlurValue = document.getElementById('backgroundBlurValue');
    
    if (buttonBlurInput && buttonBlurValue) {
      buttonBlurInput.value = blurSettings.button_blur || 20;
      buttonBlurValue.textContent = blurSettings.button_blur || 20;
    }
    
    if (cardBlurInput && cardBlurValue) {
      cardBlurInput.value = blurSettings.card_blur || 20;
      cardBlurValue.textContent = blurSettings.card_blur || 20;
    }
    
    if (searchBlurInput && searchBlurValue) {
      searchBlurInput.value = blurSettings.search_blur || 20;
      searchBlurValue.textContent = blurSettings.search_blur || 20;
    }
    
    if (otherBlurInput && otherBlurValue) {
      otherBlurInput.value = blurSettings.other_blur || 20;
      otherBlurValue.textContent = blurSettings.other_blur || 20;
    }
    
    if (backgroundBlurInput && backgroundBlurValue) {
      backgroundBlurInput.value = blurSettings.background_blur || 0;
      backgroundBlurValue.textContent = blurSettings.background_blur || 0;
    }
    
    applyBlurSettings();
} catch (error) {
  console.error('加载毛玻璃设置失败:', error);
  blurSettings = {
    button_blur: 20,
    card_blur: 20,
    search_blur: 20,
    other_blur: 20,
    background_blur: 0
  };
}
}

// 加载字体颜色设置
let fontColorSettings = null;
async function loadFontColorSettings() {
  try {
    fontColorSettings = api.getThemeSettings();
    
    if (!fontColorSettings) {
      fontColorSettings = {
        light_text_primary: '#000000',
        light_text_secondary: '#333333',
        dark_text_primary: '#ffffff',
        dark_text_secondary: '#b0b0b0'
      };
    }
    
    // 更新颜色选择器的值
    const lightTextPrimary = document.getElementById('lightTextPrimary');
    const lightTextPrimaryValue = document.getElementById('lightTextPrimaryValue');
    const lightTextSecondary = document.getElementById('lightTextSecondary');
    const lightTextSecondaryValue = document.getElementById('lightTextSecondaryValue');
    const darkTextPrimary = document.getElementById('darkTextPrimary');
    const darkTextPrimaryValue = document.getElementById('darkTextPrimaryValue');
    const darkTextSecondary = document.getElementById('darkTextSecondary');
    const darkTextSecondaryValue = document.getElementById('darkTextSecondaryValue');
    
    if (lightTextPrimary && lightTextPrimaryValue) {
      lightTextPrimary.value = fontColorSettings.light_text_primary || '#000000';
      lightTextPrimaryValue.value = fontColorSettings.light_text_primary || '#000000';
    }
    
    if (lightTextSecondary && lightTextSecondaryValue) {
      lightTextSecondary.value = fontColorSettings.light_text_secondary || '#333333';
      lightTextSecondaryValue.value = fontColorSettings.light_text_secondary || '#333333';
    }
    
    if (darkTextPrimary && darkTextPrimaryValue) {
      darkTextPrimary.value = fontColorSettings.dark_text_primary || '#ffffff';
      darkTextPrimaryValue.value = fontColorSettings.dark_text_primary || '#ffffff';
    }
    
    if (darkTextSecondary && darkTextSecondaryValue) {
      darkTextSecondary.value = fontColorSettings.dark_text_secondary || '#b0b0b0';
      darkTextSecondaryValue.value = fontColorSettings.dark_text_secondary || '#b0b0b0';
    }
    
    // 应用字体颜色设置到当前页面
    applyFontColorSettings();
  } catch (error) {
    console.error('加载字体颜色设置失败:', error);
    fontColorSettings = {
      light_text_primary: '#000000',
      light_text_secondary: '#333333',
      dark_text_primary: '#ffffff',
      dark_text_secondary: '#b0b0b0'
    };
  }
}

// 保存字体颜色设置
async function saveFontColorSettings() {
  try {
    const lightTextPrimary = document.getElementById('lightTextPrimary').value;
    const lightTextSecondary = document.getElementById('lightTextSecondary').value;
    const darkTextPrimary = document.getElementById('darkTextPrimary').value;
    const darkTextSecondary = document.getElementById('darkTextSecondary').value;
    
    const settings = {
      light_text_primary: lightTextPrimary,
      light_text_secondary: lightTextSecondary,
      dark_text_primary: darkTextPrimary,
      dark_text_secondary: darkTextSecondary
    };
    
    api.saveThemeSettings(settings);
    fontColorSettings = settings;
    
    // 应用字体颜色设置到当前页面
    applyFontColorSettings();
    
    alert('字体颜色设置已保存');
  } catch (error) {
    console.error('保存字体颜色设置失败:', error);
    alert('保存字体颜色设置失败');
  }
}

// 应用字体颜色设置到当前页面
function applyFontColorSettings() {
  const root = document.documentElement;
  const isLightTheme = document.body.classList.contains('light-theme') || !document.body.classList.contains('dark-theme');
  
  if (isLightTheme) {
    root.style.setProperty('--text-primary', fontColorSettings.light_text_primary || '#000000');
    root.style.setProperty('--text-secondary', fontColorSettings.light_text_secondary || '#333333');
  } else {
    root.style.setProperty('--text-primary', fontColorSettings.dark_text_primary || '#ffffff');
    root.style.setProperty('--text-secondary', fontColorSettings.dark_text_secondary || '#b0b0b0');
  }
}

// 初始化颜色选择器事件监听器
function initColorPickerListeners() {
  // 浅色模式主要文字颜色
  const lightTextPrimary = document.getElementById('lightTextPrimary');
  const lightTextPrimaryValue = document.getElementById('lightTextPrimaryValue');
  if (lightTextPrimary && lightTextPrimaryValue) {
    lightTextPrimary.addEventListener('input', (e) => {
      lightTextPrimaryValue.value = e.target.value;
    });
    lightTextPrimaryValue.addEventListener('input', (e) => {
      lightTextPrimary.value = e.target.value;
    });
  }
  
  // 浅色模式次要文字颜色
  const lightTextSecondary = document.getElementById('lightTextSecondary');
  const lightTextSecondaryValue = document.getElementById('lightTextSecondaryValue');
  if (lightTextSecondary && lightTextSecondaryValue) {
    lightTextSecondary.addEventListener('input', (e) => {
      lightTextSecondaryValue.value = e.target.value;
    });
    lightTextSecondaryValue.addEventListener('input', (e) => {
      lightTextSecondary.value = e.target.value;
    });
  }
  
  // 深色模式主要文字颜色
  const darkTextPrimary = document.getElementById('darkTextPrimary');
  const darkTextPrimaryValue = document.getElementById('darkTextPrimaryValue');
  if (darkTextPrimary && darkTextPrimaryValue) {
    darkTextPrimary.addEventListener('input', (e) => {
      darkTextPrimaryValue.value = e.target.value;
    });
    darkTextPrimaryValue.addEventListener('input', (e) => {
      darkTextPrimary.value = e.target.value;
    });
  }
  
  // 深色模式次要文字颜色
  const darkTextSecondary = document.getElementById('darkTextSecondary');
  const darkTextSecondaryValue = document.getElementById('darkTextSecondaryValue');
  if (darkTextSecondary && darkTextSecondaryValue) {
    darkTextSecondary.addEventListener('input', (e) => {
      darkTextSecondaryValue.value = e.target.value;
    });
    darkTextSecondaryValue.addEventListener('input', (e) => {
      darkTextSecondary.value = e.target.value;
    });
  }
}

function applyBlurSettings() {
  const root = document.documentElement;
  const enableBlur = document.getElementById('enableBlurEffect');
  const isBlurEnabled = enableBlur ? enableBlur.checked : false;
  
  // 获取当前滑块的实时值
  const buttonBlurInput = document.getElementById('buttonBlurIntensity');
  const cardBlurInput = document.getElementById('cardBlurIntensity');
  const searchBlurInput = document.getElementById('searchBlurIntensity');
  const otherBlurInput = document.getElementById('otherBlurIntensity');
  const backgroundBlurInput = document.getElementById('backgroundBlurIntensity');
  
  // 从滑块获取值，没有滑块则使用保存的值
  const buttonBlur = buttonBlurInput ? parseInt(buttonBlurInput.value) || 20 : (blurSettings?.button_blur || 20);
  const cardBlur = cardBlurInput ? parseInt(cardBlurInput.value) || 20 : (blurSettings?.card_blur || 20);
  const searchBlur = searchBlurInput ? parseInt(searchBlurInput.value) || 20 : (blurSettings?.search_blur || 20);
  const otherBlur = otherBlurInput ? parseInt(otherBlurInput.value) || 20 : (blurSettings?.other_blur || 20);
  const backgroundBlur = backgroundBlurInput ? parseInt(backgroundBlurInput.value) || 0 : (blurSettings?.background_blur || 0);
  
  // 如果毛玻璃效果未启用，所有模糊值设为0
  const finalButtonBlur = isBlurEnabled ? buttonBlur : 0;
  const finalCardBlur = isBlurEnabled ? cardBlur : 0;
  const finalSearchBlur = isBlurEnabled ? searchBlur : 0;
  const finalOtherBlur = isBlurEnabled ? otherBlur : 0;
  const finalBackgroundBlur = isBlurEnabled ? backgroundBlur : 0;
  
  root.style.setProperty('--button-blur', `${finalButtonBlur}px`);
  root.style.setProperty('--card-blur', `${finalCardBlur}px`);
  root.style.setProperty('--search-blur', `${finalSearchBlur}px`);
  root.style.setProperty('--other-blur', `${finalOtherBlur}px`);
  root.style.setProperty('--background-blur', `${finalBackgroundBlur}px`);
}

async function saveBlurSettings() {
  const buttonBlur = parseInt(document.getElementById('buttonBlurIntensity').value) || 20;
  const cardBlur = parseInt(document.getElementById('cardBlurIntensity').value) || 20;
  const searchBlur = parseInt(document.getElementById('searchBlurIntensity').value) || 20;
  const otherBlur = parseInt(document.getElementById('otherBlurIntensity').value) || 20;
  const backgroundBlur = parseInt(document.getElementById('backgroundBlurIntensity').value) || 0;
  
  api.updateBlurSettings(buttonBlur, cardBlur, searchBlur, otherBlur, backgroundBlur);
  await loadBlurSettings();
  
  alert('毛玻璃设置已保存');
}

// 选择词书（兼容旧的调用方式）
function selectWordbook(bookId) {
  if (!bookId) {
    currentWordbook = null;
    const display = document.getElementById('currentWordbookDisplay');
    const name = display.querySelector('.wordbook-name');
    const stats = display.querySelector('.wordbook-stats');
    
    name.textContent = '选择词书...';
    stats.textContent = '';
    
    // 更新所有卡片的激活状态
    document.querySelectorAll('.wordbook-card').forEach(card => {
      card.classList.remove('active');
    });
    
    // 关闭下拉面板
    hideWordbookDropdown();
    return;
  }
  
  // 这里兼容旧代码，实际选择逻辑已移至selectWordbookFromCard
  // 从当前词书列表中查找对应ID的词书
  const wordbooks = document.querySelectorAll('.wordbook-card');
  for (let i = 0; i < wordbooks.length; i++) {
    if (wordbooks[i].dataset.bookId == bookId) {
      // 模拟点击对应卡片
      wordbooks[i].click();
      break;
    }
  }
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

async function showSettingsModal() {
  await loadFontColorSettings();
  initColorPickerListeners();
  
  // 加载学习设置
  const learnSettings = api.getLearnSettings();
  document.getElementById('defaultLearnCount').value = learnSettings.default_learn_count;
  
  document.getElementById('settingsModal').classList.add('active');
}

function hideSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function showInputModal(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    inputModalResolve = resolve;
    document.getElementById('inputModalTitle').textContent = title;
    document.getElementById('inputModalMessage').textContent = message;
    document.getElementById('inputModalValue').value = defaultValue;
    document.getElementById('inputModal').classList.add('active');
    document.getElementById('inputModalValue').focus();
  });
}

function hideInputModal() {
  document.getElementById('inputModal').classList.remove('active');
}

function displaySearchResults(result) {
  const resultsContainer = document.getElementById('searchResults');
  
  if (!result || !result.data || !result.data.entries || result.data.entries.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-result">未找到相关单词</div>';
    resultsContainer.style.display = 'block';
    return;
  }
  
  const entries = result.data.entries;
  let html = '';
  
  entries.forEach(entry => {
    html += `
      <div class="search-result-item" data-word="${entry.entry}" data-explain="${entry.explain}">
        <div class="search-word">${entry.entry}</div>
        <div class="search-explain">${entry.explain}</div>
      </div>
    `;
  });
  
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
  
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const word = item.dataset.word;
      const explain = item.dataset.explain;
      showWordDetailModal(word, explain);
      document.getElementById('searchResults').style.display = 'none';
    });
  });
}

function showWordDetailModal(word, explain) {
  const content = document.getElementById('wordDetailContent');
  content.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 32px; font-weight: bold; margin-bottom: 12px; color: var(--text-primary);">${word}</div>
      <div style="font-size: 16px; color: var(--text-secondary); line-height: 1.6;">${explain}</div>
    </div>
  `;
  document.getElementById('wordDetailModal').classList.add('active');
}

function hideWordDetailModal() {
  document.getElementById('wordDetailModal').classList.remove('active');
}

async function startLearn() {
  if (!currentWordbook) {
    alert('请先选择词书');
    return;
  }
  
  // 获取学习设置
  const learnSettings = api.getLearnSettings();
  let learnCount = learnSettings.default_learn_count;

  const words = api.getLearnWords(currentWordbook.book_id, learnCount);
  
  if (words.length === 0) {
    alert('没有新单词可学习');
    return;
  }
  
  currentLearnWords = words;
  currentLearnIndex = 0;
  currentLearnStage = 1;
  wordLearnProgress = {};
  choiceQuestionQueue = [];
  dictationWordQueue = [];
  totalChoiceQuestions = 0;
  completedChoiceQuestions = 0;
  skippedChoiceQuestions = 0;
  totalDictationWords = 0;
  completedDictationWords = 0;
  
  words.forEach(word => {
    wordLearnProgress[word.word_id] = {
      stage1: false,
      stage2: false,
      stage3: false
    };
  });
  
  showPage('learnPage');
  showCurrentLearnWord();
}

async function startReview() {
  if (!currentWordbook) {
    alert('请先选择词书');
    return;
  }
  
  const words = api.getReviewWords(currentWordbook.book_id);
  
  if (words.length === 0) {
    alert('没有需要复习的单词');
    return;
  }
  
  currentReviewWords = words;
  currentReviewIndex = 0;
  
  showPage('reviewPage');
  showCurrentReviewWord();
}

async function showCurrentLearnWord() {
  const container = document.getElementById('learnContent');
  
  if (currentLearnStage === 1) {
    const word = currentLearnWords[currentLearnIndex];
    
    document.getElementById('learnProgress').textContent = 
      `${currentLearnIndex + 1}/${currentLearnWords.length}`;
    
    const wordDetail = api.getWordDetail(word.word_id);
    Object.assign(word, wordDetail);
    
    const progress = wordLearnProgress[word.word_id];
    
    wordLearnProgress[word.word_id].stage1 = true;
    

    
    container.innerHTML = `
      <div class="learn-center-content">
        <div class="word-card">
          <div class="word" style="font-size: 28px; font-weight: bold; margin-bottom: 15px;">${word.english}</div>
          <div class="definition" style="font-size: 20px;">${word.part_of_speech ? `${word.part_of_speech} ${word.chinese}` : word.chinese}</div>
          <div class="phonetic" style="margin-top: 10px; font-size: 16px;">${word.phonetic_uk || word.phonetic_us || ''}</div>
          <div class="audio-buttons" style="margin-top: 15px;">
            <button class="audio-btn" onclick="playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">🇬🇧 英式发音</button>
            <button class="audio-btn" onclick="playAudio('${word.audio_us_url}', 'us', '${word.english}')">🇺🇸 美式发音</button>
          </div>
          ${word.sentence ? `<div class="example" style="margin-top: 15px; font-size: 16px;">${word.sentence}</div>` : ''}
          
          <div class="navigation-buttons" style="display: flex; justify-content: space-between; margin-top: 25px;">
            <button class="nav-btn" onclick="previousLearnWord()" ${currentLearnIndex === 0 ? 'disabled' : ''}>上一个</button>
            <button class="nav-btn" onclick="nextLearnWord()">下一个</button>
          </div>
        </div>
      </div>

    `;
  } else if (currentLearnStage === 2) {
    if (choiceQuestionQueue.length === 0) {
      const effectiveTotal = totalChoiceQuestions - skippedChoiceQuestions;
      console.log('选择题队列为空，已完成:', completedChoiceQuestions, '有效总数:', effectiveTotal);
      if (completedChoiceQuestions >= effectiveTotal && effectiveTotal > 0) {
        currentLearnStage = 3;
        currentLearnIndex = 0;
        await showCurrentLearnWord();
        return;
      }
      
      await generateChoiceQuestions();
      if (choiceQuestionQueue.length === 0) {
        currentLearnStage = 3;
        currentLearnIndex = 0;
        await showCurrentLearnWord();
        return;
      }
      totalChoiceQuestions = choiceQuestionQueue.length;
      completedChoiceQuestions = 0;
      skippedChoiceQuestions = 0;
      console.log('初始化选择题，总数:', totalChoiceQuestions);
    }
    
    const currentQuestion = choiceQuestionQueue[0];
    currentLearnIndex = currentQuestion.questionIndex;
    
    const effectiveTotal = totalChoiceQuestions - skippedChoiceQuestions;
    console.log('当前进度:', completedChoiceQuestions + 1, '/', effectiveTotal, '(跳过:', skippedChoiceQuestions, ')');
    document.getElementById('learnProgress').textContent = 
      `${completedChoiceQuestions + 1}/${effectiveTotal}`;
    
    const questionWord = currentLearnWords.find(w => w.word_id === currentQuestion.wordId);
    const questionWordDetail = api.getWordDetail(questionWord.word_id);
    Object.assign(questionWord, questionWordDetail);
    
    if (currentQuestion.type === 'selectChinese') {
      const chineseOptions = await generateChineseOptions(questionWord);
      
      if (!chineseOptions || chineseOptions.length < 2) {
        console.log('中文选项不足，跳过题目');
        choiceQuestionQueue.shift();
        skippedChoiceQuestions++;
        
        const effectiveTotal = totalChoiceQuestions - skippedChoiceQuestions;
        console.log('跳过后 - 已完成:', completedChoiceQuestions, '有效总数:', effectiveTotal);
        if (completedChoiceQuestions >= effectiveTotal && effectiveTotal > 0) {
          console.log('所有题目已完成，进入第三阶段');
          currentLearnStage = 3;
          currentLearnIndex = 0;
          setTimeout(async () => {
            await showCurrentLearnWord();
          }, 100);
          return;
        }
        
        if (choiceQuestionQueue.length === 0) {
          console.log('队列为空，进入第三阶段');
          currentLearnStage = 3;
          currentLearnIndex = 0;
          setTimeout(async () => {
            await showCurrentLearnWord();
          }, 100);
          return;
        }
        
        setTimeout(async () => {
          await showCurrentLearnWord();
        }, 100);
        return;
      }
      
      container.innerHTML = `
        <div class="learn-center-content">
          <div class="word-card">
            <div class="word" style="font-size: 32px; font-weight: bold; margin-bottom: 15px;">${questionWord.english}</div>
            <div class="phonetic" style="margin-top: 10px; font-size: 18px;">${questionWord.phonetic_uk || questionWord.phonetic_us || ''}</div>
            <div class="audio-buttons" style="margin-top: 15px;">
              <button class="audio-btn" onclick="playAudio('${questionWord.audio_uk_url}', 'uk', '${questionWord.english}')">🇬🇧 英式发音</button>
              <button class="audio-btn" onclick="playAudio('${questionWord.audio_us_url}', 'us', '${questionWord.english}')">🇺🇸 美式发音</button>
            </div>
            <div class="options">
              ${chineseOptions.map(opt => `
                <button class="option-btn" onclick="checkLearnAnswer('${opt}', '${questionWord.chinese}')">${opt}</button>
              `).join('')}
            </div>
            <div id="feedback" style="margin-top: 20px;"></div>
          </div>
        </div>
      `;
    } else {
      const englishOptions = await generateEnglishOptions(questionWord);
      
      if (!englishOptions || englishOptions.length === 0) {
        choiceQuestionQueue.shift();
        skippedChoiceQuestions++;
        
        const effectiveTotal = totalChoiceQuestions - skippedChoiceQuestions;
        if (completedChoiceQuestions >= effectiveTotal && effectiveTotal > 0) {
          currentLearnStage = 3;
          currentLearnIndex = 0;
          setTimeout(async () => {
            await showCurrentLearnWord();
          }, 100);
          return;
        }
        
        if (choiceQuestionQueue.length === 0) {
          currentLearnStage = 3;
          currentLearnIndex = 0;
          setTimeout(async () => {
            await showCurrentLearnWord();
          }, 100);
          return;
        }
        
        setTimeout(async () => {
          await showCurrentLearnWord();
        }, 100);
        return;
      }
      
      container.innerHTML = `
        <div class="learn-center-content">
          <div class="word-card">
            <div class="definition" style="font-size: 28px; font-weight: bold; margin-bottom: 15px;">${questionWord.part_of_speech ? `${questionWord.part_of_speech} ${questionWord.chinese}` : questionWord.chinese}</div>
            <div class="options">
              ${englishOptions.map(opt => `
                <button class="option-btn" onclick="checkLearnAnswer('${opt}', '${questionWord.english}')">${opt}</button>
              `).join('')}
            </div>
            <div id="feedback" style="margin-top: 20px;"></div>
          </div>
        </div>
      `;
    }
  } else if (currentLearnStage === 3) {
    if (dictationWordQueue.length === 0) {
      console.log('默写队列为空，已完成:', completedDictationWords, '总数:', totalDictationWords);
      if (completedDictationWords >= totalDictationWords && totalDictationWords > 0) {
        console.log('默写完成，结束学习');
        for (const word of currentLearnWords) {
          api.markWordLearned(word.word_id);
        }
        alert('学习完成！所有单词已进入复习阶段。');
        showPage('homePage');
        return;
      }
      
      await generateDictationWords();
      if (dictationWordQueue.length === 0) {
        console.log('无法生成默写队列，结束学习');
        for (const word of currentLearnWords) {
          api.markWordLearned(word.word_id);
        }
        alert('学习完成！所有单词已进入复习阶段。');
        showPage('homePage');
        return;
      }
      totalDictationWords = dictationWordQueue.length;
      completedDictationWords = 0;
      console.log('初始化默写队列，总数:', totalDictationWords);
    }
    
    currentLearnIndex = completedDictationWords;
    
    document.getElementById('learnProgress').textContent = 
      `${completedDictationWords + 1}/${totalDictationWords}`;
    
    const dictationWord = currentLearnWords.find(w => w.word_id === dictationWordQueue[0].wordId);
    const dictationWordDetail = api.getWordDetail(dictationWord.word_id);
    Object.assign(dictationWord, dictationWordDetail);
    
    container.innerHTML = `
      <div class="learn-center-content">
        <div class="word-card">
          <div class="definition" style="font-size: 28px; font-weight: bold; margin-bottom: 15px;">${dictationWord.part_of_speech ? `${dictationWord.part_of_speech} ${dictationWord.chinese}` : dictationWord.chinese}</div>
          <div class="input-area">
            <input type="text" id="answerInput" placeholder="请输入英文单词" autocomplete="off" spellcheck="false">
          </div>
          <div class="action-buttons">
            <button class="submit-btn" onclick="checkLearnAnswer()">提交</button>
          </div>
          <div id="feedback" style="margin-top: 20px;"></div>
          <div id="wordDetail" style="display: none; margin-top: 20px;">
            <div class="word" style="font-size: 24px;">${dictationWord.english}</div>
            <div class="phonetic" style="margin-top: 5px;">${dictationWord.phonetic_uk || dictationWord.phonetic_us || ''}</div>
            <div class="audio-buttons" style="margin-top: 10px;">
              <button class="audio-btn" onclick="playAudio('${dictationWord.audio_uk_url}', 'uk', '${dictationWord.english}')">🇬🇧 英式发音</button>
              <button class="audio-btn" onclick="playAudio('${dictationWord.audio_us_url}', 'us', '${dictationWord.english}')">🇺🇸 美式发音</button>
            </div>
            ${dictationWord.sentence ? `<div class="example" style="margin-top: 15px;">${dictationWord.sentence}</div>` : ''}
          </div>
        </div>
      </div>
    `;
    
    setTimeout(() => {
      const input = document.getElementById('answerInput');
      if (input) {
        input.focus();
        input.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            checkLearnAnswer();
          }
        });
      }
    }, 100);
  }
}

async function generateChoiceQuestions() {
  choiceQuestionQueue = [];
  
  for (let i = 0; i < currentLearnWords.length; i++) {
    const word = currentLearnWords[i];
    
    choiceQuestionQueue.push({
      wordId: word.word_id,
      type: 'selectChinese',
      questionIndex: choiceQuestionQueue.length
    });
    
    choiceQuestionQueue.push({
      wordId: word.word_id,
      type: 'selectEnglish',
      questionIndex: choiceQuestionQueue.length
    });
  }
  
  for (let i = choiceQuestionQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choiceQuestionQueue[i], choiceQuestionQueue[j]] = [choiceQuestionQueue[j], choiceQuestionQueue[i]];
  }
  
  for (let i = 0; i < choiceQuestionQueue.length; i++) {
    choiceQuestionQueue[i].questionIndex = i;
  }
  
  console.log('生成了', choiceQuestionQueue.length, '道选择题');
}

async function generateDictationWords() {
  dictationWordQueue = [];
  
  for (let i = 0; i < currentLearnWords.length; i++) {
    dictationWordQueue.push({
      wordId: currentLearnWords[i].word_id,
      wordIndex: dictationWordQueue.length
    });
  }
  
  for (let i = dictationWordQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dictationWordQueue[i], dictationWordQueue[j]] = [dictationWordQueue[j], dictationWordQueue[i]];
  }
  
  for (let i = 0; i < dictationWordQueue.length; i++) {
    dictationWordQueue[i].wordIndex = i;
  }
}

async function generateChineseOptions(currentWord) {
  const allWords = api.getOptions(currentWordbook.book_id, currentWord.word_id);
  
  if (allWords.length < 3) {
    return [currentWord.part_of_speech ? `${currentWord.part_of_speech} ${currentWord.chinese}` : currentWord.chinese];
  }
  
  const options = allWords.map(w => w.part_of_speech ? `${w.part_of_speech} ${w.chinese}` : w.chinese);
  options.push(currentWord.part_of_speech ? `${currentWord.part_of_speech} ${currentWord.chinese}` : currentWord.chinese);
  
  const uniqueOptions = [...new Set(options)];
  
  for (let i = uniqueOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueOptions[i], uniqueOptions[j]] = [uniqueOptions[j], uniqueOptions[i]];
  }
  
  return uniqueOptions.slice(0, 4);
}

async function generateEnglishOptions(currentWord) {
  const allWords = api.getOptions(currentWordbook.book_id, currentWord.word_id);
  
  if (allWords.length < 3) {
    return [currentWord.english];
  }
  
  const options = allWords.map(w => w.english);
  options.push(currentWord.english);
  
  const uniqueOptions = [...new Set(options)];
  
  for (let i = uniqueOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueOptions[i], uniqueOptions[j]] = [uniqueOptions[j], uniqueOptions[i]];
  }
  
  return uniqueOptions.slice(0, 4);
}

async function checkLearnAnswer(selected, correct) {
  const feedback = document.getElementById('feedback');
  
  let isCorrect = false;
  let currentWord = null;
  
  if (currentLearnStage === 2) {
    const currentQuestion = choiceQuestionQueue[0];
    currentWord = currentLearnWords.find(w => w.word_id === currentQuestion.wordId);
    const progress = wordLearnProgress[currentWord.word_id];
    
    if (currentQuestion.type === 'selectChinese') {
      const selectedChinese = selected.replace(/^[a-z]+\.?\s*/, '');
      const correctChinese = correct.replace(/^[a-z]+\.?\s*/, '');
      isCorrect = selectedChinese === correctChinese;
    } else if (currentQuestion.type === 'selectEnglish') {
      isCorrect = selected === correct;
    }
  } else if (currentLearnStage === 3) {
    const dictationItem = dictationWordQueue[0];
    currentWord = currentLearnWords.find(w => w.word_id === dictationItem.wordId);
    const progress = wordLearnProgress[currentWord.word_id];
    
    const input = document.getElementById('answerInput');
    const answer = input.value.trim().toLowerCase();
    isCorrect = answer === currentWord.english.toLowerCase();
  }
  
  if (isCorrect) {
    feedback.innerHTML = '<div style="color: #FFD700; font-size: 18px; font-weight: 600;">正确</div>';
    
    if (currentLearnStage === 2) {
      choiceQuestionQueue.shift();
      completedChoiceQuestions++;
      
      setTimeout(async () => {
        const effectiveTotal = totalChoiceQuestions - skippedChoiceQuestions;
        if (completedChoiceQuestions >= effectiveTotal && effectiveTotal > 0) {
          console.log('选择题完成，进入第三阶段');
          currentLearnStage = 3;
          currentLearnIndex = 0;
        }
        await showCurrentLearnWord();
      }, 1000);
    } else if (currentLearnStage === 3) {
      dictationWordQueue.shift();
      completedDictationWords++;
      
      const wordDetail = document.getElementById('wordDetail');
      wordDetail.style.display = 'block';
      
      setTimeout(async () => {
        if (completedDictationWords >= totalDictationWords && totalDictationWords > 0) {
          for (const word of currentLearnWords) {
            api.markWordLearned(word.word_id);
          }
          alert('学习完成！所有单词已进入复习阶段。');
          showPage('homePage');
          return;
        }
        await showCurrentLearnWord();
      }, 1500);
    }
  } else {
    feedback.innerHTML = `
      <div style="color: #FF0000; font-size: 18px; font-weight: 600;">错误</div>
      ${currentLearnStage === 3 ? `
        <div style="margin-top: 10px; font-size: 16px; color: var(--text-primary);">
          正确答案: <strong>${currentWord.english}</strong>
        </div>
      ` : ''}
      <button class="submit-btn" style="margin-top: 20px;" onclick="showCurrentLearnWord()">再试一次</button>
    `;
    
    if (currentLearnStage === 2) {
      const buttons = document.querySelectorAll('.option-btn');
      buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correct) {
          btn.classList.add('correct');
        } else if (btn.textContent === selected && selected !== correct) {
          btn.classList.add('wrong');
        }
      });
    }
  }
}

async function previousLearnWord() {
  if (currentLearnIndex > 0) {
    currentLearnIndex--;
    await showCurrentLearnWord();
  }
}

async function nextLearnWord() {
  if (currentLearnIndex < currentLearnWords.length - 1) {
    currentLearnIndex++;
    await showCurrentLearnWord();
  } else {
    if (currentLearnStage === 1) {
      currentLearnStage = 2;
      currentLearnIndex = 0;
      await showCurrentLearnWord();
    } else {
      alert('浏览完成！');
      showPage('homePage');
    }
  }
}

async function showCurrentReviewWord() {
  const word = currentReviewWords[currentReviewIndex];
  const container = document.getElementById('reviewContent');
  
  document.getElementById('reviewProgress').textContent = 
    `${currentReviewIndex + 1}/${currentReviewWords.length}`;
  
  const wordDetail = api.getWordDetail(word.word_id);
  Object.assign(word, wordDetail);
  

  
  container.innerHTML = `
    <div class="learn-center-content">
      <div class="word-card">
        <div class="word" style="font-size: 28px; font-weight: bold; margin-bottom: 15px;">${word.english}</div>
        <div class="phonetic" style="margin-top: 10px; font-size: 16px;">${word.phonetic_uk || word.phonetic_us || ''}</div>
        <div class="audio-buttons" style="margin-top: 15px;">
          <button class="audio-btn" onclick="playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">
            🇬🇧 英式发音
          </button>
          <button class="audio-btn" onclick="playAudio('${word.audio_us_url}', 'us', '${word.english}')">
            🇺🇸 美式发音
          </button>
        </div>
        <div class="definition" style="font-size: 20px;">${word.part_of_speech ? `${word.part_of_speech} ${word.chinese}` : word.chinese}</div>
        ${word.sentence ? `<div class="example" style="margin-top: 15px; font-size: 16px;">${word.sentence}</div>` : ''}
        
        <div class="action-buttons" style="margin-top: 25px;">
          <button class="submit-btn" onclick="reviewWord(false)">不记得</button>
          <button class="next-btn" onclick="reviewWord(true)">记得</button>
        </div>
        <div class="navigation-buttons" style="display: flex; justify-content: space-between; margin-top: 20px;">
          <button class="nav-btn" onclick="previousReviewWord()" ${currentReviewIndex === 0 ? 'disabled' : ''}>上一个</button>
          <button class="nav-btn" onclick="nextReviewWord()" ${currentReviewIndex === currentReviewWords.length - 1 ? 'disabled' : ''}>下一个</button>
        </div>
      </div>
    </div>

  `;
}

async function reviewWord(remembered) {
  const word = currentReviewWords[currentReviewIndex];
  
  if (reviewSettings && reviewSettings.use_custom_settings === 1) {
    const errorCount = word.review_count || 0;
    api.reviewWordCustom(word.word_id, remembered, errorCount);
  } else {
    api.reviewWord(word.word_id, remembered);
  }
  
  currentReviewIndex++;
  if (currentReviewIndex < currentReviewWords.length) {
    showCurrentReviewWord();
  } else {
    alert('复习完成！');
    await loadWordbooks();
    showPage('homePage');
  }
}

let currentOverviewTab = 'all';

async function showOverview() {
  if (!currentWordbook) {
    alert('请先选择词书');
    return;
  }
  
  showPage('overviewPage');
  currentOverviewTab = 'all';
  updateTabButtons();
  await loadOverviewContent();
}

function updateTabButtons() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`tab${currentOverviewTab.charAt(0).toUpperCase() + currentOverviewTab.slice(1)}`).classList.add('active');
}

async function loadOverviewContent() {
  const container = document.getElementById('overviewContent');
  
  if (currentOverviewTab === 'all') {
    await loadAllWords();
  } else if (currentOverviewTab === 'new') {
    await loadTodayLearnedWords();
  } else if (currentOverviewTab === 'review') {
    await loadTodayReviewWords();
  } else if (currentOverviewTab === 'learning') {
    await loadLearningWords();
  }
}

async function loadAllWords() {
  const stats = api.getStats(currentWordbook.book_id);
  
  const container = document.getElementById('overviewContent');
  container.innerHTML = `
    <div class="stats-summary">
      <div class="stat-card stat-primary">
        <div class="number">${stats.total}</div>
        <div class="label">总单词数</div>
      </div>
      <div class="stat-card stat-new">
        <div class="number">${stats.new}</div>
        <div class="label">新单词</div>
      </div>
      <div class="stat-card stat-learning">
        <div class="number">${stats.learning}</div>
        <div class="label">学习中</div>
      </div>
      <div class="stat-card stat-mastered">
        <div class="number">${stats.mastered}</div>
        <div class="label">已掌握</div>
      </div>
    </div>
    
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="搜索单词..." oninput="filterWords()">
      <select id="statusFilter" onchange="filterWords()">
        <option value="all">全部状态</option>
        <option value="0">新单词</option>
        <option value="1">学习中</option>
        <option value="2">已掌握</option>
      </select>
      <select id="sortFilter" onchange="filterWords()">
        <option value="alphabet">字母顺序</option>
        <option value="status">掌握状态</option>
      </select>
    </div>
    
    <div class="word-list" id="wordList"></div>
  `;
  
  filterWords();
}

async function loadTodayLearnedWords() {
  const words = api.getTodayLearnedWords(currentWordbook.book_id);
  
  const container = document.getElementById('overviewContent');
  
  if (words.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
        <div style="font-size: 18px; margin-bottom: 8px;">今天还没有学习新单词</div>
        <div style="font-size: 14px;">开始学习来积累词汇量吧！</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="stats-summary">
      <div class="stat-card stat-primary">
        <div class="number">${words.length}</div>
        <div class="label">今日新学</div>
      </div>
    </div>
    
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="搜索单词..." oninput="filterTodayLearnedWords()">
    </div>
    
    <div class="word-list" id="wordList"></div>
  `;
  
  filterTodayLearnedWords();
}

async function loadTodayReviewWords() {
  const words = api.getTodayReviewWords(currentWordbook.book_id);
  
  const container = document.getElementById('overviewContent');
  
  if (words.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <div style="font-size: 18px; margin-bottom: 8px;">今天没有需要复习的单词</div>
        <div style="font-size: 14px;">继续保持，明天再来复习吧！</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="stats-summary">
      <div class="stat-card stat-primary">
        <div class="number">${words.length}</div>
        <div class="label">今日复习</div>
      </div>
    </div>
    
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="搜索单词..." oninput="filterTodayReviewWords()">
    </div>
    
    <div class="word-list" id="wordList"></div>
  `;
  
  filterTodayReviewWords();
}

async function filterWords() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;
  
  const words = api.getWords(currentWordbook.book_id, search, status, sort);
  const container = document.getElementById('wordList');
  
  container.innerHTML = words.map(word => `
    <div class="word-item" onclick="editWord(${word.word_id})">
      <div class="word">${word.english}</div>
      <div class="phonetic" style="font-size: 14px; color: #666; margin-top: 5px;">
        ${word.phonetic_uk || word.phonetic_us || ''}
      </div>
      <div class="definition">${word.part_of_speech ? `${word.part_of_speech} ${word.chinese}` : word.chinese}</div>
      ${word.sentence ? `<div class="example" style="font-size: 13px; color: #888; margin-top: 8px; font-style: italic;">${word.sentence}</div>` : ''}
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
        <span class="status ${word.mastery_status}">${getStatusLabel(word.mastery_status)}</span>
        <div class="audio-buttons" style="display: flex; gap: 8px;">
          ${word.audio_uk_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">🇬🇧</button>` : ''}
          ${word.audio_us_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_us_url}', 'us', '${word.english}')">🇺🇸</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function filterTodayLearnedWords() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const words = api.getTodayLearnedWords(currentWordbook.book_id);
  const container = document.getElementById('wordList');
  
  const filteredWords = words.filter(word => 
    word.english.toLowerCase().includes(search) ||
    word.chinese.includes(search)
  );
  
  container.innerHTML = filteredWords.map(word => `
    <div class="word-item" onclick="editWord(${word.word_id})">
      <div class="word">${word.english}</div>
      <div class="phonetic" style="font-size: 14px; color: #666; margin-top: 5px;">
        ${word.phonetic_uk || word.phonetic_us || ''}
      </div>
      <div class="definition">${word.part_of_speech ? `${word.part_of_speech} ${word.chinese}` : word.chinese}</div>
      ${word.sentence ? `<div class="example" style="font-size: 13px; color: #888; margin-top: 8px; font-style: italic;">${word.sentence}</div>` : ''}
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
        <span class="status ${word.mastery_status}">${getStatusLabel(word.mastery_status)}</span>
        <div class="audio-buttons" style="display: flex; gap: 8px;">
          ${word.audio_uk_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">🇬🇧</button>` : ''}
          ${word.audio_us_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_us_url}', 'us', '${word.english}')">🇺🇸</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function filterTodayReviewWords() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const words = api.getTodayReviewWords(currentWordbook.book_id);
  const container = document.getElementById('wordList');
  
  const filteredWords = words.filter(word => 
    word.english.toLowerCase().includes(search) ||
    word.chinese.includes(search)
  );
  
  container.innerHTML = filteredWords.map(word => `
    <div class="word-item" onclick="editWord(${word.word_id})">
      <div class="word">${word.english}</div>
      <div class="phonetic" style="font-size: 14px; color: #666; margin-top: 5px;">
        ${word.phonetic_uk || word.phonetic_us || ''}
      </div>
      <div class="definition">${word.part_of_speech ? `${word.part_of_speech} ${word.chinese}` : word.chinese}</div>
      ${word.sentence ? `<div class="example" style="font-size: 13px; color: #888; margin-top: 8px; font-style: italic;">${word.sentence}</div>` : ''}
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
        <span class="status ${word.mastery_status}">${getStatusLabel(word.mastery_status)}</span>
        <div class="audio-buttons" style="display: flex; gap: 8px;">
          ${word.audio_uk_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">🇬🇧</button>` : ''}
          ${word.audio_us_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_us_url}', 'us', '${word.english}')">🇺🇸</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function loadLearningWords() {
  const words = api.getLearningWords(currentWordbook.book_id);
  
  const container = document.getElementById('overviewContent');
  
  if (words.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 16px;">📖</div>
        <div style="font-size: 18px; margin-bottom: 8px;">没有正在学习的单词</div>
        <div style="font-size: 14px;">开始学习来积累词汇量吧！</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="stats-summary">
      <div class="stat-card stat-learning">
        <div class="number">${words.length}</div>
        <div class="label">学习中</div>
      </div>
    </div>
    
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="搜索单词..." oninput="filterLearningWords()">
    </div>
    
    <div class="word-list" id="wordList"></div>
  `;
  
  filterLearningWords();
}

async function filterLearningWords() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const words = api.getLearningWords(currentWordbook.book_id);
  const container = document.getElementById('wordList');
  
  const filteredWords = words.filter(word => 
    word.english.toLowerCase().includes(search) ||
    word.chinese.includes(search)
  );
  
  container.innerHTML = filteredWords.map(word => `
    <div class="word-item" onclick="editWord(${word.word_id})">
      <div class="word">${word.english}</div>
      <div class="phonetic" style="font-size: 14px; color: #666; margin-top: 5px;">
        ${word.phonetic_uk || word.phonetic_us || ''}
      </div>
      <div class="definition">${word.part_of_speech ? `${word.part_of_speech} ${word.chinese}` : word.chinese}</div>
      ${word.sentence ? `<div class="example" style="font-size: 13px; color: #888; margin-top: 8px; font-style: italic;">${word.sentence}</div>` : ''}
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
        <span class="status ${word.mastery_status}">${getStatusLabel(word.mastery_status)}</span>
        <div class="audio-buttons" style="display: flex; gap: 8px;">
          ${word.audio_uk_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">🇬🇧</button>` : ''}
          ${word.audio_us_url ? `<button class="audio-btn" style="padding: 6px 12px; font-size: 12px;" onclick="event.stopPropagation(); playAudio('${word.audio_us_url}', 'us', '${word.english}')">🇺🇸</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function showAddWordModal() {
  document.getElementById('newWordEnglish').value = '';
  document.getElementById('newWordChinese').value = '';
  document.getElementById('addWordModal').classList.add('active');
  document.getElementById('newWordEnglish').focus();
}

function hideAddWordModal() {
  document.getElementById('addWordModal').classList.remove('active');
}

async function addWord() {
  const english = document.getElementById('newWordEnglish').value.trim();
  const chinese = document.getElementById('newWordChinese').value.trim();
  
  if (!english || !chinese) {
    alert('请填写完整的单词信息');
    return;
  }
  
  api.addWord(currentWordbook.book_id, english, chinese);
  hideAddWordModal();
  await loadWordbooks();
  filterWords();
}

function editWord(wordId) {
  if (!currentWordbook) {
    alert('请先选择一个词书');
    return;
  }

  const allWords = api.getWords(currentWordbook.book_id, '', 'all', 'alphabet');
  const word = allWords.find(w => w.word_id === wordId);
  if (word) {
    document.getElementById('editWordId').value = word.word_id;
    document.getElementById('editWordEnglish').value = word.english;
    document.getElementById('editWordChinese').value = word.chinese;
    document.getElementById('editWordModal').classList.add('active');
  }
}

function hideEditWordModal() {
  document.getElementById('editWordModal').classList.remove('active');
}

async function saveWord() {
  const wordId = parseInt(document.getElementById('editWordId').value);
  const english = document.getElementById('editWordEnglish').value.trim();
  const chinese = document.getElementById('editWordChinese').value.trim();
  
  if (!english || !chinese) {
    alert('请填写完整的单词信息');
    return;
  }
  
  api.updateWord(wordId, english, chinese);
  hideEditWordModal();
  await loadWordbooks();
  filterWords();
}

async function deleteWord() {
  const wordId = parseInt(document.getElementById('editWordId').value);
  
  if (confirm('确定要删除这个单词吗？')) {
    api.deleteWord(wordId);
    hideEditWordModal();
    await loadWordbooks();
    filterWords();
  }
}

function getStatusLabel(status) {
  const labels = {
    0: '新单词',
    1: '学习中',
    2: '已掌握'
  };
  return labels[status] || '未知';
}

async function playAudio(url, type, wordText) {
  if (!url) {
    alert('音频文件未找到');
    return;
  }
  
  try {
    const audio = new Audio(url);
    audio.play().catch(err => {
      console.error('播放失败，尝试使用TTS:', err);
      if (wordText) {
        useTTSFallback(wordText);
      } else {
        alert('音频播放失败');
      }
    });
  } catch (error) {
    console.error('音频播放错误，尝试使用TTS:', error);
    if (wordText) {
      useTTSFallback(wordText);
    } else {
      alert('音频播放失败');
    }
  }
}











// 监听iframe消息
window.addEventListener('message', (event) => {
  // 验证消息来源
  if (event.origin === 'https://music.cpp-prog.com') {
    const data = event.data;
    
    // 处理不同类型的消息
    if (data.type === 'lyric') {
      // 更新歌词
      updateLyric(data.lyric);
    } else if (data.type === 'playing') {
      // 更新播放状态
      isPlaying = data.isPlaying;
      updatePlayButton();
      
      // 更新当前播放的歌曲信息
      if (data.song) {
        // 检查歌曲是否在播放列表中
        const songIndex = currentPlaylist.findIndex(song => song.id === data.song.id);
        if (songIndex === -1) {
          // 如果不在播放列表中，添加到列表
          currentPlaylist.push(data.song);
          currentSongIndex = currentPlaylist.length - 1;
        } else {
          // 如果在播放列表中，更新当前索引
          currentSongIndex = songIndex;
        }
        updateCurrentSongInfo();
      }
    }
  }
});

// 初始化音乐播放器
function initMusicPlayer() {
  musicAudioElement = new Audio();
  
  // 监听音乐播放完成事件
  musicAudioElement.addEventListener('ended', () => {
    if (playMode === 'loop') {
      // 单曲循环，重新播放当前歌曲
      musicAudioElement.currentTime = 0;
      musicAudioElement.play().catch(error => {
        console.error('单曲循环播放失败:', error);
      });
    } else {
      // 其他模式，播放下一首
      playNextSong();
    }
  });
  
  // 监听音乐进度变化
  musicAudioElement.addEventListener('timeupdate', () => {
    updateProgress();
    updateLyricDisplay();
  });
  
  // 监听音乐加载完成事件
  musicAudioElement.addEventListener('loadedmetadata', updateDuration);
}

// 更新播放进度
function updateProgress() {
  if (!musicAudioElement || !musicAudioElement.duration) return;
  
  const progress = (musicAudioElement.currentTime / musicAudioElement.duration) * 100;
  document.getElementById('progressBar').value = progress;
  
  // 更新当前时间
  document.getElementById('currentTime').textContent = formatTime(musicAudioElement.currentTime);
}

// 更新歌曲时长
function updateDuration() {
  if (!musicAudioElement || !musicAudioElement.duration) return;
  
  document.getElementById('duration').textContent = formatTime(musicAudioElement.duration);
}

// 格式化时间为 mm:ss 格式
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// 搜索cpp-prog音乐（基于 https://music.cpp-prog.com/）
async function searchCppProgMusic(keyword) {
  // 调试信息：输出搜索关键词
  console.log('cpp-prog音乐搜索关键词:', keyword);
  
  try {
    // 使用新的音乐API封装进行搜索
    const results = await musicApi.search(keyword, musicSources.currentSource, 20, 1);
    
    // 调试信息：输出搜索结果
    console.log('cpp-prog音乐搜索结果:', results);
    
    return results;
  } catch (error) {
    console.error('cpp-prog音乐搜索失败:', error);
    return [];
  }
}

// 多来源搜索，支持从多个音乐源搜索音乐
async function searchMusicFromMultipleSources(keyword) {
  let allResults = [];
  
  // 获取所有可用的音乐源
  const availableSources = musicSources.getAvailableSources();
  
  // 从每个可用音乐源搜索音乐
  for (const source of availableSources) {
    console.log(`从${source.name}搜索音乐: ${keyword}`);
    const results = await musicApi.search(keyword, source.id, 10, 1);
    
    // 添加音乐源标识
    const sourceResults = results.map(song => ({
      ...song,
      source: source.name,
      sourceType: source.id
    }));
    
    allResults = allResults.concat(sourceResults);
  }
  
  // 调试信息：输出最终搜索结果
  console.log('多来源音乐搜索结果数量:', allResults.length);
  console.log('多来源音乐搜索结果:', allResults);
  
  // 去重，保留每个歌曲的第一个出现
  const uniqueResults = [];
  const seenIds = new Set();
  for (const song of allResults) {
    if (!seenIds.has(song.id)) {
      seenIds.add(song.id);
      uniqueResults.push(song);
    }
  }
  
  return uniqueResults;
}

// 显示搜索结果


function useTTSFallback(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1;
    
    window.speechSynthesis.speak(utterance);
    console.log('使用TTS播放:', text);
  } else {
    alert('您的浏览器不支持TTS功能');
  }
}

function previousReviewWord() {
  if (currentReviewIndex > 0) {
    currentReviewIndex--;
    showCurrentReviewWord();
  }
}

function nextReviewWord() {
  if (currentReviewIndex < currentReviewWords.length - 1) {
    currentReviewIndex++;
    showCurrentReviewWord();
  }
}

function initEventListeners() {
  // 单词书选择按钮点击事件 - 跳转到单词书选择页面
  const wordbookSelectBtn = document.getElementById('wordbookSelectBtn');
  if (wordbookSelectBtn) {
    wordbookSelectBtn.addEventListener('click', () => {
      goToWordbookPage();
    });
  }
  
  // 单词书选择页面返回按钮事件
  const wordbookBackBtn = document.getElementById('wordbookBackBtn');
  if (wordbookBackBtn) {
    wordbookBackBtn.addEventListener('click', () => {
      showPage('homePage');
    });
  }
  
  // 搜索相关事件监听器
  const searchInput = document.getElementById('searchWordInput');
  const searchButton = document.getElementById('searchButton');
  let searchTimeout;
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const keyword = e.target.value.trim();
      
      if (keyword === '') {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
          searchResults.style.display = 'none';
        }
        return;
      }
      
      searchTimeout = setTimeout(async () => {
        try {
          const result = api.searchWord(keyword);
          displaySearchResults(result);
        } catch (error) {
          console.error('搜索单词失败:', error);
        }
      }, 300);
    });
    
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim() !== '') {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
          searchResults.style.display = 'block';
        }
      }
    });
  }
  
  if (searchButton) {
    searchButton.addEventListener('click', async () => {
      if (searchInput) {
        const keyword = searchInput.value.trim();
        
        if (keyword === '') {
          const searchResults = document.getElementById('searchResults');
          if (searchResults) {
            searchResults.style.display = 'none';
          }
          return;
        }
        
        try {
          const result = api.searchWord(keyword);
          displaySearchResults(result);
        } catch (error) {
          console.error('搜索单词失败:', error);
        }
      }
    });
  }
  
  // 点击页面其他地方关闭搜索结果
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      const searchResults = document.getElementById('searchResults');
      if (searchResults) {
        searchResults.style.display = 'none';
      }
    }
  });
  
  // 设置相关事件监听器
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      await loadReviewSettings();
      await loadBlurSettings();
      await showSettingsModal();
    });
  }
  
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', hideSettingsModal);
  }
  
  const useCustomReviewSettings = document.getElementById('useCustomReviewSettings');
  if (useCustomReviewSettings) {
    useCustomReviewSettings.addEventListener('change', (e) => {
      const customSettingsDiv = document.getElementById('customReviewSettings');
      if (customSettingsDiv) {
        customSettingsDiv.style.display = e.target.checked ? 'block' : 'none';
      }
    });
  }
  
  const saveReviewSettingsBtn = document.getElementById('saveReviewSettingsBtn');
  if (saveReviewSettingsBtn) {
    saveReviewSettingsBtn.addEventListener('click', saveReviewSettings);
  }
  
  // 毛玻璃效果相关事件监听器
  const buttonBlurInput = document.getElementById('buttonBlurIntensity');
  if (buttonBlurInput) {
    buttonBlurInput.addEventListener('input', (e) => {
      const buttonBlurValue = document.getElementById('buttonBlurValue');
      if (buttonBlurValue) {
        buttonBlurValue.textContent = e.target.value;
      }
      applyBlurSettings(); // 实时应用毛玻璃效果
    });
  }
  
  const cardBlurInput = document.getElementById('cardBlurIntensity');
  if (cardBlurInput) {
    cardBlurInput.addEventListener('input', (e) => {
      const cardBlurValue = document.getElementById('cardBlurValue');
      if (cardBlurValue) {
        cardBlurValue.textContent = e.target.value;
      }
      applyBlurSettings(); // 实时应用毛玻璃效果
    });
  }
  
  const searchBlurInput = document.getElementById('searchBlurIntensity');
  if (searchBlurInput) {
    searchBlurInput.addEventListener('input', (e) => {
      const searchBlurValue = document.getElementById('searchBlurValue');
      if (searchBlurValue) {
        searchBlurValue.textContent = e.target.value;
      }
      applyBlurSettings(); // 实时应用毛玻璃效果
    });
  }
  
  const otherBlurInput = document.getElementById('otherBlurIntensity');
  if (otherBlurInput) {
    otherBlurInput.addEventListener('input', (e) => {
      const otherBlurValue = document.getElementById('otherBlurValue');
      if (otherBlurValue) {
        otherBlurValue.textContent = e.target.value;
      }
      applyBlurSettings(); // 实时应用毛玻璃效果
    });
  }
  
  const backgroundBlurInput = document.getElementById('backgroundBlurIntensity');
  if (backgroundBlurInput) {
    backgroundBlurInput.addEventListener('input', (e) => {
      const backgroundBlurValue = document.getElementById('backgroundBlurValue');
      if (backgroundBlurValue) {
        backgroundBlurValue.textContent = e.target.value;
      }
      applyBlurSettings(); // 实时应用毛玻璃效果
      updateBlurEffect(); // 更新背景模糊效果
    });
  }
  
  const saveBlurSettingsBtn = document.getElementById('saveBlurSettingsBtn');
  if (saveBlurSettingsBtn) {
    saveBlurSettingsBtn.addEventListener('click', saveBlurSettings);
  }
  
  // 字体颜色设置保存按钮
  const saveThemeSettingsBtn = document.getElementById('saveThemeSettingsBtn');
  if (saveThemeSettingsBtn) {
    saveThemeSettingsBtn.addEventListener('click', saveFontColorSettings);
  }
  
  // 保存学习设置事件监听器
  const saveLearnSettingsBtn = document.getElementById('saveLearnSettingsBtn');
  if (saveLearnSettingsBtn) {
    saveLearnSettingsBtn.addEventListener('click', async () => {
      const defaultLearnCount = document.getElementById('defaultLearnCount');
      if (defaultLearnCount) {
        const count = parseInt(defaultLearnCount.value);
        if (isNaN(count) || count < 1 || count > 100) {
          alert('请输入1-100之间的数字');
          return;
        }
        
        api.updateLearnSettings(count);
        alert('学习设置已保存');
      }
    });
  }
  
  // 重置数据库按钮
  const resetDatabaseBtn = document.getElementById('resetDatabaseBtn');
  if (resetDatabaseBtn) {
    resetDatabaseBtn.addEventListener('click', async () => {
      if (confirm('确定要重置数据库吗？这将删除所有学习数据和自定义词书，并重新导入默认词书。')) {
        const result = api.resetDatabase();
        if (result.success) {
          alert('数据库重置成功！');
          await loadWordbooks();
          currentWordbook = null;
          showPage('homePage');
        } else {
          alert('重置失败：' + result.error);
        }
      }
    });
  }
  
  // 音乐相关事件监听器
  const musicBtn = document.getElementById('musicBtn');
  if (musicBtn) {
    musicBtn.addEventListener('click', () => {
      // 显示音乐模态框
      document.getElementById('musicModal').classList.add('active');
    });
  }

  // 添加关闭音乐模态框的事件监听器
  const closeMusicModalBtn = document.getElementById('closeMusicModalBtn');
  if (closeMusicModalBtn) {
    closeMusicModalBtn.addEventListener('click', () => {
      document.getElementById('musicModal').classList.remove('active');
    });
  }
  
  // 单词添加相关事件监听器
  const addWordBtn = document.getElementById('addWordBtn');
  if (addWordBtn) {
    addWordBtn.addEventListener('click', showAddWordModal);
  }
  
  const closeAddWordModalBtn = document.getElementById('closeAddWordModalBtn');
  if (closeAddWordModalBtn) {
    closeAddWordModalBtn.addEventListener('click', hideAddWordModal);
  }
  
  const addWordCancelBtn = document.getElementById('addWordCancelBtn');
  if (addWordCancelBtn) {
    addWordCancelBtn.addEventListener('click', hideAddWordModal);
  }
  
  const addWordConfirmBtn = document.getElementById('addWordConfirmBtn');
  if (addWordConfirmBtn) {
    addWordConfirmBtn.addEventListener('click', addWord);
  }
  
  // 单词编辑相关事件监听器
  const closeEditWordModalBtn = document.getElementById('closeEditWordModalBtn');
  if (closeEditWordModalBtn) {
    closeEditWordModalBtn.addEventListener('click', hideEditWordModal);
  }
  
  const editWordCancelBtn = document.getElementById('editWordCancelBtn');
  if (editWordCancelBtn) {
    editWordCancelBtn.addEventListener('click', hideEditWordModal);
  }
  
  const editWordConfirmBtn = document.getElementById('editWordConfirmBtn');
  if (editWordConfirmBtn) {
    editWordConfirmBtn.addEventListener('click', saveWord);
  }
  
  const editWordDeleteBtn = document.getElementById('editWordDeleteBtn');
  if (editWordDeleteBtn) {
    editWordDeleteBtn.addEventListener('click', deleteWord);
  }
  
  // 单词详情模态框事件监听器
  const closeWordDetailModalBtn = document.getElementById('closeWordDetailModalBtn');
  if (closeWordDetailModalBtn) {
    closeWordDetailModalBtn.addEventListener('click', hideWordDetailModal);
  }
  
  // 输入模态框事件监听器
  const closeInputModalBtn = document.getElementById('closeInputModalBtn');
  if (closeInputModalBtn) {
    closeInputModalBtn.addEventListener('click', () => {
      hideInputModal();
      if (inputModalResolve) {
        inputModalResolve(null);
        inputModalResolve = null;
      }
    });
  }
  
  const inputModalCancelBtn = document.getElementById('inputModalCancelBtn');
  if (inputModalCancelBtn) {
    inputModalCancelBtn.addEventListener('click', () => {
      hideInputModal();
      if (inputModalResolve) {
        inputModalResolve(null);
        inputModalResolve = null;
      }
    });
  }
  
  const inputModalConfirmBtn = document.getElementById('inputModalConfirmBtn');
  if (inputModalConfirmBtn) {
    inputModalConfirmBtn.addEventListener('click', () => {
      const inputModalValue = document.getElementById('inputModalValue');
      const value = inputModalValue ? inputModalValue.value : '';
      hideInputModal();
      if (inputModalResolve) {
        inputModalResolve(value);
        inputModalResolve = null;
      }
    });
  }
  
  const inputModalValue = document.getElementById('inputModalValue');
  if (inputModalValue) {
    inputModalValue.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const inputModalConfirmBtn = document.getElementById('inputModalConfirmBtn');
        if (inputModalConfirmBtn) {
          inputModalConfirmBtn.click();
        }
      }
    });
  }
  
  // 学习和复习按钮事件监听器
  const learnBtn = document.getElementById('learnBtn');
  if (learnBtn) {
    learnBtn.addEventListener('click', startLearn);
  }
  
  const reviewBtn = document.getElementById('reviewBtn');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', startReview);
  }
  
  const createWordbookBtn = document.getElementById('createWordbookBtn');
  if (createWordbookBtn) {
    createWordbookBtn.addEventListener('click', showCreateWordbookModal);
  }
  
  // 标签页按钮事件监听器
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentOverviewTab = btn.dataset.tab;
      updateTabButtons();
      await loadOverviewContent();
    });
  });
  
  // 返回按钮事件监听器
  const learnBackBtn = document.getElementById('learnBackBtn');
  if (learnBackBtn) {
    learnBackBtn.addEventListener('click', () => showPage('homePage'));
  }
  
  const reviewBackBtn = document.getElementById('reviewBackBtn');
  if (reviewBackBtn) {
    reviewBackBtn.addEventListener('click', () => showPage('homePage'));
  }
  
  const overviewBackBtn = document.getElementById('overviewBackBtn');
  if (overviewBackBtn) {
    overviewBackBtn.addEventListener('click', () => showPage('homePage'));
  }
  
  // 创建单词书模态框事件监听器
  const closeCreateWordbookModalBtn = document.getElementById('closeCreateWordbookModalBtn');
  if (closeCreateWordbookModalBtn) {
    closeCreateWordbookModalBtn.addEventListener('click', hideCreateWordbookModal);
  }
  
  const createWordbookCancelBtn = document.getElementById('createWordbookCancelBtn');
  if (createWordbookCancelBtn) {
    createWordbookCancelBtn.addEventListener('click', hideCreateWordbookModal);
  }
  
  const createWordbookConfirmBtn = document.getElementById('createWordbookConfirmBtn');
  if (createWordbookConfirmBtn) {
    createWordbookConfirmBtn.addEventListener('click', createWordbook);
  }
  
  const importWordBtn = document.getElementById('importWordBtn');
  if (importWordBtn) {
    importWordBtn.addEventListener('click', () => importDocument('word'));
  }
  
  const importPdfBtn = document.getElementById('importPdfBtn');
  if (importPdfBtn) {
    importPdfBtn.addEventListener('click', () => importDocument('pdf'));
  }
  
  const addManualWordBtn = document.getElementById('addManualWordBtn');
  if (addManualWordBtn) {
    addManualWordBtn.addEventListener('click', addManualWord);
  }
  
  // 主题切换事件监听器
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enableTimeBased = document.getElementById('enableTimeBasedTheme');
      if (enableTimeBased && enableTimeBased.checked) {
        return;
      }
      
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const theme = btn.dataset.theme;
      document.body.classList.remove('light-theme', 'dark-theme', 'custom-theme');
      
      if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        const backgroundImageSelector = document.getElementById('backgroundImageSelector');
        if (backgroundImageSelector) {
          backgroundImageSelector.style.display = 'block';
        }
        await loadBackgroundImages('night');
      } else if (theme === 'light') {
        document.body.classList.add('light-theme');
        const backgroundImageSelector = document.getElementById('backgroundImageSelector');
        if (backgroundImageSelector) {
          backgroundImageSelector.style.display = 'block';
        }
        await loadBackgroundImages('light');
      } else if (theme === 'custom') {
        document.body.classList.add('custom-theme');
        const backgroundImageSelector = document.getElementById('backgroundImageSelector');
        if (backgroundImageSelector) {
          backgroundImageSelector.style.display = 'none';
        }
      }
      
      const customThemeSection = document.getElementById('customThemeSection');
      if (customThemeSection) {
        customThemeSection.style.display = theme === 'custom' ? 'block' : 'none';
      }
      
      saveThemeSettings(theme);
      updateBlurEffect();
    });
  });
  
  // 背景图片选择事件监听器
  const bgImageInput = document.getElementById('bgImageInput');
  if (bgImageInput) {
    bgImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const backgroundLayer = document.getElementById('backgroundLayer');
          if (backgroundLayer) {
            backgroundLayer.style.background = `url(${event.target.result})`;
            backgroundLayer.style.backgroundSize = 'cover';
            backgroundLayer.style.backgroundPosition = 'center';
            backgroundLayer.style.backgroundRepeat = 'no-repeat';
            applyBlurSettings();
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // 毛玻璃效果开关事件监听器
  const enableBlurEffect = document.getElementById('enableBlurEffect');
  if (enableBlurEffect) {
    enableBlurEffect.addEventListener('change', (e) => {
      const blurIntensitySection = document.getElementById('blurIntensitySection');
      if (blurIntensitySection) {
        blurIntensitySection.style.display = e.target.checked ? 'block' : 'none';
      }
      applyBlurSettings(); // 实时应用毛玻璃效果
      updateBlurEffect(); // 更新背景模糊效果
    });
  }
  
  // 基于时间的主题切换事件监听器
  const enableTimeBasedTheme = document.getElementById('enableTimeBasedTheme');
  if (enableTimeBasedTheme) {
    enableTimeBasedTheme.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('enableTimeBasedTheme', enabled);
      
      if (enabled) {
        startTimeBasedTheme();
      } else {
        stopTimeBasedTheme();
      }
    });
  }
  
  // 模态框点击外部关闭事件监听器
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

function updateBlurEffect() {
  // 检查必要元素是否存在
  const backgroundLayer = document.getElementById('backgroundLayer');
  const enableBlur = document.getElementById('enableBlurEffect');
  const backgroundBlurInput = document.getElementById('backgroundBlurIntensity');
  
  if (enableBlur && backgroundLayer) {
    // 获取当前滑块的实时值
    const blurIntensity = backgroundBlurInput ? parseInt(backgroundBlurInput.value) || 0 : (blurSettings?.background_blur || 0);
    if (enableBlur.checked) {
      backgroundLayer.style.filter = `blur(${blurIntensity}px)`;
      backgroundLayer.style.webkitFilter = `blur(${blurIntensity}px)`;
    } else {
      backgroundLayer.style.filter = 'none';
      backgroundLayer.style.webkitFilter = 'none';
    }
  }
  
  try {
    // 尝试应用毛玻璃效果，如果失败则忽略
    applyBlurSettings();
  } catch (error) {
    console.error('应用毛玻璃效果失败:', error);
  }
  
  // 保存毛玻璃设置
  if (enableBlur) {
    localStorage.setItem('blurSettings', JSON.stringify({
      enabled: enableBlur.checked,
      intensity: backgroundBlurInput ? parseInt(backgroundBlurInput.value) || 0 : (blurSettings?.background_blur || 0)
    }));
  }
}

function loadBackgroundBlurSettings() {
  const savedSettings = localStorage.getItem('blurSettings');
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      const enableBlur = document.getElementById('enableBlurEffect');
      if (enableBlur) {
        enableBlur.checked = settings.enabled || false;
        const blurIntensitySection = document.getElementById('blurIntensitySection');
        if (blurIntensitySection) {
          blurIntensitySection.style.display = settings.enabled ? 'block' : 'none';
        }
      }
    } catch (error) {
      console.error('加载毛玻璃设置失败:', error);
      const enableBlur = document.getElementById('enableBlurEffect');
      if (enableBlur) {
        enableBlur.checked = false;
        const blurIntensitySection = document.getElementById('blurIntensitySection');
        if (blurIntensitySection) {
          blurIntensitySection.style.display = 'none';
        }
      }
    }
  }
}

function loadThemeSettings() {
  const savedTheme = localStorage.getItem('theme');
  const enableTimeBased = localStorage.getItem('enableTimeBasedTheme') === 'true';
  const themeBtns = document.querySelectorAll('.theme-btn');
  
  document.getElementById('enableTimeBasedTheme').checked = enableTimeBased;
  
  if (enableTimeBased) {
    startTimeBasedTheme();
  } else {
    stopTimeBasedTheme();
    
    if (savedTheme) {
      themeBtns.forEach(btn => {
        if (btn.dataset.theme === savedTheme) {
          btn.click();
        }
      });
    } else {
      const lightBtn = Array.from(themeBtns).find(btn => btn.dataset.theme === 'light');
      if (lightBtn) {
        lightBtn.click();
      }
    }
  }
}

let timeBasedThemeInterval = null;

async function updateTimeBasedTheme() {
  const now = new Date();
  const hours = now.getHours();
  const isNight = hours >= 18 || hours < 6;
  
  const theme = isNight ? 'dark' : 'light';
  
  document.body.classList.remove('light-theme', 'dark-theme', 'custom-theme');
  
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    document.getElementById('backgroundImageSelector').style.display = 'block';
    await loadBackgroundImages('night');
  } else if (theme === 'light') {
    document.body.classList.add('light-theme');
    document.getElementById('backgroundImageSelector').style.display = 'block';
    await loadBackgroundImages('light');
  }
  
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.theme === theme) {
      btn.classList.add('active');
    }
  });
  
  document.getElementById('customThemeSection').style.display = 'none';
}

function startTimeBasedTheme() {
  if (timeBasedThemeInterval) {
    clearInterval(timeBasedThemeInterval);
  }
  
  updateTimeBasedTheme();
  timeBasedThemeInterval = setInterval(updateTimeBasedTheme, 60000);
}

function stopTimeBasedTheme() {
  if (timeBasedThemeInterval) {
    clearInterval(timeBasedThemeInterval);
    timeBasedThemeInterval = null;
  }
}

async function loadBackgroundImages(theme) {
  const backgroundImages = document.getElementById('backgroundImages');
  if (!backgroundImages) return;
  
  backgroundImages.innerHTML = '';
  
  const imageNames = api.getBackgroundImages(theme);
  
  if (imageNames.length === 0) {
    backgroundImages.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">暂无背景图片</div>';
    return;
  }
  
  const savedBackground = localStorage.getItem(`background_${theme}`);
  const defaultBackground = savedBackground || imageNames[0];
  
  const backgroundLayer = document.getElementById('backgroundLayer');
  const backgroundUrl = api.getBackgroundUrl(theme, defaultBackground);
  backgroundLayer.style.background = `url(${backgroundUrl})`;
  backgroundLayer.style.backgroundSize = 'cover';
  backgroundLayer.style.backgroundPosition = 'center';
  backgroundLayer.style.backgroundRepeat = 'no-repeat';
  
  imageNames.forEach(async (imageName, index) => {
    const item = document.createElement('div');
    item.className = 'background-item' + (defaultBackground === imageName ? ' active' : '');
    item.dataset.image = imageName;
    
    const img = document.createElement('img');
    const imageUrl = api.getBackgroundUrl(theme, imageName);
    img.src = imageUrl;
    img.alt = imageName;
    
    const checkMark = document.createElement('div');
    checkMark.className = 'check-mark';
    checkMark.textContent = '✓';
    
    item.appendChild(img);
    item.appendChild(checkMark);
    
    item.addEventListener('click', async () => {
      document.querySelectorAll('.background-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const backgroundLayer = document.getElementById('backgroundLayer');
      const backgroundUrl = api.getBackgroundUrl(theme, imageName);
      backgroundLayer.style.background = `url(${backgroundUrl})`;
      backgroundLayer.style.backgroundSize = 'cover';
      backgroundLayer.style.backgroundPosition = 'center';
      backgroundLayer.style.backgroundRepeat = 'no-repeat';
      
      localStorage.setItem(`background_${theme}`, imageName);
      updateBlurEffect();
    });
    
    backgroundImages.appendChild(item);
  });
}

function saveThemeSettings(theme) {
  localStorage.setItem('theme', theme);
}

let manualWords = [];

function showCreateWordbookModal() {
  document.getElementById('createWordbookModal').classList.add('active');
  document.getElementById('newWordbookName').value = '';
  manualWords = [];
  document.getElementById('manualWordList').innerHTML = '';
  document.getElementById('manualInputSection').style.display = 'block';
  document.getElementById('importProgressSection').style.display = 'none';
}

function hideCreateWordbookModal() {
  document.getElementById('createWordbookModal').classList.remove('active');
}

async function importDocument(type) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'pdf' ? '.pdf' : '.docx,.doc';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('未选择文件'));
        return;
      }

      document.getElementById('manualInputSection').style.display = 'none';
      document.getElementById('importProgressSection').style.display = 'block';
      document.getElementById('importProgressText').textContent = '正在读取文件...';
      document.getElementById('importProgressBar').style.width = '10%';

      try {
        const arrayBuffer = await file.arrayBuffer();
        document.getElementById('importProgressText').textContent = '正在解析文档...';
        document.getElementById('importProgressBar').style.width = '30%';

        let text = '';

        if (type === 'pdf') {
          const pdfjsLib = window.pdfjsLib;
          if (pdfjsLib) {
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const strings = content.items.map(item => item.str);
              fullText += strings.join(' ') + '\n';
            }
            text = fullText;
          }
        } else {
          const mammoth = window.mammoth;
          if (mammoth) {
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
          }
        }

        document.getElementById('importProgressBar').style.width = '60%';

        const lines = text.split('\n').filter(line => line.trim());
        const words = [];

        for (const line of lines) {
          const parts = line.split(/[,，、\t]+/).map(p => p.trim()).filter(p => p);
          if (parts.length >= 2) {
            words.push({
              english: parts[0],
              chinese: parts.slice(1).join(', ')
            });
          }
        }

        document.getElementById('importProgressText').textContent = `找到 ${words.length} 个单词`;
        document.getElementById('importProgressBar').style.width = '100%';

        manualWords = words;
        displayManualWords();

        document.getElementById('importProgressText').textContent = '导入完成！';

        setTimeout(() => {
          document.getElementById('importProgressSection').style.display = 'none';
          document.getElementById('manualInputSection').style.display = 'block';
        }, 1000);

        resolve(words);

      } catch (error) {
        document.getElementById('importProgressText').textContent = `导入失败: ${error.message}`;
        document.getElementById('importProgressBar').style.width = '0%';
        setTimeout(() => {
          document.getElementById('importProgressSection').style.display = 'none';
          document.getElementById('manualInputSection').style.display = 'block';
        }, 2000);
        reject(error);
      }
    };

    input.click();
  });
}

async function fetchPhonetic(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if (data && data[0]) {
      const phonetics = data[0].phonetics || [];
      let uk = '', us = '';

      for (const p of phonetics) {
        if (p.text && !uk && p.text.includes('/')) {
          if (p.text.includes('UK') || p.text.toLowerCase().includes('br')) {
            uk = p.text.match(/\/.*?\//g)?.[0] || '';
          }
        }
        if (p.text && !us && p.text.includes('/')) {
          if (p.text.includes('US') || p.text.toLowerCase().includes('am')) {
            us = p.text.match(/\/.*?\//g)?.[0] || '';
          }
        }
      }

      if (!uk) {
        const ukPhonetic = phonetics.find(p => p.text?.includes('/') && (p.text.includes('UK') || !p.text.includes('US')));
        if (ukPhonetic) {
          uk = ukPhonetic.text?.match(/\/.*?\//g)?.[0] || '';
        }
      }
      if (!us) {
        const usPhonetic = phonetics.find(p => p.text?.includes('US') || p.text?.toLowerCase().includes('am'));
        if (usPhonetic) {
          us = usPhonetic.text?.match(/\/.*?\//g)?.[0] || '';
        }
      }

      return { uk, us };
    }
    return { uk: '', us: '' };
  } catch (error) {
    console.error('获取音标失败:', error);
    return { uk: '', us: '' };
  }
}

function addManualWord() {
  const english = document.getElementById('manualEnglish').value.trim();
  const chinese = document.getElementById('manualChinese').value.trim();
  
  if (!english || !chinese) {
    alert('请输入英文和中文');
    return;
  }
  
  manualWords.push({
    english,
    chinese,
    phonetic_uk: '',
    phonetic_us: ''
  });
  
  document.getElementById('manualEnglish').value = '';
  document.getElementById('manualChinese').value = '';
  
  displayManualWords();
}

function displayManualWords() {
  const container = document.getElementById('manualWordList');
  container.innerHTML = manualWords.map((word, index) => `
    <div class="manual-word-item">
      <div class="word-info">
        <div class="english">${word.english}</div>
        <div class="chinese">${word.chinese}</div>
      </div>
      <button class="delete-btn" onclick="removeManualWord(${index})">×</button>
    </div>
  `).join('');
}

function removeManualWord(index) {
  manualWords.splice(index, 1);
  displayManualWords();
}

async function createWordbook() {
  const bookName = document.getElementById('newWordbookName').value.trim();
  
  if (!bookName) {
    alert('请输入单词书名称');
    return;
  }
  
  if (manualWords.length === 0) {
    alert('请添加至少一个单词');
    return;
  }
  
  try {
    document.getElementById('createWordbookConfirmBtn').textContent = '创建中...';
    document.getElementById('createWordbookConfirmBtn').disabled = true;
    
    api.createCustomWordbook(bookName, manualWords);
    
    alert('单词书创建成功！');
    hideCreateWordbookModal();
    loadWordbooks();
  } catch (error) {
    alert('创建失败: ' + error.message);
  } finally {
    document.getElementById('createWordbookConfirmBtn').textContent = '创建';
    document.getElementById('createWordbookConfirmBtn').disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await api.init();
  loadWordbooks();
  initEventListeners();
  await loadBlurSettings();
  await loadFontColorSettings();
  initColorPickerListeners();
  loadThemeSettings();
  loadBackgroundBlurSettings();
  updateBlurEffect();
  applyFontColorSettings();
  initFullscreenMode();

  const savedCurrentBookId = localStorage.getItem('current_wordbook_id');
  if (savedCurrentBookId) {
    const wordbooks = api.getWordbooks();
    const savedBook = wordbooks.find(b => b.book_id === parseInt(savedCurrentBookId));
    if (savedBook) {
      currentWordbook = {
        book_id: savedBook.book_id,
        book_name: savedBook.book_name
      };
      updateCurrentWordbookDisplay(savedBook);
    }
  } else {
    const wordbooks = api.getWordbooks();
    if (wordbooks.length > 0) {
      const defaultBook = wordbooks[0];
      currentWordbook = {
        book_id: defaultBook.book_id,
        book_name: defaultBook.book_name
      };
      localStorage.setItem('current_wordbook_id', defaultBook.book_id.toString());
      updateCurrentWordbookDisplay(defaultBook);
    }
  }
});

function initFullscreenMode() {
  const enableFullscreenCheckbox = document.getElementById('enableFullscreen');

  if (enableFullscreenCheckbox) {
    const savedFullscreen = localStorage.getItem('enableFullscreen') === 'true';
    enableFullscreenCheckbox.checked = savedFullscreen;

    enableFullscreenCheckbox.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      localStorage.setItem('enableFullscreen', isEnabled);

      if (isEnabled) {
        document.getElementById('app').classList.add('fullscreen-mode');
      } else {
        document.getElementById('app').classList.remove('fullscreen-mode');
      }
    });

    if (savedFullscreen) {
      document.getElementById('app').classList.add('fullscreen-mode');
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  if (e.key === 'Escape' && document.fullscreenElement) {
    const enableFullscreen = localStorage.getItem('enableFullscreen') === 'true';
    if (!enableFullscreen) {
      document.exitFullscreen();
    }
  }
});
