/* ============================================
   Moon Dust - 打包版本：所有模块合并
   ============================================ */

// ============================================
// 配置
// ============================================
const CONFIG = {
 STORAGE_KEY: 'moondust_records',
  VIEW_MODE_KEY: 'moondust_view',
  PARTICLE_KEY: 'moondust_particle',

  TMDB_BASE_URL: '/api/tmdb',
  TMDB_IMAGE_BASE: '/api/image',
  GOOGLE_BOOKS_URL: '/api/books',

  PARTICLE_DENSITY: 150,
  PARTICLE_SIZE: 1.2,
  CARD_WIDTH: 600,
  CARD_HEIGHT: 400,

  MEDIA_TYPES: {
    movie: '电影',
    tv: '剧集',
    book: '书籍'
  }
};

// ============================================
// 工具函数
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getSeason(date = new Date()) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function getSeasonName(season) {
  return { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }[season] || season;
}

function getMonthName(month) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function wrapText(ctx, text, maxWidth) {
  const chars = text.split('');
  const lines = [];
  let currentLine = '';

  chars.forEach(char => {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================
// 状态管理
// ============================================
const EventEmitter = {
  events: {},
  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  },
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  },
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
};

const State = {
  _state: {
    currentType: 'movie',
    searchResults: [],
    selectedItem: null,
    selectedRating: 3,
    viewMode: localStorage.getItem('moondust_view') || 'grid',
    particleEnabled: localStorage.getItem('moondust_particle') !== 'false',
    currentScene: 'forest',
    editingId: null,
    customPoster: null,
    activeModal: null,
    filterQuery: '',
    filterType: 'all',
    filterRating: 0,
    stats: null
  },
  get(key) {
    return key ? this._state[key] : { ...this._state };
  },
  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;
    if (key === 'viewMode') localStorage.setItem('moondust_view', value);
    else if (key === 'particleEnabled') localStorage.setItem('moondust_particle', value);
    EventEmitter.emit(`state:${key}Changed`, { key, value, oldValue });
    EventEmitter.emit('stateChanged', { key, value, oldValue });
    return this;
  },
  setState(updates) {
    Object.entries(updates).forEach(([k, v]) => this.set(k, v));
    return this;
  }
};

// ============================================
// 存储服务
// ============================================
const Storage = {
  getRecords() {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },
  saveRecords(records) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') alert('存储空间已满，请导出数据后清理部分记录。');
      return false;
    }
  },
  addRecord(record) {
    const records = this.getRecords();
    const newRecord = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
      ...record
    };
    records.unshift(newRecord);
    this.saveRecords(records);
    return newRecord;
  },
  updateRecord(id, updates) {
    const records = this.getRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) {
      records[idx] = { ...records[idx], ...updates, updatedAt: Date.now() };
      this.saveRecords(records);
      return records[idx];
    }
    return null;
  },
  deleteRecord(id) {
    const records = this.getRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length !== records.length) {
      this.saveRecords(filtered);
      return true;
    }
    return false;
  },
  getRecordById(id) {
    return this.getRecords().find(r => r.id === id) || null;
  },
  exportToJSON() {
    const records = this.getRecords();
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      count: records.length,
      records
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moondust_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },
  importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.records || !Array.isArray(data.records)) {
            throw new Error('Invalid format');
          }
          const existing = this.getRecords();
          const merged = [...existing];
          data.records.forEach(newRecord => {
            const idx = merged.findIndex(r => r.id === newRecord.id);
            if (idx !== -1) merged[idx] = { ...merged[idx], ...newRecord };
            else merged.push(newRecord);
          });
          this.saveRecords(merged);
          resolve({ total: merged.length, added: data.records.length - (merged.length - existing.length) });
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },
  getStats() {
    const records = this.getRecords();
    const byType = { movie: { count: 0, totalRating: 0 }, tv: { count: 0, totalRating: 0 }, book: { count: 0, totalRating: 0 } };
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    records.forEach(r => {
      if (byType[r.type]) {
        byType[r.type].count++;
        byType[r.type].totalRating += r.rating || 0;
      }
      if (r.rating && ratingDistribution[r.rating] !== undefined) {
        ratingDistribution[r.rating]++;
      }
    });

    Object.keys(byType).forEach(type => {
      byType[type].avgRating = byType[type].count > 0 ? (byType[type].totalRating / byType[type].count).toFixed(1) : 0;
    });

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      total: records.length,
      byType,
      ratingDistribution,
      recentCount: records.filter(r => r.createdAt >= thirtyDaysAgo).length,
      thisMonth: records.filter(r => r.date && r.date.startsWith(thisMonth)).length
    };
  }
};

// ============================================
// API 服务
// ============================================
async function safeFetch(url, options = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('请求超时');
    throw error;
  }
}

