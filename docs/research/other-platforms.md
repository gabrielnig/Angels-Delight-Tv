# Research: Design systems and UX of other streaming platforms

Date: 2026-11-17. Purpose: inform the Angels Delight TV design system and build plan (free, self-hosted, Netflix-style educational video, Nigeria first, mobile-first, low bandwidth, 100 short videos at launch).

## Method and confidence

- Sources were fetched with WebSearch and WebFetch in this session. Everything is paraphrased. No assets were copied.
- Confidence tags: [V] verified in a fetched source this session; [G] general product knowledge, not re-verified here (treat as a hypothesis to check on a real device before copying).
- Some official pages (Apple HIG playing-video and focus pages) were not on the fetch allowlist, so Apple guidance beyond Top Shelf is [G].
- Nigerian price points and data figures date from the cited articles and will drift.

## 1. Platform notes

### 1.1 Apple TV app and Apple HIG (tvOS, video, shelves)

- Layout and navigation: Top-level tab bar on the TV (Watch Now style home, store, library, search) [G]. Home is a stack of horizontal shelves. Apple describes the Top Shelf as the showcase area above the app row, with three layouts: a full-screen carousel, a single focusable row, and scrolling inset banners [V].
- Card and row design: Apple publishes exact artwork sizes for rows in three ratios: poster 2:3, square 1:1, and 16:9, each with an "actual", "focused" and "unfocused" size so artwork can grow slightly when focused [V]. A row must be long enough to fill the screen width and carry at least one label [V]. Images in a mixed row scale to the tallest item, so mixing ratios in one row changes heights [V].
- Hero: Full-screen carousel with two buttons by default: a primary play button and a More Info button [V]. Guidance says to feature new content, personalise toward resume, avoid ads and prices, and avoid promoting things the person already watched [V]. Banner carousel should have three to eight items; more than eight is hard to navigate [V]. Text inside banner images must also be in the image accessibility label [V].
- Player controls: System player with scrub bar, skip, subtitles and audio menu, info panel [G].
- Profiles: Handled by the system user switcher on tvOS [G].
- Typography: Large type for 10 foot viewing, system font (SF), generous safe margins [G].
- Colour: Dark UI on TV, content artwork provides the colour [G].
- Accessibility: Focus engine with a clear lift and highlight effect, VoiceOver labels, captions as a first class setting [V for VoiceOver labels on banners, G for rest].
- Strengths: Rigorous artwork spec, focus clarity, calm hero with two clear actions.
- Weaknesses for us: TV remote specific; much of it (parallax layered images, focus lift) is not needed for a phone first web app. Layered image artwork is expensive to produce.

### 1.2 Showmax (status in 2026)

- Status [V]: Canal+ announced on 5 March 2026 that Showmax would close as part of cost cutting after it took over MultiChoice in September 2025. Showmax ends its streaming service on 30 April 2026. Renewals and vouchers ran to 31 March, new subscriptions and renewals stopped 1 April. Content was to move toward DStv Stream. Showmax launched in August 2015 and had been posting growing losses.
- Therefore: do not model on Showmax as a live competitor. It is a case study in a pan-African, paid streaming product that could not sustain its economics. Our model (free, tiny catalogue, low running cost of about $12 to $17 per month) is deliberately different.
- UX (from memory, not re-verified) [G]: Showmax was known for mobile download support, a Netflix-like hero and rows, profiles, and local content emphasis. Treat as historical reference only.
- Lesson: local relevance and affordable data options mattered more than catalogue size, but the business model failed; keep our infrastructure cost low and avoid dependence on a large library.

### 1.3 Disney+

