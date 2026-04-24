import 'react-native-gesture-handler';
import 'expo-dev-client';
import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated and will be removed in a future release.',
]);

// Load App only after startup warning filters are configured.
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
