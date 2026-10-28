---
title: 文本格式
group: 制作模组
summary: 文本选项卡格式栏中每个按钮的作用、游戏如何书写每种格式，以及可以复制的示例。
source: 47d197420504
---

游戏用标签为文本设置格式。开始标签放在文字之前，结束标签放在文字之后。例如，`<c=FFFFE900>ARMORED ENEMIES</c>` 会以超级地球黄显示 *ARMORED ENEMIES*。[文本](app:text)选项卡上**新文本**上方的栏会写入这些标签，您也可以手动输入。**预览**会在您编辑时显示效果。

下面的每个示例在左侧显示输入的文本，在右侧显示游戏中的显示效果。

## 应用格式 {#applying-a-format}

1. 在**新文本**中选中文字。
2. 如果格式带有颜色或大小，请先设置它。
3. 按下按钮。

标签会包在所选文字的两侧。文字保持选中状态，因此再按一个按钮可以添加第二种格式。如果未选中任何内容，按钮会为整行设置格式，放在字幕时间标记之后。

标签可以嵌套。请按相反的顺序关闭它们：

```game-text
Use the <c=FFFFE900><i=1>Hellbomb</i></c> on the nest.
```

**清除格式**会移除这一行中所有颜色、大小和样式标签，保留文字和时间标记。它也会移除下文介绍的、由游戏填入的颜色。发生这种情况时编辑器会发出警告，{key:undo} 可以将其恢复。

## 颜色 {#colour}

**颜色**会改变文字的颜色。用色块选择颜色，或在旁边的框中输入十六进制代码，然后按**颜色**。

颜色代码有八位十六进制数字。前两位设置不透明度（`FF` 为完全不透明），其余各位设置红、绿、蓝。Audiodiver 总是把不透明度写为 `FF`。要让文字部分透明，请手动输入较低的值。例如，`80` 为半透明。

```game-text
Pick up and use <c=FFFFE900>EXPENDABLE ANTI-TANK</c> against <c=FFFFE900>ARMORED ENEMIES</c>.
```

```game-text
<c=FFFF0000>Danger close.</c> Clear the area.
```

```game-text
<c=80FFFFFF>Barely there.</c>
```

以下是游戏中最常用的颜色：

| 代码 | 颜色 | 行数 |
|---|---|---|
| `FFFFE900` | 超级地球黄，用于提示中的关键词 | 166 |
| `FF336666` | 深青色 | 13 |
| `FF66cc99` | 浅绿色 | 5 |
| `FFFF0000` | 红色 | 4 |

## 大小 {#size}

**大小**会让文字变大或变小。在数字框中设置 10 到 60 之间的大小，然后按**大小**。正常大小为 20。

```game-text
<s=30>FOR SUPER EARTH!</s>
```

```game-text
Mission complete. <s=14>Mostly.</s>
```

> [!NOTE]
> 游戏中没有任何一行使用大小，但聊天会用到。大小在字幕或菜单中如何显示由游戏决定，因此在分享模组之前请在游戏中检查。

## 强调 {#emphasis}

**强调**会写入 `<i=1>`，这是提示和简报中所解释术语使用的样式。预览以斜体显示它。在游戏中，它以强调样式显示。

```game-text
Welcome to the <i=1>Galactic Map</i>. Select <i=1>Missions</i> to play.
```

其他样式不在栏中。游戏用 `<i=3>` 表示通告的标题，用 `<i=2>` 放在计时器的数字之间。请手动输入它们：

```game-text
<i=3>STRATEGIC ADVISORY</i>
The Automaton <i=1>Jet Brigade</i> has been spotted.
```

## 时间标记（字幕） {#timing-subtitles}

字幕以时间标记 `{start->end}` 开头。该标记设置其后文字出现和消失的时间，单位为秒，从语音台词开始时算起。较长的字幕有多个标记，每段文字一个。按**时间标记**会在光标处添加 `{0.00->2.00}`，然后输入时间即可。

```game-text
{0.00->1.85}Reinforcements inbound!
```

```game-text
{0.00->2.40}Stratagem coming in hot.
{2.40->4.10}Clear the landing zone!
```

如果语音台词的新音频时长不同，请修改字幕时间以与之匹配。资源库会在波形上方显示语音台词的时长，台词上的**字幕**链接会在这里打开对应的字幕。

## 换行 {#line-breaks}

在**新文本**中按 Enter 可另起一行。游戏中较长的文本会使用换行（有 440 行使用了换行），少数较长的字幕也会这样做，每行一段文字。

## 由游戏填入的部分 {#parts-the-game-fills-in}

游戏在显示一行文本时会填入其中的某些部分。请保持这些部分不变，在改写这一行时让它们随文字一起移动：

- **`#` 后面的大写单词**，例如 `#NAME` 或 `#COUNT`，会变成玩家的名字或一个数字。预览会把它们显示为方框。
- **用名称代替代码的颜色**，例如 `<c=#PLAYER_COLOR>`，由游戏选择，例如玩家的颜色。预览会给这些标签着色的文字加下划线。

```game-text
<c=#PLAYER_COLOR>#NAME</c> DIED
```

```game-text
<c=#PLAYER_COLOR>#NAME</c> gave their life for <c=FFFFE900>Super Earth</c>
```

当某一行丢失了这些部分之一时，编辑器会发出警告。
