---
id: R04
title: Settings dictionary
path: reference
summary: Every site setting in plain words, with its default, where to change it and who can.
role: admin
roleNote: Admins change most settings, Super admins change features and limits
needs: [C01]
related: [C04, C05, C10]
readMinutes: 12
screens: []
aliases: [settings, options, switches, defaults, configuration]
dependsOn: [packages/theme/src/settings-registry.ts]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Look up what any of the 113 site settings does. You end knowing its default, where to change it and who can change it.

## Before you start
This list is written from the settings list in the platform, so it always has every setting. Most are on **Site settings**. Read [Platform details and the Launch checklist](help:C01) first.

## Steps
1. **Platform name**: Shown in the header, page titles, emails and the app name.
   Group: Platform details. Where: Site settings, Platform details tab, and the Theme screen. Default: "Angels Delight TV". Who: Admins and Super admins.
2. **Tagline**: One short line under the name.
   Group: Platform details. Where: Site settings, Platform details tab. Default: Empty. Who: Admins and Super admins.
3. **Domain**: The public domain, without https://.
   Group: Platform details. Where: Site settings, Platform details tab. Default: Empty. Who: Admins and Super admins.
4. **Support email**: Where viewers can reach you.
   Group: Platform details. Where: Site settings, Platform details tab. Default: Empty. Who: Admins and Super admins.
5. **Help centre contact**: Email address or https link staff use to message the developer from the help centre. Leave empty to show a placeholder.
   Group: Platform details. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
6. **Footer text**: Shown at the bottom of every page.
   Group: Platform details. Where: Site settings, Platform details tab. Default: Empty. Who: Admins and Super admins.
7. **Social links**: Up to six links.
   Group: Platform details. Where: Site settings, Platform details tab. Default: Empty. Who: Admins and Super admins.
8. **Open sign up**: Anyone can create an account. Off means invite code only.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
9. **Kids profiles**: Viewers can create kids profiles.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
10. **My List**: Viewers can save titles to My List.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
11. **Guests can watch**: Anyone can watch without an account. Off means guests can browse but must sign in to play.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
12. **Default for visitors without an account**: What visitors see before they sign in, General or Kids. They can switch Kids mode on their own device.
   Group: Features. Where: No screen yet. Ask the developer. Default: "general". Who: Admins and Super admins.
13. **Maturity rating labels**: Five short labels from lowest to highest, separated by commas, for example G,PG,12,15,18.
   Group: Features. Where: No screen yet. Ask the developer. Default: "G,PG,12,15,18". Who: Admins and Super admins.
14. **Highest rating visitors without an account can see**: Place on the rating scale, 0 to 4. The default 2 is the third label.
   Group: Features. Where: No screen yet. Ask the developer. Default: 2. Who: Admins and Super admins.
15. **Auto rotate hero**: Hero slides change by themselves.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
16. **Data saver by default**: New viewers start with data saver on.
   Group: Features. Where: Site settings, Features and limits tab. Default: Off. Who: Super admins only.
17. **Require approved captions**: A video needs approved captions before it can be published.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
18. **Captions are available to viewers by default**: Videos that follow the site default offer captions. Each video can override this.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
19. **AirPlay button**: Show an AirPlay button on Safari. Turn it on only after a test on a real iPhone and Apple TV.
   Group: Features. Where: Site settings, Features and limits tab. Default: Off. Who: Super admins only.
20. **Sign in with Google**: Show Continue with Google on sign in. It also needs the Google keys added by the developer.
   Group: Features. Where: Site settings, Features and limits tab. Default: On. Who: Super admins only.
21. **Profiles per account**: Between 1 and 10.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 5. Who: Super admins only.
22. **Sessions per account**: Between 1 and 10.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 5. Who: Super admins only.
23. **Upload size limit**: Between 10 MB and 5 GB per file.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 5 GB. Who: Super admins only.
24. **Guest video link minutes**: How long a guest video link works before the player renews it. 5 to 120 minutes.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 20. Who: Super admins only.
25. **Failed sign ins before lockout**: Between 3 and 20.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 5. Who: Super admins only.
26. **Lockout minutes**: Between 1 and 1440.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 15. Who: Super admins only.
27. **Finished at percent**: A video counts as finished at this share watched.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 95. Who: Super admins only.
28. **Start threshold seconds**: Under this, a video starts from the beginning.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 5. Who: Super admins only.
29. **Rewind on resume seconds**: Resume this many seconds earlier.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 3. Who: Super admins only.
30. **Next video countdown seconds**: How long the next video waits before it starts by itself. Between 5 and 10.
   Group: Limits. Where: Site settings, Features and limits tab. Default: 5. Who: Super admins only.
