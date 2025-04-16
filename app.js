// App.js (Example using React Navigation Stack)

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import your screens
import HomeScreen from './src/screens/HomeScreen'; // Assuming you have a HomeScreen
import SearchScreen from './src/screens/SearchScreen'; // Assuming you have a SearchScreen
import ResultsScreen from './src/screens/ResultsScreen'; // <-- Import the new screen

const Stack = createNativeStackNavigator();

function App() {
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

        {/* Add the new Results Screen here */}
        <Stack.Screen
            name="Results" // This is the name you use to navigate to this screen
            component={ResultsScreen}
            options={{ title: 'Concert Results' }} // Sets the header title
         />

        {/* Add other screens like ConcertDetailScreen later */}

      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;