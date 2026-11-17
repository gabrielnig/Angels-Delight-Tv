# Glossary

Domain and technical terms used across the Angels Delight TV documents. Terms are grouped, then listed alphabetically inside each group. Module ids (M01 and so on) refer to `docs/MODULES.md`.

## 1. Product and people terms

**Account.** The login identity, tied to one email address and one password. One account can hold several profiles. Billing does not exist because the platform is free. See M02.

**Admin.** A person who signs in at `/admin`. Admin is also the name of one role (see Role). Sister Vanessa uses the Admin role. See M12.

**ARKDEV.** The developer and technical owner of the platform (Unique, Lagos). Holds the Super admin role.

**Audit log.** An append-only record of who did what in the admin area and on sensitive viewer actions, with time, actor, target and before and after values. See M20.

**Autoplay next.** Behaviour where the next episode or the next suggested title starts after a short countdown when the current video ends. Can be switched off per profile. See M08.

**Catalog.** The full set of titles (videos and series), categories and their metadata that the platform knows about, whether published or not. See M04.

**Category.** A subject grouping used for browsing, for example "Health" or "Money". A title can belong to more than one category. See M16.

**Client.** The business owner of the product, Sister Vanessa. Items marked [CLIENT] in the modules document wait on her input.

**Continue Watching.** A per-profile row on Home listing titles the profile started but has not finished, with a progress bar. See M09.

**Curation.** The admin act of choosing which rows appear on Home, in what order, and which titles sit in each. See M17.

**Diaspora viewer.** A viewer outside Nigeria, usually on a fast connection, often on desktop or smart TV browser. Phase 2 audience.

**Draft.** A video or series that exists in the admin area but is not visible to viewers.

**Editor.** An admin role that can manage content, captions and curation but not users, roles or site settings. See M12.

**Episode.** A video that belongs to a series and has a season number and an episode number (or only an episode number when there is a single season).

**Finished.** The state of a video for a profile once playback has reached the finish threshold (see the Continue Watching rules in M09). A finished title leaves Continue Watching.

**Hero banner.** The large featured title area at the top of Home. See M05.

**Kids profile.** A profile flagged as for children. It only shows titles marked kid-suitable and cannot reach account or profile management without a password check. See M35.

**Live streaming.** Real time broadcast. Out of scope for launch, possibly later.

**My List.** A per-profile saved list of titles to watch later. See M10.

**Persona.** A representative user archetype used to reason about requirements. Defined in `docs/PRD.md`.

**Profile.** A named viewing identity inside an account (for example "Mum" or "Kids"). Watch history, My List, language and kids flag are per profile. See M03.

**Publish.** Make a ready video visible to viewers, now or at a scheduled time. See M28.

**Row.** A horizontal strip of title cards on Home or Browse, with a heading. Also called a shelf or carousel in other products.

**Series.** An ordered group of episodes presented on one page. See M07 and M16.

**Super admin.** The highest admin role, held by ARKDEV. Can manage roles, site settings, audit log and infrastructure level settings.

**Title.** The viewer-facing word for either a single video or a series.

**Up next.** The suggestion shown during or after playback for what to watch next.

**Viewer.** Anyone who watches. Needs an account and a profile.

## 2. Video and streaming terms

**ABR (adaptive bitrate).** Technique where the player switches between quality levels during playback based on measured network speed, so playback continues on poor networks. Handled by the player engine (hls.js). See M08.

**Bitrate.** Amount of data per second of video, for example 400 kbps. Higher bitrate means higher quality and more data use.

**Buffering.** The player waiting for more data before it can continue. Shown as a spinner after a short delay.

**CDN (content delivery network).** A network of servers that caches files close to viewers. Here, Cloudflare CDN in front of R2. See M22.

**Codec.** Method of compressing audio or video. Video: H.264 (AVC) for widest device support. Audio: AAC.

