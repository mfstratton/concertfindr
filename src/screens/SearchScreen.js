import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  SafeAreaView,
  ScrollView, // Use ScrollView for better handling on smaller screens
  KeyboardAvoidingView, // Helps prevent keyboard from covering inputs
  Platform // To check OS for KeyboardAvoidingView behavior
} from 'react-native';

const SearchScreen = ({ navigation }) => {
  // 1. State variables to hold user input
  const [location, setLocation] = useState('');
  const [bandName, setBandName] = useState('');
  // Store date as a string for now. Format YYYY-MM-DD is expected by ResultsScreen
  const [date, setDate] = useState('');

  // 2. Function to handle the search button press
  const handleSearch = () => {
    // Optional: Add validation here (e.g., check if at least one field is filled)
    // if (!location.trim() && !bandName.trim() && !date.trim()) {
    //   alert('Please enter at least one search criteria.');
    //   return;
    // }

    console.log('Navigating to Results with:', {
      location: location.trim(),
      bandName: bandName.trim(),
      date: date.trim()
    });

    // Navigate to ResultsScreen, passing state values as route params
    navigation.navigate('Results', {
      location: location.trim(), // Send trimmed values
      bandName: bandName.trim(),
      date: date.trim(),
    });
  };

  // 3. Render the UI elements
  return (
    <SafeAreaView style={styles.wrapper}>
       {/* KeyboardAvoidingView helps push content up when keyboard appears */}
       <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingContainer}
        >
        {/* ScrollView allows content to scroll if it exceeds screen height */}
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.container}>
            <Text style={styles.title}>Find Concerts</Text>

            {/* Location Input */}
            <Text style={styles.label}>Location (City)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Chicago"
              value={location}
              onChangeText={setLocation} // Updates state on text change
              returnKeyType="next" // Suggests 'next' button on keyboard
            />

            {/* Band Name Input */}
            <Text style={styles.label}>Band Name / Artist</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., LCD Soundsystem"
              value={bandName}
              onChangeText={setBandName}
              returnKeyType="next"
            />

            {/* Date Input */}
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional, e.g., 2025-12-01" // Specify format
              value={date}
              onChangeText={setDate}
              returnKeyType="search" // Suggests 'search' button on keyboard
              onSubmitEditing={handleSearch} // Optionally trigger search on keyboard submit
            />

            {/* Search Button */}
            <View style={styles.buttonContainer}>
              <Button
                title="Find Concerts"
                onPress={handleSearch} // Calls the search handler
                // disabled={!location.trim() && !bandName.trim() && !date.trim()} // Optionally disable button if no input
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// 4. Styling
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff', // Background for the safe area
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1, // Allows content to grow and enable scrolling
    justifyContent: 'center', // Center content vertically if it doesn't fill screen
  },
  container: {
    flex: 1, // Takes available space within ScrollView
    padding: 25, // Add some padding around the content
    justifyContent: 'center', // Center inputs vertically in the view
  },
  title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 30, // More space below title
  },
  label: {
    fontSize: 16,
    marginBottom: 8, // Space between label and input
    color: '#333',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f0f0f0', // Slightly different background for input
    borderWidth: 1,
    borderColor: '#ccc', // Lighter border
    borderRadius: 8, // More rounded corners
    paddingHorizontal: 15,
    paddingVertical: 12, // Slightly more vertical padding
    fontSize: 16,
    marginBottom: 20, // More space between input fields
  },
  buttonContainer: {
    marginTop: 15, // Space above the button
    // Optionally add styling like width or alignment
  },
});

export default SearchScreen;