# John's Quiz Site

A responsive, single-page trivia app built with React 18 and plain JavaScript. The app renders its pages into the `#root` element in `index.html`; no build step or package manager is required.

## Pages and features

The app switches between these views without navigating to separate HTML files:

- **Landing:** Start category selection or launch a quick random quiz.
- **Category selection:** Browse and search trivia categories, choose a difficulty, and set the quiz length to 5, 10, 15, or 20 questions.
- **Quiz:** Answer multiple-choice questions with a 20-second timer per question, progress tracking, streaks, and visual and optional sound feedback.
- **Results:** Review the score, accuracy, time taken, and answer-by-answer breakdown; retry or choose another category.
- **Leaderboard:** Open a dialog to view or clear the ten most recent scores saved in this browser.

The app also includes a shared navigation bar, an animated question-mark canvas backdrop, light and dark themes, and fallback categories and sample questions when the trivia service is unavailable.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | HTML shell. Loads the Google Font, React and ReactDOM browser builds, Lucide icon data, Canvas Confetti, the stylesheet, and `script.js`; provides the React mount point. |
| `script.js` | React components and app logic, including navigation, category and question requests, quiz settings and gameplay, results, theme and sound controls, and saved scores. |
| `style.css` | App styles for themes, layout, shared controls, each view, the canvas backdrop, dialogs, animations, and responsive breakpoints. |
| `use-case-diagram.md` | Mermaid use-case diagram of player workflows and external services. |

## Run locally

You can use VS Code Live Server or any local static web server. For example, from the project directory:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Stop the Python server with `Ctrl+C`.

The app loads React, ReactDOM, Lucide, Canvas Confetti, and the Plus Jakarta Sans font from CDNs, and requests live categories and questions from the Open Trivia Database. An internet connection is needed for those services; fallback content is used if trivia requests fail.

## Technologies and services

- **React 18** and **ReactDOM** render the app directly in the browser. Components use `React.createElement`, so there is no JSX transform or build step.
- **Lucide** provides icon data, rendered as SVG by the app.
- **Canvas Confetti** is loaded for score celebrations.
- **Google Fonts** provides Plus Jakarta Sans.
- **Open Trivia Database API** supplies category lists and quiz questions.
- **Browser APIs** provide local storage, Web Audio sound effects, the animated canvas, and quiz timers.
- **CSS** in `style.css` provides the complete layout and visual styling; no Tailwind CSS dependency is used.

## Data and privacy

Category and question requests are sent to the Open Trivia Database. The app saves the selected theme under `johns_quiz_theme` and recent scores under `johns_quiz_scores` in the current browser's `localStorage`. Scores are not sent to a project-owned backend. Use **Clear History** in the leaderboard to remove saved scores.

## Customization

- Edit `FALLBACK_CATEGORIES` and `FALLBACK_QUESTIONS` near the top of `script.js` to change offline content.
- Update the React components and app state in `script.js` to change views or quiz behavior.
- Change theme variables and view styles in `style.css` to adjust the appearance.
- Update CDN links, the page title, or the mount point in `index.html` as needed.

## License

This project does not currently have a license. All rights are reserved by default; no permission is granted to use, copy, modify, or distribute this project's code.

Data provided by the Open Trivia Database is available under the [Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
