#!/bin/bash

# 替换现有 GitHub 仓库的脚本
# 这会完全替换 xiangli-damien/xiangli-damien.github.io 的内容

echo "⚠️  警告：这将完全替换远程仓库的内容！"
echo "仓库：xiangli-damien/xiangli-damien.github.io"
echo ""
read -p "确认要继续吗？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 1
fi

# 添加所有文件
echo "📦 添加文件..."
git add .

# 提交
echo "💾 提交更改..."
git commit -m "Replace with new personal website design" || {
    echo "❌ 提交失败，可能没有更改需要提交"
    exit 1
}

# 重命名分支为 main
echo "🔄 重命名分支为 main..."
git branch -M main

# 检查是否已有远程仓库
if git remote get-url origin &>/dev/null; then
    echo "🔄 更新远程仓库地址..."
    git remote set-url origin https://github.com/xiangli-damien/xiangli-damien.github.io.git
else
    echo "➕ 添加远程仓库..."
    git remote add origin https://github.com/xiangli-damien/xiangli-damien.github.io.git
fi

# 强制推送
echo "🚀 推送到 GitHub（强制覆盖）..."
git push -u origin main --force

echo ""
echo "✅ 完成！"
echo "📝 等待 1-2 分钟让 GitHub Pages 部署..."
echo "🌐 访问: https://xiangli-damien.github.io"
echo ""
echo "💡 如果 GitHub Pages 没有自动启用，请到仓库 Settings → Pages 中启用"