- Layout and navigation [V]: A recent US redesign added a "For You" tab in the top bar, separate tabs per service (Disney+, Hulu, ESPN), and a link to live programming. Profile switching was made more prominent so it is clear whose profile is active.
- Hero [V]: Rotating video carousel at the top of Home that previews titles while browsing.
- Card and row design [V]: Content rows moved to taller, poster style artwork, with badges marking new releases and season finales. Brand rows have their own look (brand tiles row) [V for brand rows, G for detail].
- Player controls: Standard: scrub, 10 second skip, audio and subtitles menu, up next end card, intro skip [G].
- Profiles [G]: Avatars of characters, a Kids profile with restricted content and simplified UI.
- Typography and colour [G]: Dark blue and near black base, white text, bright brand accents.
- Accessibility [G]: Captions, audio description tracks.
- Strengths: Strong profile clarity, kids mode, brand rows that give identity.
- Weaknesses: Dense, autoplaying video heroes cost data; service-first tabs add navigation complexity.

### 1.4 Prime Video

- Layout and navigation [V]: A 2022 redesign replaced top text tabs with an icon side menu on TV: Find, Home, Store, Live TV, Free with Ads, My Stuff. Search offers suggestions while typing and filters by category, genre, and 4K [V].
- Hero [V]: A larger "super carousel" banner with sub-navigation across All, Movies, TV Shows, Sports.
- Rows [V]: Bigger carousels for originals with maturity ratings, a regional top 10 row, and a row for current subscriptions.
- Labels [V]: Blue check for included titles, golden shopping bag for paid titles. Clear entitlement labelling is a strength; paid versus free mixing is also a weakness (confusing catalogue).
- Player controls [G]: X-Ray overlay with cast and music info, skip intro, 10 second skip, subtitles.
- Profiles [G]: Up to six profiles with kids profile.
- Nigeria [V]: Priced at NGN 2,300 per month or NGN 23,000 per year in one source. Downloads supported with possible expiry. The source did not describe a built-in data saver.
- Strengths: Top 10 by region, entitlement badges, search with filters.
- Weaknesses: Mixed free and paid content is confusing; busy home.

### 1.5 YouTube and YouTube Kids

- Layout and navigation [G]: Bottom tab bar on mobile (Home, Shorts, create, Subscriptions, Library). Home is a feed of large 16:9 thumbnails with title, channel, view count and duration badge.
- Card design [G]: Thumbnail first, duration badge in the corner, one to two lines of title.
- Player controls [V]: Double tap either side to skip 10 seconds; swipe up to enter full screen and down to exit; tapping the time toggles elapsed or remaining; captions button was moved to a more prominent position; chapters can be shown as a list with thumbnails by tapping the chapter title in the player [V].
- Data saving [V]: A "limit mobile data usage" style setting streams at lower resolution when not on Wi-Fi; users can manually lower quality, turn off autoplay, and download over Wi-Fi for offline viewing [V, from a how-to article]. Exact default quality values were not stated in the source.
- Profiles/accounts [G]: Google account based; supervised accounts.
- YouTube Kids [V]: Parental control offers content levels (Preschool, Younger, Older) or a mode where the parent approves everything. In approved-content-only mode the child can only watch selected videos, channels and collections, and search is disabled. Turning search off also clears the profile history and resets recommendations [V]. Timers exist (screen time limit) but were not described in the fetched page.
- Typography and colour [G]: Roboto family, white or dark theme, red accent used sparingly.
- Accessibility [G]: Captions with auto generated tracks, playback speed up to 2x, keyboard shortcuts on desktop.
- Strengths: Best in class player gestures, chapters, speed menu, data controls.
- Weaknesses: Recommendation rabbit holes, ads, autoplay pulling data; feed layout is not shelf curation.

### 1.6 Plex

- Navigation [V]: A late 2024 mobile redesign replaced the hamburger menu with a bottom tab bar (library, Live TV, On Demand, and so on). A personalised start screen suggests items to resume. A separate Discover tab. Watchlist moved to a more prominent top position because usage grew [V].
- Rows [G]: Continue Watching row first, recently added, then library shelves.
- Hero, player, profiles [G]: Large poster style rows, Plex Home managed users with PIN switch.
- Typography and colour [G]: Dark theme with a yellow-orange accent.
- Strengths: Resume-first home, clear Watchlist, bottom tabs on mobile.
- Weaknesses: Mixed personal library and ad supported content makes IA complex; TV platforms were to follow later.

