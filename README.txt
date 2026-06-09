Lottery Analyzer PWA v1.1.2

This is the Android/PWA version of the Lottery Analyzer.

Features:
- Load CSV from Android or desktop browser
- Most Popular Proposal
- Popular + Longest Overdue Proposal
- Balanced Smart Proposal
- Gap Analysis Proposal
- Last Draw panel
- Hot Numbers
- Cold Numbers
- Gap Analysis
- Probability Dashboard
- Extra Numbers table
- Installable as PWA on Android Chrome

Local test:
1. Extract this ZIP.
2. Open a command prompt in the folder.
3. Run:
   py -m http.server 8000
4. Open:
   http://localhost:8000

Android use:
1. Host the folder on an HTTPS web server.
2. Open the site in Chrome on Android.
3. Tap menu -> Add to Home screen / Install app.
4. Launch the app.
5. Load the CSV file manually and press Analyze.

Important:
Android/browser security does not allow a PWA to automatically read a local CSV file every week.
The user must choose the CSV manually, unless we host the CSV online and add auto-download logic.

Next recommended improvement:
- Add Recommendation vs Actual Result comparison module.

Fix in v1.1.2:
- Better Hebrew CSV handling using windows-1255 / iso-8859-8 decoding fallback.
- Automatic delimiter detection for comma / semicolon / tab.
- More flexible header matching.

Fix in v1.1.2:
- Added 9-column positional fallback for the exact lottery CSV structure.
- This handles files where browser encoding/header recognition fails.
