import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Button,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Linking,
    SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';


const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const ticketmasterApiKey = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;

interface Coordinates {
    lat: number;
    lng: number;
}

interface MapboxRetrieveResponse {
    type: "FeatureCollection";
    features: {
        type: "Feature";
        geometry: {
            type: "Point";
            coordinates: [number, number];
        };
        properties: any;
    }[];
    attribution: string;
}

export default function ResultsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        mapboxId?: string,
        formattedCityName?: string,
        startDate?: string,
        endDate?: string,
        sessionToken?: string,
        radius?: string,
        genres?: string,
    }>();

    const [concerts, setConcerts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTitle, setSearchTitle] = useState<string>('Concert Results');

    const coordCache = useRef<Record<string, Coordinates>>({});

    const formatTimeAmPm = (timeString: string | undefined): string => {
        if (!timeString) return '';
        const timeStringParts = timeString.split(':');
        if (timeStringParts.length < 2) return timeString;
        const hours24 = parseInt(timeStringParts[0], 10);
        const minutes = timeStringParts[1];
        if (isNaN(hours24)) return timeString;
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12;
        if (hours12 === 0) { hours12 = 12; }
        return `${hours12}:${minutes} ${ampm}`;
    };

    const formatDisplayDate = (dateString: string | undefined): string => {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return dateString;
    };


    useEffect(() => {
        if (params.mapboxId && params.startDate && params.endDate && params.formattedCityName) {
            setSearchTitle(`Concerts in ${params.formattedCityName}`);
            fetchConcerts();
        } else {
            setError("Search parameters are missing.");
            console.error("Missing parameters for ResultsScreen:", params);
        }
    }, [params.mapboxId, params.startDate, params.endDate, params.formattedCityName]);

    const fetchConcerts = async () => {
        if (!params.mapboxId || !params.startDate || !params.endDate || !params.sessionToken || !params.radius) {
            setError("Required parameters for fetching concerts are missing.");
            return;
        }
        if (!ticketmasterApiKey || !mapboxAccessToken) {
            setError("API keys not loaded.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setConcerts([]);

        let lat: number | undefined;
        let lng: number | undefined;

        try {
            if (coordCache.current[params.mapboxId]) {
                const cachedCoords = coordCache.current[params.mapboxId];
                lat = cachedCoords.lat;
                lng = cachedCoords.lng;
            } else {
                const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${params.mapboxId}?session_token=${params.sessionToken}&access_token=${mapboxAccessToken}`;
                const retrieveResponse = await fetch(retrieveUrl);
                if (!retrieveResponse.ok) {
                    let errorData; try { errorData = await retrieveResponse.json(); } catch (e) { errorData = 'Could not parse error response body.'}
                    throw new Error(`Mapbox Retrieve Error ${retrieveResponse.status}: ${JSON.stringify(errorData)}`);
                }
                const retrieveData: MapboxRetrieveResponse = await retrieveResponse.json();
                const coordinates = retrieveData?.features?.[0]?.geometry?.coordinates;
                lng = coordinates?.[0];
                lat = coordinates?.[1];
                if (lat === undefined || lng === undefined) {
                    throw new Error('Could not extract coordinates from Mapbox.');
                }
                coordCache.current[params.mapboxId] = { lat, lng };
            }

            const radius = params.radius;
            const unit = "miles";

            // --- FIX: Remove the 'Z' to search by the venue's local time ---
            const startDateTime = `${params.startDate}T00:00:00`;
            const endDateTime = `${params.endDate}T23:59:59`;

            const selectedGenres = (params.genres && params.genres.length > 0) ? params.genres.split(',') : [];
            const genreIdQuery = selectedGenres.length > 0 ? `&genreId=${getGenreIds(selectedGenres)}` : '';

            const ticketmasterApiUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${ticketmasterApiKey}&latlong=${lat},${lng}&radius=${radius}&unit=${unit}&startDateTime=${startDateTime}&endDateTime=${endDateTime}&sort=date,asc&classificationName=Music&size=200${genreIdQuery}`;

            console.log("Requesting Ticketmaster URL:", ticketmasterApiUrl);
            const tmResponse = await fetch(ticketmasterApiUrl);
            if (!tmResponse.ok) {
                let errorMsg = `Ticketmaster API error! Status: ${tmResponse.status}`;
                try {
                    const errorData = await tmResponse.json();
                    const detail = errorData?.fault?.faultstring || errorData?.errors?.[0]?.detail || 'Unknown TM error';
                    errorMsg += `: ${detail}`;
                } catch (e) {}
                throw new Error(errorMsg);
            }
            const tmData = await tmResponse.json();
            let fetchedEvents: any[] = [];
            if (tmData._embedded && tmData._embedded.events) {
                fetchedEvents = tmData._embedded.events;
            }

            const activeEvents = fetchedEvents.filter(event => event.dates?.status?.code !== 'cancelled');

            // This client-side filter is a good safety check
            const filteredEventsByDate = activeEvents.filter(event => {
                const eventLocalDate = event.dates?.start?.localDate;
                return eventLocalDate && eventLocalDate >= params.startDate! && eventLocalDate <= params.endDate!;
            });
            setConcerts(filteredEventsByDate);

        } catch (err: any) {
            console.error("Error fetching concerts:", err.message);
            setError(`Failed to fetch concerts: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getGenreIds = (genres: string[]): string => {
        const genreMap: { [key: string]: string } = {
            "Alternative": "KnvZfZ7vAvv",
            "Blues": "KnvZfZ7vAvd",
            "Classical": "KnvZfZ7vAeJ",
            "Country": "KnvZfZ7vAv6",
            "Dance/Electronic": "KnvZfZ7vAvF",
            "Folk": "KnvZfZ7vAva",
            "Hip-Hop/Rap": "KnvZfZ7vAvJ",
            "Jazz": "KnvZfZ7vAvE",
            "Latin": "KnvZfZ7vAFe",
            "Metal": "KnvZfZ7vAvt",
            "New Age": "KnvZfZ7vAee",
            "Pop": "KnvZfZ7vAev",
            "R&B": "KnvZfZ7vA_e",
            "Reggae": "KnvZfZ7vAed",
            "Religious": "KnvZfZ7vAAd",
            "Rock": "KnvZfZ7vAeA",
            "World": "KnvZfZ7vAFr"
        };
        return genres.map(genre => genreMap[genre]).filter(id => id).join(',');
    };

    const renderConcertItem = ({ item }: { item: any }) => {
        const venueName = item._embedded?.venues?.[0]?.name || 'Venue TBD';
        const cityName = item._embedded?.venues?.[0]?.city?.name || 'City TBD';

        return (
            <TouchableOpacity style={styles.concertItem} onPress={() => item.url && Linking.openURL(item.url)}>
                <Text style={styles.concertName}>{item.name || 'Event Name Not Available'}</Text>
                <Text style={styles.concertDate}>{item.dates?.start?.localDate} {formatTimeAmPm(item.dates?.start?.localTime)}</Text>
                <Text style={styles.concertVenue}>{venueName} ({cityName})</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ title: searchTitle }} />
            <View style={styles.container}>
                <View style={styles.searchRecapContainer}>
                    <Text style={styles.searchRecapText}>
                        Dates: <Text style={styles.searchRecapValue}>{formatDisplayDate(params.startDate)} - {formatDisplayDate(params.endDate)}</Text>
                    </Text>
                </View>

                <View style={styles.modifyButtonContainer}>
                    <Button title="Modify Search" onPress={() => router.back()} color="#007AFF" />
                </View>

                {isLoading && <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />}
                {error && <Text style={styles.errorText}>{error}</Text>}
                {!isLoading && !error && concerts.length === 0 && (
                    <Text style={styles.noResultsText}>No concerts found for {params.formattedCityName} between {formatDisplayDate(params.startDate)} and {formatDisplayDate(params.endDate)}.</Text>
                )}
                {!isLoading && !error && concerts.length > 0 && (
                    <FlatList
                        data={concerts}
                        keyExtractor={(item) => item.id}
                        renderItem={renderConcertItem}
                        contentContainerStyle={styles.listContentContainer}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        paddingHorizontal: 15,
        paddingTop: 10,
    },
    searchRecapContainer: {
        paddingVertical: 10,
        paddingHorizontal: 5,
        marginBottom: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    searchRecapText: {
        fontSize: 15,
        color: '#333',
        textAlign: 'center',
    },
    searchRecapValue: {
        fontWeight: 'bold',
    },
    modifyButtonContainer: {
        marginBottom: 15,
        alignItems: 'center',
    },
    loader: {
        marginTop: 50,
    },
    errorText: {
        marginTop: 20,
        color: '#D32F2F',
        textAlign: 'center',
        fontSize: 16,
        paddingHorizontal: 10,
    },
    noResultsText: {
        marginTop: 40,
        color: '#888',
        fontStyle: 'italic',
        textAlign: 'center',
        fontSize: 16,
    },
    listContentContainer: {
        paddingBottom: 20,
    },
    concertItem: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fdfdfd',
        marginBottom: 5,
        borderRadius: 4,
    },
    concertName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    concertDate: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    concertVenue: {
        fontSize: 14,
        color: '#777',
    },
});