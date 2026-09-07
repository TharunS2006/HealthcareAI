/**
 * Primary Care & Emergency Edge AI Triage Engine
 * Browser-native neural network classification with deterministic clinical overrides.
 *
 * Design constraints — please preserve:
 *  1. TensorFlow.js (~290 kB) is loaded via a DYNAMIC import inside loadTriageModel().
 *     A static top-level import puts the whole library on the /opd critical path, which
 *     is the single page rural staff open first on a 2G link.
 *  2. Deterministic danger signs ALWAYS outrank the network. Override tiers are explicit
 *     (criticalFlags / cautionFlags) instead of substring-matched, because substring
 *     matching silently missed shock, hypoglycaemia and altered sensorium.
 *  3. `decisionSource` records who actually decided, so the UI never presents a protocol
 *     rule as a model prediction, and `confidence` always describes the class returned.
 *  4. Dataset and weight initialisation are SEEDED: identical vitals must yield an
 *     identical triage on every device for the record to be auditable.
 */

import type * as TF from '@tensorflow/tfjs';
import { Vitals, TriageStatus, TriagePriority, FacilityType } from '@/types/patient';

export type TriageDecisionSource =
    | 'NEURAL_NETWORK'    // softmax argmax accepted as-is
    | 'CLINICAL_OVERRIDE' // a deterministic danger-sign rule outranked the model
    | 'RULE_ENGINE';      // model unavailable; IPHS rules only

export interface TriageResult {
    status: TriageStatus;
    priority: TriagePriority;
    /** Confidence in the class actually returned — never the bare argmax. */
    confidence: number;
    reasoning: string;
    recommendedFacilityTier: FacilityType;
    recommendedAction: string;
    processingTime: number; // ms
    modelUsed: 'TensorFlow.js Neural Network (Primary Care)' | 'Clinical Rule Engine (IPHS Standard)';
    /** Raw softmax output, reported untouched even when a rule overrides the verdict. */
    probabilities: { RED: number; YELLOW: number; GREEN: number };
    flagsDetected: string[];
    decisionSource: TriageDecisionSource;
}

const MODEL_SEED = 20261;
/** Samples per class. The set is class-BALANCED on purpose — see buildTrainingSet(). */
const SAMPLES_PER_CLASS = 160;
const TRAINING_EPOCHS = 80;
const TRAINING_BATCH_SIZE = 24;

/**
 * Both the WebGL training run and the per-prediction tensor readback ultimately depend on
 * a browser rAF tick to hand data back from the GPU. That tick is not guaranteed: a
 * backgrounded/minimised tab, a lost WebGL context, or a low-power device can stall it
 * indefinitely, and neither tf.fit() nor tensor.data() ever reject on their own in that
 * case — they just never resolve. A triage workstation cannot sit on a spinner forever, so
 * every awaited model call below is raced against a timeout; losing the race means "treat
 * the model as unavailable this time" and fall through to the IPHS rule engine, not "fail".
 */
const MODEL_LOAD_TIMEOUT_MS = 4000;
const INFERENCE_TIMEOUT_MS = 3000;

let tfRuntime: typeof TF | null = null;
let compiledModel: TF.LayersModel | null = null;
let modelLoadPromise: Promise<TF.LayersModel | null> | null = null;

/** Resolves to `null` on timeout instead of rejecting — the loser is treated as absence, not failure. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            () => { clearTimeout(timer); resolve(null); }
        );
    });
}

/** Deterministic PRNG (mulberry32) so every device trains on the same dataset. */
function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Lazily loads TensorFlow.js and trains the 8-feature classifier in browser memory.
 * Concurrent callers share one in-flight promise, so training happens exactly once.
 */
