---
title: 工具和链接
group: 资源
summary: 在哪里安装和分享模组，以及有助于制作音乐模组的免费音频工具。
source: 8c4b133afed9
---

## 安装和分享模组 {#installing-and-sharing-mods}

- 构建结果用 Helldivers 2 模组管理器安装。
- 大多数模组在 [Nexus Mods 的 Helldivers 2 页面](https://www.nexusmods.com/helldivers2)上分享。
- **Audiodiver Utils** 位于 Audiodiver 的[发布页面](https://github.com/Alomare/Audiodiver/releases/latest)，它是不需要项目的 Repatch 和合并模组：一个更小的便携窗口，以及用于命令行的 `audiodiver.cmd`。`audiodiver.cmd repatch <mod>` 会重新构建模组，`combine <mod> <mod>` 会合并模组，`check` 会列出需要 Repatch 的已安装模组，`scan <mod>` 会显示模组的选项。加上 `--json` 可输出供其他程序读取的结果，加上 `--help` 可查看其余用法。

## 编辑音频 {#editing-audio}

- [Audacity](https://www.audacityteam.org) 是一款免费的编辑器，可用于剪切、淡入淡出以及导出 WAV 或 FLAC。Audacity 中的*响度标准化*（Loudness Normalization）效果可将文件调整到目标 LUFS。
- [Youlean Loudness Meter](https://youlean.co/youlean-loudness-meter/) 是一款免费的响度计。用它把新音乐与原版 −13 到 −15 LUFS 的响度进行比较。
- [FFmpeg](https://ffmpeg.org) 可在命令行中在几乎所有音频格式之间转换。

## 幕后技术 {#under-the-hood}

- [vgmstream](https://github.com/vgmstream/vgmstream) 可播放和转换游戏音频格式，包括 Wwise 的格式。
- [wwiser](https://github.com/bnnm/wwiser) 可浏览 Wwise 音频库。
- [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder) 是一款基于 ID 的 Helldivers 2 音频模组工具。

[关于](app:about)列出了 Audiodiver 本身所依赖的项目。要打开它，请点击状态栏中版本号旁边的 {icon:info}。
