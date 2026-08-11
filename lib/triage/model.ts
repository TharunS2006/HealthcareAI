/**
 * Edge AI Triage Engine — Powered by TensorFlow.js
 * Browser-native Neural Network classification with confidence scoring & reasoning
 */

import * as tf from '@tensorflow/tfjs';
import { Vitals, TriageStatus } from '@/types/patient';

export interface TriageResult {
    status: TriageStatus;
    confidence: number;
    reasoning: string;
    processingTime: number; // ms
    modelUsed: 'TensorFlow.js Neural Network' | 'Rule-based Engine (Fallback)';
    probabilities: { RED: number; YELLOW: number; GREEN: number };
}

let compiledModel: tf.LayersModel | null = null;

/**
 * Initialize and train a lightweight TensorFlow.js Neural Network in browser memory
 */
export async function loadTriageModel(): Promise<tf.LayersModel | null> {
    if (compiledModel) return compiledModel;

    try {
        // Architecture: 6 inputs -> 16 hidden (ReLU) -> 8 hidden (ReLU) -> 3 output (Softmax)
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [6] }));
        model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

        model.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy'],
        });

        // Generate synthetic triage training dataset (50 samples) for edge model initialization
        const xsList: number[][] = [];
        const ysList: number[][] = [];

        for (let i = 0; i < 60; i++) {
            const spo2 = 70 + Math.random() * 30; // 70-100
            const hr = 40 + Math.random() * 140; // 40-180
            const sys = 80 + Math.random() * 110; // 80-190
            const dia = 50 + Math.random() * 60; // 50-110
            const consciousness = Math.floor(Math.random() * 4); // 0:ALERT, 1:VOICE, 2:PAIN, 3:UNRESPONSIVE
            const injury = Math.random() > 0.6 ? 2 : Math.random() > 0.3 ? 1 : 0; // 0:minor, 1:mod, 2:critical

            // Compute ground truth labels
            let label = [0, 0, 1]; // GREEN
            if (spo2 < 90 || hr > 130 || hr < 50 || sys < 85 || consciousness >= 2 || injury === 2) {
                label = [1, 0, 0]; // RED
            } else if (spo2 < 95 || hr > 100 || sys < 100 || consciousness === 1 || injury === 1) {
                label = [0, 1, 0]; // YELLOW
            }

            xsList.push([spo2 / 100, hr / 200, sys / 200, dia / 120, consciousness / 3, injury / 2]);
            ysList.push(label);
        }

        const xs = tf.tensor2d(xsList);
        const ys = tf.tensor2d(ysList);

        await model.fit(xs, ys, { epochs: 15, batchSize: 16, verbose: 0 });
        xs.dispose();
        ys.dispose();

        compiledModel = model;
        console.log('[TF.js] Triage model initialized and loaded successfully');
        return compiledModel;
    } catch (err) {
        console.warn('[TF.js] Failed to load TF model, falling back to rule engine:', err);
        return null;
    }
}

/**
 * Classify patient triage status using TensorFlow.js with fallback to rule engine
 */