const TMDBService = {
  async searchMovies(query) {
    const url = `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=zh-TW`;
    const data = await safeFetch(url);
    return (data.results || []).map(m => ({
      id: String(m.id), type: 'movie', title: m.title || 'Unknown',
      year: (m.release_date || '').split('-')[0],
      poster: m.poster_path ? CONFIG.TMDB_IMAGE_BASE + m.poster_path : null
    }));
  },
  async searchTV(query) {
    const url = `${CONFIG.TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=zh-TW`;
    const data = await safeFetch(url);
    return (data.results || []).map(s => ({
      id: String(s.id), type: 'tv', title: s.name || 'Unknown',
      year: (s.first_air_date || '').split('-')[0],
      poster: s.poster_path ? CONFIG.TMDB_IMAGE_BASE + s.poster_path : null
    }));
  }
};

const GoogleBooksService = {
  async search(query) {
    const url = `${CONFIG.GOOGLE_BOOKS_URL}?q=${encodeURIComponent(query)}&maxResults=20`;
    const data = await safeFetch(url);
    return (data.items || []).map(item => {
      const info = item.volumeInfo || {};
      return {
        id: item.id, type: 'book', title: info.title || 'Unknown',
        year: (info.publishedDate || '').split('-')[0],
        poster: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null
      };
    });
  }
};

const SearchService = {
  async search(query, type) {
    if (type === 'movie') return TMDBService.searchMovies(query);
    if (type === 'tv') return TMDBService.searchTV(query);
    if (type === 'book') return GoogleBooksService.search(query);
    return [];
  }
};

// TMDB API Key（已移至顶部定义）
const TMDB_API_KEY = '926f2381b83c386e92035f2940e15540';

// ============================================
// 女作家语录
// ============================================
const quotes = [
  { text: "我们阅读以知道我们并不孤独。", author: "林奕含" },
  { text: "忍耐是美德,可我却无法不怀疑。", author: "林奕含" },
  { text: "我已经知道,爱情是最甜美的复仇。", author: "林奕含" },
  { text: "写作是一种反抗。", author: "Annie Ernaux" },
  { text: "生命不是安排,而是追求,是人的意义追寻过程。", author: "Joan Didion" },
  { text: "一个人能使自己成为自己,比什么都重要。", author: "Virginia Woolf" },
  { text: "如果有一件事是好且是对的,那就去做。", author: "李娟" },
  { text: "我的朋友是生活本身。", author: "李娟" },
  { text: "世界就在手边,躺倒就是睡眠。", author: "李娟" },
  { text: "岁月极美,在于它必然的流逝。春花，秋月、夏日、冬雪。", author: "三毛" },
  { text: "每想你一次,天上飘落一粒沙,从此形成了撒哈拉。", author: "三毛" },
  { text: "一个人至少拥有一个梦想,有一个理由去坚强。", author: "三毛" },
  { text: "生命有它的图案,我们惟有临摹。", author: "张爱玲" },
  { text: "因为懂得,所以慈悲。", author: "张爱玲" },
  { text: "你年轻么?不要紧,过两年就老了。", author: "张爱玲" },
  { text: "We write to taste life twice, in the moment and in retrospect.", author: "Anaïs Nin" },
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: "Louisa May Alcott" },
  { text: "The things we fear most have nothing to do with darkness.", author: "Susanna Clarke" },
  { text: "Stay gold, Ponyboy. Stay gold.", author: "S.E. Hinton" },
  { text: "I am not a has-been. I am a will-be.", author: "Lauren Bacall" },
  { text: "The most common way people give up their power is by thinking they don't have any.", author: "Alice Walker" }
];

// ============================================
// 粒子系统
// ============================================
const particleInstances = new Map();

