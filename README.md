# Gainloop

A phone-first web app for building muscle. You give your details, answer the PAR-Q+ health questionnaire one question at a time, and say what you can lift, and for how many reps, on seven lifts so the first weights are right. Measure yourself with a soft tape any time from the Body tab and it sets targets from your frame, builds training around your equipment and the exercises you already do (cardio included), and plans meals that follow your food rules and health conditions. Every exercise has illustrated how-to pictures with the kit you need. Type the food you have and an AI suggests meals from only that food, sized to your plan. Log a day off plan and it spreads the difference over the next few days. A five-question wellness check every Sunday sets how hard the coming week's sessions are. It checks in every two weeks and adjusts, saying why each time.

It's a Progressive Web App (PWA): a website that installs to your home screen, opens full screen and works offline. There's no build step. Everything is plain HTML, CSS and JavaScript. The only server code is a small function on Cloudflare that talks to a free AI model for the AI features.

---

## What makes it different

Most rows answer a gap found in recent reviews of Strongr Fastr, MeThreeSixty, ZOZOFIT and FitScan, Bodymapp's device limits, and critiques of muscle-potential calculators.

| Gap in other apps | What Gainloop does |
|---|---|
| Measuring isn't connected to planning | Your tape measurements decide which muscles get extra sets. Each check-in re-plans from your new numbers. |
| Measurements can't be trusted or corrected | You type exact numbers, edit or delete any entry, and get how-to-measure tips for each spot. The plan recalculates. |
| Scanning is fiddly and needs a certain phone | A £3 soft tape, on any phone with a browser, on your own. |
| Meal plans ignore food rules | Vegetarian, vegan, halal, allergies and dislikes are hard rules. You can see which meals were hidden and why, add your own meals, and get a shopping list. |
| Built for weight loss, not muscle | Gain pace is set by training experience. Check-ins also watch your waist against your arms and chest to catch fat gain. |
| Muscle-potential targets don't fit most people | Targets come from wrist, ankle and height, but your aim starts at 90% of them and lean mass is compared at your current body fat. Women get trend tracking rather than targets built from men's data. |
| Paywalls and shifting prices | Free, no account, data stays on your device, with backups to a file. |
| Plans change without explanation | Every change to calories or training is logged with the reason and the numbers behind it. |
| Beginners don't know how to do the moves | Every exercise has illustrations of the start and end of the move, switching back and forth, plus the kit you need and three plain steps. Pictures for your sessions are kept on the phone, so they show at the gym without signal. |
| Generated plans throw away what you already do | Tell it the exercises you do now (any name: "bench", "RDL", "pull-ups") and the plan keeps them, building the rest around them. Anything it can't fit comes with a reason. |
| Meal plans assume a big shop | Type the food you have and the AI suggests meals that use only that food (plus oil, salt and spices), sized to your plan and checked against your food rules before you see them. Amounts of staples like rice, pasta and oil are checked against typical label values too. Or tick foods from a list for ideas made on the phone. Use one for any day with a tap. |
| One day off plan derails the plan | Log a meal you skipped, swapped or added (the AI can estimate it). Gainloop spreads the difference over 3 days to 2 weeks, never more than 15% a day, protein unchanged, with optional extra cardio, and explains it. |
| Cardio is missing or bolted on | 12 cardio options with pictures and calorie estimates. Cardio you do goes at the end of two sessions a week, kept easy while you build muscle. |
| Plans don't care how you feel | Every Sunday, five questions on fatigue, sleep, soreness, stress and mood (scored 1 to 5, from an athlete wellness questionnaire). Compared with your own normal, the score makes the week fresh, normal, tired or lighter, and that decides whether your weekly load goes up or down, by 5% at most. Every session always has exactly 6 exercises, then a separate 10 minutes of cardio. |
| New lifters start at a guessed weight | You say what you can lift, and for how many reps, on seven lifts (bench, deadlift, squat, lat pulldown, seated row, shoulder press, calf raise), with none skipped. Behind the scenes, a one rep max from weight ÷ (1.0278 − 0.0278 × reps), to the nearest 2.5 kg, sets those starting weights, and every other exercise is worked out from them. They show up as the weights in each week's routine, with no extra screen. |
| No safety screen before training | The PAR-Q+ (2025) is asked in full after your details, one question per screen with a Back button. A result that asks for more advice never blocks you, and it is asked again after 12 months. |
| Health conditions are ignored | Diabetes (type 1, type 2, prediabetes), high blood pressure, heart and kidney conditions, coeliac disease, high cholesterol, asthma and joint pain change the meals, rep ranges and exercise choices, with safety notes. |

