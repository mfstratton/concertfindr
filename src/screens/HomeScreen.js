// src/screens/HomeScreen.js

import React from 'react';
import { View, Text, Button, StyleSheet, SafeAreaView, Image } from 'react-native';

// Assuming navigation prop is passed by React Navigation Stack Navigator
const HomeScreen = ({ navigation }) => {

  const goToSearch = () => {
    navigation.navigate('Search'); // Navigate to the screen named 'Search' in your App.js navigator
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to ConcertFindr!</Text>
        {/* You could add a logo image here */}
        {/* <Image source={require('../assets/logo.png')} style={styles.logo} /> */}

        <Text style={styles.subtitle}>Ready to find your next live show?</Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Search for Concerts"
            onPress={goToSearch} // Calls the navigation function
          />
        </View>
        {/* You can add more content here later */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  subtitle: {
      fontSize: 18,
      textAlign: 'center',
      color: '#555',
      marginBottom: 40, // Add space before the button
  },
//   logo: { // Example style if you add an Image
//       width: 150,
//       height: 150,
//       resizeMode: 'contain',
//       marginBottom: 30,
//   },
  buttonContainer: {
    width: '80%', // Make button container take up most of the width
  },
});

export default HomeScreen;