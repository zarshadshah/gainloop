// Exercise library.
// m: main muscle | k: 'c' compound or 'i' isolation | eq: where you can do it (gym, home = dumbbells + bench, bw = bodyweight)
// bar: needs a pull-up bar outside the gym | load: 'kg' weight, 'bw' bodyweight reps, 's' seconds
// rr: rep range (seconds for load 's') | step: usual weight jump in kg | heavy: long rest | next: harder bodyweight version
// auto: false means the planner only uses it when you say you already do it (it stays in the library and search)

export const MUSCLES = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'biceps', name: 'Biceps' },
  { id: 'triceps', name: 'Triceps' },
  { id: 'quads', name: 'Quads' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'glutes', name: 'Glutes' },
  { id: 'calves', name: 'Calves' },
  { id: 'abs', name: 'Abs' },
  { id: 'forearms', name: 'Forearms' },
];

// Cardio isn't a muscle: it has its own group, is logged in minutes and never counts toward weekly sets
export const CARDIO = { id: 'cardio', name: 'Cardio' };
export const muscleName = (id) => (id === CARDIO.id ? CARDIO.name : (MUSCLES.find((m) => m.id === id) || { name: id }).name);
export const isCardio = (ex) => ex?.m === CARDIO.id;

// How hard a cardio session is. The talk test is the easiest way to judge it without a heart rate monitor.
export const EFFORTS = [
  { id: 'easy', name: 'Easy', talk: 'You can chat in full sentences' },
  { id: 'moderate', name: 'Moderate', talk: 'You can talk in short phrases' },
  { id: 'hard', name: 'Hard', talk: 'Only a few words at a time' },
];
export const effortIndex = (id) => Math.max(0, EFFORTS.findIndex((e) => e.id === id));

