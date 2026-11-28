# Store listing · ItsLit Reading Club

- **Name:** ItsLit: Classic Book Club
- **Subtitle (iOS, 30 chars):** The classics, finally lit.
- **App ID:** `com.itslit.readingclub` (permanent once published; change it in `capacitor.config.json` before the first upload if you prefer another)
- **Category:** Books (secondary: Education)
- **Age rating:** 12+ on the App Store, Teen on Google Play (reader posts, and classic literature's mature themes discussed without graphic detail). Accounts are for readers 13 and over.
- **Privacy policy:** https://bsilva87921.github.io/itslit/privacy.html
- **Data collected (for the privacy questionnaires):** email address and display name (account), user content (Salon posts), user ID. Used for app functionality only. Not sold, not used for tracking, no advertising. Questions to Shelley are sent to the AI provider to write the answer and are not stored.
- **Keywords (iOS):** classics,book club,reading,literature,study guide,summary,Jane Austen,Shakespeare,Frankenstein,AI librarian
- **Short description (Play, 80 chars):** 20 classics in plain English, a 3D library, an AI librarian and a book salon.

**Description**

ItsLit is a candlelit reading club for the great works: the classics, finally lit.

• A 3D library: pull a book from the shelf, turn it in your hand and open it.
• Twenty great works broken down in plain English, part by part, from The Odyssey to The Great Gatsby, with who's who, the big themes and why each one still lands today. Spoilers stay sealed until you choose to break the seal.
• Shelley, your AI librarian, named for Mary Shelley, who began Frankenstein at eighteen. Ask anything, any hour, with spoiler-free mode on by default. She helps you think; she won't write your essay.
• The Matchmaker: tell it what you love (Bridgerton, true crime, a good cry) and it pairs you with your next classic.
• The Salon: a friendly conversation under every book, with spoiler warnings, cheers and a report button.
• Your shelf: want to read, reading and finished, on every device.
• The Gazette: letters on the great works from the editor, every Sunday.
• Read-aloud synopses, a daylight and candlelight theme, and the Library works offline.

Free to join. Free texts of every book courtesy of Project Gutenberg.

**Screenshots:** `itslit/screenshots/` (phone and desktop), or take new ones from the test app.

## Before you submit

- **Google Play:** a developer account ($25 once). New personal accounts must run a closed test with at least 12 testers for 14 days in a row before they can publish to everyone, so start the closed test early (family and the first club members make good testers). Use the Android project from the **ItsLit app builds** workflow, then in Android Studio: Build → Generate Signed Bundle (AAB). Keep the signing key safe: you need it for every update.
- **App Store:** the Apple Developer Program ($99 a year) and a Mac with Xcode (or a cloud Mac). Open the Xcode project from the workflow's artifacts, set your Team, then Product → Archive → App Store Connect.
- **Apple's rules for apps with posts (guideline 1.2):** a way to report posts (built in), editors who can remove them (built in), published contact details (set `contactEmail` in `itslit/config.js`), and a way to block abusive readers: add "block this reader" before submitting to the App Store.
- **Apple's sign-in rule (guideline 4.8):** apps that offer Google sign-in may be asked to offer Sign in with Apple too. The native app currently offers email and password only, which avoids the question; Google and Apple sign-in in the native app need the Capacitor Firebase Authentication plugin.
- Test sign-in, posting and Shelley on the test APK before submitting.