export async function loadTriageModel(): Promise<TF.LayersModel | null> {
    if (compiledModel) return compiledModel;
    if (modelLoadPromise) return modelLoadPromise;

    modelLoadPromise = (async () => {
        try {
            // Dynamic import — keeps TF.js off the initial /opd bundle.
            const tf = await import('@tensorflow/tfjs');
            tfRuntime = tf;

            // Distinct but derived seeds: deterministic across devices, without giving
            // every layer the identical initialisation draw.
            const seededInit = (offset: number) => tf.initializers.glorotNormal({ seed: MODEL_SEED + offset });

            // 8 inputs -> 24 ReLU -> 12 ReLU -> 3 softmax
            const model = tf.sequential();
            model.add(tf.layers.dense({ units: 24, activation: 'relu', inputShape: [8], kernelInitializer: seededInit(0) }));
            model.add(tf.layers.dense({ units: 12, activation: 'relu', kernelInitializer: seededInit(1) }));
            model.add(tf.layers.dense({ units: 3, activation: 'softmax', kernelInitializer: seededInit(2) }));

            model.compile({
                optimizer: tf.train.adam(0.005),
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy'],
            });

            const { xs, ys } = buildTrainingSet(tf);
            // shuffle: false — batch order is already randomised deterministically by the
            // seeded shuffle in buildTrainingSet(). TF's own shuffle uses Math.random().
            await model.fit(xs, ys, {
                epochs: TRAINING_EPOCHS,
                batchSize: TRAINING_BATCH_SIZE,
                shuffle: false,
                verbose: 0,
            });
            xs.dispose();
            ys.dispose();

            compiledModel = model;
            return model;
        } catch (err) {
            console.warn('[Triage] TF.js unavailable — using IPHS rule engine:', err);
            modelLoadPromise = null;
            return null;
        }
    })();

    return modelLoadPromise;
}

interface FeatureInput {
    spo2: number; hr: number; sys: number; dia: number;
    temp: number; glucose: number; rr: number; danger: number;
}

/**
 * Single source of truth for feature scaling — training and inference must agree.
 *
 * Each channel is CENTRED on its normal-adult value and divided by a clinically wide
 * spread, so a healthy patient sits near the origin and abnormality has a sign. Squashing
 * everything into a narrow positive band instead (e.g. spo2/100 -> 0.95..1.0) leaves the
 * inputs nearly constant, which starved the gradients and let every hidden ReLU die —
 * the network then emitted a flat 0.33/0.33/0.33 for every patient.
 */
function normalizeFeatures(f: FeatureInput): number[] {
    return [
        (f.spo2 - 92) / 8,          // 92 % -> 0, 100 % -> +1, 76 % -> -2
        (f.hr - 90) / 50,           // 90 bpm -> 0, 140 -> +1
        (f.sys - 120) / 40,         // 120 mmHg -> 0, 160 -> +1
        (f.dia - 80) / 25,          // 80 mmHg -> 0, 105 -> +1
        (f.temp - 98.6) / 4,        // 98.6 F -> 0, 102.6 -> +1
        (f.glucose - 130) / 130,    // 130 mg/dL -> 0, 260 -> +1
        (f.rr - 18) / 14,           // 18 /min -> 0, 32 -> +1
        f.danger === 1 ? 1 : -1,    // symmetric flag
    ];
}

/**
 * Label a synthetic sample using the SAME thresholds assessClinically() applies, so the
 * network interpolates between the rule engine's own boundaries instead of inventing an
 * unrelated decision surface.
 */
function labelFor(f: FeatureInput): 'RED' | 'YELLOW' | 'GREEN' {
    if (
        f.spo2 < 90 || f.hr > 130 || f.hr < 48 ||
        f.sys <= 85 || f.sys >= 160 || f.dia >= 100 ||
        f.rr >= 36 || f.rr <= 8 ||
        f.glucose <= 55 || f.glucose >= 280 ||
        f.danger === 1
    ) return 'RED';

    if (
        f.spo2 < 95 || f.hr > 105 ||
        f.sys >= 140 || f.dia >= 90 ||
        f.rr >= 27 || f.temp >= 102.5 || f.glucose >= 180
    ) return 'YELLOW';

    return 'GREEN';
}

