
import { useState, useRef } from 'react';
import { extractData } from './lib/extractor';
import { performOCR } from './lib/ocr';
import { Activity, FileText, Play, Download, Stethoscope, Upload, Loader2 } from 'lucide-react';

function App() {
    const [inputText, setInputText] = useState("");
    const [result, setResult] = useState(null);
    const [activeTab, setActiveTab] = useState('form');

    // OCR State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");
    const [fileName, setFileName] = useState("");
    const fileInputRef = useRef(null);

    const handleExtract = () => {
        if (!inputText) return;
        const data = extractData([inputText]);
        setResult(data);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setIsProcessing(true);
        setResult(null);
        setInputText("");

        try {
            const texts = await performOCR(file, (status, prog) => {
                setStatus(status);
                setProgress(Math.round(prog * 100));
            });

            const fullText = texts.join('\n\n--- PAGE BREAK ---\n\n');
            setInputText(fullText);
            const data = extractData(texts);
            setResult(data);
        } catch (err) {
            alert(`OCR Failed: ${err.message}`);
            setFileName("");
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadJSON = () => {
        if (!result) return;
        const jsonString = JSON.stringify(result, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `extraction_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                <div className="brand">
                    <div className="brand-icon">
                        <Stethoscope size={20} />
                    </div>
                    <span className="brand-text">Prescription Scanner<span></span></span>
                </div>
                <div className="header-actions">
                    {/* Samples and other actions removed as requested */}
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">

                {/* Left Panel: Input */}
                <section className="panel sidebar">
                    <div className="panel-header">
                        <span className="panel-title">
                            <FileText size={16} />
                            Source Document
                        </span>
                        <button
                            className="btn btn-primary"
                            onClick={handleExtract}
                        >
                            <Play size={16} />
                            Process Text
                        </button>
                    </div>

                    <div className="input-area">
                        {/* Custom Upload Box */}
                        <div
                            className={`upload-box ${isProcessing ? 'processing' : ''}`}
                            onClick={() => !isProcessing && fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden-input"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileUpload}
                            />
                            {isProcessing ? (
                                <div className="upload-content">
                                    <Loader2 size={32} className="spinner" />
                                    <p className="status-text">{status}</p>
                                    <p className="progress-text">{progress}% complete</p>
                                </div>
                            ) : (
                                <div className="upload-content">
                                    <div className="upload-icon-wrapper">
                                        <Upload size={24} />
                                    </div>
                                    <h3 className="upload-title">
                                        {fileName || "Click to Upload PDF or Image"}
                                    </h3>
                                    <p className="upload-subtitle">Supports PDF, PNG, JPG</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-editor-container">
                        <div className="text-editor-label">EXTRACTED TEXT VIEW</div>
                        <textarea
                            className="text-editor"
                            placeholder="Raw text will appear here..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                    </div>
                </section>

                {/* Right Panel: Output */}
                <section className="panel results-panel">
                    <div className="panel-header">
                        <div className="tab-group">
                            <button
                                className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
                                onClick={() => setActiveTab('form')}
                            >
                                Form Data
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                                onClick={() => setActiveTab('json')}
                            >
                                JSON Output
                            </button>
                        </div>
                        {result && (
                            <button className="btn btn-secondary" onClick={downloadJSON}>
                                <Download size={14} /> Download JSON
                            </button>
                        )}
                    </div>

                    <div className="results-body">
                        {!result ? (
                            <div className="empty-state">
                                <Activity size={64} />
                                <p className="empty-title">No Data Extracted</p>
                                <p className="empty-subtitle">Upload a document to analyze</p>
                            </div>
                        ) : (
                            activeTab === 'json' ? (
                                <pre className="json-output">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            ) : (
                                <div className="form-view">

                                    {/* Patient Header Card */}
                                    <div className="patient-card">
                                        <div>
                                            <h1 className="patient-name">
                                                {result.common.patientName || <span className="text-muted italic">Unknown Name</span>}
                                            </h1>
                                            <div className="patient-meta">
                                                <span><span className="label">UHID:</span> {result.common.uhidNo || "N/A"}</span>
                                                <span className="divider"></span>
                                                <span><span className="label">Age:</span> {result.common.age || "N/A"}</span>
                                                <span className="divider"></span>
                                                <span><span className="label">Sex:</span> {result.common.gender || "N/A"}</span>
                                            </div>
                                        </div>
                                        <div className="template-badge-container">
                                            <span className="template-badge">
                                                {result.template}
                                            </span>
                                            <div className="timestamp">
                                                Extracted: {new Date().toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sections Grid */}
                                    <div className="grid-layout">

                                        {/* Common Details */}
                                        <Section title="Admission Info" color="blue">
                                            <Field label="Admission Date" value={result.common.dateOfAdmission} />
                                            <Field label="Ward" value={result.common.wardOrRoom} />
                                            <Field label="Bed No" value={result.common.bedNo} />
                                        </Section>

                                        {/* Template: Handover Sheet OT */}
                                        {result.template === 'handover_sheet_ot' && (
                                            <>
                                                <Section title="Surgery Details" color="emerald">
                                                    <Field label="Date" value={result.handoverSheetOT.dateOfSurgery} />
                                                    <Field label="Time" value={result.handoverSheetOT.timeOfSurgery} />
                                                    <Field label="Procedure" value={result.handoverSheetOT.surgeryName} />
                                                    <Field label="Shift" value={result.handoverSheetOT.shift} />
                                                </Section>

                                                <Section title="Situation & Background" color="orange">
                                                    <Field label="Condition" value={result.handoverSheetOT.situation.patientCondition} />
                                                    <Field label="Other Issues" value={result.handoverSheetOT.situation.otherIssues} />
                                                    <Field label="Allergies" value={formatBool(result.handoverSheetOT.situation.allergies.hasAllergies)} />
                                                    <Field label="Allergy Details" value={result.handoverSheetOT.situation.allergies.allergyDetails} />
                                                    <Field label="Diabetic" value={formatBool(result.handoverSheetOT.situation.diabetes.isDiabetic)} />
                                                    <Field label="Diabetes Details" value={result.handoverSheetOT.situation.diabetes.details} />
                                                    <Field label="Hypertension" value={formatBool(result.handoverSheetOT.situation.hypertension.hasHypertension)} />
                                                    <Field label="HTN Details" value={result.handoverSheetOT.situation.hypertension.details} />
                                                </Section>

                                                <Section title="Assessment (Vitals & Lines)" color="indigo">
                                                    <Field label="Vitals Stable" value={formatBool(result.handoverSheetOT.assessment.vitalsStable)} />
                                                    <Field label="Vitals Detail" value={result.handoverSheetOT.assessment.vitalsDetails} />
                                                    <Field label="BP" value={result.handoverSheetOT.assessment.bp} />
                                                    <Field label="Pulse" value={result.handoverSheetOT.assessment.pulse} />
                                                    <Field label="Resp Rate" value={result.handoverSheetOT.assessment.respRate} />
                                                    <Field label="Temp" value={result.handoverSheetOT.assessment.temperature} />
                                                    <Field label="SpO2" value={result.handoverSheetOT.assessment.spo2} />
                                                    <Field label="GRBS" value={result.handoverSheetOT.assessment.grbs} />
                                                    <Field label="Pain Score" value={result.handoverSheetOT.assessment.painScore} />

                                                    <div className="subsection-header">LINES & TUBES</div>
                                                    <Field label="IV Line" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.ivLine)} />
                                                    <Field label="CVP Line" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.cvpLine)} />
                                                    <Field label="Art Line" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.artLine)} />
                                                    <Field label="Foley" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.foleyCatheter)} />
                                                    <Field label="RT Tube" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.rtTube)} />
                                                    <Field label="Drain (Wound)" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.woundDrain)} />
                                                    <Field label="Drain (JP)" value={formatBool(result.handoverSheetOT.assessment.linesAndTubes.jpDrain)} />
                                                    <Field label="Other Lines" value={result.handoverSheetOT.assessment.linesAndTubes.otherLines} />

                                                    <div className="subsection-header">INFUSIONS</div>
                                                    <Field label="NS" value={result.handoverSheetOT.assessment.infusions.ns} />
                                                    <Field label="RL" value={result.handoverSheetOT.assessment.infusions.rl} />
                                                    <Field label="DNS" value={result.handoverSheetOT.assessment.infusions.dns} />
                                                    <Field label="Blood Prod." value={result.handoverSheetOT.assessment.infusions.bloodProducts} />
                                                    <Field label="Others" value={result.handoverSheetOT.assessment.infusions.others} />
                                                </Section>

                                                <Section title="Recommendation & Signatures" color="slate">
                                                    <Field label="Anesthetist Rounds" value={formatBool(result.handoverSheetOT.recommendation.anesthetistRoundsDone)} />
                                                    <Field label="Plan Changes" value={result.handoverSheetOT.recommendation.changesInTreatmentPlan} />
                                                    <Field label="Discharge Plan" value={result.handoverSheetOT.recommendation.dischargePlan} />
                                                    <Field label="Shift Out Time" value={result.handoverSheetOT.recommendation.timeOfShiftOutFromOT} />
                                                    <Field label="Remarks" value={result.handoverSheetOT.recommendation.remarks} />
                                                    <div className="divider-line"></div>
                                                    <Field label="Handed Over By" value={result.handoverSheetOT.signatures.handedOverBy} />
                                                    <Field label="Handed Over To" value={result.handoverSheetOT.signatures.handedOverTo} />
                                                    <Field label="Time" value={result.handoverSheetOT.signatures.timeOfHandover} />
                                                </Section>
                                            </>
                                        )}

                                        {/* Template: Consent & Obstetric */}
                                        {result.template === 'general_admission_treatment_consent_obstetric' && (
                                            <>
                                                <Section title="General Exam" color="pink">
                                                    <Field label="BP" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.bp} />
                                                    <Field label="Pulse" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.pulse} />
                                                    <Field label="Resp Rate" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.respRate} />
                                                    <Field label="Temp" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.temperature} />
                                                    <Field label="SpO2" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.spo2} />
                                                    <Field label="Pallor" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.pallor} />
                                                    <Field label="Icterus" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.icterus} />
                                                    <Field label="Cyanosis" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.cyanosis} />
                                                    <Field label="Clubbing" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.clubbing} />
                                                    <Field label="Varix/Nodes" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.lymphNodes} />
                                                    <Field label="Edema" value={result.generalAdmissionTreatmentConsentObstetric.generalExam.edema} />
                                                </Section>

                                                <Section title="Obstetric Exam" color="purple">
                                                    <Field label="LMP" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.lmp} />
                                                    <Field label="EDD" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.edd} />
                                                    <Field label="Gestational Age" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.gestationalAgeWeeks} />
                                                    <Field label="Presentation" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.presentation} />
                                                    <Field label="Lie" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.lie} />
                                                    <Field label="Fetal HR" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.fetalHeartRate} />
                                                    <Field label="Uterus Size" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.uterusSize} />
                                                    <Field label="Contractions" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.contractions} />
                                                    <Field label="Membranes" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.membranes} />
                                                    <Field label="PV Findings" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.perVaginalFindings} />
                                                    <Field label="PS Findings" value={result.generalAdmissionTreatmentConsentObstetric.obstetricExam.perSpeculumFindings} />
                                                </Section>

                                                <Section title="Clinical Plan" color="rose">
                                                    <Field label="Clinical Findings" value={result.generalAdmissionTreatmentConsentObstetric.clinicalFindings} />
                                                    <Field label="Prov. Diagnosis" value={result.generalAdmissionTreatmentConsentObstetric.provisionalDiagnosis} />
                                                    <Field label="Treatment Advised" value={result.generalAdmissionTreatmentConsentObstetric.treatmentAdvised} />
                                                    <Field label="Plan of Mgmt" value={result.generalAdmissionTreatmentConsentObstetric.planOfManagement} />
                                                </Section>

                                                <Section title="Consent & Signatures" color="gray">
                                                    <Field label="Procedure" value={result.generalAdmissionTreatmentConsentObstetric.consent.procedureName} />
                                                    <Field label="Risks Exp." value={result.generalAdmissionTreatmentConsentObstetric.consent.riskExplained} />
                                                    <Field label="Consenting Person" value={result.generalAdmissionTreatmentConsentObstetric.consent.consentingPersonName} />
                                                    <Field label="Relation" value={result.generalAdmissionTreatmentConsentObstetric.consent.relationshipToPatient} />
                                                    <Field label="Date" value={result.generalAdmissionTreatmentConsentObstetric.consent.dateOfConsent} />
                                                    <Field label="Time" value={result.generalAdmissionTreatmentConsentObstetric.consent.timeOfConsent} />
                                                    <div className="divider-line"></div>
                                                    <Field label="Doctor" value={result.generalAdmissionTreatmentConsentObstetric.signatures.doctorName} />
                                                    <Field label="Reg No" value={result.generalAdmissionTreatmentConsentObstetric.signatures.doctorRegNo} />
                                                    <Field label="Patient/Rel" value={result.generalAdmissionTreatmentConsentObstetric.signatures.patientOrRelative} />
                                                </Section>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

// --- Layout Components ---

const Section = ({ title, children, color }) => {
    return (
        <div className={`section-card ${color}`}>
            <div className="section-header">
                {title}
            </div>
            <div className="section-body">
                {children}
            </div>
        </div>
    );
};

const Field = ({ label, value }) => {
    const displayValue = value === null || value === undefined || value === ""
        ? <span className="val-null">null</span>
        : <span className="val-text">{value}</span>;

    return (
        <div className="field-row">
            <span className="field-label">{label}</span>
            <span className="field-value">{displayValue}</span>
        </div>
    );
};

// Helper to format booleans nicely
const formatBool = (val) => {
    if (val === true) return "YES";
    if (val === false) return "NO";
    return null;
}

export default App;
