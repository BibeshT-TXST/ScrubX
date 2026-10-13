// Common US first names. A dictionary first name followed by a capitalized word
// is labeled PERSON (relatives, contacts and clinicians named in free text).
export const FIRST_NAMES = [
  "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
  "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua",
  "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan",
  "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon",
  "Benjamin", "Samuel", "Frank", "Gregory", "Raymond", "Alexander", "Patrick", "Jack", "Dennis", "Jerry",
  "Carlos", "Luis", "Jose", "Juan", "Miguel", "Ahmed", "Omar", "Wei", "Raj", "Arjun",
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen",
  "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle",
  "Carol", "Amanda", "Dorothy", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia",
  "Kathleen", "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela", "Emma", "Nicole", "Helen",
  "Maria", "Elena", "Sofia", "Lucia", "Ana", "Rosa", "Carmen", "Priya", "Aisha", "Fatima",
  "Grace", "Hope", "Faith", "Rose", "April", "May", "June", "Will", "Bill", "Art",
] as const;

// Name parts that are also ordinary English words. When they appear on their
// own, they only count as a name if capitalized mid-sentence.
export const COMMON_WORD_NAMES = new Set(
  [
    "will", "bill", "art", "mark", "grace", "hope", "faith", "rose", "april", "may", "june", "joy",
    "bell", "moss", "marsh", "hunter", "brown", "white", "black", "green", "young", "king", "rivers",
    "banks", "hill", "wood", "stone", "fox", "summer", "winter", "price", "long", "frank",
  ],
);

export const TITLES = "(?:Dr|Mr|Mrs|Ms|Miss|Mx)\\.?";

// Used by output grounding: medication names in an answer must appear in the sources.
export const MEDICATIONS = [
  "metformin", "insulin", "glipizide", "empagliflozin", "semaglutide", "lisinopril", "losartan", "amlodipine",
  "hydrochlorothiazide", "metoprolol", "carvedilol", "atorvastatin", "rosuvastatin", "simvastatin",
  "warfarin", "apixaban", "rivaroxaban", "aspirin", "clopidogrel", "furosemide", "spironolactone",
  "levothyroxine", "albuterol", "fluticasone", "tiotropium", "budesonide", "montelukast", "prednisone",
  "ibuprofen", "acetaminophen", "naproxen", "oxycodone", "tramadol", "gabapentin", "topiramate",
  "sumatriptan", "sertraline", "fluoxetine", "escitalopram", "bupropion", "omeprazole", "pantoprazole",
  "amoxicillin", "azithromycin", "doxycycline", "ciprofloxacin",
] as const;
