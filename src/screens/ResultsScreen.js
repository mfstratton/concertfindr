// src/screens/ResultsScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Button, Linking } from 'react-native';

// --- Configuration Import ---
// Import the key and URL from your config file
import { TICKETMASTER_API_KEY, TICKETMASTER_API_URL } from '../config/apiConfig'; // Adjust path if your file structure is different

// --- Component ---
const ResultsScreen = ({ route, navigation }) => {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { location, bandName, date } = route.params || {};

  useEffect(() => {
    const fetchConcerts = async () => {
      // Make sure we have an API key
      if (!TICKETMASTER_API_KEY || TICKETMASTER_API_KEY === 'YOUR_ACTUAL_TICKETMASTER_API_KEY') {
          setError('API Key missing or not configured in src/config/apiConfig.js');
          setIsLoading(false);
          return; // Stop execution if key is missing/default
      }

      setIsLoading(true);
      setError(null);
      setResults([]);

      let queryParams = `apikey=${TICKETMASTER_API_KEY}`; // <-- Use imported key
      if (bandName) {
        queryParams += `&keyword=${encodeURIComponent(bandName)}`;
      }
      if (location) {
        queryParams += `&city=${encodeURIComponent(location)}`;
      }
      if (date) {
        const startDate = `${date}T00:00:00Z`;
        queryParams += `&startDateTime=${startDate}`;
      }
      // queryParams += '&sort=date,asc'; // Optional: Sort results

      const fullUrl = `${TICKETMASTER_API_URL}?${queryParams}`; // <-- Use imported URL
      console.log('Fetching URL:', fullUrl);

      try {
        const response = await fetch(fullUrl);
        if (!response.ok) {
          const errorData = await response.json();
          // Try to get a meaningful error from Ticketmaster response
          const detail = errorData?.fault?.detail || errorData?.errors?.[0]?.detail || JSON.stringify(errorData);
          throw new Error(`API Error (${response.status}): ${detail}`);
        }
        const data = await response.json();

        const fetchedEvents = data._embedded?.events || [];
        setResults(fetchedEvents);
        console.log('Fetched Events:', fetchedEvents.length);

      } catch (err) {
        console.error("Fetch Error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have some search criteria or trigger explicitly
    if (location || bandName || date) {
        fetchConcerts();
    } else {
        setError("No search criteria provided.");
        setIsLoading(false);
    }

  }, [route.params]); // Dependency array remains the same

  // --- Render Logic ---
  const renderConcertItem = ({ item }) => {
    const venueInfo = item._embedded?.venues?.[0];
    const startDate = item.dates?.start?.localDate;
    const startTime = item.dates?.start?.localTime;
    const eventUrl = item.url; // URL for the event page on Ticketmaster

    // Function to safely open URLs
    const openUrl = async (url) => {
        if (!url) return;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            console.error(`Don't know how to open this URL: ${url}`);
            alert(`Cannot open URL. Please check link: ${url}`); // Provide feedback
        }
    };

    return (
      <View style={styles.itemContainer}>
        <Text style={styles.bandName}>{item.name}</Text>
        {venueInfo && <Text>{venueInfo.name} - {venueInfo.city?.name}</Text>}
        <Text>{startDate} {startTime ? `at ${startTime}` : ''}</Text>
        {eventUrl && (
            <Button title="View on Ticketmaster" onPress={() => openUrl(eventUrl)} />
        )}
         {/* Add other ticket seller links later if available in API/needed */}
      </View>
    );
  };

  // --- JSX Output ---
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Concert Results</Text>
      <Text style={styles.criteria}>
        Criteria: {bandName || 'Any Band'}, {location || 'Any Location'}, {date || 'Any Date'}
      </Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>Error: {error}</Text>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderConcertItem}
          keyExtractor={item => item.id}
          style={styles.list}
        />
      ) : (
        <Text style={styles.noResultsText}>No results found for your criteria.</Text> // Added style for clarity
      )}
    </View>
  );
};

// --- Styles --- (Ensure styles for errorText, loader, noResultsText, criteria exist)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
    },
    criteria: {
        textAlign: 'center',
        marginBottom: 15,
        fontStyle: 'italic',
        color: '#555',
    },
    loader: {
        marginTop: 50,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
        paddingHorizontal: 10, // Add some padding if error messages are long
    },
    noResultsText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
        color: '#555',
    },
    list: {
        marginTop: 10,
    },
    itemContainer: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        marginBottom: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#eee',
    },
    bandName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
});

export default ResultsScreen;