const LABEL_VECTOR: Record<'RED' | 'YELLOW' | 'GREEN', number[]> = {
    RED: [1, 0, 0],
    YELLOW: [0, 1, 0],
    GREEN: [0, 0, 1],
};

/**
 * Class-BALANCED synthetic training set.
 *
 * Why balanced sampling and not uniform ranges: uniform draws across physiologically wide
 * ranges are overwhelmingly abnormal (e.g. glucose 50-350 mg/dL is above the 280 threshold
 * ~83% of the time), so ~99% of samples label RED and the network collapses to "always
 * RED" — which makes it strictly worse than the rule engine and silently un-overridable,
 * because an override can only escalate. Each class is therefore drawn from its own
 * profile and the intended label is re-verified with labelFor() before the sample is kept.
 */
function buildTrainingSet(tf: typeof TF): { xs: TF.Tensor2D; ys: TF.Tensor2D } {
    const rand = seededRandom(MODEL_SEED);
    const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
    const pick = <T,>(options: T[]): T => options[Math.floor(rand() * options.length)];

    /** Vitals well inside normal primary-care limits; every profile starts here. */
    const healthyBase = (): FeatureInput => ({
        spo2: between(95.5, 100),
        hr: between(58, 100),
        sys: between(100, 136),
        dia: between(62, 86),
        temp: between(97.2, 100.4),
        glucose: between(72, 168),
        rr: between(11, 24),
        danger: 0,
    });

    // One abnormality at a time, so each feature's boundary is learned in isolation.
    const yellowTriggers: Array<(f: FeatureInput) => void> = [
        (f) => { f.spo2 = between(90.5, 94.8); },
        (f) => { f.hr = between(106, 129); },
        (f) => { f.sys = between(140, 158); },
        (f) => { f.dia = between(90, 99); },
        (f) => { f.rr = between(27, 35); },
        (f) => { f.temp = between(102.5, 104.5); },
        (f) => { f.glucose = between(180, 275); },
    ];

    const redTriggers: Array<(f: FeatureInput) => void> = [
        (f) => { f.spo2 = between(70, 89.5); },
        (f) => { f.hr = between(131, 190); },
        (f) => { f.hr = between(38, 47); },
        (f) => { f.sys = between(68, 85); f.dia = between(40, 58); },
        (f) => { f.sys = between(160, 200); f.dia = between(96, 118); },
        (f) => { f.rr = between(36, 55); },
        (f) => { f.rr = between(4, 8); },
        (f) => { f.glucose = between(35, 55); },
        (f) => { f.glucose = between(280, 420); },
        (f) => { f.danger = 1; },        // maternal / paediatric danger sign, vitals otherwise normal
    ];

    const xsList: number[][] = [];
    const ysList: number[][] = [];

    const emit = (target: 'RED' | 'YELLOW' | 'GREEN', mutate?: (f: FeatureInput) => void) => {
        // Bounded retries: a profile should already satisfy labelFor(), the loop only guards
        // against an edge draw so a mislabelled sample is never trained on.
        for (let attempt = 0; attempt < 12; attempt++) {
            const f = healthyBase();
            mutate?.(f);
            if (labelFor(f) === target) {
                xsList.push(normalizeFeatures(f));
                ysList.push(LABEL_VECTOR[target]);
                return;
            }
        }
    };

    for (let i = 0; i < SAMPLES_PER_CLASS; i++) {
        emit('GREEN');
        emit('YELLOW', pick(yellowTriggers));
        emit('RED', pick(redTriggers));
    }

    // Deterministic Fisher-Yates: batches must be class-mixed, but identically so on
    // every device. This is why fit() keeps shuffle: false.
    for (let i = xsList.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [xsList[i], xsList[j]] = [xsList[j], xsList[i]];
        [ysList[i], ysList[j]] = [ysList[j], ysList[i]];
    }

    return { xs: tf.tensor2d(xsList), ys: tf.tensor2d(ysList) };
}

