// CBD Diary Native Services Types

// Notification Types
export interface NotificationOptions {
	title: string;
	body: string;
	iconPath?: string;
	id?: string;
	scheduled?: Date;
	category?: 'mood_reminder' | 'medication' | 'general';
}

// Database Types
export interface MoodEntry {
	id?: number;
	userId: string;
	mood: 'joy' | 'sadness' | 'anger' | 'fear' | 'shame' | 'surprise';
	intensity: number; // 1-10
	notes?: string;
	symptoms?: string[];
	cbdDose?: number;
	timestamp: string;
	tags?: string[];
}

export interface UserSettings {
	id?: number;
	userId: string;
	notificationEnabled: boolean;
	reminderTimes: string[]; // ['09:00', '18:00']
	privacyMode: boolean;
	biometricEnabled: boolean;
	darkMode: boolean;
	created_at?: string;
	updated_at?: string;
}

// Biometric Types
export interface BiometricOptions {
	reason?: string;
	subtitle?: string;
	description?: string;
	cancelTitle?: string;
	fallbackTitle?: string;
	allowDeviceCredential?: boolean;
	negativeText?: string;
}

export interface BiometricResult {
	success: boolean;
	error?: string | null;
	biometryType?:
		| 'none'
		| 'touchId'
		| 'faceId'
		| 'fingerprint'
		| 'voice'
		| 'iris';
}

// Secure Storage Types
export type SecureStorageKey =
	| 'security_settings'
	| 'api_tokens'
	| 'sync_data'
	| 'backup_data'
	| 'user_profile'
	| 'app_state';

export type SecureStorageValue =
	| Record<string, any>
	| string
	| number
	| boolean
	| null;

// HTTP Types
export interface HttpRequestOptions {
	url?: string;
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	body?: any;
	timeout?: number;
	responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
}

export interface HttpResponse<T = any> {
	data: T;
	status: number;
	statusText?: string;
	headers?: Record<string, string>;
	success?: boolean;
	error?: string;
	url?: string;
}

// Legacy API response types (for backwards compatibility)
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface SyncData {
	lastSyncTime: string;
	syncToken: string;
	conflicts: any[];
}

// Service Manager Types
export interface ServiceStatus {
	name: string;
	initialized: boolean;
	available: boolean;
	error?: string;
}

export interface ServiceConfig {
	autoInitialize: boolean;
	retryAttempts: number;
	timeout: number;
}

// Analytics Types
export interface AnalyticsData {
	moodTrends: {
		date: string;
		averageMood: number;
		entryCount: number;
	}[];
	cbdEffectiveness: {
		dose: number;
		effectiveScore: number;
		sampleSize: number;
	}[];
	symptomsFrequency: Record<string, number>;
}
