# 替换现有 GitHub 仓库指南

你已经有一个仓库：`xiangli-damien/xiangli-damien.github.io`

这个指南将帮你用新项目完全替换旧项目。

## ⚠️ 重要提示

**这会完全替换旧仓库的所有内容！** 如果旧仓库有重要内容需要保留，请先备份。

## 替换步骤

### 1. 提交当前项目

```bash
cd /Users/lixiang/Downloads/phd-linux-lens-v7-updated

# 添加所有文件
git add .

# 首次提交
git commit -m "Replace with new personal website design"

# 重命名分支为 main（如果当前是 master）
git branch -M main
```

### 2. 连接到现有仓库

```bash
# 添加远程仓库
git remote add origin https://github.com/xiangli-damien/xiangli-damien.github.io.git

# 或者如果已经存在，先删除再添加
git remote remove origin
git remote add origin https://github.com/xiangli-damien/xiangli-damien.github.io.git
```

### 3. 强制推送替换旧内容

**⚠️ 这会覆盖旧仓库的所有内容！**

```bash
# 强制推送到 main 分支（替换所有旧内容）
git push -u origin main --force
```

**注意：** `--force` 标志会强制覆盖远程仓库。确保你真的想这样做！

### 4. 检查 GitHub Pages 设置

1. 访问 https://github.com/xiangli-damien/xiangli-damien.github.io
2. 点击 `Settings` → `Pages`
3. 确认设置：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. 如果设置不对，修改后点击 `Save`

### 5. 等待部署

- GitHub Pages 通常需要 1-2 分钟来部署
- 访问 https://xiangli-damien.github.io 查看新网站

## 一键执行脚本

我已经创建了 `replace-repo.sh` 脚本，你可以运行：

```bash
./replace-repo.sh
```

## 后续更新

每次修改后：

```bash
git add .
git commit -m "Update: description"
git push
```

或者使用 `deploy.sh`：

```bash
./deploy.sh "Update: description"
```

## 访问地址

部署完成后，你的网站将在：
- **https://xiangli-damien.github.io**

## 故障排除

- **404 错误**：等待几分钟让 GitHub Pages 部署完成
- **样式丢失**：确保 `.nojekyll` 文件存在（已创建）
- **资源加载失败**：检查浏览器控制台的错误信息
