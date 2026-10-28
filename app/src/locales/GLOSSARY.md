# Glossary for translators

The terms Audiodiver uses everywhere: the app, the messages from the core, the Index and the Wiki. A tutorial or a
Wiki page names a button as the button reads, so a term keeps one translation across all of them.

## Rules for every language

- Keep what the code fills in exactly as it is: values in braces (`{name}`, `{count}`), tags (`<0>`, `</0>`, `<1/>`),
  plural syntax (`{count, plural, one {...} other {...}}`, with `#` for the number), Markdown (`**bold**`), and the
  Wiki's `{icon:...}` and `{key:...}`. Plural forms follow the language: Polish and Russian use one, few, many and
  other; Japanese, Korean and Chinese use other only.
- Don't translate: Audiodiver, Audiodiver Utils, Helldivers 2, Wwise, Steam, GitHub, Nexus Mods, Discord, Ko-fi,
  FFmpeg, vgmstream, wav2wem, font names, people's names, key names (Ctrl, Shift), units (s, ms, dB, Hz, KB, MB, GB,
  px) and file extensions.
- Names from the game (weapons, stratagems, enemies, planets, Super Earth) are written as the game writes them in
  that language. The game's own lines (subtitles, voice lines) are quotes and never change.
- Plain and short, as the English is: say what a thing is or does, no flourish. Capitalise as the language does:
  only English puts buttons in Title Case. The names of tabs and sub-tabs (Trilha Sonora, Todos os Pacotes, Combinar
  Mods, Lista de Exportação) and the Wiki's Interactive Tutorials and FAQ entries are in Title Case in every language
  with capitals, wherever they are named (the Wiki too).
- One term, one translation (the tables below). Where a table gives an English term in brackets, keep the English.

## Address and buttons

| Language | Address | Buttons and menu entries |
|---|---|---|
| Deutsch | du | infinitive ("Speichern", "Datei auswählen") |
| Español (España) | tú | infinitive ("Guardar", "Elegir archivo"); file = fichero, archive = archivo |
| Español (Latinoamérica) | tú | infinitive ("Guardar", "Elegir archivo"); file = archivo, archive = paquete |
| Français | vous | infinitive ("Enregistrer", "Choisir un fichier"); a narrow no-break space before : ; ? ! and inside « » |
| Italiano | tu | imperative ("Salva", "Scegli un file") |
| Polski | ty | imperative ("Zapisz", "Wybierz plik") |
| Português (Brasil) | você | infinitive ("Salvar", "Escolher arquivo"); file = arquivo, archive = pacote |
| Português (Portugal) | impersonal, no "você" | infinitive ("Guardar", "Escolher ficheiro"); file = ficheiro, archive = arquivo |
| Русский | вы (lower case) | infinitive ("Сохранить", "Выбрать файл") |
| 日本語 | です・ます | nouns or short verbs ("保存", "ファイルを選択") |
| 한국어 | 합니다・하세요 | nouns or short verbs ("저장", "파일 선택") |
| 简体中文 | 您 only where needed | short verbs ("保存", "选择文件"); full-width punctuation |
| 繁體中文 | 您 only where needed | short verbs ("儲存", "選擇檔案"); full-width punctuation |

## Terms

What each term means in Audiodiver:

- **Original**: the game's own audio in a slot. **new audio**: audio the user puts in. **Replaced**: a slot that
  holds new audio. **silence**: a slot replaced with nothing.
- **slot**: one place in a sound that plays a file; a **take** is one of the versions a sound picks from at random;
  a **layer** plays together with others.
- **sound bank** (bank): a game file that holds sounds. **archive**: one of the game's data files (the patch files).
- **project**: what the user works on, saved as a file. **mod**: what a build makes, for a **mod manager**.
  **build**: making the mod from the project (and the Build tab). **patch**: a game file the mod replaces.
- Tabs and tools: **Home**, **Project**, **Library** (with the **Index** of named sounds and **All Archives**),
  **Audio**, **Soundtrack**, **Text**, **Build**, **Tools** (**Repatch** and **Combine Mods**), **Updates**,
  **Wiki**, **Settings**.