function initParticleForRecord(canvas, commentEl) {
  if (particleInstances.has(canvas)) return;
  const wrapper = canvas.parentElement;
  const width = wrapper.offsetWidth;
  const height = wrapper.offsetHeight;
  if (width === 0 || height === 0) return;

  canvas.width = width;
  canvas.height = height;
  const count = Math.floor((width * height / 8000) * CONFIG.PARTICLE_DENSITY);

  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width, y: Math.random() * height,
      baseX: Math.random() * width, baseY: Math.random() * height,
      vx: 0, vy: 0,
      size: Math.random() * CONFIG.PARTICLE_SIZE + 0.5,
      opacity: Math.random() * 0.25 + 0.05
    });
  }

  let isRevealed = false, exploding = false, gathering = false;
  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!isRevealed) {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.97)';
      ctx.fillRect(0, 0, width, height);
      particles.forEach(p => {
        if (!gathering) {
          p.vx += (Math.random() - 0.5) * 0.08;
          p.vy += (Math.random() - 0.5) * 0.08;
          p.vx *= 0.96; p.vy *= 0.96;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 2) p.vx += 0.1;
          if (p.x > width - 2) p.vx -= 0.1;
          if (p.y < 2) p.vy += 0.1;
          if (p.y > height - 2) p.vy -= 0.1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 168, 124, ${p.opacity})`;
        ctx.fill();
      });
    }
    requestAnimationFrame(draw);
  }
  draw();

  function explode() {
    if (exploding || isRevealed) return;
    exploding = true;
    particles.forEach(p => {
      const dx = p.x - width / 2, dy = p.y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 6 + Math.random() * 10;
      p.vx = (dx / dist) * speed;
      p.vy = (dy / dist) * speed;
    });
    setTimeout(() => { isRevealed = true; exploding = false; }, 600);
  }

  function gather() {
    if (gathering || !isRevealed) return;
    gathering = true;
    particles.forEach(p => {
      p.vx = (p.baseX - p.x) * 0.15;
      p.vy = (p.baseY - p.y) * 0.15;
      p.opacity = 0;
    });
    const animate = () => {
      let done = true;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.88; p.vy *= 0.88;
        if (Math.abs(p.baseX - p.x) > 1 || Math.abs(p.baseY - p.y) > 1) done = false;
        p.opacity = Math.min(0.3, p.opacity + 0.03);
      });
      if (!done) requestAnimationFrame(animate);
      else { gathering = false; isRevealed = false; }
    };
    animate();
  }

  const handleClick = (e) => {
    e.stopPropagation();
    isRevealed ? gather() : explode();
  };
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('touchend', handleClick);
  particleInstances.set(canvas, { explode, gather });
}

// ============================================
// 筛选功能
// ============================================
function initLibraryFilters(onFilterChange) {
  const container = document.getElementById('libraryFilters');
  if (!container) return;

  container.innerHTML = `
    <div class="library-filters-inner">
      <div class="filter-search-wrapper">
        <input type="text" class="filter-search-input" id="filterSearchInput" placeholder="搜索标题...">
        <button class="filter-clear-btn" id="filterClearBtn" style="display:none">×</button>
      </div>
      <div class="filter-type-btns">
        <button class="filter-type-btn active" data-filter="all">全部</button>
        <button class="filter-type-btn" data-filter="movie">电影</button>
        <button class="filter-type-btn" data-filter="tv">剧集</button>
        <button class="filter-type-btn" data-filter="book">书籍</button>
      </div>
      <div class="filter-rating-wrapper">
        <span class="filter-rating-label">评分：</span>
        <div class="filter-rating-stars" id="filterRatingStars">
          <span class="filter-star active" data-rating="0">全部</span>
          <span class="filter-star" data-rating="1">★</span>
          <span class="filter-star" data-rating="2">★★</span>
          <span class="filter-star" data-rating="3">★★★</span>
          <span class="filter-star" data-rating="4">★★★★</span>
          <span class="filter-star" data-rating="5">★★★★★</span>
        </div>
      </div>
      <div class="filter-result-count" id="filterResultCount"><span>${Storage.getRecords().length}</span> 条记录</div>
    </div>
  `;

  const searchInput = document.getElementById('filterSearchInput');
  const clearBtn = document.getElementById('filterClearBtn');

  const handleSearch = debounce(() => {
    const query = searchInput.value.trim();
    State.set('filterQuery', query);
    clearBtn.style.display = query ? 'block' : 'none';
    onFilterChange(getFilterCriteria());
  }, 300);

  searchInput.addEventListener('input', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      State.set('filterQuery', '');
      clearBtn.style.display = 'none';
      onFilterChange(getFilterCriteria());
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    State.set('filterQuery', '');
    clearBtn.style.display = 'none';
    onFilterChange(getFilterCriteria());
  });

  container.querySelectorAll('.filter-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.set('filterType', btn.dataset.filter);
      onFilterChange(getFilterCriteria());
    });
  });

  document.getElementById('filterRatingStars').addEventListener('click', (e) => {
    const star = e.target.closest('.filter-star');
    if (!star) return;
    const rating = parseInt(star.dataset.rating);
    State.set('filterRating', rating);
    document.querySelectorAll('#filterRatingStars .filter-star').forEach(s => s.classList.remove('active'));
    star.classList.add('active');
    onFilterChange(getFilterCriteria());
  });

  return { reset: () => { searchInput.value = ''; clearBtn.style.display = 'none'; } };
}

function filterRecords(records, criteria) {
  const { query, type, rating } = criteria;
  return records.filter(record => {
    if (query) {
      const searchLower = query.toLowerCase();
      const titleMatch = record.title?.toLowerCase().includes(searchLower);
      const commentMatch = record.comment?.toLowerCase().includes(searchLower);
      if (!titleMatch && !commentMatch) return false;
    }
    if (type !== 'all' && record.type !== type) return false;
    if (rating > 0 && record.rating !== rating) return false;
    return true;
  });
}

function updateFilterCount() {
  const allRecords = Storage.getRecords();
  const filtered = filterRecords(allRecords, {
    query: State.get('filterQuery'),
    type: State.get('filterType'),
    rating: State.get('filterRating')
  });
  const countEl = document.getElementById('filterResultCount');
  if (countEl) {
    const total = allRecords.length, shown = filtered.length;
    countEl.innerHTML = total !== shown ? `显示 <span>${shown}</span>/${total}` : `<span>${total}</span> 条记录`;
  }
}

// ============================================
// 统计面板
// ============================================
function createStatsPanelHTML(stats) {
  const { total, byType, ratingDistribution, recentCount, thisMonth } = stats;
  return `
    <div class="stats-panel glass-panel" id="statsPanel">
      <div class="stats-panel-header">
        <h3 class="stats-panel-title">数据统计</h3>
        <button class="modal-close-btn stats-close-btn" id="statsPanelClose">×</button>
      </div>
      <div class="stats-panel-body">
        <div class="stats-overview">
          <div class="stats-card stats-total">
            <span class="stats-card-value">${total}</span>
            <span class="stats-card-label">总记录</span>
          </div>
          <div class="stats-card stats-month">
            <span class="stats-card-value">${thisMonth}</span>
            <span class="stats-card-label">本月</span>
          </div>
          <div class="stats-card stats-recent">
            <span class="stats-card-value">${recentCount}</span>
            <span class="stats-card-label">近30天</span>
          </div>
        </div>
        <div class="stats-section">
          <h4 class="stats-section-title">类型分布</h4>
          <div class="stats-type-grid">
            <div class="stats-type-item">
              <span class="stats-type-icon">🎬</span>
              <span class="stats-type-name">电影</span>
              <span class="stats-type-count">${byType.movie.count}</span>
              ${byType.movie.avgRating > 0 ? `<span class="stats-type-rating">★ ${byType.movie.avgRating}</span>` : ''}
            </div>
            <div class="stats-type-item">
              <span class="stats-type-icon">📺</span>
              <span class="stats-type-name">剧集</span>
              <span class="stats-type-count">${byType.tv.count}</span>
              ${byType.tv.avgRating > 0 ? `<span class="stats-type-rating">★ ${byType.tv.avgRating}</span>` : ''}
            </div>
            <div class="stats-type-item">
              <span class="stats-type-icon">📚</span>
              <span class="stats-type-name">书籍</span>
              <span class="stats-type-count">${byType.book.count}</span>
              ${byType.book.avgRating > 0 ? `<span class="stats-type-rating">★ ${byType.book.avgRating}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="stats-section">
          <h4 class="stats-section-title">评分分布</h4>
          <div class="stats-rating-chart">
            ${[5, 4, 3, 2, 1].map(rating => {
              const count = ratingDistribution[rating] || 0;
              const percentage = total > 0 ? (count / total * 100) : 0;
              return `
                <div class="stats-rating-row">
                  <span class="stats-rating-label">${'★'.repeat(rating)}</span>
                  <div class="stats-rating-bar-wrapper">
                    <div class="stats-rating-bar" style="width: ${percentage}%"></div>
                  </div>
                  <span class="stats-rating-count">${count}</span>
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="stats-section">
          <h4 class="stats-section-title">数据管理</h4>
          <div class="stats-actions">
            <button class="stats-action-btn" id="statsExportBtn"><span>📤</span> 导出 JSON</button>
            <label class="stats-action-btn"><span>📥</span> 导入 JSON
              <input type="file" id="statsImportInput" accept=".json" hidden>
            </label>
            <button class="stats-action-btn danger" id="statsClearBtn"><span>🗑️</span> 清空数据</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openStatsPanel() {
  const modalLayer = document.getElementById('modalLayer');
  modalLayer.insertAdjacentHTML('beforeend', createStatsPanelHTML(Storage.getStats()));
  const panel = document.getElementById('statsPanel');
  setTimeout(() => panel.classList.add('active'), 10);

  document.getElementById('statsPanelClose').addEventListener('click', () => {
    panel.classList.remove('active');
    setTimeout(() => panel.remove(), 400);
  });

  document.getElementById('statsExportBtn').addEventListener('click', () => Storage.exportToJSON());

  document.getElementById('statsImportInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await Storage.importFromJSON(file);
      alert(`导入成功！共 ${result.total} 条记录，新增 ${result.added} 条。`);
      panel.classList.remove('active');
      setTimeout(() => panel.remove(), 400);
      window.dispatchEvent(new CustomEvent('moondust:recordsChanged'));
    } catch (err) { alert(`导入失败：${err.message}`); }
  });

  document.getElementById('statsClearBtn').addEventListener('click', () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！\n\n建议先导出数据备份。')) {
      if (confirm('再次确认：所有记录将被永久删除！')) {
        Storage.saveRecords([]);
        alert('数据已清空。');
        panel.classList.remove('active');
        setTimeout(() => panel.remove(), 400);
        window.dispatchEvent(new CustomEvent('moondust:recordsChanged'));
      }
    }
  });
}

