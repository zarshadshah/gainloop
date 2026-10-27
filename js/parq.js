// The PAR-Q+ (2025): the Physical Activity Readiness Questionnaire for Everyone. The questions are used as
// published, with the 7 general health questions first and the follow-up questions about a medical condition
// only when one of those is answered YES. The wording, order and outcomes follow the form; no changes are
// permitted by its authors. Copyright © 2025 PAR-Q+ Collaboration (www.eparmedx.com). No DOM here.

export const PARQ_VERSION = '2025-11-01';
export const PARQ_VALID_DAYS = 365; // clearance is valid for a maximum of 12 months

const DIFFICULTY = 'Do you have difficulty controlling your condition with medications or other physician-prescribed therapies? (Answer NO if you are not currently taking medications or other treatments)';

export const GENERAL = [
  { id: 'g1', text: 'Has your doctor ever said that you have a heart condition OR high blood pressure?' },
  { id: 'g2', text: 'Do you feel pain in your chest at rest, during your daily activities of living, OR when you do physical activity?' },
  { id: 'g3', text: 'Do you lose balance because of dizziness OR have you lost consciousness in the last 12 months?', note: 'Please answer NO if your dizziness was associated with over-breathing (including during vigorous exercise).' },
  { id: 'g4', text: 'Have you ever been diagnosed with another chronic medical condition (other than heart disease or high blood pressure)?', list: true },
  { id: 'g5', text: 'Are you currently taking prescribed medications for a chronic medical condition?', list: true },
  { id: 'g6', text: 'Do you currently have (or have had within the past 12 months) a bone, joint, or soft tissue (muscle, ligament, or tendon) problem that could be made worse by becoming more physically active?', note: 'Please answer NO if you had a problem in the past, but it does not limit your current ability to be physically active.', list: true },
  { id: 'g7', text: 'Has your doctor ever said that you should only do medically supervised physical activity?' },
];