### 1.7 Mubi

- Model [V]: Small, hand picked catalogue with no algorithmic ranking, rotating titles, themed collections that act like mood boards, and a single Film of the Day to encourage a daily visit. Reported weaknesses: search returns titles that are not currently available, few filters, and some inconsistent video quality and buffering reports [V].
- Layout, card, hero, player, typography, colour [G]: Editorial, magazine like layouts, large stills, text rich (notes, reviews), sparse black and white chrome.
- Strengths: Curation as the product; strong editorial voice. Relevant because we have only 100 videos.
- Weaknesses: Slower to find specific titles; rotation frustrates people wanting a title that left.

### 1.8 Kanopy and educational libraries

- Evidence limited in this session. [G] Kanopy is a library or university sponsored service: sign in with a library card, browse by subject and collection, play with captions and a transcript where available, and see a watchlist. Usage is limited by credits or tickets set by the sponsor (not needed for a free service like ours).
- Strengths for us: Subject based browse; "collections" curation.
- Weakness: Account friction and credit limits; plain card design.

### 1.9 Khan Academy

- Structure [V]: Courses contain units; units contain lessons; videos sit alongside articles and practice as learning materials on the unit page, rather than on a dedicated video page. Students see progress per unit on the course page.
- Progress model [V]: Skill levels shown with a tower graphic: Attempted (under 70 percent), Familiar (70 to 99), Proficient, Mastered. Course mastery challenges reappear every 12 hours after unlock for spaced review.
- Typography, colour, player [G]: Clean light UI, friendly rounded type, teal and blue; videos have transcripts and speed control.
- Strengths: Clear hierarchy of course, unit, lesson, and visible progress that is motivating.
- Weaknesses for us: Mastery needs exercises; we only have videos, so use simple watched / in progress / not started states.

### 1.10 Coursera video player

- Evidence limited. [G] Lecture page has the video on the left or top, an interactive transcript that highlights the current line, notes, speed control, quality, captions in many languages, downloads for offline in the mobile app, and course outline with completion ticks. Sticky "next item" button at the end.
- Related research [V]: Interactive transcripts that highlight words in real time, allow keyword search inside a video and offer download are valued because they help a broad range of learners; one university enabled them by default for new lectures. A noted limitation was they did not work in iOS full screen playback.
- Strengths: Outline with ticks, transcript sync.
- Weakness: Heavy page; dense.

### 1.11 TED

- Evidence limited. [G] TED talks pages: video at top, title, speaker, duration, transcript tab with timestamps, language selector for subtitles, "Up next" list and a related talks list, topic tags. Short talks (under 20 minutes) similar to our 1 to 8 minute clips.
- Strengths: Speaker and topic tagging, transcript language switch, clean player page.
- Weaknesses: Few progress features (no accounts needed).

### 1.12 Nigerian and African platforms

- IROKOtv [V, dated]: An early review of the Android app described a small download (about 22 MB), series and hour long movies, suggestions, actor pages and a downloads section. Streaming and downloading was sold through airtime at NGN 100 per week with a cap of 10 downloads, playable only inside the app. Lesson: payment through airtime and in-app only downloads match local realities, but the details are old. Current status of IROKO was not confirmed in this session.
- Netflix Nigeria [V]: Mobile plan priced around NGN 2,500 (480p) in one source, with Basic at 720p, Standard 1080p, Premium 4K; a 2021 launch of a mobile plan across 43 sub-Saharan countries including Nigeria; "partial downloads" allow watching before a download completes, rolled out on Android first [V]. The Nigeria price article suggests manual data saving: Wi-Fi downloads, lower mobile quality [V]. NCC estimates in that article: roughly 350 MB per hour for standard definition and 1 GB per hour for HD.
- Prime Video Africa: see 1.4.
- Local streaming newcomers (for example an EbonyLife platform in 2025) exist but were not studied in detail [V as existence, from search result titles only].
- YouTube data lite patterns: see 1.5.

