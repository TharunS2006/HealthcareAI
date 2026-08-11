/**
 * AES-256 encryption utilities for patient data
 * @module lib/crypto/encryption
 */

import CryptoJS from 'crypto-js';
import { logger } from '@/lib/logger';

// In production, this should be from environment variables or key management service
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'nalammesh-default-key-change-in-production';

/**
 * Encrypt data using AES-256
 * @param data - Data to encrypt
 * @returns Encrypted string
 */
export function encrypt(data: unknown): string {
    try {
        const jsonString = JSON.stringify(data);
        const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();

        logger.debug('Data encrypted', {
            originalSize: jsonString.length,
            encryptedSize: encrypted.length,
        });

        return encrypted;
    } catch (error) {
        logger.error('Encryption failed', { error });
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt AES-256 encrypted data
 * @param encryptedData - Encrypted string
 * @returns Decrypted and parsed data
 */
export function decrypt<T = unknown>(encryptedData: string): T {
    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        const jsonString = decrypted.toString(CryptoJS.enc.Utf8);

        if (!jsonString) {
            throw new Error('Decryption failed - invalid key or corrupted data');
        }

        const data = JSON.parse(jsonString);

        logger.debug('Data decrypted successfully');

        return data as T;
    } catch (error) {
        logger.error('Decryption failed', { error });
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Generate a secure random ID
 * @param length - Length of the ID
 * @returns Random hex string
 */
export function generateSecureId(length: number = 16): string {
    const randomWords = CryptoJS.lib.WordArray.random(length);
    return randomWords.toString(CryptoJS.enc.Hex);
}

/**
 * Hash data using SHA-256
 * @param data - Data to hash
 * @returns Hash string
 */
export function hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
}
