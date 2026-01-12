#!/bin/bash

# 部署脚本 - 将网站推送到 GitHub Pages
# Usage: ./deploy.sh "commit message"

# 检查是否有提交信息
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh \"commit message\""
    exit 1
fi

# 添加所有文件
git add .

# 提交
git commit -m "$1"

# 推送到 GitHub
git push origin main

echo ""
echo "✅ 已推送到 GitHub！"
echo "📝 等待 1-2 分钟让 GitHub Pages 部署..."
echo "🌐 访问: https://xiangli-damien.github.io"
