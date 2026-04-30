/* ============================================
   UI - 用户界面交互管理
   ============================================ */

import { storage } from './storage.js';
import { api } from './api.js';
import { showToast, getSeason, getSeasonName, groupRecords, createParticle } from './utils.js';
import { quotes } from './config.js';

// 粒子效果实例存储
const particleInstances = new Map();

class UIManager {
  constructor() {
    this.state = {
      currentType: 'movie',
      selectedItem: null,
      selectedRating: 3,
      customPoster: null,
      viewMode: 'grid',
      particleEnabled: true,
      editingId: null
    };
  }

  /**
   * 初始化所有UI组件
   */
  init() {
    // 从存储恢复设置
    this.state.viewMode = storage.getViewSetting();
    this.state.particleEnabled = storage.getParticleSetting();

    // 更新文档设置
    document.body.dataset.view = this.state.viewMode;
    document.body.dataset.particle = this.state.particleEnabled;

    // 初始化各个组件
    this.initSceneSwitcher();
    this.initTypeToggle();
    this.initSearch();
    this.initStarRating();
    this.initReviewActions();
    this.initModalCloseEvents();
    this.initLibraryButton();
    this.initPosterUpload();
    this.initUploadOwn();
    this.initViewToggle();
    this.initParticleToggle();
    this.initDetailActions();

    // 显示随机名言
    this.displayRandomQuote();

    // 更新库数量
    this.updateLibraryCount();

    // 设置视图切换按钮图标
    this.updateViewIcon();
  }

  /**
   * 场景切换
   */
  initSceneSwitcher() {
    const btns = document.querySelectorAll('.scene-btn');
    const bgs = document.querySelectorAll('.scene-bg');

    btns.forEach(btn => {
      btn.onclick = () => {
        const scene = btn.dataset.scene;
        document.body.dataset.scene = scene;
        bgs.forEach(bg => bg.classList.toggle('active', bg.dataset.scene === scene));
        btns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      };
    });
  }

