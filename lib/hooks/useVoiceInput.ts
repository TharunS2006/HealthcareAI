/**
 * Voice Input Hook — Web Speech API (Multilingual Support)
 * Parses spoken vitals input for field medics in English, Marathi (mr-IN), and Hindi (hi-IN)
 * Works OFFLINE on Android Chrome (built into browser)
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
    startListening: (lang?: string) => void;
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
    for (const [word, num] of Object.entries(wordMap)) {
        result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), num);
    }

    result = result.replace(/(\d0)\s+(\d)(?!\d)/g, (_, tens, ones) => {
        return String(parseInt(tens) + parseInt(ones));
    });

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

    // SpO2 patterns
    const spo2Match = normalized.match(/(?:spo2|sp\s*o2|oxygen|saturation|o2)\s*(?:is\s*)?(\d{2,3})/i);
    if (spo2Match) {
        const val = parseInt(spo2Match[1]);
        if (val >= 50 && val <= 100) parsed.spo2 = val;
    }

    // Heart Rate patterns
    const hrMatch = normalized.match(/(?:heart\s*rate|pulse|hr|bpm|heartbeat)\s*(?:is\s*)?(\d{2,3})/i);
    if (hrMatch) {
        const val = parseInt(hrMatch[1]);
        if (val >= 20 && val <= 250) parsed.heartRate = val;
    }

    // Blood Pressure
    const bpMatch = normalized.match(/(?:bp|blood\s*pressure)\s*(?:is\s*)?(\d{2,3})\s*(?:over|\/|by)\s*(\d{2,3})/i);
    if (bpMatch) {
        parsed.systolic = parseInt(bpMatch[1]);
        parsed.diastolic = parseInt(bpMatch[2]);
    }

    // Consciousness
    if (/unresponsive|unconscious|not responding/i.test(normalized)) {
        parsed.consciousness = 'UNRESPONSIVE';
    } else if (/responds?\s*(?:to\s*)?pain|pain\s*response/i.test(normalized)) {
        parsed.consciousness = 'PAIN';
    } else if (/responds?\s*(?:to\s*)?voice|voice\s*response/i.test(normalized)) {
        parsed.consciousness = 'VOICE';
    } else if (/\balert\b|conscious\b|awake\b/i.test(normalized)) {
        parsed.consciousness = 'ALERT';
    }

    // Injury / complaints
    parsed.injuryType = transcript.trim();

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

    const startListening = useCallback((lang = 'en-IN') => {
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
        recognition.lang = lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';

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
