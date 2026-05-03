# Moon Dust 部署指南

## 📦 快速部署方案对比

| 方案 | 成本 | 难度 | 国内访问速度 | 推荐度 |
|-----|------|------|------------|--------|
| **Vercel** | 免费 | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **腾讯云 COS** | 免费额度 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **阿里云 OSS** | ~¥0.1/月 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **微信小程序** | 免费 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🚀 推荐：Vercel 一键部署

### 前置准备
1. 注册 GitHub 账号
2. 注册 Vercel 账号（可用 GitHub 登录）

### 部署步骤

```bash
# 1. 创建 Git 仓库
cd /Users/cakie/Desktop/code
git init
git add .
git commit -m "Initial commit"

# 2. 推送到 GitHub
# (在 GitHub 创建新仓库后)
git remote add origin https://github.com/你的用户名/moondust.git
git branch -M main
git push -u origin main

# 3. Vercel 部署
# 访问 vercel.com → Import Project → 选择仓库 → Deploy
```

### 访问地址
部署完成后获得：`https://moondust.vercel.app`

---

## ☁️ 阿里云 OSS 部署

### 1. 开通 OSS
访问：https://oss.console.aliyun.com

### 2. 创建 Bucket
- 区域：华东（离你最近的）
- 读写权限：**公共读**
- 版本控制：关闭

### 3. 上传文件
```bash
# 使用 ossutil 工具上传
ossutil cp index.html oss://你的bucket名/
ossutil cp index.html oss://你的bucket名/
ossutil cp manifest.json oss://你的bucket名/
ossutil cp sw.js oss://你的bucket名/
```

### 4. 配置静态网站
- Bucket设置 → 静态页面
- 默认首页：`index.html`
- 默认404页：`index.html`

### 5. 绑定域名（可选）
- 需要已备案域名
- 传输管理 → 域名管理 → 绑定域名

**费用预估**:
- 存储：0.1GB × ¥0.12/GB/月 = ¥0.012
- 流量：1GB × ¥0.5/GB = ¥0.5
- **月成本**: ~¥0.5（低流量情况）

---

## 🐧 腾讯云 CloudBase 部署

### 1. 开通云开发
访问：https://console.cloud.tencent.com/tcb

### 2. 创建环境
- 环境名称：moondust
- 套餐版本：**免费版**
- 区域：上海

### 3. 部署静态网站
```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署
tcb hosting deploy /Users/cakie/Desktop/code -e moondust环境ID
```

### 4. 访问地址
自动生成：`https://moondust-xxx.tcloudbaseapp.com`

**免费额度**:
- 存储：5GB
- 流量：5GB/月
- CDN：免费

---

## 📱 微信小程序改造方案

### 需要改造的核心文件

#### 1. 数据存储 (Storage.js)
```javascript
// ❌ 原代码
localStorage.setItem('moondust_records', JSON.stringify(records));

// ✅ 小程序版本
wx.setStorageSync('moondust_records', records);
```

#### 2. 网络请求
```javascript
// ❌ 原代码
const response = await fetch(url);
const data = await response.json();

// ✅ 小程序版本
wx.request({
  url: url,
  success: (res) => {
    const data = res.data;
  }
});
```

#### 3. Canvas 导出
```javascript
// ❌ 原代码
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// ✅ 小程序版本
const query = wx.createSelectorQuery();
query.select('#myCanvas')
  .fields({ node: true, size: true })
  .exec((res) => {
    const canvas = res[0].node;
    const ctx = canvas.getContext('2d');
  });
```

### 工作量评估
- 代码改造：3天
- 小程序注册审核：1-2周
- **总计**: 约1个月

### 是否值得？
- ✅ 如果目标用户在微信生态 → **值得**
- ❌ 如果只是个人使用 → **不建议**（Web版更方便）

---

## 🎯 最终推荐

### 个人使用
**Vercel** - 免费、简单、全球访问

### 国内分享
**腾讯云 CloudBase** - 免费、速度快、可转小程序

### 商业项目
**阿里云 OSS + CDN** - 稳定、可控、支持大流量

---

## 📞 技术支持

部署过程中遇到问题，可查看：
- Vercel 文档: https://vercel.com/docs
- 阿里云帮助: https://help.aliyun.com
- 腾讯云文档: https://cloud.tencent.com/document