31. **Seconds per hero slide**: How long each hero slide stays, from 5 to 60 seconds.
   Group: Home. Where: Site settings, Home tab. Default: 20. Who: Admins and Super admins.
32. **Slide waits for its clip**: On: a slide with a clip changes when the clip ends. Off: every slide changes on the timer.
   Group: Home. Where: Site settings, Home tab. Default: On. Who: Admins and Super admins.
33. **Seconds per hero clip**: How long a hero clip plays, 6 to 30 seconds. Longer videos play their best part.
   Group: Home. Where: Site settings, Home tab. Default: 20. Who: Admins and Super admins.
34. **Sound button on hero clips**: Clips start muted. On adds an Unmute button when the clip has sound. Kids never see it.
   Group: Home. Where: Site settings, Home tab. Default: On. Who: Admins and Super admins.
35. **Hero loops before it stops**: The hero stops after this many full rounds. 0 means it never stops.
   Group: Home. Where: Site settings, Home tab. Default: 2. Who: Admins and Super admins.
36. **Hero preview clips**: Play a short muted clip on the hero for fast connections when Data saver is off.
   Group: Home. Where: Site settings, Home tab. Default: On. Who: Admins and Super admins.
37. **Preview clips on unknown connections**: Some browsers do not report connection speed. On plays clips for them too. Off keeps their data use low.
   Group: Home. Where: Site settings, Home tab. Default: On. Who: Super admins only.
38. **Slowest link that plays clips (Mbps)**: Clips play only above this speed in Mbps. Lower it if clips will not play. 1 to 10.
   Group: Home. Where: Site settings, Home tab. Default: 2. Who: Admins and Super admins.
39. **Newest titles in the hero**: How many of the newest titles show when no hero titles are chosen.
   Group: Home. Where: Site settings, Home tab. Default: 5. Who: Admins and Super admins.
40. **View all label**: The link beside a row title.
   Group: Home. Where: Site settings, Home tab. Default: "View all". Who: Admins and Super admins.
41. **Continue row title**: The title of the row of titles a viewer has started.
   Group: Home. Where: Site settings, Home tab. Default: "Continue learning". Who: Admins and Super admins.
42. **Titles Trending needs**: Trending, Top 10 and Most liked stay hidden until this many titles qualify for the viewer.
   Group: Home. Where: No screen yet. Ask the developer. Default: 5. Who: Admins and Super admins.
43. **Plays Trending needs**: Trending stays hidden until the site has this many plays in the latest count.
   Group: Home. Where: No screen yet. Ask the developer. Default: 50. Who: Admins and Super admins.
44. **Hours before Trending is stale**: A Trending count older than this is treated as empty and the row is hidden.
   Group: Home. Where: No screen yet. Ask the developer. Default: 3. Who: Admins and Super admins.
45. **Titles in Top 10**: How many numbered titles the Top 10 row shows.
   Group: Home. Where: No screen yet. Ask the developer. Default: 10. Who: Admins and Super admins.
46. **Days Popular looks back**: Popular counts views over this many days.
   Group: Home. Where: No screen yet. Ask the developer. Default: 30. Who: Admins and Super admins.
47. **Views a title needs for Popular**: A title needs this many views in the window to count as popular.
   Group: Home. Where: No screen yet. Ask the developer. Default: 5. Who: Admins and Super admins.
48. **Titles Popular needs**: Popular is hidden, or shows the newest titles, until this many titles qualify.
   Group: Home. Where: No screen yet. Ask the developer. Default: 3. Who: Admins and Super admins.
49. **Default language**: Language of captions and the interface.
   Group: Languages and content. Where: No screen yet. Ask the developer. Default: "en". Who: Admins and Super admins.
50. **Caption languages**: Languages offered for captions.
   Group: Languages and content. Where: No screen yet. Ask the developer. Default: en. Who: Admins and Super admins.
51. **Interface languages**: Languages viewers can pick for menus and text. Only English until another language is published.
   Group: Languages and content. Where: Changes when a language is published on the Languages screen. Default: en. Who: Admins and Super admins.
