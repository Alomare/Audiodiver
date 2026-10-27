---
title: Frequently Asked Questions
group: FAQ
summary: Short answers to common questions, each with a link to the page that covers it in full.
---

## Finding audio

### How accurate is the Library Index?

The music is the most reliable part. Helldivers 2 names the states that choose the music, such as the screen, the enemy, and whether a fight is on, and the Index sorts the music by those names. Sound sets, weapons and clip labels come from research by the modding community, listed in [About ▸ Credits](app:about), and some of those names are educated guesses. Voice lines are named after the subtitle that matches their words, and a line whose subtitle isn't certain says **one of several**.

A sound without a name shows as *Sound 3* or *Take 2*. [Game audio, explained](wiki:game-audio#why-many-things-are-called-sound-3-or-take-2) says why. To report a wrong or missing name, use the [Wrong or missing name](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml) form on GitHub.

### How does Audiodiver know what music plays in which scenario?

The game chooses music with named states: the ship, the drop, the enemy faction, exploring, a battle and how heavy it is. Audiodiver reads those states and the rules that switch between them from the sound banks, and lists the music in the order a mission meets it, from *On the Ship* to *Credits*. Music that no state places is listed under *Not identified yet*. Transitions are named by what they connect, and stingers by what they play over. The order inside a piece of music comes from the playlist of the piece, which the [Soundtrack](wiki:soundtrack) shows.

### What are slots, segments and takes?

A **slot** is one clip that can be replaced. Music is made of **segments** that play one after another, each with one or more slots. A sound has **takes** and plays one of them each time. [Game audio, explained](wiki:game-audio) has the full glossary.

## Making a mod

### How can I add new audio to existing segments?

Drop an audio file on a segment's slot in the [Audio](app:editor) tab. The new audio replaces the original, and the segment's timing follows the new length ([Timing, cue points and loops](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)). Several files dropped on a piece fill the slots in play order. To put one song across a whole piece, use **Slice a song**, or **One Song** in the [Soundtrack](wiki:soundtrack#one-song). For a playlist of whole songs, use **Playlist** there.

Music can't get extra takes or layers. Those are for sounds and voices, see [Adding audio](wiki:adding-audio).

### Why does my song play out of order in game?

The game rarely plays a piece of music top to bottom. Most combat music opens each fight on a short opening, picks some segments at random, and goes on from where the last fight stopped. The [Soundtrack](wiki:soundtrack) shows the play order of each piece, and **One Song** makes every fight play the song from the start. [How the game plays music](wiki:how-the-game-plays-music) explains the parts.

### Why do I still hear the original audio?

Usually one of these:

- A layer of the segment still plays the original. [Layers](wiki:how-the-game-plays-music#layers) explains how to silence it.
- The slot plays only under a condition, such as a biome, and another variant plays elsewhere ([Variants](wiki:how-the-game-plays-music#variants)).
- An original transition plays between two pieces of new music ([Transitions and stingers](wiki:how-the-game-plays-music#transitions-and-stingers)).
- A sound has several takes and some of them are still original. Replace all of them.
- The sound is also in banks the project doesn't list. **Patch every bank with the sounds** on the Build tab covers them ([Every bank with the sounds](wiki:build-and-install#every-bank-with-the-sounds)).

### Which audio files can I use?

WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA and WEM. WAV or FLAC at 48 kHz gives the best result, and a WEM in Wwise Vorbis goes into the mod unchanged. See [Preparing the audio](wiki:preparing-audio#formats).

### How do I make new audio louder or quieter?

Set **Make-Up Gain** on the slot, in the details on the right. Several selected slots take one value, and the **Level** of a piece in the Soundtrack raises or lowers all of it. [Make-Up Gain and the mix](wiki:volume) covers the levels, and [Preparing the audio](wiki:preparing-audio#loudness) the loudness to aim for.

### How do I silence a sound or a piece of music?

Right-click a slot and choose **Replace with Silence**. **Keep original duration** sets whether the game waits for the original length or moves on at once ([Silence](wiki:how-the-game-plays-music#silence)). A whole piece of music goes silent with **Silent** in the [Soundtrack](wiki:soundtrack#modes).

### Can I change subtitles and other text?

Yes, in the [Text](app:text) tab: every line in every language, with colours, sizes and emphasis. See [Text and subtitles](wiki:text).

## Building and sharing

### Does Audiodiver change the game files?

No. It only reads the game folder. A build makes a ZIP that a mod manager imports and deploys ([Building and installing](wiki:build-and-install#installing)).

### What do I do after a game update?

Open the project and build it again, then import the new ZIP in the mod manager ([When the game updates](wiki:game-updates#rebuild)). A mod made by someone else can be rebuilt for the current game with [Repatch](wiki:repatching).

### Can my mod run with other audio mods?

Two mods that change the same sound bank don't combine, and the one deployed later wins ([Two mods that change the same bank](wiki:build-and-install#two-mods-that-change-the-same-bank)). [Combine Mods](wiki:combining-mods) builds them into one mod.

### Why is my mod so big?

A mod carries a full copy of every sound bank it changes. Music is in every mission's music bank, and some sounds are in a hundred banks, so replacing them adds every copy ([Every bank with the sounds](wiki:build-and-install#every-bank-with-the-sounds), [Size](wiki:adding-audio#size)).

### How do I move a project to another computer?

**Export as Pack** on the Project tab saves the project and every file it uses as one `.audipack` file. Open it on the other computer ([Project folders](wiki:project-folders)).

### How do I share my mod?

Upload the ZIP from the build folder. [Sharing a mod](wiki:sharing) says what to include and what to leave out.
