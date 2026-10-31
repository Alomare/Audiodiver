---
title: よくある質問
group: よくある質問
summary: よくある質問への短い回答です。それぞれに、詳しく説明しているページへのリンクが付いています。
source: 09dda6069291
---

## 音声を探す {#finding-audio}

### ライブラリのインデックスはどのくらい正確ですか？ {#how-accurate-is-the-library-index}

もっとも信頼できるのは音楽です。Helldivers 2は、画面、敵、戦闘中かどうかなど、音楽を選ぶ状態に名前を付けており、インデックスはその名前で音楽を分類しています。サウンドセット、武器、クリップのラベルは、MODコミュニティの調査に基づいたもの（[Audiodiverについて ▸ クレジット](app:about)に一覧があります）で、一部の名前は推測を含みます。セリフは、文言が一致する字幕の名前が付けられ、字幕が確実でないセリフには**複数のうちの1つ**と表示されます。

名前のないシーケンスは、*シーケンス 3*や*テイク 2*と表示されます。理由は[ゲーム音声の仕組み](wiki:game-audio#why-many-things-are-called-sequence-3-or-take-2)で説明しています。名前の誤りや欠落を報告するには、GitHubの[名前の誤りまたは欠落](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml)フォームを使ってください。

### Audiodiverは、どのシナリオでどの音楽が再生されるかをどうやって知るのですか？ {#how-does-audiodiver-know-what-music-plays-in-which-scenario}

ゲームは、艦内、降下、敵の陣営、探索、戦闘とその激しさなど、名前の付いた状態で音楽を選びます。Audiodiverは、サウンドバンクからそれらの状態と、状態を切り替えるルールを読み取り、ミッションで出会う順に、*艦内にて*から*クレジット*まで音楽を一覧します。どの状態にも当てはまらない音楽は、*未識別*に一覧されます。トランジションは、つなぐ対象の名前で、スティンガーは、重ねて再生される対象の名前で呼ばれます。曲の中の順序は、曲のプレイリストから決まり、[サウンドトラック](wiki:soundtrack)に表示されます。

### スロット、セグメント、テイクとは何ですか？ {#what-are-slots-segments-and-takes}

**スロット**は、置き換えられるクリップ1つです。音楽は、順に再生される**セグメント**でできていて、各セグメントに1つ以上のスロットがあります。サウンドには**テイク**があり、再生のたびにそのうちの1つが再生されます。[ゲーム音声の仕組み](wiki:game-audio)に、用語集があります。

## MODを作る {#making-a-mod}

### 既存のセグメントに新しい音声を追加するには？ {#how-can-i-add-new-audio-to-existing-segments}

[オーディオ](app:editor)タブで、セグメントのスロットに音声ファイルをドロップします。新しい音声がオリジナルを置き換え、セグメントのタイミングは新しい長さに従います（[タイミング、キューポイント、ループ](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)）。曲に複数のファイルをドロップすると、再生順にスロットへ割り当てられます。1曲を曲全体に割り当てるには、**曲を切り分け**、または[サウンドトラック](wiki:soundtrack#one-song)の**1曲**を使います。曲をまるごと並べたプレイリストにするには、同じくサウンドトラックの**プレイリスト**を使います。

音楽には、テイクやレイヤーを追加できません。それらはサウンドとボイス用です。[音声の追加](wiki:adding-audio)を参照してください。

### 自分の曲がゲーム内で順番どおりに再生されないのはなぜですか？ {#why-does-my-song-play-out-of-order-in-game}

ゲームは、曲を上から下まで再生することはほとんどありません。戦闘の音楽の多くは、各戦闘を短いオープニングから始め、いくつかのセグメントをランダムに選び、前回の戦闘が止まったところから続けます。[サウンドトラック](wiki:soundtrack)には各曲の再生順が表示され、**1曲**にすると、すべての戦闘で曲が最初から再生されます。各部分については、[ゲームが音楽を再生する仕組み](wiki:how-the-game-plays-music)で説明しています。

### オリジナルの音声がまだ聞こえるのはなぜですか？ {#why-do-i-still-hear-the-original-audio}

たいてい、次のどれかが原因です。

- セグメントのレイヤーが、まだオリジナルを再生している。無音にする方法は、[レイヤー](wiki:how-the-game-plays-music#layers)で説明しています。
- スロットがバイオームなどの条件でのみ再生され、別の場所では別のバリアントが再生されている（[バリアント](wiki:how-the-game-plays-music#variants)）。
- オリジナルのトランジションが、2つの新しい曲の間で再生されている（[トランジションとスティンガー](wiki:how-the-game-plays-music#transitions-and-stingers)）。
- サウンドに複数のテイクがあり、その一部がまだオリジナルのまま。すべてを置き換えてください。
- そのサウンドが、プロジェクトに入っていないバンクにもある。ビルドタブの**サウンドを含むすべてのバンクにパッチを当てる**で、それらも対象にできます（[サウンドを含むすべてのバンク](wiki:build-and-install#every-bank-with-the-sounds)）。

### どの音声ファイルを使えますか？ {#which-audio-files-can-i-use}

WAV、FLAC、MP3、OGG、Opus、M4A、AAC、AIFF、WMA、WEMです。48 kHzのWAVまたはFLACがもっとも良い結果になり、Wwise VorbisのWEMは変更されずにMODに入ります。[音声の準備](wiki:preparing-audio#formats)を参照してください。

### 新しい音声を大きくしたり小さくしたりするには？ {#how-do-i-make-new-audio-louder-or-quieter}

右側の詳細で、スロットの**Make-Up Gain**を設定します。複数のスロットを選択すると、1つの値が全部に適用され、サウンドトラックの曲の**レベル**で、全体を上げ下げできます。レベルについては[Make-Up Gainとミックス](wiki:volume)で、目標にするラウドネスについては[音声の準備](wiki:preparing-audio#loudness)で説明しています。

### サウンドや曲を無音にするには？ {#how-do-i-silence-a-sound-or-a-piece-of-music}

スロットを右クリックして、**無音に置き換え**を選びます。**元の長さを保つ**で、ゲームがオリジナルの長さだけ待つか、すぐ次に進むかを設定します（[無音](wiki:how-the-game-plays-music#silence)）。曲全体を無音にするには、[サウンドトラック](wiki:soundtrack#modes)の**無音**を使います。

### 字幕やその他のテキストを変更できますか？ {#can-i-change-subtitles-and-other-text}

はい。[テキスト](app:text)タブで、全言語のすべての行を、色、サイズ、強調付きで変更できます。[テキストと字幕](wiki:text)を参照してください。

## ビルドと共有 {#building-and-sharing}

### Audiodiverはゲームファイルを変更しますか？ {#does-audiodiver-change-the-game-files}

いいえ。ゲームフォルダーを読み込むだけです。ビルドでは、MODマネージャーがインポートしてデプロイするZIPが作られます（[ビルドとインストール](wiki:build-and-install#installing)）。

### ゲームのアップデート後は、どうすればよいですか？ {#what-do-i-do-after-a-game-update}

プロジェクトを開いてもう一度ビルドし、MODマネージャーで新しいZIPをインポートします（[ゲームのアップデート時](wiki:game-updates#rebuild)）。他の人が作ったMODは、[Repatch](wiki:repatching)で現在のゲーム用に作り直せます。

### 自分のMODを他の音声MODと一緒に使えますか？ {#can-my-mod-run-with-other-audio-mods}

同じサウンドバンクを変更する2つのMODは統合されず、後からデプロイされたほうが優先されます（[同じバンクを変更する2つのMOD](wiki:build-and-install#two-mods-that-change-the-same-bank)）。[MODを統合](wiki:combining-mods)を使うと、それらを1つのMODにビルドできます。

### MODのサイズが大きいのはなぜですか？ {#why-is-my-mod-so-big}

MODには、変更したすべてのサウンドバンクの完全なコピーが入っています。音楽はすべてのミッションの音楽バンクにあり、100個のバンクに入っているサウンドもあるため、それらを置き換えるとすべてのコピーが加わります（[サウンドを含むすべてのバンク](wiki:build-and-install#every-bank-with-the-sounds)、[サイズ](wiki:adding-audio#size)）。

### プロジェクトを別のコンピューターに移すには？ {#how-do-i-move-a-project-to-another-computer}

プロジェクトタブの**パックとしてエクスポート**で、プロジェクトと、それが使うすべてのファイルを、1つの`.audipack`ファイルに保存します。もう一方のコンピューターでそれを開いてください（[プロジェクトフォルダー](wiki:project-folders)）。

### MODを共有するには？ {#how-do-i-share-my-mod}

ビルドフォルダーにあるZIPをアップロードします。何を含めて何を除くかは、[MODの共有](wiki:sharing)で説明しています。
