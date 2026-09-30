/**
 * The app's entry. The widget's handler is registered here, beside the app,
 * because Android can start it with no screen open: see src/widget/taskHandler.tsx.
 */
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/widget/taskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
