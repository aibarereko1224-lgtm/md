# 腾讯云 CloudBase 部署指南

## 🎯 两种部署方式

### 方式一：网页控制台（推荐新手）⭐⭐⭐⭐⭐
**优点**: 简单直观，点点鼠标就完成  
**缺点**: 每次更新都要手动上传

### 方式二：命令行工具（推荐开发者）⭐⭐⭐⭐
**优点**: 一次配置，后续一键更新  
**缺点**: 需要熟悉命令行

---

## 📱 方式一：网页控制台部署

### 第 1 步：开通云开发

1. 访问 https://console.cloud.tencent.com/tcb
2. 点击**新建环境**
3. 填写配置：
   - 环境名称: `moondust`
   - 套餐版本: **按量计费**（有免费额度，放心选）
   - 地域: **上海**
4. 点击**立即开通**（约需 1 分钟）

### 第 2 步：开通静态网站托管

1. 环境创建完成后，进入环境
2. 左侧菜单选择**静态网站托管**
3. 点击**开始使用**
4. 授权并点击**开通**

### 第 3 步：上传文件

1. 点击**上传文件**按钮
2. 将以下 3 个文件拖拽进来：
   ✅ index.html
   ✅ manifest.json
   ✅ sw.js
   ```
3. 点击**开始上传**
4. 上传完成！

### 第 4 步：访问网站

1. 点击**设置** tab
2. 找到**默认域名**（类似 `moondust-xxx.tcloudbaseapp.com`）
3. 在浏览器打开：
   ```
   https://你的环境ID.tcloudbaseapp.com/index.html
   ```

🎉 **部署完成！**

---

## 💻 方式二：命令行部署

### 前置准备

确保已安装 Node.js 和 npm：
```bash
node --version  # 应显示版本号
npm --version   # 应显示版本号
```

### 第 1 步：安装 CloudBase CLI

```bash
sudo npm install -g @cloudbase/cli
```

验证安装：
```bash
cloudbase --version
```

### 第 2 步：登录腾讯云

```bash
cloudbase login
```

浏览器会自动打开，使用微信扫码登录。

### 第 3 步：创建环境（如未创建）

```bash
# 列出已有环境
cloudbase env:list

# 如果没有环境，创建一个
cloudbase env:create moondust --alias "Moon Dust"
```

记下环境 ID（例如 `moondust-7g123abc`）

### 第 4 步：初始化配置

在项目目录创建配置文件 `cloudbaserc.json`：
```bash
cd /Users/cakie/Desktop/code
```

创建配置文件：
```json
{
  "envId": "你的环境ID",
  "framework": {
    "name": "moondust",
    "plugins": {
      "client": {
        "use": "@cloudbase/framework-plugin-website",
        "inputs": {
          "buildCommand": "",
          "outputPath": "./",
          "cloudPath": "/"
        }
      }
    }
  }
}
```

### 第 5 步：部署

```bash
# 一键部署
cloudbase hosting deploy ./ -e 你的环境ID
```

或者使用我们提供的脚本：
```bash
./deploy-tencent.sh
```

### 第 6 步：访问网站

部署成功后会显示访问地址：
```
https://你的环境ID.tcloudbaseapp.com/index.html
```

---

## 🔄 后续更新

### 网页控制台更新
1. 进入**静态网站托管** → **文件管理**
2. 选择要更新的文件 → 点击**删除**
3. 重新上传新文件

### 命令行更新（推荐）
修改代码后，执行：
```bash
cloudbase hosting deploy ./ -e 你的环境ID
```

或直接运行：
```bash
./deploy-tencent.sh
```

---

## 🌐 绑定自定义域名（可选）

### 前提条件
- 已有域名并完成 ICP 备案

### 配置步骤
1. 进入**静态网站托管** → **设置**
2. 点击**添加域名**
3. 输入域名: `moondust.yourdomain.com`
4. 配置 CNAME：
   - 到域名 DNS 管理页面
   - 添加 CNAME 记录：
     ```
     moondust  CNAME  你的环境ID.tcloudbaseapp.com
     ```
5. 等待生效（约 10 分钟）
6. 自动配置 HTTPS 证书

---

## 💰 费用说明

### 免费额度（每月）
- 存储空间: 5 GB
- 流量: 5 GB
- CDN 回源流量: 5 GB

### 超出后计费
- 存储: ¥0.043/GB/天
- CDN 流量: ¥0.18/GB

**个人项目预估**: 月费用 ¥0（在免费额度内）

---

## 🛠️ 常见问题

### Q: 上传后访问 404？
**A**: 检查文件路径，确保文件在根目录

### Q: 如何查看访问统计？
**A**: 控制台 → 统计分析 → 静态网站

### Q: 如何删除环境？
**A**: 环境设置 → 底部红色按钮 → 销毁环境

### Q: 命令行登录失败？
**A**: 
1. 检查网络连接
2. 重新执行 `cloudbase login`
3. 使用微信扫码登录

---

## 📞 技术支持

- 官方文档: https://docs.cloudbase.net
- 工单支持: https://console.cloud.tencent.com/workorder
- 社区论坛: https://cloud.tencent.com/developer/ask

---

## ✨ 优化建议

### 1. 开启 CDN 加速（默认已开启）
腾讯云 CloudBase 自动配置 CDN，国内访问速度极快。

### 2. 配置缓存策略
在**设置**页面配置：
- HTML 文件: 不缓存
- JS/CSS: 缓存 7 天
- 图片: 缓存 30 天

### 3. 监控访问量
定期查看**统计分析**，了解用户使用情况。

---

🎉 **部署完成，享受你的 Moon Dust 吧！**