// ============================================
// 智能归档
// ============================================
function groupRecords(records) {
  const monthMap = {};
  records.forEach(r => {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap[key]) monthMap[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
    monthMap[key].items.push(r);
  });

  const sorted = Object.values(monthMap).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const groups = [], buffer = [];
  sorted.forEach(g => {
    if (g.items.length >= 3) {
      if (buffer.length > 0) { groups.push(...mergeToSeasons(buffer)); buffer = []; }
      groups.push({ label: `${getMonthName(g.month)} ${g.year}`, items: g.items });
    } else { buffer.push(g); }
  });
  if (buffer.length > 0) groups.push(...mergeToSeasons(buffer));
  return groups;
}

function mergeToSeasons(monthGroups) {
  if (monthGroups.length === 0) return [];
  const seasonMap = {};
  monthGroups.forEach(g => {
    const season = getSeason(new Date(g.year, g.month));
    if (!seasonMap[season]) seasonMap[season] = { season, year: g.year, items: [] };
    seasonMap[season].items.push(...g.items);
  });
  return Object.values(seasonMap).map(s => ({ label: `${getSeasonName(s.season)} ${s.year}`, items: s.items }));
}

// ============================================
// 渲染库
// ============================================
function renderRecordCard(record) {
  const poster = record.poster
    ? `<img src="${record.poster}" alt="${record.title}" class="library-record-poster" loading="lazy">`
    : `<div class="library-record-poster" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);font-size:10px;color:rgba(255,255,255,0.3)">无封面</div>`;
  const rating = '<span>★</span>'.repeat(record.rating) + '<span class="empty">★</span>'.repeat(5 - record.rating);
  const comment = record.comment || '此人尚未留下隻字片語。';

  if (State.get('viewMode') === 'grid') {
    return `
      <div class="library-record library-record-grid" data-id="${record.id}">
        ${poster}
        <div class="library-record-info" style="padding:8px">
          <p class="library-record-title">${record.title}</p>
          <p class="library-record-meta">${record.year || ''}</p>
        </div>
        <div class="record-particle-wrapper" style="height:60px">
          <div class="record-comment">${comment}</div>
          <canvas class="record-particle-canvas"></canvas>
          <div class="record-particle-bg"></div>
        </div>
      </div>`;
  }
  return `
    <div class="library-record library-record-list" data-id="${record.id}">
      ${poster}
      <div class="library-record-info">
        <p class="library-record-title">${record.title}</p>
        <p class="library-record-meta">${CONFIG.MEDIA_TYPES[record.type]} · ${record.year || ''}</p>
        <div class="library-record-rating">${rating}</div>
        <div class="record-particle-wrapper" style="margin-top:8px">
          <div class="record-comment ${record.comment ? '' : 'empty'}">${comment}</div>
          <canvas class="record-particle-canvas"></canvas>
          <div class="record-particle-bg"></div>
        </div>
      </div>
    </div>`;
}

