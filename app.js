// App.js (Example using React Navigation Stack)

import React from 'react'; // Removed useEffect as it was only for the Sentry test
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import your screens
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ResultsScreen from './src/screens/ResultsScreen';

// --- Sentry code completely removed ---

const Stack = createNativeStackNavigator();

function App() {
  // --- Sentry test hook removed ---

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        {/* Define your existing screens */}
        <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'ConcertFindr Home' }}
        />
        <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ title: 'Find Concerts' }}
        />
        <Stack.Screen
            name="Results"
            component={ResultsScreen}
            options={{ title: 'Concert Results' }}
         />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

