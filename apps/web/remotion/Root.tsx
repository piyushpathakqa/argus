import { Composition } from 'remotion';
import { VigilisLoop } from './VigilisLoop';

export const RemotionRoot = () => (
  <Composition
    id="VigilisLoop"
    component={VigilisLoop}
    durationInFrames={675}
    fps={30}
    width={1920}
    height={1080}
  />
);