interface ClinicalAssessment {
    /** Danger signs that must force RED regardless of model output. */
    criticalFlags: string[];
    /** Findings that must force at least YELLOW. */
    cautionFlags: string[];
    reasoning: string;
    flagsDetected: string[];
    isHighRiskMaternal: boolean;
    isHighRiskChild: boolean;
    features: FeatureInput;
}

/**
 * Deterministic danger-sign evaluation (IPHS / NHM standard treatment guidelines).
 * Runs before and independently of the network so it can never be skipped.
 */
function assessClinically(vitals: Vitals): ClinicalAssessment {
    // Defaults are healthy-adult values, used only when a reading was not taken.
    const spo2 = vitals.spo2 || 96;
    const hr = vitals.heartRate || 80;
    const sys = vitals.bloodPressure?.systolic || 120;
    const dia = vitals.bloodPressure?.diastolic || 80;
    const temp = vitals.temperature || 98.6;
    const glucose = vitals.bloodGlucose || 100;
    const rr = vitals.respiratoryRate || 16;
    const notes = (vitals.injuryType || '').toLowerCase();

    const isHighRiskMaternal = !!(
        vitals.isPregnant &&
        (sys >= 150 || dia >= 95 || notes.includes('headache') || notes.includes('bleeding') || notes.includes('eclampsia'))
    );
    const isChild = !!(vitals.childAgeMonths && vitals.childAgeMonths <= 60);
    const isHighRiskChild = !!(
        isChild &&
        (rr >= 40 || spo2 < 92 || temp > 102 || notes.includes('malnutrition') || notes.includes('unconscious'))
    );

    const criticalFlags: string[] = [];
    const cautionFlags: string[] = [];
    const reasoningFactors: string[] = [];

    if (spo2 < 90) { criticalFlags.push('SPO2_CRITICAL'); reasoningFactors.push(`Critical hypoxia (SpO2 ${spo2}%)`); }
    else if (spo2 < 95) { cautionFlags.push('SPO2_LOW'); reasoningFactors.push(`Low oxygen saturation (${spo2}%)`); }

    if (hr > 130) { criticalFlags.push('TACHYCARDIA_SEVERE'); reasoningFactors.push(`Severe tachycardia (${hr} bpm)`); }
    else if (hr < 48) { criticalFlags.push('BRADYCARDIA_SEVERE'); reasoningFactors.push(`Severe bradycardia (${hr} bpm)`); }
    else if (hr > 105) { cautionFlags.push('TACHYCARDIA'); reasoningFactors.push(`Tachycardia (${hr} bpm)`); }

    if (sys <= 85) { criticalFlags.push('HYPOTENSION_SHOCK'); reasoningFactors.push(`Hypotension / shock (${sys}/${dia} mmHg)`); }
    else if (sys >= 160 || dia >= 100) { criticalFlags.push('HYPERTENSION_SEVERE'); reasoningFactors.push(`Stage-2 severe hypertension (${sys}/${dia} mmHg)`); }
    else if (sys >= 140 || dia >= 90) { cautionFlags.push('HYPERTENSION'); reasoningFactors.push(`Raised blood pressure (${sys}/${dia} mmHg)`); }

    if (rr >= 36) { criticalFlags.push('RESP_RATE_CRITICAL'); reasoningFactors.push(`Severe tachypnoea (RR ${rr}/min)`); }
    else if (rr <= 8) { criticalFlags.push('RESP_RATE_LOW'); reasoningFactors.push(`Bradypnoea — impending respiratory arrest (RR ${rr}/min)`); }
    else if (rr >= 27) { cautionFlags.push('RESP_RATE_HIGH'); reasoningFactors.push(`Tachypnoea (RR ${rr}/min)`); }

    if (temp >= 102.5) { cautionFlags.push('HIGH_FEVER'); reasoningFactors.push(`High-grade pyrexia (${temp}°F)`); }

    if (glucose <= 55) { criticalFlags.push('HYPOGLYCEMIA_CRITICAL'); reasoningFactors.push(`Hypoglycaemia (${glucose} mg/dL) — immediate glucose required`); }
    else if (glucose >= 280) { criticalFlags.push('HYPERGLYCEMIA_CRITICAL'); reasoningFactors.push(`Marked hyperglycaemia (${glucose} mg/dL)`); }
    else if (glucose >= 180) { cautionFlags.push('HYPERGLYCEMIA'); reasoningFactors.push(`Hyperglycaemia (${glucose} mg/dL)`); }

    if (isHighRiskMaternal) { criticalFlags.push('HIGH_RISK_MATERNAL'); reasoningFactors.push('Maternal danger signs — suspected pre-eclampsia'); }
    if (isHighRiskChild) { criticalFlags.push('HIGH_RISK_PEDIATRIC'); reasoningFactors.push('Paediatric danger sign / severe acute malnutrition'); }

    if (vitals.consciousness === 'UNRESPONSIVE' || vitals.consciousness === 'PAIN') {
        criticalFlags.push('CONSCIOUSNESS_CRITICAL');
        reasoningFactors.push(`Altered sensorium (AVPU: ${vitals.consciousness})`);
    } else if (vitals.consciousness === 'VOICE') {
        cautionFlags.push('CONSCIOUSNESS_ALTERED');
        reasoningFactors.push('Responds to voice only (AVPU: VOICE)');
    }

    return {
        criticalFlags,
        cautionFlags,
        flagsDetected: [...criticalFlags, ...cautionFlags],
        reasoning: reasoningFactors.length > 0
            ? reasoningFactors.join('. ') + '.'
            : 'All recorded vital parameters within normal primary-care limits.',
        isHighRiskMaternal,
        isHighRiskChild,
        features: {
            spo2, hr, sys, dia, temp, glucose, rr,
            danger: (isHighRiskMaternal || isHighRiskChild) ? 1 : 0,
        },
    };
}

