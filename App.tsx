
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LivenessStatus, GyroData, Challenge, VerificationResult } from './types';
import { geminiService } from './services/geminiService';
import { GyroVisualizer } from './components/GyroVisualizer';

const CHALLENGES: Challenge[] = [
  { id: '1', instruction: 'Please tilt your phone UP slowly', expectedMovement: 'tilt_up' },
  { id: '2', instruction: 'Please tilt your phone DOWN slowly', expectedMovement: 'tilt_down' },
  { id: '3', instruction: 'Slowly rotate your phone to the LEFT', expectedMovement: 'rotate_left' },
  { id: '4', instruction: 'Slowly rotate your phone to the RIGHT', expectedMovement: 'rotate_right' },
];

const App: React.FC = () => {
  const [status, setStatus] = useState<LivenessStatus>(LivenessStatus.IDLE);
  const [gyro, setGyro] = useState<GyroData>({ alpha: 0, beta: 0, gamma: 0 });
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isGyroReady, setIsGyroReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gyroCleanupRef = useRef<(() => void) | null>(null);

  // Check if iOS Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  // Request Device Orientation Permission (iOS Safari requirement)
  const requestGyroPermission = async (): Promise<boolean> => {
    try {
      // Check if DeviceOrientationEvent.requestPermission exists (iOS 13+)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        return permission === 'granted';
      }
      // Android and older iOS don't require explicit permission
      return true;
    } catch (err) {
      console.error('Error requesting gyro permission:', err);
      return false;
    }
  };

  // Initialize Gyroscope/Orientation Sensor
  const initializeGyro = async () => {
    // Clean up existing listener if any
    if (gyroCleanupRef.current) {
      gyroCleanupRef.current();
      gyroCleanupRef.current = null;
    }

    const hasPermission = await requestGyroPermission();
    if (!hasPermission) {
      setError("Motion sensor access denied. Please allow motion sensor permissions to continue.");
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      setGyro({
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
      });
      setIsGyroReady(true);
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
      gyroCleanupRef.current = () => {
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    } else {
      setError("Device orientation not supported on this device.");
    }
  };

  // Initialize Camera
  const startCamera = async () => {
    try {
      // Adjust camera constraints for iOS compatibility
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      // For iOS, use more compatible constraints
      if (isIOS) {
        constraints.video = {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } as MediaTrackConstraints;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays on iOS
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        // For iOS, we need to play the video explicitly
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('Video play() failed:', playError);
        }
        setIsCameraReady(true);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Camera access denied. Please allow camera permissions to continue.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera found. Please ensure your device has a camera.");
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Initialize Sensors - only after user gesture (iOS requirement)
  useEffect(() => {
    // On iOS, we'll request permission when user clicks "Start Liveness Test"
    // For Android, we can initialize immediately if available
    if (!isIOS && window.DeviceOrientationEvent) {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        setGyro({
          alpha: event.alpha ?? 0,
          beta: event.beta ?? 0,
          gamma: event.gamma ?? 0,
        });
        setIsGyroReady(true);
      };
      window.addEventListener('deviceorientation', handleOrientation);
      gyroCleanupRef.current = () => {
        window.removeEventListener('deviceorientation', handleOrientation);
      };
      return () => {
        if (gyroCleanupRef.current) {
          gyroCleanupRef.current();
          gyroCleanupRef.current = null;
        }
      };
    }
  }, [isIOS]);

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Base64 only
  };

  const startVerification = async () => {
    setResult(null);
    setError(null);
    setStatus(LivenessStatus.INITIALIZING);
    
    // Pick random challenge
    const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setCurrentChallenge(challenge);
    setStatus(LivenessStatus.CHALLENGE_REQUESTED);

    // Wait for user to perform action (simulated delay for user engagement)
    setTimeout(async () => {
      setStatus(LivenessStatus.VERIFYING);
      const frame = captureFrame();
      if (!frame) {
        setError("Failed to capture camera frame.");
        setStatus(LivenessStatus.IDLE);
        return;
      }

      try {
        const verification = await geminiService.verifyLiveness(frame, gyro, challenge);
        setResult(verification);
        setStatus(verification.isLive ? LivenessStatus.SUCCESS : LivenessStatus.FAILED);
      } catch (err) {
        setError("Verification service unavailable. Check your internet connection.");
        setStatus(LivenessStatus.IDLE);
      }
    }, 4000); // 4 seconds for the user to react
  };

  const reset = () => {
    setStatus(LivenessStatus.IDLE);
    setResult(null);
    setCurrentChallenge(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-lg mb-8 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent mb-2">
          AINU Liveness Pro
        </h1>
        <p className="text-gray-400 text-sm">AI-Powered Identity Verification System</p>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
        {/* Camera Feed */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-opacity duration-1000 ${isCameraReady ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        
        {/* Overlay Layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Scanning Effect */}
          {status === LivenessStatus.VERIFYING && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent h-20 w-full animate-scan" />
          )}

          {/* Guide Mask */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-80 border-2 border-white/20 rounded-[4rem] border-dashed" />
          </div>

          {/* Sensor Widget */}
          <div className="absolute bottom-6 left-6 right-6">
            <GyroVisualizer data={gyro} />
          </div>
          
          {/* Instructions Widget */}
          {status !== LivenessStatus.IDLE && status !== LivenessStatus.SUCCESS && status !== LivenessStatus.FAILED && (
            <div className="absolute top-8 left-6 right-6 bg-blue-600/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-blue-400/30 transform transition-all animate-bounce-short">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <i className="fas fa-fingerprint text-white"></i>
                </div>
                <div>
                  <p className="text-xs text-blue-100 uppercase font-bold tracking-widest">Action Required</p>
                  <p className="text-white font-semibold">{currentChallenge?.instruction || 'Initializing...'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Canvas for captures */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* State Transitions Overlays */}
        {status === LivenessStatus.IDLE && !isCameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm z-20 px-8 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
              <i className="fas fa-camera text-blue-500 text-2xl"></i>
            </div>
            <h2 className="text-xl font-semibold mb-4 text-white">Secure Identity Check</h2>
            <p className="text-gray-400 text-sm mb-8">
              We need access to your camera and motion sensors to verify that you are a real person.
            </p>
            <button 
              onClick={async () => {
                // Request both camera and gyro permissions
                await initializeGyro();
                await startCamera();
              }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95"
            >
              Start Liveness Test
            </button>
          </div>
        )}

        {status === LivenessStatus.SUCCESS && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/90 backdrop-blur-sm z-30 px-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl animate-scale-in">
              <i className="fas fa-check text-emerald-500 text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verified Successfully</h2>
            <p className="text-emerald-50 text-sm mb-2 opacity-90">Liveness Confirmed</p>
            <div className="bg-white/10 p-3 rounded-xl mb-8">
              <p className="text-xs text-emerald-100 italic">"{result?.reasoning}"</p>
            </div>
            <button 
              onClick={reset}
              className="w-full py-3 bg-white text-emerald-600 font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              Finish
            </button>
          </div>
        )}

        {status === LivenessStatus.FAILED && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-500/90 backdrop-blur-sm z-30 px-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
              <i className="fas fa-times text-rose-500 text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-rose-50 text-sm mb-8">Potential spoofing detected or movement mismatch.</p>
            <button 
              onClick={reset}
              className="w-full py-3 bg-white text-rose-600 font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-full max-w-md mt-6 space-y-4">
        {isCameraReady && isGyroReady && status === LivenessStatus.IDLE && (
          <button 
            onClick={startVerification}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3"
          >
            <i className="fas fa-shield-alt"></i>
            Run Liveness Check
          </button>
        )}
        
        {isCameraReady && !isGyroReady && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
            <i className="fas fa-exclamation-triangle text-yellow-500"></i>
            <p className="text-yellow-400 text-xs font-medium">
              Motion sensors not ready. Please ensure you've granted motion sensor permissions.
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3">
            <i className="fas fa-exclamation-circle text-rose-500"></i>
            <p className="text-rose-400 text-xs font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Session ID</p>
            <p className="text-xs font-mono text-gray-300">#AX-992384</p>
          </div>
          <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">AI Engine</p>
            <p className="text-xs text-blue-400 font-bold">Gemini 3 Pro</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-short {
          animation: bounce-short 2s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-scale-in {
          animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default App;