  /**
   * 类型切换
   */
  initTypeToggle() {
    const btns = document.querySelectorAll('.type-btn');
    btns.forEach(btn => {
      btn.onclick = () => {
        this.state.currentType = btn.dataset.type;
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
  }

  /**
   * 搜索功能
   */
  initSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    searchBtn.onclick = () => this.performSearch();
    searchInput.onkeypress = e => {
      if (e.key === 'Enter') this.performSearch();
    };
  }

  async performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    this.showPosterModal();
    this.showLoading();

    try {
      const results = await api.search(this.state.currentType, query);
      this.renderPosterGrid(results.slice(0, 12));
    } catch {
      this.renderPosterGrid([]);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * 星级评分
   */
  initStarRating() {
    const ratingEl = document.getElementById('reviewRating');
    if (!ratingEl) return;

    ratingEl.querySelectorAll('.star').forEach(star => {
      star.onclick = () => {
        this.state.selectedRating = parseInt(star.dataset.rating);
        this.updateStarDisplay(this.state.selectedRating);
      };

      star.onmouseenter = () => {
        const r = parseInt(star.dataset.rating);
        this.previewStars(r);
      };
    });

    ratingEl.onmouseleave = () => {
      this.updateStarDisplay(this.state.selectedRating);
    };
  }

  updateStarDisplay(rating) {
    document.querySelectorAll('#reviewRating .star').forEach((s, i) => {
      s.classList.toggle('active', i < rating);
    });
  }

  previewStars(rating) {
    document.querySelectorAll('#reviewRating .star').forEach((s, i) => {
      s.style.color = i < rating ? 'var(--accent)' : 'rgba(255,255,255,0.2)';
    });
  }

  /**
   * 模态框管理
   */
  showModalLayer() {
    document.getElementById('modalLayer').classList.add('active');
    document.getElementById('modalLayer').setAttribute('aria-hidden', 'false');
  }

  hideModalLayer() {
    document.getElementById('modalLayer').classList.remove('active');
    document.getElementById('modalLayer').setAttribute('aria-hidden', 'true');
    this.closePosterModal();
    this.closeReviewModal();
    this.state.customPoster = null;
  }

  showPosterModal() {
    this.showModalLayer();
    document.getElementById('posterModal').classList.add('active');

    const titles = { movie: '选择电影', tv: '选择剧集', book: '选择书籍' };
    document.getElementById('posterModalTitle').textContent = titles[this.state.currentType];
  }

  closePosterModal() {
    document.getElementById('posterModal').classList.remove('active');
  }

  showLoading() {
    document.getElementById('posterModal').classList.add('loading');
  }

  hideLoading() {
    document.getElementById('posterModal').classList.remove('loading');
  }

  openReviewModal(item) {
    this.state.selectedItem = item;
    this.state.selectedRating = 3;
    this.state.customPoster = null;

    const img = document.getElementById('reviewPosterImg');
    img.src = item.poster || '';

    document.getElementById('reviewItemTitle').value = item.title;
    document.getElementById('reviewItemYear').value = item.year || '';

    document.getElementById('uploadPosterBtn').innerHTML = `
      <span class="upload-icon">+</span><span class="upload-text">上传封面</span>
    `;

    this.updateStarDisplay(3);
    document.getElementById('reviewTextarea').value = '';

    this.closePosterModal();
    document.getElementById('reviewModal').classList.add('active');
  }

  closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('active');
    this.state.selectedItem = null;
  }

  /**
   * 海报网格渲染
   */
  renderPosterGrid(results) {
    const grid = document.getElementById('posterGrid');

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="poster-empty" style="text-align:center;padding:40px;font-size:13px;color:rgba(255,255,255,0.4)">
          未找到结果，请尝试其他关键词
        </div>
      `;
      return;
    }

    grid.innerHTML = results.map((item, i) => `
      <div class="poster-item" data-index="${i}">
        ${item.poster
          ? `<img src="${item.poster}" alt="${item.title}" class="poster-item-img" loading="lazy">`
          : `<div class="poster-placeholder">No</div>`
        }
        <div class="poster-item-info">
          <p class="poster-item-title">${item.title}</p>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.poster-item').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.index);
        this.openReviewModal(results[idx]);
      };
    });
  }

  /**
   * 上传功能
   */
  initPosterUpload() {
    const input = document.getElementById('posterUploadInput');
    if (!input) return;

    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = ev => {
        this.state.customPoster = ev.target.result;
        document.getElementById('reviewPosterImg').src = this.state.customPoster;
        document.getElementById('uploadPosterBtn').innerHTML =
          '<span class="upload-icon">✓</span><span class="upload-text">已上传</span>';
      };
      reader.readAsDataURL(file);
    };
  }

  initUploadOwn() {
    const btn = document.getElementById('uploadOwnBtn');
    if (!btn) return;

    btn.onclick = () => {
      this.state.selectedItem = { type: this.state.currentType, title: '', year: '' };
      this.state.selectedRating = 3;
      this.state.customPoster = null;

      document.getElementById('reviewPosterImg').src = '';
      document.getElementById('reviewItemTitle').value = '';
      document.getElementById('reviewItemYear').value = '';
      document.getElementById('uploadPosterBtn').innerHTML =
        '<span class="upload-icon">+</span><span class="upload-text">上传封面</span>';
      this.updateStarDisplay(3);
      document.getElementById('reviewTextarea').value = '';

      this.closePosterModal();
      document.getElementById('reviewModal').classList.add('active');
    };
  }

  /**
   * 评价操作
   */
  initReviewActions() {
    document.getElementById('abandonBtn').onclick = () => this.hideModalLayer();
    document.getElementById('saveLaterBtn').onclick = () => this.saveRecord(false);
    document.getElementById('saveNowBtn').onclick = () => this.saveRecord(true);
  }

  saveRecord(withComment) {
    const title = document.getElementById('reviewItemTitle').value.trim() || '未知作品';
    const year = document.getElementById('reviewItemYear').value.trim() || '';
    const poster = this.state.customPoster || this.state.selectedItem?.poster || '';

    if (this.state.editingId) {
      const records = storage.getRecords();
      const idx = records.findIndex(r => r.id === this.state.editingId);

      if (idx !== -1) {
        records[idx] = {
          ...records[idx],
          title, year, poster,
          rating: this.state.selectedRating,
          comment: withComment ? document.getElementById('reviewTextarea').value.trim() : records[idx].comment,
          updatedAt: Date.now()
        };
        storage.saveRecords(records);
        showToast('记录已更新', 'success');
      }

      this.state.editingId = null;
    } else {
      const record = {
        id: storage.generateId(),
        type: this.state.selectedItem?.type || this.state.currentType,
        title, year, poster,
        date: new Date().toISOString().split('T')[0],
        rating: this.state.selectedRating,
        comment: withComment ? document.getElementById('reviewTextarea').value.trim() : '',
        createdAt: Date.now()
      };

      storage.addRecord(record);
      showToast('记录已添加', 'success');
    }

    this.hideModalLayer();
    document.getElementById('searchInput').value = '';
    this.updateLibraryCount();
  }

  /**
   * 模态框关闭事件
   */
  initModalCloseEvents() {
    document.getElementById('posterModalClose').onclick = () => this.hideModalLayer();
    document.getElementById('reviewModalClose').onclick = () => this.hideModalLayer();
    document.getElementById('libraryModalClose').onclick = () => this.closeLibraryModal();
    document.getElementById('detailModalClose').onclick = () => this.closeDetailModal();

    document.getElementById('modalOverlay').onclick = () => {
      if (!document.getElementById('libraryModal').classList.contains('active') &&
          !document.getElementById('detailModal').classList.contains('active')) {
        this.hideModalLayer();
      }
    };

    document.onkeydown = e => {
      if (e.key === 'Escape') {
        if (document.getElementById('detailModal').classList.contains('active')) {
          this.closeDetailModal();
        } else if (document.getElementById('libraryModal').classList.contains('active')) {
          this.closeLibraryModal();
        } else {
          this.hideModalLayer();
        }
      }
    };
  }

  /**
   * 库管理
   */
  initLibraryButton() {
    document.getElementById('openLibraryBtn').onclick = () => this.openLibraryModal();
  }

  updateLibraryCount() {
    const count = storage.getRecords().length;
    document.getElementById('libraryCount').textContent = count;
  }

  openLibraryModal() {
    this.showModalLayer();
    document.getElementById('libraryModal').classList.add('active');
    this.renderLibrary();
  }

  closeLibraryModal() {
    document.getElementById('libraryModal').classList.remove('active');
    document.getElementById('modalLayer').classList.remove('active');
  }

  initViewToggle() {
    const btn = document.getElementById('viewToggleBtn');
    btn.onclick = () => {
      this.state.viewMode = this.state.viewMode === 'grid' ? 'list' : 'grid';
      storage.saveViewSetting(this.state.viewMode);
      document.body.dataset.view = this.state.viewMode;
      this.updateViewIcon();

      if (document.getElementById('libraryModal').classList.contains('active')) {
        this.renderLibrary();
      }
    };
  }

  updateViewIcon() {
    const icon = document.querySelector('.view-icon');
    if (icon) {
      icon.textContent = this.state.viewMode === 'grid' ? '⊞' : '☰';
    }
  }

  initParticleToggle() {
    const btn = document.getElementById('particleToggleBtn');
    btn.onclick = () => {
      this.state.particleEnabled = !this.state.particleEnabled;
      storage.saveParticleSetting(this.state.particleEnabled);
      document.body.dataset.particle = this.state.particleEnabled;
      btn.classList.toggle('active', this.state.particleEnabled);

      if (document.getElementById('libraryModal').classList.contains('active')) {
        this.renderLibrary();
      }
    };
    btn.classList.toggle('active', this.state.particleEnabled);
  }

  renderLibrary() {
    const records = storage.getRecords();
    const body = document.getElementById('libraryModalBody');
    const count = document.getElementById('libraryRecordCount');

    count.textContent = `${records.length} 条记录`;

    if (records.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◇</div>
          <p class="empty-state-text">尚未记录任何内容</p>
        </div>
      `;
      return;
    }

    const groups = groupRecords(records);
    const season = getSeason();

    body.innerHTML = groups.map(group => `
      <div class="library-group" data-season="${season}">
        <h4 class="library-group-title">${group.label}</h4>
        <div class="library-records-${this.state.viewMode}">
          ${group.items.map(r => this.renderRecordCard(r)).join('')}
        </div>
      </div>
    `).join('');

    body.querySelectorAll('.library-record').forEach(el => {
      el.style.cursor = 'pointer';
      el.onclick = () => {
        const id = el.dataset.id;
        const record = storage.getRecordById(id);
        if (record) this.openDetailModal(record);
      };
    });

    // 初始化粒子效果
    if (this.state.particleEnabled) {
      this.initParticles();
    }
  }

  renderRecordCard(record) {
    const poster = record.poster
      ? `<img src="${record.poster}" alt="${record.title}" class="library-record-poster" loading="lazy">`
      : `<div class="library-record-poster" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);font-size:10px;color:rgba(255,255,255,0.3)">无封面</div>`;

    const rating = '<span>★</span>'.repeat(record.rating) +
                   '<span class="empty">★</span>'.repeat(5 - record.rating);
    const comment = record.comment || '此人尚未留下隻字片語。';

    if (this.state.viewMode === 'grid') {
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
        </div>
      `;
    }

    return `
      <div class="library-record library-record-list" data-id="${record.id}">
        ${poster}
        <div class="library-record-info">
          <p class="library-record-title">${record.title}</p>
          <p class="library-record-meta">${record.type === 'book' ? '书籍' : record.type === 'tv' ? '剧集' : '电影'} · ${record.year || ''}</p>
          <div class="library-record-rating">${rating}</div>
          <div class="record-particle-wrapper" style="margin-top:8px">
            <div class="record-comment ${record.comment ? '' : 'empty'}">${comment}</div>
            <canvas class="record-particle-canvas"></canvas>
            <div class="record-particle-bg"></div>
          </div>
        </div>
      </div>
    `;
  }

  initParticles() {
    document.querySelectorAll('.record-particle-wrapper').forEach(el => {
      const canvas = el.querySelector('.record-particle-canvas');
      const comment = el.querySelector('.record-comment');
      if (canvas && comment && !particleInstances.has(canvas)) {
        const particle = createParticle(canvas);
        particleInstances.set(canvas, particle);
      }
    });
  }

  /**
   * 详情模态框
   */
  initDetailActions() {
    document.getElementById('editRecordBtn').onclick = () => this.editRecord();
    document.getElementById('exportCardBtn').onclick = () => this.exportCard();
    document.getElementById('deleteRecordBtn').onclick = () => this.deleteRecord();
    document.getElementById('exportBtn').onclick = () => this.exportAllCards();
  }

  openDetailModal(record) {
    this.currentDetailRecord = record;

    const poster = document.getElementById('detailPosterImg');
    poster.src = record.poster || '';

    document.getElementById('detailTitle').textContent = record.title;
    document.getElementById('detailMeta').textContent = [
      record.type === 'book' ? '书籍' : record.type === 'tv' ? '剧集' : '电影',
      record.year || '',
      record.date
    ].filter(Boolean).join(' · ');

    const ratingEl = document.getElementById('detailRating');
    ratingEl.innerHTML = '<span>★</span>'.repeat(record.rating) +
                         '<span class="empty">★</span>'.repeat(5 - record.rating);

    document.getElementById('detailComment').textContent =
      record.comment || '此人尚未留下隻字片語。';

    document.getElementById('detailModal').classList.add('active');
  }

  closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
    this.currentDetailRecord = null;
  }

  editRecord() {
    if (!this.currentDetailRecord) return;

    this.state.selectedItem = {
      type: this.currentDetailRecord.type,
      title: this.currentDetailRecord.title,
      year: this.currentDetailRecord.year,
      poster: this.currentDetailRecord.poster
    };
    this.state.selectedRating = this.currentDetailRecord.rating;
    this.state.customPoster = null;
    this.state.editingId = this.currentDetailRecord.id;

    document.getElementById('reviewPosterImg').src = this.currentDetailRecord.poster || '';
    document.getElementById('reviewItemTitle').value = this.currentDetailRecord.title;
    document.getElementById('reviewItemYear').value = this.currentDetailRecord.year || '';
    this.updateStarDisplay(this.currentDetailRecord.rating);
    document.getElementById('reviewTextarea').value = this.currentDetailRecord.comment || '';

    this.closeDetailModal();
    this.closeLibraryModal();
    this.showModalLayer();
    document.getElementById('reviewModal').classList.add('active');
  }

  deleteRecord() {
    if (!this.currentDetailRecord) return;

    if (confirm('确定要删除这条记录吗？')) {
      storage.deleteRecord(this.currentDetailRecord.id);
      showToast('记录已删除', 'success');
      this.closeDetailModal();
      this.closeLibraryModal();
      this.updateLibraryCount();
      setTimeout(() => this.openLibraryModal(), 100);
    }
  }

  async exportCard() {
    if (!this.currentDetailRecord) return;
    // 实现卡片导出逻辑
    showToast('卡片导出功能开发中', 'info');
  }

  async exportAllCards() {
    const records = storage.getRecords();
    if (records.length === 0) {
      showToast('暂无记录可导出', 'error');
      return;
    }
    // 实现批量导出逻辑
    showToast('批量导出功能开发中', 'info');
  }

  /**
   * 显示随机名言
   */
  displayRandomQuote() {
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
}

// 导出UI管理器
export const ui = new UIManager();