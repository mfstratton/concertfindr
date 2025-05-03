import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Button,
    TextInput,
    Alert,
    Platform,
    TouchableOpacity,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    ActivityIndicator,
    Linking,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from 'sentry-expo'; // Import Sentry

// Access API keys from environment variables
const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const ticketmasterApiKey = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;

// Define interface for Mapbox Suggestion
interface MapboxSuggestion {
    name: string;
    mapbox_id: string;
    feature_type: string;
    address?: string;
    full_address?: string;
    place_formatted?: string;
    context?: {
        country?: { id: string; name: string; country_code: string; country_code_alpha_3: string };
        region?: { id: string; name: string; region_code?: string; region_code_full?: string };
        district?: { id: string; name: string };
    };
    language?: string;
    maki?: string;
    metadata?: any;
}

// Define interface for cached coordinates
interface Coordinates {
    lat: number;
    lng: number;
}

// Define interface for Mapbox Retrieve Response (GeoJSON FeatureCollection)
interface MapboxRetrieveResponse {
    type: "FeatureCollection";
    features: {
        type: "Feature";
        geometry: {
            type: "Point";
            coordinates: [number, number]; // [longitude, latitude]
        };
        properties: any;
    }[];
    attribution: string;
}


export default function IndexScreen() {
    // --- State ---
    const [city, setCity] = useState('');
    const [selectedMapboxId, setSelectedMapboxId] = useState<string | null>(null);
    const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isCityLoading, setIsCityLoading] = useState(false);
    const [concerts, setConcerts] = useState<any[]>([]);
    const [isConcertLoading, setIsConcertLoading] = useState(false);
    const [concertError, setConcertError] = useState<string | null>(null);
    const [searchAttempted, setSearchAttempted] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    // --- Refs ---
    const interactionStarted = useRef(false);
    const coordCache = useRef<Record<string, Coordinates>>({});

    // Generate session token on mount
    useEffect(() => {
        setSessionToken(uuidv4());
    }, []);


    // --- Helper Functions ---
    const formatSuggestionText = (suggestion: MapboxSuggestion | undefined): string => {
        if (!suggestion) return '';
        const name = suggestion.name;
        const regionCode = suggestion.context?.region?.region_code;
        return regionCode ? `${name}, ${regionCode}` : name;
    };
    const formatDate = (date: Date | null): string => { if (!date) return 'Select Date'; return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    const formatTimeAmPm = (timeString: string | undefined): string => { if (!timeString) return ''; const timeStringParts = timeString.split(':'); if (timeStringParts.length < 2) return timeString; const hours24 = parseInt(timeStringParts[0], 10); const minutes = timeStringParts[1]; if (isNaN(hours24)) return timeString; const ampm = hours24 >= 12 ? 'PM' : 'AM'; let hours12 = hours24 % 12; if (hours12 === 0) { hours12 = 12; } return `${hours12}:${minutes} ${ampm}`; };
    const toLocalDateString = (date: Date): string => {
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 10);
    };

    // --- Debounced Fetch for Mapbox Autocomplete with Sentry ---
    const fetchCitySuggestions = async (text: string) => {
        const currentSessionToken = sessionToken; // Capture current session token

        // Log attempt to Sentry
        Sentry.captureMessage(`Mapbox suggest API call initiated for query: "${text}". Token present: ${!!mapboxAccessToken}. Session: ${currentSessionToken}`);
        console.log(`Mapbox suggest API call initiated. Token present: ${!!mapboxAccessToken}. Session: ${currentSessionToken}`);

        if (!mapboxAccessToken) { console.warn("Mapbox Access Token missing."); setIsCityLoading(false); return; }
        if (!currentSessionToken) { console.warn("Mapbox session token not ready."); setIsCityLoading(false); return; }
        if (text.length <= 2) { setSuggestions([]); setShowSuggestions(false); setIsCityLoading(false); return; }

        setIsCityLoading(true);
        const types = 'locality,place';
        const country = 'US';
        const language = 'en';
        const limit = 5;
        const apiUrl = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(text)}&language=${language}&limit=${limit}&types=${types}&country=${country}&session_token=${currentSessionToken}&access_token=${mapboxAccessToken}`;

        // --- Wrap API Call in try...catch ---
        try {
            const response = await fetch(apiUrl);

            // Explicitly check for non-OK HTTP status codes
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = 'Could not parse error response body.';
                }
                const errorDetails = `Mapbox Suggest HTTP Error ${response.status}: ${JSON.stringify(errorData)}`;
                console.error(errorDetails); // Log locally
                throw new Error(errorDetails); // Throw error to trigger the catch block
            }

            const data = await response.json();

            // Log successful response structure to Sentry (optional)
            Sentry.captureMessage(`Mapbox suggest API success. Response keys: ${Object.keys(data)}`);
            console.log('Mapbox Suggest Success Response:', data); // Log locally

            if (data.suggestions) {
                setSuggestions(data.suggestions);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
                console.log("Mapbox Suggest returned OK but no suggestions field:", data);
            }
        } catch (error: any) {
            // --- This block runs if any error occurred in the try block ---
            console.error("Error during Mapbox Suggest API call:", error); // Log the full error locally

            // **** SEND THE ERROR TO SENTRY ****
            Sentry.captureException(error);

            // --- Handle the error in the UI ---
            setSuggestions([]);
            setShowSuggestions(false);
            // Optionally: setErrorMessage("Failed to load suggestions.");
        } finally {
            setIsCityLoading(false);
        }
        // --- End of try...catch block ---
    };

    // Debounce is active
    const debouncedFetchSuggestions = useCallback(debounce(fetchCitySuggestions, 300), [mapboxAccessToken, sessionToken]); // Include sessionToken dependency

    // --- Handlers ---
    const handleCityChange = (text: string) => {
        setCity(text);
        setSelectedMapboxId(null);
        setSelectedCityName(null);
        if (!interactionStarted.current && text.length > 0) {
            interactionStarted.current = true;
            if (!sessionToken) setSessionToken(uuidv4());
        }
        if (text.length > 2) {
            setIsCityLoading(true);
            setShowSuggestions(false);
            debouncedFetchSuggestions(text);
        } else {
            debouncedFetchSuggestions.cancel();
            setIsCityLoading(false);
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const onSuggestionPress = (suggestion: MapboxSuggestion) => {
        const mapboxId = suggestion.mapbox_id;
        const primaryName = suggestion.name;
        const displayValue = formatSuggestionText(suggestion);

        setCity(displayValue);
        setSelectedMapboxId(mapboxId);
        setSelectedCityName(primaryName);
        setSuggestions([]);
        setShowSuggestions(false);
        Keyboard.dismiss();
        interactionStarted.current = false;
        setSessionToken(uuidv4()); // Reset session token after selection
    };


    const handleClearCity = () => {
        debouncedFetchSuggestions.cancel();
        setCity('');
        setSelectedMapboxId(null);
        setSelectedCityName(null);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsCityLoading(false);
        interactionStarted.current = false;
        setSessionToken(uuidv4()); // Reset session token on clear
    };
    const onChangeStartDate = (event: DateTimePickerEvent, selectedDate?: Date) => { if (Platform.OS === 'android') { setShowStartDatePicker(false); } if (event.type === 'set' && selectedDate) { setStartDate(selectedDate); } if (Platform.OS === 'ios' && event.type !== 'set') { setShowStartDatePicker(false); } };
    const onChangeEndDate = (event: DateTimePickerEvent, selectedDate?: Date) => { if (Platform.OS === 'android') { setShowEndDatePicker(false); } if (event.type === 'set' && selectedDate) { setEndDate(selectedDate); if (startDate && selectedDate < startDate) { Alert.alert("Invalid Range", "End date cannot be before start date."); setEndDate(null); } } if (Platform.OS === 'ios' && event.type !== 'set') { setShowEndDatePicker(false); } };
    const showStartDatepicker = () => { setShowStartDatePicker(true); setShowSuggestions(false); Keyboard.dismiss(); };
    const showEndDatepicker = () => { setShowEndDatePicker(true); setShowSuggestions(false); Keyboard.dismiss(); };

    // --- Ticketmaster Search Function (Includes Caching and Sentry) ---
    const handleConcertSearch = async () => {
        setSearchAttempted(true); Keyboard.dismiss(); setShowSuggestions(false); debouncedFetchSuggestions.cancel();
        if (!selectedMapboxId || !startDate || !endDate) { Alert.alert("Validation Error", "Please select a city from suggestions and both dates."); return; }
        if (!ticketmasterApiKey || !mapboxAccessToken) { Alert.alert("API Key Error", "API keys not loaded."); Sentry.captureMessage("API Key Error during concert search"); return; }
        const currentSessionToken = sessionToken; // Capture current session token
        if (!currentSessionToken) { Alert.alert("Error", "Session token missing."); Sentry.captureMessage("Session token missing during concert search"); return; }

        setIsConcertLoading(true); setConcertError(null); setConcerts([]);
        const userStartDateString = toLocalDateString(startDate);
        const userEndDateString = toLocalDateString(endDate);
        console.log(`User Selected Range: ${userStartDateString} to ${userEndDateString}`);

        let lat: number | undefined;
        let lng: number | undefined;

        // --- Wrap entire search logic in try...catch ---
        try {
            // --- Step A: Get Coordinates (Cache or Mapbox Retrieve) ---
            if (coordCache.current[selectedMapboxId]) {
                console.log("Using cached coordinates for Mapbox ID:", selectedMapboxId);
                Sentry.captureMessage(`Using cached coordinates for Mapbox ID: ${selectedMapboxId}`);
                const cachedCoords = coordCache.current[selectedMapboxId];
                lat = cachedCoords.lat;
                lng = cachedCoords.lng;
            } else {
                console.log("Coordinates not cached, fetching from Mapbox Retrieve API for ID:", selectedMapboxId);
                Sentry.captureMessage(`Fetching coordinates from Mapbox Retrieve API for ID: ${selectedMapboxId}. Session: ${currentSessionToken}`);
                const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${selectedMapboxId}?session_token=${currentSessionToken}&access_token=${mapboxAccessToken}`;
                console.log("Requesting Mapbox Retrieve URL:", retrieveUrl);

                const retrieveResponse = await fetch(retrieveUrl);

                if (!retrieveResponse.ok) {
                    let errorData; try { errorData = await retrieveResponse.json(); } catch (e) { errorData = 'Could not parse error response body.'}
                    const errorDetails = `Mapbox Retrieve HTTP Error ${retrieveResponse.status}: ${JSON.stringify(errorData)}`;
                    console.error(errorDetails);
                    throw new Error(errorDetails); // Throw to trigger catch
                }

                const retrieveData: MapboxRetrieveResponse = await retrieveResponse.json();
                const coordinates = retrieveData?.features?.[0]?.geometry?.coordinates;
                lng = coordinates?.[0]; // Longitude first
                lat = coordinates?.[1]; // Latitude second

                if (lat === undefined || lng === undefined) {
                    console.error("Mapbox Retrieve Response Missing Coordinates:", retrieveData);
                    throw new Error('Could not extract coordinates from Mapbox retrieve response.');
                }

                console.log(`Coordinates found: Lat ${lat}, Lng ${lng}. Storing in cache.`);
                Sentry.captureMessage(`Mapbox Retrieve success for ID: ${selectedMapboxId}. Coords: ${lat}, ${lng}`);
                coordCache.current[selectedMapboxId] = { lat, lng };
            }

            // --- Step B: Ticketmaster Call ---
            const radius = 30; const unit = "miles";
            const apiStartDateTime = startDate.toISOString().slice(0, 10) + 'T00:00:00Z';
            const dayAfterEndDate = new Date(endDate);
            dayAfterEndDate.setDate(dayAfterEndDate.getDate() + 1);
            const apiEndDateTime = dayAfterEndDate.toISOString().slice(0, 10) + 'T23:59:59Z';
            const ticketmasterApiUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${ticketmasterApiKey}&latlong=${lat},${lng}&radius=${radius}&unit=${unit}&startDateTime=${apiStartDateTime}&endDateTime=${apiEndDateTime}&sort=date,asc&classificationName=Music&size=100`;

            console.log("Requesting Ticketmaster URL:", ticketmasterApiUrl);
            Sentry.captureMessage(`Requesting Ticketmaster API. Lat: ${lat}, Lng: ${lng}`);
            const tmResponse = await fetch(ticketmasterApiUrl);

            if (!tmResponse.ok) {
                let errorMsg = `Ticketmaster API error! Status: ${tmResponse.status}`;
                try { const errorData = await tmResponse.json(); errorMsg += `: ${errorData?.fault?.faultstring || errorData?.errors?.[0]?.detail || 'Unknown TM error'}`; } catch (e) {}
                console.error(errorMsg);
                throw new Error(errorMsg); // Throw to trigger catch
            }

            const tmData = await tmResponse.json();
            Sentry.captureMessage(`Ticketmaster API success. Found ${tmData?._embedded?.events?.length ?? 0} raw events.`);

            let fetchedEvents: any[] = [];
            if (tmData._embedded && tmData._embedded.events) { fetchedEvents = tmData._embedded.events; }
            const filteredEvents = fetchedEvents.filter(event => { const eventLocalDate = event.dates?.start?.localDate; return eventLocalDate && eventLocalDate >= userStartDateString && eventLocalDate <= userEndDateString; });
            setConcerts(filteredEvents);

        } catch (err: any) {
            console.error("--- ERROR DURING SEARCH ---");
            console.error("Error Name:", err.name);
            console.error("Error Message:", err.message);
            Sentry.captureException(err); // Send the error to Sentry
            setConcertError(`Search failed. Please check inputs or try again later.`); // User-friendly message
        } finally {
            setIsConcertLoading(false);
            interactionStarted.current = false; // Reset interaction flag
            setSessionToken(uuidv4()); // Generate new session token for next search
        }
        // --- End of try...catch block ---
    };

    // --- UI Layout ---
    return (
         <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingContainer}>
            <View style={styles.container}>
                 <Text style={styles.title}> Find Concerts </Text>
                 <Text style={styles.tagline}>ConcertFindr, all you need is a city and a date!</Text>

                 {/* Inputs */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter City (e.g., Chicago)"
                        value={city}
                        onChangeText={handleCityChange}
                        autoCapitalize="words"
                        onFocus={() => {
                            if (!interactionStarted.current) {
                                interactionStarted.current = true;
                                if (!sessionToken) setSessionToken(uuidv4());
                            }
                            if (selectedMapboxId) setShowSuggestions(false);
                        }}
                    />
                    {city.length > 0 && (
                        <TouchableOpacity onPress={handleClearCity} style={styles.clearIconTouchable}>
                            <Ionicons name="close-circle" size={22} color="#888" />
                        </TouchableOpacity>
                    )}
                    {isCityLoading && city.length > 2 && (
                         <ActivityIndicator size="small" color="#6200EE" style={styles.cityLoadingIndicator} />
                     )}
                    {showSuggestions && city.length > 0 && !selectedMapboxId && (
                        <FlatList
                            style={styles.suggestionsList}
                            data={suggestions}
                            keyExtractor={(item) => item.mapbox_id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.suggestionItem} onPress={() => onSuggestionPress(item)}>
                                    <Text style={styles.suggestionText}>{formatSuggestionText(item)}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.noSuggestionText}>No matching cities found</Text>}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled={true}
                        />
                    )}
                </View>
                <TouchableOpacity onPress={showStartDatepicker} style={styles.dateButton}>
                    <Text style={styles.dateButtonText}>Start Date: {formatDate(startDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={showEndDatepicker} style={styles.dateButton}>
                    <Text style={styles.dateButtonText}>End Date: {formatDate(endDate)}</Text>
                </TouchableOpacity>
                {showStartDatePicker && (<DateTimePicker testID="startDatePicker" value={startDate || new Date()} mode="date" display="default" onChange={onChangeStartDate}/>)}
                {showEndDatePicker && (<DateTimePicker testID="endDatePicker" value={endDate || startDate || new Date()} mode="date" display="default" onChange={onChangeEndDate} minimumDate={startDate || undefined}/>)}

                 {/* Mapbox Attribution */}
                 <View style={styles.attributionContainer}>
                     <Text style={styles.poweredByText}>
                         © <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.mapbox.com/about/maps/')}>Mapbox</Text>
                         {' '}© <Text style={styles.linkText} onPress={() => Linking.openURL('http://www.openstreetmap.org/copyright')}>OpenStreetMap</Text>
                         {' '}<Text style={styles.linkText} onPress={() => Linking.openURL('https://www.mapbox.com/map-feedback/')}>Improve this map</Text>
                     </Text>
                 </View>

                 {/* Button */}
                <View style={styles.buttonContainer}><Button title="Search Concerts" onPress={handleConcertSearch} color="#007AFF" disabled={isConcertLoading || !selectedMapboxId || !startDate || !endDate} /></View>

                {/* Results Area */}
                 <View style={styles.resultsArea}>{isConcertLoading && <ActivityIndicator size="large" color="#007AFF" />}{concertError && <Text style={styles.errorText}>{concertError}</Text>}{!isConcertLoading && !concertError && !searchAttempted && (<Text style={styles.noResultsText}>Enter criteria and search.</Text>)}{!isConcertLoading && !concertError && searchAttempted && concerts.length === 0 && (<Text style={styles.noResultsText}>No concerts found matching your criteria.</Text>)}{!isConcertLoading && !concertError && concerts.length > 0 && (<FlatList data={concerts} keyExtractor={(item) => item.id} renderItem={({ item }) => (<TouchableOpacity style={styles.concertItem} onPress={() => item.url && Linking.openURL(item.url)}><Text style={styles.concertName}>{item.name}</Text><Text style={styles.concertDate}>{item.dates?.start?.localDate} {formatTimeAmPm(item.dates?.start?.localTime)}</Text><Text style={styles.concertVenue}>{item._embedded?.venues?.[0]?.name} ({item._embedded?.venues?.[0]?.city?.name})</Text></TouchableOpacity>)} contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 50 }} />)}</View>
             </View>
         </KeyboardAvoidingView>
     );
}

// Styles
const styles = StyleSheet.create({
    keyboardAvoidingContainer: { flex: 1 },
    container: { flex: 1, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center', backgroundColor: '#FFFFFF' },
    title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, color: '#333333' },
    tagline: { fontSize: 17, color: '#666', textAlign: 'center', marginBottom: 30, fontStyle: 'italic', },
    inputContainer: { width: '100%', marginBottom: 10, position: 'relative', zIndex: 10 },
    input: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, width: '100%', backgroundColor: '#f9f9f9', fontSize: 16, paddingRight: 45 },
    clearIconTouchable: { position: 'absolute', right: 10, top: 0, height: 50, width: 35, justifyContent: 'center', alignItems: 'center', zIndex: 6 },
    cityLoadingIndicator: { position: 'absolute', right: 10, top: 15, zIndex: 5 },
    suggestionsList: { position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, maxHeight: 180, zIndex: 20 },
    suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    suggestionText: { fontSize: 16 },
    noSuggestionText: { padding: 12, fontStyle: 'italic', color: '#888' },
    dateButton: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, width: '100%', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'flex-start' },
    dateButtonText: { fontSize: 16, color: '#333' },
    attributionContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 8, },
    poweredByText: { fontSize: 10, color: '#888', },
    linkText: {
        color: '#007AFF',
        textDecorationLine: 'underline',
        fontSize: 10,
    },
    buttonContainer: { width: '100%', marginTop: 10, marginBottom: 20 },
    resultsArea: { flex: 1, width: '100%', marginTop: 15, },
    concertItem: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: '#fdfdfd', marginBottom: 5, borderRadius: 4, },
    concertName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, },
    concertDate: { fontSize: 14, color: '#555', marginBottom: 2, },
    concertVenue: { fontSize: 14, color: '#777', },
    errorText: { marginTop: 20, color: '#D32F2F', textAlign: 'center', fontSize: 16, paddingHorizontal: 10, },
    noResultsText: { marginTop: 40, color: '#888', fontStyle: 'italic', textAlign: 'center', fontSize: 16, }
});