### Next

- A chat with the AI coach about your plan
- Accounts and sync, so your data follows you between devices
- Reminders for weigh-ins and check-ins
- Progress photos kept on your device
- In the store app: weight from Apple Health or Health Connect

---

## Put it online (free)

Gainloop is hosted on Cloudflare Pages: every push to `main` goes live at [gainloop.pages.dev](https://gainloop.pages.dev) in a minute or two, and every other branch gets its own preview link. The free plan doesn't limit visitors and allows 500 deploys a month.

The AI features run on Cloudflare too: `functions/api/ai.js` is a Pages Function that calls Workers AI through the binding in `wrangler.toml`, so there's no API key to manage. Workers AI's free allowance is 10,000 neurons a day. A meal idea uses roughly 100 neurons, an estimate or coach note far less, so that's usually 80 to 100 meal ideas a day. When it runs out, the AI features say so until it resets at midnight UTC, and everything else keeps working. The AI only works where the function runs: on Netlify or GitHub Pages the rest of the app works without it.

The repository is also still connected to Netlify at [gainloop-app.netlify.app](https://gainloop-app.netlify.app). Netlify's free plan allows about 20 deploys a month, and when its credits run out the site goes offline until they reset.

### Cloudflare Pages (what Gainloop uses)

1. Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Go to **Workers & Pages → Create application → Pages → Connect to Git**. Sign in with GitHub and give Cloudflare access to only this repository.
3. Pick the repository and press **Begin setup**. Set the production branch to `main` and the framework preset to **None**. Leave the build command and build output directory empty, because the site is the repository root.
4. Press **Save and Deploy**. From then on every push to `main` goes live.

Cloudflare reads `_headers` for the cache rules and serves `404.html` for addresses that aren't part of the app. It also redirects `/index.html` to `/`, which `sw.js` allows for. The AI binding comes from `wrangler.toml`, so nothing needs setting up in the dashboard.

### Quickest: Netlify Drop

1. Unzip `gainloop.zip` so you have a `gainloop` folder with `index.html` inside.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the `gainloop` folder onto the page.
3. Log in or sign up to claim it. Until you do, the link sits behind a temporary password.
4. New Netlify accounts make projects private by default. Open the project and press **Make public**, or go to **Project configuration → General → Visitor access → Project visibility**.
5. Optional: on the project overview, choose **Customize → Manage project name and cover image** and rename it to get a link like `gainloop-yourname.netlify.app`.

To update it later, drag the changed folder onto the drop zone on your project's **Deploys** page.

### Better once you're editing: GitHub and Netlify

1. Put the contents of this folder in a GitHub repository (create the repo, open it in Codespaces, copy the files in, commit and push).
2. In Netlify: **Add new project → Import an existing project → GitHub**, pick the repository. Leave the build command empty and set the publish directory to the folder that holds `index.html` (`.` if it's the repo root).
3. From then on, every `git push` goes live in about a minute.

### Alternative: GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick `main` and the root folder. The app's paths are relative, so it works under `username.github.io/repo-name/`. Only the not-found page assumes the site sits at the root of its address. On a free GitHub plan the repository has to be public. GitHub Pages ignores `_headers`, which is fine.

---

## Add it to your phone's home screen

- **Android (Chrome):** open your link, then use the **Install** button on the You tab, or the menu **⋮ → Install app / Add to Home screen**.
- **iPhone (Safari):** open your link, tap **Share → Add to Home Screen**.

On iPhone the home-screen app keeps its own data, separate from Safari. Set up inside the home-screen app, or move data across with a backup and **Restore**.

---

## Your data

- Everything is saved in the browser on that device (`localStorage`), including any health details and your weekly wellness answers, which are never sent anywhere. The exercise search and the tick-list meal ideas run on the phone.
- The AI features send only what each one needs, and only when you tap: your food list, that meal's calorie and protein targets and your food rules for meal ideas; what you typed for an estimate; the numbers of your back-on-track plan for a coach's note. Health conditions aren't sent, only what they change about food (like a carb limit). No name, measurements or weight. Cloudflare says it doesn't use this to train AI models.
- Clearing the site's data, or uninstalling the app, deletes it. Use **You → Download backup** (or **Copy backup**) now and then, and before you change phone.
- Restore from **You → Restore** or from the welcome screen.
- Saved data belongs to the web address it was saved on. When the app moves to a new address (for example from gainloop-app.netlify.app to gainloop.pages.dev), open the old address and use **You → Download backup** or **Copy backup**. Then use **Restore** on the new address and add the new address to your home screen.
- Data doesn't sync between devices yet. That's the next phase.

---

## Editing

### Run it locally (Codespaces or any computer)

ES modules don't load from `file://`, so serve the folder:

```bash
cd gainloop
python3 -m http.server 8080
```

In Codespaces, open the forwarded port 8080. Edit a file, save, refresh.

### What's where

| File | What it does |
|---|---|
| `index.html` | Page shell. Loads the CSS and `js/app.js`. |
| `css/app.css` | All styling. Colours are tokens at the top, with light and dark versions. |
| `js/app.js` | Every screen, button and form. |
| `js/calc.js` | The maths: body fat, frame targets, calories and the check-in rules. |
| `js/plan.js` | Builds the training plan (exactly 6 exercises a session), keeping the exercises you already do, and the progression advice. |
| `js/meals.js` | Meal planner, diet and health filters, portion scaling and shopping list. |
| `js/pantry.js` | "Cook with what you have": meal ideas from the foods you tick. |
| `js/health.js` | Health conditions: what each one changes and its safety notes. |
| `js/track.js` | The food log and back-on-track plans: daily targets, safe limits, extra cardio. |
| `js/wellness.js` | The weekly wellness check: the questions, your score against your normal, and how the week's sessions change. |
| `js/parq.js` | The PAR-Q+ (2025) questions, used unchanged, which question comes next, and the result. No screens in it. |
| `js/strength.js` | The 1RM formula, the seven test lifts, and the starting weight for every exercise from them. |
| `js/load.js` | Weekly load (weight × reps × sets) for legs, push and pull: closes each finished week, and plans next week within 5% of it, shared out as a weight and reps for each exercise. |
| `js/ai.js` | Talks to the AI helper and checks its answers: totals, food rules, foods you didn't list. |
| `functions/api/ai.js` | The AI helper on Cloudflare: meal ideas, food estimates and coach notes from Workers AI. |
| `wrangler.toml` | Cloudflare settings: the site folder and the Workers AI binding. |
| `js/search.js` | Exercise search that understands gym names like "RDL" or "pull ups". |
| `js/engine.js` | Joins it up: setup, check-ins and the example data. |
| `js/store.js` | Saving, backups and the example profile. |
| `js/charts.js` | Tape gauges and the weight chart. |
| `js/units.js` | cm/in, kg/stone/lb conversions. |
| `js/util.js` | Small helpers: dates, formatting, escaping. |
| `js/download.js` | Saves backup files. |
| `js/data/exercises.js` | Exercise library. |
| `js/data/guides.js` | For each exercise: the kit, three how-to steps, other muscles worked and other names people use. |
| `js/data/pictures.js` | Which pictures in `img/ex/` go with each exercise. |
| `img/ex/` | Exercise pictures: the start and end of each move, plus small thumbnails in `t/`. |
| `js/data/foods.js` | Ingredients (per 100 g) and meals. |
| `sw.js` | Offline support. |
| `manifest.webmanifest`, `icons/` | Home-screen name, colours and icons. |
| `_headers` | Cache rules for the service worker and manifest. Cloudflare Pages and Netlify both read it. |
| `404.html` | The page shown for addresses that aren't part of the app. |
| `fonts/` | Barlow and Barlow Condensed, self-hosted (SIL Open Font License). |

### Common changes

- **Add a meal:** copy an entry in `MEALS` in `js/data/foods.js`. `items` are `[ingredientId, grams]` pairs using ids from `INGREDIENTS`. The planner scales portions to your calories, so pick normal amounts.
- **Add an ingredient:** add it to `INGREDIENTS` with per-100 g `kcal`, `p`, `c`, `f`, a `shop` group and the flags the diet rules check: `meat: 'chicken'` (or `'beef'`, `'lamb'`, `'pork'`), `fish`, `dairy`, `egg`, `gluten`, `nuts`, `soy`, `sesame`, `honey`, `alcohol`. A missing flag means a rule can't catch it, so be thorough.
- **Add cardio:** copy a cardio entry at the end of `EXERCISES` (`m: 'cardio'`, `load: 'min'`, `rr` in minutes, `met` for easy, moderate and hard from the Compendium), then give it a guide and pictures like any exercise.
- **Add an exercise:** copy an entry in `EXERCISES` in `js/data/exercises.js`. `m` is the muscle, `k` is `c` (compound) or `i` (isolation), `eq` lists the equipment it suits, `rr` is the rep range and `step` the weight jump in kg. Add `auto: false` if the planner should only use it for people who already do it. Then give it a guide in `js/data/guides.js` and pictures in `js/data/pictures.js` (copy two pictures into `img/ex/` named `<name>-1.webp` and `<name>-2.webp`, and a small one into `img/ex/t/<name>.webp`). Without pictures it still works, it just shows the steps.
- **Change a health rule:** `healthRules()` in `js/health.js` decides what each condition changes, and `STRESS` lists the exercises left out for each sore joint.
- **Change the wellness rules:** `assess()` in `js/wellness.js` turns answers into a fresh, normal, tired or lighter week, `weekSettings()` says how hard each week is, and `loadDelta()` in `js/load.js` says how far the load moves (never more than `MAX_CHANGE`, 5%).
- **Change the exercise count:** `MAX_EXERCISES` and `MAX_SETS` at the top of `js/plan.js`. Every session is filled to exactly `MAX_EXERCISES` (step 6b of `buildProgram()`). If you change how plans are built, bump `PROGRAM_VERSION` so saved plans are rebuilt once.
- **Change the load groups or the 5% limit:** `LOAD_GROUPS`, `GROUP_OF` and `MAX_CHANGE` in `js/load.js`.
- **Change the calorie rules:** `calorieDecision()` in `js/calc.js`.
- **Change colours or fonts:** the tokens at the top of `css/app.css`.

### When you add a file

Add its path to `SHELL` in `sw.js` so it works offline. When you ship a big change, bump `CACHE` (for example from `gainloop-v5` to `gainloop-v6`) so old copies are cleared. Online users always get the newest files anyway, because the service worker checks the network first.

---

## Turning it into a store app

The plan is to keep one codebase and grow it in phases.

1. **Now: the web app.** Use it yourself and with a few friends. Fix whatever confuses people before adding features.
2. **Accounts and sync.** Add Supabase (free tier): sign-in, then save the same state object per user so it follows you between phone and laptop. Later, split it into proper tables.
3. **Reminders.** Web push works for installed web apps on Android, and on iPhone (iOS 16.4 or later) once the app is on the home screen.
4. **Store apps with Capacitor.** Capacitor wraps these same files in a native shell and adds native features.
   - **Google Play:** a one-time $25 developer registration. New personal accounts must run a closed test with at least 12 testers for 14 days before the app can go public.
   - **App Store:** the Apple Developer Program is $99 a year, and building needs a Mac or a cloud build service.
   - Apple's guideline 4.2 rejects apps that are only a website in a wrapper, so add native value first: Apple Health and Health Connect weight sync, notifications, widgets.

---

## Where the numbers come from

- **Frame targets:** Casey Butt's formulas for maximum lean mass and body-part sizes from height, wrist and ankle. Upper estimates for drug-free lifters at about 8 to 10% body fat, built from men's data.
- **Body fat from the tape:** US Navy method (Hodgdon and Beckett).
- **Calories:** Mifflin-St Jeor equation (1990), adjusted for activity and training days, then corrected at each check-in from your real weight trend.
- **FFMI:** fat-free mass index, normalised to 1.8 m.
- **Training:** weekly sets by experience, fitted to your days and session length, with exactly 6 exercises a session plus a separate 10 minute cardio finisher, and at most 5 sets an exercise; double progression.
- **Weekly wellness check:** the five questions are McLean and colleagues' wellness questionnaire (2010). Your total is compared with your own normal (the average of up to 6 recent weeks once you have 3). Fresh weeks raise the load 5%, normal weeks 2.5%, tired weeks lower it 2.5% and lighter weeks 5% (Bell and colleagues' 2023 deloading consensus: less load, further from failure, familiar lifts kept). Poor sleep or stress holds it; leaning out caps rises at 2.5%. Sore muscles swap stretch-heavy exercises for gentler ones you have already logged.
- **Health questionnaire:** the PAR-Q+ is © 2025 PAR-Q+ Collaboration (www.eparmedx.com). Its licence says to use the entire questionnaire with no changes, so keep the wording in `js/parq.js` as it is and keep the credit on screen.
- **Starting strength:** 1RM = weight ÷ (1.0278 − 0.0278 × reps), only for 1 to 10 reps, rounded to the nearest 2.5 kg. `MODEL` in `js/strength.js` says how strong each exercise is compared with its lift; untested lifts are estimated from body weight, experience and sex, scaled by your tested lifts and kept 10% low.
- **Weekly load:** weight × reps × sets for legs (with abs), push and pull, added up at the end of each week from what you log. The next week stays within 5% of it, with the reps changing first and the weight when the reps can't.
- **Health conditions:** cautious general guidance. With diabetes, carbs are capped at about 45% of calories and meals with added sugar are left out. With kidney disease, protein is set to 0.8 g per kg, as the KDIGO 2024 guideline suggests for stage 3 to 5 chronic kidney disease without dialysis. With high blood pressure or a heart condition, sets stay at 8 or 10 reps and up, stopping short of failure, with no breath-holding.

Gainloop gives general fitness guidance, not medical advice. Anyone with a health condition should check their plan with their doctor or care team, whose advice comes first.

### Sources

- [Casey Butt lean mass calculator](https://weighttraining.nz/cb_calculator.php)
- [Menno Henselmans on FFMI and the formula's limits](https://mennohenselmans.com/ffmi-calculator/)
- [Mifflin-St Jeor equation (1990)](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- [Key points from the American Diabetes Association's exercise guidance](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5317029/)
- [American Heart Association: resistance training with and without heart disease (2023)](https://professional.heart.org/en/science-news/resistance-exercise-training-in-individuals-with-and-without-cardiovascular-disease-2023-update)
- [KDIGO 2024 guideline for chronic kidney disease](https://kdigo.org/guidelines/ckd-evaluation-and-management/)
- Exercise data by [RepDB](https://repdb.co): the exercise illustrations come from RepDB's free tier, which allows use inside apps as long as this credit stays visible (it's also on the You screen). The pictures can't be republished as a dataset.
- [McLean and others (2010): fatigue in rugby league players, with the wellness questionnaire](https://pubmed.ncbi.nlm.nih.gov/20861526/)
- [Saw, Main and Gastin (2016): self-reported measures in athlete monitoring](https://bjsm.bmj.com/content/50/5/281)
- [Bell and others (2023): an international Delphi consensus on deloading](https://doi.org/10.1186/s40798-023-00633-0)
- [Helms and others (2016): training by reps in reserve](https://openrepository.aut.ac.nz/items/92cefeac-7c32-44f1-bfbc-f48f4a5dd8cf/full)
- [Knowles and others (2018): poor sleep and muscle strength](https://pubmed.ncbi.nlm.nih.gov/29422383/)
- [Stults-Kolehmainen and others (2014): stress slows recovery after hard training](https://pubmed.ncbi.nlm.nih.gov/24343323/)
- [Cloudflare Pages: deploy from GitHub](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages: the _headers file](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages: how pages, redirects and 404s are served](https://developers.cloudflare.com/pages/platform/serving-pages/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages: Functions configuration with wrangler.toml](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Workers AI pricing and free allowance](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Workers AI: how your data is used](https://developers.cloudflare.com/workers-ai/platform/privacy/)
- [OpenAI gpt-oss-120b on Workers AI](https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/)
- [2024 Adult Compendium of Physical Activities](https://pacompendium.com/wp-content/uploads/2024/01/2024-adult-compendium_1_2024.pdf) (calories for cardio)
- [Netlify: how credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- [Netlify Drop quickstart](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/)
- [Netlify project visibility](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/)
- [Netlify: change a project name](https://docs.netlify.com/manage/projects/customize-project-name-and-cover-image/)
- [Netlify: deploy from a Git repository](https://docs.netlify.com/start/quickstarts/deploy-from-repository/)
- [Google Play testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Capacitor](https://capacitorjs.com/)
- [Barlow typeface](https://github.com/jpt/barlow)
