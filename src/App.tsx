import { useState, useRef, useEffect, useMemo } from 'react'
import html2canvas from 'html2canvas'
import ParticleMask from './ParticleMask'
import './App.css'

const TMDB_API_KEY = '926f2381b83c386e92035f2940e15540'

// ── 类型定义 ──────────────────────────────────────────────
interface User {
  username: string
  createdAt: string
}

interface Entry {
  id: number
  type: 'movie' | 'book'
  title: string
  poster: string
  date: string
  rating: number
  review: string
  pending: boolean
}

type View = 'home' | 'onboarding'

// ── 本地存储 ──────────────────────────────────────────────
const STORAGE_KEY_USER = 'moon_dust_user'
const STORAGE_KEY_ENTRIES = 'moon_dust_entries'
const STORAGE_KEY_BG = 'moon_dust_background'

function loadUser(): User | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))
  } else {
    localStorage.removeItem(STORAGE_KEY_USER)
  }
}

function loadEntries(): Entry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_ENTRIES)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveEntries(entries: Entry[]) {
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries))
}

function loadBackground(): string {
  return localStorage.getItem(STORAGE_KEY_BG) || 'forest'
}

function saveBackground(bg: string) {
  localStorage.setItem(STORAGE_KEY_BG, bg)
}

// ── 工具函数 ──────────────────────────────────────────────
function getYearMonth(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('.')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

function groupEntriesByMonth(entries: Entry[]) {
  const groups: Record<string, Entry[]> = {}
  entries.forEach(entry => {
    const key = getYearMonth(entry.date)
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  })
  // Sort by year-month descending (newest first)
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(key => ({
      label: key,
      displayLabel: formatMonthLabel(key),
      items: groups[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
}

// ── 主组件 ────────────────────────────────────────────────
function App() {
  // 用户状态
  const [user, setUser] = useState<User | null>(() => loadUser())
  const [loginInput, setLoginInput] = useState('')

  // 视图
  const [view, setView] = useState<View>(user ? 'home' : 'onboarding')

  // 背景（持久化）
  const [background, setBackground] = useState(loadBackground)
  const backgrounds: Record<string, string> = {
    forest: 'url(https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80)',
    starry: 'url(https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80)',
    sea: 'url(https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80)',
  }

  const handleBackgroundChange = (bg: string) => {
    setBackground(bg)
    saveBackground(bg)
  }

  // 数据（持久化）
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries())
  const [revealedReviews, setRevealedReviews] = useState<Set<number>>(new Set())

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const typeMatched = libraryFilterType === 'all' || entry.type === libraryFilterType
      const ratingMatched =
        libraryFilterRating === 'all' || entry.rating >= libraryFilterRating
      return typeMatched && ratingMatched
    })
  }, [entries, libraryFilterType, libraryFilterRating])

  // 按月份分组
  const groupedEntries = useMemo(() => groupEntriesByMonth(filteredEntries), [filteredEntries])

  // 搜索
  const [mediaType, setMediaType] = useState<'movie' | 'book'>('movie')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  // 我的库筛选
  const [libraryFilterType, setLibraryFilterType] = useState<'all' | 'movie' | 'book'>('all')
  const [libraryFilterRating, setLibraryFilterRating] = useState<'all' | 6 | 8 | 10>('all')

  // 海报点击 → 三选项弹窗
  const [clickedEntry, setClickedEntry] = useState<Entry | null>(null)
  const [showChoiceModal, setShowChoiceModal] = useState(false)

  // 选片 → 写评价
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewInput, setReviewInput] = useState('')
  const [ratingInput, setRatingInput] = useState(5)

  // 稍后补写
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editReview, setEditReview] = useState('')
  const [editRating, setEditRating] = useState(5)

  // 导出
  const libraryRef = useRef<HTMLDivElement>(null)
  const [exportPreview, setExportPreview] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)

  // ── 用户登录 ────────────────────────────────────────────
  const handleLogin = () => {
    if (!loginInput.trim()) return
    const newUser: User = {
      username: loginInput.trim(),
      createdAt: new Date().toISOString(),
    }
    setUser(newUser)
    saveUser(newUser)
    setLoginInput('')
    setView('home')
  }

  const handleLogout = () => {
    setUser(null)
    saveUser(null)
    setView('onboarding')
    setEntries([])
  }

  // ── API ────────────────────────────────────────────────
  const searchTMDB = async (query: string) => {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=zh-CN&page=1`
    const res = await fetch(url)
    if (!res.ok) throw new Error('TMDB 搜索失败')
    const data = await res.json()
    return (data.results || [])
      .filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv')
      .slice(0, 12)
      .map((i: any) => ({
        id: i.id,
        title: i.title || i.name,
        poster_path: i.poster_path,
        year: (i.release_date || i.first_air_date || '').slice(0, 4),
        source: 'tmdb',
      }))
  }

  const searchOpenLibrary = async (query: string) => {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12&fields=key,title,author_name,cover_i,first_publish_year`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Open Library 搜索失败')
    const data = await res.json()
    return (data.docs || []).slice(0, 12).map((i: any) => ({
      id: i.key,
      title: i.title,
      author: (i.author_name || []).join(', '),
      cover_i: i.cover_i,
      year: i.first_publish_year,
      source: 'openlibrary',
    }))
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsLoading(true)
    setSearchError('')
    setSearchResults([])
    try {
      const results = mediaType === 'movie'
        ? await searchTMDB(searchQuery)
        : await searchBookResults(searchQuery)
      if (results.length === 0) setSearchError('没有找到相关结果，换个关键词试试')
      setSearchResults(results)
      setShowSearchModal(true)
    } catch (e: any) {
      setSearchError(e.message || '搜索出错，请稍后重试')
      setShowSearchModal(true)
    } finally {
      setIsLoading(false)
    }
  }

  // ── 选片后进入评价流程 ─────────────────────────────────
  const selectItem = (item: any) => {
    setSelectedItem(item)
    setShowSearchModal(false)
    setReviewInput('')
    setRatingInput(5)
    setShowReviewModal(true)
  }

  const getPosterUrl = (item: any, size: 'w200' | 'w300' = 'w300') => {
    if (item.source === 'tmdb') {
      return item.poster_path
        ? `https://image.tmdb.org/t/p/${size}${item.poster_path}`
        : 'https://placehold.co/300x450?text=No+Image'
    }
    if (item.source === 'googlebooks') {
      return item.thumbnail || 'https://placehold.co/300x450?text=No+Cover'
    }
    return item.cover_i
      ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`
      : 'https://placehold.co/300x450?text=No+Cover'
  }

  const hasChineseChars = (text: string) => /[\u4e00-\u9fff]/.test(text)

  const searchGoogleBooks = async (query: string) => {
    const langRestrict = hasChineseChars(query) ? '&langRestrict=zh' : ''
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12${langRestrict}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Google Books 搜索失败')
    const data = await res.json()
    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.volumeInfo?.title || '未知书籍',
      author: (item.volumeInfo?.authors || []).join(', '),
      thumbnail: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
      year: (item.volumeInfo?.publishedDate || '').slice(0, 4),
      source: 'googlebooks',
    }))
  }

  const searchBookResults = async (query: string) => {
    const [openResults, googleResults] = await Promise.all([
      searchOpenLibrary(query).catch(() => []),
      searchGoogleBooks(query).catch(() => []),
    ])

    const merged: any[] = []
    const seen = new Set<string>()
    ;[...openResults, ...googleResults].forEach(item => {
      const key = `${item.title || ''}:${item.author || ''}`.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(item)
      }
    })
    return merged.slice(0, 12)
  }

  // 放弃
  const abandonEntry = () => {
    setShowReviewModal(false)
    setSelectedItem(null)
  }

  // 稍后写（先入库，review 为空，pending = true）
  const saveLater = () => {
    if (!selectedItem) return
    const newEntry: Entry = {
      id: Date.now(),
      type: mediaType,
      title: selectedItem.title,
      poster: getPosterUrl(selectedItem),
      date: new Date().toISOString(),
      rating: 0,
      review: '',
      pending: true,
    }
    setEntries(prev => [...prev, newEntry])
    setShowReviewModal(false)
    setSelectedItem(null)
  }

  // 沉淀入库（写了评价）
  const confirmEntry = () => {
    if (!selectedItem) return
    const newEntry: Entry = {
      id: Date.now(),
      type: mediaType,
      title: selectedItem.title,
      poster: getPosterUrl(selectedItem),
      date: new Date().toISOString(),
      rating: ratingInput,
      review: reviewInput.trim() || '（暂无记录）',
      pending: false,
    }
    setEntries(prev => [...prev, newEntry])
    setShowReviewModal(false)
    setSelectedItem(null)
  }

  // ── 海报点击 → 三选项 ──────────────────────────────────
  const handleEntryClick = (entry: Entry) => {
    setClickedEntry(entry)
    setShowChoiceModal(true)
  }

  // ── 补写评价 ──────────────────────────────────────────
  const openEditReview = (entry: Entry) => {
    setEditingEntry(entry)
    setEditReview(entry.review === '（暂无记录）' ? '' : entry.review)
    setEditRating(entry.rating || 5)
    setShowEditModal(true)
    setShowChoiceModal(false)
  }

  const saveEditReview = () => {
    if (!editingEntry) return
    setEntries(prev => prev.map(e =>
      e.id === editingEntry.id
        ? { ...e, review: editReview.trim() || '（暂无记录）', rating: editRating, pending: false }
        : e
    ))
    setShowEditModal(false)
    setEditingEntry(null)
  }

  // ── 导出 ──────────────────────────────────────────────
  const CORS_PROXY = 'https://api.allorigins.win/raw?url='

  const exportSingleCard = async (entry: Entry) => {
    const el = document.getElementById(`entry-card-${entry.id}`)
    if (!el) return

    const imgs = el.querySelectorAll('img')
    const originalSrcs: string[] = []
    imgs.forEach((img, idx) => {
      originalSrcs[idx] = img.src
      if (!img.src.includes('placehold.co')) {
        img.src = `${CORS_PROXY}${encodeURIComponent(originalSrcs[idx])}`
      }
    })

    await new Promise(resolve => setTimeout(resolve, 500))
    const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: 'transparent' })

    imgs.forEach((img, idx) => {
      img.src = originalSrcs[idx]
    })

    setExportPreview(canvas.toDataURL('image/png'))
    setShowChoiceModal(false)
    setShowExportModal(true)
  }

  const exportTextOnlyCard = async (entry: Entry) => {
    const temp = document.createElement('div')
    temp.style.position = 'fixed'
    temp.style.left = '-10000px'
    temp.style.top = '0'
    temp.style.width = '420px'
    temp.style.padding = '28px'
    temp.style.background = 'rgba(10, 10, 15, 0.96)'
    temp.style.color = '#f8f4e8'
    temp.style.fontFamily = "'Noto Serif SC', serif"
    temp.style.lineHeight = '1.75'
    temp.style.borderRadius = '18px'
    temp.style.boxShadow = '0 24px 80px rgba(0,0,0,0.35)'
    temp.style.display = 'flex'
    temp.style.flexDirection = 'column'
    temp.style.gap = '16px'
    temp.style.boxSizing = 'border-box'
    temp.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <div style="font-size:0.88rem;color:rgba(255,255,255,0.65);letter-spacing:0.18em;text-transform:uppercase;">${entry.type === 'movie' ? 'Movie' : 'Book'}</div>
          <div style="font-size:1.45rem;font-weight:600;letter-spacing:0.02em;">${entry.title}</div>
        </div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.55);text-align:right;">${getYearMonth(entry.date)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="padding:8px 12px;border:1px solid rgba(255,255,255,0.14);border-radius:999px;font-size:0.78rem;color:rgba(255,255,255,0.75);">评分 ${entry.rating}/10</span>
        <span style="padding:8px 12px;border:1px solid rgba(255,255,255,0.14);border-radius:999px;font-size:0.78rem;color:rgba(255,255,255,0.75);">${entry.pending ? '待补写' : '已记录'}</span>
      </div>
      <div style="font-size:0.88rem;color:rgba(255,255,255,0.87);white-space:pre-wrap;">${entry.review}</div>
    `

    document.body.appendChild(temp)
    await new Promise(resolve => setTimeout(resolve, 100))
    const canvas = await html2canvas(temp, { useCORS: true, scale: 2, backgroundColor: '#0a0a0f' })
    document.body.removeChild(temp)

    setExportPreview(canvas.toDataURL('image/png'))
    setShowChoiceModal(false)
    setShowExportModal(true)
  }

  const downloadPreview = () => {
    if (!exportPreview) return
    const a = document.createElement('a')
    a.download = `moon-dust-${clickedEntry?.title || 'card'}.png`
    a.href = exportPreview
    a.click()
    setShowExportModal(false)
    setExportPreview(null)
  }

  // ── 渲染 ──────────────────────────────────────────────
  return (
    <div className="app" style={{ backgroundImage: backgrounds[background] }}>

      {/* ── 首次进入 ── */}
      {view === 'onboarding' && (
        <div className="onboarding-container">
          <div className="onboarding-content">
            <div className="onboarding-deco">✦</div>
            <h1 className="onboarding-title">月 落 沉 溺</h1>
            <p className="onboarding-subtitle">Moon Dust</p>
            <p className="onboarding-desc">记录观影与阅读的吉光片羽</p>

            <div className="onboarding-form">
              <input
                type="text"
                className="onboarding-input"
                placeholder="给自己取个名字"
                value={loginInput}
                onChange={e => setLoginInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                maxLength={20}
              />
              <button className="onboarding-btn" onClick={handleLogin}>
                入 场
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 首页 ── */}
      {view === 'home' && user && (
        <>
          {/* 顶部用户栏 */}
          <div className="user-bar">
            <span className="user-greeting">✦ {user.username}</span>
            <button className="logout-btn" onClick={handleLogout}>登出</button>
          </div>

          {/* 顶部背景切换 - 优雅纯文本 */}
          <div className="theme-switcher">
            {Object.keys(backgrounds).map((bg, idx) => (
              <span key={bg}>
                <button
                  className={`theme-btn ${background === bg ? 'active' : ''}`}
                  onClick={() => handleBackgroundChange(bg)}
                >
                  {bg.charAt(0).toUpperCase() + bg.slice(1)}
                </button>
                {idx < Object.keys(backgrounds).length - 1 && <span className="theme-divider">|</span>}
              </span>
            ))}
          </div>

          {/* 主控面板 - 窄长方形 */}
          <div className="glass-panel">
            <p className="panel-quote">I am rooted, but I flow.</p>

            {/* 类型切换 - 极简细线下划线 */}
            <div className="type-toggle">
              <button
                className={`type-btn ${mediaType === 'movie' ? 'active' : ''}`}
                onClick={() => setMediaType('movie')}
              >
                Movie
              </button>
              <span className="type-divider">·</span>
              <button
                className={`type-btn ${mediaType === 'book' ? 'active' : ''}`}
                onClick={() => setMediaType('book')}
              >
                Book
              </button>
            </div>

            {/* 搜索框 */}
            <div className="search-wrap">
              <input
                type="text"
                placeholder={mediaType === 'movie' ? '搜索影视…' : '搜索书籍…'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button className="search-btn" onClick={handleSearch} disabled={isLoading}>
                {isLoading ? '···' : '→'}
              </button>
            </div>
          </div>

          <div className="library-filter-bar">
            <div className="filter-group">
              <span className="filter-label">库筛选</span>
              <button
                className={`filter-chip ${libraryFilterType === 'all' ? 'active' : ''}`}
                onClick={() => setLibraryFilterType('all')}
              >
                全部
              </button>
              <button
                className={`filter-chip ${libraryFilterType === 'movie' ? 'active' : ''}`}
                onClick={() => setLibraryFilterType('movie')}
              >
                电影
              </button>
              <button
                className={`filter-chip ${libraryFilterType === 'book' ? 'active' : ''}`}
                onClick={() => setLibraryFilterType('book')}
              >
                书籍
              </button>
            </div>
            <div className="filter-group">
              <span className="filter-label">星级</span>
              <button
                className={`filter-chip ${libraryFilterRating === 'all' ? 'active' : ''}`}
                onClick={() => setLibraryFilterRating('all')}
              >
                全部
              </button>
              {[6, 8, 10].map(value => (
                <button
                  key={value}
                  className={`filter-chip ${libraryFilterRating === value ? 'active' : ''}`}
                  onClick={() => setLibraryFilterRating(value as 6 | 8 | 10)}
                >
                  ≥{value}
                </button>
              ))}
            </div>
          </div>

          {/* 时间轴列表 */}
          <div className="timeline" ref={libraryRef as any}>
            {groupedEntries.length === 0 && (
              <div className="timeline-empty">
                <p className="timeline-empty-title">
                  {entries.length === 0
                    ? '尚无记录，先搜索一个新片单吧'
                    : '当前筛选暂无符合结果'}
                </p>
                <div
                  className="timeline-add-hint"
                  onClick={() => document.querySelector<HTMLInputElement>('.search-wrap input')?.focus()}
                >
                  <span>+</span> 新记录
                </div>
              </div>
            )}

            {groupedEntries.map(group => (
              <div key={group.label} className="timeline-month">
                <h3 className="month-label">{group.displayLabel}</h3>
                <div className="month-entries">
                  {group.items.map(entry => (
                    <div key={entry.id} id={`entry-card-${entry.id}`} className="entry-card">
                      <img
                        src={entry.poster}
                        alt={entry.title}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          if (!target.src.includes('retry')) {
                            target.src = entry.poster + '?retry=1'
                          }
                        }}
                      />

                      <ParticleMask onClick={() => setRevealedReviews(prev => new Set(prev).add(entry.id))}>
                        {!revealedReviews.has(entry.id) && (
                          <div className="review-mask">
                            {entry.pending ? '待补写' : '点击揭开'}
                          </div>
                        )}
                      </ParticleMask>

                      {revealedReviews.has(entry.id) && (
                        <div className="review-text">
                          {entry.pending ? (
                            <>
                              <p className="pending-badge">稍后写</p>
                              <button className="write-now-btn" onClick={() => openEditReview(entry)}>现在补写</button>
                            </>
                          ) : (
                            <>
                              <p className="stars">{'★'.repeat(entry.rating)}{'☆'.repeat(10 - entry.rating)}</p>
                              <p className="review-body">{entry.review}</p>
                            </>
                          )}
                        </div>
                      )}

                      <div className="entry-actions-overlay" onClick={() => handleEntryClick(entry)}>
                        <span>✦</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 搜索结果弹窗 ── */}
      {showSearchModal && (
        <div className="modal" onClick={() => setShowSearchModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>选择{mediaType === 'movie' ? '影视' : '书籍'}</h2>
            {searchError && <p className="error-msg">{searchError}</p>}
            <div className="poster-grid">
              {searchResults.map(item => (
                <div key={item.id} className="poster-item" onClick={() => selectItem(item)}>
                  <img src={getPosterUrl(item, 'w200')} alt={item.title} />
                  <p>{item.title}</p>
                  {item.author && <p className="item-sub">{item.author}</p>}
                  {item.year && <p className="item-sub">{item.year}</p>}
                </div>
              ))}
            </div>
            <button onClick={() => setShowSearchModal(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* ── 海报三选项弹窗 ── */}
      {showChoiceModal && clickedEntry && (
        <div className="choice-modal-overlay" onClick={() => setShowChoiceModal(false)}>
          <div className="choice-modal" onClick={e => e.stopPropagation()}>
            <div className="choice-poster">
              <img src={clickedEntry.poster} alt={clickedEntry.title} />
            </div>
            <div className="choice-info">
              <h3 className="choice-title">{clickedEntry.title}</h3>
              <p className="choice-date">{new Date(clickedEntry.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="choice-divider"></div>
            <div className="choice-buttons">
              <button className="choice-btn choice-write" onClick={() => { openEditReview(clickedEntry); }}>
                <span className="choice-btn-icon">✎</span>
                <span className="choice-btn-text">写想法</span>
              </button>
              <button className="choice-btn choice-export-image" onClick={() => { exportSingleCard(clickedEntry); }}>
                <span className="choice-btn-icon">🖼️</span>
                <span className="choice-btn-text">海报导出</span>
              </button>
              <button className="choice-btn choice-export-text" onClick={() => { exportTextOnlyCard(clickedEntry); }}>
                <span className="choice-btn-icon">📝</span>
                <span className="choice-btn-text">文字导出</span>
              </button>
              <button className="choice-btn choice-cancel" onClick={() => setShowChoiceModal(false)}>
                <span className="choice-btn-icon">○</span>
                <span className="choice-btn-text">关闭</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 评价弹窗 ── */}
      {showReviewModal && selectedItem && (
        <div className="modal" onClick={abandonEntry}>
          <div className="modal-content review-modal" onClick={e => e.stopPropagation()}>
            <div className="review-poster-wrap">
              <img src={getPosterUrl(selectedItem)} alt={selectedItem.title} className="review-poster-img" />
            </div>
            <h2>《{selectedItem.title}》</h2>
            {selectedItem.year && <p className="item-sub">{selectedItem.year}</p>}

            <div className="review-form">
              <label>评分（1–10）</label>
              <div className="rating-row">
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className={`star ${i < ratingInput ? 'on' : ''}`}
                    onClick={() => setRatingInput(i + 1)}
                  >★</span>
                ))}
              </div>
              <label>我的感想</label>
              <textarea
                placeholder="写下你的感受，或点击「稍后写」留白…"
                value={reviewInput}
                onChange={e => setReviewInput(e.target.value)}
                rows={4}
              />
            </div>

            <div className="review-actions">
              <button className="btn-abandon" onClick={abandonEntry}>放弃</button>
              <button className="btn-later" onClick={saveLater}>稍后写</button>
              <button className="btn-confirm" onClick={confirmEntry}>入库</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 补写评价弹窗 ── */}
      {showEditModal && editingEntry && (
        <div className="modal" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>补写《{editingEntry.title}》</h2>
            <div className="review-form">
              <label>评分（1–10）</label>
              <div className="rating-row">
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className={`star ${i < editRating ? 'on' : ''}`}
                    onClick={() => setEditRating(i + 1)}
                  >★</span>
                ))}
              </div>
              <label>我的感想</label>
              <textarea
                placeholder="写下你的感受…"
                value={editReview}
                onChange={e => setEditReview(e.target.value)}
                rows={4}
              />
            </div>
            <div className="review-actions">
              <button className="btn-abandon" onClick={() => setShowEditModal(false)}>取消</button>
              <button className="btn-confirm" onClick={saveEditReview}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 导出预览 ── */}
      {showExportModal && exportPreview && (
        <div className="export-modal-overlay" onClick={() => { setShowExportModal(false); setExportPreview(null); }}>
          <div className="export-modal" onClick={e => e.stopPropagation()}>
            <div className="export-preview-wrap">
              <img src={exportPreview} alt="export preview" />
            </div>
            <div className="export-actions">
              <button className="export-btn-cancel" onClick={() => { setShowExportModal(false); setExportPreview(null); }}>取消</button>
              <button className="export-btn-download" onClick={downloadPreview}>下载</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
