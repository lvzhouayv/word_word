const API = {
  init() {
    this.initDatabase();
    this.loadData();
  },

  initDatabase() {
    if (!localStorage.getItem('wordword_initialized')) {
      localStorage.setItem('wordbooks', JSON.stringify([]));
      localStorage.setItem('words', JSON.stringify([]));
      localStorage.setItem('review_settings', JSON.stringify({
        error_days_map: '{"1":1,"2":1,"3":2,"4":3","5":3}',
        use_custom_settings: 0
      }));
      localStorage.setItem('blur_settings', JSON.stringify({
        button_blur: 20,
        card_blur: 20,
        search_blur: 20,
        other_blur: 20,
        background_blur: 0
      }));
      localStorage.setItem('font_color_settings', JSON.stringify({
        primary_color: '#4a90e2',
        text_color: '#333333'
      }));
      localStorage.setItem('learn_settings', JSON.stringify({ count: 10 }));
      localStorage.setItem('theme_settings', JSON.stringify({
        theme: 'light',
        background_image: ''
      }));
      localStorage.setItem('music_favorites', JSON.stringify([]));
      localStorage.setItem('music_history', JSON.stringify([]));
      localStorage.setItem('wordword_initialized', 'true');
    }
  },

  loadData() {
    this.wordbooks = JSON.parse(localStorage.getItem('wordbooks') || '[]');
    this.words = JSON.parse(localStorage.getItem('words') || '[]');
    this.reviewSettings = JSON.parse(localStorage.getItem('review_settings') || '{}');
    this.blurSettings = JSON.parse(localStorage.getItem('blur_settings') || '{}');
    this.fontColorSettings = JSON.parse(localStorage.getItem('font_color_settings') || '{}');
    this.learnSettings = JSON.parse(localStorage.getItem('learn_settings') || '{}');
    this.themeSettings = JSON.parse(localStorage.getItem('theme_settings') || '{}');
    this.musicFavorites = JSON.parse(localStorage.getItem('music_favorites') || '[]');
    this.musicHistory = JSON.parse(localStorage.getItem('music_history') || '[]');
  },

  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  getWordbooks() {
    return this.wordbooks;
  },

  addWordbook(name) {
    const id = Date.now();
    const wordbook = {
      book_id: id,
      name: name,
      word_count: 0,
      created_at: id
    };
    this.wordbooks.push(wordbook);
    this.save('wordbooks', this.wordbooks);
    return wordbook;
  },

  deleteWordbook(bookId) {
    this.wordbooks = this.wordbooks.filter(w => w.book_id !== bookId);
    this.words = this.words.filter(w => w.book_id !== bookId);
    this.save('wordbooks', this.wordbooks);
    this.save('words', this.words);
  },

  getWords(bookId, search = '', status = 'all', sort = 'alphabet') {
    let result = this.words.filter(w => w.book_id === bookId);

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(w =>
        w.english.toLowerCase().includes(s) ||
        w.chinese.includes(s)
      );
    }

    if (status !== 'all') {
      result = result.filter(w => w.mastery_status === parseInt(status));
    }

    if (sort === 'alphabet') {
      result.sort((a, b) => a.english.localeCompare(b.english));
    } else if (sort === 'status') {
      result.sort((a, b) => a.mastery_status - b.mastery_status);
    }

    return result;
  },

  addWord(bookId, english, chinese) {
    const id = Date.now();
    const word = {
      word_id: id,
      book_id: bookId,
      english: english,
      chinese: chinese,
      mastery_status: 0,
      review_count: 0,
      last_reviewed: null,
      created_at: id,
      learned_today: false,
      learned_date: null
    };
    this.words.push(word);
    this.save('words', this.words);
    this.updateWordbookCount(bookId);
    return word;
  },

  updateWord(wordId, english, chinese) {
    const word = this.words.find(w => w.word_id === wordId);
    if (word) {
      word.english = english;
      word.chinese = chinese;
      this.save('words', this.words);
    }
  },

  deleteWord(wordId) {
    const word = this.words.find(w => w.word_id === wordId);
    if (word) {
      this.words = this.words.filter(w => w.word_id !== wordId);
      this.save('words', this.words);
      this.updateWordbookCount(word.book_id);
    }
  },

  getWordDetail(wordId) {
    return this.words.find(w => w.word_id === wordId);
  },

  updateWordbookCount(bookId) {
    const wordbook = this.wordbooks.find(w => w.book_id === bookId);
    if (wordbook) {
      wordbook.word_count = this.words.filter(w => w.book_id === bookId).length;
      this.save('wordbooks', this.wordbooks);
    }
  },

  getStats(bookId) {
    const words = this.words.filter(w => w.book_id === bookId);
    return {
      total: words.length,
      new: words.filter(w => w.mastery_status === 0).length,
      learning: words.filter(w => w.mastery_status === 1).length,
      mastered: words.filter(w => w.mastery_status === 2).length
    };
  },

  getReviewSettings() {
    return this.reviewSettings;
  },

  updateReviewSettings(errorDaysMap, useCustomSettings, enableTodayReview) {
    this.reviewSettings = {
      error_days_map: errorDaysMap,
      use_custom_settings: useCustomSettings ? 1 : 0,
      enable_today_review: enableTodayReview ? 1 : 0
    };
    this.save('review_settings', this.reviewSettings);
  },

  getBlurSettings() {
    return this.blurSettings;
  },

  updateBlurSettings(buttonBlur, cardBlur, searchBlur, otherBlur, backgroundBlur) {
    this.blurSettings = {
      button_blur: buttonBlur,
      card_blur: cardBlur,
      search_blur: searchBlur,
      other_blur: otherBlur,
      background_blur: backgroundBlur
    };
    this.save('blur_settings', this.blurSettings);
  },

  getThemeSettings() {
    return this.fontColorSettings;
  },

  saveThemeSettings(settings) {
    this.fontColorSettings = settings;
    this.save('font_color_settings', this.fontColorSettings);
  },

  getLearnSettings() {
    return this.learnSettings;
  },

  updateLearnSettings(count) {
    this.learnSettings = { count };
    this.save('learn_settings', this.learnSettings);
  },

  getLearnWords(bookId, count) {
    const words = this.words
      .filter(w => w.book_id === bookId && w.mastery_status === 0)
      .slice(0, count);
    return words;
  },

  getReviewWords(bookId) {
    const words = this.words
      .filter(w => w.book_id === bookId && w.mastery_status > 0);
    return words;
  },

  markWordLearned(wordId) {
    const word = this.words.find(w => w.word_id === wordId);
    if (word) {
      word.mastery_status = 1;
      word.learned_today = true;
      word.learned_date = new Date().toDateString();
      this.save('words', this.words);
    }
  },

  reviewWord(wordId, remembered) {
    const word = this.words.find(w => w.word_id === wordId);
    if (word) {
      word.review_count = (word.review_count || 0) + 1;
      if (remembered) {
        word.mastery_status = 2;
      }
      word.last_reviewed = Date.now();
      this.save('words', this.words);
    }
  },

  reviewWordCustom(wordId, remembered, errorCount) {
    const word = this.words.find(w => w.word_id === wordId);
    if (word) {
      word.review_count = errorCount + 1;
      if (remembered) {
        word.mastery_status = 2;
      }
      word.last_reviewed = Date.now();
      this.save('words', this.words);
    }
  },

  getTodayLearnedWords(bookId) {
    const today = new Date().toDateString();
    return this.words.filter(w =>
      w.book_id === bookId &&
      w.learned_today &&
      w.learned_date === today
    );
  },

  getTodayReviewWords(bookId) {
    return this.words.filter(w => w.book_id === bookId && w.mastery_status > 0);
  },

  getLearningWords(bookId) {
    return this.words.filter(w => w.book_id === bookId && w.mastery_status === 1);
  },

  getOptions(bookId, excludeWordId) {
    return this.words
      .filter(w => w.book_id === bookId && w.word_id !== excludeWordId)
      .slice(0, 10);
  },

  resetDatabase() {
    localStorage.clear();
    this.initDatabase();
    this.loadData();
  },

  getTheme() {
    return this.themeSettings;
  },

  setTheme(theme, backgroundImage) {
    this.themeSettings = { theme, background_image: backgroundImage };
    this.save('theme_settings', this.themeSettings);
  },

  getBackgroundImages(theme) {
    const imageNames = [];
    const basePath = `assets/background/${theme}/`;
    return imageNames;
  },

  getBackgroundUrl(theme, imageName) {
    if (imageName) {
      return `assets/background/${theme}/${imageName}`;
    }
    return '';
  },

  addMusicFavorite(song) {
    const existing = this.musicFavorites.find(f => f.song_id === song.song_id);
    if (!existing) {
      this.musicFavorites.push({
        ...song,
        added_at: Date.now()
      });
      this.save('music_favorites', this.musicFavorites);
    }
  },

  removeMusicFavorite(songId) {
    this.musicFavorites = this.musicFavorites.filter(f => f.song_id !== songId);
    this.save('music_favorites', this.musicFavorites);
  },

  getMusicFavorites() {
    return this.musicFavorites;
  },

  addMusicHistory(song) {
    this.musicHistory.unshift({
      ...song,
      played_at: Date.now()
    });
    if (this.musicHistory.length > 100) {
      this.musicHistory = this.musicHistory.slice(0, 100);
    }
    this.save('music_history', this.musicHistory);
  },

  getMusicHistory() {
    return this.musicHistory;
  },

  searchWord(keyword) {
    const results = this.words.filter(w =>
      w.english.toLowerCase().includes(keyword.toLowerCase()) ||
      w.chinese.includes(keyword)
    );
    return results;
  },

  updateLearnSettings(count) {
    this.learnSettings = { default_learn_count: count };
    this.save('learn_settings', this.learnSettings);
  },

  createCustomWordbook(bookName, manualWords) {
    const book = this.addWordbook(bookName);
    for (const wordData of manualWords) {
      this.addWord(book.book_id, wordData.english, wordData.chinese);
    }
    return book;
  }
};

if (typeof window !== 'undefined') {
  window.api = API;
}