export async function classifyTriage(vitals: Vitals): Promise<TriageResult> {
    const startTime = performance.now();

    // Features extraction
    const spo2Norm = (vitals.spo2 || 95) / 100;
    const hrNorm = (vitals.heartRate || 80) / 200;
    const sysNorm = (vitals.bloodPressure?.systolic || 120) / 200;
    const diaNorm = (vitals.bloodPressure?.diastolic || 80) / 120;

    const consciousnessMap: Record<string, number> = { ALERT: 0, VOICE: 1, PAIN: 2, UNRESPONSIVE: 3 };
    const consciousnessNorm = (consciousnessMap[vitals.consciousness || 'ALERT'] || 0) / 3;

    const injurySeverity = isCriticalInjury(vitals.injuryType || '') ? 2 : isModerateInjury(vitals.injuryType || '') ? 1 : 0;
    const injuryNorm = injurySeverity / 2;

    const reasoningFactors: string[] = [];
    if (vitals.spo2 < 90) reasoningFactors.push(`Critical hypoxia (SpO2 ${vitals.spo2}%)`);
    else if (vitals.spo2 < 95) reasoningFactors.push(`Low oxygen saturation (SpO2 ${vitals.spo2}%)`);

    if (vitals.heartRate > 130 || vitals.heartRate < 50) reasoningFactors.push(`Abnormal pulse rate (${vitals.heartRate} bpm)`);
    if (vitals.consciousness && vitals.consciousness !== 'ALERT') reasoningFactors.push(`Altered consciousness level (${vitals.consciousness})`);
    if (vitals.injuryType) reasoningFactors.push(`Injury note: "${vitals.injuryType}"`);

    try {
        const model = await loadTriageModel();

        if (model) {
            const inputTensor = tf.tensor2d([[spo2Norm, hrNorm, sysNorm, diaNorm, consciousnessNorm, injuryNorm]]);
            const predictionTensor = model.predict(inputTensor) as tf.Tensor;
            const probsArray = await predictionTensor.data();

            inputTensor.dispose();
            predictionTensor.dispose();

            const redProb = probsArray[0];
            const yellowProb = probsArray[1];
            const greenProb = probsArray[2];

            let status: TriageStatus = 'GREEN';
            let confidence = greenProb;

            if (redProb >= yellowProb && redProb >= greenProb) {
                status = 'RED';
                confidence = redProb;
            } else if (yellowProb >= redProb && yellowProb >= greenProb) {
                status = 'YELLOW';
                confidence = yellowProb;
            }

            // Ensure absolute safety override for extreme physiological distress
            if (vitals.spo2 < 88 || vitals.consciousness === 'UNRESPONSIVE') {
                status = 'RED';
                confidence = Math.max(confidence, 0.96);
            }

            const reasoning = reasoningFactors.length > 0
                ? reasoningFactors.join('. ') + '.'
                : 'All physiological parameters within normal physiological bounds.';

            return {
                status,
                confidence: Math.round(confidence * 100) / 100,
                reasoning: `[TensorFlow.js NN] ${reasoning}`,
                processingTime: Math.round(performance.now() - startTime),
                modelUsed: 'TensorFlow.js Neural Network',
                probabilities: {
                    RED: Math.round(redProb * 100) / 100,
                    YELLOW: Math.round(yellowProb * 100) / 100,
                    GREEN: Math.round(greenProb * 100) / 100,
                },
            };
        }
    } catch (e) {
        console.warn('TF prediction error, using fallback:', e);
    }

    // Fallback rule engine
    return ruleBasedFallback(vitals, startTime, reasoningFactors);
}

function ruleBasedFallback(vitals: Vitals, startTime: number, factors: string[]): TriageResult {
    let status: TriageStatus = 'GREEN';
    let confidence = 0.92;

    if (vitals.spo2 < 90 || vitals.heartRate > 130 || vitals.heartRate < 45 || vitals.consciousness === 'UNRESPONSIVE' || isCriticalInjury(vitals.injuryType || '')) {
        status = 'RED';
        confidence = 0.95;
    } else if (vitals.spo2 < 95 || vitals.heartRate > 100 || vitals.consciousness === 'VOICE' || isModerateInjury(vitals.injuryType || '')) {
        status = 'YELLOW';
        confidence = 0.88;
    }

    return {
        status,
        confidence,
        reasoning: factors.length > 0 ? factors.join('. ') + '.' : 'Normal vitals.',
        processingTime: Math.round(performance.now() - startTime),
        modelUsed: 'Rule-based Engine (Fallback)',
        probabilities: {
            RED: status === 'RED' ? 0.95 : 0.05,
            YELLOW: status === 'YELLOW' ? 0.88 : 0.07,
            GREEN: status === 'GREEN' ? 0.92 : 0.08,
        },
    };
}

function isCriticalInjury(injuryType: string): boolean {
    const critical = ['head trauma', 'chest wound', 'abdominal injury', 'severe hemorrhage', 'cardiac arrest', 'stroke', 'spinal injury', 'amputation', 'gunshot', 'stab'];
    return critical.some(k => injuryType.toLowerCase().includes(k));
}

function isModerateInjury(injuryType: string): boolean {
    const moderate = ['fracture', 'burn', 'laceration', 'contusion', 'sprain', 'dislocation', 'bleeding'];
    return moderate.some(k => injuryType.toLowerCase().includes(k));
}
