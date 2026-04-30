/* ============================================
   Utils - 工具函数
   ============================================ */

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 获取季节名称
 */
export function getSeason(date = new Date()) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * 获取季节显示名称
 */
export function getSeasonName(season) {
  const names = {
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    winter: 'Winter'
  };
  return names[season] || season;
}

/**
 * 获取月份名称
 */
export function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month] || '';
}

/**
 * 格式化日期
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 获取相对时间
 */
export function getRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return formatDate(dateString);
  } else if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}

/**
 * 分组记录
 */
export function groupRecords(records) {
  const monthMap = {};

  records.forEach(r => {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap[key]) {
      monthMap[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
    }
    monthMap[key].items.push(r);
  });

  const sorted = Object.values(monthMap).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const groups = [];
  let buffer = [];

  sorted.forEach(g => {
    if (g.items.length >= 3) {
      if (buffer.length > 0) {
        groups.push(...mergeToSeasons(buffer));
        buffer = [];
      }
      groups.push({
        label: `${getMonthName(g.month)} ${g.year}`,
        items: g.items
      });
    } else {
      buffer.push(g);
    }
  });

  if (buffer.length > 0) {
    groups.push(...mergeToSeasons(buffer));
  }

  return groups;
}

/**
 * 合并到季节分组
 */
export function mergeToSeasons(monthGroups) {
  if (monthGroups.length === 0) return [];

  const seasonMap = {};
  monthGroups.forEach(g => {
    const season = getSeason(new Date(g.year, g.month));
    if (!seasonMap[season]) {
      seasonMap[season] = { season, year: g.year, items: [] };
    }
    seasonMap[season].items.push(...g.items);
  });

  return Object.values(seasonMap).map(s => ({
    label: `${getSeasonName(s.season)} ${s.year}`,
    items: s.items
  }));
}

/**
 * 创建粒子效果
 */
export function createParticle(canvas, config = {}) {
  const {
    density = 150,
    size = 1.2,
    color = 'rgba(201, 168, 124, 1)',
    speed = 0.08,
    friction = 0.96
  } = config;

  const wrapper = canvas.parentElement;
  const width = canvas.width = wrapper.offsetWidth;
  const height = canvas.height = wrapper.offsetHeight;

  const area = width * height;
  const count = Math.floor((area / 8000) * density);

  const particles = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    particles.push({
      x, y,
      baseX: x, baseY: y,
      vx: 0, vy: 0,
      size: Math.random() * size + 0.5,
      opacity: Math.random() * 0.25 + 0.05
    });
  }

  let isRevealed = false;
  let exploding = false;
  let gathering = false;

  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, width, height);

    if (!isRevealed) {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.97)';
      ctx.fillRect(0, 0, width, height);

      particles.forEach(p => {
        if (!gathering) {
          p.vx += (Math.random() - 0.5) * speed;
          p.vy += (Math.random() - 0.5) * speed;
          p.vx *= friction;
          p.vy *= friction;
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 2) p.vx += 0.1;
          if (p.x > width - 2) p.vx -= 0.1;
          if (p.y < 2) p.vy += 0.1;
          if (p.y > height - 2) p.vy -= 0.1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color.replace('1)', `${p.opacity})`);
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
      const dx = p.x - width / 2;
      const dy = p.y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speedMultiplier = 6 + Math.random() * 10;
      p.vx = (dx / dist) * speedMultiplier;
      p.vy = (dy / dist) * speedMultiplier;
    });

    setTimeout(() => {
      isRevealed = true;
      exploding = false;
    }, 600);
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
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.88;
        p.vy *= 0.88;
        if (Math.abs(p.baseX - p.x) > 1 || Math.abs(p.baseY - p.y) > 1) done = false;
        p.opacity = Math.min(0.3, p.opacity + 0.03);
      });
      if (!done) requestAnimationFrame(animate);
      else {
        gathering = false;
        isRevealed = false;
      }
    };
    animate();
  }

  const handleClick = (e) => {
    e.stopPropagation();
    if (isRevealed) {
      gather();
    } else {
      explode();
    }
  };

  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('touchend', handleClick);

  return { explode, gather };
}

/**
 * Toast通知
 */
export function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
    return true;
  } catch (error) {
    showToast('复制失败', 'error');
    return false;
  }
}

/**
 * 下载文件
 */
export function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 深拷贝
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}