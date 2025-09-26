import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
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
    Modal,
    ScrollView,
    useColorScheme,
    SafeAreaView,
    Button,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface MapboxSuggestion { name: string; mapbox_id: string; feature_type: string; address?: string; full_address?: string; place_formatted?: string; context?: { country?: { id: string; name: string; country_code: string; country_code_alpha_3: string }; region?: { id: string; name: string; region_code?: string; region_code_full?: string }; district?: { id: string; name: string }; }; language?: string; maki?: string; metadata?: any; }
const GENRE_OPTIONS = ["Alternative", "Blues", "Classical", "Country", "Dance/Electronic", "Folk", "Hip-Hop/Rap", "Jazz", "Latin", "Metal", "New Age", "Pop", "R&B", "Reggae", "Religious", "Rock", "World"];
const RADIUS_OPTIONS = [5, 10, 20, 30, 40, 60];

// The final, polished theme with dark text
const calendarTheme = {
    backgroundColor: '#ffffff',
    calendarBackground: '#f9f9f9',
    textSectionTitleColor: '#2d4150',
    selectedDayBackgroundColor: '#007AFF',
    selectedDayTextColor: '#ffffff',
    todayTextColor: '#007AFF',
    dayTextColor: '#2d4150',
    textDisabledColor: '#d9e1e8',
    arrowColor: '#007AFF',
    monthTextColor: '#2d4150',
    'stylesheet.calendar.header': {
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingLeft: 10,
            paddingRight: 10,
            alignItems: 'center',
            backgroundColor: '#f0f0f0',
            paddingVertical: 5,
        }
    }
};


