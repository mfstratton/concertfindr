import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="results"
        options={{
          title: 'Concert Results',
          headerBackTitle: '' // The fix is now here
        }}
      />
    </Stack>
  );
}