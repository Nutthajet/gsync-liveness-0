
export interface GyroData {
  alpha: number | null; // Rotation around z-axis
  beta: number | null;  // Rotation around x-axis
  gamma: number | null; // Rotation around y-axis
}

export enum LivenessStatus {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  CHALLENGE_REQUESTED = 'CHALLENGE_REQUESTED',
  RECORDING = 'RECORDING',
  VERIFYING = 'VERIFYING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface Challenge {
  instruction: string;
  expectedMovement: 'tilt_up' | 'tilt_down' | 'rotate_left' | 'rotate_right' | 'steady';
  id: string;
}

export interface VerificationResult {
  isLive: boolean;
  confidence: number;
  reasoning: string;
}
