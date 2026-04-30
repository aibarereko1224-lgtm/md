#!/bin/bash
# Moon Dust - 腾讯云 CloudBase 部署脚本

echo "🌙 Moon Dust 腾讯云部署助手"
echo "================================"

# 1. 检查并安装 CloudBase CLI
if ! command -v cloudbase &> /dev/null; then
    echo "📦 正在安装 CloudBase CLI..."
    sudo npm install -g @cloudbase/cli

    if [ $? -ne 0 ]; then
        echo "❌ 安装失败，请手动执行："
        echo "   sudo npm install -g @cloudbase/cli"
        exit 1
    fi
fi

echo "✅ CloudBase CLI 已就绪"
echo ""

# 2. 登录腾讯云
echo "🔐 请登录腾讯云账号..."
cloudbase login

if [ $? -ne 0 ]; then
    echo "❌ 登录失败"
    exit 1
fi

echo "✅ 登录成功"
echo ""

# 3. 获取环境 ID
echo "📋 您的云开发环境列表："
cloudbase env:list

echo ""
echo "请输入您的环境 ID（例如: moondust-xxx）："
read -p "环境 ID: " ENV_ID

if [ -z "$ENV_ID" ]; then
    echo "❌ 环境 ID 不能为空"
    exit 1
fi

# 4. 部署静态网站
echo ""
echo "🚀 开始部署到环境: $ENV_ID"
echo ""

cloudbase hosting deploy ./ -e $ENV_ID

if [ $? -eq 0 ]; then
    echo ""
    echo "✨ 部署成功！"
    echo ""
    echo "🌐 访问地址："
    echo "   https://${ENV_ID}.tcloudbaseapp.com/moondust.html"
    echo ""
    echo "📱 也可以访问："
    echo "   https://${ENV_ID}.tcloudbaseapp.com/"
    echo ""
else
    echo "❌ 部署失败"
    exit 1
fi