/** Referral tier + action text for a decided status (shared by both decision paths). */
function buildRecommendation(
    status: TriageStatus,
    isHighRiskMaternal: boolean,
    isHighRiskChild: boolean
): { tier: FacilityType; action: string } {
    if (status === 'RED') {
        // CHC is the First Referral Unit; maternal/paediatric emergencies need CEmONC/SNCU at DH.
        return {
            tier: (isHighRiskMaternal || isHighRiskChild) ? 'DH' : 'CHC',
            action: isHighRiskMaternal
                ? 'Immediate 102 Janani ambulance dispatch to a CEmONC facility (CHC/DH). Teleconsult a specialist for stabilisation en route.'
                : isHighRiskChild
                ? 'Immediate 108 dispatch to DH with SNCU/NRC capability. Begin paediatric stabilisation protocol.'
                : 'Immediate stabilisation and emergency referral (108 ambulance) to the First Referral Unit (CHC/DH).',
        };
    }

    if (status === 'YELLOW') {
        return {
            tier: 'CHC',
            action: 'Expedited medical officer consultation at PHC/CHC. Order lab investigations and schedule follow-up within 48 hours.',
        };
    }

    return {
        tier: 'PHC',
        action: 'Routine OPD consultation and standard medicine dispensing at the PHC.',
    };
}

const PRIORITY_BY_STATUS: Record<TriageStatus, TriagePriority> = {
    RED: 'EMERGENCY',
    YELLOW: 'URGENT',
    GREEN: 'ROUTINE',
};

/**
 * Classify a patient. The clinical assessment runs first and unconditionally; the
 * network refines it but can never de-escalate a documented danger sign.
 */