export const EXERCISES = [
  // Chest
  { id: 'bench', name: 'Barbell bench press', m: 'chest', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, heavy: true, cue: 'Shoulder blades pinched, lower the bar to mid-chest, press up and slightly back.' },
  { id: 'db-bench', name: 'Dumbbell bench press', m: 'chest', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Lower until the dumbbells are level with your chest, then press them up together.' },
  { id: 'incline-db', name: 'Incline dumbbell press', m: 'chest', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Bench at about 30 degrees. Lower to your upper chest with elbows slightly tucked.' },
  { id: 'machine-press', name: 'Machine chest press', m: 'chest', k: 'c', eq: ['gym'], load: 'kg', rr: [8, 12], step: 2.5, cue: 'Set the seat so the handles line up with mid-chest. Control the way back.' },
  { id: 'cable-fly', name: 'Cable fly', m: 'chest', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Soft elbows, bring your hands together in a wide hug and squeeze for a second.' },
  { id: 'db-fly', name: 'Dumbbell fly', m: 'chest', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Lower in a wide arc until you feel a stretch across your chest, no further.' },
  { id: 'push-up', name: 'Push-up', m: 'chest', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [8, 20], next: 'feet-up-push-up', cue: 'Body in one straight line, lower your chest to just above the floor.' },
  { id: 'feet-up-push-up', name: 'Feet-elevated push-up', m: 'chest', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [6, 15], next: 'deficit-push-up', cue: 'Feet on a chair or sofa. Keep your hips from sagging.' },
  { id: 'deficit-push-up', name: 'Deficit push-up', m: 'chest', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [6, 15], cue: 'Hands on two sturdy blocks or plates so your chest can sink lower than your hands.' },
  { id: 'dips', name: 'Dips', m: 'chest', k: 'c', eq: ['gym'], load: 'bw', rr: [6, 12], cue: 'Lean forward slightly and lower until your upper arms are about level with the floor.' },

  // Back
  { id: 'lat-pulldown', name: 'Lat pulldown', m: 'back', k: 'c', eq: ['gym'], load: 'kg', rr: [8, 12], step: 2.5, cue: 'Pull the bar to your upper chest, leading with your elbows.' },
  { id: 'cable-row', name: 'Seated cable row', m: 'back', k: 'c', eq: ['gym'], load: 'kg', rr: [8, 12], step: 2.5, cue: 'Chest up, pull the handle to your belly button, pause, return slowly.' },
  { id: 'cs-row', name: 'Chest-supported dumbbell row', m: 'back', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Chest on an incline bench, row the dumbbells toward your hips.' },
  { id: 'one-arm-row', name: 'One-arm dumbbell row', m: 'back', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Hand and knee on the bench, pull the dumbbell toward your hip.' },
  { id: 'bb-row', name: 'Barbell row', m: 'back', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, heavy: true, cue: 'Hinge to about 45 degrees with a flat back and row to your lower ribs.' },
  { id: 'pull-up', name: 'Pull-up', m: 'back', k: 'c', eq: ['gym', 'home', 'bw'], bar: true, load: 'bw', rr: [4, 12], cue: 'Start from a dead hang and pull until your chin clears the bar. Use the assisted machine if you need it.' },
  { id: 'backpack-row', name: 'Backpack row', m: 'back', k: 'c', eq: ['bw'], load: 'kg', rr: [10, 15], step: 1, cue: 'Load a backpack, hinge forward with a flat back and row it to your stomach.' },
  { id: 'superman', name: 'Superman', m: 'back', k: 'i', eq: ['home', 'bw'], load: 'bw', rr: [10, 15], cue: 'Lift your arms, chest and legs together and hold for a second at the top.' },
  { id: 'db-pullover', name: 'Dumbbell pullover', m: 'back', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Lie on a bench and lower the dumbbell behind your head with slightly bent arms.' },
  { id: 'straight-arm', name: 'Straight-arm pulldown', m: 'back', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Arms nearly straight, sweep the bar down to your thighs.' },

  // Shoulders
  { id: 'ohp', name: 'Overhead press', m: 'shoulders', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, heavy: true, cue: 'Squeeze your glutes, press the bar overhead and finish with your head through.' },
  { id: 'db-press', name: 'Seated dumbbell press', m: 'shoulders', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Back supported, press until your arms are straight, lower to ear height.' },
  { id: 'lateral-raise', name: 'Dumbbell lateral raise', m: 'shoulders', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [12, 20], step: 1, cue: 'Lead with your elbows, stop at shoulder height, lower slowly.' },
  { id: 'cable-lateral', name: 'Cable lateral raise', m: 'shoulders', k: 'i', eq: ['gym'], load: 'kg', rr: [12, 20], step: 2.5, cue: 'Cable behind you, raise your arm out to the side to shoulder height.' },
  { id: 'rear-delt-fly', name: 'Rear delt fly', m: 'shoulders', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [12, 20], step: 1, cue: 'Hinge forward and raise the dumbbells out wide with a slight bend in the elbows.' },
  { id: 'pike-push-up', name: 'Pike push-up', m: 'shoulders', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [6, 15], next: 'feet-up-pike', cue: 'Hips high, lower the top of your head toward the floor between your hands.' },
  { id: 'feet-up-pike', name: 'Feet-elevated pike push-up', m: 'shoulders', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [5, 12], cue: 'Feet on a chair, bend at the hips and lower your head toward the floor.' },
  { id: 'bottle-lateral', name: 'Lateral raise with water bottles', m: 'shoulders', k: 'i', eq: ['bw'], load: 'kg', rr: [12, 20], step: 0.5, cue: 'Use two full bottles or bags and stop at shoulder height.' },

  // Biceps
  { id: 'ez-curl', name: 'EZ-bar curl', m: 'biceps', k: 'i', eq: ['gym'], load: 'kg', rr: [8, 12], step: 2.5, cue: 'Elbows pinned to your sides, curl up, take two seconds to lower.' },
  { id: 'db-curl', name: 'Dumbbell curl', m: 'biceps', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Curl without swinging and turn your little finger up at the top.' },
  { id: 'incline-curl', name: 'Incline dumbbell curl', m: 'biceps', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Lie back on an incline, let your arms hang straight, curl without moving your elbows.' },
  { id: 'cable-curl', name: 'Cable curl', m: 'biceps', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Stand tall, curl the bar to your chest, keep your elbows still.' },
  { id: 'hammer-curl', name: 'Hammer curl', m: 'biceps', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Palms facing each other, curl without rocking your body.' },
  { id: 'chin-up', name: 'Chin-up', m: 'biceps', k: 'c', eq: ['gym', 'home', 'bw'], bar: true, load: 'bw', rr: [4, 12], cue: 'Palms facing you, pull your chest toward the bar.' },
  { id: 'backpack-curl', name: 'Backpack curl', m: 'biceps', k: 'i', eq: ['bw'], load: 'kg', rr: [10, 15], step: 1, cue: 'Hold a loaded backpack by the top handle and curl it up slowly.' },

  // Triceps
  { id: 'pushdown', name: 'Cable pushdown', m: 'triceps', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Elbows tucked, push down until your arms are straight.' },
  { id: 'oh-cable-ext', name: 'Overhead cable extension', m: 'triceps', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Face away from the cable and straighten your arms overhead from behind your head.' },
  { id: 'skull-crusher', name: 'EZ-bar skull crusher', m: 'triceps', k: 'i', eq: ['gym'], load: 'kg', rr: [8, 12], step: 2.5, cue: 'Lower the bar to just behind your forehead with elbows pointing up.' },
  { id: 'db-oh-ext', name: 'Overhead dumbbell extension', m: 'triceps', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Hold one dumbbell with both hands, lower it behind your head, press up.' },
  { id: 'cg-bench', name: 'Close-grip bench press', m: 'triceps', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, cue: 'Hands shoulder-width apart, elbows close to your sides.' },
  { id: 'diamond-push-up', name: 'Diamond push-up', m: 'triceps', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [6, 15], cue: 'Hands together under your chest, elbows close as you lower.' },
  { id: 'bench-dip', name: 'Bench dip', m: 'triceps', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [8, 15], cue: 'Hands on a sturdy chair. Only lower as far as your shoulders feel comfortable.' },

  // Quads
  { id: 'squat', name: 'Back squat', m: 'quads', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, heavy: true, cue: 'Brace, sit down between your heels, knees track over your toes.' },
  { id: 'leg-press', name: 'Leg press', m: 'quads', k: 'c', eq: ['gym'], load: 'kg', rr: [8, 12], step: 5, cue: 'Lower until your knees come toward your chest without your lower back lifting.' },
  { id: 'hack-squat', name: 'Hack squat', m: 'quads', k: 'c', eq: ['gym'], load: 'kg', rr: [8, 12], step: 5, cue: 'Feet in the middle of the plate, go deep, drive up through the whole foot.' },
  { id: 'goblet-squat', name: 'Goblet squat', m: 'quads', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 15], step: 2, cue: 'Hold the dumbbell at your chest, sit down and keep your chest up.' },
  { id: 'split-squat', name: 'Bulgarian split squat', m: 'quads', k: 'c', eq: ['gym', 'home', 'bw'], load: 'kg', rr: [8, 12], step: 2, cue: 'Back foot on a bench, lower straight down. Bodyweight only is fine to start.' },
  { id: 'leg-ext', name: 'Leg extension', m: 'quads', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Pause for a second at the top and lower slowly.' },
  { id: 'step-up', name: 'Dumbbell step-up', m: 'quads', k: 'c', eq: ['home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Whole foot on a sturdy step, drive up through that leg without pushing off the back foot.' },
  { id: 'reverse-lunge', name: 'Reverse lunge', m: 'quads', k: 'c', eq: ['home', 'bw'], load: 'kg', rr: [8, 15], step: 2, cue: 'Step back, lower the back knee toward the floor, push through the front heel.' },
  { id: 'box-pistol', name: 'Box pistol squat', m: 'quads', k: 'c', eq: ['bw'], load: 'bw', rr: [5, 12], cue: 'On one leg, sit back to a chair and stand up without using the other foot.' },

  // Hamstrings
  { id: 'rdl', name: 'Romanian deadlift', m: 'hamstrings', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, heavy: true, cue: 'Soft knees, push your hips back until you feel your hamstrings, keep your back flat.' },
  { id: 'db-rdl', name: 'Dumbbell Romanian deadlift', m: 'hamstrings', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [8, 12], step: 2, cue: 'Slide the dumbbells down your thighs by pushing your hips back.' },
  { id: 'leg-curl', name: 'Leg curl', m: 'hamstrings', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Seated or lying. Curl all the way, lower slowly, keep your hips down.' },
  { id: 'sl-rdl', name: 'Single-leg Romanian deadlift', m: 'hamstrings', k: 'c', eq: ['home', 'bw'], load: 'kg', rr: [8, 12], step: 2, cue: 'Hinge on one leg holding a dumbbell or backpack, hips level.' },
  { id: 'slider-curl', name: 'Sliding leg curl', m: 'hamstrings', k: 'i', eq: ['home', 'bw'], load: 'bw', rr: [8, 15], cue: 'Heels on a towel on a smooth floor, hips up, pull your heels in.' },
  { id: 'nordic', name: 'Assisted Nordic curl', m: 'hamstrings', k: 'i', eq: ['home', 'bw'], load: 'bw', rr: [3, 8], cue: 'Feet hooked under a sofa, lower forward slowly, push back up with your hands.' },

  // Glutes
  { id: 'hip-thrust', name: 'Barbell hip thrust', m: 'glutes', k: 'c', eq: ['gym'], load: 'kg', rr: [8, 12], step: 5, cue: 'Upper back on a bench, drive your hips up and pause with a squeeze.' },
  { id: 'db-hip-thrust', name: 'Dumbbell hip thrust', m: 'glutes', k: 'c', eq: ['home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Dumbbell on your hips, back on a sofa or bench, drive up and pause.' },
  { id: 'glute-bridge', name: 'Single-leg glute bridge', m: 'glutes', k: 'c', eq: ['home', 'bw'], load: 'bw', rr: [10, 15], cue: 'One foot planted, drive your hips up and hold for a second.' },
  { id: 'cable-kickback', name: 'Cable kickback', m: 'glutes', k: 'i', eq: ['gym'], load: 'kg', rr: [12, 15], step: 2.5, cue: 'Kick back and slightly out, squeeze at the top without arching your back.' },

  // Calves
  { id: 'standing-calf', name: 'Standing calf raise', m: 'calves', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 5, cue: 'Full stretch at the bottom, pause, then rise as high as you can.' },
  { id: 'seated-calf', name: 'Seated calf raise', m: 'calves', k: 'i', eq: ['gym'], load: 'kg', rr: [12, 20], step: 2.5, cue: 'Slow stretch at the bottom, pause at the top.' },
  { id: 'step-calf', name: 'Single-leg calf raise on a step', m: 'calves', k: 'i', eq: ['home', 'bw'], load: 'kg', rr: [10, 20], step: 2, cue: 'Heel off the step, all the way down and up. Hold a dumbbell once it gets easy.' },

  // Abs
  { id: 'cable-crunch', name: 'Cable crunch', m: 'abs', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, cue: 'Kneel and curl your ribs toward your hips rather than bowing at the hips.' },
  { id: 'hanging-knee', name: 'Hanging knee raise', m: 'abs', k: 'i', eq: ['gym', 'home', 'bw'], bar: true, load: 'bw', rr: [8, 15], cue: 'Hang from the bar and curl your knees toward your chest without swinging.' },
  { id: 'dead-bug', name: 'Dead bug', m: 'abs', k: 'i', eq: ['home', 'bw'], load: 'bw', rr: [8, 12], cue: 'Lower back pressed down, slowly extend the opposite arm and leg.' },
  { id: 'reverse-crunch', name: 'Reverse crunch', m: 'abs', k: 'i', eq: ['gym', 'home', 'bw'], load: 'bw', rr: [10, 15], cue: 'Roll your hips off the floor toward your chest and lower slowly.' },
  { id: 'plank', name: 'Plank', m: 'abs', k: 'i', eq: ['gym', 'home', 'bw'], load: 's', rr: [30, 60], cue: 'Elbows under shoulders, squeeze your glutes, straight line from head to heels.' },

  // Forearms
  { id: 'wrist-curl', name: 'Dumbbell wrist curl', m: 'forearms', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [12, 20], step: 1, cue: 'Forearms on your thighs, let the dumbbell roll to your fingertips, curl it back up.' },
  { id: 'reverse-curl', name: 'Reverse curl', m: 'forearms', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, cue: 'Palms facing down, curl up with your wrists straight.' },
  { id: 'farmer-hold', name: "Farmer's walk", m: 'forearms', k: 'i', eq: ['gym', 'home'], load: 's', rr: [30, 60], cue: 'Heavy dumbbells at your sides, stand tall and walk with short steps. No space? Stand still and hold.' },
  { id: 'dead-hang', name: 'Dead hang', m: 'forearms', k: 'i', eq: ['gym', 'home', 'bw'], bar: true, load: 's', rr: [20, 60], cue: 'Hang from the bar with straight arms and a strong grip.' },
  { id: 'wrist-roller', name: 'Wrist roller', m: 'forearms', k: 'i', eq: ['gym', 'home', 'bw'], load: 'bw', rr: [3, 6], cue: 'Wind the weight all the way up, then lower it slowly. Holding your arms out straight makes it harder.' },

  // Common gym exercises the planner doesn't pick on its own, kept so your plan can include the ones you already do
  { id: 'incline-bench', name: 'Incline barbell bench press', m: 'chest', k: 'c', eq: ['gym'], load: 'kg', rr: [6, 10], step: 2.5, heavy: true, auto: false, cue: 'Bench at about 30 degrees. Lower the bar to your upper chest.' },
  { id: 'pec-deck', name: 'Pec deck', m: 'chest', k: 'i', eq: ['gym'], load: 'kg', rr: [10, 15], step: 2.5, auto: false, cue: 'Squeeze the pads together and open slowly until you feel a stretch.' },
  { id: 'shrug', name: 'Dumbbell shrug', m: 'back', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [10, 15], step: 2, auto: false, cue: 'Lift your shoulders straight up toward your ears and pause.' },
  { id: 'face-pull', name: 'Face pull', m: 'shoulders', k: 'i', eq: ['gym'], load: 'kg', rr: [12, 20], step: 2.5, auto: false, cue: 'Pull the rope toward your face with your elbows high and wide.' },
  { id: 'preacher-curl', name: 'Preacher curl', m: 'biceps', k: 'i', eq: ['gym'], load: 'kg', rr: [8, 12], step: 2.5, auto: false, cue: 'Upper arms flat on the pad. Curl up, then lower until your arms are almost straight.' },
  { id: 'db-kickback', name: 'Dumbbell kickback', m: 'triceps', k: 'i', eq: ['gym', 'home'], load: 'kg', rr: [12, 15], step: 1, auto: false, cue: 'Keep your upper arm still and parallel to the floor as you straighten your arm.' },
  { id: 'deadlift', name: 'Deadlift', m: 'hamstrings', k: 'c', eq: ['gym'], load: 'kg', rr: [5, 8], step: 5, heavy: true, auto: false, cue: 'Bar over the middle of your feet, back flat, push the floor away.' },
  { id: 'kb-swing', name: 'Kettlebell swing', m: 'glutes', k: 'c', eq: ['gym', 'home'], load: 'kg', rr: [12, 20], step: 4, auto: false, cue: 'Snap your hips forward. Your arms only guide the bell.' },
  { id: 'hip-abduction', name: 'Hip abduction machine', m: 'glutes', k: 'i', eq: ['gym'], load: 'kg', rr: [12, 20], step: 2.5, auto: false, cue: 'Push your knees apart and control the way back.' },
  { id: 'crunch', name: 'Crunch', m: 'abs', k: 'i', eq: ['gym', 'home', 'bw'], load: 'bw', rr: [12, 20], auto: false, cue: 'Curl your ribs toward your hips rather than pulling on your neck.' },
  { id: 'leg-raise', name: 'Lying leg raise', m: 'abs', k: 'i', eq: ['gym', 'home', 'bw'], load: 'bw', rr: [8, 15], auto: false, cue: 'Keep your lower back pressed into the floor the whole time.' },

  // Cardio: logged in minutes (rr is the usual range of minutes). met: energy cost at easy, moderate and hard
  // effort, from the 2024 Adult Compendium of Physical Activities. impact: how hard it is on knees and ankles.
  // The planner adds cardio only when you say you do it, or for a back-on-track plan.
  { id: 'brisk-walk', name: 'Brisk walk', m: 'cardio', k: 'c', eq: ['gym', 'home', 'bw'], load: 'min', rr: [20, 45], met: [3.8, 4.8, 7.0], impact: 'low', auto: false, cue: 'Walk fast enough that your breathing picks up. Hills make it harder without running.' },
  { id: 'incline-walk', name: 'Incline treadmill walk', m: 'cardio', k: 'c', eq: ['gym'], load: 'min', rr: [15, 40], met: [5.0, 7.0, 8.8], impact: 'low', auto: false, cue: 'Hands off the rails if you can. Leaning on them takes most of the work away.' },
  { id: 'treadmill-run', name: 'Treadmill run', m: 'cardio', k: 'c', eq: ['gym'], load: 'min', rr: [15, 40], met: [7.5, 9.3, 11.0], impact: 'high', auto: false, cue: 'Short, quick steps landing under your hips. Start with a few minutes of walking.' },
  { id: 'run', name: 'Running', m: 'cardio', k: 'c', eq: ['gym', 'home', 'bw'], load: 'min', rr: [15, 45], met: [7.5, 9.3, 11.0], impact: 'high', auto: false, cue: 'Run at a pace you could talk at. New to it? Mix 1 minute running with 1 to 2 minutes walking.' },
  { id: 'bike', name: 'Exercise bike', m: 'cardio', k: 'c', eq: ['gym'], load: 'min', rr: [15, 45], met: [4.0, 6.0, 10.8], impact: 'low', auto: false, cue: 'Knee slightly bent at the bottom of each pedal stroke. Use the resistance to set the effort.' },
  { id: 'rower', name: 'Rowing machine', m: 'cardio', k: 'c', eq: ['gym'], load: 'min', rr: [10, 30], met: [5.0, 7.5, 11.0], impact: 'low', auto: false, cue: 'Legs, then body, then arms. Back the other way: arms, body, then knees.' },
  { id: 'cross-trainer', name: 'Cross trainer', m: 'cardio', k: 'c', eq: ['gym'], load: 'min', rr: [15, 40], met: [4.0, 5.0, 7.0], impact: 'low', auto: false, cue: 'Stand tall and push and pull the handles in time with your legs.' },
  { id: 'stair-climber', name: 'Stair climber', m: 'cardio', k: 'c', eq: ['gym'], load: 'min', rr: [10, 30], met: [7.0, 9.3, 11.0], impact: 'medium', auto: false, cue: 'Full steps through your whole foot. Hold the rails lightly, only for balance.' },
  { id: 'skipping', name: 'Skipping rope', m: 'cardio', k: 'c', eq: ['gym', 'home', 'bw'], load: 'min', rr: [5, 20], met: [8.3, 11.8, 12.3], impact: 'high', auto: false, cue: 'Turn the rope with your wrists and jump just high enough to clear it.' },
  { id: 'jumping-jacks', name: 'Jumping jacks', m: 'cardio', k: 'c', eq: ['gym', 'home', 'bw'], load: 'min', rr: [5, 15], met: [5.0, 7.5, 8.0], impact: 'high', auto: false, cue: 'Land softly on the balls of your feet and keep a steady rhythm.' },
  { id: 'burpees', name: 'Burpees', m: 'cardio', k: 'c', eq: ['gym', 'home', 'bw'], load: 'min', rr: [5, 15], met: [5.0, 7.5, 8.0], impact: 'high', auto: false, cue: 'Step back instead of jumping to make it easier. Work in rounds with short rests.' },
  { id: 'mountain-climbers', name: 'Mountain climbers', m: 'cardio', k: 'c', eq: ['gym', 'home', 'bw'], load: 'min', rr: [5, 15], met: [5.0, 7.5, 8.0], impact: 'medium', auto: false, cue: 'Hips level with your shoulders, core tight, knees driving toward your chest.' },
];

export const cardioExercises = () => allExercises().filter(isCardio);

// Energy burned on top of resting, in kcal: (MET - 1) x kg x hours. Your calorie target already covers resting.
export function cardioKcal(ex, minutes, kg, effort = 'moderate') {
  if (!isCardio(ex) || !minutes || !kg) return 0;
  const met = (ex.met || [4, 6, 8])[effortIndex(effort)];
  return Math.max(0, Math.round(((met - 1) * kg * minutes) / 60));
}

// Exercises you add yourself live in your saved data; the app registers them here so every lookup finds them
let CUSTOM = [];
export const setCustomExercises = (list) => { CUSTOM = Array.isArray(list) ? list : []; };
export const customExercises = () => CUSTOM;
export const allExercises = () => [...EXERCISES, ...CUSTOM];
export const exerciseById = (id) => EXERCISES.find((e) => e.id === id) || CUSTOM.find((e) => e.id === id);
