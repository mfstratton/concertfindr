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
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
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

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorData; try { errorData = await response.json(); } catch (e) { errorData = 'Could not parse error response body.'; }
                const errorDetails = `Mapbox Suggest HTTP Error ${response.status}: ${JSON.stringify(errorData)}`;
                console.error(errorDetails);
                throw new Error(errorDetails);
            }
            const data = await response.json();
            console.log('Mapbox Suggest Success Response:', data);
            if (data.suggestions) {
                setSuggestions(data.suggestions);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
                console.log("Mapbox Suggest returned OK but no suggestions field:", data);
            }
        } catch (error: any) {
            console.error("Error during Mapbox Suggest API call:", error);
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
        const mapboxId = suggestion.mapbox_id;
        const displayValue = formatSuggestionText(suggestion);
        setCity(displayValue);
        setSelectedMapboxId(mapboxId);
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

    const onChangeStartDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowStartDatePicker(false);
        }
        if (event.type === 'set' && selectedDate) {
            setStartDate(selectedDate);
            setEndDate(selectedDate);
        }
    };
    const onChangeEndDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowEndDatePicker(false);
        }
        if (event.type === 'set' && selectedDate) {
            if (startDate && selectedDate < startDate) {
                Alert.alert("Invalid Range", "End date cannot be before start date.");
                setEndDate(null);
            } else {
                setEndDate(selectedDate);
            }
        }
    };
    const showStartDatepicker = () => { setShowStartDatePicker(true); setShowSuggestions(false); Keyboard.dismiss(); };
    const showEndDatepicker = () => { setShowEndDatePicker(true); setShowSuggestions(false); Keyboard.dismiss(); };

    const handleNavigateToResults = () => {
        Keyboard.dismiss();
        setShowSuggestions(false);
        debouncedFetchSuggestions.cancel();

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

    if (!appIsReady) {
        return null;
    }

    const renderDatePicker = () => {
        const isPickerVisible = showStartDatePicker || showEndDatePicker;
        if (!isPickerVisible) return null;

        // For Android, it remains a modal by default
        if (Platform.OS === 'android') {
            if (showStartDatePicker) {
                return <DateTimePicker testID="startDatePicker" value={startDate || new Date()} mode="date" display="default" onChange={onChangeStartDate}/>;
            }
            if (showEndDatePicker) {
                return <DateTimePicker testID="endDatePicker" value={endDate || startDate || new Date()} mode="date" display="default" onChange={onChangeEndDate} minimumDate={startDate || undefined}/>;
            }
        }

        // For iOS, we will render the picker directly if it's supposed to be shown
        // This will now use the more reliable 'spinner' display inside a modal
        if (Platform.OS === 'ios') {
            return (
                <Modal
                    transparent={true}
                    animationType="slide"
                    visible={isPickerVisible}
                    onRequestClose={() => {
                        setShowStartDatePicker(false);
                        setShowEndDatePicker(false);
                    }}
                >
                    <TouchableOpacity
                        style={styles.modalContainer}
                        activeOpacity={1}
                        onPressOut={() => { setShowStartDatePicker(false); setShowEndDatePicker(false); }}
                    >
                        <View style={styles.modalContent}>
                            {showStartDatePicker && (
                                <DateTimePicker
                                    testID="startDatePicker"
                                    value={startDate || new Date()}
                                    mode="date"
                                    display="spinner"
                                    onChange={onChangeStartDate}
                                    textColor={colorScheme === 'dark' ? 'white' : 'black'}
                                />
                            )}
                            {showEndDatePicker && (
                                <DateTimePicker
                                    testID="endDatePicker"
                                    value={endDate || startDate || new Date()}
                                    mode="date"
                                    display="spinner"
                                    onChange={onChangeEndDate}
                                    minimumDate={startDate || undefined}
                                    textColor={colorScheme === 'dark' ? 'white' : 'black'}
                                />
                            )}
                            <Button title="Done" onPress={() => { setShowStartDatePicker(false); setShowEndDatePicker(false); }} />
                        </View>
                    </TouchableOpacity>
                </Modal>
            );
        }

        return null;
    };

    // Helper for date range props
    const getMaximumDate = () => {
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 2);
        return maxDate;
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
                    <TouchableOpacity onPress={showStartDatepicker} style={styles.dateButton}>
                        <Text style={styles.dateButtonText}>Start Date: {formatDate(startDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={showEndDatepicker} style={styles.dateButton}>
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
