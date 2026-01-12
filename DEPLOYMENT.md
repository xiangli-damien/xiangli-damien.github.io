# 部署指南 / Deployment Guide

## 🎯 你的仓库信息

- **仓库名**: `xiangli-damien.github.io`
- **访问地址**: `https://xiangli-damien.github.io`
- **GitHub 用户名**: `xiangli-damien`

## 📋 快速替换现有仓库

你已经有一个仓库，想要用新项目替换它。有两种方式：

### 方式 1: 使用脚本（推荐）

```bash
./replace-repo.sh
```

脚本会引导你完成所有步骤。

### 方式 2: 手动执行

见下面的详细步骤。

## 部署步骤 / Deployment Steps

### ⚠️ 重要：替换现有仓库

**这会完全替换 `xiangli-damien.github.io` 仓库的所有内容！**

### 1. 提交当前项目

```bash
cd /Users/lixiang/Downloads/phd-linux-lens-v7-updated

# 1. 添加所有文件
git add .

# 2. 提交
git commit -m "Replace with new personal website design"

# 3. 重命名分支为 main
git branch -M main
```

### 2. 连接到现有仓库

```bash
# 添加远程仓库
git remote add origin https://github.com/xiangli-damien/xiangli-damien.github.io.git

# 如果已经存在，先删除再添加
# git remote remove origin
# git remote add origin https://github.com/xiangli-damien/xiangli-damien.github.io.git
```

### 3. 强制推送替换

**⚠️ 这会覆盖旧仓库的所有内容！**

```bash
git push -u origin main --force
```

### 3. 启用 GitHub Pages

1. 在 GitHub 仓库页面，点击 `Settings`
2. 左侧菜单找到 `Pages`
3. 在 `Source` 部分：
   - 选择 `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. 点击 `Save`

### 4. 检查 GitHub Pages 设置

1. 访问 https://github.com/xiangli-damien/xiangli-damien.github.io
2. 点击 `Settings` → `Pages`
3. 确认设置：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. 如果设置不对，修改后点击 `Save`

### 5. 等待部署

- GitHub 通常需要 1-2 分钟来部署
- 部署完成后，访问 **https://xiangli-damien.github.io**

### 6. sitemap.xml 已更新

`sitemap.xml` 已经更新为正确的域名，无需修改。

## 后续更新 / Future Updates

每次修改后：

```bash
git add .
git commit -m "Update: description of changes"
git push
```

GitHub Pages 会自动重新部署（通常需要 1-2 分钟）。

## 注意事项 / Notes

1. **`.nojekyll` 文件已存在**：这确保 GitHub Pages 不会使用 Jekyll 处理，直接提供静态文件
2. **资源路径**：如果使用自定义仓库名，需要修改所有 HTML 中的路径（添加仓库名前缀）
3. **HTTPS**：GitHub Pages 自动提供 HTTPS
4. **自定义域名**：可以在 Settings → Pages → Custom domain 中添加自己的域名

## 故障排除 / Troubleshooting

- **404 错误**：检查仓库名是否正确，是否启用了 Pages
- **资源加载失败**：检查路径是否正确（特别是使用自定义仓库名时）
- **样式丢失**：确保 `.nojekyll` 文件存在