function renderLibraryWithFilters(criteria) {
  const filtered = filterRecords(Storage.getRecords(), criteria);
  const body = document.getElementById('libraryModalBody');
  if (filtered.length === 0) {
    body.innerHTML = `<div class="library-empty"><div class="library-empty-icon">◇</div><p class="library-empty-text">没有符合条件的记录</p></div>`;
    return;
  }
  body.innerHTML = filtered.map(r => `
    <div class="library-group"><div class="library-records-${State.get('viewMode')}">${renderRecordCard(r)}</div></div>
  `).join('');
  initRecordCardEvents();
  updateFilterCount();
}

function renderLibrary() {
  const records = Storage.getRecords();
  document.getElementById('libraryRecordCount').textContent = `${records.length} 条记录`;
  const body = document.getElementById('libraryModalBody');

  if (records.length === 0) {
    body.innerHTML = `<div class="library-empty"><div class="library-empty-icon">◇</div><p class="library-empty-text">尚未记录任何内容</p></div>`;
    return;
  }

  const criteria = { query: State.get('filterQuery'), type: State.get('filterType'), rating: State.get('filterRating') };
  if (criteria.query || criteria.type !== 'all' || criteria.rating > 0) {
    renderLibraryWithFilters(criteria);
    return;
  }

  const groups = groupRecords(records);
  const currentSeason = getSeason();
  body.innerHTML = groups.map(group => `
    <div class="library-group" data-season="${currentSeason}">
      <h4 class="library-group-title">${group.label}</h4>
      <div class="library-records-${State.get('viewMode')}">${group.items.map(r => renderRecordCard(r)).join('')}</div>
    </div>
  `).join('');
  initRecordCardEvents();
  updateFilterCount();
}

function initRecordCardEvents() {
  document.querySelectorAll('.library-record').forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = () => {
      const record = Storage.getRecordById(el.dataset.id);
      if (record) openDetailModal(record);
    };
  });
  if (State.get('particleEnabled')) {
    document.querySelectorAll('.record-particle-wrapper').forEach(el => {
      const canvas = el.querySelector('.record-particle-canvas');
      const comment = el.querySelector('.record-comment');
      if (canvas && comment) initParticleForRecord(canvas, comment);
    });
  }
}

function updateLibraryCount() {
  document.getElementById('libraryCount').textContent = Storage.getRecords().length;
}

// ============================================
// 详情弹窗
// ============================================
let currentDetailRecord = null;

function openDetailModal(record) {
  currentDetailRecord = record;
  document.getElementById('detailPosterImg').src = record.poster || '';
  document.getElementById('detailTitle').textContent = record.title;
  document.getElementById('detailMeta').textContent = [CONFIG.MEDIA_TYPES[record.type], record.year || '', record.date].filter(Boolean).join(' · ');
  document.getElementById('detailRating').innerHTML = '<span>★</span>'.repeat(record.rating) + '<span class="empty">★</span>'.repeat(5 - record.rating);
  const commentEl = document.getElementById('detailComment');
  commentEl.textContent = record.comment || '此人尚未留下隻字片語。';
  commentEl.classList.toggle('empty', !record.comment);
  document.getElementById('detailModal').classList.add('active');
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
  currentDetailRecord = null;
}

