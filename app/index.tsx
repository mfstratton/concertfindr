import React, { useState } from 'react';
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
    Image,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

// Import API keys
import { TICKETMASTER_API_KEY, GOOGLE_PLACES_API_KEY } from '../config';

export default function IndexScreen() {
    // --- State ---
    const [city, setCity] = useState('');
    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isCityLoading, setIsCityLoading] = useState(false);
    const [concerts, setConcerts] = useState<any[]>([]);
    const [isConcertLoading, setIsConcertLoading] = useState(false);
    const [concertError, setConcertError] = useState<string | null>(null);
    const [searchAttempted, setSearchAttempted] = useState(false);

    // --- Helper Functions ---
    const formatSuggestion = (description: string | undefined): string => { if (!description) return ''; if (description.endsWith(", USA")) { return description.substring(0, description.length - ", USA".length); } return description; };
    const formatDate = (date: Date | null): string => { if (!date) return 'Select Date'; return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    const formatTimeAmPm = (timeString: string | undefined): string => { if (!timeString) return ''; const timeStringParts = timeString.split(':'); if (timeStringParts.length < 2) return timeString; const hours24 = parseInt(timeStringParts[0], 10); const minutes = timeStringParts[1]; if (isNaN(hours24)) return timeString; const ampm = hours24 >= 12 ? 'PM' : 'AM'; let hours12 = hours24 % 12; if (hours12 === 0) { hours12 = 12; } return `${hours12}:${minutes} ${ampm}`; };

    // --- Handlers ---
    const handleCityChange = async (text: string) => { /* ... Google Places API Call ... */ setCity(text); setSelectedPlaceId(null); setSuggestions([]); setShowSuggestions(false); if (GOOGLE_PLACES_API_KEY === "YOUR_GOOGLE_PLACES_API_KEY" || !GOOGLE_PLACES_API_KEY) { console.warn("Google Key missing..."); return; } if (text.length > 2) { setIsCityLoading(true); const googleApiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=(cities)&components=country:us&key=${GOOGLE_PLACES_API_KEY}`; try { const response = await fetch(googleApiUrl); const data = await response.json(); if (data.status === 'OK') { setSuggestions(data.predictions); setShowSuggestions(true); } else { setSuggestions([]); setShowSuggestions(false); if (data.status !== 'ZERO_RESULTS') console.error("Google API Error:", data.status); } } catch (error) { console.error("Google fetch Error:", error); setSuggestions([]); setShowSuggestions(false); } finally { setIsCityLoading(false); } } else { setSuggestions([]); setShowSuggestions(false); }};
    const onSuggestionPress = (prediction: any) => { const formattedCity = formatSuggestion(prediction.description); setCity(formattedCity); setSelectedPlaceId(prediction.place_id); setSuggestions([]); setShowSuggestions(false); Keyboard.dismiss(); };
    const handleClearCity = () => { setCity(''); setSelectedPlaceId(null); setSuggestions([]); setShowSuggestions(false); };
    const onChangeStartDate = (event: DateTimePickerEvent, selectedDate?: Date) => { if (Platform.OS === 'android') { setShowStartDatePicker(false); } if (event.type === 'set' && selectedDate) { setStartDate(selectedDate); } if (Platform.OS === 'ios' && event.type !== 'set') { setShowStartDatePicker(false); } };
    const onChangeEndDate = (event: DateTimePickerEvent, selectedDate?: Date) => { if (Platform.OS === 'android') { setShowEndDatePicker(false); } if (event.type === 'set' && selectedDate) { setEndDate(selectedDate); if (startDate && selectedDate < startDate) { Alert.alert("Invalid Range", "..."); setEndDate(null); } } if (Platform.OS === 'ios' && event.type !== 'set') { setShowEndDatePicker(false); } };
    const showStartDatepicker = () => { setShowStartDatePicker(true); setShowSuggestions(false); Keyboard.dismiss(); };
    const showEndDatepicker = () => { setShowEndDatePicker(true); setShowSuggestions(false); Keyboard.dismiss(); };

    // --- Ticketmaster Search Function ---
    const handleConcertSearch = async () => { /* ... Geocoding + Ticketmaster API Call ... */ setSearchAttempted(true); Keyboard.dismiss(); setShowSuggestions(false); if (!selectedPlaceId) { Alert.alert("Missing Location", "..."); return; } if (!startDate || !endDate) { Alert.alert("Missing Dates", "..."); return; } if (TICKETMASTER_API_KEY === "YOUR_TICKETMASTER_API_KEY" || !TICKETMASTER_API_KEY || GOOGLE_PLACES_API_KEY === "YOUR_GOOGLE_PLACES_API_KEY" || !GOOGLE_PLACES_API_KEY) { Alert.alert("Missing API Key(s)", "..."); return; } setIsConcertLoading(true); setConcertError(null); setConcerts([]); try { const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${selectedPlaceId}&key=${GOOGLE_PLACES_API_KEY}`; const geoResponse = await fetch(geocodingUrl); const geoData = await geoResponse.json(); if (geoData.status !== 'OK' || !geoData.results || geoData.results.length === 0) { throw new Error(`Geocoding failed: ${geoData.status} ...`); } const location = geoData.results[0].geometry.location; const lat = location.lat; const lng = location.lng; const radius = 30; const unit = "miles"; const startDateTime = startDate.toISOString().slice(0, 10) + 'T00:00:00Z'; const endDateTime = endDate.toISOString().slice(0, 10) + 'T23:59:59Z'; const ticketmasterApiUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&latlong=${lat},${lng}&radius=${radius}&unit=${unit}&startDateTime=${startDateTime}&endDateTime=${endDateTime}&sort=date,asc&classificationName=Music&size=100`; const tmResponse = await fetch(ticketmasterApiUrl); if (!tmResponse.ok) { let errorMsg = `TM HTTP error! Status: ${tmResponse.status}`; try { const errorData = await tmResponse.json(); errorMsg += `: ${errorData?.fault?.faultstring || errorData?.errors?.[0]?.detail || 'Unknown TM error'}`; } catch (e) {} throw new Error(errorMsg); } const tmData = await tmResponse.json(); if (tmData._embedded && tmData._embedded.events) { setConcerts(tmData._embedded.events); } else { setConcerts([]); } } catch (err: any) { console.error("API Fetch Error:", err); setConcertError(`Search failed: ${err.message}`); } finally { setIsConcertLoading(false); } };
    // ---

    // --- UI Layout ---
    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingContainer}>
            <View style={styles.container}>
                <Text style={styles.title}> Find Concerts </Text>
                <Text style={styles.tagline}>ConcertFindr, all you need is a city and a date!</Text>

                {/* Inputs */}
                <View style={styles.inputContainer}>{/* ... City Input + Suggestions + Clear Button ... */}<TextInput style={styles.input} placeholder="Enter City (e.g., Chicago)" value={city} onChangeText={handleCityChange} autoCapitalize="words"/>{city.length > 0 && (<TouchableOpacity onPress={handleClearCity} style={styles.clearIconTouchable}><Ionicons name="close-circle" size={22} color="#888" /></TouchableOpacity>)}{isCityLoading && !showSuggestions && city.length > 0 && (<ActivityIndicator size="small" color="#6200EE" style={styles.cityLoadingIndicator} />)}{showSuggestions && (<FlatList style={styles.suggestionsList} data={suggestions} keyExtractor={(item) => item.place_id} renderItem={({ item }) => (<TouchableOpacity style={styles.suggestionItem} onPress={() => onSuggestionPress(item)}><Text style={styles.suggestionText}>{formatSuggestion(item.description)}</Text></TouchableOpacity>)} ListEmptyComponent={<Text style={styles.noSuggestionText}>No matching cities found</Text>} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true} />)}</View>
                <TouchableOpacity onPress={showStartDatepicker} style={styles.dateButton}><Text style={styles.dateButtonText}>Start Date: {formatDate(startDate)}</Text></TouchableOpacity>
                <TouchableOpacity onPress={showEndDatepicker} style={styles.dateButton}><Text style={styles.dateButtonText}>End Date: {formatDate(endDate)}</Text></TouchableOpacity>
                {showStartDatePicker && (<DateTimePicker testID="startDatePicker" value={startDate || new Date()} mode="date" display="default" onChange={onChangeStartDate}/>)}
                {showEndDatePicker && (<DateTimePicker testID="endDatePicker" value={endDate || startDate || new Date()} mode="date" display="default" onChange={onChangeEndDate} minimumDate={startDate || undefined}/>)}

                 {/* Google Attribution (Text + Image) */}
                 <View style={styles.attributionContainer}>
                     {/* MODIFIED: Added space back after 'by' */}
                     <Text style={styles.poweredByText}>Powered by </Text>
                     <Image source={require('../assets/images/powered_by_google_on_white.png')} style={styles.googleLogo} />
                 </View>

                 {/* Button */}
                <View style={styles.buttonContainer}><Button title="Search Concerts" onPress={handleConcertSearch} color="#007AFF" disabled={isConcertLoading} /></View>

                {/* Results Area */}
                <View style={styles.resultsArea}>
                    {isConcertLoading && <ActivityIndicator size="large" color="#007AFF" />}
                    {concertError && <Text style={styles.errorText}>{concertError}</Text>}
                    {!isConcertLoading && !concertError && !searchAttempted && (<Text style={styles.noResultsText}>Enter criteria and search.</Text>)}
                    {!isConcertLoading && !concertError && searchAttempted && concerts.length === 0 && (<Text style={styles.noResultsText}>No concerts found matching your criteria.</Text>)}
                    {!isConcertLoading && !concertError && concerts.length > 0 && (
                        <FlatList data={concerts} keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.concertItem} onPress={() => item.url && Linking.openURL(item.url)}>
                                    <Text style={styles.concertName}>{item.name}</Text>
                                    <Text style={styles.concertDate}>{item.dates?.start?.localDate} {formatTimeAmPm(item.dates?.start?.localTime)}</Text>
                                    <Text style={styles.concertVenue}>{item._embedded?.venues?.[0]?.name} ({item._embedded?.venues?.[0]?.city?.name})</Text>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 50 }}
                         />
                    )}
                </View>
            </View>
         </KeyboardAvoidingView>
    );
}

// Styles
const styles = StyleSheet.create({
    // ... (other styles remain the same) ...
    keyboardAvoidingContainer: { flex: 1 },
    container: { flex: 1, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center', backgroundColor: '#FFFFFF' },
    title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, color: '#333333' },
    tagline: { fontSize: 17, color: '#666', textAlign: 'center', marginBottom: 30, fontStyle: 'italic', },
    inputContainer: { width: '100%', marginBottom: 10, position: 'relative', zIndex: 10 },
    input: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, width: '100%', backgroundColor: '#f9f9f9', fontSize: 16, paddingRight: 45 },
    clearIconTouchable: { position: 'absolute', right: 10, top: 0, height: 50, width: 35, justifyContent: 'center', alignItems: 'center', zIndex: 6, },
    cityLoadingIndicator: { position: 'absolute', right: 10, top: 15, zIndex: 5 },
    suggestionsList: { position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, maxHeight: 180, zIndex: 20 },
    suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    suggestionText: { fontSize: 16 },
    noSuggestionText: { padding: 12, fontStyle: 'italic', color: '#888' },
    dateButton: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, width: '100%', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'flex-start' },
    dateButtonText: { fontSize: 16, color: '#333' },
    attributionContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 8, },
     // --- MODIFIED Attribution Text Style ---
    poweredByText: {
        fontSize: 10,
        color: '#888',
        marginRight: 3, // Changed back from 0 to 3
    },
    // ---
    googleLogo: { height: 12, width: 70, resizeMode: 'contain', },
    buttonContainer: { width: '100%', marginTop: 10, marginBottom: 20 },
    resultsArea: { flex: 1, width: '100%', marginTop: 15, },
    concertItem: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: '#fdfdfd', marginBottom: 5, borderRadius: 4, },
    concertName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, },
    concertDate: { fontSize: 14, color: '#555', marginBottom: 2, },
    concertVenue: { fontSize: 14, color: '#777', },
    errorText: { marginTop: 20, color: '#D32F2F', textAlign: 'center', fontSize: 16, paddingHorizontal: 10, },
    noResultsText: { marginTop: 40, color: '#888', fontStyle: 'italic', textAlign: 'center', fontSize: 16, }
});