// Follow-up questions about your medical condition(s). Each section starts with one question; the
// questions under it are asked only if that is YES.
export const SECTIONS = [
  { id: 's1', title: 'Arthritis, Osteoporosis, or Back Problems', text: 'Do you have Arthritis, Osteoporosis, or Back Problems?', subs: [
    { id: 's1a', text: DIFFICULTY },
    { id: 's1b', text: 'Do you have joint problems causing pain, a recent fracture or fracture caused by osteoporosis or cancer, displaced vertebra (e.g., spondylolisthesis), and/or spondylolysis/pars defect (a crack in the bony ring on the back of the spinal column)?' },
    { id: 's1c', text: 'Have you had steroid injections or taken steroid tablets regularly for more than 3 months?' },
  ] },
  { id: 's2', title: 'Cancer', text: 'Do you currently have Cancer of any kind?', subs: [
    { id: 's2a', text: 'Does your cancer diagnosis include any of the following types: lung/bronchogenic, multiple myeloma (cancer of plasma cells), head, and/or neck?' },
    { id: 's2b', text: 'Are you currently receiving cancer therapy (such as chemotherapy or radiotherapy)?' },
  ] },
  { id: 's3', title: 'Heart or cardiovascular condition', text: 'Do you have a Heart or Cardiovascular Condition?', note: 'This includes Coronary Artery Disease, Heart Failure, Diagnosed Abnormality of Heart Rhythm.', subs: [
    { id: 's3a', text: DIFFICULTY },
    { id: 's3b', text: 'Do you have an irregular heart beat that requires medical management? (e.g., atrial fibrillation, premature ventricular contraction)' },
    { id: 's3c', text: 'Do you have chronic heart failure?' },
    { id: 's3d', text: 'Do you have diagnosed coronary artery (cardiovascular) disease and have not participated in regular physical activity in the last 2 months?' },
  ] },
  { id: 's4', title: 'High blood pressure', text: 'Do you currently have High Blood Pressure?', subs: [
    { id: 's4a', text: DIFFICULTY },
    { id: 's4b', text: 'Do you have a resting blood pressure equal to or greater than 160/90 mmHg with or without medication? (Answer YES if you do not know your resting blood pressure)' },
  ] },
  { id: 's5', title: 'Metabolic conditions', text: 'Do you have any Metabolic Conditions?', note: 'This includes Type 1 Diabetes, Type 2 Diabetes, Pre-Diabetes.', subs: [
    { id: 's5a', text: 'Do you often have difficulty controlling your blood sugar levels with foods, medications, or other physician-prescribed therapies?' },
    { id: 's5b', text: 'Do you often suffer from signs and symptoms of low blood sugar (hypoglycemia) following exercise and/or during activities of daily living? Signs of hypoglycemia may include shakiness, nervousness, unusual irritability, abnormal sweating, dizziness or light-headedness, mental confusion, difficulty speaking, weakness, or sleepiness.' },
    { id: 's5c', text: 'Do you have any signs or symptoms of diabetes complications such as heart or vascular disease and/or complications affecting your eyes, kidneys, OR the sensation in your toes and feet?' },
    { id: 's5d', text: 'Do you have other metabolic conditions (such as current pregnancy-related diabetes, chronic kidney disease, or liver problems)?' },
    { id: 's5e', text: 'Are you planning to engage in what for you is unusually high (or vigorous) intensity exercise in the near future?' },
  ] },
  { id: 's6', title: 'Mental health problems or learning difficulties', text: 'Do you have any Mental Health Problems or Learning Difficulties?', note: 'This includes Alzheimer’s, Dementia, Depression, Anxiety Disorder, Eating Disorder, Psychotic Disorder, Intellectual Disability, Down Syndrome.', subs: [
    { id: 's6a', text: DIFFICULTY },
    { id: 's6b', text: 'Do you have Down Syndrome AND back problems affecting nerves or muscles?' },
  ] },
  { id: 's7', title: 'Respiratory disease', text: 'Do you have a Respiratory Disease?', note: 'This includes Chronic Obstructive Pulmonary Disease, Asthma, Pulmonary High Blood Pressure.', subs: [
    { id: 's7a', text: DIFFICULTY },
    { id: 's7b', text: 'Has your doctor ever said your blood oxygen level is low at rest or during exercise and/or that you require supplemental oxygen therapy?' },
    { id: 's7c', text: 'If asthmatic, do you currently have symptoms of chest tightness, wheezing, laboured breathing, consistent cough (more than 2 days/week), or have you used your rescue medication more than twice in the last week?' },
    { id: 's7d', text: 'Has your doctor ever said you have high blood pressure in the blood vessels of your lungs?' },
  ] },
  { id: 's8', title: 'Spinal cord injury', text: 'Do you have a Spinal Cord Injury?', note: 'This includes Tetraplegia and Paraplegia.', subs: [
    { id: 's8a', text: DIFFICULTY },
    { id: 's8b', text: 'Do you commonly exhibit low resting blood pressure significant enough to cause dizziness, light-headedness, and/or fainting?' },
    { id: 's8c', text: 'Has your physician indicated that you exhibit sudden bouts of high blood pressure (known as Autonomic Dysreflexia)?' },
  ] },
  { id: 's9', title: 'Stroke', text: 'Have you had a Stroke?', note: 'This includes Transient Ischemic Attack (TIA) or Cerebrovascular Event.', subs: [
    { id: 's9a', text: DIFFICULTY },
    { id: 's9b', text: 'Do you have any impairment in walking or mobility?' },
    { id: 's9c', text: 'Have you experienced a stroke or impairment in nerves or muscles in the past 6 months?' },
  ] },
  { id: 's10', title: 'Any other medical condition', text: 'Do you have any other medical condition not listed above or do you have two or more medical conditions?', subs: [
    { id: 's10a', text: 'Have you experienced a blackout, fainted, or lost consciousness as a result of a head injury within the last 12 months OR have you had a diagnosed concussion within the last 12 months?' },
    { id: 's10b', text: 'Do you have a medical condition that is not listed (such as epilepsy, neurological conditions, kidney problems)?' },
    { id: 's10c', text: 'Do you currently live with two or more medical conditions?' },
  ] },
];

