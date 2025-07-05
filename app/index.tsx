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
    Image,
    Modal,
    ScrollView,
    useColorScheme,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

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

export default function SearchInputScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();

    const [city, setCity] = useState('');
    const [selectedMapboxId, setSelectedMapboxId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState<null | 'start' | 'end'>(null);
    const [tempDate, setTempDate] = useState(new Date());

    const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isCityLoading, setIsCityLoading] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [appIsReady, setAppIsReady] = useState(false);

    const interactionStarted = useRef(false);

    useEffect(() => {
        async function prepareApp() {
            try {
                setSessionToken(uuidv4());
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (e) {
                console.warn(e);
            } finally {
                setAppIsReady(true);
            }
        }
        prepareApp();
    }, []);

    const onLayoutRootView = useCallback(async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
        }
    }, [appIsReady]);

    const formatSuggestionText = (suggestion: MapboxSuggestion | undefined): string => {
        if (!suggestion) return '';
        const name = suggestion.name;
        const regionCode = suggestion.context?.region?.region_code;
        return regionCode ? `${name}, ${regionCode}` : name;
    };
    const formatDate = (date: Date | null): string => { if (!date) return 'Select Date'; return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }); };
    const toLocalDateString = (date: Date): string => {
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 10);
    };

    const fetchCitySuggestions = async (text: string) => {
        const currentSessionToken = sessionToken;
        if (!mapboxAccessToken || !currentSessionToken || text.length <= 2) {
            setSuggestions([]); setShowSuggestions(false);
            return;
        }

        setIsCityLoading(true);
        const apiUrl = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(text)}&language=en&limit=5&types=locality,place&country=US&session_token=${currentSessionToken}&access_token=${mapboxAccessToken}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Mapbox Suggest API Error');
            const data = await response.json();
            setSuggestions(data.suggestions || []);
            setShowSuggestions(true);
        } catch (error) {
            console.error("Error fetching city suggestions:", error);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setIsCityLoading(false);
        }
    };

    const debouncedFetchSuggestions = useCallback(debounce(fetchCitySuggestions, 300), [mapboxAccessToken, sessionToken]);

    const handleCityChange = (text: string) => {
        setCity(text);
        setSelectedMapboxId(null);
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
        setCity(formatSuggestionText(suggestion));
        setSelectedMapboxId(suggestion.mapbox_id);
        setSuggestions([]);
        setShowSuggestions(false);
        Keyboard.dismiss();
        interactionStarted.current = false;
        setSessionToken(uuidv4());
    };

    const handleClearCity = () => {
        debouncedFetchSuggestions.cancel();
        setCity('');
        setSelectedMapboxId(null);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsCityLoading(false);
        interactionStarted.current = false;
        setSessionToken(uuidv4());
    };

    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            const currentDate = selectedDate || (showDatePicker === 'start' ? startDate : endDate) || new Date();
            setShowDatePicker(null);
            if (event.type === 'set') {
                if (showDatePicker === 'start') {
                    setStartDate(currentDate);
                } else {
                    if (startDate && currentDate < startDate) {
                        Alert.alert("Invalid Range", "End date cannot be before start date.");
                    } else {
                        setEndDate(currentDate);
                    }
                }
            }
        } else {
            if (selectedDate) {
                setTempDate(selectedDate);
            }
        }
    };

    const handleDonePressIOS = () => {
        if (showDatePicker === 'start') {
            setStartDate(tempDate);
        } else if (showDatePicker === 'end') {
            if (startDate && tempDate < startDate) {
                Alert.alert("Invalid Range", "End date cannot be before start date.");
            } else {
                setEndDate(tempDate);
            }
        }
        setShowDatePicker(null);
    };

    const openDatePicker = (picker: 'start' | 'end') => {
        Keyboard.dismiss();
        setShowSuggestions(false);
        const initialDate = picker === 'start' ? (startDate || new Date()) : (endDate || startDate || new Date());
        setTempDate(initialDate);
        setShowDatePicker(picker);
    };

    const handleNavigateToResults = () => {
        if (!selectedMapboxId || !startDate || !endDate || !city) {
            Alert.alert("Validation Error", "Please select a city from suggestions and both dates.");
            return;
        }
        if (!mapboxAccessToken) {
            Alert.alert("API Key Error", "Mapbox API key not loaded.");
            return;
        }
        const params = {
            mapboxId: selectedMapboxId,
            formattedCityName: city,
            startDate: toLocalDateString(startDate),
            endDate: toLocalDateString(endDate),
            sessionToken: sessionToken || uuidv4()
        };
        router.push({ pathname: "/results", params: params });
        interactionStarted.current = false;
        setSessionToken(uuidv4());
    };

    if (!appIsReady) return null;

    const renderDatePicker = () => {
        const isPickerVisible = showDatePicker !== null;

        if (Platform.OS === 'android' && isPickerVisible) {
            return (
                <DateTimePicker
                    value={showDatePicker === 'start' ? (startDate || new Date()) : (endDate || startDate || new Date())}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={showDatePicker === 'end' ? (startDate || new Date()) : new Date()}
                />
            );
        }

        if (Platform.OS === 'ios') {
            return (
                <Modal
                    transparent={true}
                    animationType="slide"
                    visible={isPickerVisible}
                    onRequestClose={() => setShowDatePicker(null)}
                >
                    <TouchableOpacity
                        style={styles.modalContainer}
                        activeOpacity={1}
                        onPressOut={() => setShowDatePicker(null)}
                    >
                        <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#333' : '#fff' }]}>
                            <DateTimePicker
                                value={tempDate}
                                mode="date"
                                display="spinner"
                                onChange={handleDateChange}
                                minimumDate={showDatePicker === 'end' ? (startDate || undefined) : undefined}
                                theme={colorScheme === 'dark' ? 'dark' : 'light'}
                            />
                            <Button title="Done" onPress={handleDonePressIOS} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            );
        }
        return null;
    };

    return (
         <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingContainer}
            onLayout={onLayoutRootView}
        >
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
                    <Text style={styles.tagline}>All you need is a city and a date.</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter City (e.g., Chicago)"
                            placeholderTextColor="#8e8e93"
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
                    <TouchableOpacity onPress={() => openDatePicker('start')} style={styles.dateButton}>
                        <Text style={styles.dateButtonText}>Start Date: {formatDate(startDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openDatePicker('end')} style={styles.dateButton}>
                        <Text style={styles.dateButtonText}>End Date: {formatDate(endDate)}</Text>
                    </TouchableOpacity>

                    {renderDatePicker()}

                    <View style={styles.attributionContainer}>
                        <Text style={styles.poweredByText}>
                            © <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.mapbox.com/about/maps/')}>Mapbox</Text>
                            {' '}© <Text style={styles.linkText} onPress={() => Linking.openURL('http://www.openstreetmap.org/copyright')}>OpenStreetMap</Text>
                            {' '}<Text style={styles.linkText} onPress={() => Linking.openURL('https://www.mapbox.com/map-feedback/')}>Improve this map</Text>
                        </Text>
                    </View>

                    <View style={styles.buttonContainer}>
                       <Button title="Search Concerts" onPress={handleNavigateToResults} color="#007AFF" disabled={!selectedMapboxId || !startDate || !endDate} />
                    </View>
                 </View>
            </ScrollView>
         </KeyboardAvoidingView>
     );
}

const styles = StyleSheet.create({
    keyboardAvoidingContainer: { flex: 1 },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'center'
    },
    container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center', backgroundColor: '#FFFFFF' },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    logo: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
        marginBottom: 8,
    },
    appNameTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333333',
        textAlign: 'center',
    },
    tagline: { fontSize: 17, color: '#666', textAlign: 'center', marginBottom: 25, fontStyle: 'italic', },
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
    errorText: { marginTop: 20, color: '#D32F2F', textAlign: 'center', fontSize: 16, paddingHorizontal: 10, },
    noResultsText: { marginTop: 40, color: '#888', fontStyle: 'italic', textAlign: 'center', fontSize: 16, },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
});