## 2. Low bandwidth, mobile first patterns for Nigeria

- Context [V]: Over 157 million mobile internet subscriptions are reported for Nigeria in mid 2026, but connection quality, device capability and data cost vary widely. Recommendations from a Nigerian outlet: compress images, load images as the user scrolls, limit autoplay video, heavy animation and trackers; keep text titles usable if images fail; reserve space for images; show progress and acknowledge taps instantly; keep search tolerant of typos; save state through interrupted connections; test on cheap Android phones with limited storage [V].
- Quality defaults: Start in an automatic ABR mode that begins at the lowest or second lowest rung (360p or 480p) on mobile data and only climbs when throughput is stable. Provide a visible "Data saver" toggle that caps at 360p or 480p and disables previews and autoplay. Reference sizes: about 350 MB per hour SD and 1 GB per hour HD [V], so a 5 minute clip at 360p is a few MB; set quality labels with estimated MB per minute.
- Lazy loading: Lazy load poster images below the fold, serve responsive sizes with modern formats (AVIF/WebP), reserve aspect ratio boxes, no autoplay trailers in the hero by default, use a static poster hero with an optional preview on Wi-Fi only [V for principle, G for formats].
- Preloading: Do not preload video on cards. Fetch only metadata until Play is pressed; preload the next episode only on Wi-Fi.
- PWA and offline [V]: A PWA can offer offline video, but the Cache API alone is poor for large media since it cannot pause, resume, report progress or handle range requests well. The documented approach: download with Fetch streams, resume using Range, store chunks and metadata in IndexedDB, serve them from the service worker with 206 responses and range headers, rewrite HLS manifests to a single bitrate for offline, cache captions and posters with the Cache API, check free storage before download, show an offline page listing downloads [V, web.dev and ZDF case study]. Many teams use an existing media framework rather than building this from scratch [V]. The brief uses encrypted HLS with signed URLs, so offline download must be a later phase and reviewed against that protection.
- Install and shell: Installable PWA with app shell cached, so repeat visits load only data. Small JavaScript budget, few fonts, system font fallback [V principle].
- Resilience [V]: Keep resume position saved locally and synced later; show clear retry for failed segments; never lose place after a drop.
- Distribution: Telegram and WhatsApp share links with Open Graph posters [G]. Keep share cards small.

## 3. Comparison table

| Platform | Navigation | Hero | Rows and cards | Player highlights | Profiles | Data features | Status or note |
|---|---|---|---|---|---|---|---|
| Apple TV | Tab bar, shelves | Carousel with Play and More Info | 2:3, 1:1, 16:9 specs, focus growth | System player | System users | Not a focus | Reference for art specs |
| Showmax | Netflix like [G] | Banner [G] | Rows [G] | Downloads [G] | Yes [G] | Mobile downloads [G] | Closed 30 April 2026 |
| Disney+ | Top bar with For You and brand tabs | Rotating video carousel | Taller poster tiles, badges, brand rows | Standard | Prominent switch, kids | Downloads [G] | US redesign in progress |
| Prime Video | Icon side menu (TV) | Super carousel with filters | Regional top 10, entitlement badges | X-Ray [G] | Yes [G] | Downloads | Mixed free and paid |
| YouTube | Bottom tabs [G] | None (feed) | Large 16:9 thumbs, duration | Gestures, chapters list | Account | Data limit setting, offline | Gold standard for player |
| YouTube Kids | Simplified | None | Large tiles | Simplified | Parental controls, approved only | Same | Search can be disabled |
| Plex | Bottom tabs | Resume first start | Poster rows | Standard | Home users [G] | Not a focus | Watchlist prominent |
| Mubi | Editorial [G] | Film of the Day | Themed collections | Standard | Single | Not a focus | Curated, tiny catalogue |
| Kanopy | Subject browse [G] | Featured [G] | Collections [G] | Captions [G] | Library card | Not a focus | Credit limits |
| Khan Academy | Course, unit, lesson | None | Unit lists, progress towers | Transcript [G] | Learner and teacher | Light pages [G] | Mastery model |
| Coursera | Outline | None | Module list | Interactive transcript [G] | Learner | Mobile downloads [G] | Dense |
| TED | Topic browse [G] | Featured talk [G] | Talk cards [G] | Transcript, language [G] | None | Light [G] | Short talks |
| IROKOtv | Rows [G] | Banner [G] | Movies and series | Download or stream | Account | Airtime billed week pass (old) | Status unverified |
| Netflix Nigeria | Rows | Billboard [G] | Rows | Standard | Yes | Mobile plan, partial downloads | 480p on mobile plan |

