# 📚 Book Animator

**Book Animator** is a browser-based tool that lets you build, organize, and voice-test story characters for animation projects.  
It includes autosave, OpenAI voice previews, and full upload support.

---

## 🌟 Features

### 🎭 Character Manager
- Add, edit, and manage characters.
- Each entry stores:
  - **Name**
  - **Notes / Personality details**
  - **Assigned OpenAI voice**
  - **Optional Eleven Labs Voice ID**
  - **Optional portrait upload**

### 🔊 Voice Preview
- Each character card includes a **🔊 button**.
- Click to hear a short OpenAI voice sample:
  > “Hello, I am [Character Name]. This is my voice.”
- Uses your **Cloudflare proxy** to reach OpenAI TTS:
  `https://ai-proxydjs.8deaea231.workers.dev/v1/audio/speech`

### 💾 Autosave System
- Automatically saves all data in browser **localStorage**.
- Autosaves when you edit, upload, or every 10 minutes.
- Displays “Autosaved ✓ [time]” or “Loaded saved data.”

### 📂 File Uploads
- **Music Uploads:** accepts audio files only.
- **General Uploads:** accepts any file type.
- Uploaded filenames are remembered between sessions.

### 🎨 Voices Included
```
Ember, Maple, Juniper, Sage, Alloy, Verse, Aria, Amber,
Spruce, Breeze, Vale, Shimmer, Cove, Sol
```
Default mapping:
| Character | Voice |
|------------|--------|
| Narrator | Ember |
| Sidetracked Sally | Maple |
| Darling Danielle | Juniper |
| Dark Dan | Spruce |
| Skater Skip | Breeze |
| Creative Callie | Vale |
| Zen Zena | Shimmer |
| Grumpy Gus | Cove |
| Ambush Annie | Sol |

---

## ⚙️ Setup & Usage

1. Upload **index.html** and this **README.md** to your GitHub repository.
2. Ensure your **Cloudflare Worker** is active at:  
   `https://ai-proxydjs.8deaea231.workers.dev`
3. Open the HTML page in your browser or via GitHub Pages.
4. Add characters, upload files, and test voices — everything autosaves.

---

## 🧰 Troubleshooting

| Problem | Solution |
|----------|-----------|
| No sound | Confirm your Cloudflare proxy is active and browser audio permissions are allowed. |
| Uploads missing | Refresh page — data reloads from localStorage. |
| Voice list blank | Edit the dropdown list in HTML or reload defaults. |
| Autosave not updating | Make any edit or wait for 10-minute timer. |

---

## 🧩 Tips
- Add more voices by editing the `<select id="ceVoice">` section in the HTML.
- Export your localStorage for backup in your browser developer console.
- GitHub Pages runs this app client-side — no server setup needed.

---

**Version:** 1.0  
**Date:** October 2025  
**Project:** Book Animator  
