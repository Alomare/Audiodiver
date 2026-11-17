---
title: 자주 묻는 질문
group: 자주 묻는 질문
summary: 자주 묻는 질문에 대한 짧은 답변입니다. 각 답변에는 자세히 다루는 페이지의 링크가 있습니다.
source: 09dda6069291
---

## 오디오 찾기 {#finding-audio}

### 라이브러리 색인은 얼마나 정확한가요? {#how-accurate-is-the-library-index}

가장 믿을 만한 부분은 음악입니다. Helldivers 2는 화면, 적, 교전 중인지 여부처럼 음악을 고르는 상태에 이름을 붙이며, 색인은 그 이름으로 음악을 분류합니다. 사운드 세트, 무기, 클립 라벨은 [정보 ▸ 크레딧](app:about)에 나열된 모딩 커뮤니티의 연구에서 왔으며, 그중 일부 이름은 근거 있는 추측입니다. 대사는 문구가 일치하는 자막으로 이름이 붙으며, 자막이 확실하지 않은 줄에는 **여러 개 중 하나**가 표시됩니다.

이름이 없는 시퀀스는 *시퀀스 3*이나 *테이크 2*로 표시됩니다. 그 이유는 [게임 오디오 해설](wiki:game-audio#why-many-things-are-called-sequence-3-or-take-2)에 있습니다. 잘못되었거나 없는 이름은 GitHub의 [Wrong or missing name](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml) 양식으로 알려 주세요.

### Audiodiver는 어떤 음악이 어떤 상황에서 재생되는지 어떻게 아나요? {#how-does-audiodiver-know-what-music-plays-in-which-scenario}

게임은 이름 붙은 상태로 음악을 고릅니다. 함선, 강하, 적 진영, 탐색, 전투와 그 강도 같은 상태입니다. Audiodiver는 사운드 뱅크에서 이런 상태와 상태 사이를 전환하는 규칙을 읽고, 임무에서 음악을 만나는 순서대로 *함선에서*부터 *제작진*까지 나열합니다. 어떤 상태에도 배치되지 않는 음악은 *아직 식별되지 않음*에 나열됩니다. 트랜지션은 무엇을 잇는지로, 스팅어는 무엇 위에 재생되는지로 이름이 붙습니다. 곡 안의 순서는 곡의 재생 목록에서 오며, [사운드트랙](wiki:soundtrack)에 표시됩니다.

### 슬롯, 세그먼트, 테이크는 무엇인가요? {#what-are-slots-segments-and-takes}

**슬롯**은 교체할 수 있는 클립 하나입니다. 음악은 차례로 재생되는 **세그먼트**로 이루어지며, 각 세그먼트에는 슬롯이 하나 이상 있습니다. 사운드에는 **테이크**가 있고, 재생될 때마다 그중 하나를 재생합니다. 전체 용어집은 [게임 오디오 해설](wiki:game-audio)에 있습니다.

## 모드 만들기 {#making-a-mod}

### 기존 세그먼트에 새 오디오를 넣으려면 어떻게 하나요? {#how-can-i-add-new-audio-to-existing-segments}

[오디오](app:editor) 탭에서 세그먼트의 슬롯에 오디오 파일을 놓으세요. 새 오디오가 원본을 교체하고, 세그먼트의 타이밍이 새 길이를 따릅니다([타이밍, 큐 포인트, 반복](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)). 곡에 여러 파일을 놓으면 재생 순서대로 슬롯이 채워집니다. 노래 한 곡을 곡 전체에 걸쳐 넣으려면 **노래 자르기**나 [사운드트랙](wiki:soundtrack#one-song)의 **단일 곡**을 쓰세요. 노래 전체로 된 재생 목록은 그곳의 **재생 목록**을 쓰세요.

음악에는 추가 테이크나 레이어를 넣을 수 없습니다. 이것은 사운드와 음성용입니다. [오디오 추가](wiki:adding-audio)를 참조하세요.

### 게임에서 노래가 뒤죽박죽으로 재생되는 이유는 무엇인가요? {#why-does-my-song-play-out-of-order-in-game}

게임은 곡을 위에서 아래로 재생하는 경우가 드뭅니다. 대부분의 전투 음악은 교전마다 짧은 오프닝으로 시작하고, 일부 세그먼트를 무작위로 고르며, 지난 교전이 멈춘 곳부터 이어 갑니다. [사운드트랙](wiki:soundtrack)에서 각 곡의 재생 순서를 볼 수 있으며, **단일 곡**을 쓰면 교전마다 노래를 처음부터 재생합니다. 각 부분은 [게임이 음악을 재생하는 방식](wiki:how-the-game-plays-music)에서 설명합니다.

### 왜 아직 원본 오디오가 들리나요? {#why-do-i-still-hear-the-original-audio}

보통 다음 중 하나입니다.

- 세그먼트의 레이어 하나가 아직 원본을 재생합니다. 무음으로 만드는 방법은 [레이어](wiki:how-the-game-plays-music#layers)에서 설명합니다.
- 슬롯이 생물군계 같은 조건에서만 재생되고, 다른 곳에서는 다른 변형이 재생됩니다([변형](wiki:how-the-game-plays-music#variants)).
- 새 음악 두 곡 사이에서 원본 트랜지션이 재생됩니다([트랜지션과 스팅어](wiki:how-the-game-plays-music#transitions-and-stingers)).
- 사운드에 테이크가 여러 개 있고, 그중 일부가 아직 원본입니다. 모두 교체하세요.
- 사운드가 프로젝트에 없는 뱅크에도 있습니다. 빌드 탭의 **사운드가 들어 있는 모든 뱅크 패치**가 그런 뱅크까지 다룹니다([사운드가 들어 있는 모든 뱅크](wiki:build-and-install#every-bank-with-the-sounds)).

### 어떤 오디오 파일을 쓸 수 있나요? {#which-audio-files-can-i-use}

WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA, WEM입니다. 48 kHz WAV나 FLAC이 가장 좋은 결과를 내며, Wwise Vorbis로 된 WEM은 변환 없이 모드에 들어갑니다. [오디오 준비](wiki:preparing-audio#formats)를 참조하세요.

### 새 오디오를 더 크게 또는 작게 하려면 어떻게 하나요? {#how-do-i-make-new-audio-louder-or-quieter}

오른쪽 세부 정보에서 슬롯의 **Make-Up Gain**을 설정하세요. 여러 슬롯을 선택하면 값 하나를 함께 받으며, 사운드트랙에서 곡의 **레벨**은 곡 전체를 올리거나 내립니다. 레벨은 [Make-Up Gain과 믹스](wiki:volume)에서, 목표로 할 라우드니스는 [오디오 준비](wiki:preparing-audio#loudness)에서 다룹니다.

### 사운드나 곡을 무음으로 만들려면 어떻게 하나요? {#how-do-i-silence-a-sound-or-a-piece-of-music}

슬롯을 마우스 오른쪽 클릭하고 **무음으로 교체**를 고르세요. **원본 길이 유지**는 게임이 원본 길이만큼 기다릴지 바로 넘어갈지 정합니다([무음](wiki:how-the-game-plays-music#silence)). 곡 전체는 [사운드트랙](wiki:soundtrack#modes)의 **무음**으로 무음이 됩니다.

### 자막과 다른 텍스트도 바꿀 수 있나요? {#can-i-change-subtitles-and-other-text}

네, [텍스트](app:text) 탭에서 모든 언어의 모든 줄을 색상, 크기, 강조까지 바꿀 수 있습니다. [텍스트와 자막](wiki:text)을 참조하세요.

## 빌드와 공유 {#building-and-sharing}

### Audiodiver가 게임 파일을 바꾸나요? {#does-audiodiver-change-the-game-files}

아니요. 게임 폴더는 읽기만 합니다. 빌드하면 모드 관리자가 가져와 배포하는 ZIP이 만들어집니다([빌드와 설치](wiki:build-and-install#installing)).

### 게임 업데이트 후에는 무엇을 하나요? {#what-do-i-do-after-a-game-update}

프로젝트를 열어 다시 빌드한 뒤 새 ZIP을 모드 관리자에서 가져오세요([게임이 업데이트되면](wiki:game-updates#rebuild)). 다른 사람이 만든 모드는 [Repatch](wiki:repatching)로 현재 게임에 맞게 다시 빌드할 수 있습니다.

### 내 모드를 다른 오디오 모드와 함께 쓸 수 있나요? {#can-my-mod-run-with-other-audio-mods}

같은 사운드 뱅크를 바꾸는 두 모드는 합쳐지지 않으며, 나중에 배포한 모드가 이깁니다([같은 뱅크를 바꾸는 두 모드](wiki:build-and-install#two-mods-that-change-the-same-bank)). [모드 합치기](wiki:combining-mods)로 두 모드를 하나로 빌드할 수 있습니다.

### 모드가 왜 이렇게 큰가요? {#why-is-my-mod-so-big}

모드에는 바꾸는 모든 사운드 뱅크의 전체 사본이 들어갑니다. 음악은 모든 임무의 음악 뱅크에 있고, 일부 사운드는 뱅크 백 개에 있으므로, 그런 사운드를 교체하면 모든 사본이 들어갑니다([사운드가 들어 있는 모든 뱅크](wiki:build-and-install#every-bank-with-the-sounds), [크기](wiki:adding-audio#size)).

### 프로젝트를 다른 컴퓨터로 옮기려면 어떻게 하나요? {#how-do-i-move-a-project-to-another-computer}

프로젝트 탭의 **팩으로 내보내기**는 프로젝트와 프로젝트가 쓰는 모든 파일을 `.audipack` 파일 하나로 저장합니다. 다른 컴퓨터에서 그 파일을 여세요([프로젝트 폴더](wiki:project-folders)).

### 모드를 공유하려면 어떻게 하나요? {#how-do-i-share-my-mod}

빌드 폴더의 ZIP을 올리세요. 무엇을 넣고 무엇을 뺄지는 [모드 공유](wiki:sharing)에서 설명합니다.
