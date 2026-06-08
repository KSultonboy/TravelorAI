import { Platform } from 'react-native';

import type { ExploreMapProps } from './ExploreMap.types';

type ExploreMapComponent = (props: ExploreMapProps) => React.JSX.Element;

const ExploreMap =
  Platform.OS === 'web'
    ? (
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./ExploreMap.web').default as ExploreMapComponent
      )
    : (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          return require('./ExploreMap.native').default as ExploreMapComponent;
        } catch (error) {
          if (__DEV__) {
            console.warn('Native Yandex MapKit is not available in this runtime. Falling back to map placeholder.', error);
          }
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          return require('./ExploreMap.web').default as ExploreMapComponent;
        }
      })();

export default ExploreMap;
