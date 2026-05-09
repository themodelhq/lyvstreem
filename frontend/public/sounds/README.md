# Sound effects

The moderation soundboard tries to play files from this folder **before** any
hosted URL. Drop in real recordings here and they will be used automatically
— no code changes needed.

## File names

The frontend looks up `/sounds/<id>.mp3` (preferred) or `/sounds/<id>.ogg` for
each soundboard button. Save your downloads under these exact filenames:

| Button label | Filename                |
|--------------|-------------------------|
| Laugh        | `laugh.mp3`             |
| Clap         | `clap.mp3` (real applause) |
| Cheer        | `cheer.mp3` (crowd cheering) |
| Aww          | `aww.mp3` (sad trombone)|
| Drum         | `drum.mp3` (drum roll)  |
| Air Horn     | `airhorn.mp3` (bull / air horn) |
| Tada!        | `tada.mp3` (fanfare)    |
| Boo          | `boo.mp3` (crowd boo)   |

Keep each clip short (≈ 1–3 s, < 200 KB) so it plays instantly.

## Where to get free recordings

These sources allow free hot-linking and unrestricted commercial use:

- **Pixabay Sounds** — https://pixabay.com/sound-effects/ (CC0, MP3 download)
- **Freesound** — https://freesound.org/ (mostly CC0/CC-BY, may need free login)
- **Mixkit** — https://mixkit.co/free-sound-effects/ (free with attribution)
- **Zapsplat** — https://www.zapsplat.com/ (free with attribution)

Suggested searches: "crowd cheering", "applause", "air horn", "sad trombone",
"drum roll", "fanfare", "crowd booing", "woman laughing".

## How fallback works

If a file is missing here, the app falls back in this order:

1. The hosted URL listed in `frontend/src/utils/soundEffects.js` (Google's
   public Actions Sound Library).
2. An in-browser Web-Audio synth so a click is never silent.

The synth is only there as a safety net — for the best-sounding moderation
panel, fill in this folder.
