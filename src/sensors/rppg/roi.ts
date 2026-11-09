export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FaceRois {
  forehead: LandmarkPoint[];
  leftCheek: LandmarkPoint[];
  rightCheek: LandmarkPoint[];
}