const yes = (answers, id) => answers?.[id] === 'yes';

// The questions in the order they are asked, up to and including the first one not answered yet.
// Each has: id, text, note, kind ('general' | 'gate' | 'sub'), section title for follow-ups.
// done is true when every question that applies has an answer.
export function flow(answers = {}) {
  const out = [];
  const add = (q) => { out.push(q); return answers[q.id] === undefined; };
  for (const q of GENERAL) if (add({ ...q, kind: 'general' })) return { list: out, done: false };
  if (!GENERAL.some((q) => yes(answers, q.id))) return { list: out, done: true };
  for (const sec of SECTIONS) {
    if (add({ id: sec.id, text: sec.text, note: sec.note, kind: 'gate', section: sec.title, sectionId: sec.id })) return { list: out, done: false };
    if (!yes(answers, sec.id)) continue;
    for (const sub of sec.subs) if (add({ ...sub, kind: 'sub', section: sec.title, sectionId: sec.id })) return { list: out, done: false };
  }
  return { list: out, done: true };
}

// The answers that count, in order (answers to questions that were skipped by a later change are ignored)
export function reached(answers = {}) {
  const { list } = flow(answers);
  return Object.fromEntries(list.filter((q) => answers[q.id] !== undefined).map((q) => [q.id, answers[q.id]]));
}

// 'clear': NO to all 7 general questions. 'ready': YES to a general question but NO to every follow-up
// question. 'seek': YES to at least one follow-up question, so more advice is needed first.
export function outcome(answers = {}) {
  const { list, done } = flow(answers);
  if (!done) return null;
  if (!GENERAL.some((q) => yes(answers, q.id))) return 'clear';
  return list.some((q) => q.kind === 'sub' && yes(answers, q.id)) ? 'seek' : 'ready';
}

// How far through you are, for the progress bar: general questions are 7, then the follow-ups as they come
export function position(answers = {}, index = 0) {
  const { list, done } = flow(answers);
  return { index, total: Math.max(list.length, GENERAL.length), done };
}

// Health conditions the answers show, to pass to the training and food rules
export function conditionsFrom(answers = {}) {
  const a = reached(answers);
  const out = [];
  if (yes(a, 's3')) out.push('heart');
  if (yes(a, 's4')) out.push('bp');
  if (yes(a, 's7')) out.push('asthma');
  return out;
}

// Labels for the optional lists at the end of the form
export const LIST_LABEL = {
  g4: 'Please list the condition(s) here',
  g5: 'Please list the condition(s) and medications here',
  g6: 'Please list the condition(s) here',
  s10: 'Please list your medical condition(s) and any related medications here',
};

// Which questions need a list box, from the answers that count
export const listIds = (answers = {}) => { const a = reached(answers); return Object.keys(LIST_LABEL).filter((id) => yes(a, id)); };

// Which follow-up sections were answered YES, for the summary
export const yesSections = (answers = {}) => { const a = reached(answers); return SECTIONS.filter((s) => yes(a, s.id)).map((s) => s.title); };

