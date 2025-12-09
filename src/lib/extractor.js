
// --- Helpers ---

const cleanText = (text) => {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
};

const extractValue = (text, patterns) => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return "";
};

const checkBoolean = (text, contextKeywords) => {
    // Simple heuristic: look for "yes/no" near the keyword within a small window
    // This is hard on raw full text without layout, so we search the whole block relative to the keyword if possible.
    // For this generic extractor, we'll try to find the line containing the keyword.

    // Find lines with keyword
    const lines = text.split('\n');
    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (contextKeywords.some(k => lowerLine.includes(k.toLowerCase()))) {
            if (lowerLine.includes('yes') || lowerLine.match(/\[\s*x\s*\]/)) return true;
            if (lowerLine.includes('no')) return false;
        }
    }
    return null;
};

// --- Logic ---

export function extractData(pageTexts, templateHint = 'auto') {
    const fullText = pageTexts.join('\n');

    // 1. Template Detection
    let template = "unknown";

    if (templateHint !== 'auto' && (templateHint === "handover_sheet_ot" || templateHint === "general_admission_treatment_consent_obstetric")) {
        template = templateHint;
    } else {
        const clean = cleanText(fullText);
        if (clean.includes("handover sheet") || (clean.includes("identification") && clean.includes("situation") && clean.includes("assessment"))) {
            template = "handover_sheet_ot";
        } else if (clean.includes("general admission") || clean.includes("treatment consent") || (clean.includes("obstetric exam"))) {
            template = "general_admission_treatment_consent_obstetric";
        }
    }

    // 2. Common Fields
    const common = {
        patientName: extractValue(fullText, [/Name\s*(?:of\s*the\s*patient)?\s*[:\-]?\s*([A-Za-z\s\.]+)/i, /Patient\s*Name\s*[:\-]?\s*([A-Za-z\s\.]+)/i]),
        uhidNo: extractValue(fullText, [/UHID\s*(?:No)?\s*[:\-]?\s*([\w\d]+)/i, /Hospital\s*No\s*[:\-]?\s*([\w\d]+)/i]),
        age: extractValue(fullText, [/Age\s*[:\-]?\s*(\d+\s*\w*)/i, /(\d+)\s*years/i]),
        gender: "", // Logic below
        dateOfAdmission: extractValue(fullText, [/Date\s*of\s*Admission\s*[:\-]?\s*([\d\/\-\.]+)/i, /DOA\s*[:\-]?\s*([\d\/\-\.]+)/i]),
        wardOrRoom: extractValue(fullText, [/Ward\s*[:\-]?\s*([\w\d\s]+)/i, /Room\s*[:\-]?\s*([\w\d\s]+)/i]),
        bedNo: extractValue(fullText, [/Bed\s*(?:No)?\s*[:\-]?\s*([\w\d]+)/i])
    };

    // Gender Normalization
    const rawGender = extractValue(fullText, [/Sex\s*[:\-]?\s*(\w+)/i, /Gender\s*[:\-]?\s*(\w+)/i]).toUpperCase();
    if (rawGender.startsWith('M')) common.gender = 'M';
    else if (rawGender.startsWith('F')) common.gender = 'F';
    else if (rawGender.length > 0) common.gender = 'O';

    const result = {
        template,
        common,
        handoverSheetOT: {
            dateOfSurgery: "", timeOfSurgery: "", surgeryName: "", shift: "",
            situation: { patientCondition: "", otherIssues: "", allergies: { hasAllergies: null, allergyDetails: "" }, diabetes: { isDiabetic: null, details: "" }, hypertension: { hasHypertension: null, details: "" } },
            assessment: { vitalsStable: null, vitalsDetails: "", bp: "", pulse: "", respRate: "", temperature: "", spo2: "", grbs: "", painScore: "", linesAndTubes: { ivLine: null, cvpLine: null, artLine: null, foleyCatheter: null, rtTube: null, woundDrain: null, jpDrain: null, otherLines: "" }, infusions: { ns: "", rl: "", dns: "", bloodProducts: "", others: "" } },
            recommendation: { anesthetistRoundsDone: null, changesInTreatmentPlan: "", dischargePlan: "", timeOfShiftOutFromOT: "", remarks: "" },
            signatures: { handedOverBy: "", handedOverTo: "", timeOfHandover: "" }
        },
        generalAdmissionTreatmentConsentObstetric: {
            generalExam: { bp: "", pulse: "", respRate: "", temperature: "", spo2: "", built: "", nutrition: "", pallor: "", icterus: "", cyanosis: "", clubbing: "", lymphNodes: "", edema: "" },
            obstetricExam: { lmp: "", edd: "", gestationalAgeWeeks: "", presentation: "", lie: "", fetalHeartRate: "", uterusSize: "", contractions: "", membranes: "", perVaginalFindings: "", perSpeculumFindings: "" },
            clinicalFindings: "", provisionalDiagnosis: "", treatmentAdvised: "", planOfManagement: "",
            consent: { procedureName: "", riskExplained: "", consentingPersonName: "", relationshipToPatient: "", dateOfConsent: "", timeOfConsent: "", witnessName: "" },
            signatures: { patientOrRelative: "", doctorName: "", doctorRegNo: "", date: "", time: "" }
        },
        meta: { ocrIssues: [], lowConfidenceFields: [] }
    };

    if (template === "handover_sheet_ot") {
        // Fill OT fields (Partial Implementation of Example Rules)
        const ot = result.handoverSheetOT;
        ot.dateOfSurgery = extractValue(fullText, [/Date\s*of\s*Surgery\s*[:\-]?\s*([\d\/\-\.]+)/i]);
        ot.timeOfSurgery = extractValue(fullText, [/Time\s*of\s*Surgery\s*[:\-]?\s*([\d\:\s\w]+)/i]);
        ot.surgeryName = extractValue(fullText, [/Surgery\s*[:\-]?\s*([\w\s]+)/i, /Procedure\s*[:\-]?\s*([\w\s]+)/i]);
        ot.shift = extractValue(fullText, [/Shift\s*[:\-]?\s*([\w\s]+)/i]);

        // Situation
        ot.situation.patientCondition = extractValue(fullText, [/Patient\s*Condition\s*[:\-]?\s*([\w\s\.]+)/i]);
        ot.situation.allergies.hasAllergies = checkBoolean(fullText, ["Allergy", "Allergies"]);
        ot.situation.allergies.allergyDetails = extractValue(fullText, [/Allergies\s*[:\-]?\s*(?:Yes\/No)?\s*(?:If\s*yes,)?\s*specify\s*[:\-]?\s*([\w\s]+)/i]);

        // Vitals
        ot.assessment.bp = extractValue(fullText, [/BP\s*[:\-]?\s*([\d\/]+)/i]);
        ot.assessment.pulse = extractValue(fullText, [/Pulse\s*[:\-]?\s*([\d]+)/i]);
        ot.assessment.respRate = extractValue(fullText, [/RR\s*[:\-]?\s*([\d]+)/i, /Resp\s*Rate\s*[:\-]?\s*([\d]+)/i]);
        ot.assessment.spo2 = extractValue(fullText, [/SpO2\s*[:\-]?\s*([\d]+)/i]);
        ot.assessment.temperature = extractValue(fullText, [/Temp\s*[:\-]?\s*([\d\.]+)/i]);

        // Signatures
        ot.signatures.handedOverBy = extractValue(fullText, [/Handed\s*over\s*by\s*[:\-]?\s*([\w\s\.]+)/i]);
        ot.signatures.handedOverTo = extractValue(fullText, [/Handed\s*over\s*to\s*[:\-]?\s*([\w\s\.]+)/i]);

    } else if (template === "general_admission_treatment_consent_obstetric") {
        const ga = result.generalAdmissionTreatmentConsentObstetric;

        // General Exam
        ga.generalExam.bp = extractValue(fullText, [/BP\s*[:\-]?\s*([\d\/]+)/i]);
        ga.generalExam.pulse = extractValue(fullText, [/Pulse\s*[:\-]?\s*([\d]+)/i]);
        ga.generalExam.pallor = extractValue(fullText, [/Pallor\s*[:\-]?\s*([\w\s]+)/i]);

        // Obstetric
        ga.obstetricExam.lmp = extractValue(fullText, [/LMP\s*[:\-]?\s*([\d\/\-\.]+)/i]);
        ga.obstetricExam.edd = extractValue(fullText, [/EDD\s*[:\-]?\s*([\d\/\-\.]+)/i]);
        ga.obstetricExam.gestationalAgeWeeks = extractValue(fullText, [/Gestational\s*Age\s*[:\-]?\s*([\w\d\s]+)/i, /POG\s*[:\-]?\s*([\w\d\s]+)/i]);

        // Consent
        ga.consent.procedureName = extractValue(fullText, [/Consent\s*for\s*[:\-]?\s*([\w\s]+)/i]);
        ga.consent.consentingPersonName = extractValue(fullText, [/Name\s*of\s*consenting\s*person\s*[:\-]?\s*([\w\s\.]+)/i]);
    }

    return result;
}
