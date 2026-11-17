---
title: 도구와 링크
group: 자료
summary: 모드를 설치하고 공유하는 곳, 음악 모드에 도움이 되는 무료 오디오 도구를 소개합니다.
source: bbf51a2ca734
---

## 모드 설치와 공유 {#installing-and-sharing-mods}

- 빌드는 Helldivers 2 모드 관리자로 설치합니다.
- 대부분의 모드는 [Nexus Mods의 Helldivers 2](https://www.nexusmods.com/helldivers2)에서 공유됩니다.
- [Helldivers 1용 모드 관리자](https://www.nexusmods.com/helldivers/mods/16)는 Helldivers 1 모드를 설치합니다. Audiodiver로 만든 모드에는 1.1.0 이상이 필요합니다.
- Audiodiver의 [릴리스 페이지](https://github.com/Alomare/Audiodiver/releases/latest)에 있는 **Audiodiver Utils**는 프로젝트 없이 쓰는 Repatch, 모드 합치기, [패치 내용](wiki:patch-content)입니다. 더 작은 포터블 창과, 명령줄용 `audiodiver.cmd`가 있습니다. Audiodiver Utils에는 다른 형식용 변환기가 없으므로, 그 안의 패치 내용은 48 kHz 16비트 WAV, `.wem`, 무음만 새 오디오로 받습니다. `audiodiver.cmd repatch <mod>`는 모드를 다시 빌드하고, `combine <mod> <mod>`는 모드를 합치며, `check`는 Repatch가 필요한 설치된 모드를 나열하고, `scan <mod>`는 모드의 옵션을 보여 줍니다. 다른 프로그램이 읽을 출력은 `--json`을, 나머지 기능은 `--help`를 붙이세요.

## 오디오 편집 {#editing-audio}

- [Audacity](https://www.audacityteam.org)는 WAV나 FLAC을 자르고, 페이드하고, 내보내는 무료 편집기입니다. Audacity의 *Loudness Normalization* 효과는 파일을 목표 LUFS에 맞춥니다.
- [Youlean Loudness Meter](https://youlean.co/youlean-loudness-meter/)는 무료 라우드니스 미터입니다. 새 음악을 원본 레벨인 −13~−15 LUFS와 비교할 때 쓰세요.
- [FFmpeg](https://ffmpeg.org)는 명령줄에서 거의 모든 오디오 형식을 서로 변환합니다.

## 내부 구조 {#under-the-hood}

- [vgmstream](https://github.com/vgmstream/vgmstream)은 Wwise를 포함한 게임 오디오 형식을 재생하고 변환합니다.
- [wwiser](https://github.com/bnnm/wwiser)는 Wwise 사운드 뱅크를 살펴봅니다.
- [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder)는 Helldivers 2용 ID 기반 오디오 모딩 도구입니다.

[정보](app:about)에 Audiodiver가 기반으로 삼는 프로젝트가 나열되어 있습니다. 상태 표시줄의 버전 옆에 있는 {icon:info}를 클릭하면 열립니다.