// ============================================
// 导出卡片
// ============================================
function drawCard(ctx, record, x, y, width, height) {
  const padding = 20;
  ctx.fillStyle = '#121212';
  ctx.fillRect(x, y, width, height);
  for (let i = 0; i < 8000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
    ctx.fillRect(x + Math.random() * width, y + Math.random() * height, 1, 1);
  }
  ctx.strokeStyle = 'rgba(201, 168, 124, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + padding, y + padding, width - padding * 2, height - padding * 2);

  const contentX = x + 200, contentWidth = width - 220;
  ctx.fillStyle = '#C9A87C';
  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.fillText(truncateText(record.title, 14), contentX, y + 50);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillText(`${CONFIG.MEDIA_TYPES[record.type]} · ${record.year || ''}`, contentX, y + 75);
  ctx.fillStyle = '#C9A87C';
  ctx.font = '18px serif';
  ctx.fillText('★'.repeat(record.rating) + '☆'.repeat(5 - record.rating), contentX, y + 105);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillText(record.date, contentX, y + 130);
  ctx.strokeStyle = 'rgba(201, 168, 124, 0.2)';
  ctx.beginPath();
  ctx.moveTo(contentX, y + 150);
  ctx.lineTo(x + width - padding, y + 150);
  ctx.stroke();

  if (record.comment) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px "Noto Serif SC", serif';
    wrapText(ctx, record.comment, contentWidth).slice(0, 6).forEach((line, i) => ctx.fillText(line, contentX, y + 180 + i * 22));
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'italic 14px "Noto Serif SC", serif';
    ctx.fillText('此人尚未留下隻字片語。', contentX, y + 180);
  }
  ctx.fillStyle = 'rgba(201, 168, 124, 0.5)';
  ctx.font = '10px serif';
  ctx.fillText('MOON DUST', x + padding, y + height - 30);
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function exportCard() {
  if (!currentDetailRecord) return;
  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.CARD_WIDTH;
  canvas.height = CONFIG.CARD_HEIGHT;
  drawCard(canvas.getContext('2d'), currentDetailRecord, 0, 0, CONFIG.CARD_WIDTH, CONFIG.CARD_HEIGHT);
  downloadCanvas(canvas, `${currentDetailRecord.title}_${currentDetailRecord.date}.png`);
}

function exportAllCards() {
  const records = Storage.getRecords();
  if (records.length === 0) { alert('暂无记录可导出'); return; }
  const cardWidth = CONFIG.CARD_WIDTH, cardHeight = CONFIG.CARD_HEIGHT;
  const cols = 2, rows = Math.ceil(records.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cardWidth;
  canvas.height = rows * cardHeight;
  canvas.getContext('2d').fillStyle = '#121212';
  canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
  records.forEach((record, index) => {
    const col = index % cols, row = Math.floor(index / cols);
    drawCard(canvas.getContext('2d'), record, col * cardWidth, row * cardHeight, cardWidth, cardHeight);
  });
  downloadCanvas(canvas, `moondust_records_${new Date().toISOString().split('T')[0]}.png`);
}

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.view = State.get('viewMode');
  document.body.dataset.particle = State.get('particleEnabled');

  displayRandomQuote();
  initSceneSwitcher();
  initTypeToggle();
  initSearch();
  initStarRating();
  initReviewActions();
  initModalCloseEvents();
  initLibraryButton();
  initPosterUpload();
  initUploadOwn();
  initViewToggle();
  initParticleToggle();
  initStatsButton();
  initFilterActions();
  updateLibraryCount();

  window.addEventListener('moondust:recordsChanged', () => {
    updateLibraryCount();
    if (document.getElementById('libraryModal').classList.contains('active')) renderLibrary();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});

// ============================================
// 事件绑定
// ============================================
function initSceneSwitcher() {
  const btns = document.querySelectorAll('.scene-btn');
  const bgs = document.querySelectorAll('.scene-bg');
  btns.forEach(btn => {
    btn.onclick = () => {
      document.body.dataset.scene = btn.dataset.scene;
      State.set('currentScene', btn.dataset.scene);
      bgs.forEach(bg => bg.classList.toggle('active', bg.dataset.scene === btn.dataset.scene));
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });
}

function initTypeToggle() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => {
      State.set('currentType', btn.dataset.type);
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });
}

async function performSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  showPosterModal();
  showLoading();
  try {
    const results = await SearchService.search(query, State.get('currentType'));
    State.set('searchResults', results);
    hideLoading();
    renderPosterGrid(results);
  } catch (error) {
    console.error('Search failed:', error);
    hideLoading();
    renderPosterGrid([]);
  }
}

function initSearch() {
  document.getElementById('searchBtn').onclick = performSearch;
  document.getElementById('searchInput').onkeypress = e => e.key === 'Enter' && performSearch();
}

function initStarRating() {
  document.querySelectorAll('#reviewRating .star').forEach(star => {
    star.onclick = () => {
      State.set('selectedRating', parseInt(star.dataset.rating));
      document.querySelectorAll('#reviewRating .star').forEach((s, i) => s.classList.toggle('active', i < State.get('selectedRating')));
    };
    star.onmouseenter = () => {
      const r = parseInt(star.dataset.rating);
      document.querySelectorAll('#reviewRating .star').forEach((s, i) => s.style.color = i < r ? 'var(--accent)' : 'rgba(255,255,255,0.2)');
    };
  });
  document.getElementById('reviewRating').onmouseleave = () => {
    document.querySelectorAll('#reviewRating .star').forEach((s, i) => {
      s.classList.toggle('active', i < State.get('selectedRating'));
      s.style.color = '';
    });
  };
}