**Container.** File wrapper format, for example MP4, MOV, MKV, WebM (uploads) and fMP4 or MPEG-TS (HLS segments).

**DRM (digital rights management).** Hardware backed content protection such as Widevine or FairPlay. Not used. The platform uses signed URLs and HLS encryption instead. See M31.

**Encoding.** Converting an uploaded source video into the delivery renditions. Done by the FFmpeg worker. See M14. Also called transcoding.

**FFmpeg.** Open source command line tool for processing video and audio. Runs inside the encoding worker.

**Frame rate (fps).** Frames per second of the video.

**HLS (HTTP Live Streaming).** Streaming format that splits a video into short segments listed in playlist files (`.m3u8`), delivered over plain HTTP. Works with CDNs and supports ABR.

**HLS encryption (AES-128).** Segments are encrypted and the player fetches a key from an authorised endpoint. Casual deterrent against copying, not DRM. See M31.

**Keyframe (GOP).** A full frame at the start of each group of pictures. Segment boundaries align to keyframes so the player can switch quality cleanly.

**Master playlist.** The top level `.m3u8` file that lists all quality renditions of a video.

**Media playlist.** A `.m3u8` file for one rendition that lists its segments.

**Poster.** The still image shown on a card or before playback starts. Also called thumbnail. See M36.

**Rendition.** One encoded version of a video at a specific resolution and bitrate (360p, 480p, 720p, 1080p).

**Segment.** A short chunk of video, a few seconds long, that is fetched individually by the player.

**Sprite sheet (scrub preview).** A grid image of small frames from the video used for seek bar previews. Optional. See M08 and M14.

**Source file.** The original upload before encoding. Kept in R2 under a private prefix until the video is deleted.

**Thumbnail.** See Poster.

**Video.js.** Open source web video player framework (version 10 chosen). Hosts the UI and plugins. See M08.

**hls.js.** JavaScript library that plays HLS in browsers that lack native HLS. The playback engine under Video.js here.

**Vidstack, Plyr.** Fallback player libraries if Video.js v10 proves unsuitable. Decision recorded in `docs/DECISIONS.md` if used.

## 3. Captions and language terms

**Caption track.** One set of timed text for one language attached to one video, with a state (see Review states). See M15 and M11.

**CC (closed captions).** Captions that include speech and relevant sounds, which viewers can switch on or off.

**faster-whisper.** An optimised speech recognition engine used to generate English captions from the audio. Runs in the caption worker. See M15.

**Forced alignment.** Matching an existing script to the audio to produce accurate timings, used instead of recognition when a script is supplied.

**NLLB-200.** Open translation model considered for phase 2 caption translations. A paid translation service is the alternative.

**Review states.** Caption track states: `none`, `generating`, `needs_review`, `approved`, `rejected`. Only `approved` tracks are shown to viewers.

**Script.** The original written text of the video narration, if the client has it.

**Subtitle.** Timed text translating or transcribing speech. In this product, subtitle and caption are treated as the same feature and called captions.

**WebVTT (`.vtt`).** Web standard text format for timed captions, with cue timings and text. The only caption format delivered to the player.

**Cue.** One timed caption entry in a WebVTT file.

## 4. Infrastructure terms

**Bucket.** A top level container in object storage. Separate buckets (or prefixes) hold private sources, public renditions and backups.

**Cloudflare.** Provider of the CDN, DNS and R2 storage. Account ownership is a [CLIENT] item.

**Custom domain.** A domain such as `video.yourdomain.com` mapped to the R2 bucket through Cloudflare so files are served through the CDN.

**Docker / Docker Compose.** Container tooling used to run the app, database, worker and reverse proxy on the VPS.

**Egress.** Data leaving a storage provider to the internet. R2 has no egress fee, which is why it was chosen.

**Idempotency key.** A client supplied value that makes a repeated request safe to retry without duplicating its effect. Used for upload completion and progress saves.

