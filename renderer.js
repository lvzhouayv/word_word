const { ipcRenderer } = require('electron');

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

async function loadWordbooks() {
  const wordbooks = await ipcRenderer.invoke('get-wordbooks');
  const select = document.getElementById('wordbookSelect');
  select.innerHTML = '<option value="">选择词书...</option>';
  
  wordbooks.forEach(book => {
    const option = document.createElement('option');
    option.value = book.book_id;
    option.textContent = `${book.book_name} (${book.mastered_count}/${book.total_count})`;
    select.appendChild(option);
  });
}

async function loadReviewSettings() {
  try {
    reviewSettings = await ipcRenderer.invoke('get-review-settings');
    
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
  
  await ipcRenderer.invoke('update-review-settings', errorDaysMap, useCustomSettings, enableTodayReview);
  await loadReviewSettings();
  
  alert('复习设置已保存');
}

async function loadBlurSettings() {
  try {
    blurSettings = await ipcRenderer.invoke('get-blur-settings');
    
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

function applyBlurSettings() {
  const root = document.documentElement;
  const settings = blurSettings || {
    button_blur: 20,
    card_blur: 20,
    search_blur: 20,
    other_blur: 20,
    background_blur: 0
  };
  root.style.setProperty('--button-blur', `${settings.button_blur || 20}px`);
  root.style.setProperty('--card-blur', `${settings.card_blur || 20}px`);
  root.style.setProperty('--search-blur', `${settings.search_blur || 20}px`);
  root.style.setProperty('--other-blur', `${settings.other_blur || 20}px`);
  root.style.setProperty('--background-blur', `${settings.background_blur || 0}px`);
}

async function saveBlurSettings() {
  const buttonBlur = parseInt(document.getElementById('buttonBlurIntensity').value) || 20;
  const cardBlur = parseInt(document.getElementById('cardBlurIntensity').value) || 20;
  const searchBlur = parseInt(document.getElementById('searchBlurIntensity').value) || 20;
  const otherBlur = parseInt(document.getElementById('otherBlurIntensity').value) || 20;
  const backgroundBlur = parseInt(document.getElementById('backgroundBlurIntensity').value) || 0;
  
  await ipcRenderer.invoke('update-blur-settings', buttonBlur, cardBlur, searchBlur, otherBlur, backgroundBlur);
  await loadBlurSettings();
  
  alert('毛玻璃设置已保存');
}

function selectWordbook(bookId) {
  if (!bookId) {
    currentWordbook = null;
    return;
  }
  
  const wordbooks = document.getElementById('wordbookSelect').options;
  for (let i = 0; i < wordbooks.length; i++) {
    if (wordbooks[i].value == bookId) {
      currentWordbook = {
        book_id: parseInt(bookId),
        book_name: wordbooks[i].text.split(' (')[0]
      };
      break;
    }
  }
  console.log('当前词书:', currentWordbook);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

function showSettingsModal() {
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
  
  const count = await showInputModal('学习设置', '请输入今日学习单词数量（建议20-50个）:', '20');
  if (!count || isNaN(count)) return;
  
  const learnCount = parseInt(count);
  const words = await ipcRenderer.invoke('get-learn-words', currentWordbook.book_id, learnCount);
  
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
  
  const words = await ipcRenderer.invoke('get-review-words', currentWordbook.book_id);
  
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
    
    const wordDetail = await ipcRenderer.invoke('get-word-detail', word.word_id);
    Object.assign(word, wordDetail);
    
    const progress = wordLearnProgress[word.word_id];
    
    wordLearnProgress[word.word_id].stage1 = true;
    
    container.innerHTML = `
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
    const questionWordDetail = await ipcRenderer.invoke('get-word-detail', questionWord.word_id);
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
        <div class="word-card">
          <div class="definition" style="font-size: 28px; font-weight: bold; margin-bottom: 15px;">${questionWord.part_of_speech ? `${questionWord.part_of_speech} ${questionWord.chinese}` : questionWord.chinese}</div>
          <div class="options">
            ${englishOptions.map(opt => `
              <button class="option-btn" onclick="checkLearnAnswer('${opt}', '${questionWord.english}')">${opt}</button>
            `).join('')}
          </div>
          <div id="feedback" style="margin-top: 20px;"></div>
        </div>
      `;
    }
  } else if (currentLearnStage === 3) {
    if (dictationWordQueue.length === 0) {
      console.log('默写队列为空，已完成:', completedDictationWords, '总数:', totalDictationWords);
      if (completedDictationWords >= totalDictationWords && totalDictationWords > 0) {
        console.log('默写完成，结束学习');
        for (const word of currentLearnWords) {
          await ipcRenderer.invoke('mark-word-learned', word.word_id);
        }
        alert('学习完成！所有单词已进入复习阶段。');
        showPage('homePage');
        return;
      }
      
      await generateDictationWords();
      if (dictationWordQueue.length === 0) {
        console.log('无法生成默写队列，结束学习');
        for (const word of currentLearnWords) {
          await ipcRenderer.invoke('mark-word-learned', word.word_id);
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
    const dictationWordDetail = await ipcRenderer.invoke('get-word-detail', dictationWord.word_id);
    Object.assign(dictationWord, dictationWordDetail);
    
    container.innerHTML = `
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
  const allWords = await ipcRenderer.invoke('get-options', currentWordbook.book_id, currentWord.word_id);
  
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
  const allWords = await ipcRenderer.invoke('get-options', currentWordbook.book_id, currentWord.word_id);
  
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
      const selectedChinese = selected.replace(/^[a-z]+\.\s*/, '');
      const correctChinese = correct.replace(/^[a-z]+\.\s*/, '');
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
            await ipcRenderer.invoke('mark-word-learned', word.word_id);
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
  
  const wordDetail = await ipcRenderer.invoke('get-word-detail', word.word_id);
  Object.assign(word, wordDetail);
  
  container.innerHTML = `
    <div class="word-card">
      <div class="word">${word.english}</div>
      <div class="phonetic">${word.phonetic_uk || word.phonetic_us || ''}</div>
      <div class="audio-buttons">
        <button class="audio-btn" onclick="playAudio('${word.audio_uk_url}', 'uk', '${word.english}')">
          🇬🇧 英式发音
        </button>
        <button class="audio-btn" onclick="playAudio('${word.audio_us_url}', 'us', '${word.english}')">
          🇺🇸 美式发音
        </button>
      </div>
      <div class="definition">${word.chinese}</div>
      ${word.sentence ? `<div class="example">${word.sentence}</div>` : ''}
      <div class="action-buttons">
        <button class="submit-btn" onclick="reviewWord(false)">不记得</button>
        <button class="next-btn" onclick="reviewWord(true)">记得</button>
      </div>
      <div class="navigation-buttons" style="display: flex; justify-content: space-between; margin-top: 20px;">
        <button class="nav-btn" onclick="previousReviewWord()" ${currentReviewIndex === 0 ? 'disabled' : ''}>上一个</button>
        <button class="nav-btn" onclick="nextReviewWord()" ${currentReviewIndex === currentReviewWords.length - 1 ? 'disabled' : ''}>下一个</button>
      </div>
    </div>
  `;
}

async function reviewWord(remembered) {
  const word = currentReviewWords[currentReviewIndex];
  
  if (reviewSettings && reviewSettings.use_custom_settings === 1) {
    const errorCount = word.review_count || 0;
    await ipcRenderer.invoke('review-word-custom', word.word_id, remembered, errorCount);
  } else {
    await ipcRenderer.invoke('review-word', word.word_id, remembered);
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
  const stats = await ipcRenderer.invoke('get-stats', currentWordbook.book_id);
  
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
  const words = await ipcRenderer.invoke('get-today-learned-words', currentWordbook.book_id);
  
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
  const words = await ipcRenderer.invoke('get-today-review-words', currentWordbook.book_id);
  
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
  
  const words = await ipcRenderer.invoke('get-words', currentWordbook.book_id, search, status, sort);
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
  const words = await ipcRenderer.invoke('get-today-learned-words', currentWordbook.book_id);
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
  const words = await ipcRenderer.invoke('get-today-review-words', currentWordbook.book_id);
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
  const words = await ipcRenderer.invoke('get-learning-words', currentWordbook.book_id);
  
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
  const words = await ipcRenderer.invoke('get-learning-words', currentWordbook.book_id);
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
  
  await ipcRenderer.invoke('add-word', currentWordbook.book_id, english, chinese);
  hideAddWordModal();
  await loadWordbooks();
  filterWords();
}

function editWord(wordId) {
  const word = currentWordbook ? null : null;
  const words = document.querySelectorAll('.word-item');
  
  ipcRenderer.invoke('get-words', currentWordbook.book_id, '', 'all', 'alphabet').then(allWords => {
    const word = allWords.find(w => w.word_id === wordId);
    if (word) {
      document.getElementById('editWordId').value = word.word_id;
      document.getElementById('editWordEnglish').value = word.english;
      document.getElementById('editWordChinese').value = word.chinese;
      document.getElementById('editWordModal').classList.add('active');
    }
  });
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
  
  await ipcRenderer.invoke('update-word', wordId, english, chinese);
  hideEditWordModal();
  await loadWordbooks();
  filterWords();
}

async function deleteWord() {
  const wordId = parseInt(document.getElementById('editWordId').value);
  
  if (confirm('确定要删除这个单词吗？')) {
    await ipcRenderer.invoke('delete-word', wordId);
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
  document.getElementById('wordbookSelect').addEventListener('change', (e) => {
    selectWordbook(e.target.value);
  });
  
  const searchInput = document.getElementById('searchWordInput');
  const searchButton = document.getElementById('searchButton');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const keyword = e.target.value.trim();
    
    if (keyword === '') {
      document.getElementById('searchResults').style.display = 'none';
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const result = await ipcRenderer.invoke('search-word', keyword);
        displaySearchResults(result);
      } catch (error) {
        console.error('搜索单词失败:', error);
      }
    }, 300);
  });
  
  searchButton.addEventListener('click', async () => {
    const keyword = searchInput.value.trim();
    
    if (keyword === '') {
      document.getElementById('searchResults').style.display = 'none';
      return;
    }
    
    try {
      const result = await ipcRenderer.invoke('search-word', keyword);
      displaySearchResults(result);
    } catch (error) {
      console.error('搜索单词失败:', error);
    }
  });
  
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim() !== '') {
      document.getElementById('searchResults').style.display = 'block';
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      document.getElementById('searchResults').style.display = 'none';
    }
  });
  
  document.getElementById('settingsBtn').addEventListener('click', async () => {
    await loadReviewSettings();
    await loadBlurSettings();
    showSettingsModal();
  });
  document.getElementById('closeSettingsBtn').addEventListener('click', hideSettingsModal);
  
  document.getElementById('useCustomReviewSettings').addEventListener('change', (e) => {
    document.getElementById('customReviewSettings').style.display = e.target.checked ? 'block' : 'none';
  });
  
  document.getElementById('saveReviewSettingsBtn').addEventListener('click', saveReviewSettings);
  
  const buttonBlurInput = document.getElementById('buttonBlurIntensity');
  const cardBlurInput = document.getElementById('cardBlurIntensity');
  const searchBlurInput = document.getElementById('searchBlurIntensity');
  const otherBlurInput = document.getElementById('otherBlurIntensity');
  
  if (buttonBlurInput) {
    buttonBlurInput.addEventListener('input', (e) => {
      document.getElementById('buttonBlurValue').textContent = e.target.value;
    });
  }
  
  if (cardBlurInput) {
    cardBlurInput.addEventListener('input', (e) => {
      document.getElementById('cardBlurValue').textContent = e.target.value;
    });
  }
  
  if (searchBlurInput) {
    searchBlurInput.addEventListener('input', (e) => {
      document.getElementById('searchBlurValue').textContent = e.target.value;
    });
  }
  
  if (otherBlurInput) {
    otherBlurInput.addEventListener('input', (e) => {
      document.getElementById('otherBlurValue').textContent = e.target.value;
    });
  }
  
  const backgroundBlurInput = document.getElementById('backgroundBlurIntensity');
  if (backgroundBlurInput) {
    backgroundBlurInput.addEventListener('input', (e) => {
      document.getElementById('backgroundBlurValue').textContent = e.target.value;
    });
  }
  
  document.getElementById('saveBlurSettingsBtn').addEventListener('click', saveBlurSettings);
  
  document.getElementById('resetDatabaseBtn').addEventListener('click', async () => {
    if (confirm('确定要重置数据库吗？这将删除所有学习数据和自定义词书，并重新导入默认词书。')) {
      const result = await ipcRenderer.invoke('reset-database');
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
  
  document.getElementById('addWordBtn').addEventListener('click', showAddWordModal);
  document.getElementById('closeAddWordModalBtn').addEventListener('click', hideAddWordModal);
  document.getElementById('addWordCancelBtn').addEventListener('click', hideAddWordModal);
  document.getElementById('addWordConfirmBtn').addEventListener('click', addWord);
  
  document.getElementById('closeEditWordModalBtn').addEventListener('click', hideEditWordModal);
  document.getElementById('editWordCancelBtn').addEventListener('click', hideEditWordModal);
  document.getElementById('editWordConfirmBtn').addEventListener('click', saveWord);
  document.getElementById('editWordDeleteBtn').addEventListener('click', deleteWord);
  
  document.getElementById('closeWordDetailModalBtn').addEventListener('click', hideWordDetailModal);
  
  document.getElementById('closeInputModalBtn').addEventListener('click', () => {
    hideInputModal();
    if (inputModalResolve) {
      inputModalResolve(null);
      inputModalResolve = null;
    }
  });
  
  document.getElementById('inputModalCancelBtn').addEventListener('click', () => {
    hideInputModal();
    if (inputModalResolve) {
      inputModalResolve(null);
      inputModalResolve = null;
    }
  });
  
  document.getElementById('inputModalConfirmBtn').addEventListener('click', () => {
    const value = document.getElementById('inputModalValue').value;
    hideInputModal();
    if (inputModalResolve) {
      inputModalResolve(value);
      inputModalResolve = null;
    }
  });
  
  document.getElementById('inputModalValue').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('inputModalConfirmBtn').click();
    }
  });
  
  document.getElementById('learnBtn').addEventListener('click', startLearn);
  document.getElementById('reviewBtn').addEventListener('click', startReview);
  document.getElementById('overviewBtn').addEventListener('click', showOverview);
  document.getElementById('createWordbookBtn').addEventListener('click', showCreateWordbookModal);
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentOverviewTab = btn.dataset.tab;
      updateTabButtons();
      await loadOverviewContent();
    });
  });
  
  document.getElementById('learnBackBtn').addEventListener('click', () => showPage('homePage'));
  document.getElementById('reviewBackBtn').addEventListener('click', () => showPage('homePage'));
  document.getElementById('overviewBackBtn').addEventListener('click', () => showPage('homePage'));
  
  document.getElementById('closeCreateWordbookModalBtn').addEventListener('click', hideCreateWordbookModal);
  document.getElementById('createWordbookCancelBtn').addEventListener('click', hideCreateWordbookModal);
  document.getElementById('createWordbookConfirmBtn').addEventListener('click', createWordbook);
  document.getElementById('importWordBtn').addEventListener('click', () => importDocument('word'));
  document.getElementById('importPdfBtn').addEventListener('click', () => importDocument('pdf'));
  document.getElementById('addManualWordBtn').addEventListener('click', addManualWord);
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enableTimeBased = document.getElementById('enableTimeBasedTheme').checked;
      if (enableTimeBased) {
        return;
      }
      
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const theme = btn.dataset.theme;
      document.body.classList.remove('light-theme', 'dark-theme', 'custom-theme');
      
      if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('backgroundImageSelector').style.display = 'block';
        await loadBackgroundImages('night');
      } else if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('backgroundImageSelector').style.display = 'block';
        await loadBackgroundImages('light');
      } else if (theme === 'custom') {
        document.body.classList.add('custom-theme');
        document.getElementById('backgroundImageSelector').style.display = 'none';
      }
      
      document.getElementById('customThemeSection').style.display = 
        theme === 'custom' ? 'block' : 'none';
      
      saveThemeSettings(theme);
      updateBlurEffect();
    });
  });
  
  document.getElementById('bgImageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const backgroundLayer = document.getElementById('backgroundLayer');
        backgroundLayer.style.background = `url(${event.target.result})`;
        backgroundLayer.style.backgroundSize = 'cover';
        backgroundLayer.style.backgroundPosition = 'center';
        backgroundLayer.style.backgroundRepeat = 'no-repeat';
        applyBlurSettings();
      };
      reader.readAsDataURL(file);
    }
  });
  
  document.getElementById('enableBlurEffect').addEventListener('change', (e) => {
    document.getElementById('blurIntensitySection').style.display = e.target.checked ? 'block' : 'none';
    applyBlurSettings();
  });
  
  document.getElementById('enableTimeBasedTheme').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    localStorage.setItem('enableTimeBasedTheme', enabled);
    
    if (enabled) {
      startTimeBasedTheme();
    } else {
      stopTimeBasedTheme();
    }
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

function updateBlurEffect() {
  const backgroundLayer = document.getElementById('backgroundLayer');
  const enableBlur = document.getElementById('enableBlurEffect');
  
  if (enableBlur && backgroundLayer) {
    const blurIntensity = blurSettings ? blurSettings.background_blur : 0;
    if (enableBlur.checked) {
      backgroundLayer.style.filter = `blur(${blurIntensity}px)`;
      backgroundLayer.style.webkitFilter = `blur(${blurIntensity}px)`;
    } else {
      backgroundLayer.style.filter = 'none';
      backgroundLayer.style.webkitFilter = 'none';
    }
  }
  
  applyBlurSettings();
  
  localStorage.setItem('blurSettings', JSON.stringify({
    enabled: enableBlur ? enableBlur.checked : false,
    intensity: blurSettings ? blurSettings.background_blur : 0
  }));
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
  
  const imageNames = await ipcRenderer.invoke('get-background-images', theme);
  
  if (imageNames.length === 0) {
    backgroundImages.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">暂无背景图片</div>';
    return;
  }
  
  const savedBackground = localStorage.getItem(`background_${theme}`);
  const defaultBackground = savedBackground || imageNames[0];
  
  const backgroundLayer = document.getElementById('backgroundLayer');
  const backgroundUrl = await ipcRenderer.invoke('get-background-url', theme, defaultBackground);
  backgroundLayer.style.background = `url(${backgroundUrl})`;
  backgroundLayer.style.backgroundSize = 'cover';
  backgroundLayer.style.backgroundPosition = 'center';
  backgroundLayer.style.backgroundRepeat = 'no-repeat';
  
  imageNames.forEach(async (imageName, index) => {
    const item = document.createElement('div');
    item.className = 'background-item' + (defaultBackground === imageName ? ' active' : '');
    item.dataset.image = imageName;
    
    const img = document.createElement('img');
    const imageUrl = await ipcRenderer.invoke('get-background-url', theme, imageName);
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
      const backgroundUrl = await ipcRenderer.invoke('get-background-url', theme, imageName);
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
  document.getElementById('manualInputSection').style.display = 'none';
  document.getElementById('importProgressSection').style.display = 'block';
  document.getElementById('importProgressText').textContent = '正在选择文件...';
  document.getElementById('importProgressBar').style.width = '10%';
  
  try {
    const result = await ipcRenderer.invoke('parse-document', type);
    
    document.getElementById('importProgressText').textContent = '正在解析文档...';
    document.getElementById('importProgressBar').style.width = '30%';
    
    document.getElementById('importProgressText').textContent = `找到 ${result.length} 个单词`;
    document.getElementById('importProgressBar').style.width = '60%';
    
    manualWords = result;
    displayManualWords();
    
    document.getElementById('importProgressText').textContent = '导入完成！';
    document.getElementById('importProgressBar').style.width = '100%';
    
    setTimeout(() => {
      document.getElementById('importProgressSection').style.display = 'none';
      document.getElementById('manualInputSection').style.display = 'block';
    }, 1000);
    
  } catch (error) {
    document.getElementById('importProgressText').textContent = `导入失败: ${error.message}`;
    document.getElementById('importProgressBar').style.width = '0%';
    setTimeout(() => {
      document.getElementById('importProgressSection').style.display = 'none';
      document.getElementById('manualInputSection').style.display = 'block';
    }, 2000);
  }
}

async function fetchPhonetic(word) {
  try {
    const result = await ipcRenderer.invoke('fetch-phonetic', word);
    return result;
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
    
    await ipcRenderer.invoke('create-custom-wordbook', bookName, manualWords);
    
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
  loadWordbooks();
  initEventListeners();
  await loadBlurSettings();
  loadThemeSettings();
  loadBackgroundBlurSettings();
  updateBlurEffect();
});
