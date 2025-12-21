
import { GoogleGenAI, Type } from "@google/genai";
import { GyroData, Challenge, VerificationResult } from "../types";

export class GeminiLivenessService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  }

  async verifyLiveness(
    base64Image: string,
    gyroData: GyroData,
    challenge: Challenge
  ): Promise<VerificationResult> {
    const prompt = `
      Perform liveness detection.
      
      User Challenge: ${challenge.instruction}
      Target Motion: ${challenge.expectedMovement}
      
      Current Device Sensor Data (Gyroscope):
      - Alpha (Z-axis): ${gyroData.alpha?.toFixed(2) ?? 'N/A'}
      - Beta (X-axis/Tilt): ${gyroData.beta?.toFixed(2) ?? 'N/A'}
      - Gamma (Y-axis/Roll): ${gyroData.gamma?.toFixed(2) ?? 'N/A'}

      Analyze the provided image and the sensor data. 
      Determine if the visual movement in the image matches the physical motion suggested by the gyroscope.
      A live person will show depth, natural movement, and synchronization with the device sensors.
      A static photo or a screen re-broadcast will lack depth or have mismatched sensor data.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isLive: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ['isLive', 'confidence', 'reasoning']
          }
        }
      });

      return JSON.parse(response.text || '{}') as VerificationResult;
    } catch (error) {
      console.error('Liveness verification failed:', error);
      throw error;
    }
  }
}

export const geminiService = new GeminiLivenessService();