export async function classifyTriage(vitals: Vitals): Promise<TriageResult> {
    const startTime = performance.now();

    const {
        criticalFlags, cautionFlags, flagsDetected, reasoning,
        isHighRiskMaternal, isHighRiskChild, features,
    } = assessClinically(vitals);

    try {
        const model = await withTimeout(loadTriageModel(), MODEL_LOAD_TIMEOUT_MS);
        const tf = tfRuntime;

        if (model && tf) {
            const inputTensor = tf.tensor2d([normalizeFeatures(features)]);
            const pred = model.predict(inputTensor) as TF.Tensor;
            // Tensors are disposed once the readback settles, whenever that is — if the
            // timeout below wins the race, this .finally() still cleans up in the background
            // instead of double-disposing or freeing tensors still in flight.
            const raw = await withTimeout(
                pred.data().finally(() => {
                    inputTensor.dispose();
                    pred.dispose();
                }),
                INFERENCE_TIMEOUT_MS
            );
            if (!raw) throw new Error('Inference timed out (GPU readback stalled)');

            const probabilities = { RED: raw[0], YELLOW: raw[1], GREEN: raw[2] };

            // The network's own verdict (argmax over the softmax).
            let status: TriageStatus =
                probabilities.RED >= probabilities.YELLOW && probabilities.RED >= probabilities.GREEN
                    ? 'RED'
                    : probabilities.YELLOW >= probabilities.GREEN
                    ? 'YELLOW'
                    : 'GREEN';

            let decisionSource: TriageDecisionSource = 'NEURAL_NETWORK';
            // Confidence of the class actually returned, not the maximum probability.
            let confidence = probabilities[status];

            // Deterministic escalation: a danger sign may only raise acuity, never lower it.
            if (criticalFlags.length > 0 && status !== 'RED') {
                status = 'RED';
                decisionSource = 'CLINICAL_OVERRIDE';
                confidence = 0.99; // a protocol rule, not a probabilistic estimate
            } else if (cautionFlags.length > 0 && status === 'GREEN') {
                status = 'YELLOW';
                decisionSource = 'CLINICAL_OVERRIDE';
                confidence = 0.95;
            }

            const { tier, action } = buildRecommendation(status, isHighRiskMaternal, isHighRiskChild);

            return {
                status,
                priority: PRIORITY_BY_STATUS[status],
                confidence: Math.round(confidence * 100) / 100,
                reasoning,
                recommendedFacilityTier: tier,
                recommendedAction: action,
                processingTime: Math.round(performance.now() - startTime),
                modelUsed: 'TensorFlow.js Neural Network (Primary Care)',
                probabilities: {
                    RED: Math.round(probabilities.RED * 100) / 100,
                    YELLOW: Math.round(probabilities.YELLOW * 100) / 100,
                    GREEN: Math.round(probabilities.GREEN * 100) / 100,
                },
                flagsDetected,
                decisionSource,
            };
        }
    } catch (err) {
        console.warn('[Triage] Inference failed — using IPHS rule engine:', err);
    }

    // ---- IPHS clinical rule engine (model unavailable or inference failed) ----
    const status: TriageStatus =
        criticalFlags.length > 0 ? 'RED' : cautionFlags.length > 0 ? 'YELLOW' : 'GREEN';

    const ruleProbabilities =
        status === 'RED'
            ? { RED: 0.97, YELLOW: 0.02, GREEN: 0.01 }
            : status === 'YELLOW'
            ? { RED: 0.02, YELLOW: 0.95, GREEN: 0.03 }
            : { RED: 0.01, YELLOW: 0.09, GREEN: 0.90 };

    const { tier, action } = buildRecommendation(status, isHighRiskMaternal, isHighRiskChild);

    return {
        status,
        priority: PRIORITY_BY_STATUS[status],
        confidence: ruleProbabilities[status],
        reasoning,
        recommendedFacilityTier: tier,
        recommendedAction: action,
        processingTime: Math.round(performance.now() - startTime),
        modelUsed: 'Clinical Rule Engine (IPHS Standard)',
        probabilities: ruleProbabilities,
        flagsDetected,
        decisionSource: 'RULE_ENGINE',
    };
}
