/**
 * Voice Input Hook — Web Speech API
 * Parses spoken vitals input for field medics
 * Works OFFLINE on Android Chrome (built into browser)
 * 
 * Usage: "SpO2 ninety two, heart rate one twenty, head trauma"
 * → Parses to: { spo2: 92, heartRate: 120, injuryType: "head trauma" }
 */

'use client';

import { useState, useCallback, useRef } from 'react';

interface VoiceParsedVitals {
    spo2?: number;
    heartRate?: number;
    systolic?: number;
    diastolic?: number;
    injuryType?: string;
    consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
}

interface UseVoiceInputReturn {
    isListening: boolean;
    transcript: string;
    parsedVitals: VoiceParsedVitals;
    startListening: () => void;
    stopListening: () => void;
    isSupported: boolean;
    error: string | null;
}

/**
 * Convert spoken number words to digits
 */
function wordToNumber(text: string): string {
    const wordMap: Record<string, string> = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
        'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
        'eighty': '80', 'ninety': '90', 'hundred': '100',
    };

    let result = text.toLowerCase();
    // Handle "ninety two" → "92"
    for (const [word, num] of Object.entries(wordMap)) {
        result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), num);
    }

    // Handle compound: "90 2" → "92"
    result = result.replace(/(\d0)\s+(\d)(?!\d)/g, (_, tens, ones) => {
        return String(parseInt(tens) + parseInt(ones));
    });

    // Handle "1 100 20" → "120"
    result = result.replace(/(\d)\s+100\s*/g, (_, prefix) => {
        return String(parseInt(prefix) * 100);
    });

    return result;
}

/**
 * Parse transcript for vital signs
 */
function parseVitals(transcript: string): VoiceParsedVitals {
    const parsed: VoiceParsedVitals = {};
    const normalized = wordToNumber(transcript.toLowerCase());

    // SpO2 patterns: "spo2 92", "oxygen 92", "saturation 92", "sp o2 92"
    const spo2Match = normalized.match(/(?:spo2|sp\s*o2|oxygen|saturation|o2)\s*(?:is\s*)?(\d{2,3})/i);
    if (spo2Match) {
        const val = parseInt(spo2Match[1]);
        if (val >= 50 && val <= 100) parsed.spo2 = val;
    }

    // Heart Rate patterns: "heart rate 120", "pulse 120", "hr 120", "bpm 120"
    const hrMatch = normalized.match(/(?:heart\s*rate|pulse|hr|bpm|heartbeat)\s*(?:is\s*)?(\d{2,3})/i);
    if (hrMatch) {
        const val = parseInt(hrMatch[1]);
        if (val >= 20 && val <= 250) parsed.heartRate = val;
    }

    // Blood Pressure: "bp 120 over 80", "blood pressure 120/80"
    const bpMatch = normalized.match(/(?:bp|blood\s*pressure)\s*(?:is\s*)?(\d{2,3})\s*(?:over|\/|by)\s*(\d{2,3})/i);
    if (bpMatch) {
        parsed.systolic = parseInt(bpMatch[1]);
        parsed.diastolic = parseInt(bpMatch[2]);
    }

    // Consciousness: "unresponsive", "alert", "responds to pain", "responds to voice"
    if (/unresponsive|unconscious|not responding/i.test(normalized)) {
        parsed.consciousness = 'UNRESPONSIVE';
    } else if (/responds?\s*(?:to\s*)?pain|pain\s*response/i.test(normalized)) {
        parsed.consciousness = 'PAIN';
    } else if (/responds?\s*(?:to\s*)?voice|voice\s*response/i.test(normalized)) {
        parsed.consciousness = 'VOICE';
    } else if (/\balert\b|conscious\b|awake\b/i.test(normalized)) {
        parsed.consciousness = 'ALERT';
    }

    // Injury type: anything after injury-related keywords
    const injuryPatterns = [
        /(?:injury|trauma|wound|fracture|burn|laceration|bleeding|hemorrhage|chest|head|abdominal|spinal)[\w\s]*/i,
    ];
    for (const pattern of injuryPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            parsed.injuryType = match[0].trim();
            break;
        }
    }

    return parsed;
}

export function useVoiceInput(): UseVoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [parsedVitals, setParsedVitals] = useState<VoiceParsedVitals>({});
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const startListening = useCallback(() => {
        if (!isSupported) {
            setError('Speech recognition not supported in this browser');
            return;
        }

        setError(null);
        setTranscript('');
        setParsedVitals({});

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English for better recognition

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const fullTranscript = finalTranscript || interimTranscript;
            setTranscript(fullTranscript);

            // Parse vitals from the transcript
            if (finalTranscript) {
                const vitals = parseVitals(finalTranscript);
                setParsedVitals(vitals);
            }
        };

        recognition.onerror = (event: any) => {
            setError(`Recognition error: ${event.error}`);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [isSupported]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, []);

    return {
        isListening,
        transcript,
        parsedVitals,
        startListening,
        stopListening,
        isSupported,
        error,
    };
}
