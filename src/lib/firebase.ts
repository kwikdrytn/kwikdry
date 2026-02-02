import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBrzL_JHpcu2jbiVqey8mPGVm7sA8yzhf4",
  authDomain: "kwik-dry-dealership.firebaseapp.com",
  projectId: "kwik-dry-dealership",
  storageBucket: "kwik-dry-dealership.firebasestorage.app",
  messagingSenderId: "967103223283",
  appId: "1:967103223283:web:ab988c96e406d12c932e86",
  measurementId: "G-96YDBEX67N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging: Messaging | null = null;

// Only initialize messaging in browser environments that support it
if (typeof window !== 'undefined' && 'Notification' in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.log('Firebase messaging not supported:', error);
  }
}

// VAPID key for web push - from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = "BIZ70LRApNvMqBW4D9ck-zPLwO0rou0y_jkZFR0KJFwD0nhfxGF1_sU8-e79oqdzMCEckooPzRnj-w-YlAEF9fM";

export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) {
    console.log('Firebase messaging not available');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
}

export function onMessageListener(callback: (payload: any) => void) {
  if (!messaging) return () => {};
  
  return onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    callback(payload);
  });
}

export { messaging };
