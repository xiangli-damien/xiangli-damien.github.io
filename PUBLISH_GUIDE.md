# 📖 详细发布指南

## 🔧 已修复的问题

1. ✅ **数据加载错误处理**：改进了错误信息显示，更容易调试
2. ✅ **隐藏猫猫探头动画**：已移除 `data-cat="peek"` 属性
3. ✅ **basePath 优化**：改进了 GitHub Pages 路径检测

## 🚀 重新发布步骤

### 第一步：检查当前状态

```bash
cd /Users/lixiang/Downloads/phd-linux-lens-v7-updated
git status
```

### 第二步：提交修复

```bash
# 添加所有更改
git add .

# 提交
git commit -m "Fix: Improve error handling and remove cat peek animation"

# 推送到 GitHub
git push origin main
```

### 第三步：检查 GitHub Pages 设置

1. **访问仓库**：https://github.com/xiangli-damien/xiangli-damien.github.io
2. **点击 `Settings`**（仓库设置）
3. **找到 `Pages`**（左侧菜单）
4. **确认设置**：
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`（不是 `master`）
   - **Folder**: `/ (root)`
5. **如果设置不对，修改后点击 `Save`**

### 第四步：等待部署

- ⏱️ **等待时间**：通常 1-2 分钟
- 📊 **查看部署状态**：
  - 点击仓库的 `Actions` 标签页
  - 查看是否有部署任务运行
  - 绿色 ✓ 表示成功，红色 ✗ 表示失败

### 第五步：访问网站

部署完成后访问：
- 🌐 **https://xiangli-damien.github.io**

### 第六步：检查浏览器控制台

如果还有问题：

1. **打开浏览器开发者工具**：
   - Chrome/Edge: `F12` 或 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: `F12` 或 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Safari: `Cmd+Option+I` (Mac)

2. **查看 Console 标签页**：
   - 查看是否有红色错误信息
   - 错误信息会显示具体是哪个文件加载失败

3. **查看 Network 标签页**：
   - 刷新页面
   - 查看哪些请求失败了（红色）
   - 检查失败的请求 URL 是否正确

## 🐛 常见问题排查

### 问题 1: "Failed to load data"

**可能原因**：
- 数据文件路径不正确
- GitHub Pages 还没部署完成
- 浏览器缓存问题

**解决方法**：
1. 等待 2-3 分钟让 GitHub Pages 完全部署
2. 硬刷新浏览器：`Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)
3. 检查浏览器控制台的错误信息
4. 确认 `data/` 文件夹中的所有 JSON 文件都已推送

### 问题 2: 样式丢失

**解决方法**：
- 确认 `.nojekyll` 文件存在（已创建）
- 检查 `assets/css/system.css` 是否正常加载

### 问题 3: 404 错误

**解决方法**：
- 确认 GitHub Pages 已启用
- 确认分支是 `main`（不是 `master`）
- 等待几分钟让部署完成

## 📝 验证清单

发布后，检查以下内容：

- [ ] 首页正常显示
- [ ] 导航栏工作正常
- [ ] Blog 页面可以访问
- [ ] Projects 页面可以访问
- [ ] Pubs 页面可以访问
- [ ] Misc 页面可以访问
- [ ] 主题切换（THEME）工作
- [ ] 视觉效果切换（FX）工作
- [ ] Footer 显示在页面底部
- [ ] 没有猫猫探头动画

## 🔄 后续更新流程

每次修改后：

```bash
# 方式 1: 使用脚本
./deploy.sh "Update: description"

# 方式 2: 手动执行
git add .
git commit -m "Update: description"
git push origin main
```

然后等待 1-2 分钟让 GitHub Pages 自动重新部署。

## 📞 需要帮助？

如果遇到问题：
1. 检查浏览器控制台的错误信息
2. 检查 GitHub 仓库的 `Actions` 标签页查看部署日志
3. 确认所有文件都已正确推送到 GitHub
