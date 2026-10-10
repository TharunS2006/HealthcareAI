/**
 * Legacy compatibility adapter redirecting to Maharashtra Rural Healthcare Facilities
 * @module lib/data/hospitals
 */

export * from './facilities';
export { FACILITY_NETWORK as HOSPITALS } from './facilities';
export { getRecommendedFacility as getRecommendedHospital } from './facilities';