function initPosterUpload() {
  document.getElementById('posterUploadInput').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      State.set('customPoster', ev.target.result);
      document.getElementById('reviewPosterImg').src = State.get('customPoster');
      document.getElementById('uploadPosterBtn').innerHTML = '<span class="upload-icon">✓</span><span class="upload-text">已上传</span>';
    };
    reader.readAsDataURL(file);
  };
}

function initUploadOwn() {
  document.getElementById('uploadOwnBtn').onclick = () => {
    State.set('selectedItem', { type: State.get('currentType'), title: '', year: '' });
    State.set('selectedRating', 3);
    State.set('customPoster', null);
    document.getElementById('reviewPosterImg').src = '';
    document.getElementById('reviewItemTitle').value = '';
    document.getElementById('reviewItemYear').value = '';
    document.getElementById('uploadPosterBtn').innerHTML = '<span class="upload-icon">+</span><span class="upload-text">上传封面</span>';
    State.set('selectedRating', 3);
    document.querySelectorAll('#reviewRating .star').forEach((s, i) => s.classList.toggle('active', i < 3));
    document.getElementById('reviewTextarea').value = '';
    closePosterModal();
    document.getElementById('reviewModal').classList.add('active');
  };
}

function showModalLayer() { document.getElementById('modalLayer').classList.add('active'); }
function hideModalLayer() {
  document.getElementById('modalLayer').classList.remove('active');
  closePosterModal();
  closeReviewModal();
  State.set('customPoster', null);
  State.set('editingId', null);
}
function showPosterModal() {
  showModalLayer();
  document.getElementById('posterModal').classList.add('active');
  const titles = { movie: '选择电影', tv: '选择剧集', book: '选择书籍' };
  document.getElementById('posterModalTitle').textContent = titles[State.get('currentType')];
}
function closePosterModal() { document.getElementById('posterModal').classList.remove('active'); }
function showLoading() { document.getElementById('posterModal').classList.add('loading'); }
function hideLoading() { document.getElementById('posterModal').classList.remove('loading'); }

function openReviewModal(item) {
  State.set('selectedItem', item);
  State.set('selectedRating', 3);
  State.set('customPoster', null);
  document.getElementById('reviewPosterImg').src = item.poster || '';
  document.getElementById('reviewItemTitle').value = item.title || '';
  document.getElementById('reviewItemYear').value = item.year || '';
  document.getElementById('uploadPosterBtn').innerHTML = '<span class="upload-icon">+</span><span class="upload-text">上传封面</span>';
  document.querySelectorAll('#reviewRating .star').forEach((s, i) => s.classList.toggle('active', i < 3));
  document.getElementById('reviewTextarea').value = '';
  closePosterModal();
  document.getElementById('reviewModal').classList.add('active');
}

function closeReviewModal() {
  document.getElementById('reviewModal').classList.remove('active');
  State.set('selectedItem', null);
}

function renderPosterGrid(results) {
  const grid = document.getElementById('posterGrid');
  if (results.length === 0) {
    grid.innerHTML = '<div class="poster-empty" style="text-align:center;padding:40px;font-size:13px;color:rgba(255,255,255,0.4)">未找到结果，请尝试其他关键词</div>';
    return;
  }
  grid.innerHTML = results.map((item, i) => `
    <div class="poster-item" data-index="${i}">
      ${item.poster ? `<img src="${item.poster}" alt="${item.title}" class="poster-item-img" loading="lazy">` : '<div class="poster-placeholder">No</div>'}
      <div class="poster-item-info"><p class="poster-item-title">${item.title}</p></div>
    </div>`).join('');
  grid.querySelectorAll('.poster-item').forEach(el => {
    el.onclick = () => openReviewModal(results[parseInt(el.dataset.index)]);
  });
}

let filterHandler = null;
function openLibraryModal() {
  showModalLayer();
  document.getElementById('libraryModal').classList.add('active');
  filterHandler = initLibraryFilters(renderLibraryWithFilters);
  renderLibrary();
}

function closeLibraryModal() {
  document.getElementById('libraryModal').classList.remove('active');
  document.getElementById('modalLayer').classList.remove('active');
  particleInstances.forEach((_, canvas) => canvas.remove());
  particleInstances.clear();
}

function initLibraryButton() { document.getElementById('openLibraryBtn').onclick = openLibraryModal; }
function initFilterActions() { State.subscribe(() => { if (['filterQuery', 'filterType', 'filterRating'].some(k => true)) updateFilterCount(); }); }