export default function SearchInputScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();

    const [city, setCity] = useState('');
    const [selectedMapboxId, setSelectedMapboxId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isCityLoading, setIsCityLoading] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [appIsReady, setAppIsReady] = useState(false);
    const [isAdvancedSearchVisible, setIsAdvancedSearchVisible] = useState(false);
    const [selectedRadius, setSelectedRadius] = useState<number>(30);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [isGenreModalVisible, setIsGenreModalVisible] = useState(false);
    const [isCalendarVisible, setCalendarVisible] = useState(false);
    const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');
    const [tempDate, setTempDate] = useState<Date | null>(null);

    const interactionStarted = useRef(false);
    const isInitialGenreLoadDone = useRef(false);

    useEffect(() => {
        async function prepareApp() {
            try {
                setSessionToken(uuidv4());
                const savedGenres = await AsyncStorage.getItem('user_genres');
                if (savedGenres !== null) {
                    setSelectedGenres(JSON.parse(savedGenres));
                } else {
                    setSelectedGenres([...GENRE_OPTIONS]);
                }
                isInitialGenreLoadDone.current = true;
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (e) {
                console.warn(e);
            } finally {
                setAppIsReady(true);
            }
        }
        prepareApp();
    }, []);

    useEffect(() => {
        if (isInitialGenreLoadDone.current) {
            AsyncStorage.setItem('user_genres', JSON.stringify(selectedGenres));
        }
    }, [selectedGenres]);

    const onLayoutRootView = useCallback(async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
        }
    }, [appIsReady]);

    const formatSuggestionText = (suggestion: MapboxSuggestion | undefined): string => { if (!suggestion) return ''; const name = suggestion.name; const regionCode = suggestion.context?.region?.region_code; return regionCode ? `${name}, ${regionCode}` : name; };
    const formatDate = (date: Date | null): string => { if (!date) return 'Select Date'; return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }); };
    const toLocalDateString = (date: Date): string => { const offset = date.getTimezoneOffset() * 60000; const localDate = new Date(date.getTime() - offset); return localDate.toISOString().slice(0, 10); };
    const fetchCitySuggestions = async (text: string) => { const currentSessionToken = sessionToken; if (!mapboxAccessToken || !currentSessionToken || text.length <= 2) { setSuggestions([]); setShowSuggestions(false); return; } setIsCityLoading(true); const apiUrl = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(text)}&language=en&limit=5&types=locality,place&country=US&session_token=${currentSessionToken}&access_token=${mapboxAccessToken}`; try { const response = await fetch(apiUrl); if (!response.ok) throw new Error('Mapbox Suggest API Error'); const data = await response.json(); setSuggestions(data.suggestions || []); setShowSuggestions(true); } catch (error) { console.error("Error fetching city suggestions:", error); setSuggestions([]); setShowSuggestions(false); } finally { setIsCityLoading(false); } };
    const debouncedFetchSuggestions = useCallback(debounce(fetchCitySuggestions, 300), [mapboxAccessToken, sessionToken]);
    const handleCityChange = (text: string) => { setCity(text); setSelectedMapboxId(null); if (!interactionStarted.current && text.length > 0) { interactionStarted.current = true; if (!sessionToken) setSessionToken(uuidv4()); } if (text.length > 2) { setIsCityLoading(true); setShowSuggestions(false); debouncedFetchSuggestions(text); } else { debouncedFetchSuggestions.cancel(); setIsCityLoading(false); setSuggestions([]); setShowSuggestions(false); } };
    const onSuggestionPress = (suggestion: MapboxSuggestion) => { setCity(formatSuggestionText(suggestion)); setSelectedMapboxId(suggestion.mapbox_id); setSuggestions([]); setShowSuggestions(false); Keyboard.dismiss(); interactionStarted.current = false; setSessionToken(uuidv4()); };
    const handleClearCity = () => { debouncedFetchSuggestions.cancel(); setCity(''); setSelectedMapboxId(null); setSuggestions([]); setShowSuggestions(false); setIsCityLoading(false); interactionStarted.current = false; setSessionToken(uuidv4()); };
    const openCalendar = (type: 'start' | 'end') => { setDatePickerType(type); const initialDate = type === 'start' ? startDate : endDate; setTempDate(initialDate); setCalendarVisible(true); };
    const onDayPress = (day: DateData) => { const selectedDate = new Date(day.dateString + 'T00:00:00'); setTempDate(selectedDate); };
    const handleDone = () => { if (!tempDate) { setCalendarVisible(false); return; } if (datePickerType === 'start') { setStartDate(tempDate); if (endDate && tempDate > endDate) { setEndDate(tempDate); } } else { if (startDate && tempDate < startDate) { Alert.alert("Invalid Range", "End date cannot be before start date."); } else { setEndDate(tempDate); } } setCalendarVisible(false); };
    const getMarkedDates = () => { const marked: { [key: string]: any } = {}; if (tempDate) { marked[toLocalDateString(tempDate)] = { selected: true, textColor: 'white' }; } return marked; };
    const handleGenreSelect = (genre: string) => { if (genre === 'All Genres') { if (selectedGenres.length === GENRE_OPTIONS.length) { setSelectedGenres([]); } else { setSelectedGenres([...GENRE_OPTIONS]); } return; } setSelectedGenres(prevGenres => { const newGenres = prevGenres.includes(genre) ? prevGenres.filter(g => g !== genre) : [...prevGenres, genre]; return newGenres; }); };
    const handleNavigateToResults = () => { if (!selectedMapboxId || !startDate || !endDate || !city) { Alert.alert("Validation Error", "Please select a city from suggestions and both dates."); return; } if (!mapboxAccessToken) { Alert.alert("API Key Error", "Mapbox API key not loaded."); return; } let genresToSend = selectedGenres; if (selectedGenres.length === GENRE_OPTIONS.length) { genresToSend = []; } const params = { mapboxId: selectedMapboxId, formattedCityName: city, startDate: toLocalDateString(startDate), endDate: toLocalDateString(endDate), sessionToken: sessionToken || uuidv4(), radius: selectedRadius.toString(), genres: genresToSend.join(','), }; router.push({ pathname: "/results", params: params }); interactionStarted.current = false; setSessionToken(uuidv4()); };

    if (!appIsReady) return null;

    const initialCalendarDate = datePickerType === 'end' ? (endDate || startDate) : (startDate);

    return (
         <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingContainer}
            onLayout={onLayoutRootView}
        >
            <View style={{ flex: 1, zIndex: 1 }}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.container}>
                        <View style={styles.headerContainer}>
                            <Image source={require('../assets/images/icon.png')} style={styles.logo} />
                            <Text style={styles.appNameTitle}>ConcertFindr™</Text>
                        </View>
                        <Text style={styles.tagline}>All you need is a city TEST1 and a date.</Text>
                        <View style={styles.inputContainer}>
                            <TextInput style={styles.input} placeholder="Enter City (e.g., Chicago)" placeholderTextColor="#8e8e93" value={city} onChangeText={handleCityChange} autoCapitalize="words" onFocus={() => { if (!interactionStarted.current) { interactionStarted.current = true; if (!sessionToken) setSessionToken(uuidv4()); } if (selectedMapboxId) setShowSuggestions(false); }} />
                            {city.length > 0 && ( <TouchableOpacity onPress={handleClearCity} style={styles.clearIconTouchable}>
                                <Ionicons name="close-circle" size={22} color="#888" />
                            </TouchableOpacity> )}
                            {isCityLoading && city.length > 2 && ( <ActivityIndicator size="small" color="#6200EE" style={styles.cityLoadingIndicator} /> )}
                        </View>

                        <TouchableOpacity onPress={() => openCalendar('start')} style={styles.dateButton}>
                            <Text style={styles.dateButtonText}>Start Date: {formatDate(startDate)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => openCalendar('end')}
                            style={styles.dateButton}
                        >
                            <Text style={styles.dateButtonText}>End Date: {formatDate(endDate)}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.advancedSearchToggle} onPress={() => setIsAdvancedSearchVisible(!isAdvancedSearchVisible)}>
                            <Text style={styles.advancedSearchText}>Advanced Search</Text>
                            <Ionicons name={isAdvancedSearchVisible ? "chevron-up" : "chevron-down"} size={20} color="#007AFF" />
                        </TouchableOpacity>
                        {isAdvancedSearchVisible && ( <View style={styles.advancedSearchContainer}>
                            <Text style={styles.advancedLabel}>Search Radius (miles)</Text>
                            <View style={styles.radiusOptionsContainer}>
                                {RADIUS_OPTIONS.map(radius => ( <TouchableOpacity key={radius} style={[styles.radiusButton, selectedRadius === radius && styles.radiusButtonSelected]} onPress={() => setSelectedRadius(radius)}>
                                    <Text style={[styles.radiusText, selectedRadius === radius && styles.radiusTextSelected]}>{radius}</Text>
                                </TouchableOpacity> ))}
                            </View>
                            <Text style={styles.advancedLabel}>Genre</Text>
                            <TouchableOpacity style={styles.genreButton} onPress={() => setIsGenreModalVisible(true)}>
                                <Text style={styles.genreButtonText}>{selectedGenres.length === GENRE_OPTIONS.length || selectedGenres.length === 0 ? 'All Genres' : selectedGenres.join(', ')}</Text>
                            </TouchableOpacity>
                        </View> )}
                        <View style={styles.buttonContainer}>
                            {Platform.OS === 'ios' ? ( <TouchableOpacity style={[styles.customButton, (!selectedMapboxId || !startDate || !endDate) && styles.disabledButton]} onPress={handleNavigateToResults} disabled={!selectedMapboxId || !startDate || !endDate}>
                                <Text style={styles.customButtonText}>Search Concerts</Text>
                            </TouchableOpacity> ) : ( <Button title="Search Concerts" onPress={handleNavigateToResults} color="#007AFF" disabled={!selectedMapboxId || !startDate || !endDate} /> )}
                        </View>
                    </View>

                    <View style={styles.attributionContainer}>
                        <Text style={styles.poweredByText}>
                            © <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.mapbox.com/about/maps/')}>Mapbox</Text>
                            {' '}© <Text style={styles.linkText} onPress={() => Linking.openURL('http://www.openstreetmap.org/copyright')}>OpenStreetMap</Text>
                            {' '}<Text style={styles.linkText} onPress={() => Linking.openURL('https://www.mapbox.com/map-feedback/')}>Improve this map</Text>
                        </Text>
                    </View>
                </ScrollView>

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
                    />
                )}
            </View>

            <Modal
                animationType="slide"
                transparent={false}
                visible={isCalendarVisible}
                onRequestClose={() => setCalendarVisible(false)}
            >
                <SafeAreaView style={styles.calendarSafeArea}>
                    <View style={styles.calendarWrapper}>
                        <Calendar
                            theme={calendarTheme}
                            onDayPress={onDayPress}
                            markedDates={getMarkedDates()}
                            minDate={toLocalDateString(datePickerType === 'end' ? startDate : new Date())}
                            current={toLocalDateString(initialCalendarDate)}
                            hideExtraDays={true}
                        />
                        <View style={styles.calendarButtons}>
                            <TouchableOpacity onPress={() => setCalendarVisible(false)} style={styles.calendarButton}>
                                <Text style={[styles.calendarButtonText, { color: '#FF3B30' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleDone} disabled={!tempDate} style={styles.calendarButton}>
                                <Text style={[styles.calendarButtonText, { fontWeight: 'bold' }, !tempDate && styles.disabledCalendarButtonText]}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={isGenreModalVisible} onRequestClose={() => setIsGenreModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#FFFFFF' }]}>
                        <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>Select Genres</Text>
                        <FlatList data={['All Genres', ...GENRE_OPTIONS]} keyExtractor={item => item} renderItem={({ item }) => { const isSelected = item === 'All Genres' ? selectedGenres.length === GENRE_OPTIONS.length : selectedGenres.includes(item); return ( <TouchableOpacity style={styles.genreItem} onPress={() => handleGenreSelect(item)}>
                            <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color="#007AFF" />
                            <Text style={[styles.genreText, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>{item}</Text>
                        </TouchableOpacity> ); }} numColumns={2} />
                        <View style={styles.modalButtonContainer}>
                            <Button title="Done" onPress={() => setIsGenreModalVisible(false)} />
                        </View>
                    </View>
                </View>
            </Modal>
         </KeyboardAvoidingView>
     );
}

const styles = StyleSheet.create({
    calendarSafeArea: {
        flex: 1,
        backgroundColor: 'white',
        justifyContent: 'center',
    },
    calendarWrapper: {
        height: 420,
        width: '100%',
    },
    calendarButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#cccccc',
        backgroundColor: '#f9f9f9',
    },
    calendarButton: {
        padding: 10,
    },
    calendarButtonText: {
        fontSize: 17,
        color: '#007AFF',
    },
    disabledCalendarButtonText: {
        color: '#d3d3d3',
    },
    keyboardAvoidingContainer: { flex: 1 },
    scrollView: { flex: 1 },
    scrollViewContent: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 40 : 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    headerContainer: { alignItems: 'center', marginBottom: 15, },
    logo: { width: 60, height: 60, resizeMode: 'contain', marginBottom: 8, },
    appNameTitle: { fontSize: 32, fontWeight: 'bold', color: '#333333', textAlign: 'center', },
    tagline: { fontSize: 17, color: '#666', textAlign: 'center', marginBottom: 25, fontStyle: 'italic', },
    inputContainer: { width: '100%', marginBottom: 10, position: 'relative' },
    input: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, width: '100%', backgroundColor: '#f9f9f9', fontSize: 16, paddingRight: 45 },
    clearIconTouchable: { position: 'absolute', right: 10, top: 0, height: 50, width: 35, justifyContent: 'center', alignItems: 'center', zIndex: 6 },
    cityLoadingIndicator: { position: 'absolute', right: 10, top: 15, zIndex: 5 },
    suggestionsList: { position: 'absolute', top: 220, left: 20, right: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, maxHeight: 180, zIndex: 20 },
    suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    suggestionText: { fontSize: 16 },
    noSuggestionText: { padding: 12, fontStyle: 'italic', color: '#888' },
    dateButton: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, width: '100%', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'flex-start' },
    dateButtonText: { fontSize: 16, color: '#333' },
    advancedSearchToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, },
    advancedSearchText: { fontSize: 16, color: '#007AFF', marginRight: 5, },
    advancedSearchContainer: { width: '100%', padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 15, },
    advancedLabel: { fontSize: 16, fontWeight: '500', marginBottom: 10, },
    radiusOptionsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15, },
    radiusButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#007AFF', marginBottom: 5, },
    radiusButtonSelected: { backgroundColor: '#007AFF', },
    radiusText: { color: '#007AFF', },
    radiusTextSelected: { color: '#FFFFFF' },
    genreButton: { height: 50, borderColor: '#cccccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, width: '100%', backgroundColor: '#FFFFFF', justifyContent: 'center', },
    genreButtonText: { fontSize: 16, color: '#333' },
    buttonContainer: { width: '100%', marginTop: 10 },
    customButton: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', },
    customButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', },
    disabledButton: { backgroundColor: '#A9A9A9', },
    attributionContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 20,
    },
    poweredByText: { fontSize: 12, color: '#888', textAlign: 'center', },
    linkText: { color: '#007AFF', textDecorationLine: 'underline', },
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)', },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -2, }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, maxHeight: '80%', },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, },
    genreItem: { flexDirection: 'row', alignItems: 'center', padding: 10, width: '50%', },
    genreText: { marginLeft: 10, fontSize: 16, },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20, }
});