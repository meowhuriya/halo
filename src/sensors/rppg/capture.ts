export interface VideoCaptureConfig {
  width: number;
  height: number;
  frameRate: number;
}

export const DEFAULT_CAPTURE_CONFIG: VideoCaptureConfig = {
  width: 640,
  height: 480,
  frameRate: 30,
};