## 4. Patterns shared by all (adopt)

1. Home is a vertical stack of horizontal rows with a single dominant hero above them.
2. Hero has exactly two clear actions: Play and More Info (Apple, Disney+, Prime, Netflix) [V for Apple].
3. Continue Watching is the first or second row and resumes to the exact second (Plex, Netflix, Disney+).
4. Cards are artwork first with a short title and a duration or progress strip; consistent aspect ratio per row [V Apple].
5. Bottom tab bar on mobile (Home, Browse, Search, My List, Profile) rather than a hamburger [V Plex].
6. Search with suggestions as you type and filters (Prime) tolerant of typos [V].
7. Profile switcher that is visible and shows who is active (Disney+), with a kids profile [V].
8. Captions on by choice, a playback speed menu, a quality menu, 10 second skip, and an up next end card.
9. Saved state: My List or Watchlist in a prominent position [V Plex].
10. Entitlement and status labels on cards (new, in progress, watched) in the Prime and Disney+ style [V].
11. Dark player surface with large touch targets and double tap skip gestures [V YouTube].
12. Respect low data: no unrequested autoplay, data saver mode, quality estimate, downloads on Wi-Fi [V].

## 5. Patterns worth borrowing from one platform

- Apple: published artwork sizes with a focus or safe zone; limit hero banners to three to eight items; hero text must also be exposed to screen readers; do not promote what the viewer already watched [V].
- Disney+: prominent active profile indicator; badges for new items; brand or category tiles row to give identity to our subject categories [V].
- Prime Video: regional "Top 10" row (translate to "Most watched this week"); filters in search; a small hero sub navigation (All, Videos, Series) [V].
- YouTube: tap and swipe gestures, tappable chapter title opening a chapter list with thumbnails, tap time to toggle remaining, prominent captions button, data limit setting [V].
- YouTube Kids: approved content only mode and content levels as a model for our kids safe flag, with search disabled in the strictest mode [V].
- Plex: resume first start screen; watchlist promoted to top level [V].
- Mubi: a single "Video of the Day" or "Lesson of the Day" slot to encourage a daily return, and themed collections that behave like mood boards (good for 100 videos) [V].
- Khan Academy: course, unit, lesson hierarchy with simple progress states; spaced review prompts (optional) [V].
- Coursera and the JHSPH research: transcript beside or under the video, highlighting the current line, search inside the transcript, download link [V].
- TED: topic tags, language selector for subtitles, related talks list [G].
- Netflix Nigeria: partial downloads (watch while downloading), a cheaper lower quality tier as the default for mobile [V].
- IROKOtv: small app size and an explicit downloads section [V, dated].
- ZDF PWA: offline page listing downloads, storage check before download, light and dark theme following system setting [V].

## 6. Educational platform specifics we need

