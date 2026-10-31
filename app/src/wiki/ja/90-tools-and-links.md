---
title: ツールとリンク
group: リソース
summary: MODのインストール先と共有先、音楽MODの制作に役立つ無料の音声ツールを紹介します。
source: 8c4b133afed9
---

## MODのインストールと共有 {#installing-and-sharing-mods}

- ビルドは、Helldivers 2のMODマネージャーでインストールします。
- [Nexus ModsのHelldivers 2](https://www.nexusmods.com/helldivers2)は、ほとんどのMODが共有されている場所です。
- **Audiodiver Utils**は、Audiodiverの[リリースページ](https://github.com/Alomare/Audiodiver/releases/latest)にあるツールで、プロジェクトなしでRepatchと**MODを統合**を使えます。小さめのポータブルウィンドウと、コマンドライン用の`audiodiver.cmd`が付いています。`audiodiver.cmd repatch <mod>`はMODを作り直し、`combine <mod> <mod>`はMODを統合し、`check`はRepatchが必要なインストール済みのMODを一覧し、`scan <mod>`はMODのオプションを表示します。`--json`を付けると他のプログラムが読める形式で出力され、`--help`で残りのオプションがわかります。

## 音声の編集 {#editing-audio}

- [Audacity](https://www.audacityteam.org)は、WAVやFLACのカット、フェード、書き出しができる無料のエディターです。Audacityの*Loudness Normalization*エフェクトで、ファイルをLUFSの目標値に合わせられます。
- [Youlean Loudness Meter](https://youlean.co/youlean-loudness-meter/)は、無料のラウドネスメーターです。新しい音楽を、オリジナルのレベルである−13～−15 LUFSと比較するのに使えます。
- [FFmpeg](https://ffmpeg.org)は、コマンドラインで、ほぼあらゆる音声形式の間で変換できます。

## 内部の仕組み {#under-the-hood}

- [vgmstream](https://github.com/vgmstream/vgmstream)は、Wwiseを含むゲーム音声の形式を再生・変換します。
- [wwiser](https://github.com/bnnm/wwiser)は、Wwiseのサウンドバンクを調べるツールです。
- [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder)は、Helldivers 2向けのIDベースの音声MODツールです。

Audiodiver自身が土台にしているプロジェクトは、[Audiodiverについて](app:about)に一覧されています。開くには、ステータスバーのバージョンの隣にある{icon:info}をクリックします。
