importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD3qcja2lbwKcPsqecbEcYsInWyxm5jXHg",
  authDomain: "rentease-3cf26.firebaseapp.com",
  projectId: "rentease-3cf26",
  storageBucket: "rentease-3cf26.firebasestorage.app",
  messagingSenderId: "78195206223",
  appId: "1:78195206223:web:cf188b0d5f3f1ca25b223a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async (payload) => {
  console.log("Background FCM received:", payload);

  // Send message to all open browser tabs
  const clientsList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  clientsList.forEach((client) => {
    client.postMessage({
      type: "FCM_MESSAGE",
      payload: payload,
    });
  });

  const notificationTitle = payload.notification?.title || "New Update";
  const notificationOptions = {
    body: payload.notification?.body || "Check your app",
    icon: "/logo192.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});