- Progress: Per video progress bar on the card (thin strip at the bottom), three states (not started, in progress, completed after about 90 percent watched). Per series or course roll up such as "4 of 10 lessons". Keep it simple; Khan style mastery levels need exercises we do not have [V for model].
- Chapters: Even for 1 to 8 minute videos, support optional chapter markers (title and start time) in the admin, shown as ticks on the scrub bar and as a list (YouTube pattern) [V]. For very short videos, make chapters optional per video.
- Transcripts: Use the WebVTT already generated by faster-whisper. Show a transcript panel with click to seek, current line highlight, search within the video, and a download link [V]. On iOS fullscreen limitations may hide the panel; plan the transcript below the video and test iOS Safari, as the JHSPH note about iOS full screen shows [V].
- Related lessons: A "Next lesson" end card (series order first) and a "Related" row by category or tag (TED, Khan, YouTube) [G/V]. Prefer same series, then same category, then most watched.
- Learning aids: Playback speed (0.75x to 1.5x or 2x), 10 second back button for repeated listening, a "Replay last 10 seconds" gesture, caption language switch (phase 2 languages).
- Orientation: Series and course pages with a lesson list, total duration, estimated data use at the chosen quality, and completion ticks (Coursera outline pattern) [G].
- Kids: Kids profile with a restricted category set, no external links, and an optional "approved only" mode like YouTube Kids [V].
- Accessibility: Captions by default option, high contrast mode with the contrast warning already in the theme settings plan, text size control, focus visible states, all hero text available as text, labels for icon buttons, reduced motion respect, keyboard navigation for the player.
- Typography and colour guidance (from the platforms) [G]: legible sans serif, large body text on mobile (16px or more), strong contrast between title and thumbnail overlays, a single accent colour (our yellow) for the primary action only.

## 7. Recommendations for Angels Delight TV (short)

1. Adopt the shared pattern list in section 4 as acceptance criteria for the Home and Watch pages.
2. Default to a static poster hero (no autoplay video) with Play and More Info.
3. Ship Data saver with a visible toggle, ABR start at 360p on mobile data, lazy loaded posters with reserved space, and no preload of video.
4. Build the transcript panel and chapters early because they are the educational differentiator.
5. Plan offline downloads as a phase 2 feature; the documented IndexedDB and service worker approach conflicts with encrypted HLS until tested.
6. Add a "Lesson of the Day" slot and themed collections to make a 100 video catalogue feel curated.
7. Keep the kids profile strict by default, with an approved only option.

## Sources

- https://nairametrics.com/2026/03/19/showmax-to-shut-down-streaming-service-april-30/
- https://www.advanced-television.com/2026/03/05/canal-shutters-showmax-streamer/
- https://developer.apple.com/design/human-interface-guidelines/top-shelf.md
- https://www.techradar.com/streaming/disney-plus/disney-is-giving-its-apps-a-visual-revamp-for-easier-navigation-and-more-personalization-heres-whats-new
- https://techcrunch.com/2022/07/18/amazon-refreshes-prime-video-design-with-icon-based-navigation-and-a-dedicated-sports-tab
- https://techcrunch.com/2020/10/26/youtube-mobile-revamp-adds-more-gestures-visual-video-chapters-and-more/
- https://support.google.com/youtubekids/answer/6172308?hl=en
- https://innovation-village.com/how-to-save-mobile-data-on-tiktok-youtube-and-instagram-a-2025-guide-for-african-creators-and-viewers
- https://techcrunch.com/2024/11/22/plex-redesigns-its-app-to-look-more-like-a-streaming-service/
- https://alittlebithuman.com/everything-you-need-to-know-about-mubi-the-film-buffs-netflix/
- https://rosetta.to/u/khanacademy/tour-of-the-khan-academy-student-experience
- https://ctl.jhsph.edu/blog/posts/interactive-transcripts-during-lecture-playback/
- https://techpoint.africa/general/irokotv-app-let-nollywood-movie-lovers-rejoice/
- https://thisdaylive.com/index.php/2021/07/01/netflix-introduces-new-mobile-plan-with-partial-download-feature
- https://thecondia.com/netflix-vs-prime-video-nigeria/
- https://nannews.ng/article/why-low-data-web-design-still-matters-in-a-mobile-first-nigeria/
- https://web.dev/pwa-with-offline-streaming
- https://web.dev/case-studies/zdf