function initModalCloseEvents() {
  document.getElementById('posterModalClose').onclick = hideModalLayer;
  document.getElementById('reviewModalClose').onclick = hideModalLayer;
  document.getElementById('libraryModalClose').onclick = closeLibraryModal;
  document.getElementById('detailModalClose').onclick = closeDetailModal;
  document.getElementById('editRecordBtn').onclick = editRecord;
  document.getElementById('exportCardBtn').onclick = exportCard;
  document.getElementById('deleteRecordBtn').onclick = deleteRecord;
  document.getElementById('exportBtn').onclick = exportAllCards;
  document.getElementById('modalOverlay').onclick = () => {
    const libraryActive = document.getElementById('libraryModal').classList.contains('active');
    const detailActive = document.getElementById('detailModal').classList.contains('active');
    if (!libraryActive && !detailActive) hideModalLayer();
  };
  document.onkeydown = e => {
    if (e.key === 'Escape') {
      if (document.getElementById('detailModal').classList.contains('active')) closeDetailModal();
      else if (document.getElementById('libraryModal').classList.contains('active')) closeLibraryModal();
      else hideModalLayer();
    }
  };
}

function editRecord() {
  if (!currentDetailRecord) return;
  State.set('selectedItem', { type: currentDetailRecord.type, title: currentDetailRecord.title, year: currentDetailRecord.year, poster: currentDetailRecord.poster });
  State.set('selectedRating', currentDetailRecord.rating);
  State.set('customPoster', null);
  State.set('editingId', currentDetailRecord.id);
  document.getElementById('reviewPosterImg').src = currentDetailRecord.poster || '';
  document.getElementById('reviewItemTitle').value = currentDetailRecord.title;
  document.getElementById('reviewItemYear').value = currentDetailRecord.year || '';
  document.querySelectorAll('#reviewRating .star').forEach((s, i) => s.classList.toggle('active', i < currentDetailRecord.rating));
  document.getElementById('reviewTextarea').value = currentDetailRecord.comment || '';
  closeDetailModal();
  closeLibraryModal();
  showModalLayer();
  document.getElementById('reviewModal').classList.add('active');
}

function deleteRecord() {
  if (!currentDetailRecord) return;
  if (confirm('确定要删除这条记录吗？')) {
    Storage.deleteRecord(currentDetailRecord.id);
    closeDetailModal();
    closeLibraryModal();
    updateLibraryCount();
    window.dispatchEvent(new CustomEvent('moondust:recordsChanged'));
    setTimeout(openLibraryModal, 100);
  }
}

function saveRecord(withComment) {
  const title = document.getElementById('reviewItemTitle').value.trim() || '未知作品';
  const year = document.getElementById('reviewItemYear').value.trim() || '';
  const poster = State.get('customPoster') || State.get('selectedItem')?.poster || '';
  const comment = document.getElementById('reviewTextarea').value.trim();
  const editingId = State.get('editingId');

  if (editingId) {
    const existingRecord = Storage.getRecordById(editingId);
    if (existingRecord) {
      Storage.updateRecord(editingId, {
        title, year, poster, rating: State.get('selectedRating'),
        comment: withComment ? comment : (existingRecord.comment || '')
      });
    }
    State.set('editingId', null);
  } else {
    Storage.addRecord({
      type: State.get('selectedItem')?.type || State.get('currentType'),
      title, year, poster, rating: State.get('selectedRating'),
      comment: withComment ? comment : ''
    });
  }
  hideModalLayer();
  document.getElementById('searchInput').value = '';
  updateLibraryCount();
  window.dispatchEvent(new CustomEvent('moondust:recordsChanged'));
}

function initReviewActions() {
  document.getElementById('abandonBtn').onclick = hideModalLayer;
  document.getElementById('saveLaterBtn').onclick = () => saveRecord(false);
  document.getElementById('saveNowBtn').onclick = () => saveRecord(true);
}

function initViewToggle() {
  const btn = document.getElementById('viewToggleBtn');
  btn.onclick = () => {
    const newMode = State.get('viewMode') === 'grid' ? 'list' : 'grid';
    State.set('viewMode', newMode);
    document.body.dataset.view = newMode;
    btn.querySelector('.view-icon').textContent = newMode === 'grid' ? '⊞' : '☰';
    if (document.getElementById('libraryModal').classList.contains('active')) renderLibrary();
  };
  btn.querySelector('.view-icon').textContent = State.get('viewMode') === 'grid' ? '⊞' : '☰';
}

function initParticleToggle() {
  const btn = document.getElementById('particleToggleBtn');
  btn.onclick = () => {
    const enabled = !State.get('particleEnabled');
    State.set('particleEnabled', enabled);
    document.body.dataset.particle = enabled;
    btn.classList.toggle('active', enabled);
  };
  btn.classList.toggle('active', State.get('particleEnabled'));
}

function initStatsButton() { document.getElementById('statsBtn').onclick = openStatsPanel; }

function displayRandomQuote() {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  const qEl = document.getElementById('mainQuote');
  const aEl = document.getElementById('quoteAuthor');
  qEl.style.opacity = '0';
  aEl.style.opacity = '0';
  setTimeout(() => {
    qEl.textContent = `"${q.text}"`;
    aEl.textContent = `— ${q.author}`;
    qEl.style.transition = 'opacity 1.5s ease';
    aEl.style.transition = 'opacity 1.5s ease 0.3s';
    qEl.style.opacity = '1';
    aEl.style.opacity = '0.6';
  }, 100);
}
