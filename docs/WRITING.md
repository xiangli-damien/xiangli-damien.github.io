# 写作指南

所有内容都是仓库里的纯文本文件：文章是 Markdown，资料是 YAML。
没有数据库，没有后台；改文件、预览、推送，就上线了。

```bash
npm run dev      # 边写边看：http://localhost:4321/
```

## 1. 笔记（博客）

笔记放在 `src/content/notes/`，按分类分四个文件夹：

| 文件夹 | 分类 | 适合放什么 |
| --- | --- | --- |
| `course/` | 课程笔记 | 一门课、一讲一篇 |
| `reading/` | 读书笔记 | 书、阅读清单 |
| `paper/` | 论文笔记 | 一篇论文精读 |
| `field/` | 平时笔记 | 实验记录、零散想法 |

### 新建

```bash
npm run new note "标题" -- --category paper --tags a,b --lang zh
```

会生成 `src/content/notes/paper/<文件名>.md`。**文件名就是网址**：
`attention-is-all-you-need.md` → `/blog/attention-is-all-you-need/`。
中文标题会用日期做文件名，可以加 `--slug my-name` 自己指定。

文章带图、带视频时，加 `--folder`：

```bash
npm run new note "CS 336 Lecture 3" -- --category course --folder
```

生成的是一个文件夹，媒体文件直接放进去：

```text
src/content/notes/course/cs-336-lecture-3/
  index.md
  attention.png
  demo.mp4
```

### 文章开头的字段

```yaml
---
title: "标题"
summary: "一句话摘要，显示在列表和标题下方"
date: 2026-09-28
updated: 2026-10-02        # 可选：修订日期
category: paper            # course | reading | paper | field
tags: [transformers, attention]
lang: zh                   # en | zh，决定正文字体与排版
cover: ./cover.jpg         # 可选：分享时的预览图
readingMinutes: 12         # 可选：不写会自动估算
draft: true                # 草稿只在本地可见；删掉这一行即发布
---
```

字段写错（比如分类拼错、日期格式不对）时，预览和构建会直接报错并指出是哪个文件。

## 2. 正文怎么写

普通 Markdown 都支持：标题、列表、引用、表格、脚注、任务列表、删除线。
完整可复制的示例在 `src/content/notes/field/markdown-cheatsheet.mdx`。

### 图片

```md
![替代文字](./plot.png)
![替代文字](./plot.png "图 1. 引号里的文字会成为图注")
```

放在文章旁边的图片会自动压缩并生成合适的尺寸。

### GIF

```md
![轨迹演示](./trajectory.gif "动图保持动画，不会被压成静态图")
```

### 视频与音频

```md
![实验录屏](./demo.mp4)
![一段录音](./talk.mp3)
```

支持 `.mp4 .webm .mov .m4v .ogv .mp3 .wav .ogg .m4a`。
很大的视频建议放到 `public/media/`，然后写绝对路径：

```md
![实验录屏](/media/demo.mp4)
```

### 嵌入在线视频

直接贴网址即可，支持 YouTube、Bilibili、Vimeo：

```md
![讲座](https://www.youtube.com/watch?v=aircAruvnKk)
![讲座](https://www.bilibili.com/video/BV1xx411c7mD)
```

### 公式

```md
行内 $h_\ell = h_{\ell-1} + f_\ell(h_{\ell-1})$

$$
\kappa(t) = \frac{\lVert \dot{\gamma}(t) \times \ddot{\gamma}(t) \rVert}{\lVert \dot{\gamma}(t) \rVert^{3}}
$$
```

### 代码

````md
```python
def curvature(h):
    v = h[1:] - h[:-1]
    return (v[1:] - v[:-1]).norm(dim=-1)
```
````

### 目录

文章里有三个以上的二、三级标题（`##`、`###`）时，右侧会自动出现目录。

## 3. 新闻

编辑 `src/data/news.yaml`，或者：

```bash
npm run new news "**Paper accepted** at ACL 2026" -- --tag PAPER --date 2026-05
```

```yaml
- date: 2026-05            # YYYY-MM 或 YYYY-MM-DD
  tag: PAPER               # 可选
  text: "**Paper accepted** at ACL 2026"
  url: https://…           # 可选：整条变成链接
```

顺序不用管，页面会按日期从新到旧排。

## 4. 论文

```bash
npm run new pub "Title of the paper" -- --year 2026 --venue ACL
```

```yaml
---
title: Title of the paper
authors:
  - First Author
  - Xiang Li              # 你的名字会自动加粗加下划线
venue: ACL
year: 2026
type: conference          # conference | journal | workshop | preprint | thesis
status: Oral              # 可选
links:
  url: ""                 # 留空的链接不会显示
  pdf: https://…
  doi: ""
  code: https://github.com/…
figure: ../../assets/figures/my-figure.png
figureAlt: 图里画的是什么
abstract: 摘要
bibtex: |
  @inproceedings{…}
---
```

## 5. 项目

```bash
npm run new project "Name" -- --year 2026 --tags python,systems
```

字段之后的正文就是项目介绍。`order` 越小越靠前，`featured: true` 会标为重点。

## 6. 首页看板

看板每个频道对应一个作品，写在 `src/data/board.yaml`：

```yaml
- id: raft-message-queue      # 与项目文件名一致时，项目页会链接到这里
  kind: project               # research | project | publication
  title: Raft Message Queue (RMQ)
  short: RAFT
  year: "2024"
  question: 可选的一句问题
  blurb: 一两句介绍，可以用 **加粗**
  program: raft               # 用哪个动画
  href: /projects/#raft-message-queue
  links:
    - label: Code
      href: https://github.com/…
```

现有的动画（`program`）：
`trajectories` `clusters` `cells` `raft` `city` `rpc` `shell` `forecast` `dispatch`。

想画新的：在 `src/scripts/board/programs/` 里新建一个文件（照着 `trajectories.ts` 写），
再到 `src/scripts/board/registry.ts` 加一行。
本地调试地址：`http://localhost:4321/lab/board/?p=<名字>`。

## 7. 生活

```bash
npm run new life "标题" -- --kind essay --lang zh
```

`kind` 可以是 `essay`（杂文）、`photo`（照片）、`film`（电影）、`log`（日志）。
写法与笔记相同。「生活」页顶部的说明文字在 `src/data/life.yaml`。

## 8. 个人资料与履历

- `src/data/profile.yaml`：姓名、单位、所在地、邮箱、链接、简介、头像列表、页脚的格言与署名。
- `src/data/cv.yaml`：教育、经历、教学、荣誉、技能。
- 简历 PDF：替换 `public/assets/cv/Xiang_Li_Resume.pdf`（文件名不变，链接就不用改）。
- 头像：图片放进 `src/assets/portraits/`，再把文件名写进 `profile.yaml` 的 `portraits`。

## 9. 发布

```bash
npm run build        # 可选：本地先确认能构建
git add -A
git commit -m "Add note: …"
git push
```

推送到 `main` 后 GitHub Actions 会自动构建发布，一两分钟后线上更新。
也可以直接在 GitHub 网页上编辑 Markdown 文件，保存即发布。

## 常见问题

**预览里看得到，线上没有？** 文章还带着 `draft: true`。

**图片不显示？** 相对路径要以 `./` 或 `../` 开头，并且文件确实在那个位置；文件名区分大小写。

**构建报错 “Invalid frontmatter”？** 看报错里指出的文件和字段，多半是分类拼错或日期格式不对。

**想改颜色、字体、间距？** 全部在 `src/styles/tokens.css`，规则见 [DESIGN.md](DESIGN.md)。