| English | Deutsch | Español (España) | Español (Latinoamérica) | Français | Italiano | Polski |
|---|---|---|---|---|---|---|
| Original | Original | Original | Original | Original | Originale | Oryginał |
| new audio | neues Audio | audio nuevo | audio nuevo | nouvel audio | nuovo audio | nowe audio |
| Replaced | Ersetzt | Sustituido | Reemplazado | Remplacé | Sostituito | Zastąpiony |
| silence | Stille | silencio | silencio | silence | silenzio | cisza |
| slot | Slot | slot | slot | emplacement | slot | slot |
| take | Take | toma | toma | prise | take | wariant |
| layer | Layer | capa | capa | couche | livello | warstwa |
| sound | Sound | sonido | sonido | son | suono | dźwięk |
| sound bank | Soundbank | banco de sonido | banco de sonido | banque de sons | banco di suoni | bank dźwięków |
| archive | Archiv | archivo | paquete | archive | archivio | archiwum |
| file | Datei | fichero | archivo | fichier | file | plik |
| project | Projekt | proyecto | proyecto | projet | progetto | projekt |
| mod | Mod | mod | mod | mod | mod | mod |
| mod manager | Mod-Manager | gestor de mods | gestor de mods | gestionnaire de mods | gestore di mod | menedżer modów |
| build (verb) | erstellen | generar | generar | générer | compilare | zbudować |
| patch | Patch | parche | parche | patch | patch | łatka |
| segment | Segment | segmento | segmento | segment | segmento | segment |
| track | Spur | pista | pista | piste | traccia | ścieżka |
| clip | Clip | clip | clip | clip | clip | klip |
| piece (of music) | Stück | pieza | pieza | morceau | brano | utwór |
| voice line | Sprachzeile | frase | frase | réplique | battuta | kwestia |
| exertion | Anstrengungslaut | sonido de esfuerzo | sonido de esfuerzo | bruit d'effort | verso di sforzo | odgłos wysiłku |
| subtitle | Untertitel | subtítulo | subtítulo | sous-titre | sottotitolo | napis |
| loudness | Lautheit | sonoridad | sonoridad | sonie | loudness | głośność odczuwalna |
| waveform | Wellenform | forma de onda | forma de onda | forme d'onde | forma d'onda | przebieg |
| Make-Up Gain | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] |
| container ID | Container-ID | ID de contenedor | ID de contenedor | ID de conteneur | ID container | ID kontenera |
| export list | Exportliste | lista de exportación | lista de exportación | liste d'export | lista di esportazione | lista eksportu |
| game folder | Spielordner | carpeta del juego | carpeta del juego | dossier du jeu | cartella del gioco | folder gry |
| Home | Start | Inicio | Inicio | Accueil | Home | Start |
| Project | Projekt | Proyecto | Proyecto | Projet | Progetto | Projekt |
| Library | Bibliothek | Biblioteca | Biblioteca | Bibliothèque | Libreria | Biblioteka |
| Index | Index | Índice | Índice | Index | Indice | Indeks |
| All Archives | Alle Archive | Todos los archivos | Todos los paquetes | Toutes les archives | Tutti gli archivi | Wszystkie archiwa |
| Audio | Audio | Audio | Audio | Audio | Audio | Audio |
| Soundtrack | Soundtrack | Banda sonora | Banda sonora | Bande-son | Colonna sonora | Ścieżka dźwiękowa |
| Text | Text | Texto | Texto | Texte | Testo | Tekst |
| Build | Erstellen | Generar | Generar | Générer | Compila | Budowanie |
| Tools | Werkzeuge | Herramientas | Herramientas | Outils | Strumenti | Narzędzia |
| Repatch | [Repatch] | [Repatch] | [Repatch] | [Repatch] | [Repatch] | [Repatch] |
| Combine Mods | Mods kombinieren | Combinar mods | Combinar mods | Combiner des mods | Combina mod | Połącz mody |
| Updates | Updates | Actualizaciones | Actualizaciones | Mises à jour | Aggiornamenti | Aktualizacje |
| Settings | Einstellungen | Ajustes | Configuración | Paramètres | Impostazioni | Ustawienia |
| Interactive Tutorials | Interaktive Tutorials | Tutoriales interactivos | Tutoriales interactivos | Tutoriels interactifs | Tutorial interattivi | Interaktywne samouczki |
| Notifications | Benachrichtigungen | Notificaciones | Notificaciones | Notifications | Notifiche | Powiadomienia |
| History | Verlauf | Historial | Historial | Historique | Cronologia | Historia |

