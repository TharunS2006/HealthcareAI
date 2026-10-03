/**
 * Voice Input Hook — Bhashini, with the browser's speech recognition as fallback
 * Parses spoken vitals input for field medics in English, Marathi and Hindi.
 *
 * Bhashini (the Government of India's National Language Translation Mission)
 * is used when the relay has it configured and the user is signed in to the
 * network: the voice note is recorded here and transcribed by Bhashini
 * (lib/bhashini/client.ts). Otherwise the browser's Web Speech API is used —
 * which, in Chrome, sends audio to Google's servers and needs a connection:
 * neither engine works offline, and the manual field always stays usable.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { bhashiniAvailable, startRecording, transcribe, type AppLanguage, type Recording } from '@/lib/bhashini/client';
import { useAuthStore } from '@/stores/authStore';

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
    /** Bhashini is turning the recording into text. */
    isTranscribing: boolean;
    /** Which engine the next recording uses. */
    engine: 'BHASHINI' | 'BROWSER' | null;
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

/**
 * Speech-to-text capture for form fields, via the browser's SpeechRecognition API.
 *
 * Intended for health workers entering vitals one-handed. Degrades to silence where
 * the API is unavailable, so a caller must always keep the manual input usable.
 */
export function useVoiceInput(): UseVoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [parsedVitals, setParsedVitals] = useState<VoiceParsedVitals>({});
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const recordingRef = useRef<Recording | null>(null);
    const languageRef = useRef<AppLanguage>('en');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [bhashini, setBhashini] = useState(false);
    const hasToken = useAuthStore(st => Boolean(st.session?.token));

    /**
     * Detected AFTER mount, never during render.
     *
     * `typeof window !== 'undefined' && 'SpeechRecognition' in window` evaluates false on
     * the server and true in the browser, so any `{isSupported && <button/>}` renders a
     * node the server HTML does not contain. React then fails hydration and throws away
     * the whole server tree to re-render on the client — an expensive full repaint on the
     * low-end rural hardware this app targets, and invisible in production builds.
     */
    const [isSupported, setIsSupported] = useState(false);

    const browserSupported = useRef(false);
    useEffect(() => {
        browserSupported.current = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
        let cancelled = false;
        const canRecord = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
        void (hasToken && canRecord ? bhashiniAvailable() : Promise.resolve(false)).then(ok => {
            if (cancelled) return;
            setBhashini(ok);
            setIsSupported(ok || browserSupported.current);
        });
        return () => { cancelled = true; };
    }, [hasToken]);

    const finishBhashini = useCallback(async () => {
        const recording = recordingRef.current;
        recordingRef.current = null;
        if (!recording) return;
        setIsListening(false);
        setIsTranscribing(true);
        try {
            const { audio, samplingRate, seconds } = await recording.stop();
            if (seconds < 0.5) throw new Error('The recording was too short — hold the button and speak');
            const text = await transcribe(audio, languageRef.current, samplingRate);
            setTranscript(text);
            setParsedVitals(parseVitals(text));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Bhashini could not transcribe the recording');
        } finally {
            setIsTranscribing(false);
        }
    }, []);

    const startListening = useCallback((lang = 'en-IN') => {
        const code: AppLanguage = lang.startsWith('mr') ? 'mr' : lang.startsWith('hi') ? 'hi' : 'en';
        if (bhashini) {
            setError(null);
            setTranscript('');
            setParsedVitals({});
            languageRef.current = code;
            void startRecording(() => void finishBhashini())
                .then(recording => {
                    recordingRef.current = recording;
                    setIsListening(true);
                })
                .catch(() => setError('Microphone permission was refused or no microphone is available'));
            return;
        }
        if (!browserSupported.current) {
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
    }, [bhashini, finishBhashini]);

    // Never leave the microphone open when the screen goes away.
    useEffect(() => () => recordingRef.current?.cancel(), []);

    const stopListening = useCallback(() => {
        if (recordingRef.current) {
            void finishBhashini();
            return;
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [finishBhashini]);

    return {
        isListening,
        isTranscribing,
        engine: !isSupported ? null : bhashini ? 'BHASHINI' : 'BROWSER',
        transcript,
        parsedVitals,
        startListening,
        stopListening,
        isSupported,
        error,
    };
}
