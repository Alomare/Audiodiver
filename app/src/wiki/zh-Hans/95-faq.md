---
title: 常见问题
group: 常见问题
summary: 常见问题的简短解答，每条都附有详细介绍该主题的页面链接。
source: 09dda6069291
---

## 查找音频 {#finding-audio}

### 资源库的索引有多准确？ {#how-accurate-is-the-library-index}

音乐是最可靠的部分。Helldivers 2 给决定放哪段音乐的各种状态起了名字，例如所在界面、敌人、是否正在战斗，索引再按这些名字给音乐分类。声音集、武器和片段标签来自模组社区的研究（列在[关于 ▸ 致谢](app:about)中），其中一些名称是有根据的推测。语音台词以与其文字相符的字幕命名，字幕不确定的台词会显示**多条之一**。

没有名称的序列显示为*序列 3* 或*变体 2*。[游戏音频详解](wiki:game-audio#why-many-things-are-called-sequence-3-or-take-2)说明了原因。要报告错误或缺失的名称，请使用 GitHub 上的[名称错误或缺失](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml)表单。

### Audiodiver 如何知道哪种场景播放什么音乐？ {#how-does-audiodiver-know-what-music-plays-in-which-scenario}

游戏通过具名的状态来选择音乐：舰船、空降、敌方阵营、探索、战斗以及战斗的激烈程度。Audiodiver 从音频库中读取这些状态以及在它们之间切换的规则，并按任务中遇到的顺序列出音乐，从*舰船上*到*制作人员名单*。没有被任何状态定位的音乐列在*尚未识别*下。过渡段按其连接的内容命名，插入乐段按其叠加的内容命名。曲目内部的顺序来自曲目的播放列表，[配乐](wiki:soundtrack)会显示它。

### 什么是槽位、段落和变体？ {#what-are-slots-segments-and-takes}

**槽位**是一个可以替换的片段。音乐由依次播放的**段落**组成，每个段落有一个或多个槽位。声音有多个**变体**，每次播放其中一个。[游戏音频详解](wiki:game-audio)有完整的术语表。

## 制作模组 {#making-a-mod}

### 如何为现有段落添加新音频？ {#how-can-i-add-new-audio-to-existing-segments}

在[音频](app:editor)选项卡中，把音频文件拖放到段落的槽位上。新音频会替换原版，段落的时序会跟随新的时长（[时序、提示点和循环](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)）。拖放到曲目上的多个文件会按播放顺序填充槽位。要把一首歌铺满整首曲目，请使用**切分歌曲**，或[配乐](wiki:soundtrack#one-song)中的**单曲**。要使用由完整歌曲组成的播放列表，请使用那里的**播放列表**。

音乐不能添加额外的变体或层。这些功能用于声音和语音，参见[添加音频](wiki:adding-audio)。

### 为什么我的歌在游戏中乱序播放？ {#why-does-my-song-play-out-of-order-in-game}

游戏很少把一首曲目从头到尾依次播放。多数战斗音乐会在每场战斗开始时先放一小段开场，随机挑几个段落，然后从上一次战斗停下的地方接着放。[配乐](wiki:soundtrack)会显示每首曲目的播放顺序，**单曲**会让每场战斗都从头播放这首歌。[游戏如何播放音乐](wiki:how-the-game-plays-music)解释了其中的各个部分。

### 为什么我仍然听到原版音频？ {#why-do-i-still-hear-the-original-audio}

通常是以下原因之一：

- 段落的某一层仍在播放原版。[层](wiki:how-the-game-plays-music#layers)介绍了如何让它静音。
- 该槽位只在某种条件下（例如某个生物群系）播放，其他地方播放的是另一个版本（[版本](wiki:how-the-game-plays-music#variants)）。
- 两首新音乐之间播放了原版过渡段（[过渡段和插入乐段](wiki:how-the-game-plays-music#transitions-and-stingers)）。
- 声音有多个变体，其中一些仍是原版。请全部替换。
- 该声音也位于项目未列出的音频库中。构建选项卡上的**修补包含这些声音的所有音频库**会涵盖它们（[包含这些声音的所有音频库](wiki:build-and-install#every-bank-with-the-sounds)）。

### 可以使用哪些音频文件？ {#which-audio-files-can-i-use}

WAV、FLAC、MP3、OGG、Opus、M4A、AAC、AIFF、WMA 和 WEM。48 kHz 的 WAV 或 FLAC 效果最好，Wwise Vorbis 格式的 WEM 会原样放入模组。参见[准备音频](wiki:preparing-audio#formats)。

### 如何让新音频变响或变轻？ {#how-do-i-make-new-audio-louder-or-quieter}

在右侧的详情中为槽位设置 **Make-Up Gain**。选中多个槽位时，它们会获得同一个数值；配乐中曲目的**音量**可以提高或降低整首曲目。[Make-Up Gain 与混音](wiki:volume)讲音量，[准备音频](wiki:preparing-audio#loudness)讲响度该做到多少。

### 如何让一个声音或一首曲目静音？ {#how-do-i-silence-a-sound-or-a-piece-of-music}

右键点击槽位并选择**替换为静音**。**保持原始时长**决定游戏是等待原版的时长，还是立即继续（[静音](wiki:how-the-game-plays-music#silence)）。在[配乐](wiki:soundtrack#modes)中选择**静音**，可让整首曲目静音。

### 可以修改字幕和其他文本吗？ {#can-i-change-subtitles-and-other-text}

可以。在[文本](app:text)选项卡里，每种语言的每一行都能改，颜色、大小和强调也行。参见[文本和字幕](wiki:text)。

## 构建和分享 {#building-and-sharing}

### Audiodiver 会更改游戏文件吗？ {#does-audiodiver-change-the-game-files}

不会。它只读取游戏文件夹。构建会生成一个 ZIP，由模组管理器导入并部署（[构建和安装](wiki:build-and-install#installing)）。

### 游戏更新后该怎么做？ {#what-do-i-do-after-a-game-update}

打开项目并重新构建，然后在模组管理器中导入新的 ZIP（[游戏更新时](wiki:game-updates#rebuild)）。别人制作的模组可以用 [Repatch](wiki:repatching) 为当前游戏重新构建。

### 我的模组能和其他音频模组一起使用吗？ {#can-my-mod-run-with-other-audio-mods}

更改同一个音频库的两个模组不会合并，后部署的那个会胜出（[两个模组更改同一个音频库](wiki:build-and-install#two-mods-that-change-the-same-bank)）。[合并模组](wiki:combining-mods)可以把它们构建成一个模组。

### 为什么我的模组这么大？ {#why-is-my-mod-so-big}

模组会携带它所更改的每个音频库的完整副本。音乐位于每个任务的音乐音频库中，有些声音位于上百个音频库中，所以替换这些声音，就得把每一份副本都带进模组（[包含这些声音的所有音频库](wiki:build-and-install#every-bank-with-the-sounds)、[大小](wiki:adding-audio#size)）。

### 如何把项目移到另一台电脑上？ {#how-do-i-move-a-project-to-another-computer}

项目选项卡上的**导出为项目包**会把项目及其使用的每个文件保存为一个 `.audipack` 文件。在另一台电脑上打开它即可（[项目文件夹](wiki:project-folders)）。

### 如何分享我的模组？ {#how-do-i-share-my-mod}

上传 build 文件夹中的 ZIP。[分享模组](wiki:sharing)介绍了应该包含什么、略去什么。