// Text from the form for the outcome screens
export const RESULT = {
  clear: {
    title: 'You are cleared for physical activity',
    lead: 'You answered NO to all of the questions, so you are cleared for physical activity.',
    points: [
      'Start becoming much more physically active – start slowly and build up gradually.',
      'Follow Global Physical Activity Guidelines for your age (https://www.who.int/publications/i/item/9789240015128).',
      'You may take part in a health and fitness appraisal.',
      'If you are over the age of 45 yr and NOT accustomed to regular vigorous to maximal effort exercise, consult a qualified exercise professional before engaging in this intensity of exercise.',
      'If you have any further questions, contact a qualified exercise professional.',
    ],
  },
  ready: {
    title: 'You are ready to become more physically active',
    lead: 'You answered NO to all of the follow-up questions about your medical condition, so you are ready to become more physically active.',
    points: [
      'It is advised that you consult a qualified exercise professional to help you develop a safe and effective physical activity plan to meet your health needs.',
      'You are encouraged to start slowly and build up gradually - 20 to 60 minutes of low to moderate intensity exercise, 3-5 days per week including aerobic and muscle strengthening exercises.',
      'As you progress, you should aim to accumulate 150 minutes or more of moderate intensity physical activity per week.',
      'If you are over the age of 45 yr and NOT accustomed to regular vigorous to maximal effort exercise, consult a qualified exercise professional before engaging in this intensity of exercise.',
    ],
  },
  seek: {
    title: 'Get further advice before you start',
    lead: 'You answered YES to one or more of the follow-up questions about your medical condition.',
    points: [
      'You should seek further information before becoming more physically active or engaging in a fitness appraisal.',
      'You should complete the specially designed online screening and exercise recommendations program - the ePARmed-X+ at www.eparmedx.com, and/or visit a qualified exercise professional to work through the ePARmed-X+ and for further information.',
    ],
  },
};

const DELAY_1 = [
  'You are currently experiencing a temporary illness, such as a cold or fever. It is best to wait until you feel better.',
  'You are pregnant. In this case, talk with your health care practitioner, physician, qualified exercise professional, and/or complete the ePARmed-X+ at www.eparmedx.com before becoming more physically active.',
  'Your health changes. Answer the questions on Pages 2 and 3 of this document and/or talk to your health care practitioner, physician, or qualified exercise professional before proceeding with any physical activity program.',
];
const DELAY_4 = [
  DELAY_1[0],
  'You are pregnant. In this case, talk to your health care practitioner, physician, qualified exercise professional, and/or complete the ePARmed-X+ at www.eparmedx.com before becoming more physically active.',
  'Your health changes. Talk to your health care practitioner, physician, or qualified exercise professional before continuing with any physical activity program.',
];
// The form words these a little differently on page 1 (everyone) and page 4 (after the follow-up questions)
export const delay = (level) => ({ title: 'Delay becoming more active if:', points: level === 'clear' ? DELAY_1 : DELAY_4 });

const DECL = 'I, the undersigned, have read, understood to my full satisfaction and completed this questionnaire. I acknowledge that this physical activity clearance is valid for a maximum of 12 months from the date it is completed and becomes invalid if my condition changes. I also acknowledge that the community/fitness center may retain a copy of this form';
export const declaration = (level) => `${DECL}${level === 'clear' ? ' for its records' : ' for records'}. In these instances, it will maintain the confidentiality of the same, complying with applicable law.`;
export const LIABILITY = 'The authors, the PAR-Q+ Collaboration, partner organizations, and their agents assume no liability for persons who undertake physical activity and/or make use of the PAR-Q+ or ePARmed-X+. If in doubt after completing the questionnaire, consult your doctor prior to physical activity.';
export const INTRO = 'The health benefits of regular physical activity are clear; more people should engage in physical activity every day of the week. Participating in physical activity is very safe for MOST people. This questionnaire will tell you whether it is necessary for you to seek further advice from your doctor OR a qualified exercise professional before becoming more physically active.';

export const GUARDIAN = 'If you are less than the legal age required for consent or require the assent of a care provider, your parent, guardian or care provider must also sign this form.';
export const CREDIT = 'PAR-Q+, The Physical Activity Readiness Questionnaire for Everyone. Copyright © 2025 PAR-Q+ Collaboration, used in full and unchanged. For more information, please contact www.eparmedx.com.';

// Is the clearance still valid on day d? (12 months from the day it was completed)
export function validOn(parq, d, daysBetween) {
  return !!parq?.d && daysBetween(parq.d, d) <= PARQ_VALID_DAYS;
}
