# WM Tagger

A lightweight, purely client-side web application for editing metadata and inspecting audio files (`.mp3` and `.wav`). 

This tool was created primarily for personal studio workflow and track management to quickly edit ID3 tags, embed artwork, and analyze loudness without relying on external servers or heavy desktop DAWs.

## Features & Technologies

* **Client-Side Processing:** All audio processing and tagging happen entirely in the browser using Web Audio API and ArrayBuffers. No audio is ever uploaded to a server.
* **Custom WAV RIFF Engine:** Features native JS parsing and injection of ID3 chunks into `.wav` containers without destroying existing audio chunks.
* **Integrated LUFS Analysis:** Uses Web Audio API buffer processing to calculate real-time integrated loudness (EBU R128).
* **Interactive Waveform Player:** Built with HTML5 Canvas and Web Audio API for custom audio previewing and seek navigation.
* **MP3 Tagging:** Integrated with [MP3Tag.js](https://github.com/eidoriantan/mp3tag.js) for parsing and writing MP3 ID3v2 frames.

## License & Usage

This project is **source-available** and free for **personal, non-commercial use**. 

You are welcome to study, run, and use this project for your personal workflow. Commercial distribution, hosting it as a paid/commercial service, or creating derivative commercial products is prohibited.

For complete licensing terms, see the [LICENSE](LICENSE) file.
