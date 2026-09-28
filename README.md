# Xiang Li — 个人网站

一座用手绘墨线画出来的**档案馆**：一条没有尽头的走廊，两侧是档案柜，每个栏目是走廊深处的一道门。
去往一个栏目时，小人沿走廊走过去，镜头跟着；页面内容不等它走完，半秒内就出现在前面。

- 线上地址：<https://xiangli-damien.github.io/>
- 技术：[Astro](https://astro.build/)（静态输出，页面间用 Astro 自带的 ClientRouter 切换）+ Markdown / MDX + TypeScript，无前端框架、无运行时 CDN
- 设计规则：[docs/DESIGN.md](docs/DESIGN.md)
- 写作指南：[docs/WRITING.md](docs/WRITING.md)

## 开始

需要 Node.js 22.12 或更高（仓库里的 `.nvmrc` 指向 24，`nvm use` 即可）。

```bash
nvm use
npm install
npm run dev
```

打开 <http://localhost:4321/>。草稿（`draft: true`）只在 `npm run dev` 时可见。

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地预览，保存即刷新 |
| `npm run build` | 生成 `dist/`（上线内容） |
| `npm run preview` | 预览 `dist/` |
| `npm run check` | 类型与内容字段检查 |
| `npm run check:links` | 构建后检查站内链接是否都有去处 |
| `npm run new …` | 新建笔记 / 生活记录 / 论文 / 项目 / 新闻，见下 |

## 内容在哪里

| 要改什么 | 编辑位置 |
| --- | --- |
| 姓名、单位、邮箱、链接、简介、头像、页脚文字 | `src/data/profile.yaml` |
| 首页新闻 | `src/data/news.yaml` |
| 首页看板的频道（每个作品一条） | `src/data/board.yaml` |
| 履历（教育、经历、教学、荣誉、技能） | `src/data/cv.yaml` |
| 「生活」页的说明文字 | `src/data/life.yaml` |
| 笔记 / 博客 | `src/content/notes/<分类>/<文件名>.md` |
| 生活（杂文、照片、电影、日志） | `src/content/life/<文件名>.md` |
| 论文 | `src/content/publications/<文件名>.md` |
| 项目 | `src/content/projects/<文件名>.md` |
| 头像 | `src/assets/portraits/` |
| 论文、项目配图 | `src/assets/figures/` |
| 简历 PDF | `public/assets/cv/Xiang_Li_Resume.pdf` |
| 不想被处理的大文件（视频等） | `public/media/` |

笔记有四个分类，对应四个文件夹：

| 文件夹 | 分类 |
| --- | --- |
| `course` | 课程笔记 |
| `reading` | 读书笔记 |
| `paper` | 论文笔记 |
| `field` | 平时笔记 |

## 新建内容

```bash
npm run new note "Attention is all you need" -- --category paper --tags transformers,attention
npm run new note "随手记" -- --category field --lang zh
npm run new note "CS 336 Lecture 3" -- --category course --folder   # 建文件夹，图片视频放在旁边
npm run new life "A weekend in Hyde Park" -- --kind photo
npm run new pub "Title of the paper" -- --year 2026 --venue ACL
npm run new project "Name of the project" -- --tags python,systems
npm run new news "**Paper accepted** at ACL 2026" -- --tag PAPER
```

新建的笔记默认是草稿；写完后删掉 `draft: true` 即发布。

## 在文章里放图片、GIF、视频

都用 Markdown 的图片语法，文件放在文章旁边即可：

```md
![说明文字](./figure.png "图 1. 引号里是图注")
![一个动图](./loop.gif)
![一段视频](./demo.mp4)
![一个讲座](https://www.youtube.com/watch?v=aircAruvnKk)
![B 站视频](https://www.bilibili.com/video/BV1xx411c7mD)
```

公式用 `$…$` 和 `$$…$$`，代码用三个反引号加语言名。完整示例见
`src/content/notes/field/markdown-cheatsheet.mdx`（它是草稿，只在本地可见）。

## 发布

仓库带有 `.github/workflows/deploy.yml`：推送到 `main` 后，GitHub Actions 自动构建并发布。

**第一次需要手动设置一次**：GitHub 仓库 → Settings → Pages → Build and deployment →
Source 选择 **GitHub Actions**。

旧地址仍然可用：`/misc/` 会转到 `/cv/`（原来的 Misc 页主体是履历），`/blog/post.html?slug=…` 会转到 `/blog/…/`。

## 代码结构

```text
src/
  content.config.ts      内容集合与字段定义（写错字段会在构建时报错）
  content/               笔记、生活、论文、项目（Markdown）
  data/                  个人资料、新闻、履历、看板频道（YAML）
  assets/                头像、配图、字体
  layouts/Room.astro     每个页面的外框：系统栏、走廊、页面、页脚
  components/
    chrome/              窗口、系统栏、走廊、页眉、快速查找
    home/                首页四个部分：身份、简介、看板、新闻
    read/                文章阅读页与目录
  pages/                 路由：/ /pubs/ /blog/ /projects/ /life/ /cv/ 404 rss.xml
  scripts/
    archive/             走廊：尺寸(plan)、透视场景(scene)、档案柜(walls)、粗糙笔触、小人、页面间行走(hall)
    page.ts              onPage：页面脚本的入口（页面切换时不会重新加载文档）
    board/               看板：画布引擎、绘图工具、每个作品一个绘图程序
    desk/                窗口管理（拖动、缩放、卷起、关闭）、菜单、筛选
  styles/                tokens（颜色字体）、base、chrome、kit、page、prose
  lib/                   内容查询、格式化、Markdown 插件
public/                  原样发布的文件：简历、媒体、旧地址跳转页
scripts/new.mjs          新建内容的命令
docs/                    设计规则与写作指南
```

## 界面习惯

- **走廊**：顶栏始终列出全部栏目，红色小标记表示现在站在走廊的哪个位置；也可以点门楣上的字。
  窗口左上角的方框或左上角名字回到入口。走过的门在身后，所以回去靠顶栏。
- **窗口**（首页）：拖标题栏移动，双击标题栏卷起，右下角拖动改变大小；
  「Windows」菜单可重新打开关掉的窗口，「View → Tidy the desk」恢复布局。
- **键盘**：`Ctrl/⌘ K` 快速查找，`/` 聚焦当前页的搜索框；标题栏获得焦点后方向键移动窗口。
- **看板**：点数字键切换作品；焦点在看板上时，键盘 `1`–`9` 直接选作品，左右方向键前后切换；
  `/#work=raft` 这样的地址直接打开某个作品。
- **外观**：View 菜单里有「Daylight / After hours」。网站不会自己变暗。
- 系统设置了「减少动态效果」时，页面即时切换、不再行走，所有动画变为静止画面。
- 没有 JavaScript 时，链接照常工作，走廊显示为一列栏目链接。

## 字体与许可

字体全部随站点发布，不从外部加载：
Doto、Departure Mono、Courier Prime、Reenie Beanie，均为 SIL Open Font License 1.1。

## 其他

- `serverless/` 是一个可选的 Cloudflare 访问统计实验，网站不依赖它。
- `.archive/` 保存了这次重构之前的工作区快照（不进入 Git）。

© Xiang Li. All rights reserved.