**Multipart upload.** Large file upload split into parts that are sent separately and joined by storage. Basis of resumable upload. See M13.

**Next.js.** React framework used for both the viewer site and `/admin` in one codebase.

**Object storage.** File storage addressed by key, not by folder path on a disk. R2 is an object store compatible with the S3 API.

**Postgres (PostgreSQL).** The relational database holding accounts, catalog, progress, settings and audit data.

**Presigned URL.** A time limited URL that lets a client upload or download one specific object directly without sharing credentials. Used for uploads to R2 and for playback. See M22 and M31.

**R2.** Cloudflare's S3 compatible object storage.

**Reverse proxy.** The web server in front of the app (for example Caddy or Nginx) that terminates HTTPS and forwards requests.

**Signed URL.** A URL carrying a signature and expiry so only authorised requests succeed. Used for video segments and keys.

**VPS (virtual private server).** The rented server (Contabo in the EU, Hetzner as fallback) that runs the app and workers. Never used to serve video bytes.

**Worker.** A background process that takes jobs from a queue, such as the encoding worker (M14) and the caption worker (M15).

**Job queue.** Persistent list of background tasks with states, retries and backoff. See M30.

## 5. Web platform and performance terms

**Accessibility (a11y).** Making the product usable by people with disabilities. Target is WCAG 2.2 level AA. See M34.

**Cache API / Cache Storage.** Browser storage used by the service worker for app shell files.

**CLS (cumulative layout shift).** Measure of unexpected layout movement while a page loads. Skeletons are sized to avoid it.

**Data saver.** A viewer setting that limits quality to 360p, disables autoplay of previews and avoids prefetching. See M25.

**Lighthouse.** Tool that scores web performance, accessibility and PWA quality.

**LCP (largest contentful paint).** Time until the biggest visible element renders. A key speed metric.

**Manifest (web app manifest).** JSON file that lets the site be installed to the home screen. See M25.

**PWA (progressive web app).** A website that can be installed and can run parts offline through a service worker.

**Responsive.** Layout that adapts to screen width.

**Service worker.** A background script in the browser that caches files and handles offline behaviour.

**Skeleton.** A grey placeholder shaped like the content that is loading, with a left to right shimmer, shown for waits longer than 300 ms.

**Tap target.** The touch area of a control. Minimum 44 by 44 CSS pixels here.

**Web Vitals.** Google's set of user experience metrics (LCP, CLS, INP).

## 6. Security and privacy terms

**2FA / TOTP.** Second sign in step using a time based one time code from an authenticator app. Required for admin roles. See M12.

**CSRF.** Attack that tricks a signed in browser into sending an unwanted request. Mitigated with SameSite cookies and tokens.

**HttpOnly cookie.** A cookie that scripts cannot read, used for the session.

**NDPR / NDPA.** Nigeria Data Protection Regulation and the Nigeria Data Protection Act 2023, the privacy law the platform follows for Nigerian users. GDPR applies to EU viewers in the diaspora phase.

**Rate limit.** A cap on how many requests or attempts are allowed in a time window. Includes the sign in lockout. See M23.

**RBAC (role based access control).** Permissions are granted to roles, and users get roles. See M12.

**Session.** A signed in state tied to a cookie, with expiry and revocation. See M01.

**Token (verification or reset).** A single use random value with an expiry, sent by email.

**zxcvbn.** A password strength estimation library used for the live strength meter.

## 7. Documentation terms

**[CLIENT].** Module or item that needs input from Sister Vanessa before it can be finished. Build it configurable.

**[READY].** Module that can be built now without client input.

**Must / Should / Could.** Story priorities. Must is needed for launch. Should is wanted for launch if time allows. Could is later or optional.

**Given / When / Then.** The structure used for acceptance criteria.

**Story id.** Format `Mxx-Syy`, for example `M08-S03`, where Mxx is the module and Syy the story number inside it.