| English | Português (Brasil) | Português (Portugal) | Русский | 日本語 | 한국어 | 简体中文 | 繁體中文 |
|---|---|---|---|---|---|---|---|
| Original | Original | Original | Оригинал | オリジナル | 원본 | 原版 | 原版 |
| new audio | áudio novo | áudio novo | новое аудио | 新しい音声 | 새 오디오 | 新音频 | 新音訊 |
| Replaced | Substituído | Substituído | Заменено | 置き換え済み | 교체됨 | 已替换 | 已替換 |
| silence | silêncio | silêncio | тишина | 無音 | 무음 | 静音 | 靜音 |
| slot | slot | slot | слот | スロット | 슬롯 | 槽位 | 欄位 |
| take | take | take | дубль | テイク | 테이크 | 变体 | 變體 |
| layer | camada | camada | слой | レイヤー | 레이어 | 层 | 層 |
| sound | som | som | звук | サウンド | 사운드 | 声音 | 聲音 |
| sound bank | banco de sons | banco de sons | звуковой банк | サウンドバンク | 사운드 뱅크 | 音频库 | 音訊庫 |
| archive | pacote | arquivo | архив | アーカイブ | 아카이브 | 归档 | 歸檔 |
| file | arquivo | ficheiro | файл | ファイル | 파일 | 文件 | 檔案 |
| project | projeto | projeto | проект | プロジェクト | 프로젝트 | 项目 | 專案 |
| mod | mod | mod | мод | MOD | 모드 | 模组 | 模組 |
| mod manager | gerenciador de mods | gestor de mods | менеджер модов | MODマネージャー | 모드 관리자 | 模组管理器 | 模組管理器 |
| build (verb) | gerar | gerar | собрать | ビルドする | 빌드하다 | 构建 | 建置 |
| patch | patch | patch | патч | パッチ | 패치 | 补丁 | 修補檔 |
| segment | segmento | segmento | сегмент | セグメント | 세그먼트 | 段落 | 段落 |
| track | faixa | faixa | дорожка | トラック | 트랙 | 音轨 | 音軌 |
| clip | clipe | clipe | клип | クリップ | 클립 | 片段 | 片段 |
| piece (of music) | peça | peça | композиция | 曲 | 곡 | 曲目 | 曲目 |
| voice line | fala | fala | реплика | セリフ | 대사 | 语音台词 | 語音台詞 |
| exertion | som de esforço | som de esforço | звук усилия | 掛け声 | 기합 소리 | 发力声 | 出力聲 |
| subtitle | legenda | legenda | субтитр | 字幕 | 자막 | 字幕 | 字幕 |
| loudness | volume percebido | volume percebido | громкость | ラウドネス | 라우드니스 | 响度 | 響度 |
| waveform | forma de onda | forma de onda | форма волны | 波形 | 파형 | 波形 | 波形 |
| Make-Up Gain | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] | [Make-Up Gain] |
| container ID | ID de contêiner | ID de contentor | ID контейнера | コンテナID | 컨테이너 ID | 容器 ID | 容器 ID |
| export list | lista de exportação | lista de exportação | список экспорта | エクスポートリスト | 내보내기 목록 | 导出列表 | 匯出清單 |
| game folder | pasta do jogo | pasta do jogo | папка игры | ゲームフォルダー | 게임 폴더 | 游戏文件夹 | 遊戲資料夾 |
| Home | Início | Início | Главная | ホーム | 홈 | 主页 | 首頁 |
| Project | Projeto | Projeto | Проект | プロジェクト | 프로젝트 | 项目 | 專案 |
| Library | Biblioteca | Biblioteca | Библиотека | ライブラリ | 라이브러리 | 资源库 | 資源庫 |
| Index | Índice | Índice | Указатель | インデックス | 색인 | 索引 | 索引 |
| All Archives | Todos os Pacotes | Todos os arquivos | Все архивы | すべてのアーカイブ | 모든 아카이브 | 所有归档 | 所有歸檔 |
| Audio | Áudio | Áudio | Аудио | オーディオ | 오디오 | 音频 | 音訊 |
| Soundtrack | Trilha Sonora | Banda sonora | Саундтрек | サウンドトラック | 사운드트랙 | 配乐 | 原聲帶 |
| Text | Texto | Texto | Текст | テキスト | 텍스트 | 文本 | 文字 |
| Build | Gerar | Gerar | Сборка | ビルド | 빌드 | 构建 | 建置 |
| Tools | Ferramentas | Ferramentas | Инструменты | ツール | 도구 | 工具 | 工具 |
| Repatch | [Repatch] | [Repatch] | [Repatch] | [Repatch] | [Repatch] | [Repatch] | [Repatch] |
| Combine Mods | Combinar Mods | Combinar mods | Объединить моды | MODを統合 | 모드 합치기 | 合并模组 | 合併模組 |
| Updates | Atualizações | Atualizações | Обновления | アップデート | 업데이트 | 更新 | 更新 |
| Settings | Configurações | Definições | Настройки | 設定 | 설정 | 设置 | 設定 |
| Interactive Tutorials | Tutoriais Interativos | Tutoriais interativos | Интерактивные уроки | インタラクティブチュートリアル | 대화형 튜토리얼 | 互动教程 | 互動教學 |
| Notifications | Notificações | Notificações | Уведомления | 通知 | 알림 | 通知 | 通知 |
| History | Histórico | Histórico | История | 履歴 | 기록 | 历史记录 | 歷程記錄 |
