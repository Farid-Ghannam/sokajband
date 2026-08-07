# Sokaj Fan Site — Handoff Notes

Give this file (or just paste it in) to a new Claude conversation, along with the
`sokaj` folder, and it'll have everything it needs to keep going.

## What this is
Fan website for **Sokaj (سوكاج)**, a real band who are personal friends of the
person building this. Built as a plain HTML/CSS/JS static site (no framework,
no build step) so it can go straight to GitHub Pages.

## Status: functional build, audio + social done, not yet deployed
Nothing has been pushed to GitHub yet.

## What's built
- **index.html / style.css / script.js** — full site: hero, sticky nav with
  hamburger slide-menu, About, Music, Gallery, Social, Footer.
- **Visual identity**: red (#e8161f) / black (#0a0a0a) / bone (#f2ede2), Anton
  for English display type, Cairo for Arabic body text. Jagged clip-path
  dividers between sections echo the lightning-bolt logo shape — this is the
  site's signature design element, keep it if iterating further.
- **Section headings now bilingual on one line**: each section-head (MUSIC,
  GALLERY, FOLLOW) has the Arabic label (الموسيقى / صور / تابعونا) sitting on
  the same line, pushed to the far right via `justify-content:space-between`
  on `.section-head`. The Arabic uses a new font, **Lalezar** (`--f-display-ar`
  variable in style.css), chosen because it's a bold poster-style Arabic font
  that visually matches Anton's chunky condensed look — plain Cairo looked
  too different in weight next to Anton. Same font-size as the English text.
  The small eyebrow line above (⚡ 01 / 02 / 03 / 04) now just shows the
  number, no longer duplicates the Arabic label.
- **Theme song feature** (the main interactive piece): dropdown in nav lets
  visitor pick 1 of 4 songs → background crossfades to a blurred version of
  that song's cover art + audio element swaps source. Starts muted (browser
  autoplay rule), mute button unmutes on click. Default song on load is
  **6L3 Brasi**. Also playable via a "play as theme song" button on each
  track in the Music section.
- **Audio files are in place** — all 4 instrumental mp3s exist in
  `assets/audio/` and the theme-song feature is fully working end to end.
- **Social links are real** — Instagram (@sokajband), Spotify, YouTube,
  TikTok (@sokajband) are all live URLs in the Social section, no more
  placeholders.

## Drop a message feature (added this session)
- **Firebase project created**: `sokaj-messages` (config is in `firebase-config.js`,
  safe to keep public — Firebase access control is enforced via Firestore
  rules, not by hiding the apiKey).
- **Public form**: new "Message" section in index.html (between Gallery and
  Social, nav updated to match) — name + message textarea, writes to a
  Firestore `messages` collection via `message.js`. No login needed to send.
- **Firestore rules** are in `firestore.rules` — public **create-only**,
  read/update/delete requires auth. **These have not been deployed to the
  Firebase console yet** — must be pasted into Firestore > Rules and
  published, or messages will fail with a permissions error since Firestore
  defaults to closed rules.
- **Admin page**: `admin.html` + `admin.js` — email/password login (Firebase
  Auth), lists all messages newest-first, mark-as-read, delete. Not linked
  from the public site (no nav link) — access by going straight to
  `admin.html` on the deployed domain. Auth user must be created manually in
  Firebase console (Authentication > Users) — same step as the setup process,
  done for the person's own login already.
- **Not yet tested end-to-end** — needs the Firestore rules published first,
  then a real submit-and-read test.

## What's NOT done / open items
1. **Bio copy is still placeholder.** In the About section of index.html,
   written in Claude's voice as a rough draft ("edit this bio however you and
   the band want it to read" note is right there in the HTML). Should be
   rewritten with/by the actual band.
2. **Gallery is still just reusing the 4 cover arts** as filler. Person wants
   to swap in real show/behind-the-scenes photos — folder `assets/gallery/`
   is referenced in the README but doesn't exist yet, create it when photos
   are ready.
3. **Not yet deployed.** Given past pattern (Mimi's birthday site, the
   Akher Zapheer wiki), this will likely go to a GitHub Pages repo. No repo
   created for this yet as of this handoff.

## File structure
```
sokaj/
  index.html
  style.css
  script.js
  README.md          <- setup instructions, also useful context
  assets/
    logo.png
    covers/
      6l3-brasi.jpg
      7asis-eni.jpg
      meen-had.jpg
      alalam-alahmar.jpg
    audio/
      6l3-brasi-instrumental.mp3
      7asis-eni-instrumental.mp3
      meen-had-instrumental.mp3
      alalam-alahmar-instrumental.mp3
```

## Person's working style (for the new session)
- Prefers complete, ready-to-use output over partial drafts/explanations.
- Moves fast, casual/brief communication — short direct instructions, expects
  Claude to just make the change and repackage, not explain at length first.
- Native Levantine Arabic speaker, fluent English — comfortable with mixed
  Arabic/English content and RTL considerations.
- Has deployed similar static sites to GitHub Pages before under github
  username `saayuiii` (personal) — this project may go there or a
  band-specific repo.
