const dotenv = require('dotenv');
const path = require('path');

// Manually load .env from the root
dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default {
  expo: {
    name: "Blame Travis",
    slug: "blame-travis",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/brand/Blame_Travis_Logo-removebg-preview.png",
      resizeMode: "contain",
      backgroundColor: "#121212"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gyasi.blametravis",
      config: {
        googleMapsApiKey: apiKey
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Travis needs your location to scout the area and verify your adventure progress."
      }
    },
    android: {
      config: {
        googleMaps: {
          apiKey: apiKey
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#121212"
      },
      package: "com.gyasi.blametravis",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: true,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE"
      ]
    },
    plugins: [
      "expo-localization",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Travis needs your location to scout the area and verify your adventure progress."
        }
      ]
    ],
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};
