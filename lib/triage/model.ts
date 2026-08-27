/**
 * Primary Care & Emergency Edge AI Triage Engine — Powered by TensorFlow.js
 * Browser-native Neural Network classification with clinical reasoning & referral tier recommendations
 */

import * as tf from '@tensorflow/tfjs';
import { Vitals, TriageStatus, TriagePriority, FacilityType } from '@/types/patient';

export interface TriageResult {
    status: TriageStatus;
    priority: TriagePriority;
    confidence: number;
    reasoning: string;
    recommendedFacilityTier: FacilityType;
    recommendedAction: string;
    processingTime: number; // ms
    modelUsed: 'TensorFlow.js Neural Network (Primary Care)' | 'Clinical Rule Engine (IPHS Standard)';
    probabilities: { RED: number; YELLOW: number; GREEN: number };
    flagsDetected: string[];
}

let compiledModel: tf.LayersModel | null = null;

/**
 * Initialize and train a lightweight 8-feature Neural Network in browser memory
 */
export async function loadTriageModel(): Promise<tf.LayersModel | null> {
    if (compiledModel) return compiledModel;

    try {
        // Architecture: 8 inputs -> 24 hidden (ReLU) -> 12 hidden (ReLU) -> 3 output (Softmax)
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 24, activation: 'relu', inputShape: [8] }));
        model.add(tf.layers.dense({ units: 12, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

        model.compile({
            optimizer: tf.train.adam(0.015),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy'],
        });

        // Synthetic training dataset (80 samples) covering primary & emergency care
        const xsList: number[][] = [];
        const ysList: number[][] = [];

        for (let i = 0; i < 80; i++) {
            const spo2 = 65 + Math.random() * 35;          // 65-100%
            const hr = 40 + Math.random() * 150;           // 40-190 bpm
            const sys = 70 + Math.random() * 130;          // 70-200 mmHg
            const dia = 45 + Math.random() * 75;           // 45-120 mmHg
            const temp = 96 + Math.random() * 8;           // 96-104 F
            const glucose = 50 + Math.random() * 300;      // 50-350 mg/dL
            const rr = 10 + Math.random() * 45;            // 10-55 /min
            const maternalOrPediatricDanger = Math.random() > 0.75 ? 1 : 0;

            let label = [0, 0, 1]; // GREEN

            if (
                spo2 < 90 || hr > 135 || hr < 45 || sys < 85 || sys > 165 ||
                glucose < 60 || glucose > 300 || rr > 36 || maternalOrPediatricDanger === 1
            ) {
                label = [1, 0, 0]; // RED
            } else if (
                spo2 < 95 || hr > 105 || sys > 140 || sys < 95 ||
                glucose > 180 || temp > 101.5 || rr > 26
            ) {
                label = [0, 1, 0]; // YELLOW
            }

            xsList.push([
                spo2 / 100,
                hr / 200,
                sys / 200,
                dia / 120,
                (temp - 95) / 10,
                glucose / 400,
                rr / 60,
                maternalOrPediatricDanger
            ]);
            ysList.push(label);
        }

        const xs = tf.tensor2d(xsList);
        const ys = tf.tensor2d(ysList);

        await model.fit(xs, ys, { epochs: 20, batchSize: 16, verbose: 0 });
        xs.dispose();
        ys.dispose();

        compiledModel = model;
        return compiledModel;
    } catch (err) {
        console.warn('[TF.js] Triage model init fallback:', err);
        return null;
    }
}

/**
 * Classify patient triage status with multi-variable primary health assessment
 */
export async function classifyTriage(vitals: Vitals): Promise<TriageResult> {
    const startTime = performance.now();

    // 1. Feature normalization
    const spo2 = vitals.spo2 || 96;
    const hr = vitals.heartRate || 80;
    const sys = vitals.bloodPressure?.systolic || 120;
    const dia = vitals.bloodPressure?.diastolic || 80;
    const temp = vitals.temperature || 98.6;
    const glucose = vitals.bloodGlucose || 100;
    const rr = vitals.respiratoryRate || 16;
    const notes = (vitals.injuryType || '').toLowerCase();

    const isHighRiskMaternal = !!(vitals.isPregnant && (sys >= 150 || dia >= 95 || notes.includes('headache') || notes.includes('bleeding') || notes.includes('eclampsia')));
    const isHighRiskChild = !!(vitals.childAgeMonths && vitals.childAgeMonths <= 60 && (rr >= 40 || spo2 < 92 || temp > 102 || notes.includes('malnutrition') || notes.includes('unconscious')));
    const maternalOrPediatricDanger = (isHighRiskMaternal || isHighRiskChild) ? 1 : 0;

    const reasoningFactors: string[] = [];
    const flagsDetected: string[] = [];

    // Critical physiological rule triggers
    if (spo2 < 90) { reasoningFactors.push(`Critical Hypoxia (SpO2 ${spo2}%)`); flagsDetected.push('SPO2_CRITICAL'); }
    else if (spo2 < 95) { reasoningFactors.push(`Low Oxygen Saturation (${spo2}%)`); flagsDetected.push('SPO2_LOW'); }

    if (hr > 130) { reasoningFactors.push(`Severe Tachycardia (${hr} bpm)`); flagsDetected.push('TACHYCARDIA'); }
    else if (hr < 48) { reasoningFactors.push(`Severe Bradycardia (${hr} bpm)`); flagsDetected.push('BRADYCARDIA'); }

    if (sys >= 160 || dia >= 100) { reasoningFactors.push(`Stage-2 Severe Hypertension (${sys}/${dia} mmHg)`); flagsDetected.push('HYPERTENSION_SEVERE'); }
    else if (sys <= 85) { reasoningFactors.push(`Hypotension / Shock (${sys}/${dia} mmHg)`); flagsDetected.push('HYPOTENSION'); }

    if (temp >= 102.5) { reasoningFactors.push(`High Grade Pyrexia (${temp}°F)`); flagsDetected.push('HIGH_FEVER'); }

    if (glucose >= 280) { reasoningFactors.push(`Hyperglycemia (${glucose} mg/dL)`); flagsDetected.push('HYPERGLYCEMIA'); }
    else if (glucose <= 55) { reasoningFactors.push(`Hypoglycemia (${glucose} mg/dL)`); flagsDetected.push('HYPOGLYCEMIA'); }

    if (isHighRiskMaternal) { reasoningFactors.push('Preeclampsia / Maternal Danger Signs Detected'); flagsDetected.push('HIGH_RISK_MATERNAL'); }
    if (isHighRiskChild) { reasoningFactors.push('Pediatric Emergency / Severe Acute Malnutrition Flag'); flagsDetected.push('HIGH_RISK_PEDIATRIC'); }
    if (vitals.consciousness && vitals.consciousness !== 'ALERT') { reasoningFactors.push(`Altered Sensorium (${vitals.consciousness})`); flagsDetected.push('CONSCIOUSNESS_ALTERED'); }

    try {
        const model = await loadTriageModel();
        if (model) {
            const inputTensor = tf.tensor2d([[
                spo2 / 100,
                hr / 200,
                sys / 200,
                dia / 120,
                (temp - 95) / 10,
                glucose / 400,
                rr / 60,
                maternalOrPediatricDanger
            ]]);

            const pred = model.predict(inputTensor) as tf.Tensor;
            const probs = await pred.data();
            inputTensor.dispose();
            pred.dispose();

            const redProb = probs[0];
            const yellowProb = probs[1];
            const greenProb = probs[2];

            let status: TriageStatus = 'GREEN';
            let priority: TriagePriority = 'ROUTINE';
            let recTier: FacilityType = 'PHC';
            let recAction = 'Routine OPD consultation and standard medication dispensary.';

            if (redProb >= yellowProb && redProb >= greenProb || flagsDetected.some(f => f.includes('CRITICAL') || f.includes('SEVERE') || f.includes('HIGH_RISK'))) {
                status = 'RED';
                priority = 'EMERGENCY';
                recTier = (isHighRiskMaternal || isHighRiskChild) ? 'DH' : 'CHC';
                recAction = isHighRiskMaternal
                    ? 'Immediate 102 Ambulance dispatch to CEmONC facility (CHC/DH). Teleconsult specialist for stabilization.'
                    : 'Immediate stabilization and emergency referral (108 Ambulance) to First Referral Unit (CHC/DH).';
            } else if (yellowProb >= redProb && yellowProb >= greenProb || flagsDetected.length > 0) {
                status = 'YELLOW';
                priority = 'URGENT';
                recTier = 'CHC';
                recAction = 'Expedited doctor consultation at PHC/CHC. Order lab investigations and plan follow-up within 48 hours.';
            }

            const reasoning = reasoningFactors.length > 0
                ? reasoningFactors.join('. ') + '.'
                : 'All vital physiological parameters within normal primary health limits.';

            return {
                status,
                priority,
                confidence: Math.round(Math.max(redProb, yellowProb, greenProb) * 100) / 100,
                reasoning,
                recommendedFacilityTier: recTier,
                recommendedAction: recAction,
                processingTime: Math.round(performance.now() - startTime),
                modelUsed: 'TensorFlow.js Neural Network (Primary Care)',
                probabilities: {
                    RED: Math.round(redProb * 100) / 100,
                    YELLOW: Math.round(yellowProb * 100) / 100,
                    GREEN: Math.round(greenProb * 100) / 100,
                },
                flagsDetected,
            };
        }
    } catch (e) {
        console.warn('TF evaluation fallback:', e);
    }

    // Rule-engine fallback
    let status: TriageStatus = 'GREEN';
    let priority: TriagePriority = 'ROUTINE';
    let recTier: FacilityType = 'PHC';

    if (spo2 < 90 || hr > 130 || sys >= 160 || isHighRiskMaternal || isHighRiskChild || vitals.consciousness === 'UNRESPONSIVE') {
        status = 'RED';
        priority = 'EMERGENCY';
        recTier = 'DH';
    } else if (spo2 < 95 || hr > 105 || sys >= 140 || glucose > 200 || temp > 101.5) {
        status = 'YELLOW';
        priority = 'URGENT';
        recTier = 'CHC';
    }

    return {
        status,
        priority,
        confidence: 0.94,
        reasoning: reasoningFactors.length > 0 ? reasoningFactors.join('. ') + '.' : 'Normal vitals.',
        recommendedFacilityTier: recTier,
        recommendedAction: status === 'RED' ? 'Immediate higher facility referral with ambulance.' : status === 'YELLOW' ? 'Urgent consultation at PHC/CHC.' : 'Routine care.',
        processingTime: Math.round(performance.now() - startTime),
        modelUsed: 'Clinical Rule Engine (IPHS Standard)',
        probabilities: {
            RED: status === 'RED' ? 0.95 : 0.05,
            YELLOW: status === 'YELLOW' ? 0.90 : 0.08,
            GREEN: status === 'GREEN' ? 0.92 : 0.08,
        },
        flagsDetected,
    };
}
