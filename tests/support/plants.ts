import type { PatientContext } from "@/core/types";

/**
 * Ground truth comes from this file, never from the detector or the vault.
 * Each case plants identifiers in a message and lists them.
 */
export interface Plant {
  message: string;
  /** Exact substrings that must not appear in the prompt. */
  planted: string[];
  /** Defaults to pt-001 (Maria Lopez). */
  patient?: string | PatientContext;
}

// Synthetic records whose names exercise non-ASCII letters and punctuation.
const JOSE: PatientContext = {
  id: "pt-test-jose",
  description: "",
  fields: { name: "José Núñez", dob: "1970-05-04", mrn: "MRN-109001" },
};
const AISHA: PatientContext = {
  id: "pt-test-aisha",
  description: "",
  fields: { name: "Aisha O'Brien-Okafor", dob: "1981-12-30", mrn: "MRN-109002" },
};

export const PLANTS: Record<string, Plant[]> = {
  "record name in any case": [
    { message: "maria said her chest hurts.", planted: ["maria"] },
    { message: "MARIA said her chest hurts.", planted: ["MARIA"] },
    { message: "lopez reports dizziness.", planted: ["lopez"] },
    { message: "okafor is short of breath today.", planted: ["okafor"], patient: "pt-002" },
    { message: "PRIYA asked about her TSH.", planted: ["PRIYA"], patient: "pt-006" },
    { message: "Portal: https://portal.example.org/patients/maria-lopez/chart", planted: ["maria", "lopez"] },
    { message: "Email draft for maria_lopez in the inbox.", planted: ["maria", "lopez"] },
  ],
  "record name with non-ASCII letters or punctuation": [
    { message: "José is better today.", planted: ["José"], patient: JOSE },
    { message: "jose núñez called back.", planted: ["núñez"], patient: JOSE },
    { message: "Okafor feels better.", planted: ["Okafor"], patient: AISHA },
  ],
  "third parties with non-ASCII or punctuated surnames": [
    { message: "Daughter Elena Núñez helps with meds.", planted: ["Núñez"] },
    { message: "Seen with Dr. Nguyễn yesterday.", planted: ["Nguyễn", "ễn"] },
    { message: "Her son Kevin O'Neil drives her.", planted: ["O'Neil"] },
    { message: "Referred by Dr. McDonald.", planted: ["McDonald"] },
  ],
  "dates in other formats": [
    { message: "Seen March 14 for a review.", planted: ["March 14"] },
    { message: "Follow-up 14 March 2026.", planted: ["14 March 2026"] },
    { message: "Seen on the 14th of March.", planted: ["14th of March"] },
    { message: "Labs 03-14-2026 and 2026/04/01.", planted: ["03-14-2026", "2026/04/01"] },
    { message: "Born 9 Feb 1968.", planted: ["9 Feb 1968"] },
    { message: "DOB 02.09.1968.", planted: ["02.09.1968"] },
    { message: "Admitted 14/03/2026.", planted: ["14/03/2026"] },
    { message: "ADMITTED MARCH 14, 2026.", planted: ["MARCH 14"] },
  ],
  "phones and SSNs without the usual separators": [
    { message: "Call 5125550147 after 5.", planted: ["5125550147"] },
    { message: "Or +15125550147.", planted: ["+15125550147"] },
    { message: "SSN 123456789 on the form.", planted: ["123456789"] },
    { message: "SSN: 123 45 6789.", planted: ["123 45 6789"] },
    { message: "Social security number 123.45.6789.", planted: ["123.45.6789"] },
  ],
  "ZIP codes without a state": [
    { message: "ZIP 78745 on file.", planted: ["78745"] },
    { message: "zip code 78664.", planted: ["78664"] },
    { message: "She moved within 78745 last year.", planted: ["78745"] },
  ],
  // None of these first names are in FIRST_NAMES: the test must not share the detector's dictionary.
  "people outside the name dictionary": [
    { message: "Her neighbor Tyrone Jackson brought her in.", planted: ["Tyrone", "Jackson"] },
    { message: "Suman Thapa is her caregiver.", planted: ["Suman", "Thapa"] },
    { message: "Her daughter Anjali helps with insulin.", planted: ["Anjali"] },
    { message: "Met with Oluwaseun Adeyemi about transport.", planted: ["Oluwaseun", "Adeyemi"] },
    { message: "Her grandson, Nguyễn Minh, called twice.", planted: ["Nguyễn", "Minh"] },
    { message: "Lakshmi said the swelling is worse.", planted: ["Lakshmi"] },
  ],
  "employers, towns, account numbers and URLs": [
    { message: "She works at H-E-B in Kyle.", planted: ["H-E-B", "Kyle"] },
    { message: "Employer: Dell Technologies.", planted: ["Dell Technologies"] },
    { message: "Lives in Wimberley now.", planted: ["Wimberley"] },
    { message: "Grew up in San Marcos.", planted: ["San Marcos"] },
    { message: "BCBS member ID XYZ123456789.", planted: ["XYZ123456789"] },
    { message: "Medicaid #: 512349876A.", planted: ["512349876A"] },
    { message: "Account 4417123456789113 is overdue.", planted: ["4417123456789113"] },
    { message: "Portal https://portal.example.org/patients/88213/chart", planted: ["88213", "portal.example.org"] },
  ],
};

// Known gaps: no cue around the identifier. `it.fails` keeps them visible and fails the
// moment one starts passing, so whoever fixes it moves the case up into PLANTS.
export const OPEN_GAPS: Plant[] = [
  { message: "Anjali from the pharmacy called.", planted: ["Anjali"] },
  { message: "Ama stopped by with groceries.", planted: ["Ama"] },
  { message: "Seen at the Kyle clinic last week.", planted: ["Kyle"] },
];
