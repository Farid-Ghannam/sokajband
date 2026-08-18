# Sokaj fan site

## To finish the theme-song feature
Drop the 4 instrumental/no-vocal audio files into `assets/audio/` using these exact names:
- 6l3-brasi-instrumental.mp3
- 7asis-eni-instrumental.mp3
- meen-had-instrumental.mp3
- alalam-alahmar-instrumental.mp3

That's it — the dropdown, mute button, and "play as theme song" buttons already point at those paths. Until the files exist, the site still runs fine, it just stays silent.

## To add real gallery photos
Put images in `assets/gallery/` and swap the `src` values in the Gallery section of `index.html`.

## To edit the bio / social links
- Bio copy is in the About section of `index.html` — written as a placeholder, meant to be rewritten with the band.
- Social links are `href="#"` placeholders in the Social section — swap in the real URLs.

## Structure
```
index.html
style.css
script.js
assets/
  logo.png
  covers/
    6l3-brasi.jpg
    7asis-eni.jpg
    meen-had.jpg
    alalam-alahmar.jpg
  audio/   (add mp3s here)
```
Plain HTML/CSS/JS, no build step — just open index.html or push the folder to GitHub Pages like your other projects.
