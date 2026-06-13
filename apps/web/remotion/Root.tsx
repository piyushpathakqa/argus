import { Composition } from 'remotion';
import { ArgusLoop } from './ArgusLoop';

export const RemotionRoot = () => (
  <Composition
    id="ArgusLoop"
    component={ArgusLoop}
    durationInFrames={540}
    fps={30}
    width={1920}
    height={1080}
  />
);