52. **Series group and item names**: Choose a ready made name set or type your own words. A series can override this.
   Group: Languages and content. Where: Site settings, Series names tab. Default: The ready made set that ships with the site. Who: Admins and Super admins.
53. **Language publish threshold percent**: Share of core text that must be approved before a language can go live.
   Group: Languages and content. Where: No screen yet. Ask the developer. Default: 80. Who: Admins and Super admins.
54. **Translation glossary**: Names and terms kept as written in caption translations, one per line.
   Group: Languages and content. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
55. **Site description**: One or two sentences shown under the site name in search results and link previews.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: Empty. Who: Admins and Super admins.
56. **Social image link**: The picture shown when someone shares a link. Use a full https link or a path starting with a slash.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: Empty. Who: Admins and Super admins.
57. **Share text**: The words that go with a shared link. Use {title} and {siteName}.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: "{title} on {siteName}". Who: Admins and Super admins.
58. **Let search engines list the site**: Turn off on a test site so nothing is listed.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: On. Who: Admins and Super admins.
59. **X handle**: The site account on X, for example learntv. Leave empty if there is none.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: Empty. Who: Admins and Super admins.
60. **Show the title on share pictures**: Turn off when your posters already carry the title as text.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: On. Who: Admins and Super admins.
61. **Show a play badge on video share pictures**: A small play button on the picture a shared video link shows.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: On. Who: Admins and Super admins.
62. **Share options**: Which options the Share menu lists. Copy link is always on and the device share menu shows when the device has one.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: whatsapp, facebook, x, telegram, email, sms. Who: Admins and Super admins.
63. **Storage notice**: Show the short notice about what the site keeps on a visitor device.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: On. Who: Admins and Super admins.
64. **Storage notice text**: Plain words, up to 300 characters.
   Group: Discovery and notices. Where: Site settings, Discovery tab. Default: "This site keeps a few small things on your device so it can work and remember your choices. It does not track you for advertising.". Who: Admins and Super admins.
65. **Storage notice version**: Raise this number to show the storage notice again to everyone who already closed it.
   Group: Discovery and notices. Where: Site settings, Discovery tab, with the button Show notice again to everyone. Default: 1. Who: Admins and Super admins.
66. **Staff second sign in step**: After the password, staff enter a code from email or an authenticator app. Each person can switch on My account.
   Group: Security. Where: Site settings, Security tab. Default: Email. Who: Super admins only.
67. **Days before an idle staff sign in ends**: Staff sign in again after this many idle days. Each visit restarts the count. 1 to 30.
   Group: Security. Where: Site settings, Security tab. Default: 7 days. Who: Super admins only.
68. **Days before every staff sign in ends**: Every staff sign in ends after this many days, however busy. 1 to 90.
   Group: Security. Where: Site settings, Security tab. Default: 30 days. Who: Super admins only.
69. **Days a remembered device skips the emailed code**: Days a remembered device skips the emailed code. 0 turns Remember this device off. 0 to 90.
   Group: Security. Where: Site settings, Security tab. Default: 30 days. Who: Super admins only.
70. **Terms version**: Changes when the terms page is published.
   Group: Legal pages. Where: Changes by itself when you save a new version in Site settings, Pages tab. Default: "v0". Who: Admins and Super admins.
71. **Privacy version**: Changes when the privacy page is published.
   Group: Legal pages. Where: Changes by itself when you save a new version in Site settings, Pages tab. Default: "v0". Who: Admins and Super admins.
72. **Notice banner**: A slim notice shown on every page.
   Group: Maintenance. Where: Site settings, Maintenance tab. Default: Off, with no message. Who: Admins and Super admins.
73. **Maintenance mode**: Viewers see a maintenance page, admins can still sign in.
   Group: Maintenance. Where: Site settings, Maintenance tab. Default: Off. Who: Super admins only.
74. **Raw view event retention (days)**: Between 7 and 730.
   Group: Numbers. Where: Site settings, Features and limits tab. Default: 90. Who: Super admins only.
75. **Audit log retention (months)**: Between 6 and 120. Older entries are purged monthly.
   Group: Audit log. Where: Site settings, Features and limits tab. Default: 24. Who: Super admins only.
76. **Sponsors master switch**: The master switch. Sponsor messages never show while this is off, whatever else is set.
   Group: Sponsors and donations. Where: Sponsors screen, the master switch card. Default: Off. Who: Admins and Super admins.
77. **Home banner**: One sponsor card between rows on Home.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
78. **Title page card**: One sponsor card on title pages, below the action buttons.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
79. **Message after a video**: A still sponsor card beside Up next when a video ends.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
80. **Message before a video**: A skippable still sponsor card before a video starts.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
81. **Home banner position**: Show after this row. The banner never sits above the second row.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 3. Who: Admins and Super admins.
82. **Before card seconds**: How long the card waits before playback continues. Skip is always visible.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 5. Who: Admins and Super admins.
83. **Home banner views per day**: Per browser, per sponsor, per Lagos day.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 2. Who: Admins and Super admins.
84. **Title card views per day**: Per browser, per sponsor, per Lagos day.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 4. Who: Admins and Super admins.
85. **After video cards per visit**: Per browser session.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 1. Who: Admins and Super admins.
86. **Before video cards per visit**: Per browser session.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 1. Who: Admins and Super admins.
87. **Sponsor label wording**: The wording can change. The label can never be removed.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "sponsored". Who: Admins and Super admins.
88. **Open sponsor links in a new tab**: Sponsor links open in a new tab.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: On. Who: Admins and Super admins.
89. **Sponsor rotation**: Even shares days equally. Weighted follows each creative weight.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "even". Who: Admins and Super admins.
90. **Donations**: The master switch for donations. The Donate page and links stay hidden while this is off.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
91. **Monthly giving**: Donors can choose to give every month.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
92. **Donation currencies**: USD needs the USD switch and Paystack USD on your account.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: NGN. Who: Admins and Super admins.
93. **US dollar gifts**: Lets donors abroad give in USD.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
94. **Naira preset amounts**: In kobo. 50000 is NGN 500.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: ₦500, ₦1,000, ₦2,000, ₦5,000. Who: Admins and Super admins.
95. **Dollar preset amounts**: In cents. 500 is USD 5.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: $5, $10, $25. Who: Admins and Super admins.
96. **Smallest naira gift**: In kobo. Tiny gifts lose a large share to fees.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: ₦200. Who: Admins and Super admins.
97. **Largest naira gift**: In kobo. A guard against abuse.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: ₦5,000,000. Who: Super admins only.
98. **Organisation legal name**: Shown on the Donate page and on receipts.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
99. **Registration number**: Optional. CAC or other registration number.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
100. **Donate page title**: Draft wording, change it.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "Help keep lessons free". Who: Admins and Super admins.
101. **Donate page text**: Draft wording, change it.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "Gifts pay for hosting, captions and new lessons. Give what you wish.". Who: Admins and Super admins.
102. **Thank you title**: Draft wording, change it.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "Thank you". Who: Admins and Super admins.
103. **Thank you text**: Draft wording, change it.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "Your gift has been received. A receipt is on its way to your email.". Who: Admins and Super admins.
104. **Offer to cover fees**: Shows a checkbox so donors can add the fee to their gift.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
105. **Bank transfer details**: Shows your bank transfer instructions on the Donate page.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
106. **Bank transfer instructions**: Plain text. Shown escaped, never as markup.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
107. **Transparency page**: Shows a page explaining how gifts are used.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Off. Who: Admins and Super admins.
108. **Transparency title**: Draft wording, change it.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: "How gifts are used". Who: Admins and Super admins.
109. **Transparency introduction**: A short paragraph above the list.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
110. **Transparency items**: Use percentages that total 100, or amounts.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
111. **Transparency last updated**: Shown on the page.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
112. **Receipt reply address**: The address donors reply to when they answer a receipt.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: Empty. Who: Admins and Super admins.
113. **Payment event retention (days)**: How many days payment records are kept before they are removed.
   Group: Sponsors and donations. Where: No screen yet. Ask the developer. Default: 90. Who: Super admins only.

## What you should see
You know what each setting does and which screen changes it. Where it says No screen yet, ask the developer to change it.

## If something goes wrong
- **A setting is not on the screen.** It may be for Super admins only, or it has no screen yet. Check the Who and Where lines. [Features and limits](help:C04)
- **A change does not show for viewers.** Most changes show within a minute. Wait, then reload the site. [Home and Discovery settings](help:C05)
